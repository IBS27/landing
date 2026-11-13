/**
 * Apartment search tuned to the City Profile (#10). A pure, deterministic
 * ranking: each rental gets a 0–1 score for budget, transit and interests,
 * each with a plain-language reason, combined with visible weights.
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
};

export type ReasonKind = "budget" | "transit" | "interests";

export type Reason = {
  kind: ReasonKind;
  /** "$1,650, inside your budget" */
  text: string;
  tone: "good" | "bad";
  /** Source keys behind the reason (a station fact, Groups, Events). */
  sources: string[];
};

export type Fit = {
  id: string;
  score: number;
  parts: Record<ReasonKind, number>;
  /** Strongest first: the two or three reasons that most explain the rank. */
  reasons: Reason[];
};

/** How strongly each part counts. Transit counts more without a car, less with one. */
export function weights(profile: FitProfile): Record<ReasonKind, number> {
  const car = profile.modes ? profile.modes.includes("car") : null;
  const transit = car === null ? 0.3 : car ? 0.15 : 0.45;
  const budget = profile.budget ? 0.4 : 0;
  const interests = profile.interests.size > 0 ? 0.3 : 0;
  const total = budget + transit + interests;
  return { budget: budget / total, transit: transit / total, interests: interests / total };
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** 1 inside the budget (cheaper isn't rewarded more), falling to 0 at 15% over the max. */
export function budgetPart(price: number, budget: FitProfile["budget"]): [number, Reason | null] {
  if (!budget) return [0, null];
  if (price <= budget.max)
    return [
      1,
      { kind: "budget", text: `${usd(price)}, inside your budget`, tone: "good", sources: [] },
    ];
  const over = price - budget.max;
  const score = Math.max(0, 1 - over / (budget.max * 0.15));
  return [
    score,
    {
      kind: "budget",
      text: `${usd(over)} over your ${usd(budget.max)} max`,
      tone: "bad",
      sources: [],
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
  if (!best || best.min > 40)
    return [
      0,
      {
        kind: "transit",
        text: "No BART, Muni Metro or Caltrain stop within walking distance",
        tone: "bad",
        sources: [],
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
  if (total === 0)
    return [
      0,
      {
        kind: "interests",
        text: "No Groups or Events for your interests nearby",
        tone: "bad",
        sources: [],
      },
    ];
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

/**
 * Ranks rentals for a profile, best first. Ties go to the cheaper listing.
 * `context` gives each listing's stops (all of them) and its neighborhood's places.
 */
export function rankRentals(
  profile: FitProfile,
  listings: readonly FitListing[],
  context: { stops: readonly FitStop[]; placesFor: (id: string) => readonly FitPlace[] },
): Fit[] {
  const w = weights(profile);
  const fits = listings.map((l): Fit => {
    const [b, br] = budgetPart(l.price, profile.budget);
    const [t, tr] = transitPart(l, context.stops, profile.modes);
    const [i, ir] = interestsPart(context.placesFor(l.id), profile);
    const parts = { budget: b, transit: t, interests: i };
    const score = w.budget * b + w.transit * t + w.interests * i;
    // Reasons in order of how much they moved the score, up or down; three at most.
    const impact = (r: Reason) =>
      w[r.kind] * (r.tone === "good" ? parts[r.kind] : 1 - parts[r.kind]);
    const reasons = [br, tr, ir]
      .filter((r): r is Reason => r !== null && w[r.kind] > 0)
      .sort((x, y) => impact(y) - impact(x))
      .slice(0, 3);
    return { id: l.id, score, parts, reasons };
  });
  const price = new Map(listings.map((l) => [l.id, l.price]));
  return fits.sort((a, b) => b.score - a.score || (price.get(a.id) ?? 0) - (price.get(b.id) ?? 0));
}
