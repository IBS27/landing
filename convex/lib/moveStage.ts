import { type FactValue, isCalendarDate } from "./cityProfileFacts";
import type { PlaceStatus } from "./placeRules";

/**
 * Where the person is in their move, for Landing Home's status spine (#162):
 * Searching → Place chosen → Moving in → Settling in → Local, or Moving out
 * in the last spot. Plain rules over the viewer's own place and City Profile
 * brief, with no AI. Client-safe (no server imports): the server sends the
 * facts (`api.moveStage.get`) and the page works the stage out against today
 * in San Francisco, so the countdown rolls over at midnight without a data change.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A chosen place reads as "moving in" from this many days before its move-in. */
export const MOVING_IN_LEAD_DAYS = 14;
/** A place still marked "moving in" this many days after its move-in still reads as moving in. */
export const MOVE_IN_GRACE_DAYS = 30;
/** Days after move-in that count as settling in; from then on, local. */
export const SETTLING_DAYS = 60;
/** Countdowns run this many days out; further ahead, the date is shown. */
const COUNTDOWN_DAYS = 60;

export const STAGES = [
  { id: "searching", label: "Searching" },
  { id: "place_chosen", label: "Place chosen" },
  { id: "moving_in", label: "Moving in" },
  { id: "settling_in", label: "Settling in" },
  { id: "local", label: "Local" },
  { id: "moving_out", label: "Moving out" },
] as const;
export type Stage = (typeof STAGES)[number]["id"];

/** What the stage is read from: the viewer's own data only. */
export type MoveFacts = {
  /** The current place (`currentPlace`), or null. Dates are "YYYY-MM-DD". */
  place: { status: PlaceStatus; moveIn: string; moveOut: string | null } | null;
  /** Whether the City Profile brief is done. */
  briefDone: boolean;
  /** The move-in planned in the City Profile, before a place is chosen. */
  plannedMoveIn: FactValue<"moveIn"> | null;
};

/** Whole calendar days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** Days from `today` to `date`, or null when either can't be read. */
function daysTo(date: string | null | undefined, today: string): number | null {
  return date && isCalendarDate(date) && isCalendarDate(today) ? daysBetween(today, date) : null;
}

/**
 * The stage on `today` (San Francisco's, `todayInSF`):
 * - no current place (or one they've left): searching;
 * - moving out: their place says so;
 * - moving in: the place says so, and move-in is at most `MOVING_IN_LEAD_DAYS`
 *   ahead (place chosen before that) and at most `MOVE_IN_GRACE_DAYS` past;
 * - living there, or still "moving in" past the grace: settling in for the
 *   first `SETTLING_DAYS`, local from then on.
 * A move-in date that can't be read counts as today, so it never skips a stage.
 */
export function stageOf(f: MoveFacts, today: string): Stage {
  const p = f.place;
  if (!p || p.status === "moved_out") return "searching";
  if (p.status === "moving_out") return "moving_out";
  const until = daysTo(p.moveIn, today) ?? 0;
  if (p.status === "moving_in") {
    if (until > MOVING_IN_LEAD_DAYS) return "place_chosen";
    if (until >= -MOVE_IN_GRACE_DAYS) return "moving_in";
  }
  return -until < SETTLING_DAYS ? "settling_in" : "local";
}

/** The stages shown, in order: the last spot is Local, or Moving out while moving out. */
export function spineOf(stage: Stage): (typeof STAGES)[number][] {
  return STAGES.filter((s) => s.id !== (stage === "moving_out" ? "local" : "moving_out"));
}

const SHORT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const SHORT_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "Oct 28", with the year when it isn't this year's. */
function dayLabel(date: string, today: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  return (date.slice(0, 4) === today.slice(0, 4) ? SHORT : SHORT_YEAR).format(t);
}

/** "in 12 days", "tomorrow", "today"; the date further out. */
function ahead(date: string, days: number, today: string): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days <= COUNTDOWN_DAYS ? `in ${days} days` : dayLabel(date, today);
}

/**
 * The one line under the current stage: the move-in date or a countdown, or
 * null when no date is known. "Move-in in 12 days", "Moved in Oct 28",
 * "Move-out tomorrow", "Moving in December".
 */
export function moveLine(f: MoveFacts, today: string): string | null {
  const stage = stageOf(f, today);
  const p = f.place;
  if (stage === "searching") {
    const m = f.plannedMoveIn;
    if (!m) return null;
    const days = daysTo(m.date, today);
    if (m.date && days !== null) {
      return days >= 0 ? `Move-in ${ahead(m.date, days, today)}` : null;
    }
    // Only the month: "Moving in December" ("December 2027" another year); a past month says nothing.
    const t = Date.parse(`${m.month}-01T00:00:00Z`);
    if (Number.isNaN(t) || m.month < today.slice(0, 7)) return null;
    return `Moving in ${(m.month.slice(0, 4) === today.slice(0, 4) ? MONTH : MONTH_YEAR).format(t)}`;
  }
  if (!p) return null;
  if (stage === "moving_out") {
    const days = daysTo(p.moveOut, today);
    if (!p.moveOut || days === null) return null;
    return days >= 0
      ? `Move-out ${ahead(p.moveOut, days, today)}`
      : `Move-out was ${dayLabel(p.moveOut, today)}`;
  }
  const days = daysTo(p.moveIn, today);
  if (days === null) return null;
  if (days >= 0) return `Move-in ${ahead(p.moveIn, days, today)}`;
  // Still "moving in" after the date: it may not have happened yet.
  return stage === "moving_in"
    ? `Move-in was ${dayLabel(p.moveIn, today)}`
    : `Moved in ${dayLabel(p.moveIn, today)}`;
}
