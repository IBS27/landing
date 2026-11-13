import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { todayInSF } from "../convex/lib/cityProfileFacts";
import {
  MOVE_IN_GRACE_DAYS,
  MOVING_IN_LEAD_DAYS,
  type MoveFacts,
  moveLine,
  SETTLING_DAYS,
  spineOf,
  stageOf,
} from "../convex/lib/moveStage";
import type { PlaceStatus } from "../convex/lib/placeRules";
import * as moveStage from "../convex/moveStage";
import { fakeCtx, type Row } from "./fakeDb";

const TODAY = "2026-11-13";

/** "YYYY-MM-DD", `n` days from TODAY. */
function day(n: number, from = TODAY): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const facts = (place: MoveFacts["place"], o: Partial<MoveFacts> = {}): MoveFacts => ({
  place,
  briefDone: true,
  plannedMoveIn: null,
  ...o,
});
const placed = (status: PlaceStatus, moveIn: string, moveOut: string | null = null) =>
  facts({ status, moveIn, moveOut });

describe("stageOf", () => {
  test("no place, or one they've left, is searching", () => {
    expect(stageOf(facts(null, { briefDone: false }), TODAY)).toBe("searching");
    expect(stageOf(facts(null), TODAY)).toBe("searching");
    expect(stageOf(placed("moved_out", day(-200), day(-3)), TODAY)).toBe("searching");
  });

  test("place chosen until the move-in window, then moving in", () => {
    expect(stageOf(placed("moving_in", day(MOVING_IN_LEAD_DAYS + 1)), TODAY)).toBe("place_chosen");
    expect(stageOf(placed("moving_in", day(MOVING_IN_LEAD_DAYS)), TODAY)).toBe("moving_in");
    expect(stageOf(placed("moving_in", day(0)), TODAY)).toBe("moving_in");
  });

  test("still moving in through the grace after move-in, then settling in", () => {
    expect(stageOf(placed("moving_in", day(-MOVE_IN_GRACE_DAYS)), TODAY)).toBe("moving_in");
    expect(stageOf(placed("moving_in", day(-MOVE_IN_GRACE_DAYS - 1)), TODAY)).toBe("settling_in");
    // Never marked as moved in, long after: they live there.
    expect(stageOf(placed("moving_in", day(-SETTLING_DAYS)), TODAY)).toBe("local");
  });

  test("living there: settling in for the first days, then local", () => {
    expect(stageOf(placed("living", day(0)), TODAY)).toBe("settling_in");
    expect(stageOf(placed("living", day(-(SETTLING_DAYS - 1))), TODAY)).toBe("settling_in");
    expect(stageOf(placed("living", day(-SETTLING_DAYS)), TODAY)).toBe("local");
  });

  test("moving out whatever the dates", () => {
    expect(stageOf(placed("moving_out", day(-400), day(10)), TODAY)).toBe("moving_out");
    expect(stageOf(placed("moving_out", day(-400)), TODAY)).toBe("moving_out");
  });

  test("a date that can't be read never skips a stage", () => {
    expect(stageOf(placed("moving_in", "2026-02-31"), TODAY)).toBe("moving_in");
    expect(stageOf(placed("living", "soon"), TODAY)).toBe("settling_in");
  });

  test("counts San Francisco calendar days, across years and DST", () => {
    // 2026-11-01 is the end of daylight time; a date across it still counts whole days.
    expect(stageOf(placed("moving_in", "2026-11-27"), "2026-10-28")).toBe("place_chosen");
    expect(stageOf(placed("moving_in", "2026-11-11"), "2026-10-28")).toBe("moving_in");
    // Across New Year.
    expect(stageOf(placed("living", "2026-11-03"), "2027-01-01")).toBe("settling_in");
    expect(stageOf(placed("living", "2026-11-02"), "2027-01-01")).toBe("local");
  });

  test("the stage turns at San Francisco's midnight, not UTC's", () => {
    const f = placed("moving_in", "2026-11-28");
    // 7:30am UTC on Nov 14 is still Nov 13 in San Francisco: 15 days out.
    const late = Date.parse("2026-11-14T07:30:00Z");
    expect(todayInSF(late)).toBe("2026-11-13");
    expect(stageOf(f, todayInSF(late))).toBe("place_chosen");
    // 8:30am UTC is past midnight there: 14 days out.
    const next = Date.parse("2026-11-14T08:30:00Z");
    expect(stageOf(f, todayInSF(next))).toBe("moving_in");
    expect(moveLine(f, todayInSF(next))).toBe("Move-in in 14 days");
  });
});

describe("spineOf", () => {
  test("ends at Local, or Moving out while moving out", () => {
    expect(spineOf("searching").map((s) => s.label)).toEqual([
      "Searching",
      "Place chosen",
      "Moving in",
      "Settling in",
      "Local",
    ]);
    expect(spineOf("moving_out").at(-1)?.label).toBe("Moving out");
    expect(spineOf("moving_out")).toHaveLength(5);
  });
});

describe("moveLine", () => {
  test("nothing when no date is known", () => {
    expect(moveLine(facts(null, { briefDone: false }), TODAY)).toBeNull();
    expect(moveLine(placed("moving_out", day(-100)), TODAY)).toBeNull();
  });

  test("a planned move-in while searching", () => {
    const plan = (date?: string, month = date?.slice(0, 7) ?? "2026-12") =>
      facts(null, { plannedMoveIn: { month, ...(date && { date }) } });
    expect(moveLine(plan(day(12)), TODAY)).toBe("Move-in in 12 days");
    expect(moveLine(plan(undefined, "2026-12"), TODAY)).toBe("Moving in December");
    expect(moveLine(plan(undefined, "2027-02"), TODAY)).toBe("Moving in February 2027");
    expect(moveLine(plan(undefined, "2026-11"), TODAY)).toBe("Moving in November");
    // A plan in the past says nothing.
    expect(moveLine(plan(day(-3)), TODAY)).toBeNull();
    expect(moveLine(plan(undefined, "2026-10"), TODAY)).toBeNull();
  });

  test("a countdown to move-in, the date further out", () => {
    expect(moveLine(placed("moving_in", day(0)), TODAY)).toBe("Move-in today");
    expect(moveLine(placed("moving_in", day(1)), TODAY)).toBe("Move-in tomorrow");
    expect(moveLine(placed("moving_in", day(12)), TODAY)).toBe("Move-in in 12 days");
    expect(moveLine(placed("moving_in", day(60)), TODAY)).toBe("Move-in in 60 days");
    expect(moveLine(placed("moving_in", day(61)), TODAY)).toBe("Move-in Jan 13, 2027");
    expect(moveLine(placed("moving_in", "2026-12-25"), TODAY)).toBe("Move-in in 42 days");
  });

  test("after move-in", () => {
    // Still marked moving in: the move may not have happened.
    expect(moveLine(placed("moving_in", "2026-10-28"), TODAY)).toBe("Move-in was Oct 28");
    expect(moveLine(placed("living", "2026-10-28"), TODAY)).toBe("Moved in Oct 28");
    expect(moveLine(placed("living", "2025-08-02"), TODAY)).toBe("Moved in Aug 2, 2025");
  });

  test("a countdown to move-out", () => {
    expect(moveLine(placed("moving_out", "2025-08-02", day(9)), TODAY)).toBe("Move-out in 9 days");
    expect(moveLine(placed("moving_out", "2025-08-02", day(1)), TODAY)).toBe("Move-out tomorrow");
    expect(moveLine(placed("moving_out", "2025-08-02", day(-2)), TODAY)).toBe(
      "Move-out was Nov 11",
    );
  });
});

describe("api.moveStage.get", () => {
  afterEach(() => setSystemTime());

  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<MoveFacts>;
  const get = (ctx: MutationCtx, viewer: string) =>
    (moveStage.get as unknown as { _handler: Handler })._handler(ctx, {
      viewerId: `users:${viewer}`,
    });

  const place = (user: string, status: PlaceStatus, extra: Partial<Row> = {}): Row => ({
    _id: `places:${user}`,
    userId: `users:${user}`,
    neighborhoodId: "neighborhoods:mission",
    listingId: "listings:secret",
    moveIn: "2026-10-28",
    status,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  });
  const fact = (user: string, kind: "brief" | "place", date: string): Row => ({
    _id: `cityProfileFacts:${user}-${kind}`,
    userId: `users:${user}`,
    key: "moveIn",
    value: { month: date.slice(0, 7), date },
    source: "stated",
    evidence: { kind, summary: kind === "brief" ? "You said so in your brief" : "Your place" },
    confidence: 1,
    updatedAt: kind === "place" ? 2 : 1,
  });

  const world = () =>
    fakeCtx({
      users: ["maya", "marcus", "derek"].map((u) => ({
        _id: `users:${u}`,
        name: u,
        firstName: u,
        username: u,
        avatar: "",
      })),
      places: [
        place("maya", "moving_in"),
        place("marcus", "moved_out", { moveOut: "2026-01-01", endedAt: 5 }),
      ],
      cityProfiles: [
        { _id: "cityProfiles:maya", userId: "users:maya", briefCompletedAt: 1, updatedAt: 1 },
        { _id: "cityProfiles:marcus", userId: "users:marcus", briefCompletedAt: 1, updatedAt: 1 },
      ],
      cityProfileFacts: [
        fact("maya", "brief", "2026-10-15"),
        fact("maya", "place", "2026-10-28"),
        fact("marcus", "brief", "2026-12-01"),
      ],
    });

  test("the viewer's own place, with only its status and dates", async () => {
    const ctx = world();
    const maya = await get(ctx, "maya");
    expect(maya).toEqual({
      place: { status: "moving_in", moveIn: "2026-10-28", moveOut: null },
      briefDone: true,
      plannedMoveIn: { month: "2026-10", date: "2026-10-15" },
    });
    expect(JSON.stringify(maya)).not.toContain("secret");
  });

  test("someone searching sees their planned move-in, never a place they left", async () => {
    setSystemTime(new Date(`${TODAY}T20:00:00Z`));
    const marcus = await get(world(), "marcus");
    expect(marcus.place).toBeNull();
    expect(marcus.plannedMoveIn).toEqual({ month: "2026-12", date: "2026-12-01" });
    expect(stageOf(marcus, TODAY)).toBe("searching");
    expect(moveLine(marcus, TODAY)).toBe("Move-in in 18 days");
  });

  test("a new user has nothing to show", async () => {
    const derek = await get(world(), "derek");
    expect(derek).toEqual({ place: null, briefDone: false, plannedMoveIn: null });
    expect(moveLine(derek, TODAY)).toBeNull();
  });
});
