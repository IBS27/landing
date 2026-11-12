import { v } from "convex/values";
import { viewerMutation } from "./lib/functions";

/**
 * Minimal DM lookup used by the Home Contacts list to open a chat window.
 * The Messenger feature owns the rest of conversations and may extend this.
 */
export const getOrCreateDm = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const mine = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect();
    for (const m of mine) {
      const c = await ctx.db.get(m.conversationId);
      if (c?.kind === "dm" && c.memberIds.length === 2 && c.memberIds.includes(userId))
        return c._id;
    }
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      kind: "dm",
      memberIds: [viewerId, userId],
      createdAt: now,
      lastMessageAt: now,
    });
    for (const id of [viewerId, userId])
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: id,
        lastReadAt: now,
        lastMessageAt: now,
      });
    return conversationId;
  },
});
