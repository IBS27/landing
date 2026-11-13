import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { afterSaleAgreed } from "../moveOutSales";

/**
 * Owned items (#27). Marketplace has no record of who bought a listing, so the
 * reliable purchase signal is a deal the buyer agreed through Muse (#36): when
 * they approve Muse's acceptance, the item is added with the agreed price.
 */

/** Adds a Marketplace purchase once per user and listing; returns the item. */
export async function addPurchase(
  ctx: MutationCtx,
  a: {
    userId: Id<"users">;
    listing: Doc<"listings">;
    conversationId: Id<"conversations">;
    price: number;
    at: number;
  },
): Promise<Id<"ownedItems">> {
  const existing = await ctx.db
    .query("ownedItems")
    .withIndex("by_user_listing", (q) =>
      q.eq("userId", a.userId).eq("source.listingId", a.listing._id),
    )
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("ownedItems", {
    userId: a.userId,
    title: a.listing.title,
    price: Math.round(a.price),
    acquiredAt: a.at,
    photos: a.listing.photos.slice(0, 10),
    source: { kind: "marketplace", listingId: a.listing._id, conversationId: a.conversationId },
    createdAt: a.at,
  });
}

/**
 * Called after the owner approves a proposal. When it was Muse's acceptance in
 * the owner's own negotiation as a buyer, the item joins their inventory.
 */
export async function afterProposalApproved(ctx: MutationCtx, p: Doc<"proposals">, at: number) {
  if (p.payload.kind !== "offer") return;
  // A seller's agreed move-out sale takes the item off the table for other buyers (#44).
  await afterSaleAgreed(ctx, p);
  const payload = p.payload;
  const n = await ctx.db
    .query("negotiations")
    .withIndex("by_conversation", (q) => q.eq("conversationId", payload.conversationId))
    .first();
  if (!n || n.buyerId !== p.ownerId || n.pendingProposalId !== p._id || n.lastMove !== "accept")
    return;
  const listing = await ctx.db.get(payload.listingId);
  if (!listing) return;
  await addPurchase(ctx, {
    userId: p.ownerId,
    listing,
    conversationId: payload.conversationId,
    price: payload.amount,
    at,
  });
}
