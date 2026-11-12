import type Anthropic from "@anthropic-ai/sdk";
import type { GenericValidator, Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { AiAgent, AiFallbackReason } from "../validators";
import { anthropic, costUsd, FALLBACK_BETA, MODEL, type Usage } from "./model";
import {
  canonicalJson,
  checkValue,
  collectStrings,
  type Json,
  sha256,
  toJsonSchema,
} from "./outputSchema";
import { type AgentSource, describeSource, sourceKey } from "./sources";
import { aiEnabled } from "./status";

/**
 * The one way features call a model. A task is declared once, next to the
 * feature, and run with `runAgent` inside a Convex action:
 *
 *   const weekendRoute = defineTask({ agent: "ember", name: "ember.weekendRoute", ... });
 *   const result = await runAgent(ctx, weekendRoute, { input, sources });
 *
 * The model gets no tools and `runAgent` writes only its `aiRuns` log row. The
 * caller decides where the output goes: #6's `propose()` for anything sent or
 * created for a user, or a computed-table mutation.
 */

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type AgentTask<I extends Json, V extends GenericValidator> = {
  agent: AiAgent;
  /** Unique across the app, e.g. "ember.weekendRoute". Logged on every run. */
  name: string;
  /** The task's system prompt. Changing it starts a fresh cache. */
  instructions: string;
  /** The output's shape, as a Convex validator. Sent to the model as a JSON schema. */
  output: V;
  /** Every source key the output cites. Each one must be in the run's `sources`. */
  cites: (output: Infer<V>) => string[];
  /** Task rules a schema can't express (math adds up, each item cites a source). Return errors. */
  check?: (output: Infer<V>, input: I) => string[];
  /** The non-AI result, used when AI is off or the model can't produce a valid answer. */
  fallback: (input: I, sources: AgentSource[]) => Infer<V>;
  /** Default "medium". */
  effort?: Effort;
  /** How long a model result is reused for the same input. Default 24 hours; 0 disables. */
  cacheTtlMs?: number;
  /** Model attempts before falling back, counting retries after rejected output. Default 3. */
  maxAttempts?: number;
};

export type AgentResult<O> = {
  output: O;
  via: "model" | "cache" | "fallback";
  fallbackReason?: AiFallbackReason;
  /** The sources the output cites, in citation order, all taken from the run's `sources`. */
  cited: AgentSource[];
  runId: Id<"aiRuns">;
};

const DAY = 24 * 60 * 60_000;
/** Total model time per run, retries included, so a run ends well inside Convex's 10-minute action limit. */
const BUDGET_MS = 8 * 60_000;

/** Declares a task. Throws at load time if the output validator can't be a model schema. */
export function defineTask<I extends Json, V extends GenericValidator>(
  task: AgentTask<I, V>,
): AgentTask<I, V> {
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

function userPrompt(input: Json, sources: AgentSource[]) {
  return `<input>\n${JSON.stringify(input, null, 2)}\n</input>\n<sources>\n${JSON.stringify(sources.map(describeSource), null, 2)}\n</sources>`;
}

const fingerprints = new WeakMap<object, Promise<string>>();

/** Changes whenever the task's prompt, schema or model changes, so stale cache entries miss. */
function fingerprint(task: AgentTask<Json, GenericValidator>) {
  let fp = fingerprints.get(task);
  if (!fp) {
    fp = sha256(
      canonicalJson({
        model: MODEL,
        preamble: preamble(task.agent),
        instructions: task.instructions,
        schema: toJsonSchema(task.output),
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
  args: { input: I; sources: AgentSource[]; jobId?: Id<"aiJobs"> },
): Promise<AgentResult<Infer<V>>> {
  type O = Infer<V>;
  const { input, sources, jobId } = args;
  const started = Date.now();
  const generic = task as unknown as AgentTask<Json, GenericValidator>;
  const inputHash = await sha256(
    canonicalJson({ task: task.name, fp: await fingerprint(generic), input, sources }),
  );
  const byKey = new Map(sources.map((s) => [sourceKey(s), s]));
  const resolve = (keys: string[]) => [...new Set(keys)].flatMap((k) => byKey.get(k) ?? []);

  const errors: string[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let cost: number | undefined = 0;
  let model: string | undefined;
  let attempts = 0;

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
    const cited = resolve(task.cites(output));
    const runId = await log("fallback", output, cited.map(sourceKey), reason);
    return { output, via: "fallback", fallbackReason: reason, cited, runId };
  };

  if (!aiEnabled()) return fallback("disabled");

  const ttl = task.cacheTtlMs ?? DAY;
  if (ttl > 0) {
    const hit = await ctx.runQuery(internal.ai.runs.cached, { inputHash, since: started - ttl });
    // The hash covers the schema, but re-check so a cached row can never return the wrong type.
    const output: unknown = hit ? JSON.parse(hit.output) : undefined;
    if (hit && checkValue(task.output, output).errors.length === 0)
      return { output: output as O, via: "cache", cited: resolve(hit.cited), runId: hit._id };
  }

  const allowedIds = collectStrings(input);
  for (const key of byKey.keys()) allowedIds.add(key);
  const schema = toJsonSchema(task.output);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: userPrompt(input, sources) },
  ];

  const maxAttempts = task.maxAttempts ?? 3;
  while (attempts < maxAttempts) {
    const remaining = started + BUDGET_MS - Date.now();
    if (remaining < 30_000) {
      errors.push("Out of time for another attempt");
      break;
    }
    attempts++;
    let response: Anthropic.Beta.BetaMessage;
    // Abort covers the SDK's own retries too, keeping the whole run inside the budget.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), remaining);
    try {
      response = await anthropic()
        .beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 32_000,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            system: [
              { type: "text", text: preamble(task.agent) },
              { type: "text", text: task.instructions, cache_control: { type: "ephemeral" } },
            ],
            messages,
            output_config: {
              effort: task.effort ?? "medium",
              format: { type: "json_schema", schema },
            },
          },
          { signal: abort.signal },
        )
        .finalMessage();
    } catch (error) {
      errors.push(`Attempt ${attempts}: ${error instanceof Error ? error.message : String(error)}`);
      return fallback("model_error");
    } finally {
      clearTimeout(timer);
    }

    model = response.model;
    const turn: Usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += turn[k];
    const turnCost = costUsd(response.model, turn);
    cost = cost === undefined || turnCost === undefined ? undefined : cost + turnCost;

    if (response.stop_reason === "refusal") {
      errors.push(
        `Attempt ${attempts}: refused (${response.stop_details?.category ?? "no category"})`,
      );
      return fallback("refusal");
    }

    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const verdict = review(task, text, input, allowedIds, byKey, response.stop_reason);
    if (verdict.ok) {
      const runId = await log("model", verdict.output, verdict.cited);
      return { output: verdict.output, via: "model", cited: resolve(verdict.cited), runId };
    }

    errors.push(`Attempt ${attempts}: ${verdict.problems.join("; ")}`);
    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Your output was rejected:\n${verdict.problems.map((p) => `- ${p}`).join("\n")}\n\nReply with the whole corrected JSON.`,
      },
    );
  }
  return fallback("invalid_output");
}

/** Validates one model reply: JSON, schema, grounded IDs, cited sources, task rules. */
export function review<I extends Json, V extends GenericValidator>(
  task: AgentTask<I, V>,
  text: string,
  input: I,
  allowedIds: Set<string>,
  sources: Map<string, AgentSource>,
  stopReason: string | null,
): { ok: true; output: Infer<V>; cited: string[] } | { ok: false; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      problems: [
        stopReason === "max_tokens"
          ? "The output was cut off at the length limit. Keep it shorter."
          : "The output was not valid JSON.",
      ],
    };
  }

  const { errors, ids } = checkValue(task.output, parsed);
  if (errors.length) return { ok: false, problems: errors };
  const output = parsed as Infer<V>;

  const problems: string[] = [];
  for (const { path, id } of ids)
    if (!allowedIds.has(id)) problems.push(`${path}: ID "${id}" is not in the input`);
  const cited = task.cites(output);
  for (const key of new Set(cited))
    if (!sources.has(key)) problems.push(`cites "${key}", which is not one of the sources`);
  problems.push(...(task.check?.(output, input) ?? []));
  return problems.length ? { ok: false, problems } : { ok: true, output, cited };
}
