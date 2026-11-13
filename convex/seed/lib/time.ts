/**
 * Seed timestamps are authored relative to "now" so the world always looks
 * fresh. Specs are plain data; `Clock` resolves them at seed time in San Francisco
 * local time.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type TimeSpec =
  | { readonly kind: "offset"; readonly ms: number }
  | {
      readonly kind: "clock";
      readonly days: number;
      readonly hm: string;
      readonly future?: boolean;
      /** Whole calendar years back (same month and day), for "On this day" memories. */
      readonly years?: number;
      /** Counted from this weekend's Saturday (0) instead of today, as `weekendDay` does. */
      readonly weekend?: boolean;
    };

export const minutesAgo = (m: number): TimeSpec => ({ kind: "offset", ms: -m * MINUTE });
export const hoursAgo = (h: number): TimeSpec => ({ kind: "offset", ms: -h * HOUR });
export const hoursFromNow = (h: number): TimeSpec => ({ kind: "offset", ms: h * HOUR });

/** `daysAgo(2)` is exactly 48h ago; `daysAgo(2, "14:30")` is 2:30 PM San Francisco time two days ago. */
export const daysAgo = (d: number, hm?: string): TimeSpec =>
  hm ? { kind: "clock", days: -d, hm } : { kind: "offset", ms: -d * DAY };

/** Today's San Francisco month-day `n` years ago at `hm` (Feb 29 rolls to Mar 1). */
export const yearsAgo = (n: number, hm: string): TimeSpec => ({
  kind: "clock",
  days: 0,
  hm,
  years: n,
});

/**
 * Saturday (0) or Sunday (1) of this weekend in San Francisco, or the coming
 * one on a weekday, at `hm`: for plans that must land on the weekend whatever
 * day the seed runs (Journeys, #32).
 */
export const weekendDay = (d: 0 | 1, hm: string): TimeSpec => ({
  kind: "clock",
  days: d,
  hm,
  future: true,
  weekend: true,
});

export const daysFromNow = (d: number, hm?: string): TimeSpec =>
  hm ? { kind: "clock", days: d, hm, future: true } : { kind: "offset", ms: d * DAY };

const TZ = "America/Los_Angeles";

/** Offset of San Francisco (Pacific) local time from UTC at `t`, in ms (e.g. -8h in winter). */
function pacificOffset(t: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return Math.round((local - Math.floor(t / MINUTE) * MINUTE) / MINUTE) * MINUTE;
  } catch {
    return -8 * HOUR;
  }
}

export class Clock {
  readonly now: number;
  private readonly offset: number;

  constructor(now: number) {
    this.now = now;
    this.offset = pacificOffset(now);
  }

  /**
   * Resolve a spec. Past-intended clock times (`daysAgo`) that land after "now" are pulled back
   * just before it; `daysFromNow(0, "19:00")` that has already passed moves to the same time tomorrow.
   */
  at(spec: TimeSpec): number {
    if (spec.kind === "offset") return this.now + spec.ms;
    const [h, m] = spec.hm.split(":").map(Number);
    const local = new Date(this.now + this.offset);
    const weekday = local.getUTCDay();
    const toSaturday = !spec.weekend ? 0 : weekday === 0 ? -1 : 6 - weekday;
    const t =
      Date.UTC(
        local.getUTCFullYear() - (spec.years ?? 0),
        local.getUTCMonth(),
        local.getUTCDate() + toSaturday + spec.days,
        h,
        m,
      ) - this.offset;
    if (spec.future) return t > this.now ? t : t + DAY;
    if (!spec.years && t > this.now - 2 * MINUTE) {
      return this.now - (3 + ((h * 60 + m) % 47)) * MINUTE;
    }
    return t;
  }

  /** San Francisco calendar date `days` from today as "MM-DD". */
  monthDay(days = 0): string {
    return this.monthDayOf(this.now + days * DAY);
  }

  /** San Francisco calendar date of `t` as "MM-DD" (using today's UTC offset). */
  monthDayOf(t: number): string {
    const d = new Date(t + this.offset);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${mm}-${dd}`;
  }
}
