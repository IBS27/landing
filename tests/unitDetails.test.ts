import { describe, expect, test } from "bun:test";
import { metersToPath, type NoisePlace, noiseRisk } from "../convex/lib/unitDetails";

// Valencia St between 16th and 24th, and UCSF Mission Bay.
const VALENCIA: NoisePlace = {
  key: "f:valencia",
  kind: "nightlife",
  name: "Valencia Street (Mission)",
  path: [
    { lat: 37.7651, lng: -122.4219 },
    { lat: 37.7524, lng: -122.4207 },
  ],
};
const UCSF: NoisePlace = {
  key: "f:ucsf",
  kind: "campus",
  name: "UCSF Mission Bay",
  point: { lat: 37.7678, lng: -122.3929 },
};
const PLACES = [VALENCIA, UCSF];

describe("metersToPath", () => {
  test("measures to the nearest point on the corridor, not its ends", () => {
    const midpoint = { lat: 37.7588, lng: -122.4213 };
    expect(metersToPath(midpoint, VALENCIA.kind === "nightlife" ? VALENCIA.path : [])).toBeLessThan(
      20,
    );
  });
});

describe("noiseRisk", () => {
  test("right on a nightlife corridor is high, citing it", () => {
    const r = noiseRisk({ lat: 37.7588, lng: -122.4214 }, PLACES);
    expect(r.level).toBe("high");
    expect(r.reasons[0]).toMatchObject({ placeKey: "f:valencia" });
    expect(r.reasons[0].text).toContain("Valencia Street (Mission) bars and venues");
  });
  test("a few blocks from a corridor is medium", () => {
    // About two blocks west of Valencia (Guerrero).
    expect(noiseRisk({ lat: 37.7588, lng: -122.4245 }, PLACES).level).toBe("medium");
  });
  test("close to a campus counts too", () => {
    const r = noiseRisk({ lat: 37.7682, lng: -122.3935 }, PLACES);
    expect(r.level).toBe("high");
    expect(r.reasons.map((x) => x.placeKey)).toContain("f:ucsf");
  });
  test("far from everything is low, and still says what's closest", () => {
    const r = noiseRisk({ lat: 37.7535, lng: -122.495 }, PLACES);
    expect(r.level).toBe("low");
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0].text).toMatch(/^Nearest nightlife or campus is \d+ min away/);
  });
});
