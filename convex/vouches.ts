import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getSummary } from "./lib/users";
import { listerNetwork, removeVouch, saveVouch, vouchBy } from "./lib/vouches";
import { vouchRelationship } from "./validators";

/**
 * Landing network vouching (see convex/lib/vouches.ts): who in the viewer's
 * network knows a lister, and the viewer's own vouch for them.
 */

/** The lister's connection to the viewer's network. Null when the listing or lister is gone, or they're blocked. */
export const forListing = viewerQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) return null;
    const viewerId = ctx.viewer._id;
    const [lister, network, mine] = await Promise.all([
      getSummary(ctx, listing.sellerId),
      listerNetwork(ctx, viewerId, listing.sellerId),
      vouchBy(ctx, viewerId, listing.sellerId),
    ]);
    if (!lister || !network) return null;
    return {
      lister,
      ...network,
      viewerVouch: mine ? { relationship: mine.relationship, note: mine.note ?? null } : null,
      canVouch: lister._id !== viewerId,
    };
  },
});

/** Vouch for someone you know, or change how you vouched. */
export const vouch = viewerMutation({
  args: {
    userId: v.id("users"),
    relationship: vouchRelationship,
    note: v.optional(v.string()),
  },
  handler: async (ctx, { userId, relationship, note }) => {
    await saveVouch(ctx, ctx.viewer, userId, { relationship, note });
  },
});

/** Withdraw your vouch. */
export const unvouch = viewerMutation({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => removeVouch(ctx, ctx.viewer._id, userId),
});
