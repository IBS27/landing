import { describe, expect, test } from "bun:test";
import type { CitedSource } from "../convex/lib/citations";
import {
  type CompareProfile,
  type CompareSide,
  compareAnswer,
  compareSearch,
  inSentence,
  list,
  namedNeighborhoods,
} from "../src/landing/neighborhoods/compare";
import type { ScoresData } from "../src/landing/neighborhoods/NeighborhoodScores";

/* ───────────── Reading the question ───────────── */

describe("namedNeighborhoods", () => {
  test("the brief's example", () => {
    expect(
      namedNeighborhoods("What's my Saturday like in the Mission vs the Inner Sunset?"),
    ).toEqual(["mission", "inner-sunset"]);
  });

  test("lowercase, typed fast", () => {
    expect(namedNeighborhoods("mission vs inner sunset")).toEqual(["mission", "inner-sunset"]);
    expect(namedNeighborhoods("noe or bernal")).toEqual(["noe-valley", "bernal-heights"]);
  });

  test("the longer name wins", () => {
    expect(namedNeighborhoods("Outer Mission or Mission Bay?")).toEqual([
      "outer-mission",
      "mission-bay",
    ]);
    expect(namedNeighborhoods("Pac Heights vs Presidio Heights vs the Presidio")).toEqual([
      "pacific-heights",
      "presidio-heights",
      "presidio",
    ]);
    expect(namedNeighborhoods("Inner Richmond and Outer Richmond")).toEqual([
      "inner-richmond",
      "outer-richmond",
    ]);
  });

  test("short names, everyday names and full DataSF names", () => {
    expect(namedNeighborhoods("SoMa or FiDi")).toEqual([
      "south-of-market",
      "financial-district-south-beach",
    ]);
    expect(namedNeighborhoods("Dogpatch vs NoPa")).toEqual(["potrero-hill", "western-addition"]);
    expect(namedNeighborhoods("Haight-Ashbury vs the Castro")).toEqual([
      "haight-ashbury",
      "castro-upper-market",
    ]);
    expect(namedNeighborhoods("Castro/Upper Market vs Sunset/Parkside")).toEqual([
      "castro-upper-market",
      "sunset-parkside",
    ]);
    expect(namedNeighborhoods("the Sunset vs the OMI")).toEqual([
      "sunset-parkside",
      "oceanview-merced-ingleside",
    ]);
  });

  test("each neighborhood once, in the order named", () => {
    expect(namedNeighborhoods("the Mission District vs Noe, or the Mission")).toEqual([
      "mission",
      "noe-valley",
    ]);
    expect(namedNeighborhoods("the Mission's taquerias vs Noe's cafes")).toEqual([
      "mission",
      "noe-valley",
    ]);
  });

  test("whole words only", () => {
    expect(namedNeighborhoods("commission vs Noe")).toEqual(["noe-valley"]);
    expect(namedNeighborhoods("somewhere with good tacos")).toEqual([]);
  });

  test("everyday words count only when the question doesn't name two others", () => {
    // "sunset walks" isn't the Sunset when the Marina and Bernal are named...
    expect(namedNeighborhoods("sunset walks: the Marina or Bernal?")).toEqual([
      "marina",
      "bernal-heights",
    ]);
    // ...but "the Sunset" and a capital are.
    expect(namedNeighborhoods("sunset walks in the Sunset or Bernal or the Marina")).toEqual([
      "sunset-parkside",
      "bernal-heights",
      "marina",
    ]);
    // Alone, a lowercase name is still the best reading.
    expect(namedNeighborhoods("mission vs noe")).toEqual(["mission", "noe-valley"]);
  });
});

describe("compareSearch", () => {
  test("keeps known slugs, drops unknown ones and a repeat", () => {
    expect(compareSearch({ a: "mission", b: "inner-sunset" })).toEqual({
      a: "mission",
      b: "inner-sunset",
    });
    expect(compareSearch({ a: "atlantis", b: "noe-valley" })).toEqual({
      a: undefined,
      b: "noe-valley",
    });
    expect(compareSearch({ a: "mission", b: "mission" })).toEqual({ a: "mission", b: undefined });
    expect(compareSearch({ a: 3, b: ["mission"] })).toEqual({ a: undefined, b: undefined });
  });
});

describe("names in sentences", () => {
  test("the Mission, Noe Valley", () => {
    expect(inSentence({ slug: "mission", label: "Mission" })).toBe("the Mission");
    expect(inSentence({ slug: "mission", label: "Mission" }, true)).toBe("The Mission");
    expect(inSentence({ slug: "noe-valley", label: "Noe Valley" }, true)).toBe("Noe Valley");
  });
  test("lists", () => {
    expect(list(["a"])).toBe("a");
    expect(list(["a", "b"])).toBe("a and b");
    expect(list(["a", "b", "c"], "or")).toBe("a, b or c");
  });
});

/* ───────────── The answer ───────────── */

const src = (key: string): CitedSource => ({
  key,
  snippet: key,
  kind: "external",
  url: `https://example.com/${key}`,
  title: key,
  publisher: "DataSF",
  fetchedAt: 0,
});

type Score = ScoresData["scores"][number];
const ok = (kind: Score["kind"], score: number): Score => ({
  kind,
  state: "ok",
  score,
  label: "label",
  breakdown: "breakdown",
  sources: [src(`${kind}-${score}`)],
});

function scores(opts: {
  slug: string;
  label: string;
  things?: number;
  food?: number;
  transit?: number;
  fit?: { score: number; matched: string[]; missing: string[] } | null;
  allNight?: string[];
  stations?: { system: "bart" | "caltrain"; station: string }[];
  noNightTransit?: boolean;
}): ScoresData {
  const shared: Score[] = [
    opts.things === undefined
      ? { kind: "things_to_do", state: "no_data" }
      : ok("things_to_do", opts.things),
    opts.food === undefined ? { kind: "food", state: "no_data" } : ok("food", opts.food),
    opts.transit === undefined
      ? { kind: "transit", state: "no_data" }
      : ok("transit", opts.transit),
  ];
  return {
    neighborhood: {
      _id: `id-${opts.slug}` as ScoresData["neighborhood"]["_id"],
      slug: opts.slug,
      name: opts.label,
      label: opts.label,
    },
    scores: shared,
    interestFit: opts.fit
      ? { state: "ok", ...opts.fit, sources: [src(`fit-${opts.slug}`), src("shared-group")] }
      : { state: "no_profile" },
    night: {
      transit: opts.noNightTransit
        ? null
        : {
            allNight: opts.allNight ?? [],
            lastTrains: (opts.stations ?? []).map((s) => ({
              ...s,
              toward: null,
              weekday: "12:24 AM",
              saturday: "12:24 AM",
              sunday: "12:24 AM",
            })),
            sources: [src(`night-${opts.slug}`)],
          },
      streetlights: null,
      quotes: [],
    },
    howCalculated: [],
    computedAt: 0,
  };
}

const stop = (name: string, matches: string[] = []) => ({
  name,
  matches,
  sources: [src(`stop-${name}`)] as const,
});

const mission = (over: Partial<CompareSide> = {}): CompareSide => ({
  slug: "mission",
  label: "Mission",
  scores: scores({
    slug: "mission",
    label: "Mission",
    things: 9.7,
    food: 9.7,
    transit: 9.1,
    fit: { score: 7.2, matched: ["Coffee", "Live music", "Board games"], missing: ["Hiking"] },
    allNight: ["14 Mission", "22 Fillmore", "48 Quintara-24th Street", "San Bruno Owl"],
    stations: [
      { system: "bart", station: "16th St Mission" },
      { system: "bart", station: "16th St Mission" },
      { system: "bart", station: "24th St Mission" },
    ],
  }),
  stops: [
    stop("Moonrise Coffee", ["Coffee"]),
    stop("Clarion Alley"),
    stop("Kumo Ramen Bar", ["Trying restaurants"]),
    stop("Velvet Owl"),
  ],
  ...over,
});

const sunset = (over: Partial<CompareSide> = {}): CompareSide => ({
  slug: "inner-sunset",
  label: "Inner Sunset",
  scores: scores({
    slug: "inner-sunset",
    label: "Inner Sunset",
    things: 5.0,
    food: 9.4,
    transit: 5.7,
    fit: { score: 4.1, matched: ["Hiking", "Coffee"], missing: ["Live music", "Board games"] },
    allNight: ["Owl Judah"],
  }),
  stops: [stop("Low Cloud Coffee", ["Coffee"]), stop("Grand View Park")],
  ...over,
});

const rider: CompareProfile = { transport: ["bike", "muni", "bart"], workHours: "day" };

const line = (a: ReturnType<typeof compareAnswer>, key: string) =>
  a.lines.find((l) => l.key === key);

describe("compareAnswer", () => {
  test("says which fits the viewer better, and which interests each has", () => {
    const a = compareAnswer(mission(), sunset(), rider);
    expect(a.lead).toBe("The Mission fits your interests better: 7.2 vs 4.1 for the Inner Sunset.");
    expect(line(a, "interests")?.text).toBe(
      "Groups, Events and places for your interests: only the Mission has live music and board games; only the Inner Sunset has hiking; both have coffee.",
    );
    // Both neighborhoods' fit sources, each once.
    expect(line(a, "interests")?.sources.map((s) => s.key)).toEqual([
      "fit-mission",
      "shared-group",
      "fit-inner-sunset",
    ]);
  });

  test("close fits are about the same; none is none", () => {
    const close = compareAnswer(
      mission(),
      sunset({
        scores: scores({
          slug: "inner-sunset",
          label: "Inner Sunset",
          fit: { score: 7.0, matched: ["Coffee"], missing: [] },
        }),
      }),
      rider,
    );
    expect(close.lead).toBe("Both fit your interests about the same: 7.2 and 7.0 out of 10.");
    const zero = (side: CompareSide): CompareSide => ({
      ...side,
      scores: scores({
        slug: side.slug,
        label: side.label,
        fit: { score: 0, matched: [], missing: ["Surfing"] },
      }),
    });
    const none = compareAnswer(zero(mission()), zero(sunset()), rider);
    expect(none.lead).toBe("Neither has much for your interests yet.");
    expect(line(none, "interests")?.text).toBe(
      "Groups, Events and places for your interests: neither has surfing yet.",
    );
  });

  test("Weekend Route stops that fit, citing every stop counted", () => {
    const a = compareAnswer(mission(), sunset(), rider);
    expect(line(a, "route")?.text).toBe(
      "2 of the Mission's 4 Weekend Route stops fit your interests (Moonrise Coffee and Kumo Ramen Bar); 1 of the Inner Sunset's 2 does (Low Cloud Coffee).",
    );
    expect(line(a, "route")?.sources.map((s) => s.key)).toEqual([
      "stop-Moonrise Coffee",
      "stop-Kumo Ramen Bar",
      "stop-Clarion Alley",
      "stop-Velvet Owl",
      "stop-Low Cloud Coffee",
      "stop-Grand View Park",
    ]);
    const unmatched = compareAnswer(
      mission({ stops: [stop("Clarion Alley")] }),
      sunset({ stops: null }),
      rider,
    );
    expect(line(unmatched, "route")?.text).toBe(
      "None of the Mission's 1 Weekend Route stops fit your interests; the Inner Sunset doesn't have a Weekend Route yet.",
    );
    expect(line(unmatched, "route")?.sources.map((s) => s.key)).toEqual(["stop-Clarion Alley"]);
  });

  test("a missing route is said; one still loading is left out", () => {
    const missing = compareAnswer(mission({ stops: null }), sunset(), rider);
    expect(line(missing, "route")?.text).toBe(
      "The Mission doesn't have a Weekend Route yet; 1 of the Inner Sunset's 2 Weekend Route stops fits your interests (Low Cloud Coffee).",
    );
    const loading = compareAnswer(mission(), sunset({ stops: undefined }), rider);
    expect(line(loading, "route")?.text).toBe(
      "2 of the Mission's 4 Weekend Route stops fit your interests (Moonrise Coffee and Kumo Ramen Bar).",
    );
    const neither = compareAnswer(mission({ stops: undefined }), sunset({ stops: null }), rider);
    expect(line(neither, "route")).toBeUndefined();
  });

  test("shared scores: higher, about the same, and not enough data", () => {
    const a = compareAnswer(
      mission(),
      sunset({
        scores: scores({
          slug: "inner-sunset",
          label: "Inner Sunset",
          things: 5.0,
          food: 9.4,
          fit: { score: 4.1, matched: [], missing: [] },
        }),
      }),
      { transport: ["car"], workHours: null },
    );
    expect(line(a, "scores")?.text).toBe(
      "The Mission scores higher for things to do (9.7 vs 5.0); they're about the same for food (9.7 and 9.4). There isn't enough public data to score the Inner Sunset for transit.",
    );
    // No transit line for someone who drives.
    expect(line(a, "transit")).toBeUndefined();
  });

  test("transit riders get the transit score and their stations", () => {
    const a = compareAnswer(mission(), sunset(), rider);
    // Transit moves out of the shared-scores line into its own.
    expect(line(a, "scores")?.text).toBe(
      "The Mission scores higher for things to do (9.7 vs 5.0); they're about the same for food (9.7 and 9.4).",
    );
    expect(line(a, "transit")?.text).toBe(
      "You get around by Muni and BART: transit scores 9.1 in the Mission and 5.7 in the Inner Sunset. The Mission has BART at 16th St Mission and 24th St Mission; the Inner Sunset has no BART station.",
    );
    const caltrain = compareAnswer(mission(), sunset(), {
      transport: ["caltrain"],
      workHours: null,
    });
    expect(line(caltrain, "transit")?.text).toBe(
      "You get around by Caltrain: transit scores 9.1 in the Mission and 5.7 in the Inner Sunset. Neither has a Caltrain station.",
    );
  });

  test("no station claims without night service data", () => {
    const a = compareAnswer(
      mission(),
      sunset({
        scores: scores({
          slug: "inner-sunset",
          label: "Inner Sunset",
          transit: 5.7,
          fit: { score: 4.1, matched: [], missing: [] },
          noNightTransit: true,
        }),
      }),
      rider,
    );
    expect(line(a, "transit")?.text).toBe(
      "You get around by Muni and BART: transit scores 9.1 in the Mission and 5.7 in the Inner Sunset.",
    );
    expect(line(a, "night")?.text).toBe(
      "Getting home late, the Mission has 4 all-night Muni lines (14 Mission, 22 Fillmore, 48 Quintara-24th Street and more); there's no late-night transit data for the Inner Sunset.",
    );
  });

  test("late service comes first for people who work nights", () => {
    const day = compareAnswer(mission(), sunset(), rider);
    expect(day.lines.at(-1)?.key).toBe("night");
    expect(line(day, "night")?.text).toBe(
      "Getting home late, the Mission has 4 all-night Muni lines (14 Mission, 22 Fillmore, 48 Quintara-24th Street and more); the Inner Sunset has 1 all-night Muni line (Owl Judah).",
    );
    const night = compareAnswer(mission(), sunset(), { transport: ["car"], workHours: "night" });
    expect(night.lines[0]?.key).toBe("night");
    expect(night.lines[0]?.text.startsWith("You work nights, so late service matters. ")).toBe(
      true,
    );
  });

  test("without interests: no verdict, nothing personal, still the facts", () => {
    const noFit = (side: CompareSide): CompareSide => ({
      ...side,
      scores: scores({ slug: side.slug, label: side.label, things: 9, food: 3, transit: 5 }),
    });
    const a = compareAnswer(noFit(mission()), noFit(sunset()), null);
    expect(a.lead).toBeNull();
    expect(a.lines.map((l) => l.key)).toEqual(["scores", "night"]);
  });

  test("every line that makes a claim from data cites it", () => {
    const a = compareAnswer(mission(), sunset(), rider);
    expect(a.leadSources.map((s) => s.key)).toEqual([
      "fit-mission",
      "shared-group",
      "fit-inner-sunset",
    ]);
    for (const l of a.lines) expect(l.sources.length).toBeGreaterThan(0);
  });
});
