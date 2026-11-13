/**
 * San Francisco wall-clock time for Landing's forms and previews. Event times
 * Muse drafts are written in San Francisco time, so the form that edits them
 * reads and writes that clock wherever the browser is.
 */

const TZ = "America/Los_Angeles";
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** "Nov" */
export const SF_MONTH = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" });
/** "Sat 10:00 AM" */
export const SF_WEEKDAY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
/** "Sat, Nov 14, 10:00 AM" */
export const SF_DAY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** The San Francisco calendar date and clock at `t`. */
export function sfParts(t: number) {
  const p = Object.fromEntries(PARTS.formatToParts(t).map((x) => [x.type, Number(x.value)]));
  return {
    year: p.year ?? 1970,
    month: p.month ?? 1,
    day: p.day ?? 1,
    hour: p.hour ?? 0,
    minute: p.minute ?? 0,
  };
}

/** `t` as a `datetime-local` value on San Francisco's clock: "2026-11-14T10:00". */
export function toSfInput(t: number): string {
  const d = sfParts(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${pad(d.month)}-${pad(d.day)}T${pad(d.hour)}:${pad(d.minute)}`;
}

/** A `datetime-local` value read as San Francisco wall-clock time (DST included), or NaN. */
export function fromSfInput(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return Number.NaN;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Shift by San Francisco's offset at the guess; a second pass settles DST changeovers.
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const d = sfParts(t);
    t = wall - (Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute) - t);
  }
  return t;
}
