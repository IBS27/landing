import { ConvexError, v } from "convex/values";
import { viewerMutation } from "./lib/functions";
import { pollClosed, pollOf } from "./lib/polls";
import { inConversation } from "./lib/proposals";

/**
 * Vote in a chat poll (#34): the options you pick replace your earlier picks,
 * and picking none takes your vote back. Only the chat's members can vote, and
 * only until the poll closes.
 */
export const vote = viewerMutation({
  args: { messageId: v.id("messages"), optionIds: v.array(v.string()) },
  handler: async (ctx, { messageId, optionIds }) => {
    const m = await ctx.db.get(messageId);
    const poll = m && m.status === "sent" && !m.unsent ? pollOf(m) : null;
    if (!m || !poll || !(await inConversation(ctx, m.conversationId, ctx.viewer._id)))
      throw new ConvexError("Poll not found");
    if (pollClosed(poll, Date.now())) throw new ConvexError("This poll is closed");
    const picked = [...new Set(optionIds)];
    const valid = new Set(poll.options.map((o) => o.id));
    if (picked.some((id) => !valid.has(id))) throw new ConvexError("That option isn't in the poll");

    const row = await ctx.db
      .query("pollVotes")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", messageId).eq("userId", ctx.viewer._id),
      )
      .unique();
    if (picked.length === 0) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { optionIds: picked, updatedAt: now });
    else
      await ctx.db.insert("pollVotes", {
        messageId,
        conversationId: m.conversationId,
        userId: ctx.viewer._id,
        optionIds: picked,
        updatedAt: now,
      });
  },
});
