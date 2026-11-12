import { viewerQuery } from "../lib/functions";

/** The global switch: AI runs only with an API key set and `AI_ENABLED` not "false". */
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_ENABLED !== "false";
}

/**
 * Whether AI features are on (an API key is set and the `AI_ENABLED` kill
 * switch isn't "false"). The UI can use it to label results; every feature
 * works either way through its fallback.
 */
export const get = viewerQuery({
  args: {},
  handler: () => ({ enabled: aiEnabled() }),
});
