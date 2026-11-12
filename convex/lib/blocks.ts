import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** True when `a` has blocked `b`. */
export async function hasBlocked(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const row = await ctx.db
    .query("blocks")
    .withIndex("by_pair", (q) => q.eq("userId", a).eq("blockedId", b))
    .first();
  return row !== null;
}

/** True when either user has blocked the other. */
export async function isBlockedEitherWay(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  if (a === b) return false;
  const [ab, ba] = await Promise.all([hasBlocked(ctx, a, b), hasBlocked(ctx, b, a)]);
  return ab || ba;
}

/** Everyone hidden from `userId`: people they blocked and people who blocked them. */
export async function blockedSet(ctx: QueryCtx, userId: Id<"users">) {
  const [mine, theirs] = await Promise.all([
    ctx.db
      .query("blocks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("blocks")
      .withIndex("by_blocked", (q) => q.eq("blockedId", userId))
      .collect(),
  ]);
  return new Set<Id<"users">>([...mine.map((r) => r.blockedId), ...theirs.map((r) => r.userId)]);
}

/**
 * Why the viewer can't write in a 1:1 thread (DM or Marketplace), or null.
 * Group chats stay open, like Facebook.
 */
export async function dmBlockNotice(
  ctx: QueryCtx,
  conv: Doc<"conversations">,
  viewerId: Id<"users">,
): Promise<string | null> {
  if (conv.kind === "group") return null;
  const otherId = conv.memberIds.find((id) => id !== viewerId);
  if (!otherId) return null;
  if (await hasBlocked(ctx, viewerId, otherId)) {
    const other = await ctx.db.get(otherId);
    return `You blocked ${other?.firstName ?? "this person"}. Unblock them in Settings & privacy to send a message.`;
  }
  if (await hasBlocked(ctx, otherId, viewerId)) return "This person isn't available right now.";
  return null;
}
