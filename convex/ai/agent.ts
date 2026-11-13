import type { GenericValidator, Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { sourceKey, sourcesOf, tryCite } from "../lib/citations";
import type { AiAgent, AiFallbackReason, Citations, Source } from "../validators";
import {
  complete,
  type Effort,
  type Message,
  MODEL,
  ModelError,
  type Reply,
  type Spent,
  type Usage,
} from "./model";
import {
  canonicalJson,
  checkValue,
  collectStrings,
  type Json,
  sha256,
  toJsonSchema,
} from "./outputSchema";
import { type AgentSource, describeSource, type ShownTo } from "./sources";
import { aiEnabled } from "./status";

/**
 * The one way features call a model. A task is declared once, next to the
 * feature, and run with `runAgent` inside a Convex action:
 *
 *   const weekendRoute = defineTask({ agent: "ember", name: "ember.weekendRoute", ... });
 *   const result = await runAgent(ctx, weekendRoute, { input, sources, shownTo: "everyone" });
 *
 * The model gets no tools and `runAgent` writes only its `aiRuns` log row. The
 * caller decides where the output goes: #6's `propose()` for anything sent or
 * created for a user, or a computed-table mutation. Either way, store
 * `result.cited` after `assertCitable()` with the same audience.
 */

export type AgentTask<I extends Json, V extends GenericValidator> = {
  agent: AiAgent;
  /** Unique across the app, e.g. "ember.weekendRoute". Logged on every run. */
  name: string;
  /** The task's system prompt. Changing it starts a fresh cache. */
  instructions: string;
  /** The output's shape, as a Convex validator. Sent to the model as a JSON schema. */
  output: V;
  /** Every source key the output cites (`AgentSource.key`). Each one must be one of the run's sources. */
  cites: (output: Infer<V>) => string[];
  /** Task rules a schema can't express (math adds up, each item cites a source). Return errors. */
  check?: (output: Infer<V>, input: I) => string[];
  /**
   * The non-AI result, used when AI is off or the model can't produce a valid
   * answer. It gets only the sources the result's audience can read, and may
   * cite only those: `runAgent` throws otherwise.
   */
  fallback: (input: I, sources: AgentSource[]) => Infer<V>;
  /** Default "medium". */
  effort?: Effort;
  /** How long a model result is reused for the same input. Default 24 hours; 0 disables. */
  cacheTtlMs?: number;
  /** Model attempts before falling back, counting retries after rejected output. Default 3. */
  maxAttempts?: number;
  /** Bump when `cites`, `check` or `fallback` change in a way that should drop cached results. */
  version?: number;
};

export type AgentResult<O> = {
  output: O;
  via: "model" | "cache" | "fallback";
  fallbackReason?: AiFallbackReason;
  /**
   * What the output cites: the run's own `Source` values, in citation order,
   * ready to store after `assertCitable()`. Null when it cites nothing.
   */
  cited: Citations | null;
  runId: Id<"aiRuns">;
};

const DAY = 24 * 60 * 60_000;
/** Default deadline for a run's model calls, retries included, inside Convex's 10-minute action limit. */
const BUDGET_MS = 8 * 60_000;

/** Declares a task. Throws at load time if the output validator can't be a model schema. */
export function defineTask<I extends Json, V extends GenericValidator>(
  task: AgentTask<I, V>,
): AgentTask<I, V> {
  if (task.output.kind !== "object") throw new Error(`${task.name}: output must be a v.object()`);
  toJsonSchema(task.output);
  return task;
}

const ROLES: Record<AiAgent, string> = {
  muse: "You are Muse, who drafts messages, plans and posts for the user. Nothing you write is sent or created until the user approves it.",
  ember: "You are Ember, who reads local Group threads and pulls out what locals recommend.",
  spark:
    "You are Spark, who finds what locals agree on across many threads and notes where they disagree.",
};

function preamble(agent: AiAgent) {
  return `${ROLES[agent]} You work inside Landing, an app that helps people find an apartment in San Francisco, move in and settle into a neighborhood.

Rules:
- Use only the facts in <input> and <sources>. When they don't support something, leave it out rather than guess.
- Cite sources by their exact \`key\`, and only sources that support what you say.
- Copy record IDs exactly from the input. Never invent IDs, people, places, times or prices.
- Never use or infer protected traits (race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, age, disability, pregnancy or family status).
- Reply with JSON only, matching the schema.`;
}

function userPrompt(input: Json, sources: Json[]) {
  return `<input>\n${JSON.stringify(input, null, 2)}\n</input>\n<sources>\n${JSON.stringify(sources, null, 2)}\n</sources>`;
}

const fingerprints = new WeakMap<object, Promise<string>>();

/** Changes whenever the task's prompt, schema, effort, version or model changes, so stale cache entries miss. */
function fingerprint(task: AgentTask<Json, GenericValidator>) {
  let fp = fingerprints.get(task);
  if (!fp) {
    fp = sha256(
      canonicalJson({
        model: MODEL,
        preamble: preamble(task.agent),
        instructions: task.instructions,
        schema: toJsonSchema(task.output),
        effort: task.effort ?? "medium",
        version: task.version ?? 0,
      }),
    );
    fingerprints.set(task, fp);
  }
  return fp;
}

/** Runs a task: cache, model with validation and retries, or the task's fallback. */
export async function runAgent<I extends Json, V extends GenericValidator>(
  ctx: ActionCtx,
  task: AgentTask<I, V>,
  args: {
    input: I;
    /**
     * What the model may read and cite. Sources `shownTo` can't see are dropped
     * before the model sees them (see `agentSources`).
     */
    sources: readonly Source[];
    /**
     * Who will see the result: `"everyone"` for a result cached once for every
     * viewer (only public sources are read), or the one user it's for.
     */
    shownTo: ShownTo;
    jobId?: Id<"aiJobs">;
    /** When to stop calling the model (ms since epoch). Default: 8 minutes from now. Pass one shared deadline when an action makes several runs. */
    deadline?: number;
  },
): Promise<AgentResult<Infer<V>>> {
  type O = Infer<V>;
  const { input, jobId } = args;
  const started = Date.now();
  const deadline = args.deadline ?? started + BUDGET_MS;
  const generic = task as unknown as AgentTask<Json, GenericValidator>;

  const sources = await ctx.runQuery(internal.ai.sources.resolve, {
    sources: [...args.sources],
    shownTo: args.shownTo,
  });
  const given = new Map(args.sources.map((s) => [sourceKey(s), s]));
  // Readable sources by key, as the caller's own `Source` values.
  const byKey = new Map(
    sources.flatMap((s) => {
      const source = given.get(s.key);
      return source ? [[s.key, source] as const] : [];
    }),
  );
  const described = sources.map(describeSource);
  const inputHash = await sha256(
    canonicalJson({ task: task.name, fp: await fingerprint(generic), input, sources: described }),
  );
  const toCitations = (keys: string[]) => tryCite(keys.flatMap((k) => byKey.get(k) ?? []));

  const errors: string[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let cost: number | undefined = 0;
  let model: string | undefined;
  let attempts = 0;
  /** Adds one `complete()` call's tokens and cost, failed HTTP attempts included. */
  const charge = (spent: Spent) => {
    model = spent.model;
    for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += spent.usage[k];
    cost = cost === undefined || spent.costUsd === undefined ? undefined : cost + spent.costUsd;
  };

  const log = (
    outcome: "model" | "fallback",
    output: O,
    cited: string[],
    fallbackReason?: AiFallbackReason,
  ) =>
    ctx.runMutation(internal.ai.runs.log, {
      agent: task.agent,
      task: task.name,
      inputHash,
      outcome,
      fallbackReason,
      output: JSON.stringify(output),
      cited,
      model,
      attempts,
      errors: errors.length ? errors : undefined,
      latencyMs: Date.now() - started,
      usage: attempts ? usage : undefined,
      costUsd: attempts ? cost : undefined,
      jobId,
      createdAt: Date.now(),
    });

  const fallback = async (reason: AiFallbackReason): Promise<AgentResult<O>> => {
    const output = task.fallback(input, sources);
    // The fallback is plain code given only the readable sources, so citing
    // anything else is a bug in the task. Fail loudly rather than return output
    // whose citations don't cover it.
    const keys = task.cites(output);
    const unknown = [...new Set(keys)].filter((k) => !byKey.has(k));
    if (unknown.length)
      throw new Error(
        `${task.name}: fallback cites sources it wasn't given: ${unknown.join(", ")}`,
      );
    const cited = toCitations(keys);
    const runId = await log(
      "fallback",
      output,
      cited ? sourcesOf(cited).map(sourceKey) : [],
      reason,
    );
    return { output, via: "fallback", fallbackReason: reason, cited, runId };
  };

  if (!aiEnabled()) return fallback("disabled");

  const ttl = task.cacheTtlMs ?? DAY;
  if (ttl > 0) {
    const hit = await ctx.runQuery(internal.ai.runs.cached, { inputHash, since: started - ttl });
    // The hash covers the schema, but re-check so a cached row can never return the wrong type.
    const output: unknown = hit ? JSON.parse(hit.output) : undefined;
    if (hit && checkValue(task.output, output).errors.length === 0)
      return { output: output as O, via: "cache", cited: toCitations(hit.cited), runId: hit._id };
  }

  const grounding = {
    ids: allowedIds(input, byKey.keys()),
    sources: byKey,
    wrongTable: (ids: { id: string; table: string }[]) =>
      ids.length ? ctx.runQuery(internal.ai.runs.wrongTableIds, { ids }) : Promise.resolve([]),
  };
  const schema = toJsonSchema(task.output);
  const system = [preamble(task.agent), task.instructions];
  const messages: Message[] = [{ role: "user", content: userPrompt(input, described) }];

  const maxAttempts = task.maxAttempts ?? 3;
  while (attempts < maxAttempts) {
    const remaining = deadline - Date.now();
    if (remaining < 30_000) {
      errors.push("Out of time for another attempt");
      return fallback("timeout");
    }
    attempts++;
    let reply: Reply;
    // Abort covers the client's own retries too, keeping the whole run inside the deadline.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), remaining);
    try {
      reply = await complete({
        system,
        messages,
        schema,
        effort: task.effort ?? "medium",
        signal: abort.signal,
      });
    } catch (error) {
      if (error instanceof ModelError && error.spent) charge(error.spent);
      errors.push(`Attempt ${attempts}: ${message(error)}`);
      return fallback(abort.signal.aborted ? "timeout" : "model_error");
    } finally {
      clearTimeout(timer);
    }

    charge(reply);

    if (reply.refusal !== undefined || reply.finishReason === "content_filter") {
      errors.push(`Attempt ${attempts}: refused (${reply.refusal ?? reply.finishReason})`);
      return fallback("refusal");
    }

    const verdict = await review(task, [reply.text], input, grounding, reply.finishReason);
    if (verdict.ok) {
      const cited = toCitations(verdict.cited);
      const runId = await log(
        "model",
        verdict.output,
        cited ? sourcesOf(cited).map(sourceKey) : [],
      );
      return { output: verdict.output, via: "model", cited, runId };
    }

    errors.push(`Attempt ${attempts}: ${verdict.problems.join("; ")}`);
    messages.push(
      { role: "assistant", content: reply.text },
      {
        role: "user",
        content: `Your output was rejected:\n${verdict.problems.map((p) => `- ${p}`).join("\n")}\n\nReply with the whole corrected JSON.`,
      },
    );
  }
  return fallback("invalid_output");
}

/**
 * Strings an output's `v.id()` fields may hold: anything in the input, plus
 * source keys and the record id inside a `<kind>:<id>` key.
 */
function allowedIds(input: Json, keys: Iterable<string>) {
  const ids = collectStrings(input);
  for (const key of keys) {
    ids.add(key);
    const colon = key.indexOf(":");
    if (colon > 0) ids.add(key.slice(colon + 1));
  }
  return ids;
}

type Grounding = {
  ids: Set<string>;
  /** The readable sources, by key. */
  sources: ReadonlyMap<string, unknown>;
  /** The ids that aren't ids of the table their field expects. */
  wrongTable: (ids: { id: string; table: string }[]) => Promise<string[]>;
};

/** Validates one model reply: JSON, schema, grounded IDs of the right table, cited sources, task rules. */
export async function review<I extends Json, V extends GenericValidator>(
  task: AgentTask<I, V>,
  /** Candidate answer texts, tried in order; the first that parses as JSON is reviewed. */
  texts: string[],
  input: I,
  grounding: Grounding,
  stopReason: string | null,
): Promise<{ ok: true; output: Infer<V>; cited: string[] } | { ok: false; problems: string[] }> {
  const parsed = firstJson(texts);
  if (parsed === NOT_JSON) {
    return {
      ok: false,
      problems: [
        stopReason === "length"
          ? "The output was cut off at the length limit. Keep it shorter."
          : "The output was not valid JSON.",
      ],
    };
  }

  const { errors, ids } = checkValue(task.output, parsed);
  if (errors.length) return { ok: false, problems: errors };
  const output = parsed as Infer<V>;

  const problems: string[] = [];
  const known = ids.filter(({ path, id }) => {
    if (grounding.ids.has(id)) return true;
    problems.push(`${path}: ID "${id}" is not in the input`);
    return false;
  });
  const wrong = new Set(await grounding.wrongTable(known.map(({ id, table }) => ({ id, table }))));
  for (const { path, id, table } of known)
    if (wrong.has(id)) problems.push(`${path}: "${id}" is not a ${table} ID`);

  // Task code runs on model output; a throw is a rejected answer, not a crash.
  let cited: string[] = [];
  try {
    cited = task.cites(output);
    for (const key of new Set(cited))
      if (!grounding.sources.has(key))
        problems.push(`cites "${key}", which is not one of the sources`);
    problems.push(...(task.check?.(output, input) ?? []));
  } catch (error) {
    problems.push(`The output failed the task's checks: ${message(error)}`);
  }
  return problems.length ? { ok: false, problems } : { ok: true, output, cited };
}

const NOT_JSON = Symbol("not JSON");

function firstJson(texts: string[]): unknown {
  for (const text of texts) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return NOT_JSON;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
