import { ConvexError, v } from "convex/values";
import { viewerMutation } from "./lib/functions";

/** "Report post" / "Report" message: one row per viewer and item (a new reason replaces the old). */
export const create = viewerMutation({
  args: {
    targetType: v.union(v.literal("post"), v.literal("message")),
    targetId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { targetType, targetId, reason }) => {
    const id =
      targetType === "post"
        ? ctx.db.normalizeId("posts", targetId)
        : ctx.db.normalizeId("messages", targetId);
    if (!id || !(await ctx.db.get(id))) throw new ConvexError("This content isn't available");
    const userId = ctx.viewer._id;
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", userId).eq("targetType", targetType).eq("targetId", targetId),
      )
      .first();
    if (existing) await ctx.db.patch(existing._id, { reason, createdAt: Date.now() });
    else
      await ctx.db.insert("reports", {
        userId,
        targetType,
        targetId,
        reason,
        createdAt: Date.now(),
      });
  },
});
