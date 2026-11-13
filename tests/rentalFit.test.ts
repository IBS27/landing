import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import {
  budgetPart,
  type FitPlace,
  type FitProfile,
  type FitStop,
  interestsPart,
  meetsFilters,
  moveInPart,
  neighborhoodPart,
  rankRentals,
  transitPart,
  walkMinutes,
  weights,
} from "../convex/lib/rentalFit";
import * as rentals from "../convex/rentals";
import { fakeCtx, type Row } from "./fakeDb";

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
  neighborhoods: new Map(),
  moveIn: null,
};
const NOW = Date.UTC(2026, 10, 1);
const DAY = 24 * 60 * 60 * 1000;

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
    expect(Object.values(noCar).reduce((a, b) => a + b)).toBeCloseTo(1);
  });
  test("no transit weight when the person uses none of BART, Muni or Caltrain", () => {
    expect(weights({ ...maya, modes: ["walk", "bike"] }).transit).toBe(0);
  });
  test("neighborhood and move-in count only when the profile has them", () => {
    expect(weights(maya).neighborhood).toBe(0);
    expect(weights(maya).moveIn).toBe(0);
    const w = weights({ ...maya, neighborhoods: new Map([["n1", "Mission"]]), moveIn: NOW });
    expect(w.neighborhood).toBeGreaterThan(0);
    expect(w.moveIn).toBeGreaterThan(0);
    expect(Object.values(w).reduce((a, b) => a + b)).toBeCloseTo(1);
  });
});

describe("budgetPart", () => {
  test("inside the budget is full, cheaper isn't rewarded more", () => {
    expect(budgetPart({ id: "a", price: 2000 }, maya.budget)).toEqual([
      1,
      { kind: "budget", text: "$2,000, inside your budget", tone: "good", sources: ["listing:a"] },
    ]);
    expect(budgetPart({ id: "a", price: 1200 }, maya.budget)[0]).toBe(1);
  });
  test("falls off steeply above the max", () => {
    const [score, reason] = budgetPart({ id: "a", price: 2600 }, maya.budget);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
    expect(reason).toMatchObject({ text: "$200 over your $2,400 max", tone: "bad" });
    expect(budgetPart({ id: "a", price: 3000 }, maya.budget)[0]).toBe(0);
  });
  test("no budget, no part", () => {
    expect(budgetPart({ id: "a", price: 2000 }, null)).toEqual([0, null]);
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
    const [score, reason] = transitPart({ id: "a", price: 0, ...SUNSET }, STOPS, maya.modes);
    expect(score).toBe(0);
    expect(reason).toMatchObject({ tone: "bad", sources: ["f:24th"] });
    const [, caltrain] = transitPart({ id: "a", price: 0, ...SUNSET }, STOPS, ["caltrain"]);
    expect(caltrain?.text).toBe("No Caltrain stop within walking distance");
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
  test("nothing matching scores 0 without a reason: an absence has no source", () => {
    expect(interestsPart([places[3]], maya)).toEqual([0, null]);
  });
});

describe("neighborhoodPart", () => {
  const profile = { ...maya, neighborhoods: new Map([["n-mission", "Mission"]]) };
  test("a boost inside a target neighborhood, citing the listing", () => {
    expect(
      neighborhoodPart(
        { id: "a", price: 0, lat: null, lng: null, neighborhoodId: "n-mission" },
        profile,
      ),
    ).toEqual([
      1,
      {
        kind: "neighborhood",
        text: "In Mission, one of your neighborhoods",
        tone: "good",
        sources: ["listing:a"],
      },
    ]);
  });
  test("elsewhere scores 0 without a reason", () => {
    expect(
      neighborhoodPart({ id: "a", price: 0, lat: null, lng: null, neighborhoodId: "n-x" }, profile),
    ).toEqual([0, null]);
  });
});

describe("moveInPart", () => {
  const at = (days: number | null) => ({
    id: "a",
    price: 0,
    lat: null,
    lng: null,
    availableFrom: days === null ? null : NOW + days * DAY,
  });
  const moveIn = NOW + 30 * DAY;
  test("free around the move-in day is full marks", () => {
    const [score, reason] = moveInPart(at(35), moveIn, NOW);
    expect(score).toBe(1);
    expect(reason).toMatchObject({ text: "Available Dec 6, around your move-in", tone: "good" });
    expect(reason?.sources).toEqual(["listing:a"]);
  });
  test("falls to 0 two months off, either way", () => {
    expect(moveInPart(at(30 + 60), moveIn, NOW)[0]).toBe(0);
    const [score, reason] = moveInPart(at(null), moveIn, NOW);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
    expect(reason).toMatchObject({
      text: "Available now, 4 weeks before your move-in",
      tone: "bad",
    });
  });
  test("a move-in day that has passed counts as today", () => {
    expect(moveInPart(at(null), NOW - 90 * DAY, NOW)[0]).toBe(1);
  });
  test("no move-in, no part", () => {
    expect(moveInPart(at(0), null, NOW)).toEqual([0, null]);
  });
});

describe("meetsFilters", () => {
  const home = { price: 2400, bedrooms: 1, petsAllowed: true };
  test("must-haves leave listings out rather than score them", () => {
    expect(meetsFilters(home, {})).toBe(true);
    expect(meetsFilters(home, { bedrooms: 1, maxPrice: 2400, pets: true })).toBe(true);
    expect(meetsFilters(home, { bedrooms: 2 })).toBe(false);
    expect(meetsFilters(home, { maxPrice: 2300 })).toBe(false);
    expect(meetsFilters(home, { furnished: true })).toBe(false);
    expect(meetsFilters({ ...home, petsAllowed: undefined }, { pets: true })).toBe(false);
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
    now: NOW,
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
  test("the target neighborhood lifts an otherwise equal listing", () => {
    const profile = { ...maya, neighborhoods: new Map([["n-bernal", "Bernal Heights"]]) };
    const twins = [
      { id: "mission-a", price: 2200, ...MISSION, neighborhoodId: "n-mission" },
      { id: "mission-b", price: 2200, ...MISSION, neighborhoodId: "n-bernal" },
    ];
    const [first] = rankRentals(profile, twins, ctx);
    expect(first.id).toBe("mission-b");
    expect(first.reasons.map((r) => r.kind)).toContain("neighborhood");
  });
});

describe("rentals.search", () => {
  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
  type Result = {
    needsBrief: boolean;
    results: { _id: string; reasons: { kind: string; sources: unknown }[]; pin: unknown }[];
  };
  const search = (ctx: MutationCtx, args: Record<string, unknown> = {}) =>
    (rentals.search as unknown as { _handler: Handler })._handler(ctx, {
      viewerId: "users:v",
      ...args,
    }) as Promise<Result>;
  const fact = (key: string, value: unknown, i: number): Row => ({
    _id: `cityProfileFacts:${i}`,
    userId: "users:v",
    key,
    value,
    source: "stated",
    evidence: { kind: "brief", summary: "You said so in your brief" },
    confidence: 1,
    updatedAt: 1,
  });
  const rental = (
    id: string,
    price: number,
    extra: Record<string, unknown>,
    hood?: string,
  ): Row => ({
    _id: `listings:${id}`,
    sellerId: "users:s",
    category: "propertyrentals",
    createdAt: Number(id.replace(/\D/g, "")),
    status: "active",
    title: id,
    description: "",
    price,
    photos: [],
    badges: [],
    location: { city: "San Francisco, CA", ...MISSION },
    ...(hood && { neighborhoodId: `neighborhoods:${hood}` }),
    rental: { propertyType: "apartment", listingType: "rent", bedrooms: 1, bathrooms: 1, ...extra },
  });
  const world = (facts: Row[]) =>
    fakeCtx({
      users: [
        { _id: "users:v", name: "v", username: "v" },
        { _id: "users:s", name: "s", username: "s" },
      ],
      cityProfiles: [],
      cityProfileFacts: facts,
      neighborhoods: [
        { _id: "neighborhoods:mission", slug: "mission" },
        { _id: "neighborhoods:bernal-heights", slug: "bernal-heights" },
      ],
      neighborhoodFacts: [],
      listings: [
        rental("r1", 2200, { petsAllowed: true }, "mission"),
        rental("r2", 2200, {}, "bernal-heights"),
        rental("r3", 2300, { bedrooms: 2 }),
      ],
      groups: [],
      events: [],
      friendships: [],
      groupMembers: [],
      blocks: [],
    });

  test("no City Profile: newest first and a prompt to fill one in", async () => {
    const r = await search(world([]));
    expect(r.needsBrief).toBe(true);
    expect(r.results.map((x) => x._id)).toEqual(["listings:r3", "listings:r2", "listings:r1"]);
  });

  test("ranks by the profile, cites every reason, and filters must-haves", async () => {
    const ctx = world([
      fact("budget", { max: 2400 }, 1),
      fact("neighborhood", { slug: "bernal-heights" }, 2),
    ]);
    const r = await search(ctx);
    expect(r.needsBrief).toBe(false);
    expect(r.results[0]._id).toBe("listings:r2");
    expect(r.results[0].reasons.map((x) => x.kind).sort()).toEqual(["budget", "neighborhood"]);
    for (const x of r.results) {
      expect(x.pin).not.toBeNull();
      for (const reason of x.reasons) expect(reason.sources).not.toBeNull();
    }
    const pets = await search(ctx, { filters: { pets: true } });
    expect(pets.results.map((x) => x._id)).toEqual(["listings:r1"]);
    const big = await search(ctx, { filters: { bedrooms: 2 } });
    expect(big.results.map((x) => x._id)).toEqual(["listings:r3"]);
  });
});
