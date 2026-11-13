import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { ITEM_CATEGORIES } from "./lib/listings";
import { neighborhoodIdAt } from "./lib/neighborhoods";
import { photoInput, placeFor, resolvePhotos, validate } from "./listings";
import { listingCategory } from "./validators";

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
    // A sale listing that was deleted no longer counts as listed.
    const live = new Set<string>();
    for (const r of rows)
      if (r.saleListingId && (await ctx.db.get(r.saleListingId))) live.add(r.saleListingId);
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      price: r.price,
      acquiredAt: r.acquiredAt,
      photos: r.photos,
      source: r.source,
      saleListingId: r.saleListingId && live.has(r.saleListingId) ? r.saleListingId : null,
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

/**
 * Pre-filled listing drafts for the chosen items (#43): title, photos, the
 * price paid, and the original listing's category for Marketplace purchases.
 */
export const saleDrafts = viewerQuery({
  args: { itemIds: v.array(v.id("ownedItems")) },
  handler: async (ctx, { itemIds }) => {
    const out = [];
    for (const id of itemIds) {
      const item = await ctx.db.get(id);
      if (!item || item.userId !== ctx.viewer._id) continue;
      if (item.saleListingId && (await ctx.db.get(item.saleListingId))) continue;
      const bought =
        item.source.kind === "marketplace" ? await ctx.db.get(item.source.listingId) : null;
      const category =
        bought && ITEM_CATEGORIES.some((c) => c.value === bought.category)
          ? bought.category
          : "household";
      out.push({
        itemId: item._id,
        title: item.title,
        price: item.price,
        photos: item.photos,
        category,
        neighborhood: bought?.location.neighborhood ?? null,
      });
    }
    return out;
  },
});

/** Creates a Marketplace listing for each chosen item and links it back to the item. */
export const listForSale = viewerMutation({
  args: {
    items: v.array(
      v.object({
        itemId: v.id("ownedItems"),
        title: v.string(),
        price: v.number(),
        category: listingCategory,
      }),
    ),
    neighborhood: v.string(),
  },
  handler: async (ctx, { items, neighborhood }) => {
    if (items.length === 0) throw new ConvexError("Pick something to sell");
    if (items.length > 20) throw new ConvexError("List up to 20 items at a time");
    const location = placeFor(neighborhood);
    const neighborhoodId = await neighborhoodIdAt(ctx, location);
    const now = Date.now();
    const created: Id<"listings">[] = [];
    for (const it of items) {
      const item = await ctx.db.get(it.itemId);
      if (!item || item.userId !== ctx.viewer._id) throw new ConvexError("Item not found");
      if (item.saleListingId && (await ctx.db.get(item.saleListingId)))
        throw new ConvexError(`${item.title} is already listed`);
      if (!ITEM_CATEGORIES.some((c) => c.value === it.category))
        throw new ConvexError("Choose a category");
      const photos = await resolvePhotos(
        ctx,
        item.photos.map((url) => ({ url })),
      );
      const description = `Selling as I move out. Got it ${new Date(item.acquiredAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`;
      if (photos.length === 0) throw new ConvexError(`Add a photo of ${item.title} first`);
      validate({ title: it.title, price: it.price, description }, photos.length);
      const listingId = await ctx.db.insert("listings", {
        sellerId: ctx.viewer._id,
        title: it.title.trim(),
        price: Math.round(it.price),
        category: it.category,
        description,
        photos,
        location,
        neighborhoodId,
        status: "active",
        badges: [],
        createdAt: now,
        updatedAt: now,
        viewCount: 0,
      });
      await ctx.db.patch(item._id, { saleListingId: listingId });
      created.push(listingId);
    }
    return created;
  },
});
