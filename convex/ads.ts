import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";

/** Ads Manager → Campaigns, newest first. */
export const campaigns = viewerQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("adCampaigns")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect(),
});

/** "Create" → objective → a draft campaign with Facebook's default $20 daily budget. */
export const create = viewerMutation({
  args: { objective: v.string() },
  handler: (ctx, { objective }) =>
    ctx.db.insert("adCampaigns", {
      userId: ctx.viewer._id,
      name: `New ${objective} Campaign`,
      objective,
      dailyBudget: 20,
      on: true,
      status: "draft",
      createdAt: Date.now(),
    }),
});

async function own(ctx: MutationCtx, userId: Id<"users">, id: Id<"adCampaigns">) {
  const c = await ctx.db.get(id);
  if (!c || c.userId !== userId) throw new ConvexError("Campaign not found");
  return c;
}

export const setOn = viewerMutation({
  args: { campaignId: v.id("adCampaigns"), on: v.boolean() },
  handler: async (ctx, { campaignId, on }) => {
    await own(ctx, ctx.viewer._id, campaignId);
    await ctx.db.patch(campaignId, { on });
  },
});

/** "Review and publish" → Publish: every draft goes live. */
export const publishDrafts = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const drafts = await ctx.db
      .query("adCampaigns")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .filter((q) => q.eq(q.field("status"), "draft"))
      .collect();
    const now = Date.now();
    for (const d of drafts) await ctx.db.patch(d._id, { status: "published", publishedAt: now });
    return drafts.length;
  },
});
