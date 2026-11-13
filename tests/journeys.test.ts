import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import * as journeys from "../convex/journeys";
import {
  JOIN_TASK,
  joinTemplate,
  journeyPhase,
  journeyWeek,
  nameList,
  planJourney,
  planWhen,
  routeCandidates,
} from "../convex/lib/journeys";
import type { RouteEvent } from "../convex/lib/weekendRoute";
import type { WeekendStop } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- Time: Thursday, November 12, 2026, noon in San Francisco ---------- */

const NOW = Date.UTC(2026, 10, 12, 20);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SAT = Date.UTC(2026, 10, 14, 8); // Saturday 00:00 PST
const at = (day: number, hour: number) => SAT + day * DAY + hour * HOUR;
const MOVED_IN = { month: "2026-10", date: "2026-10-27" };

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

/* ---------- Which week ---------- */

describe("journeyWeek", () => {
  test("counts weekends from the move-in date", () => {
    expect(journeyWeek(MOVED_IN, NOW)).toEqual({
      weekOf: "2026-11-14",
      week: 3,
      start: SAT,
      end: at(2, 0),
    });
  });
  test("week 1 is the first weekend on or after move-in, even a Sunday move-in", () => {
    expect(journeyWeek({ month: "2026-11", date: "2026-11-14" }, NOW)?.week).toBe(1);
    expect(journeyWeek({ month: "2026-11", date: "2026-11-15" }, NOW)?.week).toBe(1);
    expect(journeyWeek({ month: "2026-11", date: "2026-11-16" }, NOW)).toBeNull();
  });
  test("only a month known: counted from the 1st", () => {
    expect(journeyWeek({ month: "2026-11" }, NOW)?.week).toBe(2);
  });
  test("none before move-in or after the first 90 days", () => {
    expect(journeyPhase({ month: "2027-02" }, NOW)).toBe("before");
    expect(journeyPhase({ month: "2026-07", date: "2026-07-01" }, NOW)).toBe("after");
    expect(journeyPhase(MOVED_IN, NOW)).toBe("during");
    // Day 90 after Aug 16 is Nov 14: that weekend is past the window.
    expect(journeyWeek({ month: "2026-08", date: "2026-08-16" }, NOW)).toBeNull();
    expect(journeyWeek({ month: "2026-08", date: "2026-08-17" }, NOW)?.week).toBe(13);
  });
});

describe("message copy", () => {
  test("names and times read naturally", () => {
    expect(nameList(["Dev"])).toBe("Dev");
    expect(nameList(["Dev", "Priya"])).toBe("Dev and Priya");
    expect(nameList(["Dev", "Priya", "Sam"])).toBe("Dev, Priya and Sam");
    expect(planWhen(at(0, 8))).toBe("on Saturday at 8 AM");
    expect(planWhen(at(1, 10.5))).toBe("on Sunday at 10:30 AM");
    expect(
      joinTemplate({
        you: "Maya",
        people: ["Dev", "Priya"],
        plan: { title: "Run Club", when: "on Saturday at 8 AM", venue: null },
      }),
    ).toBe(
      "Hi Dev and Priya! I saw you're going to Run Club on Saturday at 8 AM. Mind if I join you?",
    );
  });
});

/* ---------- Planning ---------- */

const cites = (postId: string): WeekendStop["citations"] => ({
  first: { kind: "post", postId: postId as never },
  rest: [],
});
const place = (
  placeKey: string,
  kind: string,
  timeOfDay: WeekendStop["timeOfDay"],
  post: string,
): WeekendStop => ({
  name: placeKey.split("/")[1] ?? placeKey,
  placeKey,
  timeOfDay,
  kind,
  why: `Locals like ${placeKey}`,
  citations: cites(post),
});
const MISSION_ROUTE: WeekendStop[] = [
  place("mission/moonrise-coffee", "cafe", "morning", "posts:1"),
  place("mission/clarion-alley", "street", "morning", "posts:2"),
  place("mission/kumo-ramen-bar", "restaurant", "midday", "posts:3"),
  place("mission/dolores-park", "park", "afternoon", "posts:1"),
  place("mission/comal-y-luna", "restaurant", "evening", "posts:2"),
  place("mission/velvet-owl", "music-venue", "night", "posts:4"),
];

const routeEvent = (eventId: string, startAt: number, score: number): RouteEvent => ({
  eventId: eventId as never,
  title: eventId,
  category: "Outdoors",
  description: `About ${eventId}`,
  startAt,
  going: 1,
  score,
  sourceKey: `event:${eventId}`,
});

describe("planJourney", () => {
  test("the best plan's day, its Events in their slots, #18's places around them", () => {
    const { candidates } = routeCandidates(MISSION_ROUTE);
    const { stops, more } = planJourney(candidates, [
      routeEvent("events:sun", at(1, 11), 5),
      routeEvent("events:hike", at(0, 8), 9),
    ]);
    expect(stops.map((s) => s.eventId ?? s.placeKey)).toEqual([
      "mission/moonrise-coffee",
      "events:hike",
      "mission/kumo-ramen-bar",
      "mission/dolores-park",
      "mission/comal-y-luna",
      "mission/velvet-owl",
    ]);
    expect(stops[1]?.sources).toEqual(["event:events:hike"]);
    expect(stops[0]?.sources).toEqual(["post:posts:1"]);
    expect(more.map((s) => s.eventId)).toEqual(["events:sun"]);
  });

  test("without a Weekend Route, the best day's Events alone, in time order", () => {
    const { stops, more } = planJourney(
      [],
      [
        routeEvent("events:late", at(0, 19), 4),
        routeEvent("events:hike", at(0, 8), 9),
        routeEvent("events:sun", at(1, 11), 5),
      ],
    );
    expect(stops.map((s) => s.eventId)).toEqual(["events:hike", "events:late"]);
    expect(more.map((s) => s.eventId)).toEqual(["events:sun"]);
  });

  test("no plans and no places: an empty week", () => {
    expect(planJourney([], [])).toEqual({ stops: [], more: [] });
  });
});

/* ---------- The job and the read, against the fake db ---------- */

type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: Handler })._handler;

let n = 0;
const fact = (user: string, key: string, value: unknown): Row => ({
  _id: `cityProfileFacts:${++n}`,
  userId: `users:${user}`,
  key,
  value,
  source: "stated",
  evidence: { kind: "brief", summary: "You said so in your brief" },
  confidence: 1,
  updatedAt: 1,
});
const person = (username: string): Row => ({
  _id: `users:${username}`,
  name: `${username[0]?.toUpperCase()}${username.slice(1)} Example`,
  firstName: `${username[0]?.toUpperCase()}${username.slice(1)}`,
  username,
  avatar: `/seed/${username}.jpg`,
  verified: false,
  lastActiveAt: 0,
});
const MATCH = { month: true, neighborhood: true, employer: false };

/**
 * v moved into the Mission on Oct 27 and likes hiking and making art. Zoe,
 * Dan and Ethan are her crew; Xan hikes but never opted in. Saturday has a
 * hike in a public Group (Zoe, Dan and Xan going; Ethan's in the Group),
 * Sunday a sketch walk (Ethan going) and the crew Group's own dinner.
 */
function world(setup?: (tables: Record<string, Row[]>) => void) {
  const people = ["v", "zoe", "dan", "ethan", "xan", "host", "local1", "local2"];
  const interests: Record<string, string[]> = {
    v: ["hiking", "making_art", "coffee"],
    zoe: ["making_art", "coffee"],
    dan: ["hiking"],
    ethan: ["coffee"],
    xan: ["hiking"],
  };
  const event = (_id: string, extra: Partial<Row>): Row => ({
    _id,
    hostId: "users:host",
    title: _id,
    cover: "/seed/e.jpg",
    description: `About ${_id}`,
    category: "Outdoors",
    startAt: at(0, 8),
    online: false,
    city: "San Francisco",
    privacy: "public",
    externalGoingCount: 10,
    externalInterestedCount: 10,
    createdAt: NOW - 10 * DAY,
    point: { lat: 37.7596, lng: -122.4269 },
    neighborhoodId: "neighborhoods:mission",
    ...extra,
  });
  const going = (eventId: string, users: string[]) =>
    users.map((u) => ({
      _id: `eventResponses:${eventId}:${u}`,
      eventId,
      userId: `users:${u}`,
      status: "going",
      createdAt: 1,
    }));
  const member = (groupId: string, u: string): Row => ({
    _id: `groupMembers:${groupId}:${u}`,
    groupId,
    userId: `users:${u}`,
    role: "member",
    joinedAt: 1,
  });
  const post = (i: number, by: string): Row => ({
    _id: `posts:${i}`,
    authorId: `users:${by}`,
    groupId: "groups:locals",
    text: `Mission tip ${i}`,
    privacy: "public",
    media: [],
    attachments: [],
    createdAt: NOW - DAY,
    reactionCount: 3,
    commentCount: 0,
    shareCount: 0,
  });
  const group = (_id: string, name: string, privacy: string): Row => ({
    _id,
    name,
    slug: _id.split(":")[1] ?? _id,
    cover: "/seed/g.jpg",
    privacy,
    visible: true,
    description: name,
    memberCount: 10,
    lastActivityAt: NOW,
  });
  const tables: Record<string, Row[]> = {
    users: people.map(person),
    neighborhoods: [{ _id: "neighborhoods:mission", slug: "mission", name: "Mission" }],
    cityProfiles: Object.keys(interests).map((p) => ({
      _id: `cityProfiles:${p}`,
      userId: `users:${p}`,
      briefCompletedAt: 1,
    })),
    cityProfileFacts: Object.entries(interests).flatMap(([p, ids]) => [
      fact(p, "moveIn", MOVED_IN),
      fact(p, "neighborhood", { slug: "mission" }),
      fact(p, "employer", { name: `${p} Employer Inc` }),
      ...ids.map((id) => fact(p, "interest", { id })),
    ]),
    crewOptIns: ["v", "zoe", "dan", "ethan"].map((p) => ({
      _id: `crewOptIns:${p}`,
      userId: `users:${p}`,
      matchBy: MATCH,
      createdAt: 1,
      updatedAt: 1,
    })),
    groups: [
      group("groups:locals", "Mission Locals", "public"),
      group("groups:hikers", "Bay Area Hikers", "public"),
      group("groups:crew", "October Move-in Crew", "private"),
    ],
    groupMembers: [
      member("groups:hikers", "ethan"),
      member("groups:crew", "v"),
      member("groups:crew", "zoe"),
    ],
    posts: [post(1, "local1"), post(2, "local2"), post(3, "local1"), post(4, "local2")],
    comments: [],
    events: [
      event("events:hike", { groupId: "groups:hikers", title: "Saturday Urban Hike" }),
      event("events:sketch", { startAt: at(1, 11), category: "Arts", title: "Sunday Sketch Walk" }),
      event("events:crewDinner", {
        startAt: at(1, 18),
        groupId: "groups:crew",
        privacy: "group",
        category: "Food & Drink",
        title: "Crew dinner",
        neighborhoodId: undefined,
      }),
      event("events:online", { online: true, startAt: at(0, 10) }),
      event("events:private", { privacy: "private", startAt: at(0, 12) }),
      event("events:nextWeek", { startAt: at(7, 9) }),
    ],
    eventResponses: [
      ...going("events:hike", ["zoe", "dan", "xan"]),
      ...going("events:sketch", ["ethan"]),
      ...going("events:crewDinner", ["zoe"]),
    ],
    weekendRoutes: [
      {
        _id: "weekendRoutes:mission",
        neighborhoodId: "neighborhoods:mission",
        stops: MISSION_ROUTE,
        via: "fallback",
        generatedAt: NOW - DAY,
        runIds: [],
        postCount: 4,
      },
    ],
    journeys: [],
    friendships: [],
    blocks: [],
    userSettings: [],
    proposals: [],
    proposalEvents: [],
    conversations: [],
    conversationMembers: [],
    messages: [],
    aiJobs: [{ _id: "aiJobs:1", kind: "journeyJoin", key: "v", status: "queued", createdAt: NOW }],
  };
  setup?.(tables);
  const scheduled: { fn: string; args: unknown }[] = [];
  const schedule = async (_t: number, ref: FunctionReference<"mutation">, args: unknown) => {
    scheduled.push({ fn: getFunctionName(ref), args });
  };
  const db = Object.assign(fakeCtx(tables), {
    scheduler: { runAfter: schedule, runAt: schedule },
  }) as MutationCtx;
  return { tables, db, scheduled };
}

type View = Awaited<ReturnType<typeof journeys.thisWeek>>;
const thisWeek = (db: MutationCtx, viewer = "v") =>
  handler(journeys.thisWeek)(db, { viewerId: `users:${viewer}` }) as Promise<View>;
const names = (users: { username: string }[]) => users.map((u) => u.username);

describe("build", () => {
  test("stores this weekend's cited route, the plans that didn't fit, and the crew", async () => {
    const { tables, db } = world();
    expect(await journeys.buildJourney(db, "users:v" as never, NOW, { force: false })).toBe(
      "journeys:1" as never,
    );
    const row = tables.journeys?.[0] as Row & { stops: WeekendStop[]; more: WeekendStop[] };
    expect(row).toMatchObject({ userId: "users:v", weekOf: "2026-11-14", week: 3 });
    expect(row.stops.map((s) => s.eventId ?? s.placeKey)).toEqual([
      "mission/moonrise-coffee",
      "events:hike",
      "mission/kumo-ramen-bar",
      "mission/dolores-park",
      "mission/comal-y-luna",
      "mission/velvet-owl",
    ]);
    // Every stop is cited: Events by the Event, places by #18's posts.
    expect(row.stops[1]?.citations.first).toEqual({ kind: "event", eventId: "events:hike" });
    expect(row.stops[0]?.citations.first).toEqual({ kind: "post", postId: "posts:1" });
    // Sunday's plans, including the crew Group's own (a Group plan she can see).
    expect(row.more.map((s) => s.eventId)).toEqual(["events:sketch", "events:crewDinner"]);
    expect(new Set(row.crewIds)).toEqual(new Set(["users:zoe", "users:dan", "users:ethan"]));
  });

  test("online, private and next week's Events stay out", async () => {
    const { tables, db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    const row = tables.journeys?.[0] as Row & { stops: WeekendStop[]; more: WeekendStop[] };
    const ids = [...row.stops, ...row.more].flatMap((s) => s.eventId ?? []);
    for (const id of ["events:online", "events:private", "events:nextWeek"])
      expect(ids).not.toContain(id);
  });

  test("an existing week is kept unless forced, and rebuilt in place when it is", async () => {
    const { tables, db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    tables.events = (tables.events ?? []).filter((e) => e._id !== "events:sketch");
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    const more = () => (tables.journeys?.[0]?.more ?? []) as WeekendStop[];
    expect(more().length).toBe(2);
    await journeys.buildJourney(db, "users:v" as never, NOW + HOUR, { force: true });
    expect(tables.journeys?.length).toBe(1);
    expect(more().map((s) => s.eventId)).toEqual(["events:crewDinner"]);
  });

  test("nothing before move-in or after the first 90 days", async () => {
    const { tables, db } = world();
    expect(
      await journeys.buildJourney(db, "users:v" as never, NOW - 30 * DAY, { force: true }),
    ).toBeNull();
    expect(
      await journeys.buildJourney(db, "users:v" as never, NOW + 90 * DAY, { force: true }),
    ).toBeNull();
    expect(tables.journeys).toEqual([]);
  });

  test("with no Weekend Route yet: Events alone, and a rebuild once the route is ready", async () => {
    const { tables, db, scheduled } = world();
    tables.weekendRoutes = [];
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    const row = tables.journeys?.[0] as Row & { stops: WeekendStop[] };
    expect(row.stops.map((s) => s.eventId)).toEqual(["events:hike"]);
    expect(scheduled.map((s) => s.fn)).toEqual(["weekendRoutes:refresh", "journeys:build"]);
    expect(scheduled[1]?.args).toMatchObject({
      userId: "users:v",
      force: true,
      waitedForRoute: true,
    });
  });
});

describe("thisWeek", () => {
  test("shows the crew going, and crew in the plan's Group, with only their names", async () => {
    const { db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    const r = await thisWeek(db);
    expect(r.status).toBe("during");
    expect(r.week?.week).toBe(3);
    const hike = r.journey?.stops.find((s) => s.eventId === "events:hike");
    expect(names(hike?.crew.going ?? [])).toEqual(["zoe", "dan"]); // not Xan: never opted in
    expect(names(hike?.crew.inGroup ?? [])).toEqual(["ethan"]);
    expect(hike?.group).toEqual({ name: "Bay Area Hikers", slug: "hikers" });
    expect(hike?.matches).toEqual(["Hiking"]);
    expect(hike?.sources[0]?.kind).toBe("event");
    // Crew chips are user summaries: nothing from anyone's City Profile.
    const text = JSON.stringify(r.journey?.stops.flatMap((s) => [s.crew.going, s.crew.inGroup]));
    expect(text).not.toContain("Employer");
    expect(text).not.toContain("making_art");
    expect(text).not.toContain("mission");
  });

  test("someone who leaves the crew or is blocked disappears at once", async () => {
    const { tables, db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    tables.crewOptIns = (tables.crewOptIns ?? []).filter((r) => r.userId !== "users:dan");
    let hike = (await thisWeek(db)).journey?.stops.find((s) => s.eventId === "events:hike");
    expect(names(hike?.crew.going ?? [])).toEqual(["zoe"]);
    tables.blocks = [{ _id: "blocks:1", userId: "users:zoe", blockedId: "users:v" }];
    hike = (await thisWeek(db)).journey?.stops.find((s) => s.eventId === "events:hike");
    expect(hike?.crew.going).toEqual([]);
  });

  test("the viewer leaving the crew hides all overlap", async () => {
    const { tables, db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    tables.crewOptIns = (tables.crewOptIns ?? []).filter((r) => r.userId !== "users:v");
    const r = await thisWeek(db);
    expect(r.journey?.crewOptedIn).toBe(false);
    for (const s of [...(r.journey?.stops ?? []), ...(r.journey?.more ?? [])])
      expect([...s.crew.going, ...s.crew.inGroup]).toEqual([]);
  });

  test("a private Group's members show only to its members", async () => {
    const { tables, db } = world();
    await journeys.buildJourney(db, "users:v" as never, NOW, { force: false });
    // The hike moves into a private Group v isn't in: its going list stays, its members don't.
    const hikers = tables.groups?.find((g) => g._id === "groups:hikers");
    if (hikers) hikers.privacy = "private";
    const hike = (await thisWeek(db)).journey?.stops.find((s) => s.eventId === "events:hike");
    expect(names(hike?.crew.going ?? [])).toEqual(["zoe", "dan"]);
    expect(hike?.group).toBeNull();
    expect(hike?.crew.inGroup).toEqual([]);
  });

  test("before move-in: no Journey, and the date it starts", async () => {
    const { tables, db } = world();
    for (const f of tables.cityProfileFacts ?? [])
      if (f.userId === "users:v" && f.key === "moveIn") f.value = { month: "2027-02" };
    const r = await thisWeek(db);
    expect(r.status).toBe("before");
    expect(r.journey).toBeNull();
    expect(r.moveInAt).toBe(Date.UTC(2027, 1, 1, 8));
  });
});

/* ---------- "Mind if I join you?" ---------- */

function joinHarness(setup?: (tables: Record<string, Row[]>) => void) {
  const w = world(setup);
  const runs: Row[] = [];
  const ctx = {
    runQuery: async (ref: FunctionReference<"query">, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "journeys:joinContext":
          return handler(journeys.joinContext)(w.db, args);
        case "ai/sources:resolve":
          return agentSources(w.db, args.sources, args.shownTo);
        case "ai/runs:wrongTableIds":
          return [];
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (ref: FunctionReference<"mutation">, args: Record<string, unknown>) => {
      switch (getFunctionName(ref)) {
        case "ai/runs:log": {
          const _id = `aiRuns:${runs.length}`;
          runs.push({ _id, ...args });
          return _id;
        }
        case "ai/jobs:update":
          return w.db.db.patch(args.jobId as never, {});
        case "journeys:proposeJoin":
          return handler(journeys.proposeJoin)(w.db, args);
      }
      throw new Error(`Unexpected mutation ${getFunctionName(ref)}`);
    },
  } as unknown as ActionCtx;
  const write = (eventId = "events:hike") =>
    handler(journeys.writeJoin)(ctx, { jobId: "aiJobs:1", userId: "users:v", eventId });
  return { ...w, runs, write };
}

describe("draftJoin", () => {
  test("AI off: the template, as a proposal in a new group chat with exactly the crew going", async () => {
    const h = joinHarness();
    await journeys.buildJourney(h.db, "users:v" as never, NOW, { force: false });
    await h.write();
    const [p] = h.tables.proposals ?? [];
    expect(p).toMatchObject({
      ownerId: "users:v",
      status: "pending",
      origin: { agent: "muse", task: JOIN_TASK, via: "fallback" },
      citations: { first: { kind: "event", eventId: "events:hike" }, rest: [] },
      payload: {
        kind: "message",
        text: "Hi Zoe and Dan! I saw you're going to Saturday Urban Hike on Saturday at 8 AM. Mind if I join you?",
      },
    });
    expect(p?.rationale).toBe(
      "Zoe and Dan from your Move-in Crew are going to Saturday Urban Hike on Saturday at 8 AM.",
    );
    const [conv] = h.tables.conversations ?? [];
    expect(conv).toMatchObject({ kind: "group" });
    expect(new Set(conv?.memberIds as string[])).toEqual(
      new Set(["users:v", "users:zoe", "users:dan"]),
    );
    // Nothing is sent: the draft waits for approval and the thread stays out of inboxes.
    expect(conv?.lastMessageId).toBeUndefined();
    expect(h.tables.messages?.map((m) => m.status)).toEqual(["pending_approval"]);

    // The page shows it waiting, and asking again is refused.
    const hike = (await thisWeek(h.db)).journey?.stops.find((s) => s.eventId === "events:hike");
    expect(hike?.draftId).toBe(p?._id as never);
    await expect(
      handler(journeys.draftJoin)(h.db, { viewerId: "users:v", eventId: "events:hike" }),
    ).rejects.toThrow("already waiting");
  });

  test("one crew member going: their existing DM is reused", async () => {
    const h = joinHarness((tables) => {
      tables.conversations = [
        {
          _id: "conversations:dm",
          kind: "dm",
          memberIds: ["users:v", "users:ethan"],
          createdAt: 1,
          lastMessageAt: 1,
        },
      ];
      tables.conversationMembers = ["v", "ethan"].map((u) => ({
        _id: `conversationMembers:${u}`,
        conversationId: "conversations:dm",
        userId: `users:${u}`,
        lastReadAt: 1,
        lastMessageAt: 1,
      }));
    });
    await journeys.buildJourney(h.db, "users:v" as never, NOW, { force: false });
    await h.write("events:sketch");
    expect(h.tables.proposals?.[0]?.payload).toMatchObject({ conversationId: "conversations:dm" });
    expect(h.tables.conversations?.length).toBe(1);
  });

  test("Muse drafts it from first names and the Event only; bad drafts go back for a retry", async () => {
    process.env.MODEL_API_KEY = "test";
    const h = joinHarness();
    await journeys.buildJourney(h.db, "users:v" as never, NOW, { force: false });
    replies.push(
      JSON.stringify({ text: "Hey all, can I come?", sources: ["event:events:hike"] }),
      JSON.stringify({
        text: "Hi Zoe and Dan! Saw you're doing the Saturday Urban Hike at 8. Mind if I tag along?",
        sources: ["event:events:hike"],
      }),
    );
    await h.write();
    expect(requests.length).toBe(2);
    const prompt = requests[0]?.messages.at(-1)?.content ?? "";
    const input = JSON.parse(prompt.slice(prompt.indexOf("{"), prompt.indexOf("</input>")));
    expect(input).toEqual({
      you: "V",
      people: ["Zoe", "Dan"],
      plan: { title: "Saturday Urban Hike", when: "on Saturday at 8 AM", venue: null },
    });
    expect(prompt).not.toContain("Employer");
    expect(h.tables.proposals?.[0]).toMatchObject({
      origin: { via: "model" },
      payload: {
        text: "Hi Zoe and Dan! Saw you're doing the Saturday Urban Hike at 8. Mind if I tag along?",
      },
    });
  });

  test("if someone stops going before it's stored, the template names who's still going", async () => {
    const h = joinHarness();
    await journeys.buildJourney(h.db, "users:v" as never, NOW, { force: false });
    await handler(journeys.proposeJoin)(h.db, {
      userId: "users:v",
      eventId: "events:hike",
      memberIds: ["users:zoe", "users:dan", "users:ethan"],
      text: "Hi Zoe, Dan and Ethan!",
      runId: "aiRuns:0",
      via: "model",
    });
    expect(h.tables.proposals?.[0]).toMatchObject({
      origin: { via: "fallback" },
      payload: {
        text: "Hi Zoe and Dan! I saw you're going to Saturday Urban Hike on Saturday at 8 AM. Mind if I join you?",
      },
    });
  });

  test("refused for plans not on the Journey, plans that are over, or with no crew going", async () => {
    const h = joinHarness();
    await journeys.buildJourney(h.db, "users:v" as never, NOW, { force: false });
    const ask = (eventId: string) =>
      handler(journeys.draftJoin)(h.db, { viewerId: "users:v", eventId });
    await expect(ask("events:nextWeek")).rejects.toThrow("isn't on this week's Journey");
    h.tables.eventResponses = [];
    await expect(ask("events:hike")).rejects.toThrow("None of your crew");
    setSystemTime(new Date(at(1, 23)));
    await expect(ask("events:hike")).rejects.toThrow("over");
  });
});
