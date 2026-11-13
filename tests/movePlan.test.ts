import { describe, expect, test } from "bun:test";
import type { ChatNeighborhood } from "../convex/lib/chatText";
import { SF_NEIGHBORHOODS } from "../convex/lib/cityProfileFacts";
import {
  datesIn,
  type MovePlan,
  moveInDateProblem,
  NO_PLAN,
  planIn,
  planProblems,
} from "../convex/lib/movePlan";

const neighborhoods: ChatNeighborhood[] = SF_NEIGHBORHOODS.map((n) => ({
  slug: n.slug,
  name: n.name,
  ...("short" in n ? { aliases: [n.short] } : {}),
}));
const TODAY = "2026-11-13";
const ctx = { today: TODAY, neighborhoods };
const plan = (message: string, view?: "map" | "apartment") => planIn(message, { ...ctx, view });

describe("planIn: rent budget", () => {
  test("a budget said as one", () => {
    expect(plan("my budget is $2,400").budgetMax).toBe(2400);
    expect(plan("up to 2.5k a month").budgetMax).toBe(2500);
    expect(plan("rent under $3000").budgetMax).toBe(3000);
    expect(plan("a $1,950 budget").budgetMax).toBe(1950);
    expect(plan("budget: 2400").budgetMax).toBe(2400);
    expect(plan("I can afford 3.2k").budgetMax).toBe(3200);
    expect(plan("$2400/mo").budgetMax).toBe(2400);
  });
  test("a search or a count is not a budget", () => {
    expect(plan("rooms under $2,000")).toEqual(NO_PLAN);
    expect(plan("show rentals under $2,000/mo")).toEqual(NO_PLAN);
    expect(plan("any apartments for $1,800 a month?")).toEqual(NO_PLAN);
    expect(plan("find rooms, my budget is $2,100 a month").budgetMax).toBe(2100);
    expect(plan("rooms under $1,600 in my budget")).toEqual(NO_PLAN);
    expect(plan("rooms in my budget")).toEqual(NO_PLAN);
    expect(plan("I want to rent 2 rooms").budgetMax).toBeNull();
    expect(plan("a gym for $15 a month").budgetMax).toBeNull();
  });
  test("a year is not dollars", () => {
    expect(plan("moving in March 2027, budget 2,400")).toEqual({
      budgetMax: 2400,
      moveIn: "2027-03",
      neighborhoods: [],
    });
    expect(plan("moving in March 2027 budget is tight").budgetMax).toBeNull();
  });
  test("out of range amounts are dropped", () => {
    expect(plan("my budget is $150").budgetMax).toBeNull();
    expect(plan("my budget is $45,000").budgetMax).toBeNull();
  });
  test("a furnish request never states a rent budget", () => {
    expect(plan("make it cozy, budget $800")).toEqual(NO_PLAN);
    expect(plan("furnish my place for under $1,500 a month")).toEqual(NO_PLAN);
    expect(plan("decorate the living room, my budget is $2,000")).toEqual(NO_PLAN);
    // On the Apartment tab a bare budget is for furniture.
    expect(plan("my budget is $800", "apartment")).toEqual(NO_PLAN);
    expect(plan("my rent budget is $2,400", "apartment").budgetMax).toBe(2400);
  });
  test("what they ask for a sublet is not their budget", () => {
    expect(plan("sublet my room for $1500 a month from January")).toEqual(NO_PLAN);
  });
});

describe("planIn: move-in", () => {
  test("months and days, with the next occurrence when no year is given", () => {
    expect(plan("moving in January").moveIn).toBe("2027-01");
    expect(plan("moving in November").moveIn).toBe("2026-11");
    expect(plan("moving Jan 15").moveIn).toBe("2027-01-15");
    expect(plan("I'm arriving January 15, 2027").moveIn).toBe("2027-01-15");
    expect(plan("move-in 2027-01-15").moveIn).toBe("2027-01-15");
    expect(plan("we move in March 2027").moveIn).toBe("2027-03");
    expect(plan("moving the 3rd of February").moveIn).toBe("2027-02-03");
    expect(plan("moving November 20").moveIn).toBe("2026-11-20");
    expect(plan("moving November 2").moveIn).toBe("2027-11-02");
  });
  test("relative months", () => {
    expect(plan("moving next month").moveIn).toBe("2026-12");
    expect(plan("moving this month").moveIn).toBe("2026-11");
    expect(plan("I'm moving in two months").moveIn).toBe("2027-01");
    expect(plan("moving in 3 months").moveIn).toBe("2027-02");
  });
  test("only when the message is about moving in", () => {
    expect(plan("events on Jan 15")).toEqual(NO_PLAN);
    expect(plan("what's on in January")).toEqual(NO_PLAN);
    expect(plan("I'm moving out in January")).toEqual(NO_PLAN);
    expect(plan("I moved in October")).toEqual(NO_PLAN);
    // "may" the verb is not the month.
    expect(plan("I may move soon")).toEqual(NO_PLAN);
    expect(plan("I may move in May").moveIn).toBe("2027-05");
  });
  test("past, far-off and unreal dates are dropped", () => {
    expect(plan("moving on January 15, 2020").moveIn).toBeNull();
    expect(plan("moving 2026-11-12").moveIn).toBeNull();
    expect(plan("moving in March 2030").moveIn).toBeNull();
    expect(plan("moving in on 2027-02-31").moveIn).toBeNull();
    expect(plan("moving November 2028").moveIn).toBe("2028-11");
    expect(plan("moving December 2028").moveIn).toBeNull();
  });
  test("moveInDateProblem", () => {
    expect(moveInDateProblem("2027-01", TODAY)).toBeNull();
    expect(moveInDateProblem("2026-11-13", TODAY)).toBeNull();
    expect(moveInDateProblem("2026-10", TODAY)).toContain("past");
    expect(moveInDateProblem("2026-11-12", TODAY)).toContain("past");
    expect(moveInDateProblem("2028-12", TODAY)).toContain("24 months");
    expect(moveInDateProblem("January", TODAY)).toContain("YYYY-MM");
    expect(moveInDateProblem("2027-13", TODAY)).toContain("YYYY-MM");
  });
});

describe("planIn: neighborhoods", () => {
  test("only where they say they want to live", () => {
    expect(plan("I want to live in the Mission").neighborhoods).toEqual(["mission"]);
    expect(plan("looking in Noe Valley or Bernal").neighborhoods).toEqual([
      "noe-valley",
      "bernal-heights",
    ]);
    expect(plan("we're moving to SoMa").neighborhoods).toEqual(["south-of-market"]);
    expect(plan("I'd prefer Hayes Valley").neighborhoods).toEqual(["hayes-valley"]);
    expect(plan("looking for a room in the Castro").neighborhoods).toEqual(["castro-upper-market"]);
  });
  test("asking about a neighborhood records nothing", () => {
    for (const m of [
      "events in the Mission",
      "tell me about Noe Valley",
      "rentals in SoMa",
      "Mission vs Noe Valley",
      "weekend route in the Marina",
      "I'm moving to SF",
    ])
      expect(plan(m)).toEqual(NO_PLAN);
  });
  test("only the list right after the cue, and never a place they rule out", () => {
    expect(
      plan("I'd like to live in SoMa, Hayes Valley and maybe the Castro. Any events in the Marina?")
        .neighborhoods,
    ).toEqual(["south-of-market", "hayes-valley", "castro-upper-market"]);
    expect(plan("I don't want to live in the Tenderloin")).toEqual(NO_PLAN);
    expect(plan("I would never want to live in the Marina")).toEqual(NO_PLAN);
  });
  test("a whole plan in one message", () => {
    expect(plan("I'm moving to SF in January with a $2,400 budget")).toEqual({
      budgetMax: 2400,
      moveIn: "2027-01",
      neighborhoods: [],
    });
    expect(plan("we're moving to the Mission in 2 months and can afford 3.2k")).toEqual({
      budgetMax: 3200,
      moveIn: "2027-01",
      neighborhoods: ["mission"],
    });
  });
});

describe("datesIn", () => {
  test("every date a message writes, most specific first", () => {
    expect(datesIn("Jan 15", TODAY)).toEqual(["2027-01-15"]);
    expect(datesIn("in March 2027, or 2027-04, or by June", TODAY)).toEqual([
      "2027-04",
      "2027-03",
      "2027-06",
    ]);
    expect(datesIn("January 15, 2027", TODAY)).toEqual(["2027-01-15"]);
    expect(datesIn("no dates here", TODAY)).toEqual([]);
  });
});

describe("planProblems", () => {
  const problems = (p: Partial<MovePlan>, message: string, view?: "map" | "apartment") =>
    planProblems({ ...NO_PLAN, ...p }, message, { ...ctx, view });

  test("an empty plan is always fine", () => {
    expect(problems({}, "events in the Mission")).toEqual([]);
  });
  test("a budget must be an amount the message writes", () => {
    expect(problems({ budgetMax: 2500 }, "my budget is 2.5k")).toEqual([]);
    expect(problems({ budgetMax: 2500 }, "I can do 2,500")).toEqual([]);
    expect(problems({ budgetMax: 2500 }, "budget $2500")).toEqual([]);
    expect(problems({ budgetMax: 2500 }, "about 2.5 for rent")).toEqual([]);
    expect(problems({ budgetMax: 2400 }, "my budget is 2.5k")).toEqual([
      "plan.budgetMax: only an amount the person wrote in this message, or null",
    ]);
    expect(problems({ budgetMax: 2000 }, "rooms in my budget")).toHaveLength(1);
    expect(problems({ budgetMax: 50 }, "my budget is $50")).toHaveLength(1);
    expect(problems({ budgetMax: 2400.5 }, "my budget is $2400.5")).toHaveLength(1);
  });
  test("a furniture budget is not the rent budget", () => {
    expect(problems({ budgetMax: 800 }, "make it cozy for $800")).toEqual([
      "plan.budgetMax: a furniture budget is not the rent budget; use null",
    ]);
  });
  test("a move-in must be a real, coming date the message writes", () => {
    expect(problems({ moveIn: "2027-01" }, "moving in January")).toEqual([]);
    expect(problems({ moveIn: "2027-01-15" }, "Jan 15")).toEqual([]);
    // The month of a day they gave is fine; a day they didn't give is not.
    expect(problems({ moveIn: "2027-01" }, "Jan 15")).toEqual([]);
    expect(problems({ moveIn: "2027-01-15" }, "moving in January")).toHaveLength(1);
    expect(problems({ moveIn: "2027-02" }, "moving in January")).toHaveLength(1);
    expect(problems({ moveIn: "2028-01" }, "moving in January")).toHaveLength(1);
    expect(problems({ moveIn: "2027-03-01" }, "moving 2027-03-01")).toEqual([]);
    expect(problems({ moveIn: "2027-01" }, "soon")).toHaveLength(1);
    expect(problems({ moveIn: "January 2027" }, "moving January 2027")[0]).toContain("YYYY-MM");
    expect(problems({ moveIn: "2026-10" }, "moving in October 2026")[0]).toContain("past");
    expect(problems({ moveIn: "2029-06" }, "moving June 2029")[0]).toContain("24 months");
  });
  test("neighborhoods must be known slugs the message names", () => {
    expect(problems({ neighborhoods: ["mission"] }, "I want to live in the Mission")).toEqual([]);
    expect(problems({ neighborhoods: ["marina"] }, "I want to live in the Mission")).toEqual([
      "plan.neighborhoods: marina is not a slug from input.neighborhoods the person says they want to live in",
    ]);
    expect(problems({ neighborhoods: ["atlantis"] }, "I want to live in Atlantis")).toHaveLength(1);
    expect(
      problems({ neighborhoods: ["mission", "mission"] }, "I want to live in the Mission"),
    ).toHaveLength(1);
  });
});

describe("planProblems: only what the person states about their own move (#150)", () => {
  const problems = (p: Partial<MovePlan>, message: string) =>
    planProblems({ ...NO_PLAN, ...p }, message, ctx);
  test("a price to search under is not a budget", () => {
    expect(problems({ budgetMax: 2000 }, "show rentals under $2,000/mo")).not.toEqual([]);
    expect(problems({ budgetMax: 2000 }, "I can do 2000 at most")).toEqual([]);
  });
  test("a date or a neighborhood named for something else is not their plan", () => {
    const message = "events in the Mission on January 15";
    expect(problems({ moveIn: "2027-01-15" }, message)).not.toEqual([]);
    expect(problems({ neighborhoods: ["mission"] }, message)).not.toEqual([]);
    expect(problems({ neighborhoods: ["mission"] }, "I'd like events in the Mission")).not.toEqual(
      [],
    );
    expect(problems({ neighborhoods: ["mission"] }, "I'd love the Mission")).toEqual([]);
  });
  test("a bare date answers 'when are you moving?'", () => {
    expect(problems({ moveIn: "2027-01-15" }, "January 15")).toEqual([]);
    expect(problems({ moveIn: "2027-01" }, "probably in January")).toEqual([]);
    expect(problems({ moveIn: "2027-01-15" }, "moving in on January 15")).toEqual([]);
  });
  test("a neighborhood they say they want to live in", () => {
    expect(problems({ neighborhoods: ["mission"] }, "I want to live in the Mission")).toEqual([]);
  });
});
