import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Feed-style short age: "Just now", "5m", "3h", "2d", "4w", "1y". */
export function shortAge(ts: number, now = Date.now()) {
  const d = now - ts;
  if (d < MIN) return "Just now";
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  if (d < 365 * DAY) return `${Math.floor(d / (7 * DAY))}w`;
  return `${Math.floor(d / (365 * DAY))}y`;
}

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const monthDayFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const fullDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Post header timestamp, matching Facebook: "3h", "Yesterday at 4:12 PM", "November 5 at 12:21 PM", "March 3, 2024". */
export function postTime(ts: number, now = Date.now()) {
  const d = now - ts;
  if (d < DAY) return shortAge(ts, now);
  const date = new Date(ts);
  const yesterday = new Date(now - DAY);
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday at ${timeFmt.format(date)}`;
  if (date.getFullYear() === new Date(now).getFullYear())
    return `${monthDayFmt.format(date)} at ${timeFmt.format(date)}`;
  return fullDateFmt.format(date);
}

/** Full tooltip timestamp: "Wednesday, November 5, 2026 at 12:21 PM". */
export function fullTimestamp(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** Compact counts: 999, 1.2K, 12K, 3.4M. */
export function compactCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function price(n: number) {
  if (n === 0) return "Free";
  return `$${n.toLocaleString("en-US")}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
