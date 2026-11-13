import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { defineTask } from "../ai/agent";
import type { CheckInActivity, CheckInSuggestion } from "../validators";
import type { InterestId } from "./interests";
import { type JoinInput, planProblems, planWhen } from "./journeys";
import { pacificDateStart } from "./weekendRoute";

/**
 * Weekly check-ins and levels (#33). Plain code, so they're the same with AI
 * off; Muse only rephrases the suggestion (`museCheckIn`). The Journeys job
 * gathers the activity and stores it (`convex/checkIns.ts`).
 *
 * What counts, each from the table it lives in (not from #4's signals, which
 * aren't recorded when someone turns learning off). Undoing an action removes
 * its row, so undone actions never count:
 * - Events: RSVP'd Going, in person, started in the window and already over.
 * - Groups: joined in the window.
 * - New friends: friendships accepted in the window, after move-in.
 * - Journey stops: those Events that were on a Journey (#32). Place stops
 *   aren't counted: Landing has no live location to know you went.
 */

const DAY = 24 * 60 * 60_000;

/* ---------- Windows ---------- */

/**
 * A Journey week's check-in window: the Monday before its weekend (Saturday
 * `weekOf`) to the Monday after (`endsAt`), San Francisco time. Week 1 starts
 * on move-in day instead.
 */
export function checkInWindow(
  row: { weekOf: string; endsAt: number },
  moveInAt: number,
): { from: number; to: number } {
  const from = Math.max(moveInAt, pacificDateStart(addDays(row.weekOf, -5)));
  return { from, to: Math.max(from, row.endsAt) };
}

/** The window of the week before, or null when `row` is week 1. */
export function lastWeekWindow(
  row: { weekOf: string; week: number },
  moveInAt: number,
): { from: number; to: number } | null {
  if (row.week <= 1) return null;
  const to = pacificDateStart(addDays(row.weekOf, -5));
  return checkInWindow({ weekOf: addDays(row.weekOf, -7), endsAt: to }, moveInAt);
}

/** A "YYYY-MM-DD" date plus some days. */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days since move-in, never negative. */
export function daysSince(moveInAt: number, now: number): number {
  return Math.max(0, Math.floor((now - moveInAt) / DAY));
}

/* ---------- Counting ---------- */

/** One thing someone did, with when it counts (Event start, join, friendship). */
export type Done<T extends string> = { id: T; at: number };

export type Activity = {
  events: Done<Id<"events">>[];
  groups: Done<Id<"groups">>[];
  friends: Done<Id<"users">>[];
};

/** Most of each kind stored per window. A newcomer's first 90 days rarely come close. */
export const MAX_PER_KIND = 50;

const within = <T extends string>(xs: readonly Done<T>[], from: number, to: number) =>
  xs
    .filter((x) => x.at >= from && x.at < to)
    .slice(0, MAX_PER_KIND)
    .map((x) => x.id);

/** The activity in `[from, to)`, as stored. `journeyEvents` are Events that were on a Journey. */
export function activityIn(
  a: Activity,
  from: number,
  to: number,
  journeyEvents: ReadonlySet<Id<"events">>,
): CheckInActivity {
  const events = within(a.events, from, to);
  return {
    events,
    groups: within(a.groups, from, to),
    friends: within(a.friends, from, to),
    journeyStops: events.filter((id) => journeyEvents.has(id)),
  };
}

/** Things done toward a level: Events, Groups and new friends (Journey stops are Events already). */
export function doneCount(a: { events: unknown[]; groups: unknown[]; friends: unknown[] }) {
  return a.events.length + a.groups.length + a.friends.length;
}

/* ---------- Levels ---------- */

/**
 * Levels, private to their owner. Each needs time since move-in and a light
 * bar of things done (Events gone to, Groups joined, new friends), so a level
 * means you've started settling in, not just that time passed:
 * - Explore: from move-in day (week 1).
 * - Regular: a month in (day 30) and 2 things done.
 * - Local: in month 3 (day 60) and 6 things done.
 * Levels follow what still counts, so an undone RSVP can take one back.
 */
export const LEVELS = [
  { id: "explore", label: "Explore", day: 0, done: 0 },
  { id: "regular", label: "Regular", day: 30, done: 2 },
  { id: "local", label: "Local", day: 60, done: 6 },
] as const;
export type LevelId = (typeof LEVELS)[number]["id"];

export type LevelView = {
  id: LevelId;
  label: string;
  /** 1-based, of `LEVELS.length`. */
  rank: number;
  /** What the next level still needs: days to wait and things to do. Null at Local. */
  next: { id: LevelId; label: string; daysLeft: number; moreNeeded: number } | null;
};

export function levelFor(days: number, done: number): LevelView {
  let i = 0;
  for (let j = 1; j < LEVELS.length; j++) {
    const l = LEVELS[j];
    if (l && days >= l.day && done >= l.done) i = j;
  }
  const level = LEVELS[i] ?? LEVELS[0];
  const n = LEVELS[i + 1];
  return {
    id: level.id,
    label: level.label,
    rank: i + 1,
    next: n
      ? {
          id: n.id,
          label: n.label,
          daysLeft: Math.max(0, n.day - days),
          moreNeeded: Math.max(0, n.done - done),
        }
      : null,
  };
}

/* ---------- What to try next ---------- */

/** A plan on this weekend's Journey that the person isn't going to yet and that isn't over. */
export type PlanOption = {
  eventId: Id<"events">;
  title: string;
  startAt: number;
  interests: InterestId[];
  /** The Group whose plan it is, if it's a Group plan the person can see. */
  group: { _id: Id<"groups">; name: string } | null;
  /** Journey rank, best first. */
  rank: number;
};

export type SuggestInput = {
  /** Things done in the last finished week, or null in week 1 (no finished week yet). */
  lastWeekDone: number | null;
  /** Events they went to since move-in, newest first. `title` is null when it can't be named. */
  attended: { eventId: Id<"events">; title: string | null; interests: InterestId[] }[];
  /** Groups they joined since move-in. */
  joined: ReadonlySet<Id<"groups">>;
  /** #31's crew Group (when they're in it) and its first meetup. */
  crewGroup: { _id: Id<"groups">; name: string } | null;
  meetup: {
    eventId: Id<"events">;
    title: string;
    startAt: number;
    over: boolean;
    going: boolean;
  } | null;
  /** This weekend's plans, best first. */
  plans: PlanOption[];
};

type Target = { kind: "event"; eventId: Id<"events"> } | { kind: "group"; groupId: Id<"groups"> };

/** A suggestion before it's stored: what it points at, its text and its sources (target first). */
export type Suggestion = {
  kind: CheckInSuggestion["kind"];
  eventId?: Id<"events">;
  groupId?: Id<"groups">;
  template: string;
  sources: [Target, ...Target[]];
};

const eventSource = (eventId: Id<"events">) => ({ kind: "event" as const, eventId });
const when = (p: { startAt: number }) => planWhen(p.startAt);

function forPlan(
  kind: Suggestion["kind"],
  p: PlanOption,
  template: string,
  also: Target[] = [],
): Suggestion {
  return { kind, eventId: p.eventId, template, sources: [eventSource(p.eventId), ...also] };
}

/**
 * What the check-in suggests next, adapting to what they actually did:
 * 1. Their crew's first meetup (#31) is coming up and they aren't going: that.
 * 2. They didn't make the meetup: the crew Group's next plan, or the Group.
 * 3. A quiet last week: one easy plan, and no pressure.
 * 4. More of what they went to: a plan sharing an interest with an Event they
 *    went to (newest first), else a plan from a Group they joined.
 * 5. Otherwise the top plan on this weekend's Journey.
 * Null when there's nothing to point at.
 */
export function pickSuggestion(i: SuggestInput): Suggestion | null {
  const m = i.meetup;
  if (m && !m.over && !m.going)
    return {
      kind: "crewMeetup",
      eventId: m.eventId,
      template: `Your Move-in Crew's first meetup is ${m.title} ${when(m)}. Want to go?`,
      sources: [eventSource(m.eventId)],
    };
  if (m?.over && !m.going && i.crewGroup) {
    const g = i.crewGroup;
    const next = i.plans.find((p) => p.group?._id === g._id);
    if (next)
      return forPlan(
        "crewGroup",
        next,
        `Your crew has another plan in ${g.name}: ${next.title} ${when(next)}.`,
      );
    return {
      kind: "crewGroup",
      groupId: g._id,
      template: `Your crew got together at ${m.title}. Say hi in ${g.name} and catch the next one.`,
      sources: [{ kind: "group", groupId: g._id }],
    };
  }
  const top = i.plans[0];
  if (!top) return null;
  if (i.lastWeekDone === 0)
    return forPlan("light", top, `One plan is plenty this weekend: ${top.title} ${when(top)}.`);
  for (const went of i.attended) {
    const like = i.plans.find((p) => p.interests.some((id) => went.interests.includes(id)));
    if (!like) continue;
    const because = went.title ? `You went to ${went.title}.` : "Like what you've been going to:";
    return forPlan(
      "moreLike",
      like,
      `${because} More like it this weekend: ${like.title} ${when(like)}.`,
      [eventSource(went.eventId)],
    );
  }
  const groupPlan = i.plans.find((p) => p.group && i.joined.has(p.group._id));
  if (groupPlan?.group)
    return forPlan(
      "groupPlan",
      groupPlan,
      `From ${groupPlan.group.name}, a Group you joined: ${groupPlan.title} ${when(groupPlan)}.`,
    );
  return forPlan("journey", top, `Up next on your Journey: ${top.title} ${when(top)}.`);
}

/* ---------- Muse: phrasing the suggestion ---------- */

export const CHECK_IN_TASK = "muse.checkIn";
const CHECK_IN_MAX = 220;

export type CheckInInput = {
  /** The person's first name. */
  you: string;
  weeksIn: number;
  /** Counts for the last finished week, or null in week 1. */
  lastWeek: { events: number; groups: number; friends: number } | null;
  kind: CheckInSuggestion["kind"];
  /** The plan suggested, as the Journey shows it. */
  plan: JoinInput["plan"] | null;
  /** The Group suggested or the plan's Group. */
  group: string | null;
  /** The Event they went to that this builds on. */
  wentTo: string | null;
  /** The plain version to rephrase. */
  draft: string;
};

/** Words a check-in never uses: no streaks, scores or guilt. */
const PRESSURE =
  /\b(streaks?|leaderboards?|behind|missed|failed|lazy|should have|only|rank(ed|ing)?|points?)\b/i;

/** Ways a phrasing breaks the check-in's rules. Exported for tests. */
export function checkInProblems(text: string, input: CheckInInput): string[] {
  const t = text.trim();
  const out: string[] = [];
  if (!t) out.push("text is empty");
  if (t.length > CHECK_IN_MAX) out.push(`text is over ${CHECK_IN_MAX} characters`);
  if (/https?:|www\./i.test(t)) out.push("no links");
  // Names from the input (a plan called "Members Only Mixer") don't count as pressure.
  const own = [input.plan?.title, input.group, input.wentTo].filter((x): x is string => !!x);
  if (PRESSURE.test(own.reduce((rest, name) => rest.split(name).join(" "), t)))
    out.push("keep it encouraging: no streaks, scores, guilt or words like 'missed' or 'only'");
  const numbers = new Set(JSON.stringify(input).match(/\d+/g) ?? []);
  const invented = (t.match(/\d+/g) ?? []).filter((n) => !numbers.has(n));
  if (invented.length) out.push(`use only numbers from the input (not ${invented.join(", ")})`);
  if (input.plan) out.push(...planProblems(t, input.plan));
  else if (input.group && !t.includes(input.group)) out.push(`name the Group, "${input.group}"`);
  return out;
}

export const museCheckIn = defineTask({
  agent: "muse",
  name: CHECK_IN_TASK,
  instructions: `Rewrite input.draft, the next step in input.you's weekly check-in for their first weeks in San Francisco, so it reads warm and natural. It's shown only to input.you.
- One or two short sentences, under ${CHECK_IN_MAX} characters, speaking to input.you as "you". At most one emoji.
- Suggest exactly what input.draft suggests: input.plan (its title and when, exactly as given) or else input.group. Never add plans, places, times or people.
- You may mention input.wentTo or input.lastWeek, using only those numbers. Encouraging, never pushy: no streaks, scores, guilt, "missed" or "only". A quiet week is fine.
- No links.
- sources: the keys in <sources> for what you mention (always the suggested plan or Group).`,
  output: v.object({ text: v.string(), sources: v.array(v.string()) }),
  cites: (o) => o.sources,
  check: (o, input: CheckInInput) => [
    ...checkInProblems(o.text, input),
    ...(o.sources.length ? [] : ["cite the suggested plan or Group"]),
  ],
  fallback: (input, sources) => ({
    text: input.draft,
    sources: sources.map((s) => s.key),
  }),
});
