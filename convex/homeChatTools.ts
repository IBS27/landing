import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx } from "./_generated/server";
import { checkValue } from "./ai/outputSchema";
import { FIND_TOOLS, RECALL_FIND } from "./homeChatFind";
import { MINE_TOOLS, RECALL_MINE } from "./homeChatMine";
import {
  type Found,
  type FoundKind,
  type HomeTool,
  parseKey,
  type Recall,
  type ToolOutput,
  withRelated,
} from "./lib/homeChatThings";

/**
 * The tools Muse has in Landing Home's chat (#154): everything it can look up
 * for the viewer. Reads only: each runs in a query, as the viewer, and what it
 * returns is the `Found` shape in convex/lib/homeChatThings.ts. Searching
 * Landing is in ./homeChatFind.ts; the viewer's own move is in ./homeChatMine.ts.
 */

export const HOME_TOOLS: readonly HomeTool[] = [...FIND_TOOLS, ...MINE_TOOLS];

const BY_NAME = new Map(HOME_TOOLS.map((t) => [t.name, t]));
if (BY_NAME.size !== HOME_TOOLS.length) throw new Error("Home chat tools need unique names");

const RECALL: Record<FoundKind, Recall> = { ...RECALL_FIND, ...RECALL_MINE };

/** Keys read again for one message: what the last few replies showed. */
export const RECALL_MAX = 24;

/** Runs one tool for the viewer. Throws a `ConvexError` Muse can read when the call is wrong. */
export async function runHomeTool(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  name: string,
  args: unknown,
): Promise<ToolOutput> {
  const viewer = await ctx.db.get(viewerId);
  if (!viewer) throw new ConvexError("Unknown viewer");
  const tool = BY_NAME.get(name);
  if (!tool) throw new ConvexError(`There is no tool named ${name}`);
  const { errors } = checkValue(tool.args, args);
  if (errors.length) throw new ConvexError(`Wrong arguments: ${errors.join("; ")}`);
  const out = await tool.run(ctx, viewer, args as Record<string, unknown>);
  // What the things found name (an Event's Group, a Group's posts) may be cited and shown too.
  return { result: out.result, found: withRelated(out.found) };
}

export const run = internalQuery({
  args: { viewerId: v.id("users"), name: v.string(), args: v.any() },
  handler: (ctx, a): Promise<ToolOutput> => runHomeTool(ctx, a.viewerId, a.name, a.args),
});

/**
 * Things read again by key, for the viewer: what earlier replies showed, so a
 * follow-up ("RSVP to the second one") can act on them. What's gone, or what
 * they can no longer see, is left out. The keys come from the browser, so
 * nothing about them is trusted: each is looked up from scratch.
 */
export async function recallFound(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  keys: readonly string[],
): Promise<Found[]> {
  const viewer = await ctx.db.get(viewerId);
  if (!viewer) throw new ConvexError("Unknown viewer");
  const wanted = [...new Set(keys)].slice(0, RECALL_MAX);
  const found = await Promise.all(
    wanted.map(async (key) => {
      const k = parseKey(key);
      if (!k) return null;
      try {
        const f = await RECALL[k.kind](ctx, viewer, k.id);
        return f?.key === key ? f : null;
      } catch {
        // A malformed id: nothing to recall.
        return null;
      }
    }),
  );
  return withRelated(found.filter((f): f is Found => f !== null));
}
