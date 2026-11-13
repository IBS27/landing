import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { eventVisible, loadAudience } from "./posts";

/**
 * Pins for the Landing map (#56): what `map.inBounds` returns and what
 * `<LandingMap>` layers take. Every pin is something the viewer may see, and
 * listing pins carry an approximate area only, never the stored coordinates.
 */

export type LatLng = { lat: number; lng: number };
export type Bounds = { west: number; south: number; east: number; north: number };
export type PinKind = "homes" | "items" | "events" | "groups";

export type ListingPin = {
  _id: Id<"listings">;
  title: string;
  price: number;
  photo: string | null;
  /** "Mission, San Francisco": the area the seller chose. */
  area: string;
  /** Approximate: snapped to a ~400 m cell with a stable per-listing offset. */
  point: LatLng;
  home: {
    propertyType: NonNullable<Doc<"listings">["rental"]>["propertyType"];
    listingType: NonNullable<Doc<"listings">["rental"]>["listingType"];
    bedrooms: number;
    bathrooms: number;
  } | null;
};

export type EventPin = {
  _id: Id<"events">;
  title: string;
  cover: string;
  startAt: number;
  /** Venue name, else the address. */
  place: string;
  point: LatLng;
};

export type GroupPin = {
  _id: Id<"groups">;
  slug: string;
  name: string;
  cover: string;
  privacy: Doc<"groups">["privacy"];
  memberCount: number;
  point: LatLng;
};

export type PinsInBounds = { listings: ListingPin[]; events: EventPin[]; groups: GroupPin[] };

/** Most pins returned per kind; the map clusters them, so more would only cost reads. */
export const PINS_MAX = 300;
/** Most listings read per query (newest first). */
export const LISTING_SCAN_MAX = 2000;
/** Events that started up to this long ago may still be on. */
const EVENT_LOOKBACK = 2 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/* ───────────── Approximate listing areas ───────────── */

/** Grid cell for approximate listing areas: about 440 m on a side in San Francisco. */
export const AREA_CELL = { lat: 0.004, lng: 0.005 } as const;

/** A stable number in [0, 1) from a string (FNV-1a), so a listing's offset never changes. */
function unit(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Where a listing's pin goes: the center of its grid cell, nudged by an offset
 * derived from the listing id (not from the coordinates), so pins in one cell
 * don't stack and nothing finer than the cell can be recovered. Marketplace
 * shows the same "approximate area" on the item page.
 */
export function approximatePoint(id: string, p: LatLng): LatLng {
  const cell = (v: number, size: number) => (Math.floor(v / size) + 0.5) * size;
  const nudge = (k: string, size: number) => (unit(`${id}:${k}`) - 0.5) * 0.7 * size;
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return {
    lat: round(cell(p.lat, AREA_CELL.lat) + nudge("lat", AREA_CELL.lat)),
    lng: round(cell(p.lng, AREA_CELL.lng) + nudge("lng", AREA_CELL.lng)),
  };
}

/* ───────────── Query ───────────── */

export function inBounds(p: LatLng, b: Bounds) {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

/**
 * Privacy-filtered pins inside `bounds` for the kinds asked for:
 * - listings: active, from sellers the viewer hasn't blocked (or been blocked by), at an approximate area;
 * - Events: upcoming, in person, and visible to the viewer by Facebook's audience rules;
 * - Groups: visible Groups, plus hidden ones the viewer belongs to.
 */
export async function pinsInBounds(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  bounds: Bounds,
  kinds: readonly PinKind[],
  now = Date.now(),
): Promise<PinsInBounds> {
  const want = new Set(kinds);
  const audience = await loadAudience(ctx, viewerId);
  const out: PinsInBounds = { listings: [], events: [], groups: [] };

  if (want.has("homes") || want.has("items")) {
    let scanned = 0;
    for await (const l of ctx.db.query("listings").withIndex("by_created").order("desc")) {
      if (++scanned > LISTING_SCAN_MAX || out.listings.length >= PINS_MAX) break;
      if (l.status !== "active" || audience.blocked.has(l.sellerId)) continue;
      if (!want.has(l.rental ? "homes" : "items")) continue;
      const { lat, lng } = l.location;
      if (lat === undefined || lng === undefined) continue;
      const point = approximatePoint(l._id, { lat, lng });
      // Bounds are tested on the approximate point, so panning can't narrow down the real one.
      if (!inBounds(point, bounds)) continue;
      out.listings.push({
        _id: l._id,
        title: l.title,
        price: l.price,
        photo: l.photos[0] ?? null,
        area: l.location.neighborhood
          ? `${l.location.neighborhood}, ${l.location.city.split(",")[0]}`
          : l.location.city,
        point,
        home: l.rental
          ? {
              propertyType: l.rental.propertyType,
              listingType: l.rental.listingType,
              bedrooms: l.rental.bedrooms,
              bathrooms: l.rental.bathrooms,
            }
          : null,
      });
    }
  }

  if (want.has("events")) {
    const [rows, responses] = await Promise.all([
      ctx.db
        .query("events")
        .withIndex("by_start", (q) => q.gt("startAt", now - EVENT_LOOKBACK))
        .collect(),
      ctx.db
        .query("eventResponses")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
    ]);
    const responded = new Set(responses.map((r) => r.eventId));
    for (const e of rows) {
      if (out.events.length >= PINS_MAX) break;
      if (e.online || (e.endAt ?? e.startAt + 3 * HOUR) <= now) continue;
      if (audience.blocked.has(e.hostId)) continue;
      if (!eventVisible(e, audience, responded.has(e._id))) continue;
      const point = e.point;
      if (!point || !inBounds(point, bounds)) continue;
      out.events.push({
        _id: e._id,
        title: e.title,
        cover: e.cover,
        startAt: e.startAt,
        place: e.venue ?? e.address ?? e.city,
        point,
      });
    }
  }

  if (want.has("groups")) {
    const rows = await ctx.db.query("groups").withIndex("by_activity").order("desc").collect();
    for (const g of rows) {
      if (out.groups.length >= PINS_MAX) break;
      if (!g.visible && !audience.groups.has(g._id)) continue;
      const point = g.point;
      if (!point || !inBounds(point, bounds)) continue;
      out.groups.push({
        _id: g._id,
        slug: g.slug,
        name: g.name,
        cover: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount,
        point,
      });
    }
  }

  return out;
}
