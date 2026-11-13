import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import {
  type FactEntry,
  type NeighborhoodSlug,
  neighborhoodLabel,
  neighborhoodSlug,
  SF_NEIGHBORHOODS,
} from "./cityProfileFacts";
import { getInterest, type InterestId, interestId, normalize } from "./interests";

/**
 * Learn from activity (#4): the signal model and the counting rules. Client-safe
 * and pure, so the rules are unit-tested. No AI: an interest is inferred from
 * weighted, decaying counts. Writes and hooks live in `./activity.ts`.
 */

/** How much each action counts toward an interest or neighborhood. A skip counts against. */
export const SIGNAL_WEIGHTS = {
  going: 3,
  join: 2,
  interested: 1,
  save: 1,
  like: 0.5,
  skip: -2,
} as const;
export type SignalKind = keyof typeof SIGNAL_WEIGHTS;
export const signalKind = literals("going", "join", "interested", "save", "like", "skip");

/** Like, Love, Care, Haha and Wow count as a like; Sad and Angry don't say someone wants more. */
export function isPositiveReaction(type: string): boolean {
  return type === "like" || type === "love" || type === "care" || type === "haha" || type === "wow";
}

export const signalTargetKind = literals("event", "group", "post", "listing");
export type SignalTargetKind = Infer<typeof signalTargetKind>;
/** What a "Not for me" skip can be on: Landing's Event, Group and listing cards. */
export const skipTargetKind = literals("event", "group", "listing");
export type SkipTargetKind = Infer<typeof skipTargetKind>;

/** One `profileSignals` row. */
export const profileSignal = v.object({
  userId: v.id("users"),
  kind: signalKind,
  targetKind: signalTargetKind,
  /** The Event, Group, post or listing id. */
  targetId: v.string(),
  /** From #3's lookups; never empty (a target with no interest isn't recorded). */
  interestIds: v.array(interestId),
  neighborhoodSlug: v.optional(neighborhoodSlug),
  /** When the action happened; weights decay from here. */
  at: v.number(),
  /** Last change (recorded, redone or undone); debounces the recompute. */
  updatedAt: v.number(),
  /** Set when the action was undone (un-RSVP, leave, unreact, unsave, unskip). */
  undoneAt: v.optional(v.number()),
});

const DAY = 24 * 60 * 60 * 1000;
/** A signal counts half as much after this long. */
export const HALF_LIFE_MS = 60 * DAY;
/** Older signals count for under 2% and aren't read. */
export const MAX_AGE_MS = 365 * DAY;
/** Score needed to infer an interest or neighborhood… */
export const THRESHOLD = 4;
/** …across at least this many distinct targets that count for it. */
export const MIN_TARGETS = 2;
/** At most this many signal ids are kept as evidence. */
export const MAX_EVIDENCE = 20;

export type SignalLike = {
  _id: string;
  kind: SignalKind;
  targetKind: SignalTargetKind;
  targetId: string;
  interestIds: readonly InterestId[];
  neighborhoodSlug?: NeighborhoodSlug;
  at: number;
  undoneAt?: number;
};

/** A signal's weight now: its kind's weight, halved every 60 days. Undone signals count 0. */
export function signalWeight(s: SignalLike, now: number): number {
  if (s.undoneAt !== undefined) return 0;
  const age = Math.max(0, now - s.at);
  return SIGNAL_WEIGHTS[s.kind] * 0.5 ** (age / HALF_LIFE_MS);
}

/** Inference confidence from a score: 0.4 at the threshold, rising to 0.9. Never 1 (that's stated). */
export function confidenceFor(score: number): number {
  return Math.min(0.9, Math.max(0.4, 0.4 + (score - THRESHOLD) * 0.05));
}

export type Inference<S extends SignalLike = SignalLike> = {
  score: number;
  confidence: number;
  /** The signals that count for it, strongest first. */
  signals: S[];
};

function tally<K extends string, S extends SignalLike>(
  signals: S[],
  now: number,
  keysOf: (s: S) => readonly K[],
): Map<K, Inference<S>> {
  const acc = new Map<K, { score: number; targets: Set<string>; signals: [S, number][] }>();
  for (const s of signals) {
    const w = signalWeight(s, now);
    if (w === 0) continue;
    for (const k of new Set(keysOf(s))) {
      const t = acc.get(k) ?? { score: 0, targets: new Set(), signals: [] };
      t.score += w;
      if (w > 0) {
        t.targets.add(s.targetId);
        t.signals.push([s, w]);
      }
      acc.set(k, t);
    }
  }
  const out = new Map<K, Inference<S>>();
  for (const [k, t] of acc) {
    if (t.score < THRESHOLD || t.targets.size < MIN_TARGETS) continue;
    out.set(k, {
      score: t.score,
      confidence: confidenceFor(t.score),
      signals: t.signals.sort((a, b) => b[1] - a[1]).map(([s]) => s),
    });
  }
  return out;
}

/** What someone's activity says: interests and neighborhoods over the threshold. */
export function inferFromSignals<S extends SignalLike>(signals: S[], now: number) {
  return {
    interests: tally(signals, now, (s) => s.interestIds),
    neighborhoods: tally(signals, now, (s) =>
      s.neighborhoodSlug ? [s.neighborhoodSlug] : ([] as NeighborhoodSlug[]),
    ),
  };
}

/** What a reason is about: an interest or neighborhood fact. */
export type Subject = Extract<FactEntry, { key: "interest" | "neighborhood" }>;

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function list(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The plain reason shown with an inferred fact: "RSVP'd to 3 climbing Events,
 * joined Bay Area Climbers and liked 2 related posts". `names` holds the Event
 * titles and Group names that may be shown; anything else is counted instead.
 */
export function activitySummary(
  subject: Subject,
  signals: SignalLike[],
  names: ReadonlyMap<string, string>,
): string {
  const of = (kind: SignalKind) => signals.filter((s) => s.kind === kind);
  const about =
    subject.key === "interest" ? getInterest(subject.value.id).label.toLowerCase() : null;
  const where =
    subject.key === "neighborhood" ? ` in ${neighborhoodLabel(subject.value.slug)}` : "";
  const noun = (n: number, one: string) =>
    about ? `${n} ${about} ${n === 1 ? one : `${one}s`}` : `${plural(n, one)}${where}`;
  const named = (rows: SignalLike[]) => {
    const ns = rows.map((s) => names.get(s.targetId));
    return rows.length <= 2 && ns.every((n) => n !== undefined) ? list(ns as string[]) : null;
  };

  const parts: string[] = [];
  const going = of("going");
  if (going.length) parts.push(`RSVP'd to ${named(going) ?? noun(going.length, "Event")}`);
  const joined = of("join");
  if (joined.length) parts.push(`joined ${named(joined) ?? noun(joined.length, "Group")}`);
  const interested = of("interested");
  if (interested.length) parts.push(`were interested in ${noun(interested.length, "Event")}`);
  const saved = of("save");
  if (saved.length) parts.push(`saved ${plural(saved.length, "related item")}`);
  const liked = of("like");
  if (liked.length) parts.push(`liked ${plural(liked.length, "related post")}`);

  const text = list(parts);
  return text ? text[0].toUpperCase() + text.slice(1) : "From your activity";
}

const NEIGHBORHOOD_NAMES = new Map<string, NeighborhoodSlug>(
  // Parks are real boundaries but nobody lives there, so they aren't learned.
  SF_NEIGHBORHOODS.filter((n) => !("park" in n)).flatMap((n) => [
    [normalize(n.name), n.slug] as const,
    ...("short" in n ? [[normalize(n.short), n.slug] as const] : []),
  ]),
);

/**
 * The SF neighborhood a place string names, from its comma-separated parts:
 * "Valencia St & 18th St, Mission" → mission, "Mission District, San Francisco"
 * → mission. Parks map to none. A lookup, not geocoding; #15's `neighborhoodId` replaces it once
 * Events and Groups carry one.
 */
export function neighborhoodIn(place: string | undefined): NeighborhoodSlug | undefined {
  for (const part of (place ?? "").split(",")) {
    const slug = NEIGHBORHOOD_NAMES.get(normalize(part).replace(/ district$/, ""));
    if (slug) return slug;
  }
  return undefined;
}
