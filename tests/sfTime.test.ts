import { describe, expect, test } from "bun:test";
import { fromSfInput, SF_WEEKDAY_TIME, toSfInput } from "../src/landing/sfTime";

describe("Inbox event times are San Francisco's, wherever the browser is", () => {
  // Sat, Nov 14, 2026, 10:00 AM in San Francisco (PST, UTC-8).
  const SAT_10AM = Date.UTC(2026, 10, 14, 18);

  test("shows and edits the San Francisco clock", () => {
    expect(toSfInput(SAT_10AM)).toBe("2026-11-14T10:00");
    expect(SF_WEEKDAY_TIME.format(SAT_10AM)).toBe("Sat 10:00 AM");
    expect(fromSfInput("2026-11-14T10:00")).toBe(SAT_10AM);
  });

  test("round-trips across daylight saving time", () => {
    // Sat, Jul 11, 2026, 7:30 PM in San Francisco (PDT, UTC-7).
    expect(fromSfInput("2026-07-11T19:30")).toBe(Date.UTC(2026, 6, 12, 2, 30));
    for (const t of [Date.UTC(2026, 2, 8, 12), Date.UTC(2026, 10, 1, 12), SAT_10AM])
      expect(fromSfInput(toSfInput(t))).toBe(t);
  });

  test("rejects what isn't a datetime-local value", () => {
    expect(fromSfInput("")).toBeNaN();
    expect(fromSfInput("tomorrow")).toBeNaN();
  });
});
