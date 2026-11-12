import { AREA_MAPS, REGION_MAPS, VENUE_MAPS } from "./catalog";

/** Meters per pixel of a 256px-tile web map at a zoom level and latitude. */
export function metersPerPixel(zoom: number, lat: number) {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Zoom levels the generated images were rendered at (see scripts/maps/build.py). */
export const AREA_ZOOM = 12;
export const REGION_ZOOM = 7;

/** Place names used in seeded addresses that map onto a generated area. */
const ALIASES: Record<string, string> = {
  "UC Berkeley": "Berkeley",
  Southside: "Berkeley",
  "Mission District": "Mission",
  Haight: "Haight-Ashbury",
  Panhandle: "Haight-Ashbury",
  Embarcadero: "San Francisco",
  "Financial District": "San Francisco",
  Downtown: "San Francisco",
  "Ferry Building": "San Francisco",
};

/** Every generated map has a dark-style twin under /seed/maps/dark/. */
export function darkMapSrc(src: string) {
  return src.replace("/seed/maps/", "/seed/maps/dark/");
}

export type AreaMap = (typeof AREA_MAPS)[string];

/** The generated map for a neighborhood or city name ("Mission", "San Francisco, CA"). */
export function areaMap(name: string | null | undefined): AreaMap | null {
  if (!name) return null;
  const key = name.split(",")[0]?.trim() ?? "";
  return AREA_MAPS[key] ?? AREA_MAPS[ALIASES[key] ?? ""] ?? null;
}

/** The regional map for a Marketplace browse city. */
export function regionMap(name: string): string | null {
  return REGION_MAPS[name] ?? null;
}

export type VenueMap = { src: string; width: number; height: number };

/**
 * The map for an event location: the venue's own street map when the address
 * is a seeded venue, else the neighborhood (from the address) or city map.
 */
export function venueMap(address: string | null | undefined, city: string): VenueMap | null {
  if (address && VENUE_MAPS[address]) return { src: VENUE_MAPS[address], width: 432, height: 324 };
  const parts = (address ?? "").split(",").map((s) => s.trim());
  for (const part of [...parts].reverse()) {
    const area = areaMap(part);
    if (area) return { src: area.map, width: 668, height: 420 };
  }
  const area = areaMap(city);
  return area ? { src: area.map, width: 668, height: 420 } : null;
}
