import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import {
  availableLabel,
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
  trustPart,
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
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
  test("below the minimum is still affordable, but never called inside the budget", () => {
    expect(budgetPart({ id: "a", price: 1200 }, maya.budget)).toEqual([
      1,
      {
        kind: "budget",
        text: "$1,200, under your $1,800 minimum",
        tone: "good",
        sources: ["listing:a"],
      },
    ]);
    expect(budgetPart({ id: "a", price: 1200 }, { max: 2400 })[1]?.text).toBe(
      "$1,200, inside your budget",
    );
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

describe("transitPart with Muni buses", () => {
  const buses = (...lines: string[]) => ({ factKey: "f:svc", lines });
  test("Muni buses in the neighborhood count for someone who rides Muni", () => {
    const sunset = { id: "a", price: 0, ...SUNSET, buses: buses("29", "18", "48", "28") };
    expect(transitPart(sunset, STOPS, maya.modes)).toEqual([
      0.75,
      {
        kind: "transit",
        text: "Muni 18, 28, 29 and 1 more bus line stop in the neighborhood",
        tone: "good",
        sources: ["f:svc"],
      },
    ]);
    // Unknown modes include Muni.
    expect(transitPart(sunset, STOPS, null)[0]).toBe(0.75);
    // Without a point, the neighborhood's buses still count.
    const noPoint = { id: "a", price: 0, lat: null, lng: null, buses: buses("29") };
    expect(transitPart(noPoint, STOPS, maya.modes)[1]?.text).toBe(
      "Muni 29 bus stops in the neighborhood",
    );
    expect(transitPart({ ...noPoint, buses: buses("29", "18") }, STOPS, maya.modes)[1]?.text).toBe(
      "Muni 18 and 29 buses stop in the neighborhood",
    );
  });
  test("only for Muni riders, and a short walk to rail still wins", () => {
    const sunset = { id: "a", price: 0, ...SUNSET, buses: buses("29", "18", "48") };
    expect(transitPart(sunset, STOPS, ["bart"])[1]).toMatchObject({
      text: "No BART stop within walking distance",
      tone: "bad",
    });
    const mission = { id: "a", price: 0, ...MISSION, buses: buses("14", "49", "67") };
    const [score, reason] = transitPart(mission, STOPS, maya.modes);
    expect(score).toBe(1);
    expect(reason?.sources).toEqual(["f:24th"]);
  });
});

describe("trustPart", () => {
  const signal = (text: string, ...sources: string[]) => ({ text, sources });
  test("nothing stood out: no penalty and no warning", () => {
    expect(trustPart({ id: "a" })).toEqual([0, null]);
    expect(trustPart({ id: "a", trust: { reported: false, signals: [] } })).toEqual([0, null]);
  });
  test("signals cost points and lead with a warning citing their evidence and the listing", () => {
    const [penalty, reason] = trustPart({
      id: "a",
      trust: {
        reported: false,
        signals: [
          signal("Price is 45% below similar listings", "listing:c1", "listing:c2"),
          signal("New account with no one you know"),
        ],
      },
    });
    expect(penalty).toBeCloseTo(0.4);
    expect(reason).toEqual({
      kind: "trust",
      text: "Price is 45% below similar listings, and 1 more to check",
      tone: "bad",
      sources: ["listing:c1", "listing:c2", "listing:a"],
    });
  });
  test("a listing the viewer reported says so and drops below the rest", () => {
    const [penalty, reason] = trustPart({ id: "a", trust: { reported: true, signals: [] } });
    expect(penalty).toBe(1);
    expect(reason).toMatchObject({ text: "You reported this listing", sources: ["listing:a"] });
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
  // Noon in San Francisco on the day, as the listing composer stores a picked date.
  const at = (days: number | null) => ({
    id: "a",
    price: 0,
    lat: null,
    lng: null,
    availableFrom: days === null ? null : NOW + days * DAY + 20 * HOUR,
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
  test("dates are San Francisco days, whatever the viewer's or server's time zone", () => {
    // 9pm in San Francisco on Dec 5 is already Dec 6 in UTC.
    const late = Date.UTC(2026, 11, 6, 5);
    expect(availableLabel(late, NOW)).toBe("Available Dec 5");
    expect(availableLabel(null, NOW)).toBe("Available now");
    // Later today in San Francisco is available now, not "Available Oct 31".
    expect(availableLabel(NOW + 2 * HOUR, NOW)).toBe("Available now");
    const [, reason] = moveInPart({ ...at(null), availableFrom: late }, Date.UTC(2026, 11, 5), NOW);
    expect(reason?.text).toBe("Available Dec 5, around your move-in");
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
  test("things to check demote a listing, and one the viewer reported goes last", () => {
    const flags = { reported: false, signals: [{ text: "Price is 45% below", sources: [] }] };
    const ranked = rankRentals(
      maya,
      [
        { id: "mission-reported", price: 2200, ...MISSION, trust: { reported: true, signals: [] } },
        { id: "mission-flagged", price: 2200, ...MISSION, trust: flags },
        { id: "mission-fit", price: 2200, ...MISSION },
        ...listings.filter((l) => l.id !== "mission-fit"),
      ],
      ctx,
    );
    // The same rental without the signal ranks first; the reported one, last.
    expect(ranked.map((f) => f.id)).toEqual([
      "mission-fit",
      "mission-flagged",
      "mission-over",
      "sunset-cheap",
      "mission-reported",
    ]);
    expect(ranked[1].score).toBeCloseTo(ranked[0].score - 0.2);
    const flagged = ranked.find((f) => f.id === "mission-flagged");
    expect(flagged?.reasons[0]).toMatchObject({ kind: "trust", tone: "bad" });
    expect(flagged?.reasons.length).toBe(3);
    expect(ranked.at(-1)?.reasons[0].text).toBe("You reported this listing");
  });
});

describe("rentals.search", () => {
  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
  type Result = {
    needsBrief: boolean;
    results: {
      _id: string;
      reasons: { kind: string; text: string; tone: string; sources: unknown }[];
      pin: unknown;
      area: { slug: string; label: string } | null;
    }[];
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
  const local = { joinedAt: 0, city: "San Francisco, CA" };
  const world = (facts: Row[], extra: { listings?: Row[]; users?: Row[]; reports?: Row[] } = {}) =>
    fakeCtx({
      users: [
        { _id: "users:v", name: "v", username: "v", ...local },
        { _id: "users:s", name: "s", username: "s", ...local },
        ...(extra.users ?? []),
      ],
      reports: extra.reports ?? [],
      cityProfiles: [],
      cityProfileFacts: facts,
      neighborhoods: [
        { _id: "neighborhoods:mission", slug: "mission", name: "Mission" },
        { _id: "neighborhoods:bernal-heights", slug: "bernal-heights", name: "Bernal Heights" },
      ],
      neighborhoodFacts: [],
      listings: [
        rental("r1", 2200, { petsAllowed: true }, "mission"),
        rental("r2", 2200, {}, "bernal-heights"),
        rental("r3", 2300, { bedrooms: 2 }),
        ...(extra.listings ?? []),
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

  test("each result links its neighborhood from neighborhoodId, not the typed name", async () => {
    for (const r of [
      await search(world([])),
      await search(world([fact("budget", { max: 2400 }, 1)])),
    ])
      expect(Object.fromEntries(r.results.map((x) => [x._id, x.area]))).toEqual({
        "listings:r1": { slug: "mission", label: "Mission" },
        "listings:r2": { slug: "bernal-heights", label: "Bernal Heights" },
        "listings:r3": null,
      });
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

  test("listings with things to check rank lower and say why, even without a City Profile", async () => {
    // A brand-new lister far away, on a rental priced well under the three like it.
    const newcomer = {
      _id: "users:m",
      name: "m",
      username: "m",
      joinedAt: Date.now() - 6 * DAY,
      city: "Phoenix, Arizona",
    };
    const scam = { ...rental("r9", 1100, {}, "mission"), sellerId: "users:m" };
    const extra = { users: [newcomer], listings: [rental("r4", 2200, {}, "mission"), scam] };
    for (const facts of [[], [fact("budget", { max: 2400 }, 1)]]) {
      const r = await search(world(facts, extra));
      const ids = r.results.map((x) => x._id);
      expect(ids.at(-1)).toBe("listings:r9");
      const [warning] = r.results[ids.length - 1].reasons;
      expect(warning).toMatchObject({
        kind: "trust",
        tone: "bad",
        text: "Price is 50% below similar listings, and 2 more to check",
      });
      expect(warning.sources).not.toBeNull();
      // The others have nothing to check.
      for (const x of r.results.slice(0, -1))
        expect(x.reasons.map((y) => y.kind)).not.toContain("trust");
    }
  });

  test("a listing the viewer reported goes last, saying they reported it", async () => {
    const reports = [
      {
        _id: "reports:1",
        userId: "users:v",
        targetType: "listing",
        targetId: "listings:r2",
        reason: "Scam",
        createdAt: 1,
      },
    ];
    const ctx = world(
      [fact("budget", { max: 2400 }, 1), fact("neighborhood", { slug: "bernal-heights" }, 2)],
      { reports },
    );
    const r = await search(ctx);
    expect(r.results.map((x) => x._id)).toEqual(["listings:r1", "listings:r3", "listings:r2"]);
    expect(r.results[2].reasons[0]).toMatchObject({
      kind: "trust",
      text: "You reported this listing",
    });
  });

  test("Muni bus lines in the listing's neighborhood are a cited transit reason", async () => {
    const ctx = world([fact("transport", { modes: ["muni"] }, 1)]);
    const facts = (ctx.db as unknown as { insert: (t: string, r: object) => Promise<string> })
      .insert;
    await facts("neighborhoodFacts", {
      neighborhoodId: "neighborhoods:bernal-heights",
      key: "service:bernal-heights",
      kind: "transit_service",
      name: "Transit service",
      tripsPerHour: 20,
      routes: [
        { line: "24", name: "24 Divisadero", mode: "bus", allNight: true },
        { line: "67", name: "67 Bernal Heights", mode: "bus", allNight: false },
        { line: "J", name: "J Church", mode: "metro", allNight: false },
      ],
      lastTrains: [],
      citations: { first: { kind: "listing", listingId: "listings:r1" }, rest: [] },
    });
    const r = await search(ctx);
    const bernal = r.results.find((x) => x._id === "listings:r2");
    expect(bernal?.reasons).toContainEqual(
      expect.objectContaining({
        kind: "transit",
        text: "Muni 24 and 67 buses stop in the neighborhood",
      }),
    );
  });
});
