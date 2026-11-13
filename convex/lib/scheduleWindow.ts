/**
 * Transit facts cite the agencies' GTFS schedules, and a schedule covers a
 * window of service days. `scripts/neighborhoods/build.ts` titles each
 * schedule source with its window ("SFMTA Muni schedule, Jul 23 – Aug 28,
 * 2026") so people can see it, and once the window has ended in San Francisco
 * the citation says the schedule may be out of date. Client-safe.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 28, 2026" from "2026-08-28"; without the year when `year` is false. */
function day(ymd: string, year = true): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${year ? `, ${y}` : ""}`;
}

/** "Jul 23 – Aug 28, 2026" (or "Dec 1, 2026 – Jan 10, 2027") from two YYYY-MM-DD days. */
export function scheduleWindow(from: string, through: string): string {
  return `${day(from, from.slice(0, 4) !== through.slice(0, 4))} – ${day(through)}`;
}

/**
 * The last day a schedule source covers (YYYY-MM-DD), from its title: "…, Jul 23 – Aug 28,
 * 2026", or the older "…GTFS…, schedule through 2026-08-28". Null for other sources.
 */
export function scheduleEnd(title: string): string | null {
  const m = / – ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(title);
  if (m) {
    const month = MONTHS.indexOf(m[1]) + 1;
    if (month > 0) return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return /\bGTFS\b.*\bthrough (\d{4}-\d{2}-\d{2})\b/.exec(title)?.[1] ?? null;
}

const sfDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

/** When a schedule source's window has ended by `now` in San Francisco: its last day, as "Aug 28, 2026". */
export function scheduleEndedOn(title: string, now: number): string | null {
  const end = scheduleEnd(title);
  return end && sfDate.format(now) > end ? day(end) : null;
}
