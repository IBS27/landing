import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import { placeByKey, placesIn } from "../convex/lib/places";
import {
  type Agreed,
  buildRoute,
  type Candidate,
  countMentions,
  emberMentions,
  type Mention,
  mostDiscussed,
  pacificHour,
  type RouteEvent,
  sparkAgreement,
  toCandidates,
  weekendWindow,
} from "../convex/lib/weekendRoute";
import { Clock } from "../convex/seed/lib/time";
import type { ReplySeed } from "../convex/seed/types";
import { neighborhoodPosts } from "../convex/seed/world/posts/neighborhoods";
import type { WeekendStop } from "../convex/validators";
import * as weekendRoutes from "../convex/weekendRoutes";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- A stubbed Meta Model API: replies are queued, requests recorded ---------- */

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

/* ---------- The Mission's seeded threads as rows ---------- */

// Thursday, November 12, 2026, noon in San Francisco. The weekend is Nov 14–15.
const NOW = Date.UTC(2026, 10, 12, 20);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SAT = Date.UTC(2026, 10, 14, 8); // Saturday 00:00 PST
const at = (day: number, hour: number) => SAT + day * 24 * HOUR + hour * HOUR;

const id = (s: string) => s as never;
const user = (username: string) => ({
  _id: `users:${username}`,
  name: username,
  firstName: username,
  username,
  avatar: `/seed/${username}.jpg`,
  verified: false,
  lastActiveAt: 0,
});

function missionWorld() {
  const clock = new Clock(NOW);
  const users = new Set(["v", "host"]);
  const posts: Row[] = [];
  const comments: Row[] = [];
  let c = 0;
  const addReplies = (
    postId: string,
    parentId: string | undefined,
    items: readonly ReplySeed[] | undefined,
    after: number,
  ) => {
    for (const r of items ?? []) {
      users.add(r.by);
      const _id = `comments:${++c}`;
      const createdAt = after + (r.after ?? 5) * MINUTE;
      comments.push({
        _id,
        postId,
        authorId: `users:${r.by}`,
        ...(parentId && { parentId }),
        text: r.text,
        createdAt,
        reactionCount: r.likes ?? 0,
        replyCount: r.replies?.length ?? 0,
      });
      addReplies(postId, _id, r.replies, createdAt);
    }
  };
  neighborhoodPosts
    .filter((p) => p.in === "mission-locals")
    .forEach((p, i) => {
      users.add(p.by);
      const _id = `posts:${i}`;
      const createdAt = clock.at(p.at);
      const before = comments.length;
      addReplies(_id, undefined, p.comments, createdAt);
      posts.push({
        _id,
        authorId: `users:${p.by}`,
        groupId: "groups:mission",
        text: p.text,
        privacy: "public",
        media: [],
        attachments: [],
        createdAt,
        reactionCount: p.reactions ?? 0,
        commentCount: comments.length - before,
        shareCount: 0,
      });
    });

  const event = (_id: string, extra: Partial<Row>): Row => ({
    _id,
    hostId: "users:host",
    title: `Event ${_id}`,
    cover: "/seed/e.jpg",
    description: "Low Tide Radio plays the back room. $12 advance.",
    category: "Music",
    startAt: at(0, 20),
    online: false,
    venue: "Velvet Owl",
    city: "San Francisco",
    privacy: "public",
    externalGoingCount: 40,
    externalInterestedCount: 100,
    createdAt: NOW - 10 * 24 * HOUR,
    point: { lat: 37.764916, lng: -122.421906 },
    neighborhoodId: "neighborhoods:mission",
    ...extra,
  });

  return {
    users: [...users].map(user),
    neighborhoods: [{ _id: "neighborhoods:mission", slug: "mission", name: "Mission" }],
    groups: [
      {
        _id: "groups:mission",
        name: "Mission District Locals",
        slug: "mission-locals",
        cover: "/seed/g.jpg",
        privacy: "public",
        visible: true,
        description: "Locals",
        memberCount: 100,
        lastActivityAt: NOW,
        neighborhoodId: "neighborhoods:mission",
      },
    ],
    posts,
    comments,
    events: [
      event("events:show", {}),
      event("events:online", { online: true, startAt: at(0, 10) }),
      event("events:private", { privacy: "private", startAt: at(1, 12) }),
      event("events:nextWeek", { startAt: at(7, 12) }),
    ],
    eventResponses: [],
    friendships: [],
    blocks: [],
    groupMembers: [],
    userSettings: [],
    cityProfiles: [{ _id: "cityProfiles:v", userId: "users:v", briefCompletedAt: 1 }],
    cityProfileFacts: [
      {
        _id: "cityProfileFacts:1",
        userId: "users:v",
        key: "interest",
        value: { id: "coffee" },
        source: "stated",
        evidence: { kind: "brief", summary: "You said so in your brief" },
        confidence: 1,
        updatedAt: 1,
      },
    ],
    aiJobs: [
      {
        _id: "aiJobs:1",
        kind: "weekendRoute",
        key: "neighborhoods:mission",
        status: "queued",
        createdAt: NOW,
      },
    ],
    weekendRoutes: [],
  } satisfies Record<string, Row[]>;
}

/* ---------- Runs the Convex functions against the fake db ---------- */

type Ref = FunctionReference<"query" | "mutation", "internal">;
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: Handler })._handler;

function harness() {
  const tables: Record<string, Row[]> = missionWorld();
  const db = fakeCtx(tables);
  const runs: Row[] = [];
  const ctx = {
    runQuery: async (ref: Ref, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "weekendRoutes:gather":
          return handler(weekendRoutes.gather)(db, args);
        case "ai/sources:resolve":
          return agentSources(db, args.sources, args.shownTo);
        case "ai/runs:cached":
          return null;
        case "ai/runs:wrongTableIds":
          return [];
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (ref: Ref, args: Record<string, unknown>) => {
      switch (getFunctionName(ref)) {
        case "ai/runs:log": {
          const _id = `aiRuns:${runs.length}`;
          runs.push({ _id, ...args });
          return _id;
        }
        case "ai/jobs:update":
          return db.db.patch(id(args.jobId), { ...(args.status ? { status: args.status } : {}) });
        case "weekendRoutes:save":
          return handler(weekendRoutes.save)(db, args);
      }
      throw new Error(`Unexpected mutation ${getFunctionName(ref)}`);
    },
  } as unknown as ActionCtx;
  const generate = () =>
    handler(weekendRoutes.generate)(ctx, {
      jobId: "aiJobs:1",
      neighborhoodId: "neighborhoods:mission",
    });
  const route = () =>
    tables.weekendRoutes?.[0] as (Row & { stops: WeekendStop[]; via: string }) | undefined;
  return { tables, db: db as MutationCtx, runs, generate, route };
}

const keysOf = (c: WeekendStop["citations"]) =>
  [c.first, ...c.rest].map((s) =>
    s.kind === "post"
      ? `post:${s.postId}`
      : s.kind === "comment"
        ? `comment:${s.commentId}`
        : `${s.kind}`,
  );
const ORDER = ["morning", "midday", "afternoon", "evening", "night"];

/** Source keys of the seeded Mission comments and posts whose text includes `needle`. */
function keysSaying(tables: Record<string, Row[]>, needle: string) {
  return [
    ...(tables.posts ?? [])
      .filter((p) => String(p.text).includes(needle))
      .map((p) => `post:${p._id}`),
    ...(tables.comments ?? [])
      .filter((c) => String(c.text).includes(needle))
      .map((c) => `comment:${c._id}`),
  ];
}

const env = { ...process.env };
beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  process.env.MODEL_API_KEY = "test";
  delete process.env.AI_ENABLED;
  globalThis.fetch = stubFetch;
  setSystemTime(new Date(NOW));
});
afterEach(() => {
  process.env = { ...env };
  globalThis.fetch = realFetch;
  setSystemTime();
});

/* ---------- Tests ---------- */

describe("weekendWindow", () => {
  test("on a weekday, the coming Saturday and Sunday in San Francisco", () => {
    expect(weekendWindow(NOW)).toEqual({ start: SAT, end: at(2, 0) });
  });
  test("on Saturday afternoon, from now until Sunday ends", () => {
    expect(weekendWindow(at(0, 15))).toEqual({ start: at(0, 15), end: at(2, 0) });
  });
  test("on Sunday, the rest of Sunday", () => {
    expect(weekendWindow(at(1, 9))).toEqual({ start: at(1, 9), end: at(2, 0) });
  });
  test("San Francisco hours", () => {
    expect(pacificHour(at(0, 20))).toBe(20);
  });
});

describe("buildRoute", () => {
  const place = (key: string) => {
    const p = placeByKey(key);
    if (!p) throw new Error(key);
    return p;
  };
  const cand = (key: string, locals: number, extra: Partial<Candidate> = {}): Candidate => {
    const p = place(key);
    return {
      name: p.name,
      place: p,
      category: (
        {
          cafe: "coffee",
          restaurant: "food",
          park: "outdoors",
          street: "activity",
          "music-venue": "nightlife",
          bar: "nightlife",
        } as const
      )[p.kind as "cafe"],
      why: `Locals like ${p.name}`,
      sources: [`post:${key}`],
      locals,
      ...extra,
    };
  };
  const all = [
    cand("mission/moonrise-coffee", 5),
    cand("mission/pocket-moth-coffee", 2),
    cand("mission/clarion-alley", 3),
    cand("mission/comal-y-luna", 4, { when: "midday" }),
    cand("mission/dolores-park", 4),
    cand("mission/kumo-ramen-bar", 5, { when: "evening" }),
    cand("mission/velvet-owl", 3),
    cand("mission/bar-zanate", 2),
  ];
  const show: RouteEvent = {
    eventId: id("events:show"),
    title: "Low Tide Radio",
    category: "Music",
    description: "Back room show",
    startAt: at(0, 20),
    point: place("mission/velvet-owl").point,
    going: 40,
    sourceKey: "event:events:show",
  };

  test("one stop per slot, morning to night, each cited", () => {
    const stops = buildRoute(all, []);
    expect(stops.map((s) => [s.timeOfDay, s.placeKey])).toEqual([
      ["morning", "mission/moonrise-coffee"],
      ["morning", "mission/clarion-alley"],
      ["midday", "mission/comal-y-luna"],
      ["afternoon", "mission/dolores-park"],
      ["evening", "mission/kumo-ramen-bar"],
      ["night", "mission/velvet-owl"],
    ]);
    for (const s of stops) {
      expect(s.sources.length).toBeGreaterThan(0);
      expect(s.point).toEqual(place(s.placeKey as string).point);
    }
  });

  test("a weekend Event takes the slot its start time falls in", () => {
    const stops = buildRoute(all, [show]);
    expect(stops).toHaveLength(6);
    expect(stops[5]).toMatchObject({
      kind: "event",
      eventId: "events:show",
      timeOfDay: "night",
      sources: ["event:events:show"],
    });
    expect(stops.some((s) => s.placeKey === "mission/velvet-owl")).toBe(false);
  });

  test("weighs the walk from the previous stop against how many locals agree", () => {
    // Bernal Hill is a 2+ km walk from Clarion Alley; Dolores Park is close, with one fewer local.
    const stops = buildRoute(
      [
        cand("mission/moonrise-coffee", 5),
        cand("mission/clarion-alley", 3),
        cand("mission/bernal-hill", 5, { category: "outdoors" }),
        cand("mission/dolores-park", 4),
        cand("mission/velvet-owl", 3),
      ],
      [],
    );
    expect(stops.find((s) => s.timeOfDay === "afternoon")?.placeKey).toBe("mission/dolores-park");
  });

  test("Events on another day of the weekend don't join the route", () => {
    const sundayWalk: RouteEvent = {
      ...show,
      eventId: id("events:walk"),
      title: "Sunday walk",
      startAt: at(1, 10),
      going: 10,
      sourceKey: "event:events:walk",
    };
    const stops = buildRoute(all, [show, sundayWalk]);
    expect(stops.map((s) => s.eventId).filter(Boolean)).toEqual(["events:show"]);
  });

  test("an unlisted place stays on the route without a pin", () => {
    const stops = buildRoute(
      [
        ...all.slice(0, 3),
        {
          name: "Secret Garden",
          category: "outdoors",
          why: "Quiet",
          sources: ["post:x"],
          locals: 9,
        },
      ],
      [],
    );
    const garden = stops.find((s) => s.name === "Secret Garden");
    expect(garden).toMatchObject({ kind: "outdoors", sources: ["post:x"] });
    expect(garden?.point).toBeUndefined();
    expect(garden?.placeKey).toBeUndefined();
  });

  test("a time locals give decides between places they like as much", () => {
    // Kumo is closer to Clarion Alley, but locals say to go in the evening.
    const stops = buildRoute(
      all.map((c) => {
        if (c.place?.key === "mission/comal-y-luna") return { ...c, when: undefined };
        if (c.place?.key === "mission/kumo-ramen-bar") return { ...c, locals: 4 };
        return c;
      }),
      [],
    );
    expect(stops.find((s) => s.timeOfDay === "midday")?.placeKey).toBe("mission/comal-y-luna");
    expect(stops.find((s) => s.timeOfDay === "evening")?.placeKey).toBe("mission/kumo-ramen-bar");
  });

  test("an empty slot takes a stand-in, never a park at dinner", () => {
    const stops = buildRoute(
      [
        cand("mission/moonrise-coffee", 5),
        cand("mission/pocket-moth-coffee", 3),
        cand("mission/clarion-alley", 3),
        cand("mission/dolores-park", 4),
        cand("mission/balmy-alley", 2, { category: "outdoors" }),
        cand("mission/velvet-owl", 3),
      ],
      [],
    );
    expect(stops.map((s) => [s.timeOfDay, s.placeKey])).toEqual([
      ["morning", "mission/moonrise-coffee"],
      ["morning", "mission/clarion-alley"],
      ["midday", "mission/pocket-moth-coffee"],
      ["afternoon", "mission/dolores-park"],
      ["night", "mission/velvet-owl"],
    ]);
    // Balmy Alley (outdoors) is left over, but dinner stays empty rather than take it.
  });

  test("fewer than four stops is no route", () => {
    expect(buildRoute(all.slice(0, 2), [show])).toEqual([]);
  });

  test("a stop never comes without sources", () => {
    const stops = buildRoute(
      [...all.map((c) => ({ ...c, sources: [] })), cand("mission/moonrise-coffee", 1)],
      [show],
    );
    expect(stops).toEqual([]);
  });
});

describe("toCandidates", () => {
  const places = placesIn("mission");
  const texts = new Map([
    ["comment:a", "kumo at 7:30 on a saturday = 40 min line"],
    ["comment:b", "worth the line tho. shoyu + chili oil"],
    ["comment:c", "Kumo Ramen Bar is the move"],
  ]);
  const authors = { "comment:a": "local-1", "comment:b": "local-2", "comment:c": "local-3" };
  const agreed = (extra: Partial<Agreed>): Agreed => ({
    name: "Kumo",
    placeKey: "mission/kumo-ramen-bar",
    category: "food",
    why: "Shoyu and chili oil",
    recommendedBy: ["comment:a", "comment:c"],
    ...extra,
  });

  test("pins a place only from #15's list, matched by its key or alias in the cited text", () => {
    const [c] = toCandidates([agreed({})], places, texts, authors);
    expect(c?.place?.key).toBe("mission/kumo-ramen-bar");
    expect(c?.name).toBe("Kumo Ramen Bar");
    expect(c?.locals).toBe(2);
  });

  test("a place key its sources don't name gets no pin", () => {
    const [c] = toCandidates(
      [
        agreed({
          name: "Somewhere",
          placeKey: "mission/dolores-park",
          recommendedBy: ["comment:a", "comment:b"],
        }),
      ],
      places,
      texts,
      authors,
    );
    // "kumo" is in comment:a but Dolores Park isn't, and "Somewhere" isn't on the list.
    expect(c?.place).toBeUndefined();
    expect(c?.name).toBe("Somewhere");
  });

  test("matches by name when the model left the key out", () => {
    const [c] = toCandidates([agreed({ placeKey: undefined })], places, texts, authors);
    expect(c?.place?.key).toBe("mission/kumo-ramen-bar");
  });
});

describe("Ember and Spark checks", () => {
  const places = [
    {
      key: "mission/kumo-ramen-bar",
      name: "Kumo Ramen Bar",
      kind: "restaurant",
      aliases: ["Kumo"],
    },
  ];
  test("Ember rejects an invented place key and an uncited mention", () => {
    const problems = emberMentions.check?.(
      {
        mentions: [
          {
            name: "Kumo",
            placeKey: "mission/kumo",
            category: "food",
            stance: "recommends",
            tip: "",
            sources: ["post:1"],
          },
          { name: "Kumo", category: "food", stance: "recommends", tip: "", sources: [] },
        ],
      },
      { neighborhood: "Mission", places },
    );
    expect(problems).toEqual([
      '"Kumo": placeKey "mission/kumo" is not in input.places; leave it out instead',
      '"Kumo": cite at least one source',
    ]);
  });

  test("Spark counts only sources that mention the place", () => {
    const problems = sparkAgreement.check?.(
      {
        places: [
          {
            name: "Kumo",
            placeKey: "mission/kumo-ramen-bar",
            category: "food",
            why: "Good",
            recommendedBy: ["comment:a", "comment:park"],
          },
        ],
      },
      {
        neighborhood: "Mission",
        places,
        mentions: [
          {
            name: "Kumo",
            placeKey: "mission/kumo-ramen-bar",
            category: "food",
            stance: "recommends",
            tip: "",
            sources: ["comment:a"],
          },
          {
            name: "Dolores Park",
            category: "outdoors",
            stance: "recommends",
            tip: "",
            sources: ["comment:park"],
          },
        ],
        authors: { "comment:a": "local-1", "comment:park": "local-2" },
      },
    );
    expect(problems).toEqual([
      '"Kumo": recommendedBy cites comment:park, which no mention of this place cites',
    ]);
  });

  test("Spark rejects agreement from a single local", () => {
    const problems = sparkAgreement.check?.(
      {
        places: [
          {
            name: "Kumo",
            category: "food",
            why: "Good",
            recommendedBy: ["comment:a", "comment:b"],
          },
        ],
      },
      {
        neighborhood: "Mission",
        places,
        mentions: [
          {
            name: "Kumo",
            category: "food",
            stance: "recommends",
            tip: "",
            sources: ["comment:a", "comment:b"],
          },
        ],
        authors: { "comment:a": "local-1", "comment:b": "local-1" },
      },
    );
    expect(problems).toEqual([
      '"Kumo": recommendedBy needs sources from at least two different locals',
    ]);
  });
});

describe("generate", () => {
  test("without AI: the Most discussed route, cited, pinned from the place list, with the weekend's Event", async () => {
    delete process.env.MODEL_API_KEY;
    const h = harness();
    await h.generate();
    const route = h.route();
    expect(requests).toHaveLength(0);
    expect(route?.via).toBe("fallback");
    expect(h.runs.map((r) => [r.task, r.outcome, r.fallbackReason])).toEqual([
      ["ember.weekendRoute.mentions", "fallback", "disabled"],
    ]);
    const stops = route?.stops ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(4);
    expect(stops.length).toBeLessThanOrEqual(6);
    const times = stops.map((s) => ORDER.indexOf(s.timeOfDay));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const s of stops) {
      expect(s.citations.first).toBeDefined();
      if (s.placeKey) expect(s.point).toEqual(placeByKey(s.placeKey)?.point);
      else if (!s.eventId) expect(s.point).toBeUndefined();
    }
    expect(stops.map((s) => s.eventId).filter(Boolean)).toEqual(["events:show"]);
    expect(stops.find((s) => s.timeOfDay === "morning")?.why).toMatch(
      /^Mentioned in \d+ (posts?|comments?)/,
    );
    expect(h.tables.aiJobs?.[0]?.status).toBe("succeeded");
  });

  test("the model's route: invented sources and single-local agreement are sent back, then accepted", async () => {
    const h = harness();
    const k = (needle: string) => keysSaying(h.tables, needle);
    const kumo = [...k("Kumo Ramen Bar"), ...k("worth the line tho")];
    const mentions: Mention[] = [
      {
        name: "Moonrise Coffee",
        placeKey: "mission/moonrise-coffee",
        category: "coffee",
        stance: "recommends",
        tip: "Go by 9",
        sources: [...k("Moonrise Coffee"), ...k("9am or bust")],
      },
      {
        name: "Clarion Alley",
        placeKey: "mission/clarion-alley",
        category: "activity",
        stance: "recommends",
        tip: "10am",
        sources: [...k("Clarion Alley")],
      },
      {
        name: "Comal y Luna",
        placeKey: "mission/comal-y-luna",
        category: "food",
        stance: "mixed",
        when: "midday",
        tip: "Go at noon",
        sources: [...k("Comal y Luna"), ...k("non negotiable")],
      },
      {
        name: "Dolores Park",
        placeKey: "mission/dolores-park",
        category: "outdoors",
        stance: "recommends",
        tip: "Before 1",
        sources: [...k("Dolores Park"), ...k("dolores after 1pm")],
      },
      {
        name: "Kumo",
        placeKey: "mission/kumo-ramen-bar",
        category: "food",
        stance: "recommends",
        when: "evening",
        tip: "Chili oil",
        sources: [...kumo, ...k("40 min line")],
      },
    ];
    expect(mentions.every((m) => m.sources.length >= 2)).toBe(true);
    const agreed: Agreed[] = mentions.map((m) => ({
      name: m.name,
      placeKey: m.placeKey,
      category: m.category,
      ...(m.when && { when: m.when }),
      why: `Locals agree: ${m.tip}`,
      recommendedBy: m.sources,
      ...(m.name === "Kumo" && {
        disagreement: { note: "The Saturday line runs 40 minutes", sources: k("40 min line") },
      }),
    }));

    replies.push(
      JSON.stringify({ mentions: [{ ...mentions[0], sources: ["post:posts:999"] }] }),
      JSON.stringify({ mentions }),
      JSON.stringify({ places: [{ ...agreed[0], recommendedBy: [agreed[0]?.recommendedBy[0]] }] }),
      JSON.stringify({ places: agreed }),
    );
    await h.generate();

    expect(requests).toHaveLength(4);
    expect(JSON.stringify(requests[1]?.messages)).toContain(
      'cites \\"post:posts:999\\", which is not one of the sources',
    );
    expect(JSON.stringify(requests[3]?.messages)).toContain("at least two different locals");
    // Spark reads only what Ember cited.
    const sparkPrompt = JSON.stringify(requests[2]?.messages);
    expect(sparkPrompt).toContain("local-1");
    expect(sparkPrompt).not.toContain("Balmy Alley at 3");

    const route = h.route();
    expect(route?.via).toBe("model");
    expect(h.runs.map((r) => [r.task, r.outcome])).toEqual([
      ["ember.weekendRoute.mentions", "model"],
      ["spark.weekendRoute.agreement", "model"],
    ]);
    const stops = route?.stops ?? [];
    expect(stops.map((s) => s.placeKey ?? s.eventId)).toEqual([
      "mission/moonrise-coffee",
      "mission/clarion-alley",
      "mission/comal-y-luna",
      "mission/dolores-park",
      "mission/kumo-ramen-bar",
      "events:show",
    ]);
    const kumoStop = stops.find((s) => s.placeKey === "mission/kumo-ramen-bar");
    expect(kumoStop?.name).toBe("Kumo Ramen Bar");
    expect(kumoStop?.disagreement?.note).toBe("The Saturday line runs 40 minutes");
    expect(keysOf(kumoStop?.citations as WeekendStop["citations"])).toEqual([
      ...new Set(mentions[4]?.sources),
    ]);
  });

  test("the fallback counts names and aliases in the same threads", async () => {
    const h = harness();
    const sources = await agentSources(
      h.db,
      (h.tables.posts ?? []).map((p) => ({ kind: "post" as const, postId: id(p._id) })),
      "everyone",
    );
    const input = {
      neighborhood: "Mission",
      places: placesIn("mission").map((p) => ({
        key: p.key,
        name: p.name,
        kind: p.kind,
        aliases: [...p.aliases],
      })),
    };
    const found = countMentions(input, sources);
    // Transit stops are never route stops.
    expect(found.some((m) => m.placeKey?.endsWith("-bart"))).toBe(false);
    const kumo = found.find((m) => m.placeKey === "mission/kumo-ramen-bar");
    expect(kumo?.sources.length).toBeGreaterThan(0);
    // Every key the fallback cites is one it was given.
    const given = new Set(sources.map((s) => s.key));
    expect(found.flatMap((m) => m.sources).every((k) => given.has(k))).toBe(true);
    // Agreement needs two different locals.
    const authors = Object.fromEntries(
      sources.map((s) => [s.key, s.kind === "post" ? s.author.username : ""]),
    );
    for (const p of mostDiscussed({ ...input, mentions: found, authors }))
      expect(new Set(p.recommendedBy.map((k) => authors[k])).size).toBeGreaterThanOrEqual(2);
  });
});

describe("get", () => {
  const read = (db: MutationCtx) =>
    handler(weekendRoutes.get)(db, {
      viewerId: "users:v",
      neighborhoodId: "neighborhoods:mission",
    }) as Promise<{
      route: {
        via: string;
        stops: { key: string; kind: string; matches: string[]; sources: unknown[] }[];
      } | null;
      building: unknown;
      failed: boolean;
    }>;

  test("resolves sources for the viewer, marks stops that fit their interests, and drops Events that are over", async () => {
    delete process.env.MODEL_API_KEY;
    const h = harness();
    expect((await read(h.db)).route).toBeNull();
    await h.generate();
    const before = await read(h.db);
    expect(before.route?.via).toBe("fallback");
    expect(before.route?.stops.some((s) => s.kind === "event")).toBe(true);
    for (const s of before.route?.stops ?? []) expect(s.sources.length).toBeGreaterThan(0);
    const coffee = before.route?.stops.filter((s) => ["cafe", "bakery"].includes(s.kind)) ?? [];
    expect(coffee.length).toBeGreaterThan(0);
    for (const s of coffee) expect(s.matches).toEqual(["Coffee"]);

    setSystemTime(new Date(at(1, 12)));
    const after = await read(h.db);
    expect(after.route?.stops.some((s) => s.kind === "event")).toBe(false);
    expect(after.route?.stops.length).toBe((before.route?.stops.length ?? 0) - 1);
  });
});
