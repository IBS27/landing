import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { type CitedSource, cite, type NonEmpty, resolveCitations } from "./lib/citations";
import { getProfile, interestWeights } from "./lib/cityProfile";
import { neighborhoodLabel } from "./lib/cityProfileFacts";
import { viewerQuery } from "./lib/functions";
import { getInterest, interestsForEvent, interestsForGroup } from "./lib/interests";
import { listingPin } from "./lib/mapPins";
import { type Audience, loadAudience } from "./lib/posts";
import {
  type FitPlace,
  type FitProfile,
  type FitStop,
  meetsFilters,
  type Reason,
  rankRentals,
} from "./lib/rentalFit";
import type { Citations, Source } from "./validators";

/**
 * Apartment search tuned to the City Profile (#10). Ranks active rentals with
 * `rankRentals` (convex/lib/rentalFit.ts) and returns each result's reasons
 * with their sources: the listing for price, neighborhood and availability, the
 * station fact for transit, the Groups and Events for interests.
 */

const RESULTS_MAX = 30;

/** Every BART, Muni Metro and Caltrain stop in #15's cited transit facts. */
async function transitStops(ctx: QueryCtx) {
  const facts = await ctx.db.query("neighborhoodFacts").collect();
  const stops: FitStop[] = [];
  const citations = new Map<string, Citations>();
  for (const f of facts) {
    if (f.kind === "transit_station") {
      stops.push({ factKey: f._id, system: f.system, name: f.name, ...f.point });
      citations.set(f._id, f.citations);
    } else if (f.kind === "transit_line" && f.system === "muni_metro") {
      for (const s of f.stops)
        stops.push({ factKey: f._id, system: f.system, name: `${s.name} (${f.line})`, ...s.point });
      citations.set(f._id, f.citations);
    }
  }
  return { stops, citations };
}

/** Public Groups and upcoming public Events in a neighborhood, with the interests each matches. */
async function placesIn(ctx: QueryCtx, neighborhoodId: Id<"neighborhoods">, now: number) {
  const [groups, events] = await Promise.all([
    ctx.db
      .query("groups")
      .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
      .take(100),
    ctx.db
      .query("events")
      .withIndex("by_neighborhood", (q) =>
        q.eq("neighborhoodId", neighborhoodId).gte("startAt", now),
      )
      .take(100),
  ]);
  const places: FitPlace[] = [];
  for (const g of groups)
    if (g.privacy === "public" && g.visible)
      places.push({ sourceKey: `group:${g._id}`, kind: "group", interests: interestsForGroup(g) });
  for (const e of events)
    if (e.privacy === "public")
      places.push({ sourceKey: `event:${e._id}`, kind: "event", interests: interestsForEvent(e) });
  return places;
}

function toSource(key: string): Source | null {
  const [kind, id] = key.split(":");
  if (kind === "listing") return { kind: "listing", listingId: id as Id<"listings"> };
  if (kind === "group") return { kind: "group", groupId: id as Id<"groups"> };
  if (kind === "event") return { kind: "event", eventId: id as Id<"events"> };
  return null;
}

/** A reason's sources as the viewer may see them; null when there are none to show. */
async function reasonSources(
  ctx: QueryCtx,
  r: Reason,
  stationCitations: Map<string, Citations>,
  a: Audience,
): Promise<NonEmpty<CitedSource> | null> {
  if (r.kind === "transit") {
    const c = r.sources[0] ? stationCitations.get(r.sources[0]) : undefined;
    return c ? resolveCitations(ctx, c, a) : null;
  }
  const sources = r.sources.map(toSource).filter((s): s is Source => s !== null);
  if (sources.length === 0) return null;
  return resolveCitations(ctx, cite([sources[0], ...sources.slice(1)]), a);
}

function card(l: Doc<"listings">) {
  return {
    _id: l._id,
    title: l.title,
    price: l.price,
    photo: l.photos[0] ?? null,
    neighborhood: l.location.neighborhood ?? null,
    listingType: l.rental?.listingType ?? "rent",
    verified: l.badges.some(
      (b) => b.kind === "identity_verified" || b.kind === "property_verified",
    ),
    /** Its pin on Find's map (#75), at the approximate area only. */
    pin: listingPin(l),
  };
}

/** Must-haves the person picks on Find. They filter; they aren't scored. */
const filtersArg = v.object({
  bedrooms: v.optional(v.number()),
  maxPrice: v.optional(v.number()),
  pets: v.optional(v.boolean()),
  furnished: v.optional(v.boolean()),
});

/**
 * Rentals that meet the viewer's must-haves, ranked for them, with the reasons
 * behind each rank. Without a City Profile, newest first and `needsBrief: true`.
 */
export const search = viewerQuery({
  args: { filters: v.optional(filtersArg) },
  handler: async (ctx, { filters = {} }) => {
    const viewerId = ctx.viewer._id;
    const now = Date.now();
    const [profile, audience, rows] = await Promise.all([
      getProfile(ctx, viewerId),
      loadAudience(ctx, viewerId),
      ctx.db
        .query("listings")
        .withIndex("by_category", (q) => q.eq("category", "propertyrentals"))
        .order("desc")
        .take(500),
    ]);
    const listings = rows.filter(
      (l) =>
        l.status === "active" &&
        l.rental &&
        l.rental.listingType !== "sale" &&
        l.sellerId !== viewerId &&
        !audience.blocked.has(l.sellerId) &&
        meetsFilters({ ...l.rental, price: l.price }, filters),
    );

    const hasProfile =
      !!profile.budget ||
      profile.interests.length > 0 ||
      !!profile.transport ||
      profile.neighborhoods.length > 0 ||
      !!profile.moveIn;
    if (!hasProfile)
      return {
        needsBrief: true,
        results: listings.slice(0, RESULTS_MAX).map((l) => ({ ...card(l), reasons: [] })),
      };

    const weights = interestWeights(profile);
    const hoods = new Map<string, string>();
    for (const f of profile.neighborhoods) {
      const row = await ctx.db
        .query("neighborhoods")
        .withIndex("by_slug", (q) => q.eq("slug", f.value.slug))
        .unique();
      if (row) hoods.set(row._id, neighborhoodLabel(f.value.slug));
    }
    const moveIn = profile.moveIn
      ? Date.parse(`${profile.moveIn.value.date ?? `${profile.moveIn.value.month}-01`}T00:00:00Z`)
      : Number.NaN;
    const fitProfile: FitProfile = {
      budget: profile.budget?.value ?? null,
      modes: profile.transport?.value.modes ?? null,
      interests: weights,
      interestLabels: new Map([...weights.keys()].map((id) => [id, getInterest(id).label])),
      neighborhoods: hoods,
      moveIn: Number.isNaN(moveIn) ? null : moveIn,
    };
    const { stops, citations } = await transitStops(ctx);
    const placesByHood = new Map<string, FitPlace[]>();
    for (const l of listings)
      if (l.neighborhoodId && !placesByHood.has(l.neighborhoodId))
        placesByHood.set(l.neighborhoodId, await placesIn(ctx, l.neighborhoodId, now));
    const byId = new Map(listings.map((l) => [l._id as string, l]));

    const ranked = rankRentals(
      fitProfile,
      listings.map((l) => ({
        id: l._id,
        price: l.price,
        lat: l.location.lat ?? null,
        lng: l.location.lng ?? null,
        neighborhoodId: l.neighborhoodId ?? null,
        availableFrom: l.rental?.availableFrom ?? null,
      })),
      {
        now,
        stops,
        placesFor: (id) => {
          const hood = byId.get(id)?.neighborhoodId;
          return hood ? (placesByHood.get(hood) ?? []) : [];
        },
      },
    ).slice(0, RESULTS_MAX);

    const results = [];
    for (const f of ranked) {
      const l = byId.get(f.id);
      if (!l) continue;
      // Every reason shown is cited (#7): one whose sources the viewer can't see is left out.
      const reasons = [];
      for (const r of f.reasons) {
        const sources = await reasonSources(ctx, r, citations, audience);
        if (sources) reasons.push({ kind: r.kind, text: r.text, tone: r.tone, sources });
      }
      results.push({ ...card(l), reasons });
    }
    return { needsBrief: false, results };
  },
});
