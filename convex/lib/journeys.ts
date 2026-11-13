import { v } from "convex/values";
import { defineTask } from "../ai/agent";
import type { Source, WeekendStop } from "../validators";
import { sourceKey, sourcesOf } from "./citations";
import type { FactValue } from "./cityProfileFacts";
import { type CrewProfile, crewAnchors, sharedInterests } from "./crews";
import { type InterestId, interestsForEvent } from "./interests";
import { placeByKey } from "./places";
import {
  type BuiltStop,
  buildRoute,
  CATEGORIES,
  type Candidate,
  type Category,
  categoryOfKind,
  eventStop,
  pacificDate,
  pacificDateStart,
  type RouteEvent,
  weekendOf,
} from "./weekendRoute";

/**
 * Journeys (#32): a weekly Weekend Route for each of someone's first 90 days
 * in San Francisco, built from real Events and Group plans, with the Move-in
 * Crew members who are going. Plain code, so it works the same with AI off;
 * Muse only drafts the "Mind if I join you?" message (`museJoin`).
 *
 * `convex/journeys.ts` gathers the data, stores one row per person per week
 * from a scheduled job, and checks crew overlap live when it's read.
 */

const DAY = 24 * 60 * 60_000;
const WEEK = 7 * DAY;
export const JOURNEY_DAYS = 90;
export const JOURNEY_WEEKS = 13;
/** Plans that didn't fit the day, kept as "Also this weekend". */
export const MAX_MORE = 3;
/** A route of only Events (no Weekend Route places to fill the day) keeps this many. */
const EVENTS_ONLY_MAX = 3;

/* ---------- Which week ---------- */

type MoveIn = FactValue<"moveIn">;

/** Midnight in San Francisco on the move-in date, or on the 1st when only the month is known. */
export function moveInStart(m: MoveIn): number {
  return pacificDateStart(m.date ?? `${m.month}-01`);
}

export type JourneyWeek = {
  /** The weekend's Saturday, "2026-11-14". */
  weekOf: string;
  /** 1 to 13. */
  week: number;
  /** Saturday midnight to Monday midnight, San Francisco time. */
  start: number;
  end: number;
};

/**
 * The Journey week for this (or the coming) weekend, or null when the weekend
 * is before move-in or after the first 90 days. Week 1 is the first weekend
 * on or after move-in day.
 */
export function journeyWeek(moveIn: MoveIn, now: number): JourneyWeek | null {
  const from = moveInStart(moveIn);
  const w = weekendOf(now);
  if (w.end <= from || w.start >= from + JOURNEY_DAYS * DAY) return null;
  // Counted from the first weekend that ends after move-in (DST makes a week 7 days ± 1 hour).
  const first = weekendOf(from).start;
  const week = Math.min(JOURNEY_WEEKS, Math.round((w.start - first) / WEEK) + 1);
  return { weekOf: w.saturday, week, start: w.start, end: w.end };
}

/** Where someone is relative to their first 90 days, for the page's empty states. */
export function journeyPhase(moveIn: MoveIn, now: number): "before" | "during" | "after" {
  if (journeyWeek(moveIn, now)) return "during";
  return weekendOf(now).end <= moveInStart(moveIn) ? "before" : "after";
}

/* ---------- Ranking plans ---------- */

/** How well an Event fits someone's interests: the summed weight of the interests it serves. */
export function eventFit(
  event: { category: string; title: string },
  weights: ReadonlyMap<InterestId, number>,
): number {
  return interestsForEvent(event).reduce((s, id) => s + (weights.get(id) ?? 0), 0);
}

/**
 * Ranks a weekend plan: what fits your interests first, then crew members
 * going, then Group plans from your own Groups, then how many are going.
 */
export function planScore(p: {
  fit: number;
  crewGoing: number;
  groupPlan: boolean;
  going: number;
}): number {
  return 3 * p.fit + 2 * p.crewGoing + (p.groupPlan ? 1.5 : 0) + 0.5 * Math.log2(1 + p.going);
}

/* ---------- The route ---------- */

/**
 * A neighborhood's stored Weekend Route (#18) as route candidates, keeping
 * each place's citations as source keys (`sources` maps them back). Its order
 * is kept as priority, and its time of day as the time to go, so the day
 * keeps #18's shape when Events take some of its slots.
 */
export function routeCandidates(stops: readonly WeekendStop[]): {
  candidates: Candidate[];
  sources: Map<string, Source>;
} {
  const sources = new Map<string, Source>();
  const keys = (c: WeekendStop["citations"]) =>
    sourcesOf(c).map((s) => {
      const k = sourceKey(s);
      sources.set(k, s);
      return k;
    });
  const candidates: Candidate[] = [];
  const places = stops.filter((s) => s.kind !== "event");
  places.forEach((s, i) => {
    const category =
      categoryOfKind(s.kind) ??
      ((CATEGORIES as readonly string[]).includes(s.kind) ? (s.kind as Category) : undefined);
    if (!category) return;
    const place = s.placeKey ? placeByKey(s.placeKey) : undefined;
    candidates.push({
      name: s.name,
      ...(place && { place }),
      category,
      when: s.timeOfDay,
      why: s.why,
      sources: keys(s.citations),
      locals: places.length - i,
      ...(s.disagreement && {
        disagreement: { note: s.disagreement.note, sources: keys(s.disagreement.citations) },
      }),
    });
  });
  return { candidates, sources };
}

const byScore = (a: RouteEvent, b: RouteEvent) =>
  (b.score ?? b.going) - (a.score ?? a.going) || a.startAt - b.startAt;
const byStart = (a: { startAt?: number }, b: { startAt?: number }) =>
  (a.startAt ?? 0) - (b.startAt ?? 0);

/**
 * The week's route and the plans that didn't fit it. #18's `buildRoute` puts
 * the best-ranked day's Events in their slots and fills the rest with the
 * Weekend Route's places. With too few places for a full day, the route is
 * that day's Events alone.
 */
export function planJourney(
  candidates: readonly Candidate[],
  events: readonly RouteEvent[],
): { stops: BuiltStop[]; more: BuiltStop[] } {
  const ranked = [...events].sort(byScore);
  let stops = buildRoute(candidates, ranked);
  const top = ranked[0];
  if (!stops.length && top) {
    const day = pacificDate(top.startAt);
    stops = ranked
      .filter((e) => pacificDate(e.startAt) === day)
      .slice(0, EVENTS_ONLY_MAX)
      .sort(byStart)
      .map(eventStop);
  }
  const used = new Set(stops.flatMap((s) => s.eventId ?? []));
  const more = ranked
    .filter((e) => !used.has(e.eventId))
    .slice(0, MAX_MORE)
    .sort(byStart)
    .map(eventStop);
  return { stops, more };
}

/* ---------- Crew ---------- */

/**
 * Whether two people are still each other's crew by #30's rules: both opted
 * in (the caller passes their current opt-ins), sharing an anchor both turned
 * on and at least one interest.
 */
export function stillCrew(viewer: CrewProfile, other: CrewProfile): boolean {
  return crewAnchors(viewer, other).length > 0 && sharedInterests(viewer, other).length > 0;
}

/* ---------- Muse: "Mind if I join you?" ---------- */

export const JOIN_TASK = "muse.journeyJoin";
const JOIN_MAX = 280;

export type JoinInput = {
  /** The sender's first name. */
  you: string;
  /** First names of the crew members going. */
  people: string[];
  plan: { title: string; when: string; venue: string | null };
};

/** "Dev", "Dev and Priya", "Dev, Priya and Sam". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "long",
});
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

/** "on Saturday at 8 AM" or "on Sunday at 10:30 AM", in San Francisco time. */
export function planWhen(startAt: number): string {
  const time = clock.format(startAt).replace(":00 ", " ");
  return `on ${weekday.format(startAt)} at ${time}`;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Ways a draft misstates the plan: another weekday, another clock time ("9 PM",
 * "10:30"), or no word of the plan's title. `plan.when` is `planWhen`'s
 * "on Saturday at 8 AM".
 */
export function planProblems(text: string, plan: JoinInput["plan"]): string[] {
  const out: string[] = [];
  const m = /^on (\w+) at (\d{1,2})(?::(\d{2}))? ([AP])M$/.exec(plan.when);
  const others = WEEKDAYS.filter((d) => d !== m?.[1] && new RegExp(`\\b${d}\\b`, "i").test(text));
  if (others.length) out.push(`the plan is ${plan.when}; don't mention ${others.join(" or ")}`);
  if (m) {
    const [h, min, ap] = [Number(m[2]), Number(m[3] ?? 0), m[4]?.toLowerCase()];
    const times = [
      ...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/gi),
      ...text.matchAll(/\b(\d{1,2}):(\d{2})\b(?!\s*[ap]\.?m)/gi),
    ];
    const wrong = times.filter(
      (t) =>
        Number(t[1]) !== h ||
        Number(t[2] ?? 0) !== min ||
        (t[3] !== undefined && t[3].toLowerCase() !== ap),
    );
    if (wrong.length) out.push(`the plan starts ${plan.when}; don't give another time`);
  }
  const words = plan.title
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 4 && !WEEKDAYS.some((d) => d.toLowerCase() === w));
  const lower = text.toLowerCase();
  if (words.length && !words.some((w) => lower.includes(w)))
    out.push(`name the plan, "${plan.title}"`);
  return out;
}

/** The non-AI draft. */
export function joinTemplate(i: JoinInput): string {
  return `Hi ${nameList(i.people)}! I saw you're going to ${i.plan.title} ${i.plan.when}. Mind if I join you?`;
}

export const museJoin = defineTask({
  agent: "muse",
  name: JOIN_TASK,
  instructions: `Draft a short chat message from input.you to input.people, people from their Move-in Crew who are going to input.plan, asking whether input.you can join them.
- One to three casual, friendly sentences, under ${JOIN_MAX} characters. At most one emoji.
- Greet the people by the first names in input.people. Name the plan and when it is exactly as input.plan says. Never change the time or place, and never add plans of your own.
- Say nothing else about anyone: no neighborhoods, jobs, interests, move-in dates, or how Landing matched you.
- No links.
- sources: the key of the Event in <sources>.`,
  output: v.object({ text: v.string(), sources: v.array(v.string()) }),
  cites: (o) => o.sources,
  check: (o, input: JoinInput) => {
    const text = o.text.trim();
    const problems: string[] = [];
    if (!text) problems.push("text is empty");
    if (text.length > JOIN_MAX) problems.push(`text is over ${JOIN_MAX} characters`);
    if (!input.people.some((n) => text.includes(n)))
      problems.push("greet the people by their first names from input.people");
    if (/https?:|www\./i.test(text)) problems.push("no links");
    problems.push(...planProblems(text, input.plan));
    if (!o.sources.length) problems.push("cite the Event");
    return problems;
  },
  fallback: (input, sources) => ({
    text: joinTemplate(input),
    sources: sources.slice(0, 1).map((s) => s.key),
  }),
  cacheTtlMs: 0,
});
