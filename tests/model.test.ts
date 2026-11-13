import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import { v } from "convex/values";
import type { ActionCtx } from "../convex/_generated/server";
import { defineTask, runAgent } from "../convex/ai/agent";
import { complete, costUsd, MODEL, ModelError, type Request } from "../convex/ai/model";
import { type AgentSource, agentSources } from "../convex/ai/sources";
import { cite } from "../convex/lib/citations";
import type { Source } from "../convex/validators";
import { fakeCtx as fakeDb, type Row } from "./fakeDb";

/* ---------- A mocked Meta Model API: queued responses, recorded requests ---------- */

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
type Mock = Response | Error | (() => Response | Promise<Response>);

const sent: Sent[] = [];
let queue: Mock[] = [];
const realFetch = globalThis.fetch;

function mockFetch(...responses: Mock[]) {
  queue = responses;
}

/** A streamed chat completion, split into odd-sized byte chunks to exercise line buffering. */
function stream(
  opts: {
    text?: string;
    refusal?: string;
    finish?: string;
    model?: string;
    usage?: Record<string, unknown> | null;
    done?: boolean;
    extra?: string[];
  } = {},
) {
  const model = opts.model ?? MODEL;
  const events: unknown[] = [{ model, choices: [{ index: 0, delta: { role: "assistant" } }] }];
  const text = opts.text ?? "";
  for (let i = 0; i < text.length; i += 7)
    events.push({ model, choices: [{ index: 0, delta: { content: text.slice(i, i + 7) } }] });
  if (opts.refusal)
    events.push({ model, choices: [{ index: 0, delta: { refusal: opts.refusal } }] });
  events.push({ model, choices: [{ index: 0, delta: {}, finish_reason: opts.finish ?? "stop" }] });
  if (opts.usage !== null)
    events.push({
      model,
      choices: [],
      usage: opts.usage ?? {
        prompt_tokens: 1_000,
        completion_tokens: 200,
        total_tokens: 1_200,
        prompt_tokens_details: { cached_tokens: 400 },
        completion_tokens_details: { reasoning_tokens: 150 },
      },
    });
  const sse = [
    ...events.map((e) => `data: ${JSON.stringify(e)}\n\n`),
    ...(opts.extra ?? []),
    ...(opts.done === false ? [] : ["data: [DONE]\n\n"]),
  ].join("");
  const bytes = new TextEncoder().encode(sse);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 13) c.enqueue(bytes.slice(i, i + 13));
        c.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

const apiError = (status: number, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message, type: "error", code: `code_${status}` } }), {
    status,
    headers,
  });

beforeEach(() => {
  sent.length = 0;
  queue = [];
  process.env.MODEL_API_KEY = "test-key";
  delete process.env.AI_ENABLED;
  globalThis.fetch = (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    sent.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: JSON.parse(String(init?.body)),
    });
    init?.signal?.throwIfAborted();
    const next = queue.shift();
    if (!next) throw new Error("No mocked response left");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.MODEL_API_KEY;
  delete process.env.AI_ENABLED;
});

const request = (over: Partial<Request> = {}): Request => ({
  system: ["You are Muse.", "Task instructions."],
  messages: [{ role: "user", content: "hello" }],
  schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
  effort: "medium",
  signal: new AbortController().signal,
  ...over,
});

/* ---------- complete(): the Meta client ---------- */

describe("complete", () => {
  test("sends a streamed, schema-constrained Chat Completions request to Muse Spark", async () => {
    mockFetch(stream({ text: '{"a":"b"}' }));
    await complete(request({ effort: "high" }));

    expect(sent).toHaveLength(1);
    const [req] = sent;
    expect(req.url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(req.headers.authorization).toBe("Bearer test-key");
    expect(req.body).toEqual({
      model: "muse-spark-1.3",
      messages: [
        { role: "developer", content: "You are Muse." },
        { role: "developer", content: "Task instructions." },
        { role: "user", content: "hello" },
      ],
      max_completion_tokens: 32_000,
      reasoning_effort: "high",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "output",
          schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
          strict: false,
        },
      },
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  test("joins streamed text and maps usage and cost at Meta's prices", async () => {
    const text = JSON.stringify({ a: "a fairly long answer that spans many chunks ✓" });
    mockFetch(stream({ text }));
    const reply = await complete(request());

    expect(reply.text).toBe(text);
    expect(reply.model).toBe("muse-spark-1.3");
    expect(reply.finishReason).toBe("stop");
    expect(reply.refusal).toBeUndefined();
    // 1,000 prompt tokens, 400 of them cached; reasoning is inside completion tokens.
    expect(reply.usage).toEqual({
      inputTokens: 600,
      outputTokens: 200,
      cacheReadTokens: 400,
      cacheWriteTokens: 0,
    });
    expect(reply.costUsd).toBeCloseTo((600 * 1.25 + 400 * 0.15 + 200 * 4.25) / 1e6, 12);
  });

  test("reports refusals and the finish reason", async () => {
    mockFetch(stream({ refusal: "I can't help with that.", finish: "stop" }));
    expect((await complete(request())).refusal).toBe("I can't help with that.");

    mockFetch(stream({ finish: "content_filter" }));
    const filtered = await complete(request());
    expect(filtered.finishReason).toBe("content_filter");
    expect(filtered.refusal).toBeUndefined();

    mockFetch(stream({ text: '{"a":', finish: "length" }));
    expect((await complete(request())).finishReason).toBe("length");
  });

  test("leaves cost unknown when usage is missing", async () => {
    mockFetch(stream({ text: "{}", usage: null }));
    const reply = await complete(request());
    expect(reply.usage.outputTokens).toBe(0);
    expect(reply.costUsd).toBeUndefined();
  });

  test("retries 429 and 503, honoring Retry-After", async () => {
    mockFetch(
      apiError(429, "Rate limit exceeded", { "retry-after": "0" }),
      apiError(503, "Service overloaded", { "retry-after": "0" }),
      stream({ text: '{"a":"ok"}' }),
    );
    expect((await complete(request())).text).toBe('{"a":"ok"}');
    expect(sent).toHaveLength(3);
  });

  test("retries a stream that ends early or reports an error", async () => {
    mockFetch(
      stream({ text: '{"a":', done: false, usage: null }),
      stream({ extra: ['data: {"error":{"message":"backend_unavailable"}}\n\n'], done: false }),
      stream({ text: '{"a":"ok"}' }),
    );
    expect((await complete(request())).text).toBe('{"a":"ok"}');
    expect(sent).toHaveLength(3);
  });

  test("retries a connection that drops mid-stream", async () => {
    const dropped = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"{"}}]}\n\n'));
          c.error(new TypeError("Connection reset"));
        },
      }),
    );
    mockFetch(dropped, stream({ text: '{"a":"ok"}' }));
    expect((await complete(request())).text).toBe('{"a":"ok"}');
    expect(sent).toHaveLength(2);
  });

  test("releases a failed stream before retrying", async () => {
    let cancelled = false;
    const failing = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"error":{"message":"overloaded"}}\n\n'));
          // Left open: only a cancel ends it.
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
    mockFetch(failing, stream({ text: "{}" }));
    await complete(request());
    expect(cancelled).toBe(true);
  });

  test("counts the tokens of failed streamed attempts", async () => {
    mockFetch(stream({ text: '{"a":', done: false }), stream({ text: '{"a":"ok"}' }));
    const reply = await complete(request());
    expect(reply.usage).toEqual({
      inputTokens: 1_200,
      outputTokens: 400,
      cacheReadTokens: 800,
      cacheWriteTokens: 0,
    });
    expect(reply.costUsd).toBeCloseTo((2 * (600 * 1.25 + 400 * 0.15 + 200 * 4.25)) / 1e6, 12);

    // A stream that broke before reporting usage makes the cost unknown.
    mockFetch(stream({ text: '{"a":', done: false, usage: null }), stream({ text: '{"a":"ok"}' }));
    const unknown = await complete(request());
    expect(unknown.usage.outputTokens).toBe(200);
    expect(unknown.costUsd).toBeUndefined();
  });

  test("makes the cost unknown when a connection is lost before the response", async () => {
    mockFetch(new TypeError("Connection reset"), stream({ text: '{"a":"ok"}' }));
    const reply = await complete(request());
    expect(reply.text).toBe('{"a":"ok"}');
    expect(reply.usage.outputTokens).toBe(200);
    expect(reply.costUsd).toBeUndefined();

    const lost = () => new TypeError("Connection reset");
    mockFetch(lost(), lost(), lost());
    const error = (await complete(request()).catch((e: unknown) => e)) as ModelError;
    expect(error.spent).toEqual({
      model: MODEL,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costUsd: undefined,
    });
  });

  test("gives up after two retries", async () => {
    const busy = () => apiError(503, "Service overloaded", { "retry-after": "0" });
    mockFetch(busy, busy, busy, busy);
    const error = await complete(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect((error as ModelError).status).toBe(503);
    expect((error as ModelError).message).toContain("Service overloaded (code_503)");
    expect(sent).toHaveLength(3);
  });

  test("doesn't retry other client errors", async () => {
    for (const status of [400, 401, 402, 404, 413, 504]) {
      sent.length = 0;
      mockFetch(apiError(status, "nope"), stream({ text: "{}" }));
      const error = await complete(request()).catch((e: unknown) => e);
      expect((error as ModelError).status).toBe(status);
      expect(sent).toHaveLength(1);
    }
  });

  test("doesn't call the API when the caller has already aborted", async () => {
    const abort = new AbortController();
    abort.abort();
    mockFetch(stream({ text: "{}" }));
    const error = await complete(request({ signal: abort.signal })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(sent).toHaveLength(0);
  });

  test("stops waiting to retry when the caller aborts", async () => {
    const abort = new AbortController();
    mockFetch(apiError(503, "Service overloaded", { "retry-after": "60" }));
    setTimeout(() => abort.abort(), 20);
    const started = Date.now();
    const error = await complete(request({ signal: abort.signal })).catch((e: unknown) => e);
    expect(abort.signal.aborted).toBe(true);
    expect(error).toBeInstanceOf(ModelError);
    expect((error as ModelError).spent).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(sent).toHaveLength(1);
  });
});

describe("costUsd", () => {
  const u = (input: number, cached: number, output: number) => ({
    inputTokens: input,
    cacheReadTokens: cached,
    outputTokens: output,
    cacheWriteTokens: 0,
  });

  test("prices each Muse text model", () => {
    expect(costUsd("muse-spark-1.3", u(1e6, 0, 0))).toBeCloseTo(1.25);
    expect(costUsd("muse-spark-1.1", u(0, 1e6, 1e6))).toBeCloseTo(0.15 + 4.25);
    expect(costUsd("muse-wonder-1.0", u(1e6, 1e6, 1e6))).toBeCloseTo(4 + 0.2 + 20);
  });

  test("bills a whole Ember request at the long-context tier above 200K input tokens", () => {
    expect(costUsd("muse-ember-1.0", u(150_000, 50_000, 1e6))).toBeCloseTo(
      (150_000 * 0.1 + 50_000 * 0.004) / 1e6 + 0.5,
    );
    expect(costUsd("muse-ember-1.0", u(150_000, 50_001, 1e6))).toBeCloseTo(
      (150_000 * 0.3 + 50_001 * 0.012) / 1e6 + 1.5,
    );
  });

  test("is unknown for other models", () => {
    expect(costUsd("some-other-model", u(1, 1, 1))).toBeUndefined();
  });
});

/* ---------- runAgent on the mocked client ---------- */

/** An action ctx over two public external sources, recording `aiRuns` rows. */
function fakeCtx() {
  const db = fakeDb({
    externalSources: ["x1", "x2"].map((_id, i) => ({
      _id,
      url: `https://sfmta.com/${_id}`,
      title: `Source ${_id}`,
      publisher: "SFMTA",
      snippet: ["Get the carnitas on 24th.", "Dolores Park on Saturday mornings."][i],
      fetchedAt: Date.UTC(2026, 10, 1),
    })),
  });
  const runs: Row[] = [];
  const ctx = {
    runMutation: async (ref: FunctionReference<"mutation">, args: Row) => {
      if (getFunctionName(ref) !== "ai/runs:log") throw new Error(getFunctionName(ref));
      runs.push(args);
      return `run${runs.length}`;
    },
    runQuery: async (ref: FunctionReference<"query">, args: Record<string, never>) => {
      const name = getFunctionName(ref);
      if (name === "ai/sources:resolve") return agentSources(db, args.sources, args.shownTo);
      if (name === "ai/runs:cached") return null;
      if (name === "ai/runs:wrongTableIds") return [];
      throw new Error(name);
    },
  };
  return { ctx: ctx as unknown as ActionCtx, runs };
}

const tips = defineTask({
  agent: "ember",
  name: "test.tips",
  instructions: "List the tips locals give, each with its source.",
  output: v.object({ tips: v.array(v.object({ text: v.string(), source: v.string() })) }),
  cites: (o) => o.tips.map((t) => t.source),
  fallback: (_input: { area: string }, sources: AgentSource[]) => ({
    tips: sources.map((s) => ({ text: s.text, source: s.key })),
  }),
  cacheTtlMs: 0,
});

const X = (id: string): Source => ({ kind: "external", externalSourceId: id as never });
const sources = [X("x1"), X("x2")];
const args = { input: { area: "Mission" }, sources, shownTo: "everyone" as const };
const good = JSON.stringify({ tips: [{ text: "Carnitas on 24th", source: "external:x1" }] });

describe("runAgent with Muse", () => {
  test("returns validated model output and logs tokens and cost", async () => {
    const { ctx, runs } = fakeCtx();
    mockFetch(stream({ text: good }));
    const result = await runAgent(ctx, tips, args);

    expect(result.via).toBe("model");
    expect(result.output).toEqual(JSON.parse(good));
    expect(result.cited).toEqual(cite([X("x1")]));
    const messages = sent[0].body.messages as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual(["developer", "developer", "user"]);
    expect(messages[0].content).toStartWith("You are Ember");
    expect(messages[1].content).toBe(tips.instructions);
    expect(messages[2].content).toContain("external:x2");

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      outcome: "model",
      model: "muse-spark-1.3",
      attempts: 1,
      cited: ["external:x1"],
      usage: { inputTokens: 600, outputTokens: 200, cacheReadTokens: 400, cacheWriteTokens: 0 },
    });
    expect(runs[0].costUsd).toBeCloseTo((600 * 1.25 + 400 * 0.15 + 200 * 4.25) / 1e6, 12);
  });

  test("sends rejected output back with the problems, then accepts the fix", async () => {
    const { ctx, runs } = fakeCtx();
    const bad = JSON.stringify({ tips: [{ text: "Made up", source: "post:nope" }] });
    mockFetch(stream({ text: bad }), stream({ text: good }));
    const result = await runAgent(ctx, tips, args);

    expect(result.via).toBe("model");
    const retry = sent[1].body.messages as { role: string; content: string }[];
    expect(retry.slice(3)).toEqual([
      { role: "assistant", content: bad },
      {
        role: "user",
        content: expect.stringContaining('cites "post:nope", which is not one of the sources'),
      },
    ]);
    // Usage and cost add up across both attempts.
    expect(runs[0]).toMatchObject({
      attempts: 2,
      usage: { inputTokens: 1_200, outputTokens: 400 },
    });
    expect(runs[0].errors).toEqual([expect.stringContaining("Attempt 1: cites")]);
  });

  test("tells the model when its output was cut off", async () => {
    const { ctx } = fakeCtx();
    mockFetch(stream({ text: '{"tips":[', finish: "length" }), stream({ text: good }));
    await runAgent(ctx, tips, args);
    const retry = sent[1].body.messages as { content: string }[];
    expect(retry[4].content).toContain("cut off at the length limit");
  });

  test("falls back after the last rejected attempt", async () => {
    const { ctx, runs } = fakeCtx();
    mockFetch(stream({ text: "nope" }), stream({ text: "nope" }), stream({ text: "nope" }));
    const result = await runAgent(ctx, tips, args);
    expect(result).toMatchObject({ via: "fallback", fallbackReason: "invalid_output" });
    expect(result.cited).toEqual(cite(sources));
    expect(runs[0]).toMatchObject({ outcome: "fallback", attempts: 3 });
  });

  test("falls back on a refusal or a content filter, without retrying", async () => {
    for (const reply of [stream({ refusal: "No." }), stream({ finish: "content_filter" })]) {
      sent.length = 0;
      const { ctx, runs } = fakeCtx();
      mockFetch(reply, stream({ text: good }));
      const result = await runAgent(ctx, tips, args);
      expect(result).toMatchObject({ via: "fallback", fallbackReason: "refusal" });
      expect(sent).toHaveLength(1);
      expect(runs[0]).toMatchObject({ model: "muse-spark-1.3", attempts: 1 });
      expect(runs[0].usage).toBeDefined();
    }
  });

  test("logs the tokens of attempts that failed before falling back", async () => {
    const { ctx, runs } = fakeCtx();
    const broken = () => stream({ text: '{"tips":', done: false });
    mockFetch(broken, broken, broken);
    const result = await runAgent(ctx, tips, args);
    expect(result).toMatchObject({ via: "fallback", fallbackReason: "model_error" });
    expect(runs[0]).toMatchObject({
      model: "muse-spark-1.3",
      attempts: 1,
      usage: { inputTokens: 1_800, outputTokens: 600, cacheReadTokens: 1_200 },
    });
    expect(runs[0].costUsd).toBeCloseTo((3 * (600 * 1.25 + 400 * 0.15 + 200 * 4.25)) / 1e6, 12);
  });

  test("falls back on an API error", async () => {
    const { ctx, runs } = fakeCtx();
    mockFetch(apiError(401, "Invalid API key"));
    const result = await runAgent(ctx, tips, args);
    expect(result).toMatchObject({ via: "fallback", fallbackReason: "model_error" });
    expect(runs[0].errors).toEqual(["Attempt 1: 401: Invalid API key (code_401)"]);
  });

  test("is off without MODEL_API_KEY or with AI_ENABLED=false", async () => {
    delete process.env.MODEL_API_KEY;
    const off = fakeCtx();
    expect(await runAgent(off.ctx, tips, args)).toMatchObject({
      via: "fallback",
      fallbackReason: "disabled",
    });
    expect(off.runs[0]).toMatchObject({ outcome: "fallback", attempts: 0 });

    process.env.MODEL_API_KEY = "test-key";
    process.env.AI_ENABLED = "false";
    expect((await runAgent(fakeCtx().ctx, tips, args)).fallbackReason).toBe("disabled");
    expect(sent).toHaveLength(0);
  });
});

describe("private media tasks", () => {
  test("sends real image and video content blocks to Wonder and accounts for its usage", async () => {
    const { ctx, runs } = fakeCtx();
    mockFetch(stream({ text: good, model: "muse-wonder-1.0" }));
    const media = [
      { key: "plan", kind: "image" as const, url: "https://example.org/plan.png" },
      { key: "tour", kind: "video" as const, url: "https://example.org/tour.mp4" },
    ];
    await runAgent(
      ctx,
      { ...tips, model: "muse-wonder-1.0" },
      {
        ...args,
        shownTo: "users:one" as never,
        media,
      },
    );
    expect(sent[0].body.model).toBe("muse-wonder-1.0");
    const messages = sent[0].body.messages as { content: unknown }[];
    expect(messages[2].content).toEqual(
      expect.arrayContaining([
        { type: "image_url", image_url: { url: media[0].url } },
        { type: "video_url", video_url: { url: media[1].url } },
      ]),
    );
    expect(runs[0].model).toBe("muse-wonder-1.0");
    expect(runs[0].costUsd).toBeCloseTo((600 * 4 + 400 * 0.2 + 200 * 20) / 1e6);
  });

  test("refuses a shared audience and separates private media cache keys by owner", async () => {
    const media = [{ key: "plan", kind: "image" as const, url: "https://example.org/plan.png" }];
    await expect(
      runAgent(fakeCtx().ctx, tips, { ...args, shownTo: "everyone", media }),
    ).rejects.toThrow("private audience");
    const first = fakeCtx(),
      second = fakeCtx();
    mockFetch(stream({ text: good }), stream({ text: good }));
    await runAgent(first.ctx, tips, { ...args, shownTo: "users:one" as never, media });
    await runAgent(second.ctx, tips, { ...args, shownTo: "users:two" as never, media });
    expect(first.runs[0].inputHash).not.toBe(second.runs[0].inputHash);
  });
});
