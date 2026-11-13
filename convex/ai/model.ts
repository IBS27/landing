/**
 * The model behind every agent, and the only code that talks to a model API.
 * Landing uses Meta's Muse models only (see "AI calls" in design/BUILD_GUIDE.md).
 *
 * Keys and switches are Convex environment variables only (`bunx convex env set NAME value`):
 * - `MODEL_API_KEY`: Meta Model API key. Without it, AI is off and features use their fallbacks.
 * - `AI_ENABLED`: the global kill switch. Set it to `false` to turn AI off.
 *
 * Docs: https://dev.meta.ai/docs/protocols/chat-completions
 */
export const MODEL = "muse-spark-1.3";

const API_URL = "https://api.meta.ai/v1/chat/completions";
/** Covers reasoning and the answer together. */
const MAX_COMPLETION_TOKENS = 32_000;
/** One HTTP request, before it's abandoned (Convex actions run for at most 10 minutes). */
const REQUEST_TIMEOUT_MS = 4 * 60_000;
/** Retries after the first try, for 429, 500, 503 and network errors. */
const MAX_RETRIES = 2;

export type Effort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type Model = typeof MODEL | "muse-wonder-1.0";
export type MediaInput = { key: string; kind: "image" | "video"; url: string };
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };
/** A function call the model asked for. `arguments` is JSON text as the model wrote it: parse and check it. */
export type ToolCall = { id: string; name: string; arguments: string };
/** A function the model may call. `parameters` is the JSON Schema of its arguments (an object). */
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type Message =
  | { role: "user"; content: string | ContentPart[] }
  /** `toolCalls` replays the calls the model made, ahead of their `tool` messages. */
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  /** One call's result, as text (JSON). */
  | { role: "tool"; toolCallId: string; content: string };

export type Usage = {
  /** Input tokens not served from Meta's prompt cache. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Always 0: Meta doesn't bill cache writes. Kept so `aiRuns.usage` has one shape. */
  cacheWriteTokens: number;
};

export type Reply = {
  /** The model that answered. */
  model: string;
  /** The answer text (JSON, when the request had a schema). */
  text: string;
  /** Set when the model declined; `text` is then not an answer. */
  refusal?: string;
  /** The functions the model wants called before it answers; empty when it answered. */
  toolCalls: ToolCall[];
  /** "stop", "length", "tool_calls", "content_filter"... */
  finishReason: string | null;
  usage: Usage;
  costUsd: number | undefined;
};

export type Request = {
  model?: Model;
  /** Developer-level instructions, sent first in order so the prefix caches. */
  system: string[];
  messages: Message[];
  /** JSON Schema the answer is decoded against. Its root must be an object. */
  schema: Record<string, unknown>;
  /** Functions the model may call instead of answering. It chooses whether to (`tool_choice` is "auto"). */
  tools?: ToolSpec[];
  effort: Effort;
  /** Aborts the request and any retry wait. */
  signal: AbortSignal;
};

/**
 * Tokens and cost across every attempt of one `complete()` call that Meta may
 * have billed, failed ones included. `costUsd` is undefined when one of them
 * didn't report usage.
 */
export type Spent = { model: string; usage: Usage; costUsd: number | undefined };

/**
 * Thrown when `complete()` fails after retries, or is aborted. `status` is the
 * HTTP status, if any; `spent` is what earlier streamed attempts used, if any.
 */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly spent?: Spent,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

/** One completion from Meta's Chat Completions API, streamed so long reasoning can't hit a gateway timeout. */
export async function complete(req: Request): Promise<Reply> {
  const body = JSON.stringify({
    model: req.model ?? MODEL,
    messages: [
      ...req.system.map((content) => ({ role: "developer", content })),
      ...req.messages.map(wireMessage),
    ],
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: req.effort,
    // Decoding follows the schema either way; strict mode would also require every property.
    response_format: {
      type: "json_schema",
      json_schema: { name: "output", schema: req.schema, strict: false },
    },
    ...(req.tools?.length && {
      tools: req.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    }),
    stream: true,
    stream_options: { include_usage: true },
  });

  const tally = new Tally();
  for (let retry = 0; ; retry++) {
    let wait: number | undefined;
    try {
      const answer = await attempt(body, req.signal, tally, req.model ?? MODEL);
      // A successful attempt always streamed, so the tally has it.
      return { ...answer, ...(tally.total() as Spent) };
    } catch (error) {
      wait = !req.signal.aborted && error instanceof Retryable ? error.waitMs(retry) : undefined;
      if (wait === undefined || retry >= MAX_RETRIES) throw toModelError(error, tally.total());
    }
    try {
      await sleep(wait, req.signal);
    } catch (error) {
      throw toModelError(error, tally.total());
    }
  }
}

/** A message as Chat Completions takes it. */
function wireMessage(m: Message) {
  switch (m.role) {
    case "user":
      return { role: m.role, content: m.content };
    case "assistant":
      return {
        role: m.role,
        content: m.content,
        ...(m.toolCalls?.length && {
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        }),
      };
    case "tool":
      return { role: m.role, tool_call_id: m.toolCallId, content: m.content };
  }
}

/** A failure worth retrying: rate limits, overload, server errors and dropped connections. */
class Retryable extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
  /** Meta's advice: honor Retry-After, else exponential backoff with jitter from ~500ms. */
  waitMs(retry: number) {
    return this.retryAfterMs ?? 500 * 2 ** retry * (1 + Math.random());
  }
}

const RETRY_STATUSES = new Set([429, 500, 503]);

/**
 * Adds up usage and cost over attempts. An attempt that may have been billed
 * without reporting usage (a stream that broke early, or a connection lost
 * before the response arrived) makes the cost unknown.
 */
class Tally {
  private model = MODEL;
  private usage: Usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  private cost: number | undefined = 0;
  private billable = false;

  add(model: string, usage: Usage | undefined) {
    this.model = model;
    this.billable = true;
    if (!usage) {
      this.cost = undefined;
      return;
    }
    for (const k of Object.keys(usage) as (keyof Usage)[]) this.usage[k] += usage[k];
    const cost = costUsd(model, usage);
    this.cost = this.cost === undefined || cost === undefined ? undefined : this.cost + cost;
  }

  total(): Spent | undefined {
    return this.billable
      ? { model: this.model, usage: { ...this.usage }, costUsd: this.cost }
      : undefined;
  }
}

type Answer = Pick<Reply, "text" | "refusal" | "toolCalls" | "finishReason">;

async function attempt(
  body: string,
  outer: AbortSignal,
  tally: Tally,
  model: Model,
): Promise<Answer> {
  // A listener doesn't see an abort that already happened.
  outer.throwIfAborted();
  // Abort on the caller's signal or this request's own timeout.
  const abort = new AbortController();
  const onAbort = () => abort.abort(outer.reason);
  outer.addEventListener("abort", onAbort);
  const timer = setTimeout(
    () => abort.abort(new Retryable("The request timed out")),
    REQUEST_TIMEOUT_MS,
  );
  try {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
        signal: abort.signal,
      });
    } catch (error) {
      // The request was sent, so Meta may have run and billed it; the usage is unknown.
      tally.add(model, undefined);
      throw abort.signal.aborted ? abort.signal.reason : new Retryable(errorText(error));
    }
    if (!res.ok) {
      const text = `${res.status}: ${await errorMessage(res)}`;
      if (!RETRY_STATUSES.has(res.status)) throw new ModelError(text, res.status);
      throw new Retryable(text, res.status, retryAfterMs(res.headers.get("retry-after")));
    }
    if (!res.body) throw new ModelError("The response had no body");

    const reader = res.body.getReader();
    const seen: Seen = { model };
    try {
      return await readStream(reader, seen);
    } catch (error) {
      if (abort.signal.aborted) throw abort.signal.reason;
      // A dropped connection or garbled stream: try again.
      throw error instanceof Retryable ? error : new Retryable(errorText(error));
    } finally {
      tally.add(seen.model, seen.usage);
      // Release the connection whether the stream finished, failed or was abandoned.
      reader.cancel().catch(() => {});
    }
  } finally {
    clearTimeout(timer);
    outer.removeEventListener("abort", onAbort);
  }
}

type Chunk = {
  model?: string;
  choices?: {
    delta?: {
      content?: string | null;
      refusal?: string | null;
      /** Fragments of the calls being made, each for the call at `index`. */
      tool_calls?:
        | {
            index: number;
            id?: string | null;
            function?: { name?: string | null; arguments?: string | null } | null;
          }[]
        | null;
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  } | null;
  error?: { message?: string; code?: string | null };
};

/** What a stream reported before it ended, kept even when it fails partway. */
type Seen = { model: string; usage?: Usage };

/** Collects a streamed chat completion (server-sent events ending in `data: [DONE]`). */
async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  seen: Seen,
): Promise<Answer> {
  let text = "";
  let refusal = "";
  let finishReason: string | null = null;
  let done = false;
  // Tool calls arrive in pieces, keyed by their position in the reply.
  const calls = new Map<number, ToolCall>();

  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      return;
    }
    const chunk = JSON.parse(data) as Chunk;
    if (chunk.error) throw new Retryable(`Stream error: ${chunk.error.message ?? "unknown"}`);
    if (chunk.model) seen.model = chunk.model;
    for (const choice of chunk.choices ?? []) {
      text += choice.delta?.content ?? "";
      refusal += choice.delta?.refusal ?? "";
      for (const piece of choice.delta?.tool_calls ?? []) {
        const call = calls.get(piece.index) ?? { id: "", name: "", arguments: "" };
        call.id += piece.id ?? "";
        call.name += piece.function?.name ?? "";
        call.arguments += piece.function?.arguments ?? "";
        calls.set(piece.index, call);
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
    if (chunk.usage) {
      const cached = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      seen.usage = {
        inputTokens: (chunk.usage.prompt_tokens ?? 0) - cached,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        cacheReadTokens: cached,
        cacheWriteTokens: 0,
      };
    }
  };

  const decoder = new TextDecoder();
  let buffer = "";
  while (!done) {
    const { value, done: ended } = await reader.read();
    if (ended) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  if (!done) handle(buffer + decoder.decode());
  if (!done) throw new Retryable("The stream ended early");
  const toolCalls = [...calls].sort(([a], [b]) => a - b).map(([, call]) => call);
  // A result can't be sent back for a call with no id, and a call with no name can't be run.
  if (toolCalls.some((c) => !c.id || !c.name))
    throw new Retryable("The stream had a tool call without an id or a name");
  return { text, ...(refusal ? { refusal } : {}), toolCalls, finishReason };
}

async function errorMessage(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
    if (parsed.error?.message)
      return `${parsed.error.message}${parsed.error.code ? ` (${parsed.error.code})` : ""}`;
  } catch {}
  return text.slice(0, 500) || res.statusText || "no details";
}

function retryAfterMs(header: string | null) {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", stop);
      resolve();
    }
    function stop() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", stop, { once: true });
  });
}

function toModelError(error: unknown, spent: Spent | undefined) {
  if (error instanceof ModelError) return new ModelError(error.message, error.status, spent);
  const status = error instanceof Retryable ? error.status : undefined;
  return new ModelError(errorText(error), status, spent);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type Price = { input: number; cachedInput: number; output: number };

/** USD per million tokens, from https://dev.meta.ai/docs/pricing-rate-limits. */
const PRICES: Record<string, Price | { upTo: number; base: Price; above: Price }> = {
  "muse-spark-1.3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.2": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.1": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-wonder-1.0": { input: 4, cachedInput: 0.2, output: 20 },
  // Above 200K input tokens, the whole request is billed at the higher tier.
  "muse-ember-1.0": {
    upTo: 200_000,
    base: { input: 0.1, cachedInput: 0.004, output: 0.5 },
    above: { input: 0.3, cachedInput: 0.012, output: 1.5 },
  },
};

/** Estimated cost of one request at the answering model's list prices; undefined for unknown models. */
export function costUsd(model: string, u: Usage) {
  const entry = PRICES[model];
  if (!entry) return undefined;
  const p =
    "upTo" in entry
      ? u.inputTokens + u.cacheReadTokens > entry.upTo
        ? entry.above
        : entry.base
      : entry;
  return (
    (u.inputTokens * p.input + u.cacheReadTokens * p.cachedInput + u.outputTokens * p.output) /
    1_000_000
  );
}
