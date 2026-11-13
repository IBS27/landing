import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { ActionCtx } from "../convex/_generated/server";
import { type AgentSource, agentSources, describeSource } from "../convex/ai/sources";
import { cite, SNIPPET_MAX } from "../convex/lib/citations";
import type { Source } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- A stubbed Meta Model API: replies are queued, requests recorded ---------- */

type Wire = {
  role: string;
  content: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};
type Request = {
  messages: Wire[];
  tools?: { type: string; function: { name: string; description: string; parameters: unknown } }[];
};
/** A tool call the stubbed model makes. `args` given as a string is sent as written. */
type Call = { name: string; args: unknown; id?: string };
/** A queued reply: the answer's text, or the tool calls the model makes instead. */
const replies: (string | Call[])[] = [];
const requests: Request[] = [];

/** One streamed chat completion, as Meta's API sends it: an answer, or tool calls in pieces. */
function completion(reply: string | Call[]) {
  const choice = (delta: unknown, finish?: string) => ({
    model: MODEL,
    choices: [{ index: 0, delta, ...(finish ? { finish_reason: finish } : {}) }],
  });
  const body =
    typeof reply === "string"
      ? [choice({ content: reply }), choice({}, "stop")]
      : [
          ...reply.flatMap((call, index) => {
            const args = typeof call.args === "string" ? call.args : JSON.stringify(call.args);
            const half = Math.ceil(args.length / 2);
            return [
              choice({
                tool_calls: [
                  {
                    index,
                    id: call.id ?? `call_${index}`,
                    type: "function",
                    function: { name: call.name, arguments: "" },
                  },
                ],
              }),
              choice({ tool_calls: [{ index, function: { arguments: args.slice(0, half) } }] }),
              choice({ tool_calls: [{ index, function: { arguments: args.slice(half) } }] }),
            ];
          }),
          choice({}, "tool_calls"),
        ];
  const sse = [
    ...body,
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

import {
  type AgentTool,
  defineTask,
  review,
  runAgent,
  type ToolCallRecord,
} from "../convex/ai/agent";
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

/* ---------- Tools: the model looks things up before it answers ---------- */

describe("runAgent tools", () => {
  const seen: ToolCallRecord[][] = [];
  const lookup = defineTask({
    agent: "muse",
    name: "test.lookup",
    instructions: "Answer, looking things up when you need to.",
    output: v.object({ answer: v.string(), postId: v.optional(v.id("posts")) }),
    cites: () => [],
    check: (o, _input: { ask: string }, calls) => {
      seen.push([...calls]);
      return o.answer === "needs a search" && !calls.some((c) => c.name === "search")
        ? ["look it up first"]
        : [];
    },
    fallback: () => ({ answer: "from the rules" }),
  });

  let ran: string[] = [];
  let running = 0;
  let mostAtOnce = 0;
  const search: AgentTool = {
    name: "search",
    description: "Finds posts about something.",
    args: v.object({ q: v.string(), limit: v.optional(v.number()) }),
    run: async (a) => {
      ran.push(String(a.q));
      running++;
      mostAtOnce = Math.max(mostAtOnce, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { items: [{ id: "pPublic", title: `About ${a.q}` }] };
    },
  };
  const open: AgentTool = {
    name: "open",
    description: "Reads one post.",
    args: v.object({ postId: v.id("posts") }),
    run: async (a) => ({ id: String(a.postId), text: "x".repeat(20_000) }),
  };
  const boom: AgentTool = {
    name: "boom",
    description: "Always fails.",
    args: v.object({}),
    run: async () => {
      throw new ConvexError("No such neighborhood");
    },
  };
  const tools = [search, open, boom];
  const args = { input: { ask: "burritos" }, sources: [], shownTo: id("V") as never, tools };
  const ok = (answer = "ok", more: Record<string, unknown> = {}) =>
    JSON.stringify({ answer, ...more });
  /** The `tool` messages of a request, in order. */
  const toolResults = (r: Request | undefined) =>
    (r?.messages ?? []).filter((m) => m.role === "tool").map((m) => m.content);

  beforeEach(() => {
    seen.length = 0;
    ran = [];
    running = 0;
    mostAtOnce = 0;
  });

  test("a round of tool calls, then the answer", async () => {
    const { ctx, runs } = actionCtx(world());
    replies.push([{ name: "search", args: { q: "burritos" } }], ok());
    const result = await runAgent(ctx, lookup, args);

    expect(result.via).toBe("model");
    expect(result.output).toEqual({ answer: "ok" });
    const found = { items: [{ id: "pPublic", title: "About burritos" }] };
    expect(result.calls).toEqual([{ name: "search", args: { q: "burritos" }, result: found }]);

    // The model is offered the tools, with their arguments as a JSON schema, and told how to use them.
    const [first, second] = requests;
    expect(first?.tools?.map((t) => t.function.name)).toEqual(["search", "open", "boom"]);
    expect(first?.tools?.[0]).toEqual({
      type: "function",
      function: {
        name: "search",
        description: "Finds posts about something.",
        parameters: {
          type: "object",
          properties: { q: { type: "string" }, limit: { type: "number" } },
          required: ["q"],
          additionalProperties: false,
        },
      },
    });
    expect(first?.messages.map((m) => m.role)).toEqual([
      "developer",
      "developer",
      "developer",
      "user",
    ]);
    expect(first?.messages[2]?.content).toContain("You have tools");

    // The second request replays the call, then its result.
    expect(second?.messages.slice(4)).toEqual([
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_0",
            type: "function",
            function: { name: "search", arguments: '{"q":"burritos"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_0", content: JSON.stringify(found) },
    ]);
    // Every model call is counted, the tool round included.
    expect(runs[0]).toMatchObject({ outcome: "model", attempts: 2 });
    expect(runs[0]?.errors).toBeUndefined();
    // The task's rules see what was looked up.
    expect(seen).toEqual([result.calls]);
  });

  test("calls in one round run together, each with its own result", async () => {
    const { ctx } = actionCtx(world());
    replies.push(
      [
        { name: "search", args: { q: "tacos" }, id: "a" },
        { name: "search", args: { q: "parks", limit: 3 }, id: "b" },
      ],
      ok(),
    );
    const result = await runAgent(ctx, lookup, args);

    expect(mostAtOnce).toBe(2);
    expect(result.calls.map((c) => c.args)).toEqual([{ q: "tacos" }, { q: "parks", limit: 3 }]);
    const sent = requests[1]?.messages.filter((m) => m.role === "tool");
    expect(sent?.map((m) => m.tool_call_id)).toEqual(["a", "b"]);
    expect(sent?.[0]?.content).toContain("About tacos");
    expect(sent?.[1]?.content).toContain("About parks");
  });

  test("a call that can't run is an error the model reads, and the run goes on", async () => {
    const { ctx, runs } = actionCtx(world());
    replies.push(
      [
        { name: "nope", args: {} },
        { name: "search", args: { q: 5, extra: true } },
        { name: "search", args: '{"q": "cut off' },
        { name: "boom", args: "" },
        { name: "open", args: { postId: "pInvented" } },
      ],
      ok(),
    );
    const result = await runAgent(ctx, lookup, args);

    expect(result.via).toBe("model");
    expect(result.calls).toEqual([]);
    expect(ran).toEqual([]);
    expect(toolResults(requests[1]).map((c) => JSON.parse(c).error)).toEqual([
      'There is no tool named "nope"',
      "Wrong arguments: $.q: expected a string, got 5; $.extra: unexpected field",
      "The arguments were not valid JSON",
      "No such neighborhood",
      'Wrong arguments: $.postId: ID "pInvented" is not in the input or a tool result',
    ]);
    expect(runs[0]?.errors).toEqual([
      'Tool nope: There is no tool named "nope"',
      "Tool search: Wrong arguments: $.q: expected a string, got 5; $.extra: unexpected field",
      "Tool search: The arguments were not valid JSON",
      "Tool boom: No such neighborhood",
      'Tool open: Wrong arguments: $.postId: ID "pInvented" is not in the input or a tool result',
    ]);
  });

  test("an ID a tool returned may be used: in the answer and in a later call", async () => {
    const { ctx, runs } = actionCtx(world());
    replies.push(
      ok("found it", { postId: "pPublic" }),
      [{ name: "search", args: { q: "burritos" } }],
      [{ name: "open", args: { postId: "pPublic" } }],
      ok("found it", { postId: "pPublic" }),
    );
    const result = await runAgent(ctx, lookup, args);

    expect(result.via).toBe("model");
    expect(result.output).toEqual({ answer: "found it", postId: "pPublic" });
    expect(result.calls.map((c) => c.name)).toEqual(["search", "open"]);
    // Before anything was looked up, the same ID was invented.
    expect(runs[0]?.errors).toEqual(['Attempt 1: $.postId: ID "pPublic" is not in the input']);
    expect(runs[0]?.attempts).toBe(4);
  });

  test("a long result is cut short for the model, and kept whole for the caller", async () => {
    const { ctx } = actionCtx(world());
    replies.push(
      [{ name: "search", args: { q: "burritos" } }],
      [{ name: "open", args: { postId: "pPublic" } }],
      ok(),
    );
    const result = await runAgent(ctx, lookup, args);

    const [, read] = toolResults(requests[2]);
    expect(read?.length).toBeLessThan(16_200);
    expect(read).toContain("[Cut off: the result was longer than 16000 characters.");
    expect(result.calls[1]?.result).toEqual({ id: "pPublic", text: "x".repeat(20_000) });
  });

  test("the task's rules can ask for a lookup", async () => {
    const { ctx } = actionCtx(world());
    replies.push(
      ok("needs a search"),
      [{ name: "search", args: { q: "burritos" } }],
      ok("needs a search"),
    );
    const result = await runAgent(ctx, lookup, args);

    expect(result.via).toBe("model");
    expect(requests[1]?.messages.at(-1)?.content).toContain("look it up first");
    expect(seen.map((calls) => calls.length)).toEqual([0, 1]);
  });

  test("tool rounds are capped: past the cap nothing runs and the model is told to answer", async () => {
    const capped = defineTask({ ...lookup, name: "test.capped", maxToolRounds: 1, maxAttempts: 2 });
    const again = [{ name: "search", args: { q: "more" } }];

    const { ctx, runs } = actionCtx(world());
    replies.push([{ name: "search", args: { q: "burritos" } }], again, ok());
    const result = await runAgent(ctx, capped, args);
    expect(result.via).toBe("model");
    expect(ran).toEqual(["burritos"]);
    expect(result.calls).toHaveLength(1);
    expect(toolResults(requests[2]).at(-1)).toContain("The tool budget for this answer is used up");
    expect(runs[0]?.errors).toEqual(["Attempt 2: asked for tools after 1 rounds of them"]);

    // Asking again and again uses up the answers, and the rules take over.
    const stuck = actionCtx(world());
    replies.push([{ name: "search", args: { q: "burritos" } }], again, again, ok());
    const fell = await runAgent(stuck.ctx, capped, args);
    expect(fell.via).toBe("fallback");
    expect(fell.fallbackReason).toBe("invalid_output");
    expect(fell.output).toEqual({ answer: "from the rules" });
    expect(fell.calls).toHaveLength(1);
    expect(stuck.runs[0]?.attempts).toBe(3);
  });

  test("tool rounds don't use up the answers a task gets", async () => {
    const { ctx } = actionCtx(world());
    const round = (q: string) => [{ name: "search", args: { q } }];
    replies.push(round("a"), round("b"), round("c"), round("d"), "not json", "not json", ok());
    const result = await runAgent(ctx, lookup, args);
    expect(result.via).toBe("model");
    expect(result.calls).toHaveLength(4);
  });

  test("the fallback still reports what was looked up", async () => {
    const { ctx } = actionCtx(world());
    replies.push([{ name: "search", args: { q: "burritos" } }]);
    const result = await runAgent(ctx, lookup, args);
    expect(result.via).toBe("fallback");
    expect(result.calls.map((c) => c.name)).toEqual(["search"]);

    // With AI off, no tool runs at all.
    process.env.AI_ENABLED = "false";
    ran = [];
    const off = await runAgent(ctx, lookup, args);
    expect(off.via).toBe("fallback");
    expect(off.calls).toEqual([]);
    expect(ran).toEqual([]);
  });

  test("a run with tools is never cached, and never served to a run without them", async () => {
    const { ctx, runs } = actionCtx(world());
    const round = [{ name: "search", args: { q: "burritos" } }];
    replies.push(round, ok(), round, ok());
    expect((await runAgent(ctx, lookup, args)).via).toBe("model");
    // The same task and input again: the model is asked again.
    expect((await runAgent(ctx, lookup, args)).via).toBe("model");
    expect(requests).toHaveLength(4);

    // Without tools the task caches as before, under its own key.
    const { tools: _tools, ...plain } = args;
    replies.push(ok("plain"));
    const first = await runAgent(ctx, lookup, plain);
    expect(first.via).toBe("model");
    expect(first.calls).toEqual([]);
    expect(runs[2]?.inputHash).not.toBe(runs[0]?.inputHash);
    const second = await runAgent(ctx, lookup, plain);
    expect(second.via).toBe("cache");
    expect(second.calls).toEqual([]);
    expect(requests).toHaveLength(5);

    // A tool-less request offers no tools and keeps its two system messages.
    const last = requests[4];
    expect(last && "tools" in last).toBe(false);
    expect(last?.messages.map((m) => m.role)).toEqual(["developer", "developer", "user"]);
    // And a run with tools doesn't read that cached answer either.
    replies.push(ok("fresh"));
    expect((await runAgent(ctx, lookup, args)).output).toEqual({ answer: "fresh" });
  });

  test("two tools can't share a name", async () => {
    const { ctx } = actionCtx(world());
    await expect(runAgent(ctx, lookup, { ...args, tools: [search, search] })).rejects.toThrow(
      "test.lookup: tools need unique names",
    );
  });
});
