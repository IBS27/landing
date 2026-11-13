import { describe, expect, test } from "bun:test";
import {
  type CounterInput,
  counterLadder,
  counterProblems,
  estimate,
  isWeekdayMove,
  type RateCard,
  rateFromText,
  rateProblems,
} from "../convex/lib/moverQuotes";

const FOG: RateCard = {
  hourly: 139,
  crew: 2,
  minHours: 3,
  truckFee: 79,
  discounts: [{ label: "15% off weekday moves", percent: 15, when: "weekday" }],
};

describe("estimate", () => {
  test("hours from move size, minimum hours, truck fee and the weekday deal", () => {
    // 2026-12-02 is a Wednesday.
    expect(isWeekdayMove("2026-12-02")).toBe(true);
    const e = estimate(FOG, { size: "1br", date: "2026-12-02", stairs: false });
    expect(e.hours).toBe(4);
    expect(e.labor).toBe(556);
    expect(e.applied).toEqual({ label: "15% off weekday moves", percent: 15, amount: 83 });
    expect(e.total).toBe(556 + 79 - 83);
  });
  test("stairs add an hour and weekend dates don't get the weekday deal", () => {
    // 2026-12-05 is a Saturday.
    const e = estimate(FOG, { size: "studio", date: "2026-12-05", stairs: true });
    expect(e.hours).toBe(4);
    expect(e.applied).toBeNull();
  });
  test("student deals are shown as if-eligible, not taken off", () => {
    const card: RateCard = {
      ...FOG,
      discounts: [{ label: "10% off for students", percent: 10, when: "student" }],
    };
    const e = estimate(card, { size: "1br", date: "2026-12-02", stairs: false });
    expect(e.applied).toBeNull();
    expect(e.ifEligible).toEqual([{ label: "10% off for students", percent: 10 }]);
  });
});

describe("rateFromText", () => {
  test("reads rates and deals from a mover's posts", () => {
    const card = rateFromText([
      "Rates for 2026: 2 movers + truck for $139/hr, 3-hour minimum. $79 truck fee covers fuel and pads.",
      "Moving midweek? Get 15% off labor on Monday to Thursday moves this fall.",
      "Students: 10% off with a valid student ID.",
    ]);
    expect(card).toMatchObject({ hourly: 139, crew: 2, minHours: 3, truckFee: 79 });
    expect(card?.discounts.map((d) => [d.percent, d.when])).toEqual([
      [15, "weekday"],
      [10, "student"],
    ]);
    expect(card && rateProblems(card)).toEqual([]);
  });
  test("no rate, no card", () => {
    expect(rateFromText(["We love moving!"])).toBeNull();
  });
});

describe("negotiating a quote", () => {
  const base: CounterInput = {
    mover: "Fog City Movers",
    theirQuote: 650,
    bestOther: { mover: "Golden Gate Moving", price: 520, kind: "quote" },
    dealsToAsk: [{ label: "15% off weekday moves", percent: 15 }],
    move: { size: "1 bedroom", date: "Wednesday, December 2" },
  };
  test("asks to match a lower quote, naming the mover and price", () => {
    const m = counterLadder(base);
    expect(m.move).toBe("counter");
    expect(m.text).toContain("Golden Gate Moving quoted $520");
    expect(counterProblems(m, base)).toEqual([]);
  });
  test("asks for their posted deal when no one is cheaper", () => {
    const input = {
      ...base,
      bestOther: { mover: "Bay Haul Co.", price: 700, kind: "estimate" as const },
    };
    const m = counterLadder(input);
    expect(m.text).toContain("15% off weekday moves");
    expect(counterProblems(m, input)).toEqual([]);
  });
  test("accepts when they're already the best and there's no deal to ask for", () => {
    const input = { ...base, bestOther: null, dealsToAsk: [] };
    expect(counterLadder(input)).toMatchObject({ move: "accept" });
  });
  test("rejects made-up prices, made-up percents and accepting over a lower quote", () => {
    expect(
      counterProblems({ move: "counter", text: "Could you do $480?", rationale: "r" }, base),
    ).toContain("text names $480, which isn't a quote or estimate the user has");
    expect(
      counterProblems(
        { move: "counter", text: "Golden Gate Moving quoted $520. Any 20% off?", rationale: "r" },
        base,
      ),
    ).toContain("text names 20%, which isn't one of this mover's posted deals");
    expect(counterProblems({ move: "accept", text: "$650 works", rationale: "r" }, base)).toContain(
      "don't accept: the user has a lower price to ask this mover to match",
    );
  });
});
