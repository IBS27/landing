import { type Infer, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { defineTask } from "../ai/agent";
import type { AgentSource } from "../ai/sources";
import { type RouteTime, routeTime } from "../validators";
import { snippet } from "./citations";
import { distanceMeters, type LatLng } from "./geo";
import { type InterestId, interestsForEvent, normalize } from "./interests";
import { mentions, type Place, placeNamed, placesMentioned } from "./places";

/**
 * Weekend Route (#18): one shared, cited route per neighborhood.
 *
 * 1. `convex/weekendRoutes.ts` gathers the neighborhood's public Group threads.
 * 2. Ember (`emberMentions`) lists the places locals mention, citing posts and comments.
 * 3. Spark (`sparkAgreement`) keeps the places several locals recommend and notes disagreements.
 * 4. Plain code (`buildRoute`) picks four to six stops from morning to night,
 *    with upcoming weekend Events, and coordinates only from #15's place list.
 *
 * Without AI, both steps fall back to counting place names in the same threads:
 * the "Most discussed" route, in the same shape.
 */

/* ---------- Categories and slots ---------- */

export const CATEGORIES = ["coffee", "activity", "food", "outdoors", "nightlife"] as const;
export type Category = (typeof CATEGORIES)[number];
const category = v.union(...CATEGORIES.map((c) => v.literal(c)));

/** What each kind in #15's place list is for on a weekend day. Unlisted kinds (transit, grocery) aren't stops. */
const KIND_CATEGORY: Record<string, Category> = {
  cafe: "coffee",
  bakery: "coffee",
  restaurant: "food",
  dessert: "food",
  market: "activity",
  street: "activity",
  museum: "activity",
  shop: "activity",
  bookstore: "activity",
  library: "activity",
  landmark: "activity",
  "climbing-gym": "activity",
  park: "outdoors",
  beach: "outdoors",
  trail: "outdoors",
  viewpoint: "outdoors",
  stairway: "outdoors",
  plaza: "outdoors",
  bar: "nightlife",
  brewery: "nightlife",
  "music-venue": "nightlife",
};

export function categoryOfKind(kind: string): Category | undefined {
  return KIND_CATEGORY[kind];
}

/** A slot takes its own category, or a sensible stand-in when no place of that kind is left. */
type Slot = { time: RouteTime; takes: Category; else: readonly Category[] };

/** A weekend day, in order: coffee, an activity, lunch, a park, dinner, a show or a bar. */
const SLOTS: readonly Slot[] = [
  { time: "morning", takes: "coffee", else: ["food"] },
  { time: "morning", takes: "activity", else: ["outdoors", "food"] },
  { time: "midday", takes: "food", else: ["coffee"] },
  { time: "afternoon", takes: "outdoors", else: ["activity"] },
  { time: "evening", takes: "food", else: ["nightlife"] },
  { time: "night", takes: "nightlife", else: [] },
];

export const MIN_STOPS = 4;
export const MAX_EVENTS = 2;

/** The slot an Event starting at this San Francisco hour fills. */
function eventSlot(hour: number): number {
  if (hour < 11) return 1;
  if (hour < 14) return 2;
  if (hour < 17) return 3;
  if (hour < 20) return 4;
  return 5;
}

/* ---------- Time ---------- */

const TZ = "America/Los_Angeles";
const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

function pacific(t: number) {
  const p = Object.fromEntries(parts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? ""),
  };
}

/** UTC ms of midnight in San Francisco on the given local date (Date.UTC normalizes overflowing days). */
function pacificMidnight(year: number, month: number, day: number): number {
  const wall = Date.UTC(year, month - 1, day);
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const p = pacific(t);
    t = wall - (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t);
  }
  return t;
}

/** This weekend from now if it's Saturday or Sunday in San Francisco, else the coming one. */
export function weekendWindow(now: number): { start: number; end: number } {
  const p = pacific(now);
  const toSaturday = p.weekday === 0 ? -1 : 6 - p.weekday;
  const saturday = pacificMidnight(p.year, p.month, p.day + toSaturday);
  const end = pacificMidnight(p.year, p.month, p.day + toSaturday + 2);
  return { start: Math.max(now, saturday), end };
}

export function pacificHour(t: number): number {
  return pacific(t).hour;
}

/** The San Francisco calendar day of `t`, as "2026-11-14". */
function pacificDay(t: number): string {
  const p = pacific(t);
  return `${p.year}-${p.month}-${p.day}`;
}

/* ---------- Ember: places mentioned in the threads ---------- */

export type PlaceInput = { key: string; name: string; kind: string; aliases: string[] };
export type MentionsInput = { neighborhood: string; places: PlaceInput[] };

const mention = v.object({
  /** As locals call it. */
  name: v.string(),
  /** The key from `input.places`, when it's one of them. */
  placeKey: v.optional(v.string()),
  category,
  stance: v.union(v.literal("recommends"), v.literal("mixed"), v.literal("against")),
  /** The time of day locals say to go, when they say. */
  when: v.optional(routeTime),
  tip: v.string(),
  sources: v.array(v.string()),
});
export type Mention = Infer<typeof mention>;

const TEXT_MAX = 160;

function placeKeyProblems(
  items: readonly { placeKey?: string; name: string }[],
  places: readonly PlaceInput[],
): string[] {
  const keys = new Set(places.map((p) => p.key));
  return items.flatMap((m) =>
    m.placeKey !== undefined && !keys.has(m.placeKey)
      ? [`"${m.name}": placeKey "${m.placeKey}" is not in input.places; leave it out instead`]
      : [],
  );
}

/** Mentions found by place name and alias: every source naming a listed place, one mention per place. */
export function countMentions(input: MentionsInput, sources: readonly AgentSource[]): Mention[] {
  const bySource = sources.map((s) => ({
    key: s.key,
    places: placesMentioned(s.text, input.places),
  }));
  return input.places.flatMap((p) => {
    const cat = categoryOfKind(p.kind);
    const keys = bySource.filter((s) => s.places.includes(p)).map((s) => s.key);
    return cat && keys.length
      ? [
          {
            name: p.name,
            placeKey: p.key,
            category: cat,
            stance: "mixed" as const,
            tip: "",
            sources: keys,
          },
        ]
      : [];
  });
}

export const emberMentions = defineTask({
  agent: "ember",
  name: "ember.weekendRoute.mentions",
  instructions: `<sources> are posts and comments from public Group threads in one San Francisco neighborhood (input.neighborhood). List every specific, named place locals recommend or discuss for a weekend day there: cafes, bakeries, restaurants, parks, viewpoints, stairways, murals and streets worth walking, markets, museums, shops, bars and music venues.

For each place:
- name: as locals call it.
- placeKey: the key of the matching entry in input.places (match on name or aliases). Leave it out when the place isn't listed. Never guess a key.
- category: coffee (cafes, bakeries), food (meals), activity (things to see or do), outdoors (parks, viewpoints, beaches, stairways), nightlife (bars, shows).
- stance: recommends, mixed, or against, from what the sources say about it overall.
- when: the time of day locals say to go (morning, midday, afternoon, evening or night), when they say. Leave it out otherwise.
- tip: one short sentence of concrete advice from the sources (what to order, when to go), under ${TEXT_MAX} characters.
- sources: the key of every post or comment that mentions the place.

One entry per place. Skip transit stops, groceries, homes, workplaces and anything that isn't a specific named place.`,
  output: v.object({ mentions: v.array(mention) }),
  cites: (o) => o.mentions.flatMap((m) => m.sources),
  check: (o, input: MentionsInput) => [
    ...placeKeyProblems(o.mentions, input.places),
    ...o.mentions.flatMap((m) => [
      ...(m.sources.length ? [] : [`"${m.name}": cite at least one source`]),
      ...(m.tip.length > TEXT_MAX ? [`"${m.name}": tip is over ${TEXT_MAX} characters`] : []),
    ]),
  ],
  fallback: (input, sources) => ({ mentions: countMentions(input, sources) }),
});

/* ---------- Spark: what several locals agree on ---------- */

export type AgreementInput = {
  neighborhood: string;
  places: PlaceInput[];
  mentions: Mention[];
  /** Source key → an anonymous local ("local-3"), so agreement counts people, not comments. */
  authors: Record<string, string>;
};

const agreed = v.object({
  name: v.string(),
  placeKey: v.optional(v.string()),
  category,
  when: v.optional(routeTime),
  why: v.string(),
  /** Sources where a local recommends it: at least two different locals. */
  recommendedBy: v.array(v.string()),
  disagreement: v.optional(v.object({ note: v.string(), sources: v.array(v.string()) })),
});
export type Agreed = Infer<typeof agreed>;

/** How many different locals wrote these sources. */
export function localCount(keys: readonly string[], authors: Record<string, string>): number {
  return new Set(keys.flatMap((k) => authors[k] ?? [])).size;
}

function countLabel(keys: readonly string[]) {
  const posts = keys.filter((k) => k.startsWith("post:")).length;
  const comments = keys.length - posts;
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  if (!posts) return n(comments, "comment");
  if (!comments) return n(posts, "post");
  return `${n(posts, "post")} and ${n(comments, "comment")}`;
}

/** "Most discussed": places named by at least two locals, most-mentioned first. */
export function mostDiscussed(input: AgreementInput): Agreed[] {
  const byPlace = new Map<string, Mention & { sources: string[] }>();
  for (const m of input.mentions) {
    const id = m.placeKey ?? m.name.toLowerCase();
    const prev = byPlace.get(id);
    if (prev) prev.sources = [...new Set([...prev.sources, ...m.sources])];
    else byPlace.set(id, { ...m, sources: [...new Set(m.sources)] });
  }
  return [...byPlace.values()]
    .filter((m) => localCount(m.sources, input.authors) >= 2)
    .sort(
      (a, b) =>
        localCount(b.sources, input.authors) - localCount(a.sources, input.authors) ||
        b.sources.length - a.sources.length ||
        a.name.localeCompare(b.name),
    )
    .map((m) => ({
      name: m.name,
      ...(m.placeKey !== undefined && { placeKey: m.placeKey }),
      category: m.category,
      ...(m.when && { when: m.when }),
      why: `Mentioned in ${countLabel(m.sources)}`,
      recommendedBy: m.sources,
    }));
}

export const sparkAgreement = defineTask({
  agent: "spark",
  name: "spark.weekendRoute.agreement",
  instructions: `input.mentions are places Ember found in one San Francisco neighborhood's public Group threads, each with the sources that mention it. input.authors maps each source key to an anonymous local. Find what locals agree on:
- Merge mentions of the same place.
- Keep a place only when at least two different locals (different values in input.authors) recommend it, and list those sources in recommendedBy. Someone who only mentions it, or warns against it, doesn't count.
- why: one plain sentence, under ${TEXT_MAX} characters, on what those locals agree on. No hype.
- disagreement: when some locals push back (lines, crowds, timing, noise, price), a short note on what they disagree about and the sources that say so. Leave it out when nobody does.
- Keep placeKey and category from the mentions, and when, if most locals who say a time agree on it.
Order places by how many locals recommend them, most first.`,
  output: v.object({ places: v.array(agreed) }),
  cites: (o) => o.places.flatMap((p) => [...p.recommendedBy, ...(p.disagreement?.sources ?? [])]),
  check: (o, input: AgreementInput) => {
    const seen = new Set<string>();
    return [
      ...placeKeyProblems(o.places, input.places),
      ...o.places.flatMap((p) => {
        const problems: string[] = [];
        // Agreement counts only sources Ember tied to this same place.
        const own = new Set(
          input.mentions
            .filter(
              (m) =>
                (p.placeKey !== undefined && m.placeKey === p.placeKey) ||
                normalize(m.name) === normalize(p.name),
            )
            .flatMap((m) => m.sources),
        );
        const stray = p.recommendedBy.filter((k) => !own.has(k));
        if (stray.length)
          problems.push(
            `"${p.name}": recommendedBy cites ${stray.join(", ")}, which no mention of this place cites`,
          );
        if (localCount(p.recommendedBy, input.authors) < 2)
          problems.push(
            `"${p.name}": recommendedBy needs sources from at least two different locals`,
          );
        if (!p.why.trim() || p.why.length > TEXT_MAX)
          problems.push(`"${p.name}": why must be one sentence under ${TEXT_MAX} characters`);
        if (p.disagreement && (!p.disagreement.note.trim() || !p.disagreement.sources.length))
          problems.push(`"${p.name}": a disagreement needs a note and its sources`);
        const id = p.placeKey ?? p.name.toLowerCase();
        if (seen.has(id)) problems.push(`"${p.name}" is listed twice; merge it`);
        seen.add(id);
        return problems;
      }),
    ];
  },
  fallback: (input) => ({ places: mostDiscussed(input) }),
});

/* ---------- Code: the route ---------- */

export type Candidate = {
  name: string;
  place?: Place;
  category: Category;
  /** When locals say to go. */
  when?: RouteTime;
  why: string;
  sources: string[];
  locals: number;
  disagreement?: { note: string; sources: string[] };
};

/**
 * Agreed places as route candidates. A place gets #15's coordinates only when
 * the model's place key (or the name it gave) is a listed place that one of its
 * cited sources actually names; otherwise it keeps its name but gets no pin.
 * Listed kinds that aren't weekend stops (transit, grocery) are dropped.
 */
export function toCandidates(
  agreedPlaces: readonly Agreed[],
  places: readonly Place[],
  texts: ReadonlyMap<string, string>,
  authors: Record<string, string>,
): Candidate[] {
  const named = (p: Place | undefined, keys: readonly string[]) =>
    p && keys.some((k) => mentions(texts.get(k) ?? "", p)) ? p : undefined;
  const out = new Map<string, Candidate>();
  for (const a of agreedPlaces) {
    const listed = places.find((p) => p.key === a.placeKey);
    const place =
      named(listed, a.recommendedBy) ?? named(placeNamed(a.name, places), a.recommendedBy);
    const cat = place ? categoryOfKind(place.kind) : a.category;
    if (!cat || !a.recommendedBy.length) continue;
    const id = place?.key ?? a.name.toLowerCase();
    const prev = out.get(id);
    if (prev) {
      prev.sources = [...new Set([...prev.sources, ...a.recommendedBy])];
      prev.locals = localCount(prev.sources, authors);
      continue;
    }
    out.set(id, {
      name: place?.name ?? a.name,
      ...(place && { place }),
      category: cat,
      ...(a.when && { when: a.when }),
      why: a.why,
      sources: [...new Set(a.recommendedBy)],
      locals: localCount(a.recommendedBy, authors),
      ...(a.disagreement?.sources.length && {
        disagreement: { note: a.disagreement.note, sources: [...new Set(a.disagreement.sources)] },
      }),
    });
  }
  return [...out.values()];
}

export type RouteEvent = {
  eventId: Id<"events">;
  title: string;
  category: string;
  description: string;
  startAt: number;
  endAt?: number;
  point?: LatLng;
  going: number;
  sourceKey: string;
};

/** A stop with its citations as source keys; the caller turns them into `Citations`. */
export type BuiltStop = {
  name: string;
  placeKey?: string;
  point?: LatLng;
  timeOfDay: RouteTime;
  kind: string;
  why: string;
  eventId?: Id<"events">;
  startAt?: number;
  endAt?: number;
  disagreement?: { note: string; sources: string[] };
  sources: string[];
};

/** Walking cost of a stop away from the last pinned one: one point per km; unknown spots cost a little. */
const KM_COST = 1;
const UNKNOWN_COST = 0.75;
/** When locals say what time to go ("7:30 Kumo"), a matching slot gains this much and any other loses it. */
const WHEN_WEIGHT = 1.5;

/**
 * Four to six stops in day order (empty when the threads don't support four).
 * Weekend Events take the slot their start time falls in; each other slot gets
 * the best unused candidate it takes, weighing how many locals agree against
 * the walk from the previous stop and when locals say to go. Slots still empty
 * then take a stand-in (brunch for coffee, a bar for dinner), never a park at
 * dinner.
 */
export function buildRoute(
  candidates: readonly Candidate[],
  events: readonly RouteEvent[],
): BuiltStop[] {
  const filled: (BuiltStop | undefined)[] = SLOTS.map(() => undefined);
  const used = new Set<Candidate>();

  // One day's Events only (the day of the best-attended one), so the route stays in order.
  const eventsByPick = [...events].sort((a, b) => b.going - a.going || a.startAt - b.startAt);
  const day = eventsByPick[0] && pacificDay(eventsByPick[0].startAt);
  let eventCount = 0;
  for (const e of eventsByPick) {
    if (pacificDay(e.startAt) !== day) continue;
    if (eventCount >= MAX_EVENTS) break;
    const i = eventSlot(pacificHour(e.startAt));
    if (filled[i]) continue;
    const slot = SLOTS[i] as Slot;
    filled[i] = {
      name: e.title,
      ...(e.point && { point: e.point }),
      timeOfDay: slot.time,
      kind: "event",
      why: snippet(e.description, TEXT_MAX),
      eventId: e.eventId,
      startAt: e.startAt,
      ...(e.endAt !== undefined && { endAt: e.endAt }),
      sources: [e.sourceKey],
    };
    eventCount++;
  }

  const pick = (i: number, accepts: (c: Candidate) => boolean) => {
    const prev = filled
      .slice(0, i)
      .reverse()
      .find((s) => s?.point)?.point;
    let best: Candidate | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const c of candidates) {
      if (used.has(c) || !c.sources.length || !accepts(c)) continue;
      const walk = !prev
        ? 0
        : c.place
          ? (distanceMeters(prev, c.place.point) / 1000) * KM_COST
          : UNKNOWN_COST;
      const timing = !c.when ? 0 : c.when === SLOTS[i]?.time ? WHEN_WEIGHT : -WHEN_WEIGHT;
      const score = c.locals + timing - walk;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (!best) return;
    used.add(best);
    const slot = SLOTS[i] as Slot;
    filled[i] = {
      name: best.name,
      ...(best.place && { placeKey: best.place.key, point: best.place.point }),
      timeOfDay: slot.time,
      kind: best.place?.kind ?? best.category,
      why: best.why,
      ...(best.disagreement && { disagreement: best.disagreement }),
      sources: best.sources,
    };
  };

  SLOTS.forEach((slot, i) => {
    if (!filled[i]) pick(i, (c) => c.category === slot.takes);
  });
  SLOTS.forEach((slot, i) => {
    if (!filled[i]) pick(i, (c) => slot.else.includes(c.category));
  });

  const stops = filled.filter((s): s is BuiltStop => s !== undefined);
  return stops.length >= MIN_STOPS ? stops : [];
}

/* ---------- Read-time personalization ---------- */

const KIND_INTERESTS: Record<string, readonly InterestId[]> = {
  cafe: ["coffee"],
  bakery: ["coffee"],
  coffee: ["coffee"],
  restaurant: ["restaurants"],
  dessert: ["restaurants"],
  food: ["restaurants"],
  market: ["farmers_markets"],
  museum: ["museums"],
  bookstore: ["books"],
  library: ["books"],
  "climbing-gym": ["climbing"],
  park: ["parks"],
  plaza: ["parks"],
  viewpoint: ["parks"],
  stairway: ["parks", "hiking"],
  outdoors: ["parks"],
  trail: ["hiking"],
  beach: ["beach_days"],
  bar: ["bars"],
  brewery: ["bars"],
  nightlife: ["nightlife", "bars"],
  "music-venue": ["live_music"],
};

/** The interests a stop serves, for highlighting stops that fit the viewer. */
export function stopInterests(
  stop: { kind: string },
  event?: { category: string; title: string } | null,
): InterestId[] {
  if (stop.kind === "event") return event ? interestsForEvent(event) : [];
  return [...(KIND_INTERESTS[stop.kind] ?? [])];
}
