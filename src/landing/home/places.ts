import type { Bounds, LatLng, NeighborhoodShape } from "@/landing/map/types";

/** The box around a neighborhood's MultiPolygon. */
export function shapeBounds(n: Pick<NeighborhoodShape, "polygon">): Bounds {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const poly of n.polygon)
    for (const ring of poly)
      for (const [lng, lat] of ring) {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
  return { west, south, east, north };
}

export function unionBounds(boxes: readonly Bounds[]): Bounds | null {
  if (!boxes.length) return null;
  return boxes.reduce((a, b) => ({
    west: Math.min(a.west, b.west),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    north: Math.max(a.north, b.north),
  }));
}

export function pointsBounds(points: readonly LatLng[], pad = 0.01): Bounds | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    west: Math.min(...lngs) - pad,
    east: Math.max(...lngs) + pad,
    south: Math.min(...lats) - pad,
    north: Math.max(...lats) + pad,
  };
}
