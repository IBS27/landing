import { ConvexError, v } from "convex/values";
import { viewerMutation } from "./lib/functions";
import { PROBLEM_AREAS } from "./lib/reports";

const TABLE = { post: "posts", message: "messages", listing: "listings" } as const;

/**
 * "Report post" / "Report" message / "Report listing": one row per viewer and
 * item (a new reason replaces the old).
 */
export const create = viewerMutation({
  args: {
    targetType: v.union(v.literal("post"), v.literal("message"), v.literal("listing")),
    targetId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { targetType, targetId, reason }) => {
    if (!reason.trim()) throw new ConvexError("Choose a reason");
    const id = ctx.db.normalizeId(TABLE[targetType], targetId);
    const target = id ? await ctx.db.get(id) : null;
    if (!target) throw new ConvexError("This content isn't available");
    const userId = ctx.viewer._id;
    if (targetType === "listing" && "sellerId" in target && target.sellerId === userId)
      throw new ConvexError("You can't report your own listing");
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

/** "Report a problem": every submission is kept, with the area, details and screenshot choice. */
export const problem = viewerMutation({
  args: {
    kind: v.union(v.literal("Something went wrong"), v.literal("Help us improve Facebook")),
    area: v.string(),
    details: v.string(),
    screenshot: v.boolean(),
  },
  handler: async (ctx, { kind, area, details, screenshot }) => {
    const text = details.trim();
    if (!(PROBLEM_AREAS as readonly string[]).includes(area))
      throw new ConvexError("Choose an area");
    if (!text) throw new ConvexError("Add some details");
    if (text.length > 5000) throw new ConvexError("Keep details under 5,000 characters");
    await ctx.db.insert("reports", {
      userId: ctx.viewer._id,
      targetType: "problem",
      targetId: area,
      reason: kind,
      details: text,
      screenshot,
      createdAt: Date.now(),
    });
  },
});
