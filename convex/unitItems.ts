import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { resolveSources } from "./lib/citations";
import { viewerQuery } from "./lib/functions";
import { loadAudience } from "./lib/posts";
import { roomMatches } from "./rooms";
import { ownScene } from "./unitScenes";

/**
 * Shopping → 3D (#131): what the owner can place in a unit, and where their
 * items are already placed. Everything here is private to the unit's owner.
 */

/** Read bounds: owned items listed, saved rows scanned, saved listings shown, units read. */
export const OWNED_MAX = 60;
const SAVED_SCAN = 100;
export const SAVED_MAX = 30;
export const UNITS_MAX = 12;

export const pickerGroup = v.union(
  v.literal("yours"),
  v.literal("matches"),
  v.literal("saved"),
  v.literal("marketplace"),
);
export const pickerEntry = v.object({
  /** `owned:<id>` or `listing:<id>`. */
  key: v.string(),
  group: pickerGroup,
  ownedItemId: v.optional(v.id("ownedItems")),
  listingId: v.optional(v.id("listings")),
  /** For an owned Marketplace purchase: the listing it was bought from, so earlier placements match. */
  fromListingId: v.optional(v.id("listings")),
  title: v.string(),
  photo: v.union(v.string(), v.null()),
  price: v.number(),
  /** An owned item's move-out sale listing status (#43), or null when it isn't listed. */
  sale: v.union(v.literal("active"), v.literal("pending"), v.literal("sold"), v.null()),
});
export type PickerEntry = Infer<typeof pickerEntry>;

async function ownsListing(ctx: QueryCtx, userId: Id<"users">, listingId: Id<"listings">) {
  return !!(await ctx.db
    .query("ownedItems")
    .withIndex("by_user_listing", (q) => q.eq("userId", userId).eq("source.listingId", listingId))
    .first());
}

/**
 * Picker entries for a unit, in order: the owner's items ("Yours"), the unit
 * room's vibe matches, then saved listings. A listing the owner already bought
 * shows only as theirs. `pick` (from a "Place in my room" link) is included
 * when the owner may use it, and silently left out otherwise.
 */
export const picker = viewerQuery({
  args: {
    id: v.id("unitScenes"),
    pick: v.optional(
      v.object({
        ownedItemId: v.optional(v.id("ownedItems")),
        listingId: v.optional(v.id("listings")),
      }),
    ),
  },
  returns: v.object({
    entries: v.array(pickerEntry),
    /** The entry for `pick`, or null when the owner can't place it. */
    picked: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { id, pick }) => {
    const viewerId = ctx.viewer._id;
    const unit = await ownScene(ctx, id, viewerId);
    const out: PickerEntry[] = [];
    const seen = new Set<string>();

    const owned = await ctx.db
      .query("ownedItems")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(OWNED_MAX);
    // A picked listing the owner already bought is picked as their item.
    const pickedItem = pick?.ownedItemId
      ? await ctx.db.get(pick.ownedItemId)
      : pick?.listingId
        ? await ctx.db
            .query("ownedItems")
            .withIndex("by_user_listing", (q) =>
              q.eq("userId", viewerId).eq("source.listingId", pick.listingId),
            )
            .first()
        : null;
    const ownPick = pickedItem?.userId === viewerId ? pickedItem : null;
    if (ownPick && !owned.some((o) => o._id === ownPick._id)) owned.unshift(ownPick);
    for (const item of owned) {
      seen.add(item._id);
      if (item.source.kind === "marketplace") seen.add(item.source.listingId);
      out.push({
        key: `owned:${item._id}`,
        group: "yours",
        ownedItemId: item._id,
        ...(item.source.kind === "marketplace" ? { fromListingId: item.source.listingId } : {}),
        title: item.title,
        photo: item.photos[0] ?? null,
        price: item.price,
        sale: item.saleListingId ? ((await ctx.db.get(item.saleListingId))?.status ?? null) : null,
      });
    }

    /** True the first time a listing comes up that the owner doesn't already own. */
    const fresh = async (l: Id<"listings">) => {
      if (seen.has(l) || (await ownsListing(ctx, viewerId, l))) return false;
      seen.add(l);
      return true;
    };

    const room = unit.roomId ? await ctx.db.get(unit.roomId) : null;
    for (const m of room ? await roomMatches(ctx, room) : [])
      if (await fresh(m._id))
        out.push({
          key: `listing:${m._id}`,
          group: "matches",
          listingId: m._id,
          title: m.title,
          photo: m.photo,
          price: m.price,
          sale: null,
        });

    // Saved listings and the picked one: visible to the owner, not rentals.
    const savedRows = await ctx.db
      .query("saved")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(SAVED_SCAN);
    const refs: { id: Id<"listings">; group: "saved" | "marketplace" }[] = [];
    if (pick?.listingId) refs.push({ id: pick.listingId, group: "marketplace" });
    for (const r of savedRows) {
      const lid = r.kind === "listing" ? ctx.db.normalizeId("listings", r.refId) : null;
      if (!lid) continue;
      if (lid === pick?.listingId) refs[0].group = "saved";
      else if (refs.length <= SAVED_MAX) refs.push({ id: lid, group: "saved" });
    }
    const docs: Doc<"listings">[] = [];
    const groups = new Map<string, "saved" | "marketplace">();
    for (const r of refs) {
      const doc = await ctx.db.get(r.id);
      if (doc && !doc.rental && (await fresh(doc._id))) {
        docs.push(doc);
        groups.set(doc._id, r.group);
      }
    }
    const visible = await resolveSources(
      ctx,
      docs.map((d) => ({ kind: "listing" as const, listingId: d._id })),
      await loadAudience(ctx, viewerId),
    );
    const extra: PickerEntry[] = [];
    for (const s of visible) {
      if (s.kind !== "listing") continue;
      const group = groups.get(s.listingId) ?? "saved";
      (group === "marketplace" ? extra : out).push({
        key: `listing:${s.listingId}`,
        group,
        listingId: s.listingId,
        title: s.title,
        photo: s.image,
        price: s.price,
        sale: null,
      });
    }
    // A picked listing that is neither a match nor saved follows the owner's items.
    const yours = out.filter((e) => e.group === "yours").length;
    out.splice(yours, 0, ...extra);
    const picked = ownPick
      ? `owned:${ownPick._id}`
      : pick?.listingId && out.some((e) => e.listingId === pick.listingId)
        ? `listing:${pick.listingId}`
        : null;
    return { entries: out, picked };
  },
});

/**
 * Where the owner's items are placed: per unit (newest first, bounded), its
 * room and the listings and owned items placed in it. With `roomId`, only that
 * room's unit.
 */
export const placed = viewerQuery({
  args: { roomId: v.optional(v.id("rooms")) },
  returns: v.array(
    v.object({
      unitId: v.id("unitScenes"),
      roomId: v.union(v.id("rooms"), v.null()),
      listingIds: v.array(v.id("listings")),
      ownedItemIds: v.array(v.id("ownedItems")),
    }),
  ),
  handler: async (ctx, { roomId }) => {
    const ownerId = ctx.viewer._id;
    const units = roomId
      ? await ctx.db
          .query("unitScenes")
          .withIndex("by_owner_room", (q) => q.eq("ownerId", ownerId).eq("roomId", roomId))
          .take(1)
      : await ctx.db
          .query("unitScenes")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .order("desc")
          .take(UNITS_MAX);
    return units.map((u) => ({
      unitId: u._id,
      roomId: u.roomId ?? null,
      listingIds: u.placements.flatMap((p) => (p.listingId ? [p.listingId] : [])),
      ownedItemIds: u.placements.flatMap((p) => (p.ownedItemId ? [p.ownedItemId] : [])),
    }));
  },
});

/** The owner's existing unit for a room, or null when it hasn't been opened in 3D yet. */
export const unitForRoom = viewerQuery({
  args: { roomId: v.id("rooms") },
  returns: v.union(v.id("unitScenes"), v.null()),
  handler: async (ctx, { roomId }) => {
    const ownerId = ctx.viewer._id;
    const room = await ctx.db.get(roomId);
    if (!room || room.userId !== ownerId) throw new ConvexError("Room not found");
    const unit = await ctx.db
      .query("unitScenes")
      .withIndex("by_owner_room", (q) => q.eq("ownerId", ownerId).eq("roomId", roomId))
      .first();
    return unit?._id ?? null;
  },
});
