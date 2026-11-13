import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import { v } from "convex/values";
import type { ActionCtx } from "../convex/_generated/server";
import { type AgentSource, agentSources, describeSource } from "../convex/ai/sources";
import { cite, SNIPPET_MAX } from "../convex/lib/citations";
import type { Source } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- A stubbed Meta Model API: replies are queued, requests recorded ---------- */

type Request = { messages: { role: string; content: string }[] };
const replies: string[] = [];
const requests: Request[] = [];

/** One streamed chat completion carrying `text`, as Meta's API sends it. */
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

import { defineTask, review, runAgent } from "../convex/ai/agent";
import { MODEL } from "../convex/ai/model";

/* ---------- World ---------- */

const id = (s: string) => s as never;
const NOW = Date.UTC(2026, 10, 12);
const DAY = 86_400_000;
const LONG = `Best burritos in the Mission are at the place on 24th. ${"Get the carnitas, skip the line by ordering ahead. ".repeat(8)}`;

const user = (_id: string) => ({
  _id,
  name: `User ${_id}`,
  firstName: _id,
  username: _id,
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
});
const group = (_id: string, privacy: "public" | "private", visible: boolean) => ({
  _id,
  name: `Group ${_id}`,
  slug: _id,
  cover: `/seed/${_id}.jpg`,
  privacy,
  visible,
  description: `About ${_id}`,
  memberCount: 120,
  lastActivityAt: NOW - DAY,
});
const post = (_id: string, authorId: string, privacy: string, extra: Partial<Row> = {}) => ({
  _id,
  authorId,
  privacy,
  text: `Text of ${_id}`,
  media: [],
  attachments: [],
  createdAt: NOW - 14 * DAY,
  commentCount: 15,
  reactionCount: 3,
  ...extra,
});

// V is the viewer, F is V's friend, S a stranger. V is in gPrivate.
function world() {
  return {
    users: ["V", "F", "S"].map(user),
    friendships: [
      { _id: "fr1", userId: "V", friendId: "F", createdAt: 0 },
      { _id: "fr2", userId: "F", friendId: "V", createdAt: 0 },
    ],
    blocks: [],
    groups: [group("gPublic", "public", true), group("gPrivate", "private", true)],
    groupMembers: [{ _id: "gm1", groupId: "gPrivate", userId: "V", role: "member", joinedAt: 0 }],
    posts: [
      post("pPublic", "S", "public", { text: LONG }),
      post("pPublicGroup", "S", "public", { groupId: "gPublic" }),
      post("pPrivateGroup", "S", "public", { groupId: "gPrivate", text: "Secret tip" }),
      post("pFriends", "F", "friends"),
      post("pOnlyMe", "F", "only_me"),
    ],
    comments: [
      {
        _id: "cPublic",
        postId: "pPublic",
        authorId: "F",
        text: "Agreed",
        createdAt: NOW - DAY,
        replyCount: 0,
        reactionCount: 0,
      },
    ],
    events: [],
    eventResponses: [],
    listings: [],
    externalSources: [
      {
        _id: "x1",
        url: "https://data.sfgov.org/streetlights",
        title: "Streetlights",
        publisher: "DataSF",
        snippet: "Streetlight locations",
        fetchedAt: NOW - DAY / 2,
      },
      {
        _id: "xLong",
        url: "https://www.sfmta.com/routes/14",
        title: "14 Mission",
        publisher: "SFMTA",
        snippet: `${"The 14 Mission runs along Mission Street between downtown and Daly City. ".repeat(2)}Last departure from the Ferry Building is at 1:10am.`,
        fetchedAt: NOW - DAY / 2,
      },
    ],
    userSettings: [],
  };
}

const P = (postId: string): Source => ({ kind: "post", postId: id(postId) });
const C = (commentId: string): Source => ({ kind: "comment", commentId: id(commentId) });
const X = (externalSourceId: string): Source => ({
  kind: "external",
  externalSourceId: id(externalSourceId),
});

/* ---------- A fake action ctx that runs the AI queries against the world ---------- */

type Ref = FunctionReference<"query" | "mutation", "internal">;

function actionCtx(tables: Record<string, Row[]>) {
  const db = fakeCtx(tables);
  const runs: Row[] = [];
  const ctx = {
    runQuery: async (ref: Ref, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "ai/sources:resolve":
          return agentSources(db, args.sources, args.shownTo);
        case "ai/runs:cached":
          return (
            runs.findLast(
              (r) =>
                r.inputHash === args.inputHash &&
                r.outcome === "model" &&
                (r.createdAt as number) >= args.since,
            ) ?? null
          );
        case "ai/runs:wrongTableIds":
          return [];
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (ref: Ref, args: Record<string, unknown>) => {
      expect(getFunctionName(ref)).toBe("ai/runs:log");
      const _id = `run${runs.length}`;
      runs.push({ _id, ...args });
      return _id;
    },
  };
  return { ctx: ctx as unknown as ActionCtx, runs };
}

/* ---------- A task: pick tips from the sources, each citing one ---------- */

const tips = defineTask({
  agent: "ember",
  name: "test.tips",
  instructions: "Pick tips.",
  output: v.object({
    tips: v.array(v.object({ text: v.string(), source: v.string() })),
    postId: v.optional(v.id("posts")),
  }),
  cites: (o) => o.tips.map((t) => t.source),
  fallback: (_input: { area: string }, sources: AgentSource[]) => ({
    tips: sources.map((s) => ({ text: s.text, source: s.key })),
  }),
});

const answer = (...sources: string[]) =>
  JSON.stringify({ tips: sources.map((source) => ({ text: "tip", source })) });

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

/* ---------- Tests ---------- */

describe("agentSources", () => {
  test("for everyone, reads only public sources", async () => {
    const got = await agentSources(
      fakeCtx(world()),
      [P("pPublic"), P("pFriends"), P("pPrivateGroup"), P("pPublicGroup"), C("cPublic"), X("x1")],
      "everyone",
    );
    expect(got.map((s) => s.key)).toEqual([
      "post:pPublic",
      "post:pPublicGroup",
      "comment:cPublic",
      "external:x1",
    ]);
  });

  test("for one user, reads what they can see", async () => {
    const got = await agentSources(
      fakeCtx(world()),
      [P("pPublic"), P("pFriends"), P("pPrivateGroup"), P("pOnlyMe"), P("pPublic")],
      id("V"),
    );
    expect(got.map((s) => s.key)).toEqual(["post:pPublic", "post:pFriends", "post:pPrivateGroup"]);
  });

  test("gives the model the full text, not the chip's snippet", async () => {
    const [s] = await agentSources(fakeCtx(world()), [P("pPublic")], "everyone");
    expect(s?.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(s?.text).toBe(LONG.trim());
  });

  test("gives the model the whole external snapshot", async () => {
    const [s] = await agentSources(fakeCtx(world()), [X("xLong")], "everyone");
    expect(s?.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(s?.text).toEndWith("Last departure from the Ferry Building is at 1:10am.");
  });

  test("describes a source without live counts", async () => {
    const [s] = await agentSources(fakeCtx(world()), [P("pPublicGroup")], "everyone");
    if (!s) throw new Error("missing source");
    expect(describeSource(s)).toEqual({
      key: "post:pPublicGroup",
      kind: "post",
      text: "Text of pPublicGroup",
      date: "2026-10-29",
      group: "Group gPublic",
    });
  });
});

describe("review", () => {
  const grounding = {
    ids: new Set(["post:pPublic", "pPublic"]),
    sources: new Map([["post:pPublic", P("pPublic")]]),
    wrongTable: async () => [],
  };
  const run = (output: unknown) =>
    review(tips, [JSON.stringify(output)], { area: "Mission" }, grounding, "end_turn");

  test("accepts cited keys that are sources", async () => {
    expect(await run({ tips: [{ text: "a", source: "post:pPublic" }] })).toEqual({
      ok: true,
      output: { tips: [{ text: "a", source: "post:pPublic" }] },
      cited: ["post:pPublic"],
    });
  });

  test("rejects a cited key that isn't a source", async () => {
    expect(await run({ tips: [{ text: "a", source: "post:pPrivateGroup" }] })).toEqual({
      ok: false,
      problems: ['cites "post:pPrivateGroup", which is not one of the sources'],
    });
  });

  test("rejects an ID that isn't in the input or sources", async () => {
    const verdict = await run({ tips: [], postId: "pPrivateGroup" });
    expect(verdict).toEqual({
      ok: false,
      problems: ['$.postId: ID "pPrivateGroup" is not in the input'],
    });
  });

  test("accepts the record ID inside a source key", async () => {
    expect((await run({ tips: [], postId: "pPublic" })).ok).toBe(true);
  });
});

describe("runAgent citations", () => {
  test("cited holds the caller's Source values, in citation order, deduped", async () => {
    const { ctx, runs } = actionCtx(world());
    replies.push(answer("external:x1", "post:pPublic", "external:x1"));
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pPublic"), X("x1")],
      shownTo: "everyone",
    });
    expect(result.via).toBe("model");
    expect(result.cited).toEqual(cite([X("x1"), P("pPublic")]));
    expect(runs[0]?.cited).toEqual(["external:x1", "post:pPublic"]);
  });

  test("the model never reads sources the audience can't see, and can't cite them", async () => {
    const { ctx } = actionCtx(world());
    replies.push(answer("post:pPrivateGroup"), answer("post:pPublic"));
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pPublic"), P("pPrivateGroup")],
      shownTo: "everyone",
    });
    const firstPrompt = JSON.stringify(requests[0]?.messages);
    expect(firstPrompt).toContain("post:pPublic");
    expect(firstPrompt).not.toContain("pPrivateGroup");
    expect(firstPrompt).not.toContain("Secret tip");
    expect(JSON.stringify(requests[1]?.messages)).toContain(
      'cites \\"post:pPrivateGroup\\", which is not one of the sources',
    );
    expect(result.via).toBe("model");
    expect(result.cited).toEqual(cite([P("pPublic")]));
  });

  test("a viewer's run reads what that viewer can see", async () => {
    const { ctx } = actionCtx(world());
    replies.push(answer("post:pPrivateGroup"));
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pPrivateGroup")],
      shownTo: id("V"),
    });
    expect(result.cited).toEqual(cite([P("pPrivateGroup")]));
  });

  test("falls back when every attempt cites an unknown source", async () => {
    const { ctx, runs } = actionCtx(world());
    replies.push(answer("post:nope"), answer("post:nope"), answer("post:nope"));
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pPublic"), P("pFriends")],
      shownTo: "everyone",
    });
    expect(result.via).toBe("fallback");
    expect(result.fallbackReason).toBe("invalid_output");
    expect(result.cited).toEqual(cite([P("pPublic")]));
    expect(runs[0]?.errors).toHaveLength(3);
  });

  test("with AI off, the fallback cites only readable sources", async () => {
    process.env.AI_ENABLED = "false";
    const { ctx } = actionCtx(world());
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pFriends"), C("cPublic"), P("pPublic")],
      shownTo: "everyone",
    });
    expect(result.via).toBe("fallback");
    expect(result.output.tips.map((t) => t.source)).toEqual(["comment:cPublic", "post:pPublic"]);
    expect(result.cited).toEqual(cite([C("cPublic"), P("pPublic")]));
    expect(requests).toHaveLength(0);
  });

  test("a fallback that cites a source it wasn't given throws", async () => {
    process.env.AI_ENABLED = "false";
    const { ctx, runs } = actionCtx(world());
    const leaky = defineTask({
      ...tips,
      name: "test.leaky",
      fallback: (_input: { area: string }, sources: AgentSource[]) => ({
        tips: [
          ...sources.map((s) => ({ text: s.text, source: s.key })),
          { text: "Secret tip", source: "post:pPrivateGroup" },
        ],
      }),
    });
    await expect(
      runAgent(ctx, leaky, {
        input: { area: "Mission" },
        sources: [X("x1"), P("pPrivateGroup")],
        shownTo: "everyone",
      }),
    ).rejects.toThrow("test.leaky: fallback cites sources it wasn't given: post:pPrivateGroup");
    expect(runs).toHaveLength(0);
  });

  test("a fallback that cites nothing has no citations", async () => {
    process.env.AI_ENABLED = "false";
    const { ctx } = actionCtx(world());
    const result = await runAgent(ctx, tips, {
      input: { area: "Mission" },
      sources: [P("pFriends")],
      shownTo: "everyone",
    });
    expect(result.cited).toBeNull();
  });

  test("a cached result keeps its citations, even after counts change", async () => {
    const tables = world();
    const { ctx } = actionCtx(tables);
    const args = {
      input: { area: "Mission" },
      sources: [P("pPublic")],
      shownTo: "everyone" as const,
    };
    replies.push(answer("post:pPublic"));
    const first = await runAgent(ctx, tips, args);
    const pPublic = tables.posts[0];
    if (pPublic) pPublic.reactionCount = 99;
    const second = await runAgent(ctx, tips, args);
    expect(second.via).toBe("cache");
    expect(second.runId).toBe(first.runId);
    expect(second.cited).toEqual(cite([P("pPublic")]));
    expect(requests).toHaveLength(1);
  });

  test("a cached result isn't reused when a source's text changes", async () => {
    const tables = world();
    const { ctx } = actionCtx(tables);
    const args = {
      input: { area: "Mission" },
      sources: [P("pPublic")],
      shownTo: "everyone" as const,
    };
    replies.push(answer("post:pPublic"), answer("post:pPublic"));
    await runAgent(ctx, tips, args);
    const pPublic = tables.posts[0];
    if (pPublic) pPublic.text = "Edited";
    expect((await runAgent(ctx, tips, args)).via).toBe("model");
  });
});
