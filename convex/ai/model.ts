import Anthropic from "@anthropic-ai/sdk";

/**
 * The model behind every agent, and how it's reached. Keys and switches are
 * Convex environment variables only (`bunx convex env set NAME value`):
 * - `ANTHROPIC_API_KEY`: without it, AI is off and features use their fallbacks.
 * - `AI_ENABLED`: the global kill switch. Set it to `false` to turn AI off.
 */
export const MODEL = "claude-opus-5-5";

/** Beta that lets a refused request re-run on a fallback model in the same call. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;

export function anthropic() {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Convex actions run for at most 10 minutes; leave room for the SDK's retries.
    timeout: 4 * 60_000,
    maxRetries: 2,
  });
  return client;
}

/** USD per million tokens, for `aiRuns.costUsd`. */
const PRICES: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  // Models a refusal can fall back to.
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** Estimated cost at the answering model's list prices; undefined for unknown models. */
export function costUsd(model: string, u: Usage) {
  const p = PRICES[model];
  if (!p) return undefined;
  const total =
    u.inputTokens * p.input +
    u.outputTokens * p.output +
    u.cacheReadTokens * p.cacheRead +
    u.cacheWriteTokens * p.cacheWrite;
  return total / 1_000_000;
}
