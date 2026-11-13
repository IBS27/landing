import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import * as home from "../convex/home";
import {
  daysBetween,
  MOVE_IN_GRACE_DAYS,
  moveInOf,
  moveOutOf,
  type PlaceFacts,
  pickSteps,
  relativeDays,
  SETTLING_DAYS,
  type Stage,
  type StepInput,
  stageOf,
} from "../convex/lib/homeTimeline";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

const TODAY = "2026-11-13";
const MISSION = { slug: "mission", name: "Mission" };
const BERNAL = { slug: "bernal-heights", name: "Bernal Heights" };
const LISTING = "listing1" as Id<"listings">;

/** A date `n` days from TODAY. */
function day(n: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function place(p: Partial<PlaceFacts> = {}): PlaceFacts {
  return {
    status: "moving_in",
    moveIn: day(12),
    moveOut: null,
    neighborhood: MISSION,
    listingTitle: "Sunny 1BR on Valencia",
    ...p,
  };
}

function input(i: Partial<StepInput> = {}): StepInput {
  return {
    today: TODAY,
    briefDone: true,
    place: null,
    plannedMoveIn: null,
    neighborhoods: [],
    ...i,
  };
}

const ids = (stage: Stage, i: StepInput) => {
  const { nextStep, alsoSteps } = pickSteps(stage, i);
  return [nextStep, ...alsoSteps].map((s) => s?.id);
};

describe("dates", () => {
  test("daysBetween counts calendar days", () => {
    expect(daysBetween("2026-11-13", "2026-11-25")).toBe(12);
    expect(daysBetween("2026-11-25", "2026-11-13")).toBe(-12);
    // Across the November DST change and a year end.
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  test("relativeDays", () => {
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("tomorrow");
    expect(relativeDays(12)).toBe("in 12 days");
    expect(relativeDays(-1)).toBe("yesterday");
    expect(relativeDays(-16)).toBe("16 days ago");
  });

  test("move-in comes from the place, else the brief", () => {
    expect(moveInOf(input({ place: place() }))).toEqual({
      date: day(12),
      month: day(12).slice(0, 7),
      days: 12,
      from: "place",
    });
    expect(moveInOf(input({ plannedMoveIn: { month: "2027-03", date: "2027-03-01" } }))?.days).toBe(
      108,
    );
    expect(moveInOf(input({ plannedMoveIn: { month: "2027-03" } }))).toEqual({
      date: null,
      month: "2027-03",
      days: null,
      from: "profile",
    });
    expect(moveInOf(input())).toBeNull();
  });

  test("move-out shows only while moving out", () => {
    expect(
      moveOutOf(input({ place: place({ status: "moving_out", moveOut: day(18) }) }))?.days,
    ).toBe(18);
    expect(moveOutOf(input({ place: place({ status: "living", moveOut: day(18) }) }))).toBeNull();
  });
});

describe("stageOf", () => {
  test("no place: not started without a brief, searching with one", () => {
    expect(stageOf(input({ briefDone: false }))).toBe("not_started");
    expect(stageOf(input())).toBe("searching");
  });

  test("a place without a brief still follows the place", () => {
    expect(stageOf(input({ briefDone: false, place: place() }))).toBe("moving_in");
  });

  test("moving in: ahead, on the day, and up to the grace period after", () => {
    expect(stageOf(input({ place: place({ moveIn: day(400) }) }))).toBe("moving_in");
    expect(stageOf(input({ place: place({ moveIn: day(0) }) }))).toBe("moving_in");
    expect(stageOf(input({ place: place({ moveIn: day(-MOVE_IN_GRACE_DAYS) }) }))).toBe(
      "moving_in",
    );
    // Long past and never updated: they live there.
    expect(stageOf(input({ place: place({ moveIn: day(-MOVE_IN_GRACE_DAYS - 1) }) }))).toBe(
      "settling_in",
    );
    expect(stageOf(input({ place: place({ moveIn: day(-SETTLING_DAYS) }) }))).toBe("settled");
  });

  test("living: settling in for the first 60 days, then settled", () => {
    const living = (n: number) =>
      stageOf(input({ place: place({ status: "living", moveIn: day(n) }) }));
    expect(living(0)).toBe("settling_in");
    expect(living(-(SETTLING_DAYS - 1))).toBe("settling_in");
    expect(living(-SETTLING_DAYS)).toBe("settled");
    expect(living(-400)).toBe("settled");
    // A future date (not allowed by My Place) still reads as settling in, not settled.
    expect(living(3)).toBe("settling_in");
  });

  test("moving out wins over dates; moved out is no place", () => {
    expect(stageOf(input({ place: place({ status: "moving_out", moveIn: day(-900) }) }))).toBe(
      "moving_out",
    );
    expect(stageOf(input({ place: place({ status: "moved_out" }) }))).toBe("searching");
  });

  test("an unreadable date never skips ahead", () => {
    expect(stageOf(input({ place: place({ status: "living", moveIn: "soon" }) }))).toBe(
      "settling_in",
    );
  });
});

describe("pickSteps", () => {
  test("not started: set up the City Profile first", () => {
    const i = input({ briefDone: false, saved: { count: 0, newest: null } });
    const { nextStep } = pickSteps("not_started", i);
    expect(nextStep?.id).toBe("setUpProfile");
    expect(nextStep?.link).toEqual({ to: "welcome" });
    expect(ids("not_started", i)).toEqual(["setUpProfile", "findRentals", "exploreNeighborhoods"]);
  });

  test("searching with nothing saved: search, then compare the profile's two neighborhoods", () => {
    const i = input({
      neighborhoods: [MISSION, BERNAL],
      saved: { count: 0, newest: null },
      crew: { optedIn: false, canJoin: true },
      plannedMoveIn: { month: "2027-03" },
    });
    expect(ids("searching", i)).toEqual(["findRentals", "compareNeighborhoods", "joinCrew"]);
    const { alsoSteps } = pickSteps("searching", i);
    expect(alsoSteps[0]?.link).toEqual({ to: "compare", a: "mission", b: "bernal-heights" });
    expect(alsoSteps[0]?.reason).toContain(
      "Mission and Bernal Heights are both in your City Profile",
    );
    expect(alsoSteps[1]?.reason).toBe(
      "You're moving in March 2027 and haven't joined a Move-in Crew. Meet people arriving when you do.",
    );
  });

  test("searching with a saved rental: I'm taking this place, linking to it", () => {
    const i = input({
      neighborhoods: [MISSION],
      saved: { count: 2, newest: { listingId: LISTING, title: "Sunny 1BR" } },
      crew: { optedIn: true, canJoin: true },
    });
    const { nextStep, alsoSteps } = pickSteps("searching", i);
    expect(nextStep?.id).toBe("takePlace");
    expect(nextStep?.link).toEqual({ to: "rental", listingId: LISTING });
    expect(nextStep?.reason).toContain("You saved “Sunny 1BR”");
    expect(alsoSteps.map((s) => s.id)).toEqual(["exploreNeighborhoods"]);
  });

  test("the crew step needs something to match on", () => {
    const i = input({
      saved: { count: 0, newest: null },
      crew: { optedIn: false, canJoin: false },
    });
    expect(ids("searching", i)).not.toContain("joinCrew");
  });

  describe("moving in", () => {
    const base = (days: number, more: Partial<StepInput> = {}) =>
      input({
        place: place({ moveIn: day(days) }),
        crew: { optedIn: false, canJoin: true },
        unit: false,
        rooms: 0,
        movers: { requested: false },
        ...more,
      });

    test("mover quotes lead within 30 days, with the countdown as the reason", () => {
      const { nextStep } = pickSteps("moving_in", base(12));
      expect(nextStep?.id).toBe("moverQuotes");
      expect(nextStep?.reason).toBe(
        "Move-in is in 12 days and you haven't asked movers for quotes.",
      );
      expect(pickSteps("moving_in", base(30)).nextStep?.id).toBe("moverQuotes");
    });

    test("further out, the crew leads and mover quotes wait", () => {
      const { nextStep } = pickSteps("moving_in", base(31));
      expect(nextStep?.id).toBe("joinCrew");
      expect(nextStep?.reason).toBe(
        "You're moving to Mission in 31 days and haven't joined a Move-in Crew. Meet people arriving when you do.",
      );
      expect(ids("moving_in", base(31))).toEqual([
        "joinCrew",
        "planUnit",
        "addRoom",
        "moverQuotes",
      ]);
      expect(
        ids(
          "moving_in",
          base(31, { crew: { optedIn: true, canJoin: true }, unit: true, rooms: 1 }),
        ),
      ).toEqual(["moverQuotes"]);
    });

    test("no mover quotes when the feature isn't there or they asked already", () => {
      expect(ids("moving_in", base(5, { movers: null }))).not.toContain("moverQuotes");
      expect(ids("moving_in", base(5, { movers: { requested: true } }))).not.toContain(
        "moverQuotes",
      );
    });

    test("past the move-in date: ask them to mark it, no mover quotes", () => {
      const i = base(-16, {
        checkIn: { week: 3, text: "2 weeks in: 1 event. Your check-in is ready." },
      });
      const { nextStep, alsoSteps } = pickSteps("moving_in", i);
      expect(nextStep?.id).toBe("markMovedIn");
      expect(nextStep?.reason).toBe(
        `Your move-in date was ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(Date.parse(`${day(-16)}T00:00:00Z`))}, and My Place still says you're moving in.`,
      );
      expect(alsoSteps.map((s) => s.id)).toEqual(["checkIn", "joinCrew", "planUnit"]);
      expect(alsoSteps[1]?.reason).toStartWith("You moved to Mission 16 days ago");
    });

    test("on move-in day it's not 'moved in yet?'", () => {
      expect(ids("moving_in", base(0))).not.toContain("markMovedIn");
      expect(pickSteps("moving_in", base(0)).nextStep?.reason).toBe(
        "Move-in is today and you haven't asked movers for quotes.",
      );
    });

    test("the 3D step names the listing", () => {
      const i = base(40, { crew: { optedIn: true, canJoin: true } });
      expect(pickSteps("moving_in", i).nextStep).toMatchObject({
        id: "planUnit",
        reason: "You haven't laid out “Sunny 1BR on Valencia” in 3D yet.",
        link: { to: "unit" },
      });
    });

    test("no brief: set up the City Profile is offered too", () => {
      const i = base(40, {
        briefDone: false,
        crew: { optedIn: false, canJoin: false },
        unit: true,
        rooms: 2,
        movers: null,
      });
      expect(ids("moving_in", i)).toEqual(["setUpProfile"]);
    });
  });

  test("settling in: this week's check-in first, its text as the reason", () => {
    const i = input({
      place: place({ status: "living", moveIn: day(-20) }),
      checkIn: { week: 3, text: "2 weeks in: 2 events and 1 Group. Your check-in is ready." },
      crew: { optedIn: false, canJoin: true },
      items: { total: 0, unlisted: 0 },
      unit: false,
    });
    const { nextStep, alsoSteps } = pickSteps("settling_in", i);
    expect(nextStep).toMatchObject({
      id: "checkIn",
      title: "Week 3 check-in",
      reason: "2 weeks in: 2 events and 1 Group. Your check-in is ready.",
      link: { to: "journeys" },
    });
    expect(alsoSteps.map((s) => s.id)).toEqual(["joinCrew", "trackItems", "planUnit"]);
  });

  test("settled: always something to do in their neighborhood", () => {
    const i = input({
      place: place({ status: "living", moveIn: day(-120) }),
      checkIn: null,
      items: { total: 4, unlisted: 4 },
      unit: true,
    });
    const { nextStep, alsoSteps } = pickSteps("settled", i);
    expect(nextStep).toMatchObject({
      id: "exploreHome",
      reason: "You've lived in Mission for 120 days. See its Groups, Events and Weekend Route.",
      link: { to: "neighborhood", slug: "mission" },
    });
    expect(alsoSteps).toEqual([]);
  });

  describe("moving out", () => {
    const out = (more: Partial<StepInput> = {}, moveOut: string | null = day(18)) =>
      input({
        place: place({ status: "moving_out", moveIn: day(-300), moveOut }),
        sublet: false,
        items: { total: 3, unlisted: 2 },
        ...more,
      });

    test("sublet first, then selling unlisted items", () => {
      const { nextStep, alsoSteps } = pickSteps("moving_out", out());
      expect(nextStep).toMatchObject({
        id: "sublet",
        reason: "You're moving out in 18 days and haven't listed a sublet.",
        link: { to: "moveOut" },
      });
      expect(alsoSteps[0]).toMatchObject({
        id: "sellItems",
        title: "Sell 2 things you own",
        reason: "2 items you track aren't listed for sale yet.",
      });
    });

    test("no date, a live sublet, one item", () => {
      const i = out({ sublet: true, items: { total: 1, unlisted: 1 } }, null);
      expect(pickSteps("moving_out", i).nextStep?.reason).toBe(
        "1 item you track isn't listed for sale yet.",
      );
      expect(ids("moving_out", out({}, null))[0]).toBe("sublet");
      expect(pickSteps("moving_out", out({}, null)).nextStep?.reason).toBe(
        "You're moving out and haven't listed a sublet.",
      );
    });

    test("nothing tracked: track items first", () => {
      expect(ids("moving_out", out({ sublet: true, items: { total: 0, unlisted: 0 } }))).toEqual([
        "trackItems",
      ]);
    });

    test("past the move-out date: ask them to mark it", () => {
      expect(pickSteps("moving_out", out({}, day(-2))).nextStep?.id).toBe("markMovedOut");
      expect(ids("moving_out", out({}, day(0)))).not.toContain("markMovedOut");
    });
  });

  test("a fact that wasn't read never produces a step", () => {
    const i = input({ place: place({ status: "living", moveIn: day(-10) }) });
    expect(ids("settling_in", i)).toEqual([]);
    expect(ids("moving_out", input({ place: place({ status: "moving_out" }) }))).toEqual([]);
  });

  test("at most three also-steps", () => {
    const i = input({
      briefDone: false,
      place: place({ moveIn: day(-5) }),
      crew: { optedIn: false, canJoin: true },
      unit: false,
      rooms: 0,
      checkIn: { week: 1, text: "Your first check-in is ready." },
    });
    expect(pickSteps("moving_in", i).alsoSteps).toHaveLength(3);
  });
});

/* ---------- api.home.timeline ---------- */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
type Timeline = Awaited<ReturnType<typeof timeline>>;
async function timeline(ctx: MutationCtx, viewer: string, args: Record<string, unknown> = {}) {
  const run = (home.timeline as unknown as { _handler: Handler })._handler;
  return (await run(ctx, { viewerId: `users:${viewer}`, ...args })) as {
    today: string;
    stage: Stage;
    place: PlaceFacts | null;
    moveIn: { date: string | null; days: number | null; from: string } | null;
    nextStep: { id: string; link: unknown; reason: string } | null;
    alsoSteps: { id: string }[];
    comingUp: {
      events: { _id: string; title: string }[];
      checkIn: { text: string; week: number } | null;
      drafts: { count: number } | null;
    };
  };
}

describe("home.timeline", () => {
  beforeEach(() => setSystemTime(new Date(`${TODAY}T20:00:00Z`)));
  afterEach(() => setSystemTime());

  const fact = (userId: string, key: string, value: unknown, i: number): Row => ({
    _id: `cityProfileFacts:${userId}-${key}-${i}`,
    userId: `users:${userId}`,
    key,
    value,
    source: "stated",
    evidence: { kind: "brief", summary: "You said so in your brief" },
    confidence: 1,
    updatedAt: 1,
  });

  const rental = (id: string, extra: Partial<Row> = {}): Row => ({
    _id: `listings:${id}`,
    sellerId: "users:lister",
    title: `Rental ${id}`,
    description: "",
    price: 2400,
    photos: [],
    category: "property_rentals",
    status: "active",
    location: { neighborhood: "Mission" },
    rental: { propertyType: "apartment", listingType: "rent", bedrooms: 1, bathrooms: 1 },
    neighborhoodId: "neighborhoods:mission",
    createdAt: 1,
    ...extra,
  });

  function world() {
    const tables: Record<string, Row[]> = {
      users: ["maya", "zed", "new", "lister", "blocked"].map((u) => ({
        _id: `users:${u}`,
        name: u,
        firstName: u,
        username: u,
        avatar: "",
      })),
      friendships: [],
      groupMembers: [],
      blocks: [{ _id: "blocks:1", userId: "users:maya", blockedId: "users:blocked", createdAt: 1 }],
      userSettings: [],
      neighborhoods: [
        { _id: "neighborhoods:mission", slug: "mission", name: "Mission" },
        { _id: "neighborhoods:noe", slug: "noe-valley", name: "Noe Valley" },
      ],
      listings: [
        rental("a"),
        rental("b"),
        rental("hidden", { sellerId: "users:blocked" }),
        rental("couch", { category: "furniture", rental: undefined }),
      ],
      cityProfiles: ["maya", "zed"].map((u) => ({
        _id: `cityProfiles:${u}`,
        userId: `users:${u}`,
        briefCompletedAt: 1,
        updatedAt: 1,
      })),
      cityProfileFacts: [
        fact("maya", "neighborhood", { slug: "mission" }, 1),
        fact("maya", "neighborhood", { slug: "noe-valley" }, 2),
        fact("maya", "moveIn", { month: "2026-11", date: day(12) }, 3),
        fact("zed", "neighborhood", { slug: "noe-valley" }, 1),
      ],
      places: [],
      saved: [],
      crewOptIns: [],
      rooms: [],
      unitScenes: [],
      ownedItems: [],
      sublets: [],
      journeys: [],
      eventResponses: [],
      events: [],
      reminders: [],
      chatPlans: [],
      proposals: [],
    };
    return tables;
  }

  const placeRow = (userId: string, p: Partial<Row>): Row => ({
    _id: `places:${userId}`,
    userId: `users:${userId}`,
    neighborhoodId: "neighborhoods:mission",
    moveIn: day(12),
    status: "moving_in",
    createdAt: 1,
    updatedAt: 1,
    ...p,
  });

  const save = (userId: string, ref: string, kind: string, at: number): Row => ({
    _id: `saved:${userId}-${ref}`,
    userId: `users:${userId}`,
    kind,
    refId: ref,
    createdAt: at,
  });

  test("a new user: not started, set up the City Profile", async () => {
    const t = await timeline(fakeCtx(world()), "new");
    expect(t.stage).toBe("not_started");
    expect(t.place).toBeNull();
    expect(t.moveIn).toBeNull();
    expect(t.nextStep?.id).toBe("setUpProfile");
    expect(t.comingUp).toEqual({ events: [], checkIn: null, drafts: null });
  });

  test("searching: the newest saved rental they can still see, never a hidden one", async () => {
    const tables = world();
    tables.saved = [
      save("maya", "listings:a", "listing", 1),
      save("maya", "listings:b", "listing", 2),
      save("maya", "listings:couch", "listing", 3),
      save("maya", "listings:hidden", "listing", 4),
      save("maya", "posts:x", "post", 5),
      // Someone else's save is never read.
      save("zed", "listings:a", "listing", 9),
    ];
    const t = await timeline(fakeCtx(tables), "maya");
    expect(t.stage).toBe("searching");
    expect(t.moveIn).toMatchObject({ date: day(12), days: 12, from: "profile" });
    expect(t.nextStep).toMatchObject({
      id: "takePlace",
      link: { to: "rental", listingId: "listings:b" },
    });
    expect(t.alsoSteps.map((s) => s.id)).toEqual(["compareNeighborhoods", "joinCrew"]);
  });

  test("Maya moving in: her place, never anyone else's", async () => {
    const tables = world();
    tables.places = [
      placeRow("maya", { listingId: "listings:a" }),
      placeRow("zed", { status: "moving_out", moveIn: day(-400), moveOut: day(3) }),
    ];
    const t = await timeline(fakeCtx(tables), "maya");
    expect(t.stage).toBe("moving_in");
    expect(t.place).toEqual({
      status: "moving_in",
      moveIn: day(12),
      moveOut: null,
      neighborhood: { slug: "mission", name: "Mission" },
      listingTitle: "Rental a",
    });
    expect(t.moveIn).toMatchObject({ days: 12, from: "place" });
    expect(t.nextStep?.id).toBe("joinCrew");
    expect(t.alsoSteps.map((s) => s.id)).toEqual(["planUnit", "addRoom"]);

    const z = await timeline(fakeCtx(tables), "zed");
    expect(z.stage).toBe("moving_out");
    expect(z.place?.listingTitle).toBeNull();
  });

  test("settled: their neighborhood, and items they track", async () => {
    const tables = world();
    tables.places = [placeRow("maya", { status: "living", moveIn: day(-90) })];
    tables.unitScenes = [
      { _id: "unitScenes:1", ownerId: "users:maya", listingId: undefined, updatedAt: 1 },
    ];
    const t = await timeline(fakeCtx(tables), "maya");
    expect(t.stage).toBe("settled");
    expect(t.nextStep?.id).toBe("trackItems");
    expect(t.alsoSteps.map((s) => s.id)).toEqual(["exploreHome"]);
  });

  test("this week's check-in is coming up once written, and leads while settling in", async () => {
    const tables = world();
    tables.places = [placeRow("maya", { status: "living", moveIn: day(-12) })];
    tables.cityProfileFacts = tables.cityProfileFacts?.map((f) =>
      f.key === "moveIn" ? { ...f, value: { month: "2026-11", date: day(-12) } } : f,
    );
    tables.crewOptIns = [{ _id: "crewOptIns:1", userId: "users:maya", matchBy: {}, createdAt: 1 }];
    tables.journeys = [
      {
        _id: "journeys:1",
        userId: "users:maya",
        weekOf: "2026-11-14",
        week: 2,
        startsAt: 0,
        endsAt: Date.parse("2026-11-17T08:00:00Z"),
        checkIn: {
          from: 0,
          to: 0,
          week: { events: [], groups: [], friends: [], journeyStops: [] },
          total: { events: ["events:1", "events:2"], groups: [], friends: [], journeyStops: [] },
          computedAt: 1,
        },
      },
    ];
    const t = await timeline(fakeCtx(tables), "maya");
    expect(t.stage).toBe("settling_in");
    expect(t.nextStep).toMatchObject({
      id: "checkIn",
      reason: "1 week in: 2 events. Your check-in is ready.",
    });
    // Already the next step, so not repeated under "Coming up".
    expect(t.comingUp.checkIn).toBeNull();
  });

  test("Events they're going to in the next week, soonest first, at most 3", async () => {
    const tables = world();
    const now = Date.parse(`${TODAY}T20:00:00Z`);
    const hour = 3_600_000;
    tables.events = [1, 30, 5, 2, 200, -1].map((h, i) => ({
      _id: `events:${i}`,
      title: `Event ${h}h`,
      hostId: i === 3 ? "users:blocked" : "users:lister",
      startAt: now + h * hour,
      online: false,
      cover: "",
      privacy: "public",
    }));
    tables.eventResponses = (tables.events ?? []).map((e, i) => ({
      _id: `eventResponses:${i}`,
      eventId: e._id,
      userId: "users:maya",
      status: "going",
      createdAt: 1,
    }));
    const t = await timeline(fakeCtx(tables), "maya");
    expect(t.comingUp.events.map((e) => e.title)).toEqual(["Event 1h", "Event 5h", "Event 30h"]);
    expect((await timeline(fakeCtx(tables), "zed")).comingUp.events).toEqual([]);
  });

  test("a client date more than a day off is ignored", async () => {
    const tables = world();
    expect((await timeline(fakeCtx(tables), "maya", { today: day(1) })).today).toBe(day(1));
    expect((await timeline(fakeCtx(tables), "maya", { today: "2030-01-01" })).today).toBe(TODAY);
    expect((await timeline(fakeCtx(tables), "maya", { today: "nope" })).today).toBe(TODAY);
  });

  test("reads stay bounded however much the person has", async () => {
    const tables = world();
    tables.places = [
      placeRow("maya", { status: "moving_out", moveIn: day(-400), moveOut: day(20) }),
    ];
    tables.ownedItems = Array.from({ length: 2000 }, (_, i) => ({
      _id: `ownedItems:${i}`,
      userId: "users:maya",
      title: `Thing ${i}`,
      acquiredAt: i,
    }));
    tables.saved = Array.from({ length: 2000 }, (_, i) =>
      save("maya", `listings:a${i}`, "listing", i),
    );
    tables.sublets = Array.from({ length: 50 }, (_, i) => ({
      _id: `sublets:${i}`,
      ownerId: "users:maya",
      listingId: `listings:gone${i}`,
      createdAt: i,
    }));
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const t: Timeline = await timeline(fakeCtx(tables, stats), "maya");
    expect(t.stage).toBe("moving_out");
    expect(t.nextStep?.id).toBe("sublet");
    expect(t.alsoSteps[0]).toMatchObject({ id: "sellItems" });
    // Saved listings aren't read while moving out; items and sublets are capped.
    expect(stats.docs).toBeLessThan(120);
  });
});
