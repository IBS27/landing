import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import * as checkIns from "../convex/checkIns";
import * as journeys from "../convex/journeys";
import {
  type CheckInInput,
  checkInProblems,
  checkInWindow,
  lastWeekWindow,
  levelFor,
  type PlanOption,
  pickSuggestion,
  type SuggestInput,
} from "../convex/lib/checkIns";
import { journeyWeek } from "../convex/lib/journeys";
import type { JourneyCheckIn, WeekendStop } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- Time: Thursday, November 12, 2026, noon in San Francisco ---------- */

const NOW = Date.UTC(2026, 10, 12, 20);
const HOUR = 3_600_000;
const MOVED_IN = { month: "2026-10", date: "2026-10-27" };
/** Midnight Oct 27 in San Francisco (PDT). */
const MOVE_IN_AT = Date.UTC(2026, 9, 27, 7);
/** A San Francisco wall-clock time in November 2026 (PST, after Nov 1). */
const nov = (day: number, hour: number) => Date.UTC(2026, 10, day, hour + 8);
const W1 = journeyWeek(MOVED_IN, Date.UTC(2026, 9, 29, 20));
const W2 = journeyWeek(MOVED_IN, nov(5, 12));
const W3 = journeyWeek(MOVED_IN, NOW);

/* ---------- A stubbed Meta Model API ---------- */

type Request = { messages: { role: string; content: string }[] };
const replies: string[] = [];
const requests: Request[] = [];
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

const env = { ...process.env };
beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  delete process.env.MODEL_API_KEY;
  delete process.env.AI_ENABLED;
  globalThis.fetch = stubFetch;
  setSystemTime(new Date(NOW));
});
afterEach(() => {
  process.env = { ...env };
  globalThis.fetch = realFetch;
  setSystemTime();
});

/* ---------- Rules ---------- */

describe("windows", () => {
  test("week 1 runs from move-in day to the Monday after its weekend", () => {
    expect(W1?.week).toBe(1);
    if (!W1) throw new Error("no week 1");
    expect(checkInWindow({ weekOf: W1.weekOf, endsAt: W1.end }, MOVE_IN_AT)).toEqual({
      from: MOVE_IN_AT,
      to: nov(2, 0),
    });
    expect(lastWeekWindow({ weekOf: W1.weekOf, week: 1 }, MOVE_IN_AT)).toBeNull();
  });

  test("later weeks run Monday to Monday, San Francisco time, across the DST change", () => {
    if (!W2 || !W3) throw new Error("no weeks");
    expect(checkInWindow({ weekOf: W2.weekOf, endsAt: W2.end }, MOVE_IN_AT)).toEqual({
      from: nov(2, 0),
      to: nov(9, 0),
    });
    expect(lastWeekWindow({ weekOf: W3.weekOf, week: 3 }, MOVE_IN_AT)).toEqual({
      from: nov(2, 0),
      to: nov(9, 0),
    });
    expect(lastWeekWindow({ weekOf: W2.weekOf, week: 2 }, MOVE_IN_AT)).toEqual({
      from: MOVE_IN_AT,
      to: nov(2, 0),
    });
  });
});

describe("levelFor", () => {
  test("Explore from move-in, with what Regular needs", () => {
    expect(levelFor(0, 0)).toEqual({
      id: "explore",
      label: "Explore",
      rank: 1,
      next: { id: "regular", label: "Regular", daysLeft: 30, moreNeeded: 2 },
    });
  });
  test("time alone isn't enough, and neither is activity alone", () => {
    expect(levelFor(40, 1)).toMatchObject({ id: "explore", next: { daysLeft: 0, moreNeeded: 1 } });
    expect(levelFor(16, 9)).toMatchObject({ id: "explore", next: { daysLeft: 14, moreNeeded: 0 } });
  });
  test("Regular a month in with 2 things done; Local in month 3 with 6", () => {
    expect(levelFor(30, 2)).toMatchObject({ id: "regular", rank: 2, next: { id: "local" } });
    expect(levelFor(61, 5)).toMatchObject({
      id: "regular",
      next: { daysLeft: 0, moreNeeded: 1 },
    });
    expect(levelFor(60, 6)).toMatchObject({ id: "local", rank: 3, next: null });
  });
});

describe("pickSuggestion", () => {
  const plan = (id: string, extra: Partial<PlanOption> = {}): PlanOption => ({
    eventId: `events:${id}` as never,
    title: `${id} plan`,
    startAt: nov(14, 10),
    interests: [],
    group: null,
    rank: 0,
    ...extra,
  });
  const base: SuggestInput = {
    lastWeekDone: 2,
    attended: [],
    joined: new Set(),
    crewGroup: null,
    meetup: null,
    plans: [plan("top"), plan("climb", { interests: ["climbing"] })],
  };
  const crewGroup = { _id: "groups:crew" as never, name: "October Movers" };
  const meetup = {
    eventId: "events:meetup" as never,
    title: "Crew coffee",
    startAt: nov(15, 10),
    over: false,
    going: false,
  };

  test("the crew's first meetup first, while they aren't going", () => {
    expect(pickSuggestion({ ...base, crewGroup, meetup })).toMatchObject({
      kind: "crewMeetup",
      eventId: "events:meetup",
      template: "Your Move-in Crew's first meetup is Crew coffee on Sunday at 10 AM. Want to go?",
    });
    expect(pickSuggestion({ ...base, crewGroup, meetup: { ...meetup, going: true } })?.kind).toBe(
      "journey",
    );
  });

  test("a meetup they skipped: the crew Group's next plan, or the Group", () => {
    const skipped = { ...meetup, over: true };
    const crewPlan = plan("crewHike", { group: crewGroup });
    expect(
      pickSuggestion({ ...base, crewGroup, meetup: skipped, plans: [...base.plans, crewPlan] }),
    ).toMatchObject({ kind: "crewGroup", eventId: "events:crewHike" });
    expect(pickSuggestion({ ...base, crewGroup, meetup: skipped })).toMatchObject({
      kind: "crewGroup",
      groupId: "groups:crew",
      sources: [{ kind: "group", groupId: "groups:crew" }],
    });
  });

  test("a quiet week gets one easy plan", () => {
    expect(pickSuggestion({ ...base, lastWeekDone: 0 })).toMatchObject({
      kind: "light",
      eventId: "events:top",
      template: "One plan is plenty this weekend: top plan on Saturday at 10 AM.",
    });
  });

  test("more of what they went to, citing what they went to", () => {
    const attended = [
      {
        eventId: "events:went" as never,
        title: "Climbing Night",
        interests: ["climbing" as const],
      },
    ];
    expect(pickSuggestion({ ...base, attended })).toEqual({
      kind: "moreLike",
      eventId: "events:climb" as never,
      template:
        "You went to Climbing Night. More like it this weekend: climb plan on Saturday at 10 AM.",
      sources: [
        { kind: "event", eventId: "events:climb" as never },
        { kind: "event", eventId: "events:went" as never },
      ],
    });
    // A title that can't be named isn't.
    const unnamed = pickSuggestion({ ...base, attended: [{ ...attended[0]!, title: null }] });
    expect(unnamed?.template).toStartWith("Like what you've been going to:");
  });

  test("else a plan from a Group they joined, else the Journey's top plan, else nothing", () => {
    const g = { _id: "groups:coffee" as never, name: "SF Coffee Lovers" };
    const withGroup = { ...base, plans: [...base.plans, plan("latte", { group: g })] };
    expect(pickSuggestion({ ...withGroup, joined: new Set([g._id]) })).toMatchObject({
      kind: "groupPlan",
      eventId: "events:latte",
    });
    expect(pickSuggestion(withGroup)?.kind).toBe("journey");
    expect(pickSuggestion({ ...base, plans: [] })).toBeNull();
  });
});

describe("checkInProblems", () => {
  const input: CheckInInput = {
    you: "V",
    weeksIn: 2,
    lastWeek: { events: 1, groups: 1, friends: 2 },
    kind: "moreLike",
    plan: { title: "Saturday Bouldering", when: "on Saturday at 10 AM", venue: null },
    group: null,
    wentTo: "Climbing Night",
    draft: "draft",
  };
  test("a warm, accurate line passes", () => {
    expect(
      checkInProblems(
        "Loved Climbing Night? Saturday Bouldering is on Saturday at 10 AM, come say hi.",
        input,
      ),
    ).toEqual([]);
  });
  test("pressure, invented numbers, wrong times and links are caught", () => {
    expect(
      checkInProblems("Don't break your streak! Saturday Bouldering, Saturday at 10 AM.", input),
    ).toHaveLength(1);
    expect(checkInProblems("You made 5 friends! Saturday Bouldering at 10 AM.", input)).toEqual([
      "use only numbers from the input (not 5)",
    ]);
    expect(checkInProblems("Saturday Bouldering on Sunday at 10 AM.", input).length).toBe(1);
    expect(checkInProblems("Saturday Bouldering at 10 AM: https://x.co", input)).toEqual([
      "no links",
    ]);
  });
  test("a plan's own name never counts as pressure", () => {
    const only = { ...input, plan: { ...input.plan!, title: "Members Only Climb" } };
    expect(checkInProblems("Members Only Climb is on Saturday at 10 AM.", only)).toEqual([]);
  });
});

/* ---------- The job and the read, against the fake db ---------- */

type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: Handler })._handler;

const person = (username: string): Row => ({
  _id: `users:${username}`,
  name: `${username[0]?.toUpperCase()}${username.slice(1)} Example`,
  firstName: `${username[0]?.toUpperCase()}${username.slice(1)}`,
  username,
  avatar: `/seed/${username}.jpg`,
  verified: false,
  lastActiveAt: 0,
});
const event = (_id: string, startAt: number, extra: Partial<Row> = {}): Row => ({
  _id,
  hostId: "users:host",
  title: _id.split(":")[1] ?? _id,
  cover: "/seed/e.jpg",
  description: _id,
  category: "Outdoors",
  startAt,
  online: false,
  city: "San Francisco",
  privacy: "public",
  externalGoingCount: 0,
  externalInterestedCount: 0,
  createdAt: 1,
  ...extra,
});
const rsvp = (eventId: string, status = "going", user = "v"): Row => ({
  _id: `eventResponses:${eventId}:${user}`,
  eventId,
  userId: `users:${user}`,
  status,
  createdAt: 1,
});
const friendship = (friend: string, createdAt: number): Row[] => [
  { _id: `friendships:v:${friend}`, userId: "users:v", friendId: `users:${friend}`, createdAt },
  { _id: `friendships:${friend}:v`, userId: `users:${friend}`, friendId: "users:v", createdAt },
];
const stop = (eventId: string, startAt: number): WeekendStop => ({
  name: eventId,
  kind: "event",
  timeOfDay: "morning",
  why: "A plan near you",
  eventId: eventId as never,
  startAt,
  citations: { first: { kind: "event", eventId: eventId as never }, rest: [] },
});
const journey = (
  w: NonNullable<typeof W1>,
  stops: WeekendStop[],
  more: WeekendStop[] = [],
): Row => ({
  _id: `journeys:w${w.week}`,
  userId: "users:v",
  weekOf: w.weekOf,
  week: w.week,
  startsAt: w.start,
  endsAt: w.end,
  neighborhoodIds: [],
  stops,
  more,
  crewIds: [],
  generatedAt: 1,
});

/**
 * v moved in on Oct 27. Week 1: a Halloween party. Week 2: Climbing Night (on
 * her Journey), joined SF Coffee Lovers, a new friend (f1). Week 3 so far:
 * Tuesday's trivia and another new friend (f2). Things that don't count: an
 * Event before move-in, an online one, one she's only interested in, one she
 * un-RSVP'd, an old friend, a friend who's blocked and an old Group.
 */
function world(setup?: (tables: Record<string, Row[]>) => void) {
  if (!W1 || !W2 || !W3) throw new Error("no weeks");
  const tables: Record<string, Row[]> = {
    users: ["v", "f1", "f2", "old", "blocked", "host"].map(person),
    cityProfiles: [{ _id: "cityProfiles:v", userId: "users:v", briefCompletedAt: 1 }],
    cityProfileFacts: [
      {
        _id: "cityProfileFacts:1",
        userId: "users:v",
        key: "moveIn",
        value: MOVED_IN,
        source: "stated",
        evidence: { kind: "brief", summary: "You said so in your brief" },
        confidence: 1,
        updatedAt: 1,
      },
    ],
    events: [
      event("events:party", Date.UTC(2026, 9, 31, 4 + 24), { category: "Party" }),
      event("events:climb", nov(5, 19), { title: "Climbing Night", category: "Fitness" }),
      event("events:trivia", nov(10, 19), { title: "Tuesday Trivia", category: "Games" }),
      event("events:before", Date.UTC(2026, 9, 20, 19)),
      event("events:online", nov(4, 19), { online: true }),
      event("events:maybe", nov(4, 12)),
      event("events:undone", nov(6, 12)),
      event("events:boulder", nov(14, 10), { title: "Saturday Bouldering", category: "Fitness" }),
      event("events:latte", nov(15, 11), {
        title: "Latte Art Jam",
        category: "Food & Drink",
        groupId: "groups:coffee",
      }),
    ],
    eventResponses: [
      rsvp("events:party"),
      rsvp("events:climb"),
      rsvp("events:trivia"),
      rsvp("events:before"),
      rsvp("events:online"),
      rsvp("events:maybe", "interested"),
    ],
    profileSignals: [
      {
        _id: "profileSignals:undone",
        userId: "users:v",
        kind: "going",
        targetKind: "event",
        targetId: "events:undone",
        interestIds: ["hiking"],
        at: nov(5, 9),
        updatedAt: nov(5, 10),
        undoneAt: nov(5, 10),
      },
    ],
    groups: [
      { _id: "groups:coffee", name: "SF Coffee Lovers", slug: "sf-coffee", privacy: "public" },
      { _id: "groups:old", name: "Old Group", slug: "old", privacy: "public" },
    ],
    groupMembers: [
      {
        _id: "groupMembers:coffee",
        groupId: "groups:coffee",
        userId: "users:v",
        role: "member",
        joinedAt: nov(6, 9),
      },
      {
        _id: "groupMembers:old",
        groupId: "groups:old",
        userId: "users:v",
        role: "member",
        joinedAt: 1,
      },
    ],
    friendships: [
      ...friendship("f1", nov(3, 20)),
      ...friendship("f2", nov(10, 9)),
      ...friendship("old", 1),
      ...friendship("blocked", nov(4, 9)),
    ],
    blocks: [{ _id: "blocks:1", userId: "users:v", blockedId: "users:blocked" }],
    journeys: [
      journey(W1, [stop("events:party", Date.UTC(2026, 10, 1, 4))]),
      journey(W2, [stop("events:climb", nov(5, 19))]),
      journey(W3, [stop("events:boulder", nov(14, 10))], [stop("events:latte", nov(15, 11))]),
    ],
    userSettings: [],
    proposals: [],
    aiRuns: [],
  };
  setup?.(tables);
  const scheduled: { fn: string; args: Record<string, unknown> }[] = [];
  const schedule = async (
    _t: number,
    ref: FunctionReference<"mutation">,
    args: Record<string, unknown>,
  ) => {
    scheduled.push({ fn: getFunctionName(ref), args });
  };
  const db = Object.assign(fakeCtx(tables), {
    scheduler: { runAfter: schedule, runAt: schedule },
  }) as MutationCtx;
  const row = (week: number) =>
    tables.journeys?.find((r) => r.week === week) as Row & { checkIn?: JourneyCheckIn };
  return { tables, db, scheduled, row };
}

type Current = Awaited<ReturnType<typeof checkIns.current>>;
const current = (db: MutationCtx, viewer = "v") =>
  handler(checkIns.current)(db, { viewerId: `users:${viewer}` }) as Promise<Current>;

describe("writeCheckIns", () => {
  test("counts each week and the total from real activity, and nothing that doesn't count", async () => {
    const { db, row } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(1).checkIn?.week).toEqual({
      events: ["events:party"],
      groups: [],
      friends: [],
      journeyStops: ["events:party"],
    } as never);
    expect(row(2).checkIn?.week).toEqual({
      events: ["events:climb"],
      groups: ["groups:coffee"],
      friends: ["users:f1"],
      journeyStops: ["events:climb"],
    } as never);
    expect(row(3).checkIn?.week).toEqual({
      events: ["events:trivia"],
      groups: [],
      friends: ["users:f2"],
      journeyStops: [],
    } as never);
    expect(row(3).checkIn?.total).toEqual({
      events: ["events:trivia", "events:climb", "events:party"],
      groups: ["groups:coffee"],
      friends: ["users:f2", "users:f1"],
      journeyStops: ["events:climb", "events:party"],
    } as never);
    expect(row(3).checkIn).toMatchObject({ from: nov(9, 0), to: W3?.end, computedAt: NOW });
  });

  test("this week updates every run; finished weeks only until they're final", async () => {
    const { db, row } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    await checkIns.writeCheckIns(db, "users:v" as never, NOW + HOUR);
    expect(row(2).checkIn?.computedAt).toBe(NOW);
    expect(row(3).checkIn?.computedAt).toBe(NOW + HOUR);
  });

  test("a week computed before it ended is finished on the next run", async () => {
    const { db, row } = world((t) => {
      t.events?.push(event("events:sat", nov(7, 10)));
      t.eventResponses?.push(rsvp("events:sat"));
    });
    await checkIns.writeCheckIns(db, "users:v" as never, nov(7, 9)); // Saturday morning, week 2
    expect(row(2).checkIn?.week.events).toEqual(["events:climb"] as never);
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(2).checkIn?.week.events).toEqual(["events:sat", "events:climb"] as never);
  });

  test("more of what she went to: the climbing plan, citing Climbing Night", async () => {
    const { db, row, scheduled } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(3).checkIn?.suggestion).toEqual({
      kind: "moreLike",
      eventId: "events:boulder",
      template:
        "You went to Climbing Night. More like it this weekend: Saturday Bouldering on Saturday at 10 AM.",
      text: "You went to Climbing Night. More like it this weekend: Saturday Bouldering on Saturday at 10 AM.",
      via: "template",
      citations: {
        first: { kind: "event", eventId: "events:boulder" },
        rest: [{ kind: "event", eventId: "events:climb" }],
      },
    } as never);
    // Only this week's row suggests anything, and with AI off Muse isn't asked.
    expect(row(2).checkIn?.suggestion).toBeUndefined();
    expect(scheduled).toEqual([]);
  });

  test("after a quiet week, one easy plan", async () => {
    const { db, row } = world((t) => {
      t.eventResponses = (t.eventResponses ?? []).filter((r) => r.eventId !== "events:climb");
      t.groupMembers = (t.groupMembers ?? []).filter((r) => r.groupId !== "groups:coffee");
      t.friendships = (t.friendships ?? []).filter((r) => r.createdAt !== nov(3, 20));
    });
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(3).checkIn?.suggestion).toMatchObject({ kind: "light", eventId: "events:boulder" });
  });

  test("the crew's first meetup comes first while she isn't going", async () => {
    const { db, row } = world((t) => {
      t.groups?.push({
        _id: "groups:crew",
        name: "October Movers",
        slug: "oct",
        privacy: "private",
      });
      t.groupMembers?.push({
        _id: "groupMembers:crew",
        groupId: "groups:crew",
        userId: "users:v",
        role: "admin",
        joinedAt: 1,
      });
      t.events?.push(
        event("events:meetup", nov(15, 10), {
          title: "Crew coffee",
          groupId: "groups:crew",
          privacy: "group",
        }),
      );
      t.proposals = [
        {
          _id: "proposals:group",
          ownerId: "users:v",
          status: "approved",
          origin: { task: "muse.crewGroup" },
          result: { kind: "group", groupId: "groups:crew" },
          createdAt: 1,
        },
        {
          _id: "proposals:meetup",
          ownerId: "users:v",
          status: "approved",
          origin: { task: "muse.crewMeetup" },
          result: { kind: "event", eventId: "events:meetup" },
          createdAt: 2,
        },
      ];
    });
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(3).checkIn?.suggestion).toMatchObject({
      kind: "crewMeetup",
      eventId: "events:meetup",
      template: "Your Move-in Crew's first meetup is Crew coffee on Sunday at 10 AM. Want to go?",
    });
  });

  test("with AI on, a new suggestion asks Muse to phrase it; the same one doesn't", async () => {
    process.env.MODEL_API_KEY = "test";
    const { db, scheduled } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(scheduled.map((s) => s.fn)).toEqual(["checkIns:phrase"]);
    await checkIns.writeCheckIns(db, "users:v" as never, NOW + HOUR);
    expect(scheduled.length).toBe(1);
  });

  test("nothing without a City Profile or move-in date", async () => {
    const { db, row, tables } = world((t) => {
      t.cityProfileFacts = [];
    });
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(row(3).checkIn).toBeUndefined();
    expect(await current(db)).toBeNull();
    expect(tables.journeys?.length).toBe(3);
  });
});

describe("current", () => {
  test("totals, this week, last week, the level and the suggestion, with links", async () => {
    const { db } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    const r = await current(db);
    expect(r?.days).toBe(16);
    expect(r?.total.events.map((e) => e.title)).toEqual([
      "Tuesday Trivia",
      "Climbing Night",
      "party",
    ]);
    expect(r?.total.groups).toEqual([
      { _id: "groups:coffee", slug: "sf-coffee", name: "SF Coffee Lovers" },
    ] as never);
    expect(r?.total.friends.map((f) => f.username)).toEqual(["f2", "f1"]);
    expect(r?.total.journeyStops).toEqual(["events:climb", "events:party"] as never);
    expect(r?.level).toEqual({
      id: "explore",
      label: "Explore",
      rank: 1,
      next: { id: "regular", label: "Regular", daysLeft: 14, moreNeeded: 0 },
    });
    expect(r?.thisWeek).toMatchObject({ week: 3, events: [{ title: "Tuesday Trivia" }] });
    expect(r?.lastWeek).toMatchObject({ week: 2, groups: [{ name: "SF Coffee Lovers" }] });
    expect(r?.suggestion).toMatchObject({
      kind: "moreLike",
      via: "template",
      event: { _id: "events:boulder", title: "Saturday Bouldering", viewerGoing: false },
      group: null,
    });
    expect(r?.suggestion?.sources.map((s) => s.kind)).toEqual(["event", "event"]);
  });

  test("undoing an RSVP, leaving a Group, unfriending or blocking counts at once", async () => {
    const { db, tables } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    tables.eventResponses = (tables.eventResponses ?? []).filter(
      (r) => r.eventId !== "events:trivia",
    );
    tables.groupMembers = (tables.groupMembers ?? []).filter((r) => r.groupId !== "groups:coffee");
    tables.friendships = (tables.friendships ?? []).filter(
      (r) => r.userId !== "users:f1" && r.friendId !== "users:f1",
    );
    tables.blocks?.push({ _id: "blocks:2", userId: "users:f2", blockedId: "users:v" });
    const fresh = world((t) => {
      Object.assign(t, tables);
    });
    const r = await current(fresh.db);
    expect(r?.total.events.map((e) => e._id)).toEqual(["events:climb", "events:party"] as never);
    expect(r?.total.groups).toEqual([]);
    expect(r?.total.friends).toEqual([]);
    expect(r?.thisWeek?.events).toEqual([]);
    expect(r?.level.next).toMatchObject({ moreNeeded: 0 });
  });

  test("private to its owner: another viewer sees only their own (none)", async () => {
    const { db } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    expect(await current(db, "f1")).toBeNull();
  });

  test("past weeks show what she did that week", async () => {
    const { db } = world();
    await checkIns.writeCheckIns(db, "users:v" as never, NOW);
    const weeks = (await handler(journeys.pastWeeks)(db, { viewerId: "users:v" })) as {
      week: number;
      checkIn: checkIns.ActivityView | null;
    }[];
    expect(weeks.map((w) => w.week)).toEqual([2, 1]);
    expect(weeks[0]?.checkIn?.friends.map((f) => f.username)).toEqual(["f1"]);
    expect(weeks[1]?.checkIn?.events.map((e) => e.title)).toEqual(["party"]);
  });
});

/* ---------- Muse phrasing ---------- */

function phraseHarness() {
  const w = world();
  const ctx = {
    runQuery: async (ref: FunctionReference<"query">, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "checkIns:phraseContext":
          return handler(checkIns.phraseContext)(w.db, args);
        case "ai/sources:resolve":
          return agentSources(w.db, args.sources, args.shownTo);
        case "ai/runs:wrongTableIds":
          return [];
        case "ai/runs:cached":
          return null;
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (ref: FunctionReference<"mutation">, args: Record<string, unknown>) => {
      switch (getFunctionName(ref)) {
        case "ai/runs:log": {
          const _id = `aiRuns:${w.tables.aiRuns?.length ?? 0}`;
          w.tables.aiRuns?.push({ _id, ...args });
          return _id;
        }
        case "checkIns:savePhrasing":
          return handler(checkIns.savePhrasing)(w.db, args);
      }
      throw new Error(`Unexpected mutation ${getFunctionName(ref)}`);
    },
  } as unknown as ActionCtx;
  const phrase = () => {
    const s = w.row(3).checkIn?.suggestion;
    return handler(checkIns.phrase)(ctx, { journeyId: "journeys:w3", template: s?.template });
  };
  return { ...w, phrase };
}

describe("phrase", () => {
  test("Muse's phrasing is stored when it passes; it sees counts and titles, nothing else", async () => {
    process.env.MODEL_API_KEY = "test";
    const h = phraseHarness();
    await checkIns.writeCheckIns(h.db, "users:v" as never, NOW);
    const text =
      "Climbing Night was a good start! Saturday Bouldering is on Saturday at 10 AM if you want more.";
    replies.push(JSON.stringify({ text, sources: ["event:events:boulder", "event:events:climb"] }));
    await h.phrase();
    const prompt = requests[0]?.messages.at(-1)?.content ?? "";
    const input = JSON.parse(prompt.slice(prompt.indexOf("{"), prompt.indexOf("</input>")));
    expect(input).toEqual({
      you: "V",
      weeksIn: 2,
      lastWeek: { events: 1, groups: 1, friends: 1 },
      kind: "moreLike",
      plan: { title: "Saturday Bouldering", when: "on Saturday at 10 AM", venue: null },
      group: null,
      wentTo: "Climbing Night",
      draft:
        "You went to Climbing Night. More like it this weekend: Saturday Bouldering on Saturday at 10 AM.",
    });
    expect(h.row(3).checkIn?.suggestion).toMatchObject({ text, via: "model", runId: "aiRuns:0" });
    expect((await current(h.db))?.suggestion).toMatchObject({ text, via: "model" });
  });

  test("pushy or wrong phrasing goes back for a retry, then the template stays", async () => {
    process.env.MODEL_API_KEY = "test";
    const h = phraseHarness();
    await checkIns.writeCheckIns(h.db, "users:v" as never, NOW);
    const bad = JSON.stringify({
      text: "You missed last week! Saturday Bouldering, Sunday at 9 AM.",
      sources: ["event:events:boulder"],
    });
    replies.push(bad, bad, bad);
    await h.phrase();
    expect(requests.length).toBe(3);
    expect(h.row(3).checkIn?.suggestion).toMatchObject({ via: "template" });
  });

  test("a protected-sounding plan or description never reaches Muse", async () => {
    process.env.MODEL_API_KEY = "test";
    const h = phraseHarness();
    await checkIns.writeCheckIns(h.db, "users:v" as never, NOW);
    const climb = h.tables.events?.find((e) => e._id === "events:climb");
    if (climb) climb.description = "A climbing night for our church youth group";
    await h.phrase();
    expect(requests).toEqual([]);
    expect(h.row(3).checkIn?.suggestion).toMatchObject({ via: "template" });
  });

  test("AI off: no model call, the template stays", async () => {
    const h = phraseHarness();
    await checkIns.writeCheckIns(h.db, "users:v" as never, NOW);
    await h.phrase();
    expect(requests).toEqual([]);
    expect(h.row(3).checkIn?.suggestion).toMatchObject({ via: "template" });
  });

  test("a suggestion that changed since is left alone", async () => {
    process.env.MODEL_API_KEY = "test";
    const h = phraseHarness();
    await checkIns.writeCheckIns(h.db, "users:v" as never, NOW);
    await handler(checkIns.savePhrasing)(h.db, {
      journeyId: "journeys:w3",
      template: "an older template",
      text: "Old words",
      citations: { first: { kind: "event", eventId: "events:boulder" }, rest: [] },
      runId: "aiRuns:9",
    });
    expect(h.row(3).checkIn?.suggestion).toMatchObject({ via: "template" });
  });
});
