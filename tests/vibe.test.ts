import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { Id } from "../convex/_generated/dataModel";
import type { ActionCtx } from "../convex/_generated/server";
import { review, runAgent } from "../convex/ai/agent";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import { type RoomVibeInput, roomVibeTask } from "../convex/lib/roomVibeTask";
import { cleanVibe, type VibeValue, vibeFromSignals, vibeProblems } from "../convex/lib/vibe";
import { loadVibeInput, profileInterests } from "../convex/rooms";
import type { Source } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

const id = (s: string) => s as never;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12);

const good: VibeValue = {
  summary: "Warm mid-century with a reading corner: walnut, mustard and plants.",
  styles: ["mid_century", "botanical"],
  palette: ["walnut", "mustard", "sage"],
  keywords: ["walnut", "plant stand"],
};

/* ---------- The shared vibe checks ---------- */

describe("vibeProblems", () => {
  test("a complete vibe passes", () => {
    expect(vibeProblems(good)).toEqual([]);
  });

  test("counts, duplicates, lengths and an empty summary are caught", () => {
    expect(vibeProblems({ ...good, summary: "  " })).toHaveLength(1);
    expect(vibeProblems({ ...good, styles: [] })[0]).toContain("styles");
    expect(vibeProblems({ ...good, styles: ["boho", "boho"] })[0]).toContain("twice");
    expect(vibeProblems({ ...good, palette: ["oat"] })[0]).toContain("colors");
    expect(
      vibeProblems({
        ...good,
        keywords: Array(9)
          .fill("x")
          .map((x, i) => x + i),
      })[0],
    ).toContain("at most");
    expect(vibeProblems({ ...good, keywords: ["a".repeat(31)] })[0]).toContain("characters");
    expect(vibeProblems({ ...good, keywords: ["Walnut", "walnut"] })[0]).toContain("twice");
  });

  test("cleanVibe trims and lowercases keywords", () => {
    expect(
      cleanVibe({ ...good, summary: "  Warm   and  calm ", keywords: [" Floor  Lamp ", ""] }),
    ).toEqual({
      ...good,
      summary: "Warm and calm",
      keywords: ["floor lamp"],
    });
  });
});

/* ---------- The rules suggestion (AI off) ---------- */

const signals = (over: Partial<Parameters<typeof vibeFromSignals>[0]> = {}) => ({
  room: { name: "Bedroom", kind: "bedroom" as const },
  interests: [],
  follows: [],
  ...over,
});

describe("vibeFromSignals", () => {
  test("a saved listing outweighs liked posts, and cites the matching sources", () => {
    const r = vibeFromSignals(signals(), [
      { key: "listing:l1", text: "Mid-century cane armchair, solid teak\nGreat shape" },
      { key: "post:p1", text: "new houseplants for the window!" },
    ]);
    expect(r.vibe.styles[0]).toBe("mid_century");
    expect(r.because[0]).toEqual({
      source: "listing:l1",
      why: "Saved “Mid-century cane armchair, solid teak”",
    });
    expect(vibeProblems(r.vibe)).toEqual([]);
  });

  test("keywords are materials and pieces, not activities", () => {
    const r = vibeFromSignals(signals(), [
      { key: "listing:l1", text: "Black Diamond crash pad for bouldering" },
      { key: "listing:l2", text: "Teak credenza" },
    ]);
    expect(r.vibe.keywords).not.toContain("crash pad");
    expect(r.vibe.keywords).not.toContain("bouldering");
    expect(r.vibe.keywords).toContain("teak");
  });

  test("followed Pages and interests hint at styles and are named", () => {
    const r = vibeFromSignals(
      signals({
        interests: [{ id: "gardening", label: "Plants & gardening" }],
        follows: [{ name: "Wax & Needle Records", category: "Record Store" }],
      }),
      [],
    );
    expect(r.vibe.styles).toEqual(expect.arrayContaining(["botanical", "vintage"]));
    expect(r.fromProfile).toEqual(
      expect.arrayContaining(["Plants & gardening", "Wax & Needle Records"]),
    );
  });

  test("with no signals it still gives a valid, calm starting point", () => {
    const r = vibeFromSignals(signals(), [{ key: "post:p1", text: "great hike today" }]);
    expect(r.vibe.styles).toEqual(["minimalist", "cozy"]);
    expect(r.because).toEqual([]);
    expect(vibeProblems(r.vibe)).toEqual([]);
  });
});

/* ---------- Muse's task: review rules ---------- */

const input: RoomVibeInput = {
  room: { name: "Bedroom", kind: "bedroom", size: null },
  interests: [],
  follows: [{ name: "Sutro Boulders", category: "Climbing Gym" }],
};
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    ...good,
    because: [{ source: "listing:l1", why: "Saved a teak cane armchair" }],
    fromProfile: ["Sutro Boulders"],
    ...over,
  });
const grounding = {
  ids: new Set<string>(),
  sources: new Map([["listing:l1", {} as never]]),
  wrongTable: async () => [],
};

describe("muse.roomVibe review", () => {
  test("accepts a grounded vibe", async () => {
    expect((await review(roomVibeTask, [answer()], input, grounding, "stop")).ok).toBe(true);
  });

  test("rejects invented Pages, missing reasons and uncited sources", async () => {
    const r1 = await review(
      roomVibeTask,
      [answer({ fromProfile: ["IKEA"] })],
      input,
      grounding,
      "stop",
    );
    expect(r1.ok ? "" : r1.problems.join()).toContain("isn't an interest or Page");
    const r2 = await review(
      roomVibeTask,
      [answer({ because: [], fromProfile: [] })],
      input,
      grounding,
      "stop",
    );
    expect(r2.ok ? "" : r2.problems.join()).toContain("at least one");
    const r3 = await review(
      roomVibeTask,
      [answer({ because: [{ source: "post:nope", why: "x" }] })],
      input,
      grounding,
      "stop",
    );
    expect(r3.ok ? "" : r3.problems.join()).toContain("not one of the sources");
  });

  test("styles and colors outside the vocabulary fail the schema", async () => {
    expect(
      (await review(roomVibeTask, [answer({ styles: ["gothic"] })], input, grounding, "stop")).ok,
    ).toBe(false);
  });
});

/* ---------- Muse's task end to end, on a stubbed Meta Model API ---------- */

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

const user = (_id: string) => ({
  _id,
  name: `User ${_id}`,
  username: _id,
  avatar: "",
  verified: false,
});
function world() {
  return {
    users: [user("V"), user("S")],
    friendships: [],
    blocks: [],
    groups: [],
    groupMembers: [],
    posts: [],
    comments: [],
    events: [],
    eventResponses: [],
    externalSources: [],
    userSettings: [],
    listings: [
      {
        _id: "l1",
        sellerId: "S",
        title: "Mid-century cane armchair, solid teak",
        description: "Solid teak frame, new cane seat.",
        photos: [],
        price: 120,
        status: "active",
        location: { city: "San Francisco", neighborhood: "Mission" },
        createdAt: NOW - DAY,
      },
    ],
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

const L1: Source = { kind: "listing", listingId: id("l1") };
const run = (ctx: ActionCtx) =>
  runAgent(ctx, roomVibeTask, { input, sources: [L1], shownTo: id("V") });

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

describe("muse.roomVibe on runAgent", () => {
  test("Muse's grounded vibe comes back with its citation", async () => {
    const { ctx, runs } = actionCtx();
    replies.push(answer());
    const result = await run(ctx);
    expect(result.via).toBe("model");
    expect(result.output.styles).toEqual(good.styles);
    expect(result.cited?.first).toEqual(L1);
    expect(JSON.stringify(requests[0]?.messages)).toContain("Mid-century cane armchair");
    expect(runs[0]?.task).toBe("muse.roomVibe");
  });

  test("an ungrounded answer is sent back with the problems, then accepted", async () => {
    const { ctx } = actionCtx();
    replies.push(answer({ fromProfile: ["IKEA"] }), answer());
    const result = await run(ctx);
    expect(result.via).toBe("model");
    expect(JSON.stringify(requests[1]?.messages)).toContain("isn't an interest or Page");
  });

  test("with AI off, the rules answer from the same signals and cite the listing", async () => {
    const { ctx } = actionCtx();
    process.env.AI_ENABLED = "false";
    const result = await run(ctx);
    expect(result.via).toBe("fallback");
    expect(requests).toHaveLength(0);
    expect(result.output.styles).toContain("mid_century");
    expect(result.cited?.first).toEqual(L1);
    // Sutro Boulders hints "outdoorsy", which the listing outweighed, so it isn't named.
    expect(result.output.fromProfile).not.toContain("Sutro Boulders");
  });
});

describe("vibe input", () => {
  test("City Profile interests reach Muse, stated first, without weak guesses, removed or other people's", async () => {
    const fact = (
      id: string,
      userId: string,
      interest: string,
      extra: Record<string, unknown>,
    ) => ({
      _id: id,
      userId,
      key: "interest",
      value: { id: interest },
      evidence: { kind: "brief", summary: "Picked in the brief" },
      updatedAt: 1,
      ...extra,
    });
    const ctx = fakeCtx({
      cityProfiles: [],
      cityProfileFacts: [
        fact("f1", "users:me", "hiking", { source: "inferred", confidence: 0.6 }),
        fact("f2", "users:me", "books", { source: "stated", confidence: 1 }),
        fact("f3", "users:me", "gardening", { source: "stated", confidence: 1, removedAt: 2 }),
        fact("f4", "users:other", "surfing", { source: "stated", confidence: 1 }),
        fact("f5", "users:me", "coffee", { source: "inferred", confidence: 0.3 }),
      ],
    });
    const interests = await profileInterests(ctx, "users:me" as Id<"users">);
    expect(interests.map((i) => i.id)).toEqual(["books", "hiking"]);
    expect(interests.every((i) => i.label.length > 0)).toBe(true);
  });

  test("leaves out non-taste reactions and anything naming a protected trait", async () => {
    const me = "users:me";
    const post = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
      _id: id,
      authorId: "users:a",
      text,
      createdAt: 1,
      ...extra,
    });
    const react = (id: string, targetId: string, type: string) => ({
      _id: id,
      targetType: "post",
      targetId,
      userId: me,
      type,
      createdAt: 1,
    });
    const ctx = fakeCtx({
      users: [
        { _id: me, kind: "user", name: "Me" },
        { _id: "users:p1", kind: "page", name: "Moonrise Coffee Co.", pageCategory: "Coffee shop" },
        { _id: "users:p2", kind: "page", name: "Women Who Climb", pageCategory: "Community" },
      ],
      rooms: [{ _id: "rooms:r", userId: me, name: "Kids' room", kind: "bedroom", photos: [] }],
      follows: [
        { _id: "follows:1", userId: me, targetId: "users:p1", createdAt: 1 },
        { _id: "follows:2", userId: me, targetId: "users:p2", createdAt: 2 },
      ],
      groups: [{ _id: "groups:g", name: "Church friends" }],
      posts: [
        post("posts:loved", "Walnut credenza, mid-century"),
        post("posts:angry", "I hate this industrial steel room"),
        post("posts:church", "Rattan chair for sale", { groupId: "groups:g" }),
      ],
      reactions: [
        react("reactions:1", "posts:loved", "love"),
        react("reactions:2", "posts:angry", "angry"),
        react("reactions:3", "posts:church", "like"),
      ],
      saved: [],
      cityProfiles: [],
      cityProfileFacts: [],
    });
    const db = ctx.db as unknown as { normalizeId: (t: string, id: string) => string | null };
    db.normalizeId = (t, id) => (id.startsWith(`${t}:`) ? id : null);
    const { input, sources } = await loadVibeInput(
      ctx,
      me as Id<"users">,
      "rooms:r" as Id<"rooms">,
    );
    expect(sources).toEqual([{ kind: "post", postId: "posts:loved" as Id<"posts"> }]);
    expect(input.follows.map((f) => f.name)).toEqual(["Moonrise Coffee Co."]);
    expect(input.room.name).not.toMatch(/kid/i);
  });
});
