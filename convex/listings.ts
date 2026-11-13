import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  type CategoryMeta,
  categoryBySlug,
  categoryFor,
  distanceTo,
  type ListingCard,
  matchesPropertyType,
  NEIGHBORHOODS,
  type Near,
  sellerRating,
  toCard,
  withinRadius,
} from "./lib/listings";
import { afterChatMessage } from "./lib/negotiations";
import { neighborhoodIdAt } from "./lib/neighborhoods";
import { notify } from "./lib/notify";
import { isSaved } from "./lib/posts";
import { badgesAfterEdit } from "./lib/trust";
import { getSummaries, getSummary, type UserSummary } from "./lib/users";
import {
  listingCategory,
  listingCondition,
  media,
  rentalDetails,
  vehicleDetails,
} from "./validators";

const DAY = 24 * 60 * 60 * 1000;

/* ───────────────────────── Validators ───────────────────────── */

const near = v.object({ lat: v.number(), lng: v.number(), radiusMi: v.number() });

export const sortOrder = v.union(
  v.literal("recommended"),
  v.literal("price_asc"),
  v.literal("price_desc"),
  v.literal("distance_asc"),
  v.literal("distance_desc"),
  v.literal("newest"),
);
export type SortOrder = Infer<typeof sortOrder>;

const propertyType = v.union(
  v.literal("apartment"),
  v.literal("house"),
  v.literal("room"),
  v.literal("townhouse"),
  v.literal("studio"),
  v.literal("condo"),
);

export const browseFilters = v.object({
  minPrice: v.optional(v.number()),
  maxPrice: v.optional(v.number()),
  conditions: v.optional(v.array(listingCondition)),
  daysSinceListed: v.optional(v.number()),
  availability: v.optional(v.union(v.literal("available"), v.literal("sold"))),
  // Vehicles
  make: v.optional(v.string()),
  model: v.optional(v.string()),
  minYear: v.optional(v.number()),
  maxYear: v.optional(v.number()),
  minMileage: v.optional(v.number()),
  maxMileage: v.optional(v.number()),
  vehicleType: v.optional(v.string()),
  bodyStyle: v.optional(v.string()),
  transmission: v.optional(v.string()),
  // Property rentals / sales
  propertyType: v.optional(propertyType),
  minBedrooms: v.optional(v.number()),
  minBathrooms: v.optional(v.number()),
  minSqft: v.optional(v.number()),
  maxSqft: v.optional(v.number()),
  privateRoomOnly: v.optional(v.boolean()),
  individualsOnly: v.optional(v.boolean()),
});
export type BrowseFilters = Infer<typeof browseFilters>;

export const photoInput = v.union(
  v.object({ url: v.string() }),
  v.object({ storageId: v.id("_storage") }),
);
const meetup = v.array(
  v.union(v.literal("public"), v.literal("door_pickup"), v.literal("door_dropoff")),
);

const listingFields = {
  title: v.string(),
  price: v.number(),
  category: listingCategory,
  condition: v.optional(listingCondition),
  brand: v.optional(v.string()),
  description: v.string(),
  photos: v.array(photoInput),
  /** "Add video": one uploaded clip (served URL), shown first in the item gallery. */
  video: v.optional(media),
  /** A name from NEIGHBORHOODS. */
  neighborhood: v.string(),
  rental: v.optional(rentalDetails),
  vehicle: v.optional(vehicleDetails),
  meetup: v.optional(meetup),
  groupIds: v.optional(v.array(v.id("groups"))),
};

/* ───────────────────────── Browse / search ───────────────────────── */

function eqi(a: string | undefined, b: string) {
  return a !== undefined && a.toLowerCase() === b.toLowerCase();
}

function matches(
  l: Doc<"listings">,
  meta: CategoryMeta | null,
  f: BrowseFilters,
  nearBy: Near | undefined,
  now: number,
) {
  const status = f.availability === "sold" ? "sold" : "active";
  if (l.status !== status) return false;
  if (meta && !meta.categories.includes(l.category) && !(meta.includeFree && l.price === 0))
    return false;
  if (f.minPrice !== undefined && l.price < f.minPrice) return false;
  if (f.maxPrice !== undefined && l.price > f.maxPrice) return false;
  if (f.conditions?.length && (!l.condition || !f.conditions.includes(l.condition))) return false;
  if (f.daysSinceListed !== undefined && now - l.createdAt > f.daysSinceListed * DAY) return false;
  if (!withinRadius(l, nearBy)) return false;
  const vf = [f.make, f.model, f.minYear, f.maxYear, f.minMileage, f.maxMileage, f.vehicleType];
  if (vf.some((x) => x !== undefined) || f.bodyStyle || f.transmission) {
    const veh = l.vehicle;
    if (!veh) return false;
    if (f.make && !eqi(veh.make, f.make)) return false;
    if (f.model && !eqi(veh.model, f.model)) return false;
    if (f.minYear !== undefined && veh.year < f.minYear) return false;
    if (f.maxYear !== undefined && veh.year > f.maxYear) return false;
    if (f.minMileage !== undefined && (veh.mileage ?? 0) < f.minMileage) return false;
    if (f.maxMileage !== undefined && (veh.mileage ?? 0) > f.maxMileage) return false;
    if (f.vehicleType && !eqi(veh.vehicleType, f.vehicleType)) return false;
    if (f.bodyStyle && !eqi(veh.bodyStyle, f.bodyStyle)) return false;
    if (f.transmission && !eqi(veh.transmission, f.transmission)) return false;
  }
  const rf = [f.propertyType, f.minBedrooms, f.minBathrooms, f.minSqft, f.maxSqft];
  if (rf.some((x) => x !== undefined) || f.privateRoomOnly) {
    const r = l.rental;
    if (!r) return false;
    if (f.propertyType && !matchesPropertyType(r.propertyType, f.propertyType)) return false;
    if (f.privateRoomOnly && r.propertyType !== "room") return false;
    if (f.minBedrooms !== undefined && r.bedrooms < f.minBedrooms) return false;
    if (f.minBathrooms !== undefined && r.bathrooms < f.minBathrooms) return false;
    if (f.minSqft !== undefined && (r.sqft ?? 0) < f.minSqft) return false;
    if (f.maxSqft !== undefined && (r.sqft ?? Number.POSITIVE_INFINITY) > f.maxSqft) return false;
  }
  return true;
}

/**
 * "Recommended" ranking: recent listings first, but each listing carries a
 * stable per-listing offset of up to three days, so the grid mixes fresh and
 * slightly older items the way Facebook's picks do instead of reading as a
 * strict newest-first list. Keyed on the title, so it is stable across
 * reloads, pages and reseeds.
 */
function recommendScore(l: Doc<"listings">) {
  let h = 2166136261;
  for (let i = 0; i < l.title.length; i++) h = Math.imul(h ^ l.title.charCodeAt(i), 16777619);
  return l.createdAt - ((h >>> 0) / 0xffffffff) * 3 * DAY;
}

function sortListings(rows: Doc<"listings">[], sort: SortOrder, nearBy: Near | undefined) {
  const dist = (l: Doc<"listings">) => distanceTo(l, nearBy) ?? 0;
  const by: Record<SortOrder, (a: Doc<"listings">, b: Doc<"listings">) => number> = {
    recommended: (a, b) => recommendScore(b) - recommendScore(a),
    newest: (a, b) => b.createdAt - a.createdAt,
    price_asc: (a, b) => a.price - b.price || b.createdAt - a.createdAt,
    price_desc: (a, b) => b.price - a.price || b.createdAt - a.createdAt,
    distance_asc: (a, b) => dist(a) - dist(b),
    distance_desc: (a, b) => dist(b) - dist(a),
  };
  return [...rows].sort(by[sort]);
}

/** Sellers that are Pages (businesses), for "Listings from individuals only". */
async function pageSellers(ctx: QueryCtx, rows: Doc<"listings">[]) {
  const map = await getSummaries(
    ctx,
    rows.map((r) => r.sellerId),
  );
  return new Set([...map.values()].filter((u) => u.kind === "page").map((u) => u._id));
}

export const MAX_SCAN = 2000;

/**
 * Today's picks, category pages and search: one query with filters, sort and a
 * growing `limit` (the grid loads more as it scrolls).
 */
export const browse = viewerQuery({
  args: {
    category: v.optional(v.string()),
    q: v.optional(v.string()),
    filters: v.optional(browseFilters),
    sort: v.optional(sortOrder),
    near: v.optional(near),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const meta = args.category ? categoryBySlug(args.category) : null;
    if (args.category && !meta) return { items: [] as ListingCard[], hasMore: false };
    const f = args.filters ?? {};
    const sort = args.sort ?? "recommended";
    const limit = Math.max(1, Math.min(args.limit, 240));
    const now = Date.now();
    const accept = (l: Doc<"listings">) => matches(l, meta, f, args.near, now);
    const single = meta && meta.categories.length === 1 && !meta.includeFree;
    const q = args.q?.trim();

    let rows: Doc<"listings">[];
    if (q) {
      rows = await ctx.db
        .query("listings")
        .withSearchIndex("search_title", (s) =>
          s.search("title", q).eq("status", f.availability === "sold" ? "sold" : "active"),
        )
        .take(256);
      rows = rows.filter(accept);
      if (sort !== "recommended") rows = sortListings(rows, sort, args.near);
    } else if (sort === "newest") {
      // Newest first straight off the index; stop as soon as the page is full.
      const source = single
        ? ctx.db
            .query("listings")
            .withIndex("by_category", (x) => x.eq("category", meta.categories[0]))
            .order("desc")
        : ctx.db.query("listings").withIndex("by_created").order("desc");
      rows = [];
      let scanned = 0;
      for await (const l of source) {
        if (++scanned > MAX_SCAN) break;
        if (!accept(l)) continue;
        rows.push(l);
        if (rows.length > limit && !f.individualsOnly) break;
      }
    } else {
      const all = single
        ? await ctx.db
            .query("listings")
            .withIndex("by_category", (x) => x.eq("category", meta.categories[0]))
            .order("desc")
            .take(MAX_SCAN)
        : await ctx.db.query("listings").withIndex("by_created").order("desc").take(MAX_SCAN);
      rows = sortListings(all.filter(accept), sort, args.near);
    }
    if (f.individualsOnly) {
      const pages = await pageSellers(ctx, rows);
      rows = rows.filter((r) => !pages.has(r.sellerId));
    }
    return {
      items: rows.slice(0, limit).map((l) => toCard(l, now)),
      hasMore: rows.length > limit,
    };
  },
});

/** Makes and models available in Vehicles, for the filter accordions. */
export const vehicleFacets = viewerQuery({
  args: { make: v.optional(v.string()) },
  handler: async (ctx, { make }) => {
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_category", (q) => q.eq("category", "vehicles"))
      .take(MAX_SCAN);
    const makes = new Set<string>();
    const models = new Set<string>();
    const types = new Set<string>();
    for (const r of rows) {
      if (!r.vehicle || r.status === "sold") continue;
      makes.add(r.vehicle.make);
      if (r.vehicle.vehicleType) types.add(r.vehicle.vehicleType);
      if (!make || eqi(r.vehicle.make, make)) models.add(r.vehicle.model);
    }
    const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
    return { makes: sorted(makes), models: sorted(models), types: sorted(types) };
  },
});

/* ───────────────────────── Listing page ───────────────────────── */

async function viewerThread(ctx: QueryCtx, l: Doc<"listings">, viewerId: Id<"users">) {
  const convs = await ctx.db
    .query("conversations")
    .withIndex("by_listing", (q) => q.eq("listingId", l._id))
    .collect();
  return (
    convs.find(
      (c) =>
        c.kind === "marketplace" &&
        c.memberIds.includes(viewerId) &&
        c.memberIds.includes(l.sellerId),
    ) ?? null
  );
}

async function listingStats(ctx: QueryCtx, l: Doc<"listings">) {
  const [saves, chats] = await Promise.all([
    ctx.db
      .query("saved")
      .withIndex("by_ref", (q) => q.eq("kind", "listing").eq("refId", l._id))
      .collect(),
    ctx.db
      .query("conversations")
      .withIndex("by_listing", (q) => q.eq("listingId", l._id))
      .collect(),
  ]);
  return { views: l.viewCount, saves: saves.length, chats: chats.length };
}

/** Full listing for /marketplace/item/$listingId. Null when missing. */
export const get = viewerQuery({
  args: { listingId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("listings", args.listingId);
    const l = id ? await ctx.db.get(id) : null;
    if (!l) return null;
    const viewerId = ctx.viewer._id;
    const isOwner = l.sellerId === viewerId;
    const [sellerDoc, viewerSaved, thread, stats] = await Promise.all([
      ctx.db.get(l.sellerId),
      isSaved(ctx, viewerId, "listing", l._id),
      isOwner ? null : viewerThread(ctx, l, viewerId),
      isOwner ? listingStats(ctx, l) : null,
    ]);
    if (!sellerDoc) return null;
    const seller = await getSummary(ctx, sellerDoc._id);
    if (!seller) return null;
    const cat = categoryFor(l.category);
    return {
      _id: l._id,
      title: l.title,
      price: l.price,
      originalPrice: l.originalPrice ?? null,
      category: l.category,
      categoryMeta: cat ? { slug: cat.slug, label: cat.label } : null,
      condition: l.condition ?? null,
      brand: l.brand ?? null,
      description: l.description,
      photos: l.photos,
      video: l.video ?? null,
      location: l.location,
      status: l.status,
      rental: l.rental ?? null,
      vehicle: l.vehicle ?? null,
      meetup: l.meetup ?? [],
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      seller: {
        ...seller,
        joinedYear: new Date(sellerDoc.joinedAt).getFullYear(),
        rating: sellerRating(sellerDoc._id),
      },
      isOwner,
      viewerSaved,
      conversationId: thread?._id ?? null,
      stats,
    };
  },
});

/** "Today's picks" under a listing. */
export const related = viewerQuery({
  args: { listingId: v.id("listings"), limit: v.number(), near: v.optional(near) },
  handler: async (ctx, { listingId, limit, near }) => {
    const rows = await relatedListings(ctx, listingId, limit, near);
    const now = Date.now();
    return rows.map((r) => toCard(r, now));
  },
});

/**
 * Active listings near the viewer (the same radius filter as `browse`): same
 * category first, newest first, then everything else, newest first.
 */
export async function relatedListings(
  ctx: QueryCtx,
  listingId: Id<"listings">,
  limit: number,
  nearBy: Near | undefined,
) {
  const max = Math.max(1, Math.min(limit, 240));
  const l = await ctx.db.get(listingId);
  const out: Doc<"listings">[] = [];
  const seen = new Set<Id<"listings">>([listingId]);
  // One read budget across both scans; stop as soon as the page is full.
  let budget = MAX_SCAN;
  const fill = async (rows: AsyncIterable<Doc<"listings">>) => {
    if (out.length >= max || budget <= 0) return;
    for await (const r of rows) {
      budget--;
      if (!seen.has(r._id) && r.status === "active" && withinRadius(r, nearBy)) {
        seen.add(r._id);
        out.push(r);
      }
      if (out.length >= max || budget <= 0) break;
    }
  };
  if (l)
    await fill(
      ctx.db
        .query("listings")
        .withIndex("by_category", (q) => q.eq("category", l.category))
        .order("desc"),
    );
  await fill(ctx.db.query("listings").withIndex("by_created").order("desc"));
  return out;
}

/* ───────────────────────── You: selling / buying / saved ───────────────────────── */

/** The viewer's own listings with stats (Selling › Your listings). */
export const mine = viewerQuery({
  args: {
    status: v.optional(
      v.union(v.literal("all"), v.literal("active"), v.literal("pending"), v.literal("sold")),
    ),
    sort: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("oldest"),
        v.literal("price_desc"),
        v.literal("price_asc"),
      ),
    ),
  },
  handler: async (ctx, { status = "all", sort = "newest" }) => {
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_seller", (q) => q.eq("sellerId", ctx.viewer._id))
      .order("desc")
      .collect();
    const totals = { active: 0, pending: 0, sold: 0, views: 0, saves: 0, chats: 0 };
    const withStats = await Promise.all(
      rows.map(async (l) => ({ l, stats: await listingStats(ctx, l) })),
    );
    for (const { l, stats } of withStats) {
      totals[l.status]++;
      if (l.status !== "sold") {
        totals.views += stats.views;
        totals.saves += stats.saves;
        totals.chats += stats.chats;
      }
    }
    const filtered = withStats.filter(({ l }) => status === "all" || l.status === status);
    const cmp = {
      newest: (a: Doc<"listings">, b: Doc<"listings">) => b.createdAt - a.createdAt,
      oldest: (a: Doc<"listings">, b: Doc<"listings">) => a.createdAt - b.createdAt,
      price_desc: (a: Doc<"listings">, b: Doc<"listings">) => b.price - a.price,
      price_asc: (a: Doc<"listings">, b: Doc<"listings">) => a.price - b.price,
    }[sort];
    filtered.sort((a, b) => cmp(a.l, b.l));
    const now = Date.now();
    return {
      totals,
      items: filtered.map(({ l, stats }) => ({ ...toCard(l, now), updatedAt: l.updatedAt, stats })),
    };
  },
});

/** Listings the viewer saved, newest save first. */
export const saved = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("saved")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect();
    const now = Date.now();
    const out: ListingCard[] = [];
    for (const r of rows) {
      if (r.kind !== "listing") continue;
      const id = ctx.db.normalizeId("listings", r.refId);
      const l = id ? await ctx.db.get(id) : null;
      if (l) out.push(toCard(l, now));
    }
    return out;
  },
});

export type InboxRow = {
  conversationId: Id<"conversations">;
  listing: {
    _id: Id<"listings">;
    title: string;
    photo: string | null;
    price: number;
    status: Doc<"listings">["status"];
  } | null;
  other: UserSummary | null;
  role: "selling" | "buying";
  lastMessage: { text: string; fromViewer: boolean; createdAt: number } | null;
  unread: boolean;
  lastMessageAt: number;
};

/** The viewer's Marketplace chats, split into Selling (own listings) and Buying. */
async function marketplaceThreads(ctx: QueryCtx, viewerId: Id<"users">) {
  const mine = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", viewerId))
    .order("desc")
    .collect();
  const rows: InboxRow[] = [];
  for (const m of mine) {
    const c = await ctx.db.get(m.conversationId);
    if (c?.kind !== "marketplace" || !c.listingId) continue;
    const l = await ctx.db.get(c.listingId);
    const sellerId = l?.sellerId;
    const role = sellerId === viewerId ? "selling" : "buying";
    const otherId = c.memberIds.find((u) => u !== viewerId);
    const [other, last] = await Promise.all([
      otherId ? getSummary(ctx, otherId) : null,
      c.lastMessageId ? ctx.db.get(c.lastMessageId) : null,
    ]);
    const lastMsg =
      last ??
      (await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .first());
    rows.push({
      conversationId: c._id,
      listing: l
        ? {
            _id: l._id,
            title: l.title,
            photo: l.photos[0] ?? null,
            price: l.price,
            status: l.status,
          }
        : null,
      other,
      role,
      lastMessage: lastMsg
        ? {
            text: lastMsg.unsent
              ? "Unsent a message"
              : (lastMsg.text ?? (lastMsg.attachments.length ? "Sent an attachment" : "")),
            fromViewer: lastMsg.senderId === viewerId,
            createdAt: lastMsg.createdAt,
          }
        : null,
      unread: !!lastMsg && lastMsg.senderId !== viewerId && lastMsg.createdAt > m.lastReadAt,
      lastMessageAt: c.lastMessageAt,
    });
  }
  rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return rows;
}

export const inbox = viewerQuery({
  args: { role: v.union(v.literal("selling"), v.literal("buying")) },
  handler: async (ctx, { role }) => {
    const rows = await marketplaceThreads(ctx, ctx.viewer._id);
    return {
      rows: rows.filter((r) => r.role === role),
      unread: {
        selling: rows.filter((r) => r.role === "selling" && r.unread).length,
        buying: rows.filter((r) => r.role === "buying" && r.unread).length,
      },
    };
  },
});

/** Buying › Recent activity: listings the viewer has messaged sellers about. */
export const buying = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = (await marketplaceThreads(ctx, ctx.viewer._id)).filter(
      (r) => r.role === "buying" && r.listing,
    );
    const now = Date.now();
    const out = [];
    for (const r of rows) {
      const l = r.listing ? await ctx.db.get(r.listing._id) : null;
      if (!l) continue;
      out.push({
        ...toCard(l, now),
        conversationId: r.conversationId,
        seller: r.other,
        lastMessageAt: r.lastMessageAt,
      });
    }
    return out;
  },
});

/** Marketplace notifications (messages about and saves of the viewer's listings). */
export const notifications = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .take(300);
    const mp = rows.filter((n) => n.listingId).slice(0, 60);
    const actors = await getSummaries(
      ctx,
      mp.flatMap((n) => (n.actorId ? [n.actorId] : [])),
    );
    const out = [];
    for (const n of mp) {
      const l = n.listingId ? await ctx.db.get(n.listingId) : null;
      out.push({
        _id: n._id,
        kind: n.kind,
        text: n.text,
        read: n.read,
        createdAt: n.createdAt,
        actor: n.actorId ? (actors.get(n.actorId) ?? null) : null,
        listing: l ? { _id: l._id, title: l.title, photo: l.photos[0] ?? null } : null,
        conversationId: n.conversationId ?? null,
      });
    }
    return out;
  },
});

/** Groups with Marketplace listings ("Buy and sell groups"). */
export const buySellGroups = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_created")
      .order("desc")
      .take(MAX_SCAN);
    const counts = new Map<Id<"groups">, number>();
    for (const l of listings)
      for (const g of l.groupIds ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const joined = new Set(memberships.map((m) => m.groupId));
    const out = [];
    for (const [gid, count] of counts) {
      const g = await ctx.db.get(gid);
      if (!g) continue;
      out.push({
        _id: g._id,
        name: g.name,
        slug: g.slug,
        cover: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount,
        listingCount: count,
        joined: joined.has(g._id),
      });
    }
    return out.sort((a, b) => b.listingCount - a.listingCount);
  },
});

/** Groups the viewer can also list in (composer step "List in more places"). */
export const listingTargets = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const out = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (g)
        out.push({
          _id: g._id,
          name: g.name,
          cover: g.cover,
          memberCount: g.memberCount,
        });
    }
    return out;
  },
});

/* ───────────────────────── Mutations ───────────────────────── */

export async function resolvePhotos(ctx: MutationCtx, photos: Infer<typeof photoInput>[]) {
  const out: string[] = [];
  for (const p of photos) {
    if ("url" in p) out.push(p.url);
    else {
      const url = await ctx.storage.getUrl(p.storageId);
      if (url) out.push(url);
    }
  }
  return out;
}

function listingVideo(video: Infer<typeof media> | undefined) {
  if (!video) return undefined;
  if (video.kind !== "video") throw new ConvexError("Choose a video file");
  if ((video.duration ?? 0) > 61) throw new ConvexError("Videos can be up to 1 minute long");
  return video;
}

export function placeFor(name: string) {
  const n = NEIGHBORHOODS.find((x) => x.name === name);
  if (!n) throw new ConvexError("Choose a location");
  return { city: n.city, neighborhood: n.name, lat: n.lat, lng: n.lng };
}

export function validate(
  f: { title: string; price: number; description: string },
  photoCount: number,
) {
  if (!f.title.trim()) throw new ConvexError("Add a title");
  if (!Number.isFinite(f.price) || f.price < 0) throw new ConvexError("Enter a valid price");
  if (photoCount === 0) throw new ConvexError("Add at least one photo");
  if (photoCount > 10) throw new ConvexError("You can add up to 10 photos");
}

async function ownListing(ctx: MutationCtx, listingId: Id<"listings">, viewerId: Id<"users">) {
  const l = await ctx.db.get(listingId);
  if (!l) throw new ConvexError("This listing isn't available anymore");
  if (l.sellerId !== viewerId) throw new ConvexError("Only the seller can change this listing");
  return l;
}

export const create = viewerMutation({
  args: listingFields,
  handler: async (ctx, args) => {
    const photos = await resolvePhotos(ctx, args.photos);
    validate(args, photos.length);
    const now = Date.now();
    const location = placeFor(args.neighborhood);
    return ctx.db.insert("listings", {
      sellerId: ctx.viewer._id,
      title: args.title.trim(),
      price: Math.round(args.price),
      category: args.category,
      condition: args.condition,
      brand: args.brand?.trim() || undefined,
      description: args.description.trim(),
      photos,
      video: listingVideo(args.video),
      location,
      neighborhoodId: await neighborhoodIdAt(ctx, location),
      status: "active",
      rental: args.rental,
      vehicle: args.vehicle,
      meetup: args.meetup,
      badges: [],
      groupIds: args.groupIds?.length ? args.groupIds : undefined,
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
    });
  },
});

export const update = viewerMutation({
  args: { listingId: v.id("listings"), ...listingFields },
  handler: async (ctx, { listingId, ...args }) => {
    const l = await ownListing(ctx, listingId, ctx.viewer._id);
    const photos = await resolvePhotos(ctx, args.photos);
    validate(args, photos.length);
    const price = Math.round(args.price);
    // Facebook shows a price drop struck through: remember the highest earlier price.
    const before = l.originalPrice ?? l.price;
    const originalPrice = price < before ? before : undefined;
    const location = placeFor(args.neighborhood);
    await ctx.db.patch(listingId, {
      title: args.title.trim(),
      price,
      originalPrice,
      category: args.category,
      condition: args.condition,
      brand: args.brand?.trim() || undefined,
      description: args.description.trim(),
      photos,
      video: listingVideo(args.video),
      location,
      neighborhoodId: await neighborhoodIdAt(ctx, location),
      rental: args.rental,
      vehicle: args.vehicle,
      meetup: args.meetup,
      groupIds: args.groupIds?.length ? args.groupIds : undefined,
      // A different unit loses the badges about the old one (#11).
      badges: badgesAfterEdit(l, {
        location: placeFor(args.neighborhood),
        photos,
        rental: args.rental,
      }),
      updatedAt: Date.now(),
    });
    return listingId;
  },
});

export const setStatus = viewerMutation({
  args: {
    listingId: v.id("listings"),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("sold")),
  },
  handler: async (ctx, { listingId, status }) => {
    await ownListing(ctx, listingId, ctx.viewer._id);
    await ctx.db.patch(listingId, { status, updatedAt: Date.now() });
  },
});

export const remove = viewerMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    await ownListing(ctx, listingId, ctx.viewer._id);
    const saves = await ctx.db
      .query("saved")
      .withIndex("by_ref", (q) => q.eq("kind", "listing").eq("refId", listingId))
      .collect();
    for (const s of saves) await ctx.db.delete(s._id);
    await ctx.db.delete(listingId);
  },
});

/** Count a listing view ("clicks on listing"); the seller's own views don't count. */
export const recordView = viewerMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const l = await ctx.db.get(listingId);
    if (!l || l.sellerId === ctx.viewer._id) return;
    await ctx.db.patch(listingId, { viewCount: l.viewCount + 1 });
  },
});

/**
 * "Send seller a message": find the buyer's thread with the seller about this
 * listing (or start one), append the message and notify the seller.
 */
export const messageSeller = viewerMutation({
  args: { listingId: v.id("listings"), text: v.string() },
  handler: async (ctx, { listingId, text }) => {
    const body = text.trim();
    if (!body) throw new ConvexError("Write a message");
    const l = await ctx.db.get(listingId);
    if (!l) throw new ConvexError("This listing isn't available anymore");
    const buyerId = ctx.viewer._id;
    const sellerId = l.sellerId;
    if (buyerId === sellerId) throw new ConvexError("You can't message yourself");
    if (await isBlockedEitherWay(ctx, buyerId, sellerId))
      throw new ConvexError("This person isn't available right now.");
    const now = Date.now();

    let conv = await viewerThread(ctx, l, buyerId);
    const isNew = !conv;
    if (!conv) {
      const id = await ctx.db.insert("conversations", {
        kind: "marketplace",
        listingId,
        memberIds: [buyerId, sellerId],
        createdAt: now,
        lastMessageAt: now,
      });
      conv = await ctx.db.get(id);
      if (!conv) throw new ConvexError("Couldn't start the conversation");
    }
    const conversationId = conv._id;
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId: buyerId,
      author: { kind: "human" },
      status: "sent",
      text: body,
      attachments: [],
      createdAt: now,
    });
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessageId: messageId,
      memberIds: [...new Set([...conv.memberIds, buyerId, sellerId])],
    });
    for (const userId of [buyerId, sellerId]) {
      const row = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", conversationId).eq("userId", userId),
        )
        .unique();
      const lastReadAt = userId === buyerId ? now : (row?.lastReadAt ?? now - 1);
      if (row) await ctx.db.patch(row._id, { lastMessageAt: now, lastReadAt, archived: false });
      else
        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId,
          lastReadAt,
          lastMessageAt: now,
        });
    }
    if (isNew)
      await notify(ctx, {
        userId: sellerId,
        actorId: buyerId,
        kind: "listing_message",
        text: `sent you a message about ${l.title}.`,
        listingId,
        conversationId,
      });
    // A renter writing about a sublet prompts Muse's reply for the lister (#45).
    await afterChatMessage(ctx, conversationId, buyerId);
    return conversationId;
  },
});

/** The served URL of a photo just uploaded via `posts:generateUploadUrl`. */
export const photoUrl = viewerMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError("Upload failed");
    return url;
  },
});

/* ───────────────────────── Sponsored (ads in Marketplace) ───────────────────────── */

export type MarketplaceAd = {
  postId: Id<"posts">;
  page: Pick<UserSummary, "_id" | "name" | "username" | "avatar" | "verified">;
  /** The Page's tagline (falls back to the ad headline). */
  tagline: string;
  headline: string;
  image: string;
  video: boolean;
};

/** First sentence of an ad's copy, for a headline when it has no link title. */
function firstSentence(text: string) {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > 90 ? `${s.slice(0, 87).trimEnd()}...` : s;
}

/**
 * Sponsored Page posts shown as Marketplace ads (grid tiles and the "Ad" block
 * on item pages), newest first, minus ads the viewer hid or reported.
 */
export const ads = viewerQuery({
  args: {},
  handler: async (ctx): Promise<MarketplaceAd[]> => {
    const viewerId = ctx.viewer._id;
    const hidden = new Set(
      (
        await ctx.db
          .query("hiddenPosts")
          .withIndex("by_user_post", (q) => q.eq("userId", viewerId))
          .collect()
      ).map((r) => r.postId),
    );
    const out: MarketplaceAd[] = [];
    let scanned = 0;
    for await (const p of ctx.db.query("posts").withIndex("by_created").order("desc")) {
      if (++scanned > MAX_SCAN || out.length >= 6) break;
      if (p.sponsored !== true || p.privacy !== "public" || hidden.has(p._id)) continue;
      const link = p.attachments.find((a) => a.kind === "link");
      const m = p.media[0];
      const image = m ? (m.kind === "video" ? m.poster : m.url) : link?.image;
      if (!image) continue;
      const page = await ctx.db.get(p.authorId);
      if (page?.kind !== "page") continue;
      if (await isBlockedEitherWay(ctx, viewerId, page._id)) continue;
      const headline = link?.title ?? firstSentence(p.text ?? page.name);
      out.push({
        postId: p._id,
        page: {
          _id: page._id,
          name: page.name,
          username: page.username,
          avatar: page.avatar,
          verified: page.verified,
        },
        tagline: page.bio ?? headline,
        headline,
        image,
        video: m?.kind === "video",
      });
    }
    return out;
  },
});

/**
 * "Hide ad" / "Report ad" from a Marketplace ad's menu (hidden for this viewer
 * only). `hidden: false` undoes it.
 */
export const hideAd = viewerMutation({
  args: {
    postId: v.id("posts"),
    reason: v.union(v.literal("hidden"), v.literal("reported")),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { postId, reason, hidden = true }) => {
    const viewerId = ctx.viewer._id;
    const post = await ctx.db.get(postId);
    if (!post?.sponsored) throw new ConvexError("Ad not found");
    const row = await ctx.db
      .query("hiddenPosts")
      .withIndex("by_user_post", (q) => q.eq("userId", viewerId).eq("postId", postId))
      .first();
    if (!hidden) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (row) await ctx.db.patch(row._id, { reason });
    else
      await ctx.db.insert("hiddenPosts", {
        userId: viewerId,
        postId,
        reason,
        createdAt: Date.now(),
      });
  },
});
