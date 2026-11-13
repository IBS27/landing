import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx } from "../convex/_generated/server";
import { review, runAgent } from "../convex/ai/agent";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import { crewGroup } from "../convex/crews";
import { DEFAULT_MATCH_BY } from "../convex/lib/crews";
import {
  type CrewGroupInput,
  type CrewMeetupInput,
  crewContext,
  crewGroupName,
  crewGroupTask,
  crewIntro,
  crewMeetupTask,
  crewRationale,
  type MeetupOption,
  meetupIdea,
  meetupRationale,
  pickMeetup,
} from "../convex/lib/crewTasks";
import type { Source } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- Fixtures ---------- */

const climbing: MeetupOption = {
  source: "event:e1",
  kind: "event",
  title: "Bay Area Climbers Meetup Night @ Sutro Boulders",
  when: "Wed, Nov 18, 6:30 PM",
  venue: "Sutro Boulders",
  fits: ["Climbing"],
  sharedBy: 3,
};
const coffee: MeetupOption = {
  source: "event:e2",
  kind: "event",
  title: "Moonrise Latte Art Throwdown",
  when: "Fri, Dec 4, 7:00 PM",
  venue: "Moonrise Coffee Co.",
  fits: ["Coffee"],
  sharedBy: 2,
};

const input: CrewGroupInput = {
  owner: { firstName: "Maya", moving: "February 2027", moved: false },
  commonMonth: "February 2027",
  commonPlace: "Mission",
  members: [
    {
      firstName: "Zoe",
      sharedInterests: ["Climbing", "Coffee"],
      together: ["same move-in month (February 2027)", "both looking in Mission"],
    },
    {
      firstName: "Daniel",
      sharedInterests: ["Climbing"],
      together: ["same move-in month (February 2027)"],
    },
    {
      firstName: "Sofia",
      sharedInterests: ["Climbing"],
      together: ["both looking in Bernal Heights"],
    },
    { firstName: "Marcus", sharedInterests: [], together: ["both looking in Mission"] },
  ],
  meetupOptions: [climbing, coffee],
};

/* ---------- Templates (AI off) ---------- */

describe("crew templates", () => {
  test("the intro names only interests each person shares with the owner", () => {
    expect(crewIntro(input)).toBe(
      "Hi! I'm Maya, moving to SF in February 2027. Muse matched us as a Move-in Crew: Zoe, Daniel, Sofia and I are all into climbing, and Zoe and I are both into coffee. Say hi, and let's plan a first meetup!",
    );
  });

  test("once the move-in month has passed, the intro says so", () => {
    const moved = { ...input, owner: { firstName: "Maya", moving: "October 2026", moved: true } };
    expect(crewIntro(moved)).toStartWith(
      "Hi! I'm Maya. I moved to SF in October 2026. Muse matched us as a Move-in Crew:",
    );
  });

  test("interests the same people share read as one line", () => {
    const pair: CrewGroupInput = {
      ...input,
      members: [
        { firstName: "Ethan", sharedInterests: ["Hackathons", "Tech & startups"], together: [] },
      ],
    };
    expect(crewIntro(pair)).toContain("Ethan and I are both into hackathons and tech & startups");
  });

  test("the Group name uses the month and the shared neighborhood, within 75 characters", () => {
    expect(crewGroupName("February 2027", "Mission")).toBe("February Move-in Crew · Mission");
    expect(crewGroupName(null, null)).toBe("SF Move-in Crew");
    expect(crewGroupName("February 2027", "x".repeat(100)).length).toBeLessThanOrEqual(75);
  });

  test("a crew arriving in different months gets no month in its name", () => {
    const mixed = { ...input, commonMonth: null };
    expect(crewGroupTask.fallback(mixed, []).name).toBe("SF Move-in Crew · Mission");
  });

  test("the meetup rationale says which shared interests the Event fits", () => {
    expect(meetupRationale("February Move-in Crew · Mission", climbing)).toBe(
      "The first meetup for February Move-in Crew · Mission: Bay Area Climbers Meetup Night @ Sutro Boulders fits climbing, which 3 people in your crew share with you.",
    );
  });

  test("the rationale names a shared move-in month only for people who matched on it", () => {
    const why = crewRationale(input);
    expect(why).toContain("Zoe and Daniel share your move-in month");
    expect(why).not.toMatch(/Sofia[^;]*move-in month/);
  });

  test("the meetup the most people fit wins, and its idea names when and where", () => {
    expect(pickMeetup([coffee, climbing])).toBe(climbing);
    expect(meetupIdea(climbing)).toBe(
      "Bay Area Climbers Meetup Night @ Sutro Boulders, Wed, Nov 18, 6:30 PM.",
    );
    expect(meetupIdea(coffee)).toBe(
      "Moonrise Latte Art Throwdown at Moonrise Coffee Co., Fri, Dec 4, 7:00 PM.",
    );
  });
});

/* ---------- Muse's checks ---------- */

const grounding = (keys: string[]) => ({
  ids: new Set<string>(),
  sources: new Map(keys.map((k) => [k, {} as never])),
  wrongTable: async () => [],
});

const groupAnswer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: "February Move-in Crew · Mission",
    intro: "Hi! I'm Maya. Zoe, Daniel and I all climb, so let's meet up.",
    meetupSource: "event:e1",
    meetupIdea: "Climbers night at Sutro Boulders, Wed Nov 18.",
    rationale: "You all arrive in February and climb.",
    ...over,
  });

describe("muse.crewGroup review", () => {
  const g = grounding(["event:e1", "event:e2"]);
  test("accepts a grounded draft", async () => {
    expect((await review(crewGroupTask, [groupAnswer()], input, g, "stop")).ok).toBe(true);
  });

  test("rejects a meetup that isn't an option, an intro with no member, and a long name", async () => {
    const r1 = await review(
      crewGroupTask,
      [groupAnswer({ meetupSource: "event:nope" })],
      input,
      g,
      "stop",
    );
    expect(r1.ok ? "" : r1.problems.join()).toContain("isn't one of the meetupOptions");
    const r2 = await review(
      crewGroupTask,
      [groupAnswer({ intro: "Hello everyone, welcome to the group!" })],
      input,
      g,
      "stop",
    );
    expect(r2.ok ? "" : r2.problems.join()).toContain("name at least one member");
    const r4 = await review(
      crewGroupTask,
      [groupAnswer()],
      { ...input, commonMonth: null },
      g,
      "stop",
    );
    expect(r4.ok ? "" : r4.problems.join()).toContain("don't name a month");
    const r3 = await review(
      crewGroupTask,
      [groupAnswer({ name: "x".repeat(80) })],
      input,
      g,
      "stop",
    );
    expect(r3.ok).toBe(false);
  });
});

describe("muse.crewMeetup review", () => {
  const meetupInput: CrewMeetupInput = {
    groupName: "February Move-in Crew · Mission",
    members: ["Zoe", "Daniel"],
    options: [climbing],
  };
  test("only an event option can be the meetup", async () => {
    const ok = JSON.stringify({
      eventSource: "event:e1",
      title: "Crew climbing night",
      description: "Let's climb!",
    });
    const bad = JSON.stringify({ eventSource: "group:g1", title: "Crew night", description: "Hi" });
    expect(
      (await review(crewMeetupTask, [ok], meetupInput, grounding(["event:e1"]), "stop")).ok,
    ).toBe(true);
    expect(
      (
        await review(
          crewMeetupTask,
          [bad],
          meetupInput,
          grounding(["event:e1", "group:g1"]),
          "stop",
        )
      ).ok,
    ).toBe(false);
  });
});

/* ---------- On runAgent, with a stubbed Meta Model API ---------- */

const replies: string[] = [];
const requests: { messages: { role: string; content: string }[] }[] = [];
function completion(text: string) {
  const sse = [
    { model: MODEL, choices: [{ index: 0, delta: { content: text } }] },
    { model: MODEL, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
    { model: MODEL, choices: [], usage: { prompt_tokens: 10, completion_tokens: 10 } },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .concat("data: [DONE]\n\n")
    .join("");
  return new Response(sse, { headers: { "content-type": "text/event-stream" } });
}
const realFetch = globalThis.fetch;
const stubFetch = (async (_url: string, init?: RequestInit) => {
  requests.push(JSON.parse(String(init?.body)));
  return completion(replies.shift() ?? "not json");
}) as unknown as typeof fetch;

const NOW = Date.UTC(2026, 10, 12);
function world() {
  const user = (_id: string) => ({
    _id,
    name: `User ${_id}`,
    username: _id,
    avatar: "",
    verified: false,
  });
  const event = (_id: string, title: string) => ({
    _id,
    hostId: "H",
    title,
    cover: "",
    description: `${title}, all welcome.`,
    category: "Fitness",
    startAt: NOW + 6 * 86_400_000,
    online: false,
    venue: "Sutro Boulders",
    city: "San Francisco, CA",
    privacy: "public",
    externalGoingCount: 0,
    externalInterestedCount: 0,
    createdAt: NOW,
  });
  return {
    users: [user("V"), user("H")],
    friendships: [],
    blocks: [],
    groups: [],
    groupMembers: [],
    posts: [],
    comments: [],
    events: [event("e1", climbing.title), event("e2", coffee.title)],
    eventResponses: [],
    listings: [],
    externalSources: [],
    userSettings: [],
  };
}
type Ref = FunctionReference<"query" | "mutation", "internal">;
function actionCtx() {
  const db = fakeCtx(world());
  const runs: Row[] = [];
  const ctx = {
    runQuery: async (ref: Ref, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "ai/sources:resolve":
          return agentSources(db, args.sources, args.shownTo);
        case "ai/runs:cached":
          return null;
        case "ai/runs:wrongTableIds":
          return [];
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (_ref: Ref, args: Record<string, unknown>) => {
      runs.push(args);
      return `run${runs.length}`;
    },
  };
  return { ctx: ctx as unknown as ActionCtx, runs };
}
const sources: Source[] = [
  { kind: "event", eventId: "e1" as never },
  { kind: "event", eventId: "e2" as never },
];
const run = (ctx: ActionCtx) =>
  runAgent(ctx, crewGroupTask, { input, sources, shownTo: "V" as never });

const env = { ...process.env };
beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  process.env.MODEL_API_KEY = "test";
  delete process.env.AI_ENABLED;
  globalThis.fetch = stubFetch;
});
afterEach(() => {
  process.env = { ...env };
  globalThis.fetch = realFetch;
});

describe("muse.crewGroup on runAgent", () => {
  test("Muse's draft comes back with the meetup cited", async () => {
    const { ctx } = actionCtx();
    replies.push(groupAnswer());
    const r = await run(ctx);
    expect(r.via).toBe("model");
    expect(r.cited?.first).toEqual(sources[0]);
    expect(JSON.stringify(requests[0]?.messages)).toContain("Bay Area Climbers Meetup Night");
  });

  test("an invented meetup is sent back, then a grounded one is accepted", async () => {
    const { ctx } = actionCtx();
    replies.push(
      groupAnswer({ meetupSource: "event:nope" }),
      groupAnswer({ meetupSource: "event:e2" }),
    );
    const r = await run(ctx);
    expect(r.via).toBe("model");
    expect(r.cited?.first).toEqual(sources[1]);
  });

  test("with AI off, the template intro and the best meetup, still cited", async () => {
    const { ctx } = actionCtx();
    process.env.AI_ENABLED = "false";
    const r = await run(ctx);
    expect(r.via).toBe("fallback");
    expect(requests).toHaveLength(0);
    expect(r.output.intro).toBe(crewIntro(input));
    expect(r.output.name).toBe("February Move-in Crew · Mission");
    expect(r.cited?.first).toEqual(sources[0]);
  });
});

/* ---------- The crew's context and Groups, against a fake db ---------- */

describe("crewContext and crew Groups", () => {
  const DAY = 86_400_000;
  const NOV_12 = Date.UTC(2026, 10, 12, 20);
  const FEB_10 = Date.UTC(2027, 1, 10, 3);
  let n = 0;
  const fact = (userId: string, key: string, value: unknown): Row => ({
    _id: `cityProfileFacts:${++n}`,
    userId,
    key,
    value,
    source: "stated",
    evidence: { kind: "brief", summary: "You said so in your brief" },
    confidence: 1,
    updatedAt: 1,
  });
  /** Everyone looks in the Mission and climbs; `months` says when each arrives. */
  function db(months: Record<string, string>, extra: Record<string, Row[]> = {}) {
    const people = Object.keys(months);
    const ev = (_id: string, title: string, category: string, startAt: number): Row => ({
      _id,
      hostId: "users:host",
      title,
      cover: "",
      description: title,
      category,
      startAt,
      online: false,
      venue: "Mission Cliffs",
      city: "San Francisco, CA",
      privacy: "public",
      externalGoingCount: 0,
      externalInterestedCount: 0,
      createdAt: 1,
    });
    return fakeCtx({
      users: [...people, "host"].map((p) => ({
        _id: `users:${p}`,
        name: p,
        firstName: p,
        username: p,
        avatar: "",
      })),
      cityProfiles: people.map((p) => ({
        _id: `cityProfiles:${p}`,
        userId: `users:${p}`,
        briefCompletedAt: 1,
      })),
      cityProfileFacts: people.flatMap((p) => [
        fact(`users:${p}`, "moveIn", { month: months[p] }),
        fact(`users:${p}`, "neighborhood", { slug: "mission" }),
        fact(`users:${p}`, "interest", { id: "climbing" }),
      ]),
      crewOptIns: people.map((p) => ({
        _id: `crewOptIns:${p}`,
        userId: `users:${p}`,
        matchBy: DEFAULT_MATCH_BY,
        createdAt: 1,
        updatedAt: 1,
      })),
      events: [
        // Next week: before the owner has moved.
        ev("events:soon", "Climbing night", "Fitness", NOV_12 + 6 * DAY),
        // After move-in, but nothing the crew shares.
        ev("events:wine", "Wine tasting", "Food & Drink", FEB_10),
        ev("events:climb", "Bouldering at Mission Cliffs", "Fitness", FEB_10 + DAY),
      ],
      groups: [],
      ...extra,
    });
  }

  test("a first meetup is after the owner arrives and fits what the crew shares", async () => {
    const ctx = db({ v: "2027-02", a: "2027-02" });
    const c = await crewContext(ctx, "users:v" as never, { eventsOnly: true, now: NOV_12 });
    expect(c?.input.meetupOptions.map((o) => o.source)).toEqual(["event:events:climb"]);
    expect(c?.input.meetupOptions[0]?.fits).toEqual(["Climbing"]);
    expect(c?.arrivesAt).toBe(Date.UTC(2027, 1, 1, 8));
  });

  test("no Event fits: no stand-in Event, and no meetup option at all without a fitting Group", async () => {
    const ctx = db({ v: "2027-02", a: "2027-02" });
    const c = await crewContext(ctx, "users:v" as never, {
      eventsOnly: false,
      now: FEB_10 + 2 * DAY,
    });
    expect(c?.input.meetupOptions).toEqual([]);
    expect(c?.sources).toEqual([]);
  });

  test("the Group is named for a month only when most of the crew arrives then", async () => {
    const same = await crewContext(
      db({ v: "2027-02", a: "2027-02", b: "2027-02" }),
      "users:v" as never,
      {
        eventsOnly: false,
        now: NOV_12,
      },
    );
    expect(same?.input.commonMonth).toBe("February 2027");
    const mixed = await crewContext(
      db({ v: "2027-02", a: "2027-03", b: "2027-04", c: "2027-02" }),
      "users:v" as never,
      { eventsOnly: false, now: NOV_12 },
    );
    expect(mixed?.input.commonMonth).toBeNull();
    expect(crewGroupName(mixed?.input.commonMonth ?? null, mixed?.input.commonPlace ?? null)).toBe(
      "SF Move-in Crew · Mission",
    );
  });

  test("a crew Group someone else started shows for the people it invited or who joined", async () => {
    type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
    const query = (viewer: string, ctx: unknown) =>
      (crewGroup as unknown as { _handler: Handler })._handler(ctx, {
        viewerId: `users:${viewer}`,
      }) as Promise<{
        group: unknown;
        fromCrew: { name: string; owner: { username: string }; joined: boolean }[];
      }>;
    const ctx = db(
      { v: "2027-02", a: "2027-02", b: "2027-02" },
      {
        groups: [
          {
            _id: "groups:crew",
            slug: "feb-crew",
            name: "February Move-in Crew · Mission",
            memberCount: 2,
          },
        ],
        groupMembers: [
          {
            _id: "groupMembers:1",
            groupId: "groups:crew",
            userId: "users:a",
            role: "admin",
            joinedAt: 1,
          },
          {
            _id: "groupMembers:2",
            groupId: "groups:crew",
            userId: "users:b",
            role: "member",
            joinedAt: 2,
          },
        ],
        proposals: [
          {
            _id: "proposals:1",
            ownerId: "users:a",
            kind: "group",
            status: "approved",
            payload: {
              kind: "group",
              name: "February Move-in Crew · Mission",
              description: "Hi!",
              privacy: "private",
              inviteIds: ["users:v"],
            },
            result: { kind: "group", groupId: "groups:crew" },
            origin: { agent: "muse", task: "muse.crewGroup", via: "fallback" },
            createdAt: 1,
          },
        ],
        notifications: [
          {
            _id: "notifications:invite",
            userId: "users:v",
            actorId: "users:a",
            kind: "group_invite",
            groupId: "groups:crew",
            text: "invited you to join February Move-in Crew · Mission.",
            read: false,
            createdAt: 1,
          },
        ],
      },
    );
    const v = await query("v", ctx);
    expect(v.group).toBeNull();
    expect(v.fromCrew).toMatchObject([{ owner: { username: "a" }, joined: false }]);
    // b wasn't invited but joined; the owner's own Group isn't "from the crew".
    expect((await query("b", ctx)).fromCrew).toMatchObject([{ joined: true }]);
    expect((await query("a", ctx)).fromCrew).toEqual([]);
    // Once v declines (the invite is gone), the crew page stops saying they're invited.
    await (ctx as { db: { delete: (id: string) => Promise<void> } }).db.delete(
      "notifications:invite",
    );
    expect((await query("v", ctx)).fromCrew).toEqual([]);
  });
});
