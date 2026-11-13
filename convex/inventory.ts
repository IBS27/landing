import { ConvexError, v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { photoInput, resolvePhotos } from "./listings";

/**
 * Owned items (#27): everything the viewer gets, with price, date and photos,
 * tracked for resale at move-out. Purchases agreed through Muse are added by
 * `afterProposalApproved` (convex/lib/inventory.ts); the rest are added here.
 */

/** The viewer's items, newest first. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("ownedItems")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      price: r.price,
      acquiredAt: r.acquiredAt,
      photos: r.photos,
      source: r.source,
    }));
  },
});

/** Adds something the viewer already owns. */
export const add = viewerMutation({
  args: {
    title: v.string(),
    price: v.number(),
    acquiredAt: v.number(),
    photos: v.array(photoInput),
  },
  handler: async (ctx, a) => {
    const title = a.title.trim();
    if (!title) throw new ConvexError("Name the item");
    if (title.length > 100) throw new ConvexError("Names can be up to 100 characters");
    if (!Number.isFinite(a.price) || a.price < 0) throw new ConvexError("Enter a valid price");
    if (!Number.isFinite(a.acquiredAt) || a.acquiredAt > Date.now())
      throw new ConvexError("Enter the date you got it");
    const photos = await resolvePhotos(ctx, a.photos);
    if (photos.length > 10) throw new ConvexError("You can add up to 10 photos");
    const now = Date.now();
    return ctx.db.insert("ownedItems", {
      userId: ctx.viewer._id,
      title,
      price: Math.round(a.price),
      acquiredAt: a.acquiredAt,
      photos,
      source: { kind: "manual" },
      createdAt: now,
    });
  },
});

export const remove = viewerMutation({
  args: { itemId: v.id("ownedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== ctx.viewer._id) throw new ConvexError("Item not found");
    await ctx.db.delete(itemId);
  },
});
