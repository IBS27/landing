import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  type CitedSource,
  cite,
  type NonEmpty,
  resolveCitations,
  resolveSources,
} from "./lib/citations";
import { getProfile, interestWeights } from "./lib/cityProfile";
import { neighborhoodLabel } from "./lib/cityProfileFacts";
import { viewerQuery } from "./lib/functions";
import { getInterest, interestsForEvent, interestsForGroup } from "./lib/interests";
import { listingPin } from "./lib/mapPins";
import { type Audience, listingShownTo, loadAudience } from "./lib/posts";
import {
  type FitBuses,
  type FitPlace,
  type FitProfile,
  type FitStop,
  type FitTrust,
  meetsFilters,
  type Reason,
  rankRentals,
  trustPart,
} from "./lib/rentalFit";
import {
  isNewAccount,
  listingSignals,
  networkEvidence,
  signalListingIds,
  signalTitle,
} from "./lib/trust";
import { listerNetwork } from "./lib/vouches";
import type { Citations, Source } from "./validators";

/**
 * Apartment search tuned to the City Profile (#10). Ranks active rentals with
 * `rankRentals` (convex/lib/rentalFit.ts) and returns each result's reasons
 * with their sources: the listing for price, neighborhood and availability, the
 * station or transit service fact for transit, the Groups and Events for
 * interests. Listings with things to check (#11), or that the viewer reported,
 * rank lower and lead with a warning citing the evidence.
 */

const RESULTS_MAX = 30;
/** The viewer's own listing reports read, newest rows first. */
const REPORTS_READ_MAX = 500;

/**
 * Every BART, Muni Metro and Caltrain stop in #15's cited transit facts, and
 * the Muni bus lines stopping in each neighborhood from #17's service facts.
 */
async function transitStops(ctx: QueryCtx) {
  const facts = await ctx.db.query("neighborhoodFacts").collect();
  const stops: FitStop[] = [];
  const buses = new Map<string, FitBuses>();
  const citations = new Map<string, Citations>();
  for (const f of facts) {
    if (f.kind === "transit_station") {
      stops.push({ factKey: f._id, system: f.system, name: f.name, ...f.point });
      citations.set(f._id, f.citations);
    } else if (f.kind === "transit_line" && f.system === "muni_metro") {
      for (const s of f.stops)
        stops.push({ factKey: f._id, system: f.system, name: `${s.name} (${f.line})`, ...s.point });
      citations.set(f._id, f.citations);
    } else if (f.kind === "transit_service") {
      const lines = [...new Set(f.routes.filter((r) => r.mode === "bus").map((r) => r.line))];
      if (lines.length === 0) continue;
      buses.set(f.neighborhoodId, { factKey: f._id, lines });
      citations.set(f._id, f.citations);
    }
  }
  return { stops, buses, citations };
}

/**
 * Trust for each listing, as its listing view (#11) shows it to this viewer:
 * whether they reported it, and its "things to check" signals from the same
 * recent rentals. The network check behind the new-account signal runs only
 * for new accounts.
 */
async function trustFor(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  listings: Doc<"listings">[],
  rentals: Doc<"listings">[],
  audience: Audience,
  now: number,
) {
  const reports = await ctx.db
    .query("reports")
    .withIndex("by_user_target", (q) => q.eq("userId", viewerId).eq("targetType", "listing"))
    .order("desc")
    .take(REPORTS_READ_MAX);
  const reported = new Set(reports.map((r) => r.targetId));
  const visible = rentals.filter((l) => !audience.blocked.has(l.sellerId));
  const listers = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
  const networks = new Map<Id<"users">, ReturnType<typeof listerNetwork>>();
  const out = new Map<string, FitTrust>();
  for (const l of listings) {
    let lister = listers.get(l.sellerId);
    if (!lister) {
      lister = ctx.db.get(l.sellerId);
      listers.set(l.sellerId, lister);
    }
    const doc = await lister;
    if (!doc) continue;
    let network = null;
    if (isNewAccount(doc, now)) {
      let n = networks.get(doc._id);
      if (!n) {
        n = listerNetwork(ctx, viewerId, doc._id);
        networks.set(doc._id, n);
      }
      network = networkEvidence(await n);
    }
    const signals = listingSignals(l, doc, { recent: visible, older: visible }, network, null, now);
    out.set(l._id, {
      reported: reported.has(l._id),
      signals: signals.map((x) => ({
        text: signalTitle(x),
        sources: signalListingIds(x).map((id) => `listing:${id}`),
      })),
    });
  }
  return out;
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
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
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
  // A warning is never hidden for one source the viewer can't see: it keeps the ones they can.
  if (r.kind === "trust") {
    const [first, ...rest] = await resolveSources(ctx, sources, a);
    return first ? [first, ...rest] : null;
  }
  return resolveCitations(ctx, cite([sources[0], ...sources.slice(1)]), a);
}

type Area = { slug: string; label: string };

/** Finds results' DataSF neighborhoods (#86) to link them, reading each one once. */
export function areaLookup(ctx: QueryCtx) {
  const seen = new Map<Id<"neighborhoods">, Promise<Area | null>>();
  return (id: Id<"neighborhoods"> | undefined): Promise<Area | null> => {
    if (!id) return Promise.resolve(null);
    let area = seen.get(id);
    if (!area) {
      area = ctx.db.get(id).then((n) => n && { slug: n.slug, label: n.shortName ?? n.name });
      seen.set(id, area);
    }
    return area;
  };
}

async function card(l: Doc<"listings">, areaOf: ReturnType<typeof areaLookup>) {
  return {
    _id: l._id,
    title: l.title,
    price: l.price,
    photo: l.photos[0] ?? null,
    neighborhood: l.location.neighborhood ?? null,
    /** The neighborhood's page, from the listing's `neighborhoodId` (never the typed name). */
    area: await areaOf(l.neighborhoodId),
    listingType: l.rental?.listingType ?? "rent",
    /** `rental.availableFrom` (ms); null means available now. */
    availableFrom: l.rental?.availableFrom ?? null,
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
  handler: (ctx, { filters = {} }) => rankedRentals(ctx, ctx.viewer._id, filters),
});

/** `search` for other server code, such as Home's chat (convex/homeChat.ts). Call it with the viewer's own id. */
export async function rankedRentals(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  filters: Infer<typeof filtersArg> = {},
) {
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
  const areaOf = areaLookup(ctx);
  const listings = rows.filter(
    (l) =>
      l.status === "active" &&
      l.rental &&
      l.rental.listingType !== "sale" &&
      l.sellerId !== viewerId &&
      listingShownTo(l, audience) &&
      meetsFilters({ ...l.rental, price: l.price }, filters),
  );

  const trust = await trustFor(ctx, viewerId, listings, rows, audience, now);
  /** A result's reasons the viewer may see, each with its sources (#7); the rest are left out. */
  const cited = async (rs: Reason[], citations = new Map<string, Citations>()) => {
    const out = [];
    for (const r of rs) {
      const sources = await reasonSources(ctx, r, citations, audience);
      if (sources) out.push({ kind: r.kind, text: r.text, tone: r.tone, sources });
    }
    return out;
  };

  const hasProfile =
    !!profile.budget ||
    profile.interests.length > 0 ||
    !!profile.transport ||
    profile.neighborhoods.length > 0 ||
    !!profile.moveIn;
  if (!hasProfile) {
    // Newest first, after the trust penalty (the sort is stable).
    const warned = listings
      .map((l) => ({ l, part: trustPart({ id: l._id, trust: trust.get(l._id) }) }))
      .sort((x, y) => x.part[0] - y.part[0])
      .slice(0, RESULTS_MAX);
    const results = [];
    for (const { l, part } of warned)
      results.push({
        ...(await card(l, areaOf)),
        reasons: await cited(part[1] ? [part[1]] : []),
      });
    return { needsBrief: true, results };
  }

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
  const { stops, buses, citations } = await transitStops(ctx);
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
      buses: l.neighborhoodId ? (buses.get(l.neighborhoodId) ?? null) : null,
      trust: trust.get(l._id) ?? null,
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
    results.push({ ...(await card(l, areaOf)), reasons: await cited(f.reasons, citations) });
  }
  return { needsBrief: false, results };
}
