import { describe, expect, test } from "bun:test";
import {
  budgetPart,
  type FitPlace,
  type FitProfile,
  type FitStop,
  interestsPart,
  rankRentals,
  transitPart,
  walkMinutes,
  weights,
} from "../convex/lib/rentalFit";

// Maya: $1,800–2,400, no car (walk, bike, Muni, BART), climbs and likes live music.
const maya: FitProfile = {
  budget: { min: 1800, max: 2400 },
  modes: ["walk", "bike", "muni", "bart"],
  interests: new Map([
    ["climbing", 1],
    ["live_music", 0.6],
  ]),
  interestLabels: new Map([
    ["climbing", "Climbing"],
    ["live_music", "Live music"],
  ]),
};

// 24th St BART, and a Caltrain stop Maya doesn't use.
const STOPS: FitStop[] = [
  {
    factKey: "f:24th",
    system: "bart",
    name: "24th Street / Mission BART",
    lat: 37.7524,
    lng: -122.4184,
  },
  { factKey: "f:22nd", system: "caltrain", name: "22nd Street", lat: 37.7576, lng: -122.3925 },
];
const MISSION = { lat: 37.7529, lng: -122.4185 }; // ~1 min from 24th St BART
const SUNSET = { lat: 37.7535, lng: -122.495 }; // far from both

describe("weights", () => {
  test("transit counts more without a car, less with one", () => {
    const noCar = weights(maya);
    const car = weights({ ...maya, modes: ["car"] });
    expect(noCar.transit).toBeGreaterThan(car.transit);
    expect(noCar.budget + noCar.transit + noCar.interests).toBeCloseTo(1);
  });
});

describe("budgetPart", () => {
  test("inside the budget is full, cheaper isn't rewarded more", () => {
    expect(budgetPart(2000, maya.budget)).toEqual([
      1,
      { kind: "budget", text: "$2,000, inside your budget", tone: "good", sources: [] },
    ]);
    expect(budgetPart(1200, maya.budget)[0]).toBe(1);
  });
  test("falls off steeply above the max", () => {
    const [score, reason] = budgetPart(2600, maya.budget);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
    expect(reason).toMatchObject({ text: "$200 over your $2,400 max", tone: "bad" });
    expect(budgetPart(3000, maya.budget)[0]).toBe(0);
  });
  test("no budget, no part", () => {
    expect(budgetPart(2000, null)).toEqual([0, null]);
  });
});

describe("transitPart", () => {
  test("a short walk to a stop the person uses", () => {
    const [score, reason] = transitPart({ id: "a", price: 0, ...MISSION }, STOPS, maya.modes);
    expect(score).toBe(1);
    expect(reason).toMatchObject({
      text: `${walkMinutes(56)} min walk to 24th Street / Mission BART`,
      tone: "good",
      sources: ["f:24th"],
    });
  });
  test("only counts systems in the profile's transport", () => {
    const [, reason] = transitPart({ id: "a", price: 0, ...MISSION }, STOPS, ["caltrain"]);
    expect(reason?.text).toContain("22nd Street Caltrain");
  });
  test("far from everything, or no point, scores 0", () => {
    expect(transitPart({ id: "a", price: 0, ...SUNSET }, STOPS, maya.modes)[0]).toBe(0);
    expect(transitPart({ id: "a", price: 0, lat: null, lng: null }, STOPS, maya.modes)).toEqual([
      0,
      null,
    ]);
  });
});

describe("interestsPart", () => {
  const places: FitPlace[] = [
    { sourceKey: "group:g1", kind: "group", interests: ["climbing"] },
    { sourceKey: "group:g2", kind: "group", interests: ["climbing", "hiking"] },
    { sourceKey: "event:e1", kind: "event", interests: ["live_music"] },
    { sourceKey: "group:g3", kind: "group", interests: ["knitting"] },
  ];
  test("counts matching Groups and Events, names the top interests, cites them", () => {
    const [score, reason] = interestsPart(places, maya);
    expect(score).toBeCloseTo(2.6 / 3);
    expect(reason).toEqual({
      kind: "interests",
      text: "3 Groups and Events for climbing and live music nearby",
      tone: "good",
      sources: ["group:g1", "group:g2", "event:e1"],
    });
  });
  test("nothing matching is a drawback", () => {
    expect(interestsPart([places[3]], maya)).toEqual([
      0,
      {
        kind: "interests",
        text: "No Groups or Events for your interests nearby",
        tone: "bad",
        sources: [],
      },
    ]);
  });
});

describe("rankRentals", () => {
  const climbing: FitPlace[] = [
    { sourceKey: "group:g1", kind: "group", interests: ["climbing"] },
    { sourceKey: "group:g2", kind: "group", interests: ["climbing"] },
  ];
  const listings = [
    { id: "sunset-cheap", price: 1900, ...SUNSET },
    { id: "mission-over", price: 2900, ...MISSION },
    { id: "mission-fit", price: 2200, ...MISSION },
  ];
  const ctx = {
    stops: STOPS,
    placesFor: (id: string) => (id.startsWith("mission") ? climbing : []),
  };
  test("Maya sees the Mission rental near BART and inside her budget first", () => {
    expect(rankRentals(maya, listings, ctx).map((f) => f.id)).toEqual([
      "mission-fit",
      "mission-over",
      "sunset-cheap",
    ]);
  });
  test("each result explains itself with at most three reasons, drawbacks included", () => {
    const [, over] = rankRentals(maya, listings, ctx);
    expect(over.reasons.length).toBeLessThanOrEqual(3);
    expect(over.reasons.map((r) => r.text)).toContain("$500 over your $2,400 max");
  });
});
