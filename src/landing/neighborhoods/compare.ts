import type { CitedSource } from "../../../convex/lib/citations";
import {
  type NeighborhoodSlug,
  SF_NEIGHBORHOODS,
  TRANSPORT_MODES,
  type TransportMode,
  type WorkHours,
} from "../../../convex/lib/cityProfileFacts";
import type { WeekendStopView } from "../../../convex/weekendRoutes";
import type { ScoresData } from "./NeighborhoodScores";

/**
 * "Try the neighborhood" (#19): finding the two neighborhoods in a question,
 * and the personal answer comparing them. Pure, so the page and the tests
 * share it. Everything here is code: the comparison works without AI.
 */

/* ───────────── The neighborhoods, and the page's search ───────────── */

export type Hood = { slug: NeighborhoodSlug; label: string };

/** Every neighborhood, A–Z by the name people use ("SoMa", "Castro"). */
export const HOODS: readonly Hood[] = SF_NEIGHBORHOODS.map((n) => ({
  slug: n.slug,
  label: "short" in n ? n.short : n.name,
})).sort((x, y) => x.label.localeCompare(y.label));
export const BY_SLUG: ReadonlyMap<string, Hood> = new Map(HOODS.map((n) => [n.slug, n]));

export function isNeighborhoodSlug(s: unknown): s is NeighborhoodSlug {
  return typeof s === "string" && BY_SLUG.has(s);
}

/** `/landing/find/neighborhoods/compare?a=mission&b=inner-sunset`. */
export type CompareSearch = { a?: NeighborhoodSlug; b?: NeighborhoodSlug };

/** The compare page's search: unknown slugs are dropped, and so is `b` when it repeats `a`. */
export function compareSearch(s: Record<string, unknown>): CompareSearch {
  const a = isNeighborhoodSlug(s.a) ? s.a : undefined;
  const b = isNeighborhoodSlug(s.b) && s.b !== a ? s.b : undefined;
  return { a, b };
}

/** Pairs to try first, when the viewer's City Profile doesn't suggest any. */
const DEFAULT_PAIRS: readonly (readonly [NeighborhoodSlug, NeighborhoodSlug])[] = [
  ["mission", "inner-sunset"],
  ["hayes-valley", "north-beach"],
  ["noe-valley", "inner-richmond"],
];
const FILLERS: readonly NeighborhoodSlug[] = [
  "mission",
  "inner-sunset",
  "hayes-valley",
  "north-beach",
  "noe-valley",
];

/**
 * Up to three pairs to suggest before two neighborhoods are picked. The
 * viewer's City Profile neighborhoods (`yours`, in profile order) come first;
 * with one picked, every pair starts with it. No pair repeats, in either order.
 */
export function suggestedPairs(
  yours: readonly NeighborhoodSlug[],
  picked?: NeighborhoodSlug,
): [NeighborhoodSlug, NeighborhoodSlug][] {
  const mine = [...new Set(yours)];
  let pairs: [NeighborhoodSlug, NeighborhoodSlug][];
  if (picked) {
    pairs = [...new Set([...mine, ...FILLERS])].filter((s) => s !== picked).map((s) => [picked, s]);
  } else {
    const first = mine[0];
    const second = mine[1] ?? FILLERS.find((s) => s !== first);
    pairs = [
      ...(first && second ? [[first, second] as [NeighborhoodSlug, NeighborhoodSlug]] : []),
      ...DEFAULT_PAIRS.map(([x, y]) => [x, y] as [NeighborhoodSlug, NeighborhoodSlug]),
    ];
  }
  const seen = new Set<string>();
  return pairs
    .filter(([x, y]) => {
      const key = [x, y].sort().join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

/* ───────────── Reading the question ───────────── */

/**
 * Everyday names beyond each neighborhood's name and short name, each mapped to
 * the DataSF neighborhood whose boundary holds it (checked with
 * `neighborhoodSlugAt`): Alamo Square is in Hayes Valley, Cow Hollow in the
 * Marina, Telegraph Hill in North Beach.
 */
const EVERYDAY_NAMES: readonly (readonly [string, NeighborhoodSlug])[] = [
  ["Mission District", "mission"],
  ["Sunset District", "sunset-parkside"],
  ["Upper Haight", "haight-ashbury"],
  ["Haight-Ashbury", "haight-ashbury"],
  ["Cole Valley", "haight-ashbury"],
  ["Duboce Triangle", "castro-upper-market"],
  ["Noe", "noe-valley"],
  ["Bernal", "bernal-heights"],
  ["Potrero", "potrero-hill"],
  ["Dogpatch", "potrero-hill"],
  ["Financial District", "financial-district-south-beach"],
  ["NoPa", "western-addition"],
  ["Fillmore", "western-addition"],
  ["Alamo Square", "hayes-valley"],
  ["Cow Hollow", "marina"],
  ["Telegraph Hill", "north-beach"],
  ["West Portal", "west-of-twin-peaks"],
  ["Forest Hill", "west-of-twin-peaks"],
  ["Hunters Point", "bayview-hunters-point"],
  ["Hunter's Point", "bayview-hunters-point"],
  ["Merced Heights", "oceanview-merced-ingleside"],
  ["Lake Merced", "lakeshore"],
  ["Sea Cliff", "seacliff"],
  ["Pacific Heights", "pacific-heights"],
  ["GG Park", "golden-gate-park"],
];

/**
 * Names that are also everyday words ("watch the sunset", "my mission"). They
 * count as a neighborhood when capitalized mid-sentence ("in the Mission");
 * otherwise only to make up a pair, joined to another name ("mission vs noe").
 */
const COMMON_WORDS = new Set(["mission", "sunset", "marina"]);

/** What may sit between two names that are being compared: "vs", "or the", ", ". */
const JOINER =
  /^\s*[,/&]?\s*(?:(?:vs\.?|versus|or|and|compared\s+(?:to|with)|against)\s+)?(?:the\s+)?$/i;

type Alias = { re: RegExp; slug: NeighborhoodSlug; common: boolean };

const ALIASES: readonly Alias[] = (() => {
  const seen = new Set<string>();
  const out: Alias[] = [];
  const add = (name: string, slug: NeighborhoodSlug) => {
    const text = name.trim();
    const key = text.toLowerCase();
    if (text.length < 3 || seen.has(key)) return;
    seen.add(key);
    // Spaces and hyphens are interchangeable ("Haight Ashbury", "Haight-Ashbury").
    const body = text
      .split(/[\s-]+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s-]+");
    out.push({
      re: new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu"),
      slug,
      common: COMMON_WORDS.has(key),
    });
  };
  for (const n of SF_NEIGHBORHOODS) {
    add(n.name, n.slug);
    if ("short" in n) add(n.short, n.slug);
    // "Castro/Upper Market" is also "Castro" and "Upper Market".
    if (n.name.includes("/")) for (const part of n.name.split("/")) add(part, n.slug);
  }
  for (const [name, slug] of EVERYDAY_NAMES) add(name, slug);
  return out;
})();

type Found = { start: number; end: number; slug: NeighborhoodSlug; weak: boolean };

/**
 * The San Francisco neighborhoods a question names, in the order it names
 * them, each once: "What's my Saturday like in the Mission vs the Inner
 * Sunset?" is `["mission", "inner-sunset"]`. Names can't overlap and the
 * longer one wins, so "Inner Sunset" isn't also the Sunset and "Outer Mission"
 * isn't also the Mission. Everyday words ("sunset", "mission") are used only
 * to make up a pair, joined ones first: "best sunset drinks, mission or the
 * marina?" is the Mission and the Marina.
 */
export function namedNeighborhoods(question: string): NeighborhoodSlug[] {
  const text = question.replace(/[\u2018\u2019]/g, "'");
  const found: Found[] = [];
  for (const a of ALIASES) {
    for (const m of text.matchAll(a.re)) {
      const start = m.index;
      // A capital proves a name only mid-sentence: "Sunset views: …" doesn't.
      const initial = /(?:^|[.!?:;"“(])\s*$/.test(text.slice(0, start));
      const weak = a.common && (initial || !/^\p{Lu}/u.test(m[0]));
      found.push({ start, end: start + m[0].length, slug: a.slug, weak });
    }
  }
  found.sort((x, y) => y.end - y.start - (x.end - x.start) || x.start - y.start);
  const kept: Found[] = [];
  for (const f of found) if (!kept.some((k) => f.start < k.end && k.start < f.end)) kept.push(f);
  kept.sort((x, y) => x.start - y.start);

  const chosen = kept.filter((k) => !k.weak);
  const slugs = new Set(chosen.map((k) => k.slug));
  if (slugs.size < 2) {
    const gap = (x: Found, y: Found) =>
      x.end <= y.start ? text.slice(x.end, y.start) : text.slice(y.end, x.start);
    const joined = (k: Found) => kept.some((o) => o !== k && JOINER.test(gap(k, o)));
    const weak = kept.filter((k) => k.weak && !slugs.has(k.slug));
    const ranked = [...weak.filter(joined), ...weak.filter((k) => !joined(k))];
    for (const k of ranked) {
      if (slugs.size >= 2) break;
      if (slugs.has(k.slug)) continue;
      slugs.add(k.slug);
      chosen.push(k);
    }
    chosen.sort((x, y) => x.start - y.start);
  }
  return [...new Set(chosen.map((k) => k.slug))];
}

/* ───────────── Names in sentences ───────────── */

/** Neighborhoods people say with "the": "the Mission", "the Inner Sunset". */
const WITH_THE = new Set<string>([
  "bayview-hunters-point",
  "castro-upper-market",
  "excelsior",
  "haight-ashbury",
  "inner-richmond",
  "inner-sunset",
  "marina",
  "mission",
  "oceanview-merced-ingleside",
  "outer-mission",
  "outer-richmond",
  "portola",
  "presidio",
  "sunset-parkside",
  "tenderloin",
  "western-addition",
]);

/** A neighborhood as a sentence names it: "the Mission", "Noe Valley". */
export function inSentence(n: { slug: string; label: string }, startOfSentence = false): string {
  if (!WITH_THE.has(n.slug)) return n.label;
  return `${startOfSentence ? "The" : "the"} ${n.label}`;
}

/** "a", "a and b", "a, b and c" (or "a, b or c"). */
export function list(xs: readonly string[], conjunction: "and" | "or" = "and"): string {
  if (xs.length <= 2) return xs.join(` ${conjunction} `);
  return `${xs.slice(0, -1).join(", ")} ${conjunction} ${xs.at(-1)}`;
}

/** "Live music" → "live music", but "TV" stays "TV". */
function lowerFirst(s: string): string {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "the Mission's", "Pac Heights'". */
function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const one = (n: number) => n.toFixed(1);

/* ───────────── The answer ───────────── */

/** One neighborhood's side of the comparison. */
export type CompareSide = {
  slug: string;
  label: string;
  /** `neighborhoodScores.get`, once loaded. */
  scores: ScoresData | null;
  /** The Weekend Route's stops: null when there's none, undefined while loading or planning. */
  stops: readonly Pick<WeekendStopView, "name" | "matches" | "sources">[] | null | undefined;
};

/** What the answer reads from the viewer's City Profile, besides interests (scores carry those). */
export type CompareProfile = {
  transport: readonly TransportMode[];
  workHours: WorkHours | null;
};

export type AnswerLine = {
  key: "interests" | "route" | "scores" | "transit" | "night";
  text: string;
  sources: CitedSource[];
};

export type CompareAnswer = {
  /** The verdict on fit; null without interests in the City Profile. */
  lead: string | null;
  /** What the verdict cites: both neighborhoods' Interest fit sources. */
  leadSources: CitedSource[];
  lines: AnswerLine[];
  /** Whether anything from the City Profile shaped the answer. */
  personal: boolean;
};

/** Within this many points, two scores are "about the same". */
export const CLOSE = 0.5;

/**
 * Which of two scores is higher by at least `CLOSE`: 1 for `x`, -1 for `y`, 0
 * when they're about the same. Scores are shown to one decimal, so this
 * compares tenths: 8.2 vs 7.7 and 8.3 vs 7.8 are both half a point apart.
 */
export function apart(x: number, y: number): -1 | 0 | 1 {
  const tenths = Math.round((x - y) * 10);
  return tenths >= CLOSE * 10 ? 1 : tenths <= -CLOSE * 10 ? -1 : 0;
}

const SCORE_NAME = { things_to_do: "things to do", food: "food", transit: "transit" } as const;
type ScoreKind = keyof typeof SCORE_NAME;

/** Sources from several lists, each once, in order. */
function merge(...lists: readonly (readonly CitedSource[])[]): CitedSource[] {
  const seen = new Set<string>();
  const out: CitedSource[] = [];
  for (const s of lists.flat()) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s);
  }
  return out;
}

function okScore(side: CompareSide, kind: ScoreKind) {
  const s = side.scores?.scores.find((x) => x.kind === kind);
  return s?.state === "ok" ? s : null;
}

/**
 * True only when the neighborhood has no score for lack of public data. A
 * score missing from `scores` exists but cites something this viewer can't
 * see (`neighborhoodScores.get` leaves it out), so it isn't "no data".
 */
function noPublicData(side: CompareSide, kind: ScoreKind) {
  return side.scores?.scores.find((x) => x.kind === kind)?.state === "no_data";
}

/**
 * The personal answer to "What's my Saturday like in A vs B?", from data the
 * page already shows: Interest fit and the interests each neighborhood has,
 * Weekend Route stops that fit them, the shared scores, and, from the City
 * Profile, transit for people who ride it and late service for people who
 * work evenings or nights. Each line cites what it says.
 */
export function compareAnswer(
  a: CompareSide,
  b: CompareSide,
  you: CompareProfile | null,
): CompareAnswer {
  const lines: AnswerLine[] = [];
  const nameA = (start = false) => inSentence(a, start);
  const nameB = (start = false) => inSentence(b, start);

  // Interest fit, and which interests each neighborhood has.
  const fa = a.scores?.interestFit;
  const fb = b.scores?.interestFit;
  let lead: string | null = null;
  let leadSources: CitedSource[] = [];
  const fitOk = fa?.state === "ok" && fb?.state === "ok";
  if (fa?.state === "ok" && fb?.state === "ok") {
    const diff = apart(fa.score, fb.score);
    // Nothing matched, so there's nothing to cite: say what wasn't found.
    if (fa.score === 0 && fb.score === 0)
      lead = "We haven't found Groups, Events or places for your interests in either yet.";
    else if (diff === 0)
      lead = `Both fit your interests about the same: ${one(fa.score)} and ${one(fb.score)} out of 10.`;
    else {
      const [w, l] = diff > 0 ? [nameA, nameB] : [nameB, nameA];
      const [ws, ls] = diff > 0 ? [fa.score, fb.score] : [fb.score, fa.score];
      lead = `${w(true)} fits your interests better: ${one(ws)} vs ${one(ls)} for ${l()}.`;
    }
    leadSources = merge(fa.sources, fb.sources);
    const inA = new Set(fa.matched);
    const inB = new Set(fb.matched);
    const all = [...fa.matched, ...fb.matched.filter((x) => !inA.has(x)), ...fa.missing];
    const interests = [...new Set(all)];
    const onlyA = interests.filter((x) => inA.has(x) && !inB.has(x)).map(lowerFirst);
    const onlyB = interests.filter((x) => inB.has(x) && !inA.has(x)).map(lowerFirst);
    const both = interests.filter((x) => inA.has(x) && inB.has(x)).map(lowerFirst);
    const neither = interests.filter((x) => !inA.has(x) && !inB.has(x)).map(lowerFirst);
    const parts = [
      onlyA.length > 0 && `only ${nameA()} has ${list(onlyA)}`,
      onlyB.length > 0 && `only ${nameB()} has ${list(onlyB)}`,
      both.length > 0 && `both have ${list(both)}`,
      neither.length > 0 && `neither has ${list(neither)} yet`,
    ].filter((p): p is string => typeof p === "string");
    if (parts.length > 0)
      lines.push({
        key: "interests",
        text: `Groups, Events and places for your interests: ${parts.join("; ")}.`,
        sources: merge(fa.sources, fb.sources),
      });
  }

  // Weekend Route stops that fit the viewer's interests.
  if (fitOk) {
    const parts: string[] = [];
    const sources: (readonly CitedSource[])[] = [];
    let said = false;
    for (const [side, name] of [
      [a, nameA],
      [b, nameB],
    ] as const) {
      if (side.stops === undefined) continue;
      if (side.stops === null) {
        parts.push(`${name()} doesn't have a Weekend Route yet`);
        continue;
      }
      const fits = side.stops.filter((s) => s.matches.length > 0);
      // The counts are about every stop, so cite them all, the fitting ones first.
      sources.push(
        fits.flatMap((s) => s.sources),
        side.stops.flatMap((s) => s.sources),
      );
      const total = side.stops.length;
      const named =
        fits.length > 3
          ? `${fits
              .slice(0, 3)
              .map((s) => s.name)
              .join(", ")} and more`
          : list(fits.map((s) => s.name));
      // The first side to describe its stops says it in full; the second is shorter.
      const first = !said;
      said = true;
      const whose = possessive(name());
      if (total === 1) {
        const noun = first ? "one Weekend Route stop" : "one stop";
        parts.push(
          fits.length === 1
            ? `${whose} ${noun} ${first ? "fits your interests" : "does"} (${named})`
            : `${whose} ${noun} ${first ? "doesn't fit your interests" : "doesn't"}`,
        );
        continue;
      }
      const stops = first ? `${whose} ${total} Weekend Route stops` : `${whose} ${total}`;
      const verb = first
        ? `${fits.length === 1 ? "fits" : "fit"} your interests`
        : fits.length === 1
          ? "does"
          : "do";
      parts.push(
        fits.length === 0
          ? `none of ${stops} ${first ? "fit your interests" : "do"}`
          : `${fits.length} of ${stops} ${verb} (${named})`,
      );
    }
    if (said)
      lines.push({
        key: "route",
        text: `${capitalize(parts.join("; "))}.`,
        sources: merge(...sources),
      });
  }

  // Transit for people who ride it: the score and the BART and Caltrain stations.
  const riding = (you?.transport ?? []).filter(
    (m): m is "muni" | "bart" | "caltrain" => m === "muni" || m === "bart" || m === "caltrain",
  );
  const transitLine = riding.length > 0 && okScore(a, "transit") && okScore(b, "transit");

  // The shared scores, where they differ.
  const kinds: ScoreKind[] = transitLine
    ? ["things_to_do", "food"]
    : ["things_to_do", "food", "transit"];
  const higherA: string[] = [];
  const higherB: string[] = [];
  const close: string[] = [];
  const noData = new Map<CompareSide, string[]>();
  const scoreSources: (readonly CitedSource[])[] = [];
  for (const kind of kinds) {
    const sa = okScore(a, kind);
    const sb = okScore(b, kind);
    if (!sa || !sb) {
      // Say so only for a real lack of data; a score this viewer can't see is left out.
      for (const side of [a, b])
        if (noPublicData(side, kind))
          noData.set(side, [...(noData.get(side) ?? []), SCORE_NAME[kind]]);
      continue;
    }
    scoreSources.push(sa.sources, sb.sources);
    const d = apart(sa.score, sb.score);
    const name = SCORE_NAME[kind];
    if (d > 0) higherA.push(`${name} (${one(sa.score)} vs ${one(sb.score)})`);
    else if (d < 0) higherB.push(`${name} (${one(sb.score)} vs ${one(sa.score)})`);
    else close.push(`${name} (${one(sa.score)} and ${one(sb.score)})`);
  }
  const scoreParts = [
    higherA.length > 0 && `${nameA()} scores higher for ${list(higherA)}`,
    higherB.length > 0 &&
      (higherA.length > 0
        ? `${nameB()} for ${list(higherB)}`
        : `${nameB()} scores higher for ${list(higherB)}`),
    close.length > 0 && `they're about the same for ${list(close)}`,
  ].filter((p): p is string => typeof p === "string");
  if (scoreParts.length > 0 || noData.size > 0) {
    const missing = [...noData].map(([side, ks]) => `${inSentence(side)} for ${list(ks, "or")}`);
    const text = [
      scoreParts.length > 0 && `${capitalize(scoreParts.join("; "))}.`,
      missing.length > 0 && `There isn't enough public data to score ${missing.join(", or ")}.`,
    ]
      .filter((p): p is string => typeof p === "string")
      .join(" ");
    lines.push({ key: "scores", text, sources: merge(...scoreSources) });
  }

  if (transitLine) {
    const ta = okScore(a, "transit");
    const tb = okScore(b, "transit");
    if (ta && tb) {
      const modes = riding.map((m) => TRANSPORT_MODES.find((t) => t.id === m)?.label ?? m);
      // Stations come from the night service facts; without them, say nothing.
      const stations = (side: CompareSide, system: "bart" | "caltrain") => {
        const t = side.scores?.night.transit;
        if (!t) return null;
        return [...new Set(t.lastTrains.filter((x) => x.system === system).map((x) => x.station))];
      };
      const rail = (["bart", "caltrain"] as const)
        .filter((sys) => riding.includes(sys))
        .flatMap((sys) => {
          const label = sys === "bart" ? "BART" : "Caltrain";
          const sa = stations(a, sys);
          const sb = stations(b, sys);
          if (!sa || !sb) return [];
          if (sa.length === 0 && sb.length === 0) return [`Neither has a ${label} station.`];
          const at = (st: string[], name: () => string) =>
            st.length > 0
              ? `${name()} has ${label} at ${list(st)}`
              : `${name()} has no ${label} station`;
          return [`${capitalize(at(sa, () => nameA()))}; ${at(sb, () => nameB())}.`];
        });
      lines.push({
        key: "transit",
        text: [
          `You get around by ${list(modes)}: transit scores ${one(ta.score)} in ${nameA()} and ${one(tb.score)} in ${nameB()}.`,
          ...rail,
        ].join(" "),
        sources: merge(
          ta.sources,
          tb.sources,
          a.scores?.night.transit?.sources ?? [],
          b.scores?.night.transit?.sources ?? [],
        ),
      });
    }
  }

  // Getting home late: all-night Muni. For everyone; first for people who work late.
  const na = a.scores?.night.transit;
  const nb = b.scores?.night.transit;
  if (na || nb) {
    const owl = (t: typeof na, name: () => string) => {
      if (!t) return `there's no late-night transit data for ${name()}`;
      const n = t.allNight.length;
      if (n === 0) return `${name()} has no all-night Muni`;
      const names = t.allNight.slice(0, 3).join(", ");
      return `${name()} has ${n} all-night Muni ${n === 1 ? "line" : "lines"} (${names}${n > 3 ? " and more" : ""})`;
    };
    const late =
      you?.workHours === "night"
        ? "You work nights, so late service matters. "
        : you?.workHours === "evening"
          ? "You work evenings, so late service matters. "
          : "";
    lines.push({
      key: "night",
      text: `${late}Getting home late, ${owl(na, () => nameA())}; ${owl(nb, () => nameB())}.`,
      sources: merge(na?.sources ?? [], nb?.sources ?? []),
    });
  }

  // People who work late see late service right after the verdict.
  const worksLate = you?.workHours === "night" || you?.workHours === "evening";
  if (worksLate) {
    const i = lines.findIndex((l) => l.key === "night");
    if (i > 0) lines.unshift(...lines.splice(i, 1));
  }
  const personal =
    lead !== null ||
    lines.some((l) => l.key === "transit") ||
    (worksLate && lines.some((l) => l.key === "night"));
  return { lead, leadSources, lines, personal };
}
