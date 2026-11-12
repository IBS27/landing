import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  type BBox,
  decodePolyline,
  edgeDistanceMeters,
  inBBox,
  type LatLng,
  type MultiPolygon,
  pointInMultiPolygon,
} from "./geo";
import { BOUNDARIES } from "./neighborhoodBoundaries";

/**
 * San Francisco neighborhoods (#15): DataSF's 41 Analysis Neighborhoods. A
 * neighborhood's slug is its DataSF name slugified, the same slugs City Profile
 * facts use (#3). `short` is what people call it; `park` marks the three parks
 * DataSF counts as neighborhoods.
 *
 * Records point at a neighborhood with `neighborhoodId`, assigned from their
 * coordinates by `neighborhoodIdAt` (never from a typed name). Display strings
 * such as a listing's `location.neighborhood` are not neighborhoods.
 */
export const SF_NEIGHBORHOODS = [
  { slug: "bayview-hunters-point", name: "Bayview Hunters Point", short: "Bayview" },
  { slug: "bernal-heights", name: "Bernal Heights" },
  { slug: "castro-upper-market", name: "Castro/Upper Market", short: "Castro" },
  { slug: "chinatown", name: "Chinatown" },
  { slug: "excelsior", name: "Excelsior" },
  {
    slug: "financial-district-south-beach",
    name: "Financial District/South Beach",
    short: "FiDi",
  },
  { slug: "glen-park", name: "Glen Park" },
  { slug: "golden-gate-park", name: "Golden Gate Park", park: true },
  { slug: "haight-ashbury", name: "Haight Ashbury", short: "Haight" },
  { slug: "hayes-valley", name: "Hayes Valley" },
  { slug: "inner-richmond", name: "Inner Richmond" },
  { slug: "inner-sunset", name: "Inner Sunset" },
  { slug: "japantown", name: "Japantown" },
  { slug: "lakeshore", name: "Lakeshore" },
  { slug: "lincoln-park", name: "Lincoln Park", park: true },
  { slug: "lone-mountain-usf", name: "Lone Mountain/USF", short: "Lone Mountain" },
  { slug: "marina", name: "Marina" },
  { slug: "mclaren-park", name: "McLaren Park", park: true },
  { slug: "mission", name: "Mission" },
  { slug: "mission-bay", name: "Mission Bay" },
  { slug: "nob-hill", name: "Nob Hill" },
  { slug: "noe-valley", name: "Noe Valley" },
  { slug: "north-beach", name: "North Beach" },
  { slug: "oceanview-merced-ingleside", name: "Oceanview/Merced/Ingleside", short: "OMI" },
  { slug: "outer-mission", name: "Outer Mission" },
  { slug: "outer-richmond", name: "Outer Richmond" },
  { slug: "pacific-heights", name: "Pacific Heights", short: "Pac Heights" },
  { slug: "portola", name: "Portola" },
  { slug: "potrero-hill", name: "Potrero Hill" },
  { slug: "presidio", name: "Presidio" },
  { slug: "presidio-heights", name: "Presidio Heights" },
  { slug: "russian-hill", name: "Russian Hill" },
  { slug: "seacliff", name: "Seacliff" },
  { slug: "south-of-market", name: "South of Market", short: "SoMa" },
  { slug: "sunset-parkside", name: "Sunset/Parkside", short: "Outer Sunset" },
  { slug: "tenderloin", name: "Tenderloin" },
  { slug: "treasure-island", name: "Treasure Island" },
  { slug: "twin-peaks", name: "Twin Peaks" },
  { slug: "visitacion-valley", name: "Visitacion Valley", short: "Vis Valley" },
  { slug: "west-of-twin-peaks", name: "West of Twin Peaks" },
  { slug: "western-addition", name: "Western Addition" },
] as const satisfies readonly { slug: string; name: string; short?: string; park?: boolean }[];

export type NeighborhoodSlug = (typeof SF_NEIGHBORHOODS)[number]["slug"];
export type NeighborhoodDef = {
  readonly slug: NeighborhoodSlug;
  readonly name: string;
  readonly short?: string;
  readonly park?: boolean;
};

const BY_SLUG: ReadonlyMap<string, NeighborhoodDef> = new Map(
  (SF_NEIGHBORHOODS as readonly NeighborhoodDef[]).map((n) => [n.slug, n]),
);

export function isNeighborhoodSlug(s: string): s is NeighborhoodSlug {
  return BY_SLUG.has(s);
}

export function neighborhoodDef(slug: NeighborhoodSlug): NeighborhoodDef {
  const def = BY_SLUG.get(slug);
  if (!def) throw new Error(`unknown neighborhood ${slug}`);
  return def;
}

/** "Points just outside every polygon" tolerance: slivers left by simplification, piers, shorelines. */
export const NEAREST_WITHIN_METERS = 25;

type Shape = { slug: NeighborhoodSlug; center: LatLng; bbox: BBox; polygon: MultiPolygon };
let shapes: Shape[] | null = null;

/** Decoded boundaries, in slug order (so overlaps resolve the same way everywhere). */
export function neighborhoodShapes(): readonly Shape[] {
  if (!shapes) {
    shapes = SF_NEIGHBORHOODS.map(({ slug }) => {
      const b = BOUNDARIES[slug];
      if (!b) throw new Error(`no boundary for ${slug}; rerun scripts/neighborhoods/build.ts`);
      return {
        slug,
        center: b.center,
        bbox: b.bbox,
        polygon: b.rings.map((polygon) => polygon.map(decodePolyline)),
      };
    });
  }
  return shapes;
}

export function neighborhoodShape(slug: NeighborhoodSlug): Shape {
  const s = neighborhoodShapes().find((x) => x.slug === slug);
  if (!s) throw new Error(`unknown neighborhood ${slug}`);
  return s;
}

/**
 * The neighborhood containing `p`, or the nearest one within
 * `NEAREST_WITHIN_METERS` (null outside San Francisco).
 */
export function neighborhoodSlugAt(p: LatLng): NeighborhoodSlug | null {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  const all = neighborhoodShapes();
  for (const s of all) {
    if (inBBox(p, s.bbox) && pointInMultiPolygon(p, s.polygon)) return s.slug;
  }
  let best: NeighborhoodSlug | null = null;
  let bestMeters = NEAREST_WITHIN_METERS;
  for (const s of all) {
    if (!inBBox(p, s.bbox, NEAREST_WITHIN_METERS)) continue;
    const d = edgeDistanceMeters(p, s.polygon);
    if (d <= bestMeters) {
      bestMeters = d;
      best = s.slug;
    }
  }
  return best;
}

/** A client-supplied point, checked: finite, on Earth, rounded to ~1 m. */
export function checkPoint(p: LatLng): LatLng {
  if (
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    Math.abs(p.lat) > 90 ||
    Math.abs(p.lng) > 180
  ) {
    throw new ConvexError("That location isn't valid");
  }
  return { lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 };
}

/** The `neighborhoods` row for the point's neighborhood, if it's in San Francisco. */
export async function neighborhoodIdAt(
  ctx: Pick<QueryCtx, "db">,
  p: LatLng | null | undefined,
): Promise<Id<"neighborhoods"> | undefined> {
  const slug = p ? neighborhoodSlugAt(p) : null;
  if (!slug) return undefined;
  const row = await ctx.db
    .query("neighborhoods")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  return row?._id;
}
