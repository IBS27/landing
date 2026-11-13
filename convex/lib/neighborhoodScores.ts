import type { Id } from "../_generated/dataModel";
import type { NeighborhoodScoreKind, Source } from "../validators";
import { sourceKey } from "./citations";
import { type InterestId, interestsInText } from "./interests";

/**
 * Neighborhood scores (#17): pure scoring over what a neighborhood offers.
 * The data access lives in `convex/neighborhoodScores.ts`; everything here is
 * deterministic and testable.
 *
 * Three shared scores (things to do, food, transit) are a neighborhood's
 * percentile among SF's neighborhoods on a weighted count of public data,
 * scaled 0–10. Interest fit is personal: the share of the viewer's City
 * Profile interests that something here matches. There is deliberately no
 * safety score.
 */

/* ---------- Inputs ---------- */

/** A #15 place named in the neighborhood's public Group threads. */
export type PlaceMention = {
  key: string;
  name: string;
  kind: string;
  /** Where it's named: public posts and comments, with their reactions for ranking. */
  mentions: { source: Source; reactions: number }[];
};

/** What one neighborhood offers, gathered from public data only. */
export type ScoreInputs = {
  /** Public, in-person Events starting in the next 30 days. */
  events: { id: Id<"events">; startAt: number; category: string; title: string }[];
  /** Public, visible Groups based here that posted in the last 30 days. */
  activeGroups: { id: Id<"groups">; name: string; lastActivityAt: number }[];
  places: PlaceMention[];
  /** Nightlife corridor facts (bars and restaurants), each with its first source. */
  corridors: { name: string; source: Source }[];
  /** Rail stations here (BART, Caltrain, Muni Metro subway), each with its first source. */
  stations: { name: string; system: "bart" | "caltrain" | "muni_metro"; source: Source }[];
  /** Muni Metro lines with stops here, each with its first source. */
  metroLines: { name: string; source: Source }[];
  /** From the `transit_service` fact, when there is one. */
  service: {
    tripsPerHour: number;
    routes: number;
    allNight: string[];
    sources: Source[];
  } | null;
};

/* ---------- Place kinds ---------- */

/** #15 place kinds that are food and drink. The rest (but streets and transit) are things to do. */
export const FOOD_KINDS = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "brewery",
  "market",
  "grocery",
  "dessert",
]);
const NOT_A_PLACE_TO_GO = new Set(["street", "transit"]);
export const isFoodPlace = (kind: string) => FOOD_KINDS.has(kind);
export const isThingToDo = (kind: string) => !FOOD_KINDS.has(kind) && !NOT_A_PLACE_TO_GO.has(kind);

/** What a place kind says about interests, on top of its name (`interestsInText`). */
const KIND_INTERESTS: Record<string, InterestId[]> = {
  park: ["parks"],
  plaza: ["parks"],
  cafe: ["coffee"],
  restaurant: ["restaurants"],
  bakery: ["restaurants"],
  dessert: ["restaurants"],
  bar: ["bars", "nightlife"],
  brewery: ["bars"],
  market: ["farmers_markets"],
  grocery: ["cooking"],
  viewpoint: ["photography", "hiking"],
  stairway: ["hiking"],
  trail: ["hiking"],
  beach: ["beach_days"],
  museum: ["museums"],
  library: ["books"],
  bookstore: ["books"],
  "music-venue": ["live_music", "nightlife"],
  "climbing-gym": ["climbing"],
  shop: ["thrifting"],
  landmark: ["day_trips"],
};

export function interestsForPlace(p: { kind: string; name: string }): InterestId[] {
  return [...new Set([...(KIND_INTERESTS[p.kind] ?? []), ...interestsInText(p.name)])];
}

/* ---------- Raw scores ---------- */

const WEIGHTS = {
  things_to_do: { event: 2, eventKind: 3, group: 2, place: 1 },
  food: { place: 3, mention: 0.5, corridor: 4 },
  transit: { tripsPerHour: 0.1, railStation: 6, subwayStation: 3, metroLine: 1, allNight: 2 },
} as const;

export function thingsToDoRaw(i: ScoreInputs): number {
  const w = WEIGHTS.things_to_do;
  const kinds = new Set(i.events.map((e) => e.category)).size;
  const places = i.places.filter((p) => isThingToDo(p.kind)).length;
  return (
    w.event * i.events.length +
    w.eventKind * kinds +
    w.group * i.activeGroups.length +
    w.place * places
  );
}

export function foodRaw(i: ScoreInputs): number {
  const w = WEIGHTS.food;
  const food = i.places.filter((p) => isFoodPlace(p.kind));
  const mentions = distinctMentions(food).length;
  return w.place * food.length + w.mention * mentions + w.corridor * i.corridors.length;
}

export function transitRaw(i: ScoreInputs): number {
  const w = WEIGHTS.transit;
  const rail = i.stations.filter((s) => s.system !== "muni_metro").length;
  const subway = i.stations.length - rail;
  return (
    w.tripsPerHour * (i.service?.tripsPerHour ?? 0) +
    w.railStation * rail +
    w.subwayStation * subway +
    w.metroLine * i.metroLines.length +
    w.allNight * (i.service?.allNight.length ?? 0)
  );
}

export const RAW: Record<NeighborhoodScoreKind, (i: ScoreInputs) => number> = {
  things_to_do: thingsToDoRaw,
  food: foodRaw,
  transit: transitRaw,
};

/* ---------- Percentiles ---------- */

/**
 * Each positive value's percentile among the positive values, scaled 0–10 to one
 * decimal: the share below it plus half the share tied with it. Neighborhoods
 * with nothing to count (zero) aren't ranked, so a single Event can't look like
 * a lot just because many neighborhoods have no public data yet; they get 0 and
 * are never stored (a zero has no sources).
 */
export function percentiles<K>(raws: ReadonlyMap<K, number>): Map<K, number> {
  const ranked = [...raws.values()].filter((v) => v > 0);
  const n = ranked.length;
  const out = new Map<K, number>();
  for (const [k, x] of raws) {
    if (x <= 0) {
      out.set(k, 0);
      continue;
    }
    const below = ranked.filter((v) => v < x).length;
    const tied = ranked.filter((v) => v === x).length;
    out.set(k, Math.round(((below + tied / 2) / n) * 100) / 10);
  }
  return out;
}

/* ---------- Labels and breakdowns ---------- */

const LABELS: Record<NeighborhoodScoreKind, [number, string][]> = {
  things_to_do: [
    [8, "Lots to do"],
    [6, "Plenty to do"],
    [4, "Some things to do"],
    [0, "Quieter"],
  ],
  food: [
    [8, "A food destination"],
    [6, "Great food"],
    [4, "Good food"],
    [0, "A few spots"],
  ],
  transit: [
    [8, "Excellent transit"],
    [6, "Good transit"],
    [4, "Some transit"],
    [0, "Limited transit"],
  ],
};

export function scoreLabel(kind: NeighborhoodScoreKind, score: number): string {
  return LABELS[kind].find(([min]) => score >= min)?.[1] ?? LABELS[kind].at(-1)?.[1] ?? "";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items: string[]) =>
  items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export function breakdown(kind: NeighborhoodScoreKind, i: ScoreInputs): string {
  if (kind === "things_to_do") {
    const kinds = new Set(i.events.map((e) => e.category)).size;
    const places = i.places.filter((p) => isThingToDo(p.kind)).length;
    return [
      i.events.length
        ? `${plural(i.events.length, "Event")} in the next 30 days${kinds > 1 ? ` (${kinds} kinds)` : ""}`
        : "",
      i.activeGroups.length ? plural(i.activeGroups.length, "active Group") : "",
      places ? plural(places, "place locals recommend", "places locals recommend") : "",
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (kind === "food") {
    const food = i.places.filter((p) => isFoodPlace(p.kind));
    const mentions = distinctMentions(food).length;
    return [
      food.length
        ? `${plural(food.length, "spot")} locals recommend across ${plural(mentions, "post or comment", "posts and comments")}`
        : "",
      i.corridors.length ? `on ${list(i.corridors.map((c) => c.name))}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  }
  const rail = i.stations.filter((s) => s.system !== "muni_metro");
  const subway = i.stations.filter((s) => s.system === "muni_metro");
  return [
    rail.length ? list(rail.map((s) => s.name)) : "",
    subway.length ? `Muni Metro at ${list(subway.map((s) => s.name))}` : "",
    i.service ? plural(i.service.routes, "Muni line") : "",
    i.service?.tripsPerHour ? `~${i.service.tripsPerHour} trips an hour on weekdays` : "",
    i.service?.allNight.length ? plural(i.service.allNight.length, "all-night line") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** How the scores are calculated, for the "How this is calculated" note. */
export const HOW_CALCULATED = [
  "Things to do, Food and Transit are percentiles, from 0 to 10: a neighborhood's rank among the San Francisco neighborhoods (DataSF's 41) that have public data for that score. A 7 means it ranks above about 70% of them.",
  "Things to do counts public Events in the next 30 days and how many kinds, Groups based here that posted in the last month, and places (parks, viewpoints, venues, museums…) that locals name in public neighborhood Groups.",
  "Food counts the food and drink spots locals name in public neighborhood Groups, how often they come up, and nightlife corridors.",
  "Transit counts BART, Caltrain and Muni Metro stations, Muni lines, weekday trips an hour and all-night lines, from the agencies' own schedules.",
  "Interest fit is only yours: how many of the interests in your City Profile have a Group, Event or place here. It isn't shared or stored.",
  "Only public sources count, and every score shows them. There is no safety score.",
];

/* ---------- Sources ---------- */

/** Up to this many sources back each stored score. */
export const MAX_SOURCES = 8;

function distinctMentions(places: PlaceMention[]) {
  const seen = new Map<string, { source: Source; reactions: number }>();
  for (const p of places) for (const m of p.mentions) seen.set(sourceKey(m.source), m);
  return [...seen.values()];
}

/**
 * A score's candidate sources, most telling first, deduplicated. The caller keeps the public
 * ones and stores at most `MAX_SOURCES`.
 */
export function scoreSources(kind: NeighborhoodScoreKind, i: ScoreInputs): Source[] {
  const byReactions = (ps: PlaceMention[]) =>
    distinctMentions(ps)
      .sort((a, b) => b.reactions - a.reactions)
      .map((m) => m.source);
  const picks: Source[] =
    kind === "things_to_do"
      ? [
          ...[...i.events]
            .sort((a, b) => a.startAt - b.startAt)
            .slice(0, 3)
            .map((e): Source => ({ kind: "event", eventId: e.id })),
          ...[...i.activeGroups]
            .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
            .slice(0, 2)
            .map((g): Source => ({ kind: "group", groupId: g.id })),
          ...byReactions(i.places.filter((p) => isThingToDo(p.kind))),
        ]
      : kind === "food"
        ? [
            ...i.corridors.map((c) => c.source),
            ...byReactions(i.places.filter((p) => isFoodPlace(p.kind))),
          ]
        : [
            ...i.stations.filter((s) => s.system !== "muni_metro").map((s) => s.source),
            ...(i.service?.sources ?? []),
            ...i.stations.filter((s) => s.system === "muni_metro").map((s) => s.source),
            ...i.metroLines.map((l) => l.source),
          ];
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of picks) {
    const k = sourceKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/* ---------- Interest fit (personal) ---------- */

export type FitItem = { interests: InterestId[]; source: Source };

/**
 * How well a neighborhood fits the viewer's interests, 0–10: each interest
 * counts by its weight (stated 1, inferred by confidence) and is fully met by
 * two matching Groups, Events or places. Null when the viewer has no interests.
 */
export function interestFit(
  weights: ReadonlyMap<InterestId, number>,
  items: readonly FitItem[],
): { score: number; matched: { interest: InterestId; count: number }[]; sources: Source[] } | null {
  let total = 0;
  let met = 0;
  const matched: { interest: InterestId; count: number }[] = [];
  for (const [interest, w] of weights) {
    if (w <= 0) continue;
    total += w;
    const count = items.filter((it) => it.interests.includes(interest)).length;
    if (count > 0) {
      matched.push({ interest, count });
      met += w * Math.min(1, count / 2);
    }
  }
  if (total === 0) return null;
  matched.sort(
    (a, b) => (weights.get(b.interest) ?? 0) - (weights.get(a.interest) ?? 0) || b.count - a.count,
  );
  const wanted = new Set(matched.map((m) => m.interest));
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.interests.some((x) => wanted.has(x))) continue;
    const k = sourceKey(it.source);
    if (seen.has(k)) continue;
    seen.add(k);
    sources.push(it.source);
  }
  return { score: Math.round((met / total) * 100) / 10, matched, sources };
}

/* ---------- Getting around at night (no score) ---------- */

/** Words that make a local's post or comment about getting around after dark. */
const NIGHT_WORDS =
  /\b(?:well[- ]lit|lit up|lighting|street ?lights?|dark|at night|late at night|after dark|after midnight|walk(?:ing)? home|owl|last (?:bart|train|bus)|late[- ]night|night shift|midnight)\b/i;
/** Labels about an area, or who's in it, never quoted (the brief: cited facts only, no labels). */
const LABEL_WORDS =
  /\b(?:sketchy|unsafe|dangerous|bad (?:area|part|neighborhood|block)|shady|ghetto|crime|criminals?|scary|homeless|addicts?)\b/i;

export function isNightQuote(text: string): boolean {
  return NIGHT_WORDS.test(text) && !LABEL_WORDS.test(text);
}

/** Up to `n` night quotes, most reacted first, then newest. */
export function pickNightQuotes<T extends { text: string; reactions: number; createdAt: number }>(
  candidates: readonly T[],
  n = 4,
): T[] {
  return candidates
    .filter((c) => isNightQuote(c.text))
    .sort((a, b) => b.reactions - a.reactions || b.createdAt - a.createdAt)
    .slice(0, n);
}

/** "1:17 AM" from minutes after the service day's midnight (past 1440 is after midnight). */
export function clockTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
