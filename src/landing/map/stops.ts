import { distanceMeters } from "../../../convex/lib/geo";
import type { LatLng } from "./types";

/** Stops closer than this share a spot on the map (an Event at a place on the route). */
const SAME_SPOT_METERS = 30;
/** How far each later stop at a shared spot is nudged, in pixels: enough to show both numbers. */
const NUDGE_PX = 16;

/**
 * Pixel offsets for numbered route stops, so stops at the same spot don't hide
 * each other: the first keeps its place and each later one shifts right. With
 * `stopZ` drawing lower numbers on top, stop 1 is never covered by stop 3.
 */
export function stopOffsets(points: readonly LatLng[]): [number, number][] {
  return points.map((p, i) => {
    const before = points.slice(0, i).filter((q) => distanceMeters(p, q) < SAME_SPOT_METERS).length;
    return [before * NUDGE_PX, 0];
  });
}

/** Levels the stops' band spans above its base; later stops past it share the lowest. */
export const STOP_LEVELS = 10;

/** Stacking within the stops' band: the lower the number, the higher it draws. */
export function stopZ(base: number, index: number): number {
  return base + Math.max(0, STOP_LEVELS - index);
}
