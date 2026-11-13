import { describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import type { InterestId } from "../convex/lib/interests";
import {
  breakdown,
  clockTime,
  foodRaw,
  hasEnoughData,
  interestFit,
  interestsForLocalEvent,
  interestsForLocalGroup,
  interestsForPlace,
  isFoodPlace,
  isNightQuote,
  isThingToDo,
  nightExcerpt,
  percentiles,
  pickNightQuotes,
  rawScore,
  type ScoreInputs,
  scoreLabel,
  scoreSources,
  thingsToDoRaw,
  transitRaw,
  withoutNeighborhoodNames,
} from "../convex/lib/neighborhoodScores";
import * as scores from "../convex/neighborhoodScores";
import type { Source } from "../convex/validators";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- Pure scoring ---------- */

const ev = (id: string, category: string, startAt = 1): ScoreInputs["events"][number] => ({
  id: id as never,
  startAt,
  category,
  title: id,
});
const post = (id: string): Source => ({ kind: "post", postId: id as never });
const ext = (id: string): Source => ({ kind: "external", externalSourceId: id as never });

const empty: ScoreInputs = {
  events: [],
  activeGroups: [],
  places: [],
  corridors: [],
  stations: [],
  metroLines: [],
  service: null,
};

const mission: ScoreInputs = {
  events: [ev("e1", "Music", 3), ev("e2", "Music", 1), ev("e3", "Games", 2)],
  activeGroups: [{ id: "g1" as never, name: "Mission Locals", lastActivityAt: 5 }],
  places: [
    {
      key: "m/park",
      name: "Dolores Park",
      kind: "park",
      mentions: [{ source: post("p1"), reactions: 4 }],
    },
    {
      key: "m/cafe",
      name: "Moonrise Coffee",
      kind: "cafe",
      mentions: [
        { source: post("p1"), reactions: 4 },
        { source: post("p2"), reactions: 9 },
      ],
    },
    {
      key: "m/street",
      name: "Clarion Alley",
      kind: "street",
      mentions: [{ source: post("p3"), reactions: 1 }],
    },
  ],
  corridors: [{ name: "Valencia Street", source: ext("valencia") }],
  stations: [
    { name: "16th Street / Mission", system: "bart", source: ext("16th") },
    { name: "Church Station", system: "muni_metro", source: ext("church") },
  ],
  metroLines: [{ name: "J Church", source: ext("j") }],
  service: {
    tripsPerHour: 200,
    routes: 25,
    allNight: ["14 Mission", "Owl Judah"],
    sources: [ext("gtfs")],
  },
};

describe("score functions", () => {
  test("place kinds split into food and things to do; streets and transit are neither", () => {
    expect(isFoodPlace("bakery")).toBe(true);
    expect(isThingToDo("park")).toBe(true);
    expect([isFoodPlace("street"), isThingToDo("street"), isThingToDo("transit")]).toEqual([
      false,
      false,
      false,
    ]);
  });

  test("things to do: Events, their kinds, active Groups and places", () => {
    // 2·3 events + 3·2 kinds + 2·1 group + 1 park (the street doesn't count).
    expect(thingsToDoRaw(mission)).toBe(15);
    expect(breakdown("things_to_do", mission)).toBe(
      "3 Events in the next 30 days (2 kinds), 1 active Group, 1 place locals recommend",
    );
    expect(breakdown("things_to_do", { ...mission, events: [ev("e1", "Music")] })).toStartWith(
      "1 Event in the next 30 days,",
    );
  });

  test("food: spots, how often they come up, and corridors", () => {
    // 3·1 cafe + 0.5·2 distinct mentions + 4·1 corridor.
    expect(foodRaw(mission)).toBe(8);
    expect(breakdown("food", mission)).toBe(
      "1 spot locals recommend across 2 posts and comments, on Valencia Street",
    );
  });

  test("transit: trips an hour, stations, Metro lines and all-night lines", () => {
    // 0.1·200 + 6·1 BART + 3·1 subway + 0.5·25 Muni lines + 2·2 all-night.
    expect(transitRaw(mission)).toBeCloseTo(45.5);
    expect(breakdown("transit", mission)).toBe(
      "16th Street / Mission · Muni Metro at Church Station · 25 Muni lines · ~200 trips an hour on weekdays · 2 all-night lines",
    );
    expect(transitRaw(empty)).toBe(0);
  });

  test("sources: most telling first, deduplicated", () => {
    expect(scoreSources("things_to_do", mission)).toEqual([
      { kind: "event", eventId: "e2" },
      { kind: "event", eventId: "e3" },
      { kind: "event", eventId: "e1" },
      { kind: "group", groupId: "g1" },
      post("p1"),
    ] as Source[]);
    // The corridor first, then mentions by reactions, each source once.
    expect(scoreSources("food", mission)).toEqual([ext("valencia"), post("p2"), post("p1")]);
    expect(scoreSources("transit", mission)).toEqual([
      ext("16th"),
      ext("gtfs"),
      ext("church"),
      ext("j"),
    ]);
  });

  test("labels follow the score", () => {
    expect(scoreLabel("transit", 9.1)).toBe("Excellent transit");
    expect(scoreLabel("food", 6)).toBe("Great food");
    expect(scoreLabel("things_to_do", 0.5)).toBe("Quieter");
  });
});

describe("enough data to score", () => {
  test("one Event, or a corridor alone, isn't enough", () => {
    const oneEvent = { ...empty, events: [ev("e1", "Music")] };
    expect(hasEnoughData("things_to_do", oneEvent)).toBe(false);
    expect(rawScore("things_to_do", oneEvent)).toBe(0);
    const corridorOnly = { ...empty, corridors: [{ name: "Polk Street", source: ext("polk") }] };
    expect(hasEnoughData("food", corridorOnly)).toBe(false);
    expect(hasEnoughData("food", mission)).toBe(true);
    expect(hasEnoughData("transit", empty)).toBe(false);
  });
  test("raw values are rounded, so equal counts tie", () => {
    const a = {
      ...empty,
      service: { tripsPerHour: 106, routes: 4, allNight: ["x"], sources: [] },
    };
    const b = {
      ...empty,
      service: { tripsPerHour: 86, routes: 0, allNight: [], sources: [] },
      stations: [{ name: "s", system: "bart" as const, source: ext("s") }],
    };
    // 10.6 + 2 + 2 and 8.6 + 6: both 14.6, though 0.1 · 106 isn't exact in floating point.
    expect(rawScore("transit", a)).toBe(rawScore("transit", b));
  });
});

describe("percentiles", () => {
  test("rank among neighborhoods with data, 0–10, ties share the middle", () => {
    const p = percentiles(
      new Map([
        ["a", 0],
        ["b", 10],
        ["c", 10],
        ["d", 30],
        ["e", 0],
      ]),
    );
    // Ranked among b, c, d only: b and c tie at the bottom half, d is on top.
    expect([...p]).toEqual([
      ["a", 0],
      ["b", 3.3],
      ["c", 3.3],
      ["d", 8.3],
      ["e", 0],
    ]);
  });
  test("a lone neighborhood with data sits in the middle", () => {
    expect(percentiles(new Map([["x", 5]])).get("x")).toBe(5);
  });
});

describe("interest fit", () => {
  const w = (pairs: [InterestId, number][]) => new Map(pairs);
  test("weighted share of interests met; two matches meet one fully", () => {
    const fit = interestFit(
      w([
        ["climbing", 1],
        ["coffee", 1],
        ["surfing", 1],
      ]),
      [
        { interests: ["climbing"], source: post("a") },
        { interests: ["climbing"], source: post("b") },
        { interests: ["coffee"], source: post("c") },
      ],
    );
    // climbing met (1), coffee half (0.5), surfing not: 1.5 / 3.
    expect(fit?.score).toBe(5);
    expect(fit?.matched.map((m) => m.interest)).toEqual(["climbing", "coffee"]);
    expect(fit?.sources).toEqual([post("a"), post("b"), post("c")]);
  });
  test("an inferred interest counts by its confidence", () => {
    const fit = interestFit(
      w([
        ["climbing", 1],
        ["coffee", 0.5],
      ]),
      [
        { interests: ["coffee"], source: post("c") },
        { interests: ["coffee"], source: post("d") },
      ],
    );
    expect(fit?.score).toBe(3.3);
  });
  test("no interests: no fit", () => {
    expect(interestFit(new Map(), [])).toBeNull();
  });
  test("places map to interests by kind and name", () => {
    expect(interestsForPlace({ kind: "cafe", name: "Moonrise Coffee" })).toContain("coffee");
    // Neighborhood names aren't interests, and a shop or market isn't thrifting or a farmers
    // market unless its name says so.
    expect(interestsForPlace({ kind: "library", name: "North Beach Branch Library" })).toEqual([
      "books",
    ]);
    expect(
      interestsForLocalGroup({
        category: "Neighborhood",
        tags: ["North Beach", "Telegraph Hill"],
        name: "North Beach & Telegraph Hill Neighbors",
      }),
    ).not.toContain("beach_days");
    expect(
      interestsForLocalEvent({ category: "Trivia", title: "North Beach trivia night" }),
    ).not.toContain("beach_days");
    expect(withoutNeighborhoodNames("Ocean Beach in the Outer Sunset")).toContain("Ocean Beach");
    expect(interestsForPlace({ kind: "shop", name: "The Rind Line" })).toEqual([]);
    expect(interestsForPlace({ kind: "market", name: "Rivet Market" })).not.toContain(
      "farmers_markets",
    );
    expect(interestsForPlace({ kind: "climbing-gym", name: "Sutro Boulders" })).toContain(
      "climbing",
    );
  });
});

describe("getting around at night", () => {
  test("phrases about lighting, getting home and late transit count", () => {
    for (const t of [
      "the little alleys (Natoma, Minna, Tehama) get dark after 6 this time of year",
      "I take the owl bus home, the N Owl runs every 30",
      "Valencia is well-lit after dark",
      "some side streets east of folsom have long gaps between streetlights",
      "I walk home from the Velvet Owl around 2am most weekends.",
      "there's no lighting on the loop at the top, so use your phone light and come down the folsom side",
      "the lighting on Cortland is good when I walk home",
    ]) {
      expect([t, isNightQuote(t)]).toEqual([t, true]);
    }
  });
  test("words that mean other things don't", () => {
    for (const t of [
      "Low Tide Radio at the Velvet Owl friday, doors 8",
      "their dark roast is the move",
      "the taqueria is open til midnight",
      "great tacos, go early",
      // Seeded strings that matched before: coffee, a scenic view, art, a fragment, a question.
      "The cortado at Dovecote Coffee is still too dark for me.",
      "you can see alamo square after dark, when downtown lights up behind them.",
      "Patricia's Green at night when the big art piece is lit up.",
      "toast (crispy. sorry ryan), decaf from slow grade on the walk home.",
      "how bad is the uphill walk home from 24th St BART, honestly",
      "board game night is two blocks from BART, every thursday",
      "I bike home from the hospital at 7am",
      "photographer opinion: Bernal Hill for the sunset itself, Dolores Park for the skyline lighting up right after.",
    ]) {
      expect([t, isNightQuote(t)]).toEqual([t, false]);
    }
  });
  test("questions and fragments ask, they don't tell", () => {
    expect(isNightQuote("which blocks are actually quiet at night?")).toBe(false);
    expect(isNightQuote("questions:\n- getting home late at night\n- groceries")).toBe(false);
    expect(
      isNightQuote(
        "2. walking home from BART after 10pm, which streets are well lit / have people around",
      ),
    ).toBe(false);
    expect(nightExcerpt("1. we walk home along Irving at night, it stays busy til 10")).toBe(
      "we walk home along Irving at night, it stays busy til 10",
    );
  });
  test("never quotes labels about an area or its people", () => {
    expect(isNightQuote("it gets sketchy at night")).toBe(false);
    expect(isNightQuote("well-lit, but the crime stats are scary")).toBe(false);
    // Safety verdicts either way, and who lives or walks here.
    expect(isNightQuote("This neighborhood is safe to walk home in after dark.")).toBe(false);
    expect(isNightQuote("Mostly young families and immigrants walk here at night.")).toBe(false);
    expect(isNightQuote("Lots of gay bars, so the streets stay busy at night.")).toBe(false);
    // Crime, and who's around: never quoted.
    expect(isNightQuote("past the encampments on Division it's dark at night.")).toBe(false);
    expect(isNightQuote("Dolores Park at night is full of transients.")).toBe(false);
    expect(isNightQuote("my car got broken into twice at night on this block.")).toBe(false);
  });
  test("quotes the sentence that says it, cut around the words when long", () => {
    expect(
      nightExcerpt(
        "Folsom and Howard are bright. the little alleys get dark after 6, I don't cut through them. BART stops around midnight.",
      ),
    ).toBe("the little alleys get dark after 6, I don't cut through them.");
    const long = `${"a ".repeat(90)}we walk home on Valencia at night, it's busy ${"b ".repeat(150)}`;
    const q = nightExcerpt(long) ?? "";
    expect(q.length).toBeLessThanOrEqual(202);
    expect(q).toContain("walk home on Valencia at night");
    expect(q.startsWith("…") && q.endsWith("…")).toBe(true);
  });
  test("most reacted first, then newest, with excerpts", () => {
    const q = (text: string, reactions: number, createdAt: number) => ({
      text,
      reactions,
      createdAt,
    });
    const picked = pickNightQuotes(
      [
        q("we walk home on Valencia, it's well-lit", 2, 1),
        q("the owl bus is fine, every 30 min on Judah", 9, 1),
        q("lunch spot", 50, 1),
        q("Capp gets dark early, stick to Mission St", 2, 5),
      ],
      3,
    );
    expect(picked.map((p) => p.quote)).toEqual([
      "the owl bus is fine, every 30 min on Judah",
      "Capp gets dark early, stick to Mission St",
      "we walk home on Valencia, it's well-lit",
    ]);
  });
  test("last trains read as clock times, past midnight included", () => {
    expect(clockTime(1517)).toBe("1:17 AM");
    expect(clockTime(1439)).toBe("11:59 PM");
    expect(clockTime(720)).toBe("12:00 PM");
  });
});

/* ---------- Stored scores: public sources only, hidden when they aren't visible ---------- */

const NOW = Date.now();
const DAY = 86_400_000;
type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const run = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown> = {}) =>
  (fn as { _handler: Handler })._handler(ctx, args);

/** Runs the `recompute` action, with its queries and mutations on the fake database. */
function recompute(ctx: MutationCtx) {
  const fns: Record<string, unknown> = {
    "neighborhoodScores:neighborhoodIds": scores.neighborhoodIds,
    "neighborhoodScores:inputsFor": scores.inputsFor,
    "neighborhoodScores:store": scores.store,
  };
  const call = (ref: FunctionReference<"query" | "mutation">, args: Record<string, unknown>) =>
    run(fns[getFunctionName(ref)], ctx, args);
  return run(scores.recompute, {
    runQuery: call,
    runMutation: call,
  } as unknown as ActionCtx as never);
}

function world() {
  const cites = (id: string) => ({ first: { kind: "external", externalSourceId: id }, rest: [] });
  const tables: Record<string, Row[]> = {
    users: [
      {
        _id: "users:v",
        name: "Viewer",
        firstName: "Viewer",
        username: "viewer",
        avatar: "",
        kind: "person",
      },
      {
        _id: "users:h",
        name: "Host",
        firstName: "Host",
        username: "host",
        avatar: "",
        kind: "person",
      },
    ],
    neighborhoods: [
      { _id: "neighborhoods:mission", slug: "mission", name: "Mission" },
      { _id: "neighborhoods:sunset", slug: "inner-sunset", name: "Inner Sunset" },
      { _id: "neighborhoods:empty", slug: "lakeshore", name: "Lakeshore" },
    ],
    externalSources: [
      {
        _id: "externalSources:16th",
        url: "https://www.bart.gov/stations/16th",
        title: "16th",
        publisher: "BART",
        snippet: "2000 Mission Street",
        fetchedAt: 1,
      },
    ],
    neighborhoodFacts: [
      {
        _id: "neighborhoodFacts:1",
        neighborhoodId: "neighborhoods:mission",
        key: "bart:16th",
        kind: "transit_station",
        system: "bart",
        name: "16th Street / Mission",
        lines: ["Red"],
        point: { lat: 37.765, lng: -122.42 },
        citations: cites("externalSources:16th"),
      },
      // A station whose only source is gone: its transit score can't be stored.
      {
        _id: "neighborhoodFacts:2",
        neighborhoodId: "neighborhoods:sunset",
        key: "muni:x",
        kind: "transit_station",
        system: "muni_metro",
        name: "Gone Station",
        lines: ["N"],
        point: { lat: 37.76, lng: -122.46 },
        citations: cites("externalSources:deleted"),
      },
    ],
    events: [
      {
        _id: "events:e1",
        hostId: "users:h",
        title: "Bouldering night",
        description: "Beginner night at the gym",
        cover: "/seed/events/climbing.jpg",
        venue: "Sutro Boulders",
        externalGoingCount: 3,
        externalInterestedCount: 5,
        category: "Fitness",
        startAt: NOW + 2 * DAY,
        online: false,
        privacy: "public",
        neighborhoodId: "neighborhoods:mission",
        city: "San Francisco, CA",
      },
    ],
    // An active public Group: "Things to do" needs one (or a place locals name), not just an Event.
    groups: [
      {
        _id: "groups:locals",
        name: "Mission Locals",
        slug: "mission-locals",
        privacy: "public",
        visible: true,
        category: "Neighborhood",
        tags: [],
        cover: "/seed/covers/mission-01.jpg",
        description: "Ask-anything Mission group",
        neighborhoodId: "neighborhoods:mission",
        memberCount: 10,
        externalMemberCount: 9,
        lastActivityAt: NOW - DAY,
        createdAt: NOW - 400 * DAY,
      },
    ],
    groupMembers: [],
    posts: [],
    comments: [],
    neighborhoodScores: [],
  };
  return { tables, ctx: fakeCtx(tables) };
}

describe("recompute and get", () => {
  test("scores are stored only with public sources", async () => {
    const { tables, ctx } = world();
    await recompute(ctx);
    const stored = tables.neighborhoodScores.map((r) => `${r.neighborhoodId}:${r.kind}`).sort();
    // Mission: an Event and an active Group (things to do), a cited BART station (transit). Inner Sunset's station
    // counts (raw > 0) but its only source is gone, so no transit score is stored. Food: no data.
    expect(stored).toEqual(["neighborhoods:mission:things_to_do", "neighborhoods:mission:transit"]);
    for (const r of tables.neighborhoodScores) {
      expect((r.citations as { first: Source }).first).toBeDefined();
    }
  });

  test("a score is hidden when one of its sources turns private", async () => {
    const { tables, ctx } = world();
    await recompute(ctx);
    const view = async () =>
      (await run(scores.get, ctx, {
        viewerId: "users:v",
        neighborhoodId: "neighborhoods:mission",
      })) as {
        scores: { kind: string; state: string }[];
      };
    expect((await view()).scores.map((s) => `${s.kind}:${s.state}`)).toEqual([
      "things_to_do:ok",
      "food:no_data",
      "transit:ok",
    ]);
    // An Event behind "Things to do" becomes friends-only: the score could repeat what it said.
    const e = tables.events.find((x) => x._id === "events:e1");
    if (e) e.privacy = "friends";
    expect((await view()).scores.map((s) => `${s.kind}:${s.state}`)).toEqual([
      "food:no_data",
      "transit:ok",
    ]);
  });

  test("only public posts are quoted, even in a public Group", async () => {
    const { tables } = world();
    tables.groups.push({
      _id: "groups:g",
      name: "Mission Neighbors",
      slug: "mission-neighbors",
      privacy: "public",
      visible: true,
      neighborhoodId: "neighborhoods:mission",
      lastActivityAt: NOW,
    });
    const post = (id: string, privacy: string, text: string) => ({
      _id: id,
      authorId: "users:v",
      groupId: "groups:g",
      privacy,
      text,
      attachments: [],
      reactionCount: 0,
      commentCount: 0,
      createdAt: NOW - DAY,
    });
    // The author's own only-me post isn't quoted, even to the author.
    tables.posts.push(
      post("posts:mine", "only_me", "We walk home along Capp, it's well lit and busy."),
      post("posts:public", "public", "We walk home along Valencia, it's well lit and busy."),
    );
    const r = (await run(scores.get, fakeCtx(tables), {
      viewerId: "users:v",
      neighborhoodId: "neighborhoods:mission",
    })) as { night: { quotes: { quote: string }[] } };
    expect(r.night.quotes.map((q) => q.quote)).toEqual([
      "We walk home along Valencia, it's well lit and busy.",
    ]);
  });

  test("interest fit asks for a City Profile when there is none", async () => {
    const { ctx } = world();
    await recompute(ctx);
    const r = (await run(scores.get, ctx, {
      viewerId: "users:v",
      neighborhoodId: "neighborhoods:mission",
    })) as {
      interestFit: { state: string };
    };
    expect(r.interestFit.state).toBe("no_profile");
  });
});
