/**
 * Unit details (#13): noise risk computed from the places near a rental, using
 * #15's cited neighborhood facts (campuses and nightlife corridors). Pure and
 * deterministic; the caller resolves each place's citations.
 */

import { metersBetween, walkMinutes } from "./rentalFit";

type LatLng = { lat: number; lng: number };

export type NoisePlace =
  | { key: string; kind: "campus"; name: string; point: LatLng }
  | { key: string; kind: "nightlife"; name: string; path: LatLng[] };

export type NoiseRisk = {
  level: "high" | "medium" | "low";
  /** "3 min walk to Valencia Street (Mission) bars and venues" */
  reasons: { text: string; placeKey: string }[];
};

/** Metres within which each kind of place raises the risk. */
export const NOISE_RADII = {
  nightlife: { high: 150, medium: 400 },
  campus: { high: 300, medium: 800 },
} as const;

/** Distance from a point to the closest point on a path of segments (equirectangular, fine at city scale). */
export function metersToPath(p: LatLng, path: readonly LatLng[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return metersBetween(p, path[0]);
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_540;
  const toXY = (q: LatLng) => ({ x: (q.lng - p.lng) * kx, y: (q.lat - p.lat) * ky });
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = toXY(path[i]);
    const b = toXY(path[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

/** Noise risk at a point from the nearest campus and nightlife corridor, with reasons. */
export function noiseRisk(at: LatLng, places: readonly NoisePlace[]): NoiseRisk {
  const nearest = (kind: NoisePlace["kind"]) => {
    let best: { place: NoisePlace; m: number } | null = null;
    for (const p of places) {
      if (p.kind !== kind) continue;
      const m = p.kind === "campus" ? metersBetween(at, p.point) : metersToPath(at, p.path);
      if (!best || m < best.m) best = { place: p, m };
    }
    return best;
  };
  const night = nearest("nightlife");
  const campus = nearest("campus");
  const reasons: NoiseRisk["reasons"] = [];
  let level: NoiseRisk["level"] = "low";
  const raise = (to: NoiseRisk["level"]) => {
    if (to === "high" || (to === "medium" && level === "low")) level = to;
  };
  if (night && night.m <= NOISE_RADII.nightlife.medium) {
    raise(night.m <= NOISE_RADII.nightlife.high ? "high" : "medium");
    reasons.push({
      text: `${walkMinutes(night.m)} min walk to ${night.place.name} bars and venues`,
      placeKey: night.place.key,
    });
  }
  if (campus && campus.m <= NOISE_RADII.campus.medium) {
    raise(campus.m <= NOISE_RADII.campus.high ? "high" : "medium");
    reasons.push({
      text: `${walkMinutes(campus.m)} min walk to ${campus.place.name}`,
      placeKey: campus.place.key,
    });
  }
  if (reasons.length === 0) {
    // Low risk still says what's closest, so the rating isn't a black box.
    const closest = [night, campus]
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.m - b.m)[0];
    if (closest)
      reasons.push({
        text: `Nearest nightlife or campus is ${walkMinutes(closest.m)} min away (${closest.place.name})`,
        placeKey: closest.place.key,
      });
  }
  return { level, reasons };
}
