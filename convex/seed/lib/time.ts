/**
 * Seed timestamps are authored relative to "now" so the world always looks
 * fresh. Specs are plain data; `Clock` resolves them at seed time in Seattle
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
    };

export const minutesAgo = (m: number): TimeSpec => ({ kind: "offset", ms: -m * MINUTE });
export const hoursAgo = (h: number): TimeSpec => ({ kind: "offset", ms: -h * HOUR });
export const hoursFromNow = (h: number): TimeSpec => ({ kind: "offset", ms: h * HOUR });

/** `daysAgo(2)` is exactly 48h ago; `daysAgo(2, "14:30")` is 2:30 PM Seattle time two days ago. */
export const daysAgo = (d: number, hm?: string): TimeSpec =>
  hm ? { kind: "clock", days: -d, hm } : { kind: "offset", ms: -d * DAY };

export const daysFromNow = (d: number, hm?: string): TimeSpec =>
  hm ? { kind: "clock", days: d, hm, future: true } : { kind: "offset", ms: d * DAY };

const TZ = "America/Los_Angeles";

/** Offset of Seattle local time from UTC at `t`, in ms (e.g. -8h in winter). */
function seattleOffset(t: number): number {
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
    this.offset = seattleOffset(now);
  }

  /**
   * Resolve a spec. Past-intended clock times (`daysAgo`) that land after "now" are pulled back
   * just before it; `daysFromNow(0, "19:00")` that has already passed moves to the same time tomorrow.
   */
  at(spec: TimeSpec): number {
    if (spec.kind === "offset") return this.now + spec.ms;
    const [h, m] = spec.hm.split(":").map(Number);
    const local = new Date(this.now + this.offset);
    const t =
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + spec.days, h, m) -
      this.offset;
    if (spec.future) return t > this.now ? t : t + DAY;
    if (t > this.now - 2 * MINUTE) {
      return this.now - (3 + ((h * 60 + m) % 47)) * MINUTE;
    }
    return t;
  }

  /** Seattle calendar date `days` from today as "MM-DD". */
  monthDay(days = 0): string {
    const d = new Date(this.now + this.offset + days * DAY);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${mm}-${dd}`;
  }
}
