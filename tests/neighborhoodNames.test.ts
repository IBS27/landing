import { describe, expect, test } from "bun:test";
import type { CitedSource } from "../convex/lib/citations";
import { SF_NEIGHBORHOODS } from "../convex/lib/cityProfileFacts";
import {
  EVERYDAY_NAMES,
  normalizeNeighborhoodQuery,
  searchNeighborhoods,
} from "../convex/lib/neighborhoodNames";
import { scheduleEnd, scheduleEndedOn, scheduleWindow } from "../convex/lib/scheduleWindow";
import { outdatedSchedule, sourceMeta } from "../src/lib/citations";

const found = (q: string) => [...(searchNeighborhoods(q) ?? [])].sort();

describe("neighborhood search", () => {
  test("everyday names find their DataSF neighborhood", () => {
    expect(found("Dogpatch")).toEqual(["potrero-hill"]);
    expect(found("cole valley")).toEqual(["haight-ashbury"]);
    expect(found("NoPa")).toEqual(["lone-mountain-usf", "western-addition"]);
    expect(found("civic center")).toEqual(["tenderloin"]);
    expect(found("Union Square")).toEqual(["financial-district-south-beach"]);
    expect(found("hayes")).toEqual(["hayes-valley"]);
  });

  test("a leading 'the', case and punctuation don't matter", () => {
    expect(found("the Richmond")).toEqual(["inner-richmond", "outer-richmond"]);
    expect(found("The  Haight-Ashbury")).toEqual(["haight-ashbury"]);
    expect(normalizeNeighborhoodQuery("the Mission District")).toBe("mission");
  });

  test("official names and parts still match as you type", () => {
    expect(found("castro")).toEqual(["castro-upper-market"]);
    expect(found("soma")).toEqual(["south-of-market"]);
    expect(found("pac")).toContain("pacific-heights");
  });

  test("an empty query matches everything", () => {
    expect(searchNeighborhoods("  ")).toBeNull();
    expect(searchNeighborhoods("the ")).toBeNull();
  });

  test("every everyday name points at real neighborhoods", () => {
    const slugs = new Set<string>(SF_NEIGHBORHOODS.map((n) => n.slug));
    for (const [, ...to] of EVERYDAY_NAMES) for (const s of to) expect(slugs.has(s)).toBe(true);
  });
});

describe("schedule windows", () => {
  test("a schedule's window reads as days, and its end is read back", () => {
    expect(scheduleWindow("2026-07-23", "2026-08-28")).toBe("Jul 23 – Aug 28, 2026");
    expect(scheduleWindow("2026-12-01", "2027-01-10")).toBe("Dec 1, 2026 – Jan 10, 2027");
    expect(scheduleEnd("SFMTA Muni schedule, Jul 23 – Aug 28, 2026")).toBe("2026-08-28");
    // The older title format, still in databases seeded before it changed.
    expect(scheduleEnd("BART GTFS schedule feed (stops.txt), schedule through 2027-01-10")).toBe(
      "2027-01-10",
    );
    expect(scheduleEnd("Embarcadero | Bay Area Rapid Transit")).toBeNull();
  });

  test("a schedule ends once its last day is over in San Francisco", () => {
    const title = "SFMTA Muni schedule, Jul 23 – Aug 28, 2026";
    // 2026-08-29 06:00 UTC is still Aug 28 in San Francisco.
    expect(scheduleEndedOn(title, Date.parse("2026-08-29T06:00:00Z"))).toBeNull();
    expect(scheduleEndedOn(title, Date.parse("2026-08-29T08:00:00Z"))).toBe("Aug 28, 2026");
  });

  test("citations of an ended schedule say it may be out of date; the facts stay", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    const source = (key: string, title: string): CitedSource => ({
      kind: "external",
      key,
      snippet: "Muni 14 Mission · runs all night: 1:30 AM at Mission St & 16th St",
      url: "https://example.com/feed.zip",
      title,
      publisher: "SFMTA",
      fetchedAt: now,
    });
    const muni = source("muni", "SFMTA Muni schedule, Jul 23 – Aug 28, 2026");
    const bart = source("bart", "BART schedule, Sep 8, 2026 – Jan 10, 2027");
    expect(sourceMeta(muni, now)).toBe("SFMTA · schedule may be out of date");
    expect(sourceMeta(bart, now)).toStartWith("SFMTA · fetched");
    expect(outdatedSchedule([bart, muni], now)).toBe(
      "Schedule may be out of date (ended Aug 28, 2026)",
    );
    expect(outdatedSchedule([bart], now)).toBeNull();
  });
});
