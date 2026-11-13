/**
 * Apartment search tuned to the City Profile (#10). A pure, deterministic
 * ranking: each rental gets a 0–1 score for budget, transit, interests, target
 * neighborhood and move-in date, each with a plain-language reason, combined
 * with visible weights. Must-haves (`RentalFilters`) filter; they aren't scored.
 *
 * No AI and no device location: distances come from the listing's stated
 * point and #15's cited station facts. No protected traits are read.
 */

import type { TransitSystem } from "../validators";

export type FitProfile = {
  budget: { min?: number; max: number } | null;
  /** Transport modes from the profile; null when unknown. */
  modes: readonly string[] | null;
  /** Interest id → weight (stated 1, inferred its confidence). */
  interests: ReadonlyMap<string, number>;
  /** Interest id → label, for reasons ("climbing"). */
  interestLabels: ReadonlyMap<string, string>;
  /** Target neighborhoods: neighborhood id → label ("Mission"). */
  neighborhoods: ReadonlyMap<string, string>;
  /** Move-in day (UTC midnight, ms); null when unknown. */
  moveIn: number | null;
};

export type FitStop = {
  /** Source key of the fact it came from, for citations. */
  factKey: string;
  system: TransitSystem;
  name: string;
  lat: number;
  lng: number;
};

/** A Group or upcoming Event in a listing's neighborhood, with the interests it matches. */
export type FitPlace = { sourceKey: string; kind: "group" | "event"; interests: readonly string[] };

export type FitListing = {
  id: string;
  price: number;
  lat: number | null;
  lng: number | null;
  /** DataSF neighborhood (#15); null outside San Francisco. */
  neighborhoodId?: string | null;
  /** `rental.availableFrom` (ms); null or absent means available now. */
  availableFrom?: number | null;
};

/** Hard requirements the person picks. A listing that misses one is left out, not ranked lower. */
export type RentalFilters = {
  /** Fewest bedrooms (0 = studios count). */
  bedrooms?: number;
  maxPrice?: number;
  pets?: boolean;
  furnished?: boolean;
};

export function meetsFilters(
  l: { price: number; bedrooms: number; petsAllowed?: boolean; furnished?: boolean },
  f: RentalFilters,
): boolean {
  if (f.bedrooms !== undefined && l.bedrooms < f.bedrooms) return false;
  if (f.maxPrice !== undefined && l.price > f.maxPrice) return false;
  if (f.pets && l.petsAllowed !== true) return false;
  if (f.furnished && l.furnished !== true) return false;
  return true;
}

export type ReasonKind = "budget" | "transit" | "interests" | "neighborhood" | "moveIn";

export type Reason = {
  kind: ReasonKind;
  /** "$1,650, inside your budget" */
  text: string;
  tone: "good" | "bad";
  /** Source keys behind the reason (the listing, a station fact, Groups, Events). */
  sources: string[];
};

export type Fit = {
  id: string;
  score: number;
  parts: Record<ReasonKind, number>;
  /** Strongest first: the two or three reasons that most explain the rank. */
  reasons: Reason[];
};

/**
 * How strongly each part counts, over the parts the profile has. Transit counts
 * more without a car, less with one, and not at all when the person uses none of
 * BART, Muni or Caltrain.
 */
export function weights(profile: FitProfile): Record<ReasonKind, number> {
  const car = profile.modes ? profile.modes.includes("car") : null;
  const raw: Record<ReasonKind, number> = {
    budget: profile.budget ? 0.4 : 0,
    transit: usableSystems(profile.modes).size === 0 ? 0 : car === null ? 0.3 : car ? 0.15 : 0.45,
    interests: profile.interests.size > 0 ? 0.3 : 0,
    neighborhood: profile.neighborhoods.size > 0 ? 0.25 : 0,
    moveIn: profile.moveIn !== null ? 0.15 : 0,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return {
    budget: raw.budget / total,
    transit: raw.transit / total,
    interests: raw.interests / total,
    neighborhood: raw.neighborhood / total,
    moveIn: raw.moveIn / total,
  };
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const listingKey = (id: string) => `listing:${id}`;

/**
 * 1 inside the budget (cheaper isn't rewarded more), falling to 0 at 15% over
 * the max. The reason cites the listing, where the price comes from.
 */
export function budgetPart(
  listing: Pick<FitListing, "id" | "price">,
  budget: FitProfile["budget"],
): [number, Reason | null] {
  if (!budget) return [0, null];
  const { price } = listing;
  const sources = [listingKey(listing.id)];
  if (price <= budget.max)
    return [
      1,
      { kind: "budget", text: `${usd(price)}, inside your budget`, tone: "good", sources },
    ];
  const over = price - budget.max;
  const score = Math.max(0, 1 - over / (budget.max * 0.15));
  return [
    score,
    {
      kind: "budget",
      text: `${usd(over)} over your ${usd(budget.max)} max`,
      tone: "bad",
      sources,
    },
  ];
}

/** Which transit systems the person said they use; all of them when unknown. */
function usableSystems(modes: FitProfile["modes"]): Set<TransitSystem> {
  if (!modes) return new Set(["bart", "muni_metro", "caltrain"]);
  const s = new Set<TransitSystem>();
  if (modes.includes("bart")) s.add("bart");
  if (modes.includes("muni")) s.add("muni_metro");
  if (modes.includes("caltrain")) s.add("caltrain");
  return s;
}

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** About 80 m a minute, plus 30% because streets aren't straight lines. */
export const walkMinutes = (meters: number) => Math.max(1, Math.round((meters * 1.3) / 80));

const SYSTEM_LABEL: Record<TransitSystem, string> = {
  bart: "BART",
  muni_metro: "Muni Metro",
  caltrain: "Caltrain",
};

/** 1 within a 5 minute walk of a stop the person uses, 0 at 25 minutes or more. */
export function transitPart(
  listing: FitListing,
  stops: readonly FitStop[],
  modes: FitProfile["modes"],
): [number, Reason | null] {
  const usable = usableSystems(modes);
  if (listing.lat === null || listing.lng === null || usable.size === 0) return [0, null];
  const here = { lat: listing.lat, lng: listing.lng };
  let best: { stop: FitStop; min: number } | null = null;
  for (const s of stops) {
    if (!usable.has(s.system)) continue;
    const min = walkMinutes(metersBetween(here, s));
    if (!best || min < best.min) best = { stop: s, min };
  }
  if (!best) return [0, null];
  // Too far to walk: a drawback, citing the nearest stop's fact.
  if (best.min > 40)
    return [
      0,
      {
        kind: "transit",
        text: "No BART, Muni Metro or Caltrain stop within walking distance",
        tone: "bad",
        sources: [best.stop.factKey],
      },
    ];
  const score = Math.min(1, Math.max(0, (25 - best.min) / 20));
  const station = best.stop.name.endsWith(SYSTEM_LABEL[best.stop.system])
    ? best.stop.name
    : `${best.stop.name} ${SYSTEM_LABEL[best.stop.system]}`;
  return [
    score,
    {
      kind: "transit",
      text: `${best.min} min walk to ${station}`,
      tone: best.min <= 15 ? "good" : "bad",
      sources: [best.stop.factKey],
    },
  ];
}

/** Weighted count of matching Groups and Events in the neighborhood; 3 or more is a full score. */
export function interestsPart(
  places: readonly FitPlace[],
  profile: FitProfile,
): [number, Reason | null] {
  if (profile.interests.size === 0) return [0, null];
  let total = 0;
  const matched: string[] = [];
  const byInterest = new Map<string, number>();
  for (const p of places) {
    const hits = p.interests.filter((i) => profile.interests.has(i));
    if (hits.length === 0) continue;
    total += Math.max(...hits.map((i) => profile.interests.get(i) ?? 0));
    matched.push(p.sourceKey);
    for (const i of hits)
      byInterest.set(i, (byInterest.get(i) ?? 0) + (profile.interests.get(i) ?? 0));
  }
  // Nothing matching scores 0 without a reason: an absence has no source to cite.
  if (total === 0) return [0, null];
  // The two interests with the most weight nearby name the reason.
  const labels = [...byInterest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => (profile.interestLabels.get(id) ?? id).toLowerCase());
  const n = matched.length;
  return [
    Math.min(1, total / 3),
    {
      kind: "interests",
      text: `${n} ${n === 1 ? "Group or Event" : "Groups and Events"} for ${labels.join(" and ")} nearby`,
      tone: "good",
      sources: [...new Set(matched)].slice(0, 5),
    },
  ];
}

/** 1 in one of the profile's target neighborhoods. Elsewhere scores 0 with no reason: not a drawback worth a chip. */
export function neighborhoodPart(
  listing: FitListing,
  profile: FitProfile,
): [number, Reason | null] {
  const label = listing.neighborhoodId
    ? profile.neighborhoods.get(listing.neighborhoodId)
    : undefined;
  if (label === undefined) return [0, null];
  return [
    1,
    {
      kind: "neighborhood",
      text: `In ${label}, one of your neighborhoods`,
      tone: "good",
      sources: [listingKey(listing.id)],
    },
  ];
}

const DAY = 24 * 60 * 60 * 1000;
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * 1 when the rental is free within two weeks of the move-in day, falling to 0
 * at two months either side. No `availableFrom` means available now. A move-in
 * day that has passed counts as today.
 */
export function moveInPart(
  listing: FitListing,
  moveIn: number | null,
  now: number,
): [number, Reason | null] {
  if (moveIn === null) return [0, null];
  const target = Math.max(moveIn, now);
  const from = Math.max(listing.availableFrom ?? now, now);
  const days = Math.round((from - target) / DAY);
  const off = Math.abs(days);
  const score = Math.min(1, Math.max(0, (60 - off) / 46));
  const when =
    listing.availableFrom && listing.availableFrom > now
      ? `Available ${SHORT_DATE.format(from)}`
      : "Available now";
  const weeks = Math.round(off / 7);
  const text =
    off <= 14
      ? `${when}, around your move-in`
      : `${when}, ${weeks} weeks ${days > 0 ? "after" : "before"} your move-in`;
  return [
    score,
    { kind: "moveIn", text, tone: off <= 14 ? "good" : "bad", sources: [listingKey(listing.id)] },
  ];
}

/**
 * Ranks rentals for a profile, best first. Ties go to the cheaper listing.
 * `context` gives every stop, each listing's neighborhood places, and the time.
 */
export function rankRentals(
  profile: FitProfile,
  listings: readonly FitListing[],
  context: {
    stops: readonly FitStop[];
    placesFor: (id: string) => readonly FitPlace[];
    now: number;
  },
): Fit[] {
  const w = weights(profile);
  const fits = listings.map((l): Fit => {
    const [b, br] = budgetPart(l, profile.budget);
    const [t, tr] = transitPart(l, context.stops, profile.modes);
    const [i, ir] = interestsPart(context.placesFor(l.id), profile);
    const [n, nr] = neighborhoodPart(l, profile);
    const [m, mr] = moveInPart(l, profile.moveIn, context.now);
    const parts = { budget: b, transit: t, interests: i, neighborhood: n, moveIn: m };
    const score =
      w.budget * b + w.transit * t + w.interests * i + w.neighborhood * n + w.moveIn * m;
    // Reasons in order of how much they moved the score, up or down; three at most.
    const impact = (r: Reason) =>
      w[r.kind] * (r.tone === "good" ? parts[r.kind] : 1 - parts[r.kind]);
    const reasons = [br, tr, ir, nr, mr]
      .filter((r): r is Reason => r !== null && w[r.kind] > 0)
      .sort((x, y) => impact(y) - impact(x))
      .slice(0, 3);
    return { id: l.id, score, parts, reasons };
  });
  const price = new Map(listings.map((l) => [l.id, l.price]));
  return fits.sort((a, b) => b.score - a.score || (price.get(a.id) ?? 0) - (price.get(b.id) ?? 0));
}
