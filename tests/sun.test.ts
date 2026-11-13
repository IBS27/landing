import { describe, expect, test } from "bun:test";
import { compass, keyDays, sfTime, sunDay } from "../src/landing/search/sun";
import { viewStory } from "../src/landing/search/viewStory";

const MISSION = { lat: 37.7599, lng: -122.4148 };

describe("sunDay", () => {
  test("matches published San Francisco times at the solstices", () => {
    const june = sunDay(MISSION.lat, MISSION.lng, new Date(Date.UTC(2026, 5, 21, 12)));
    expect(sfTime(june.sunrise)).toBe("5:48 AM");
    expect(sfTime(june.sunset)).toBe("8:34 PM");
    const dec = sunDay(MISSION.lat, MISSION.lng, new Date(Date.UTC(2026, 11, 21, 12)));
    expect(sfTime(dec.sunrise)).toBe("7:21 AM");
    expect(sfTime(dec.sunset)).toBe("4:54 PM");
  });
  test("sunrise moves from east-northeast in summer to east-southeast in winter", () => {
    expect(
      compass(sunDay(MISSION.lat, MISSION.lng, new Date(Date.UTC(2026, 5, 21, 12))).sunriseAzimuth),
    ).toBe("east-northeast");
    expect(
      compass(
        sunDay(MISSION.lat, MISSION.lng, new Date(Date.UTC(2026, 11, 21, 12))).sunriseAzimuth,
      ),
    ).toBe("east-southeast");
  });
});

describe("keyDays", () => {
  test("today is San Francisco's date, even after UTC midnight", () => {
    // 5 PM PST on March 7 is already March 8 in UTC.
    const [today] = keyDays(new Date("2026-03-08T01:00:00Z"));
    expect(today.date.toISOString()).toBe("2026-03-07T12:00:00.000Z");
  });
});

describe("viewStory", () => {
  test("has four days, three seasons and facts for each view", () => {
    for (const kind of ["sunrise", "sunset", "ocean"] as const) {
      const s = viewStory(
        kind,
        { ...MISSION, neighborhood: "Mission" },
        new Date(Date.UTC(2026, 10, 12, 20)),
      );
      expect(s.rows).toHaveLength(4);
      expect(s.seasons.map((x) => x.label)).toEqual(["Summer", "Fall", "Winter"]);
      expect(s.facts.length).toBeGreaterThan(1);
    }
  });
});
