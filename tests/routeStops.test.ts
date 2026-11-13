import { describe, expect, test } from "bun:test";
import { STOP_LEVELS, stopOffsets, stopZ } from "../src/landing/map/stops";

describe("route stop markers", () => {
  test("lower numbers draw on top", () => {
    const z = [0, 1, 2, 3, 4, 5].map((i) => stopZ(5, i));
    expect(z).toEqual([...z].sort((a, b) => b - a));
    expect(new Set(z).size).toBe(z.length);
    expect(Math.max(...z)).toBeLessThanOrEqual(5 + STOP_LEVELS);
  });

  test("stops at the same spot are spread so each number shows", () => {
    const cafe = { lat: 37.7599, lng: -122.4148 };
    const elsewhere = { lat: 37.7648, lng: -122.4194 };
    // Stop 3 is an Event at stop 1's cafe (a few meters off).
    const offsets = stopOffsets([cafe, elsewhere, { lat: 37.75992, lng: -122.41482 }]);
    expect(offsets[0]).toEqual([0, 0]);
    expect(offsets[1]).toEqual([0, 0]);
    expect(offsets[2]?.[0]).toBeGreaterThan(0);
  });
});
