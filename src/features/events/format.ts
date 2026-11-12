/** Event date strings, matching Facebook's wording. All in the viewer's local time. */

const DAY = 86_400_000;

/** "7 PM" / "7:30 PM". */
export function clock(ts: number) {
  const d = new Date(ts);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayDiff(ts: number, now: number) {
  return Math.round((startOfDay(ts) - startOfDay(now)) / DAY);
}

const sameYear = (ts: number, now: number) =>
  new Date(ts).getFullYear() === new Date(now).getFullYear();

function fmt(ts: number, o: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", o).format(new Date(ts));
}

/** Card date: "Sat, Nov 21 at 10 PM", "Sat, Jan 23, 2027 at 12 AM", "Happening now". */
export function cardDate(start: number, end: number | null, now = Date.now()) {
  if (start <= now && (end ?? start + 3 * 3_600_000) > now) return "Happening now";
  const date = fmt(start, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear(start, now) ? undefined : "numeric",
  });
  return `${date} at ${clock(start)}`;
}

/** Relative date used in the rail and search rows: "Today at 2 PM – 4 PM", "Saturday at 10 AM". */
export function relativeDate(
  start: number,
  end: number | null,
  now = Date.now(),
  thisPrefix = false,
) {
  const diff = dayDiff(start, now);
  const range = end && dayDiff(end, start) === 0 ? ` – ${clock(end)}` : "";
  if (start <= now && (end ?? start + 3 * 3_600_000) > now) return "Happening now";
  if (diff === 0) return `Today at ${clock(start)}${range}`;
  if (diff === 1) return `Tomorrow at ${clock(start)}${range}`;
  if (diff > 1 && diff < 7)
    return `${thisPrefix ? "This " : ""}${fmt(start, { weekday: "long" })} at ${clock(start)}${range}`;
  return `${cardDate(start, end, now)}${range}`;
}

/** Event page date line: "Saturday, January 23, 2027 at 12 AM" / "... from 8 PM to 11 PM". */
export function longDate(start: number, end: number | null, now = Date.now()) {
  const date = fmt(start, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: sameYear(start, now) ? undefined : "numeric",
  });
  if (end && dayDiff(end, start) === 0) return `${date} from ${clock(start)} to ${clock(end)}`;
  if (end) {
    const endDate = fmt(end, { month: "long", day: "numeric" });
    return `${date} at ${clock(start)} – ${endDate} at ${clock(end)}`;
  }
  return `${date} at ${clock(start)}`;
}

export function monthShort(ts: number) {
  return fmt(ts, { month: "short" }).toUpperCase();
}

/** Local date ranges for the date filters. */
export type DateRange = "any" | "today" | "tomorrow" | "this_week" | "this_weekend" | "next_week";

export const DATE_LABELS: Record<DateRange, string> = {
  any: "Any date",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  this_weekend: "This weekend",
  next_week: "Next week",
};

export function rangeFor(r: DateRange, now = Date.now()): { from?: number; to?: number } {
  const today = startOfDay(now);
  const dow = new Date(today).getDay(); // 0 Sun
  const daysToSunday = (7 - dow) % 7;
  switch (r) {
    case "any":
      return {};
    case "today":
      return { from: today, to: today + DAY };
    case "tomorrow":
      return { from: today + DAY, to: today + 2 * DAY };
    case "this_week":
      return { from: today, to: today + (daysToSunday + 1) * DAY };
    case "this_weekend": {
      const sat = today + ((6 - dow + 7) % 7) * DAY;
      return { from: dow === 0 ? today : sat, to: today + (daysToSunday + 1) * DAY };
    }
    case "next_week": {
      const mon = today + (daysToSunday + 1) * DAY;
      return { from: mon, to: mon + 7 * DAY };
    }
  }
}

/** Today's local midnight (stable within a day, so query args don't churn). */
export function todayStart(now = Date.now()) {
  return startOfDay(now);
}

/** Hide an image that failed to load (the grey placeholder behind it shows instead). */
export function hideBroken(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.style.visibility = "hidden";
}
