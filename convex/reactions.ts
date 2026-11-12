import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { getSummaries } from "./lib/users";
import { type ReactionType, reactionTarget, reactionType } from "./validators";

type Target = "post" | "comment" | "message";

/** Count, the top three reaction types (by frequency) and the viewer's own reaction. */
export async function reactionSummary(
  ctx: QueryCtx,
  targetType: Target,
  targetId: string,
  viewerId: Id<"users">,
) {
  const rows = await ctx.db
    .query("reactions")
    .withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", targetId))
    .collect();
  const counts = new Map<ReactionType, number>();
  let viewerReaction: ReactionType | null = null;
  for (const r of rows) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    if (r.userId === viewerId) viewerReaction = r.type;
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  // A name to show in "You and 23 others"-style summaries.
  const friendNameSource = rows.find((r) => r.userId !== viewerId)?.userId;
  return { count: rows.length, top, viewerReaction, sampleUserId: friendNameSource ?? null };
}

async function adjustCount(ctx: MutationCtx, targetType: Target, targetId: string, delta: number) {
  if (targetType === "post") {
    const post = await ctx.db.get(targetId as Id<"posts">);
    if (post)
      await ctx.db.patch(post._id, { reactionCount: Math.max(0, post.reactionCount + delta) });
  } else if (targetType === "comment") {
    const c = await ctx.db.get(targetId as Id<"comments">);
    if (c) await ctx.db.patch(c._id, { reactionCount: Math.max(0, c.reactionCount + delta) });
  }
}

/** Set, change, or (when `type` is null or unchanged) remove the viewer's reaction. */
export const react = viewerMutation({
  args: { targetType: reactionTarget, targetId: v.string(), type: v.union(reactionType, v.null()) },
  handler: async (ctx, { targetType, targetId, type }) => {
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_target_user", (q) =>
        q.eq("targetType", targetType).eq("targetId", targetId).eq("userId", ctx.viewer._id),
      )
      .unique();
    if (existing && (type === null || existing.type === type)) {
      await ctx.db.delete(existing._id);
      await adjustCount(ctx, targetType, targetId, -1);
      return null;
    }
    if (type === null) return null;
    if (existing) {
      await ctx.db.patch(existing._id, { type });
      return type;
    }
    await ctx.db.insert("reactions", {
      targetType,
      targetId,
      userId: ctx.viewer._id,
      type,
      createdAt: Date.now(),
    });
    await adjustCount(ctx, targetType, targetId, 1);
    if (targetType === "post") {
      const post = await ctx.db.get(targetId as Id<"posts">);
      if (post)
        await notify(ctx, {
          userId: post.authorId,
          actorId: ctx.viewer._id,
          kind: "reaction",
          text: `reacted to your post${post.text ? `: "${post.text.slice(0, 60)}"` : "."}`,
          postId: post._id,
          groupId: post.groupId,
        });
    } else if (targetType === "comment") {
      const c = await ctx.db.get(targetId as Id<"comments">);
      if (c)
        await notify(ctx, {
          userId: c.authorId,
          actorId: ctx.viewer._id,
          kind: "reaction",
          text: `reacted to your comment: "${c.text.slice(0, 60)}"`,
          postId: c.postId,
          commentId: c._id,
        });
    }
    return type;
  },
});

/** Everyone who reacted, grouped by type, for the reactions dialog. */
export const list = viewerQuery({
  args: { targetType: reactionTarget, targetId: v.string() },
  handler: async (ctx, { targetType, targetId }) => {
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", targetId))
      .collect();
    const users = await getSummaries(
      ctx,
      rows.map((r) => r.userId),
    );
    return rows
      .map((r) => ({ type: r.type, user: users.get(r.userId) }))
      .filter((r) => r.user !== undefined);
  },
});
