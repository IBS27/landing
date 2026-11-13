import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { review } from "../convex/ai/agent";
import * as chatPlans from "../convex/chatPlans";
import {
  type ChatLine,
  type ChatPlanInput,
  chatPlanTask,
  clockLabel,
  excerptAbout,
  type PlaceOption,
  placeOptions,
  planRoute,
  planStage,
  planTalkActivity,
  planTemplate,
  planTitle,
  pollClosesAt,
  remindAt,
  reminderText,
  routeSteps,
  SLOT_LEAD_MS,
  sfDate,
  sfTime,
  slotLabel,
  spotTalk,
  timeSlots,
} from "../convex/lib/chatPlans";
import { pollWinner } from "../convex/lib/polls";
import { assertPayload, assertSameTarget, targetReachable } from "../convex/lib/proposals";
import { vote } from "../convex/polls";
import { approve, discard } from "../convex/proposals";
import { fakeCtx, type Row } from "./fakeDb";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Thursday, Nov 12 2026, 9am in San Francisco. */
const THU = Date.UTC(2026, 10, 12, 17);

/* ---------------- Spotting plan talk ---------------- */

describe("spotting plan talk", () => {
  test("a plan cue plus an activity", () => {
    expect(planTalkActivity("we should hike sometime")).toBe("hiking");
    expect(planTalkActivity("anyone down to climb this weekend?")).toBe("climbing");
    expect(planTalkActivity("let's do karaoke for ethan's bday")).toBe("karaoke");
    expect(planTalkActivity("let's see how it goes")).toBeNull(); // no activity
    expect(planTalkActivity("went hiking yesterday, so good")).toBeNull(); // no plan cue
    expect(planTalkActivity("we should have hiked when it was sunny")).toBeNull(); // the past
  });

  const line = (id: string, by: string, text: string, minutes: number): ChatLine => ({
    _id: id,
    senderId: by,
    text,
    createdAt: THU - DAY + minutes * 60_000,
  });

  test("the first message that floats it, and who chimed in within two days", () => {
    const talk = spotTalk(
      [
        line("m1", "zoe", "we should hike sometime before the move gets crazy", 0),
        line("m2", "dan", "yes!! the bernal hill stairs", 5),
        line("m3", "zoe", "so excited", 6), // the talker doesn't count
        line("m4", "sofia", "i'm in. weekends only", 9),
        line("m5", "ethan", "down. not before 9 please", 12),
        line("m6", "marcus", "i'll bring snacks", 20),
        line("m7", "dan", "let's hike lands end too", 30), // same activity: not a second plan
      ],
      THU,
    );
    expect(talk).toHaveLength(1);
    expect(talk[0]).toMatchObject({ messageId: "m1", activity: "hiking" });
    expect(talk[0]?.chimedIn).toEqual(["dan", "sofia", "ethan"]);
  });

  test("talk older than three weeks is left alone", () => {
    const old = { ...line("m1", "zoe", "we should hike sometime", 0), createdAt: THU - 22 * DAY };
    expect(spotTalk([old], THU)).toEqual([]);
  });
});

/* ---------------- Times ---------------- */

describe("times", () => {
  test("weekend mornings for a hike, at least 36 hours out, in San Francisco time", () => {
    const slots = timeSlots("hiking", THU);
    expect(slots.map((s) => s.label)).toEqual([
      "Sat, Nov 14 · 10 AM",
      "Sat, Nov 14 · 2 PM",
      "Sun, Nov 15 · 10 AM",
      "Sun, Nov 15 · 2 PM",
      "Sat, Nov 21 · 10 AM",
    ]);
    expect(slots.every((s) => s.startAt >= THU + SLOT_LEAD_MS)).toBe(true);
    expect(slots.map((s) => s.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  test("evenings for karaoke; this weekend's too-soon slots are skipped", () => {
    const fridayNight = Date.UTC(2026, 10, 14, 4); // Fri 8pm in SF
    const labels = timeSlots("karaoke", fridayNight).map((s) => s.label);
    expect(labels[0]).toBe("Thu, Nov 19 · 8 PM");
    expect(labels.every((l) => l.endsWith("8 PM"))).toBe(true);
  });

  test("wall-clock times hold across the DST change", () => {
    expect(clockLabel(sfTime("2026-11-01", 10))).toBe("10 AM"); // the day DST ends
    expect(clockLabel(sfTime("2026-03-08", 10))).toBe("10 AM"); // the day it starts
    expect(sfDate(sfTime("2026-11-01", 23, 30))).toBe("2026-11-01");
  });

  test("the poll closes at 6pm the evening before; the reminder goes out by 8am", () => {
    const sat10 = sfTime("2026-11-14", 10);
    expect(slotLabel(pollClosesAt([{ startAt: sat10 }, { startAt: sat10 + DAY }], THU))).toBe(
      "Fri, Nov 13 · 6 PM",
    );
    // Never sooner than two hours out.
    expect(pollClosesAt([{ startAt: sat10 }], sfTime("2026-11-13", 17))).toBe(
      sfTime("2026-11-13", 19),
    );
    expect(slotLabel(remindAt(sat10))).toBe("Sat, Nov 14 · 8 AM");
    const early = sfTime("2026-11-14", 7);
    expect(remindAt(early)).toBe(early - 2 * HOUR);
  });
});

/* ---------------- Templates (AI off) ---------------- */

const URBAN_HIKE =
  "Easy city hike for anyone new to SF (or new to hills). Meet at the top of Dolores Park by the Muni stop at 8:00, then up through Liberty Hill, down the stairways and over to the top of Bernal Hill for the view. About 4 miles, 2 hours, a few steep blocks.\n\nBring water and a layer, the fog sits on Bernal until 10. Coffee after on Cortland for whoever's in.";

const hikeEvent: PlaceOption = {
  source: "event:e1",
  kind: "event",
  title: "Saturday Urban Hike: Dolores Park to Bernal Hill",
  venue: "Dolores Park (top, by the Muni stop)",
  when: "Sat, Nov 14 · 8 AM",
  from: "Bay Area Hikers",
  text: URBAN_HIKE,
  timeId: null,
};
const hikePost: PlaceOption = {
  source: "post:p1",
  kind: "post",
  title: "A post in Bay Area Hikers",
  venue: null,
  when: null,
  from: "Bay Area Hikers",
  text: "Lands End in the fog today. 3 herons, zero people",
  timeId: null,
};
const input: ChatPlanInput = {
  owner: "Maya",
  chat: { title: "SF move-in crew 🌉", members: ["Zoe", "Daniel", "Sofia"] },
  talk: {
    by: "Zoe",
    text: "we should hike sometime before the move gets crazy",
    chimedIn: ["Daniel", "Sofia"],
  },
  recent: [{ by: "Sofia", text: "i'm in. weekends only" }],
  activity: { id: "hiking", label: "Hiking", emoji: "🥾" },
  places: [hikePost, hikeEvent],
  times: timeSlots("hiking", THU).map((s) => ({ id: s.id, label: s.label })),
};

describe("templates", () => {
  test("route steps come from the Event's own words, without its times", () => {
    expect(routeSteps(URBAN_HIKE)).toEqual([
      "Meet at the top of Dolores Park by the Muni stop",
      "Up through Liberty Hill, down the stairways and over to the top of Bernal Hill for the view",
      "Coffee after on Cortland for whoever's in",
    ]);
  });

  test("a plan's title drops the Event's own day", () => {
    expect(planTitle("Hiking", hikeEvent)).toBe("Urban Hike: Dolores Park to Bernal Hill");
    expect(planTitle("Karaoke", hikePost)).toBe("Karaoke plan");
  });

  test("without a model: the Event's place and route, the first three times, no time in the text", () => {
    const out = planTemplate(input);
    expect(out).toMatchObject({
      title: "Urban Hike: Dolores Park to Bernal Hill",
      placeSource: "event:e1",
      place: "Dolores Park (top, by the Muni stop)",
      timeIds: ["t1", "t2", "t3"],
      question: "When works for Urban Hike: Dolores Park to Bernal Hill?",
    });
    expect(planRoute(input.places.find((p) => p.source === out.placeSource))).toHaveLength(3);
    expect(out.text.length).toBeLessThanOrEqual(400);
    expect(out.text).not.toMatch(/\d(am|pm| am| pm)|\d:\d\d/i);
    expect(out.rationale).toBe(
      "Zoe floated it and Daniel and Sofia are in. The place and route come from an upcoming Event in Bay Area Hikers.",
    );
    expect(out.text).toStartWith(
      "🥾 Turning “we should hike sometime before the move gets crazy” into a plan:",
    );
  });

  test("an Event's own time leads the poll, so the chat can go along with it", () => {
    const withTime: ChatPlanInput = {
      ...input,
      places: [{ ...hikeEvent, timeId: "e6" }],
      times: [...input.times, { id: "e6", label: "Sat, Nov 14 · 8 AM (with Bay Area Hikers)" }],
    };
    expect(planTemplate(withTime).timeIds).toEqual(["e6", "t1", "t2"]);
  });

  test("from a post, the place on the same line as the activity, not the post's other stops", () => {
    const nobHill: PlaceOption = {
      ...hikePost,
      source: "post:p2",
      from: "Nob Hill Neighbors",
      text: "my perfect saturday\n10:00 walk up to Huntington Park\n9:00 if you're brave: Neon Duet Karaoke (Polk & Sacramento)",
    };
    const karaoke = {
      ...input,
      activity: { id: "karaoke" as const, label: "Karaoke", emoji: "🎤" },
    };
    expect(planTemplate({ ...karaoke, places: [nobHill] })).toMatchObject({
      place: "Neon Duet Karaoke",
      title: "Neon Duet Karaoke",
    });
    expect(
      planTemplate({ ...input, places: [{ ...nobHill, text: "10:00 Huntington Park" }] }).place,
    ).toBe("");
  });

  test("a long post is cut around its line about the activity", () => {
    const long = `${"10:00 walk to the park and sit by the fountain\n".repeat(15)}9:00 Neon Duet Karaoke`;
    const cut = excerptAbout(long, "karaoke");
    expect(cut.length).toBeLessThanOrEqual(500);
    expect(cut).toContain("Neon Duet Karaoke");
    expect(cut).toStartWith("…");
  });

  test("the quote starts at the plan cue and ends with its sentence", () => {
    expect(
      planTemplate({
        ...input,
        talk: {
          ...input.talk,
          text: "unrelated but we should hit a farmers market one of these saturdays. i need real vegetables",
        },
      }).text,
    ).toContain("“we should hit a farmers market one of these saturdays”");
  });

  test("the day-of reminder names the time, where to meet and who's going", () => {
    expect(
      reminderText({
        emoji: "🥾",
        title: "Urban Hike",
        startAt: sfTime("2026-11-14", 10),
        route: ["Meet at the top of Dolores Park by the Muni stop"],
        going: 4,
      }),
    ).toBe(
      "Today! 🥾 Urban Hike at 10 AM. Meet at the top of Dolores Park by the Muni stop. 4 of us are going. See you there!",
    );
  });
});

/* ---------------- Muse's checks ---------------- */

const grounding = (keys: string[]) => ({
  ids: new Set<string>(),
  sources: new Map(keys.map((k) => [k, {} as never])),
  wrongTable: async () => [],
});
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Lands End hike",
    placeSource: "post:p1",
    place: "Lands End",
    timeIds: ["t1", "t3"],
    question: "When works for the Lands End hike?",
    text: "🥾 Let's do the Lands End hike Zoe floated! Pick the times that work.",
    rationale: "Zoe floated it and Daniel and Sofia are in; locals love Lands End.",
    ...over,
  });

describe("muse.chatPlan review", () => {
  const g = grounding(["post:p1", "event:e1"]);
  const problems = async (over: Record<string, unknown>) => {
    const r = await review(chatPlanTask, [answer(over)], input, g, "stop");
    return r.ok ? [] : r.problems;
  };

  test("accepts a grounded plan", async () => {
    expect(await problems({})).toEqual([]);
  });

  test("rejects an invented place, an unknown time, a time in the text and a made-up source", async () => {
    expect((await problems({ place: "Twin Peaks" })).join()).toContain("isn't named in post:p1");
    expect((await problems({ timeIds: ["t1", "t9"] })).join()).toContain(
      '"t9" isn\'t one of the times',
    );
    expect((await problems({ timeIds: ["t1"] })).join()).toContain("2 or 3 different ids");
    expect((await problems({ text: "Lands End hike Saturday at 10am!" })).join()).toContain(
      "don't state a time",
    );
    expect((await problems({ placeSource: "post:nope" })).join()).toContain(
      "isn't one of the places",
    );
  });
});

/* ---------------- Stages and the poll's winner ---------------- */

describe("plan stages", () => {
  const p = (status: "pending" | "approved" | "rejected", expiresAt?: number) => ({
    status,
    expiresAt,
  });
  const at = (s: Partial<Parameters<typeof planStage>[0]>) =>
    planStage({ poll: null, event: null, reminder: null, eventStartAt: null, ...s }, THU);

  test("poll → Event → reminder → done, read from the proposals", () => {
    expect(at({ poll: p("pending") })).toBe("pollDraft");
    expect(at({ poll: p("approved") })).toBe("polling");
    expect(at({ poll: p("approved"), event: p("pending") })).toBe("eventDraft");
    const live = { poll: p("approved"), event: p("approved"), eventStartAt: THU + DAY };
    expect(at(live)).toBe("scheduled");
    expect(at({ ...live, reminder: p("pending") })).toBe("reminderDraft");
    expect(at({ ...live, reminder: p("approved") })).toBe("reminded");
    expect(at({ ...live, eventStartAt: THU - HOUR })).toBe("done");
  });

  test("a discarded or expired poll drops the plan; a discarded Event goes back to the poll", () => {
    expect(at({ poll: p("rejected") })).toBe("dropped");
    expect(at({ poll: p("pending", THU - 1) })).toBe("dropped");
    expect(at({ poll: p("approved"), event: p("rejected") })).toBe("polling");
  });

  test("the winner: most votes among times still ahead, then the earliest", () => {
    const poll = {
      question: "When?",
      options: [
        { id: "a", label: "A", startAt: THU + 2 * DAY },
        { id: "b", label: "B", startAt: THU + 3 * DAY },
        { id: "c", label: "C", startAt: THU - DAY },
      ],
    };
    const v = (userId: string, optionIds: string[]) => ({ userId: userId as never, optionIds });
    expect(pollWinner(poll, [v("1", ["a", "b"]), v("2", ["b"])], THU)?.id).toBe("b");
    expect(pollWinner(poll, [v("1", ["a", "b"])], THU)?.id).toBe("a");
    expect(pollWinner(poll, [v("1", ["c"]), v("2", ["c"])], THU)).toBeNull();
    expect(pollWinner(poll, [], THU)).toBeNull();
  });
});

/* ---------------- Through the Convex functions ---------------- */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, args);
const as = (viewer: string) => ({ viewerId: `users:${viewer}` });

function world() {
  const now = Date.now();
  const user = (id: string, firstName: string) => ({
    _id: `users:${id}`,
    name: `${firstName} Test`,
    firstName,
    username: id,
    avatar: "",
    verified: false,
    city: "San Francisco, CA",
  });
  const member = (u: string) => ({
    _id: `conversationMembers:${u}`,
    conversationId: "conversations:crew",
    userId: `users:${u}`,
    lastReadAt: now,
    lastMessageAt: now - HOUR,
  });
  const msg = (id: string, by: string, text: string, ago: number) => ({
    _id: `messages:${id}`,
    conversationId: "conversations:crew",
    senderId: `users:${by}`,
    author: { kind: "human" },
    status: "sent",
    text,
    attachments: [],
    createdAt: now - ago,
  });
  const tables: Record<string, Row[]> = {
    users: [
      user("maya", "Maya"),
      user("zoe", "Zoe"),
      user("dan", "Daniel"),
      user("host", "Tara"),
      user("stranger", "Sam"),
    ],
    conversations: [
      {
        _id: "conversations:crew",
        kind: "group",
        title: "SF move-in crew",
        memberIds: ["users:maya", "users:zoe", "users:dan"],
        createdAt: now - 10 * DAY,
        lastMessageAt: now - HOUR,
      },
    ],
    conversationMembers: ["maya", "zoe", "dan"].map(member),
    messages: [
      msg("m1", "zoe", "we should hike sometime before the move gets crazy", 3 * HOUR),
      msg("m2", "dan", "yes!! i'm in", 2 * HOUR),
      msg("m3", "maya", "same, mornings are perfect", HOUR),
    ],
    events: [
      {
        _id: "events:e1",
        hostId: "users:host",
        title: "Saturday Urban Hike: Dolores Park to Bernal Hill",
        cover: "",
        description: URBAN_HIKE,
        category: "Outdoors",
        startAt: now + 3 * DAY,
        online: false,
        venue: "Dolores Park (top, by the Muni stop)",
        city: "San Francisco, CA",
        privacy: "public",
        externalGoingCount: 0,
        externalInterestedCount: 0,
        createdAt: now - DAY,
      },
    ],
  };
  for (const t of [
    "friendships",
    "blocks",
    "groups",
    "groupMembers",
    "posts",
    "comments",
    "eventResponses",
    "notifications",
    "proposals",
    "proposalEvents",
    "chatPlans",
    "pollVotes",
    "userSettings",
    "crewOptIns",
    "cityProfiles",
    "cityProfileFacts",
    "follows",
    "listings",
    "externalSources",
    "inventoryItems",
  ])
    tables[t] ??= [];
  const ctx = fakeCtx(tables);
  Object.assign(ctx, { scheduler: { runAt: async () => null, runAfter: async () => null } });
  return { ctx, tables };
}

type PollAttachment = {
  closesAt: number;
  options: { id: string; label: string; startAt: number }[];
};
function pollIn(tables: Record<string, Row[]>, messageId: string): PollAttachment {
  const m = tables.messages?.find((x) => x._id === messageId);
  const poll = ((m?.attachments ?? []) as PollAttachment[])[0];
  if (!poll) throw new Error("no poll");
  return poll;
}

type Mine = {
  spotted: { messageId: string; chimedIn: string[]; by: { firstName: string } | null }[];
  plans: { _id: string; stage: string; poll: { voters: number; leader: unknown } | null }[];
};
const mine = async (ctx: MutationCtx) => (await call(chatPlans.mine, ctx, as("maya"))) as Mine;

/** What the "Plan it" action does, with the template standing in for Muse. */
async function planIt(ctx: MutationCtx) {
  const args = {
    ownerId: "users:maya",
    conversationId: "conversations:crew",
    messageId: "messages:m1",
  };
  const c = (await call(chatPlans.context, ctx, args)) as Awaited<
    ReturnType<typeof import("../convex/lib/chatPlans").planContext>
  >;
  const out = planTemplate(c.input);
  return (await call(chatPlans.start, ctx, {
    ...args,
    activity: c.activity,
    plan: {
      title: out.title,
      place: out.place,
      route: planRoute(c.input.places.find((p) => p.source === out.placeSource)),
      question: out.question,
      text: out.text,
      rationale: out.rationale,
    },
    options: out.timeIds.map((id) => {
      const s = c.slots.find((x) => x.id === id);
      return { id, label: s?.label ?? id, startAt: s?.startAt };
    }),
    citations: { first: { kind: "event", eventId: "events:e1" }, rest: [] },
    origin: { agent: "muse", task: "muse.chatPlan", via: "fallback" },
  })) as string;
}

describe("chat plans, end to end", () => {
  test("talk shows up on the card with who's in, and 'Not now' hides it", async () => {
    const { ctx } = world();
    const before = await mine(ctx);
    expect(before.spotted).toHaveLength(1);
    expect(before.spotted[0]).toMatchObject({ messageId: "messages:m1", chimedIn: ["Daniel"] });
    await call(chatPlans.dismiss, ctx, {
      ...as("maya"),
      conversationId: "conversations:crew",
      messageId: "messages:m1",
    });
    expect((await mine(ctx)).spotted).toEqual([]);
  });

  test("poll → votes → Event inviting the chat → day-of reminder, each approved first", async () => {
    const { ctx, tables } = world();
    const pollId = await planIt(ctx);
    // Drafted, not sent: only Maya's pending draft holds the poll.
    const draft = tables.messages?.find((m) => m.status === "pending_approval");
    expect(draft?.attachments).toEqual([expect.objectContaining({ kind: "poll" })]);
    expect((await mine(ctx)).plans[0]?.stage).toBe("pollDraft");
    expect((await mine(ctx)).spotted).toEqual([]);

    const sent = (await call(approve, ctx, { ...as("maya"), proposalId: pollId })) as {
      messageId: string;
    };
    expect(tables.messages?.find((m) => m._id === sent.messageId)?.status).toBe("sent");
    const [first, second] = pollIn(tables, sent.messageId).options;
    if (!first || !second) throw new Error("no options");

    // Zoe and Daniel vote; someone outside the chat can't.
    await call(vote, ctx, {
      ...as("zoe"),
      messageId: sent.messageId,
      optionIds: [first.id, second.id],
    });
    await call(vote, ctx, { ...as("dan"), messageId: sent.messageId, optionIds: [second.id] });
    await expect(
      call(vote, ctx, { ...as("stranger"), messageId: sent.messageId, optionIds: [first.id] }),
    ).rejects.toThrow("Poll not found");
    await expect(
      call(vote, ctx, { ...as("zoe"), messageId: sent.messageId, optionIds: ["nope"] }),
    ).rejects.toThrow("isn't in the poll");
    const polling = (await mine(ctx)).plans[0];
    expect(polling).toMatchObject({ stage: "polling", poll: { voters: 2 } });

    // "Make it an Event": the winning time, the chat's members invited (they aren't Maya's friends).
    const eventId = (await call(chatPlans.proposeEvent, ctx, {
      ...as("maya"),
      planId: polling?._id,
    })) as string;
    const eventP = tables.proposals?.find((p) => p._id === eventId);
    expect(eventP?.payload).toMatchObject({
      kind: "event",
      title: "Urban Hike: Dolores Park to Bernal Hill",
      startAt: second.startAt,
      conversationId: "conversations:crew",
      inviteIds: ["users:zoe", "users:dan"],
    });
    expect(eventP?.rationale).toBe(`2 of 2 who voted in SF move-in crew picked ${second.label}.`);
    const created = (await call(approve, ctx, { ...as("maya"), proposalId: eventId })) as {
      eventId: string;
    };
    expect((await mine(ctx)).plans[0]?.stage).toBe("scheduled");
    // Only the people invited from the chat see it, not all of Maya's friends.
    expect(tables.events?.find((e) => e._id === created.eventId)?.privacy).toBe("private");

    // The hourly job: nothing before the morning of, then the reminder draft, once.
    expect(await call(chatPlans.tick, ctx, { now: second.startAt - DAY })).toBe(0);
    expect(await call(chatPlans.tick, ctx, { now: second.startAt - HOUR * 1.5 })).toBe(1);
    expect(await call(chatPlans.tick, ctx, { now: second.startAt - HOUR })).toBe(0);
    const reminder = tables.proposals?.find((p) => p.origin.task === "muse.chatPlanReminder");
    expect(reminder?.payload.text).toStartWith(
      "Today! 🥾 Urban Hike: Dolores Park to Bernal Hill at",
    );
    expect(reminder?.status).toBe("pending"); // waits for Maya's OK like everything else
    expect(tables.events?.some((e) => e._id === created.eventId)).toBe(true);

    // After it starts, the plan is done and leaves the hourly job.
    await call(chatPlans.tick, ctx, { now: second.startAt + HOUR });
    expect(tables.chatPlans?.[0]?.open).toBe(false);
  });

  test("when the poll closes, the hourly job drafts the Event once", async () => {
    const { ctx, tables } = world();
    const pollId = await planIt(ctx);
    const sent = (await call(approve, ctx, { ...as("maya"), proposalId: pollId })) as {
      messageId: string;
    };
    const poll = pollIn(tables, sent.messageId);
    await call(vote, ctx, {
      ...as("zoe"),
      messageId: sent.messageId,
      optionIds: [poll.options[2]?.id],
    });
    expect(await call(chatPlans.tick, ctx, { now: poll.closesAt - HOUR })).toBe(0);
    expect(await call(chatPlans.tick, ctx, { now: poll.closesAt + 1 })).toBe(1);
    // Maya says no: Muse doesn't keep proposing it.
    const eventP = tables.proposals?.find((p) => p.payload.kind === "event");
    await call(discard, ctx, { ...as("maya"), proposalId: eventP?._id });
    expect(await call(chatPlans.tick, ctx, { now: poll.closesAt + 2 * HOUR })).toBe(0);
    // Closed polls take no more votes.
    await ctx.db.patch(sent.messageId as never, {
      attachments: [{ ...poll, kind: "poll", closesAt: Date.now() - 1 }],
    });
    await expect(
      call(vote, ctx, {
        ...as("dan"),
        messageId: sent.messageId,
        optionIds: [poll.options[0]?.id],
      }),
    ).rejects.toThrow("This poll is closed");
  });

  test("places come only from posts anyone can see", async () => {
    const { ctx } = world();
    const groupId = await ctx.db.insert("groups", {
      name: "Bay Area Hikers",
      category: "Outdoors",
      privacy: "public",
      visible: true,
      lastActivityAt: Date.now(),
    } as never);
    const post = (privacy: string) =>
      ctx.db.insert("posts", {
        authorId: "users:host",
        groupId,
        privacy,
        text: "hike Lands End, then coffee",
        attachments: [],
        reactionCount: 0,
        createdAt: Date.now() - DAY,
      } as never);
    const open = await post("public");
    await post("only_me");
    const { options } = await placeOptions(ctx, "users:maya" as never, "hiking", Date.now());
    expect(options.filter((o) => o.kind === "post").map((o) => o.source)).toEqual([`post:${open}`]);
  });

  test("an Event planned in a chat may invite that chat's members, and no one else", async () => {
    const { ctx } = world();
    const event = (inviteIds: string[], conversationId?: string) => ({
      kind: "event" as const,
      title: "Hike",
      description: "Up Bernal Hill",
      startAt: Date.now() + 3 * DAY,
      inviteIds: inviteIds.map((u) => `users:${u}`) as never[],
      conversationId: conversationId as never,
    });
    const origin = { agent: "muse" as const, task: "muse.chatPlanEvent" };
    const check = (p: ReturnType<typeof event>) =>
      assertPayload(ctx, "users:maya" as never, p, origin);
    await expect(check(event(["zoe", "dan"], "conversations:crew"))).resolves.toBeUndefined();
    await expect(check(event(["stranger"], "conversations:crew"))).rejects.toThrow(
      "people in this chat",
    );
    await expect(check(event(["zoe"]))).rejects.toThrow("your friends or your Move-in Crew");
    // A friend outside the chat isn't invited to what the chat planned.
    await ctx.db.insert("friendships", {
      userId: "users:maya" as never,
      friendId: "users:stranger" as never,
      createdAt: 0,
    });
    await expect(check(event(["stranger"], "conversations:crew"))).rejects.toThrow(
      "people in this chat",
    );
    // Nor someone who left the chat or is blocked, checked again on approval.
    await ctx.db.delete("conversationMembers:zoe" as never);
    await expect(check(event(["zoe"], "conversations:crew"))).rejects.toThrow(
      "people in this chat",
    );
    await ctx.db.insert("blocks", {
      userId: "users:dan" as never,
      blockedId: "users:maya" as never,
      createdAt: 0,
    });
    await expect(check(event(["dan"], "conversations:crew"))).rejects.toThrow(
      "people in this chat",
    );
  });

  test("a chat's Event draft leaves Inbox when the owner leaves the chat", async () => {
    const { ctx } = world();
    const p = {
      ownerId: "users:maya",
      payload: {
        kind: "event",
        title: "Hike",
        description: "d",
        startAt: Date.now() + 3 * DAY,
        conversationId: "conversations:crew",
        inviteIds: [],
      },
    } as never;
    expect(await targetReachable(ctx, p)).toBe(true);
    await ctx.db.delete("conversationMembers:maya" as never);
    expect(await targetReachable(ctx, p)).toBe(false);
  });

  test("an edit can't change the poll's options or the Event's chat", () => {
    const poll = {
      question: "When?",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    };
    const msg = { kind: "message" as const, conversationId: "c" as never, text: "hi", poll };
    expect(() => assertSameTarget(msg, { ...msg, text: "hello" })).not.toThrow();
    expect(() =>
      assertSameTarget(msg, { ...msg, poll: { ...poll, options: [{ id: "a", label: "A" }] } }),
    ).toThrow("Can't change a poll's options");
    const ev = {
      kind: "event" as const,
      title: "t",
      description: "d",
      startAt: 1,
      inviteIds: [],
      conversationId: "c" as never,
    };
    expect(() => assertSameTarget(ev, { ...ev, conversationId: "d" as never })).toThrow(
      "Can't move an event to another chat",
    );
  });
});
