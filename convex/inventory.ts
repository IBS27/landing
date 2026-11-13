import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { ITEM_CATEGORIES } from "./lib/listings";
import { neighborhoodIdAt } from "./lib/neighborhoods";
import { photoInput, placeFor, resolvePhotos, validate } from "./listings";
import { retire as retireSaleDraft } from "./moveOutSales";
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
    const live = new Map<string, Doc<"listings">["status"]>();
    for (const r of rows) {
      const l = r.saleListingId ? await ctx.db.get(r.saleListingId) : null;
      if (l) live.set(l._id, l.status);
    }
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      price: r.price,
      acquiredAt: r.acquiredAt,
      photos: r.photos,
      source: r.source,
      saleListingId: r.saleListingId && live.has(r.saleListingId) ? r.saleListingId : null,
      saleStatus: (r.saleListingId && live.get(r.saleListingId)) || null,
      saleMinPrice: r.saleMinPrice ?? null,
      saleMuse: r.saleMuse ?? null,
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
    if (!Number.isFinite(a.price) || a.price < 0 || a.price > 1_000_000)
      throw new ConvexError("Enter a valid price");
    if (!Number.isFinite(a.acquiredAt) || a.acquiredAt > Date.now())
      throw new ConvexError("Enter the date you got it");
    const photos = await resolvePhotos(ctx, a.photos);
    if (photos.length > 10) throw new ConvexError("You can add up to 10 photos");
    const now = Date.now();
    return ctx.db.insert("ownedItems", {
      userId: ctx.viewer._id,
      title,
      // To the cent: $49.99 stays $49.99.
      price: Math.round(a.price * 100) / 100,
      acquiredAt: a.acquiredAt,
      photos,
      source: { kind: "manual" },
      createdAt: now,
    });
  },
});

/** Adds photos to an item, so one added without a photo can still be listed (#43). */
export const addPhotos = viewerMutation({
  args: { itemId: v.id("ownedItems"), photos: v.array(photoInput) },
  handler: async (ctx, { itemId, photos }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== ctx.viewer._id) throw new ConvexError("Item not found");
    const added = await resolvePhotos(ctx, photos);
    if (added.length === 0) throw new ConvexError("Add a photo");
    const all = [...new Set([...item.photos, ...added])];
    if (all.length > 10) throw new ConvexError("You can add up to 10 photos");
    await ctx.db.patch(item._id, { photos: all });
  },
});

/**
 * Removes an item. A Marketplace listing still up for it comes down too, with
 * Muse's waiting replies to its buyers; a sold one stays as the record of the sale.
 */
export const remove = viewerMutation({
  args: { itemId: v.id("ownedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== ctx.viewer._id) throw new ConvexError("Item not found");
    const listing = item.saleListingId ? await ctx.db.get(item.saleListingId) : null;
    if (listing && listing.sellerId === item.userId && listing.status !== "sold") {
      const listingId = listing._id;
      const chats = await ctx.db
        .query("conversations")
        .withIndex("by_listing", (q) => q.eq("listingId", listingId))
        .collect();
      for (const c of chats) {
        const row = await ctx.db
          .query("saleChats")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .unique();
        if (!row) continue;
        await retireSaleDraft(ctx, row);
        await ctx.db.delete(row._id);
      }
      // As `listings.remove`: saves of a deleted listing go with it.
      const saves = await ctx.db
        .query("saved")
        .withIndex("by_ref", (q) => q.eq("kind", "listing").eq("refId", listingId))
        .collect();
      for (const s of saves) await ctx.db.delete(s._id);
      await ctx.db.delete(listingId);
    }
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
        /** Lowest price Muse may accept from buyers (#44); unset = Muse doesn't reply. */
        minPrice: v.optional(v.number()),
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
      const min = it.minPrice === undefined ? undefined : Math.round(it.minPrice);
      if (min !== undefined && (min < 1 || min > Math.round(it.price)))
        throw new ConvexError(
          `Lowest price for ${it.title} must be at least $1 and no more than the price`,
        );
      await ctx.db.patch(item._id, {
        saleListingId: listingId,
        ...(min !== undefined
          ? { saleMinPrice: min, saleMuse: "active" as const, saleTermsAt: now }
          : {}),
      });
      created.push(listingId);
    }
    return created;
  },
});
