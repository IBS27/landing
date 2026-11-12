const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "a few seconds ago", "5 minutes ago", "an hour ago", "3 days ago", "2 weeks ago". */
export function relativeAgo(ts: number, now = Date.now()) {
  const d = Math.max(0, now - ts);
  const unit = (n: number, one: string, article = "a") =>
    n <= 1 ? `${article} ${one} ago` : `${n} ${one}s ago`;
  if (d < MIN) return "a few seconds ago";
  if (d < HOUR) return unit(Math.floor(d / MIN), "minute");
  if (d < DAY) return unit(Math.floor(d / HOUR), "hour", "an");
  if (d < 7 * DAY) return unit(Math.floor(d / DAY), "day");
  if (d < 30 * DAY) return unit(Math.floor(d / (7 * DAY)), "week");
  if (d < 365 * DAY) return unit(Math.floor(d / (30 * DAY)), "month");
  return unit(Math.floor(d / (365 * DAY)), "year");
}

export const lastActive = (ts: number) => `Last active ${relativeAgo(ts)}`;

/** Card counts round ("41K members"); the group header keeps one decimal ("110.6K members"). */
export function memberCount(n: number, precise = false) {
  if (n < 1000) return n.toLocaleString("en-US");
  if (n < 1_000_000) {
    const k = n / 1000;
    const digits = precise || k < 10 ? 1 : 0;
    return `${(Math.floor(k * 10 ** digits) / 10 ** digits).toFixed(digits).replace(/\.0$/, "")}K`;
  }
  return `${(Math.floor(n / 100_000) / 10).toFixed(1).replace(/\.0$/, "")}M`;
}

export const membersLabel = (n: number, precise = false) =>
  `${memberCount(n, precise)} ${n === 1 ? "member" : "members"}`;

export const privacyLabel = (p: "public" | "private") =>
  p === "public" ? "Public group" : "Private group";

const longDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
export const formatLongDate = (ts: number) => longDate.format(new Date(ts));

/** "Created 3 years ago" style age. */
export function ageLabel(ts: number) {
  const r = relativeAgo(ts);
  return r === "a few seconds ago" ? "just now" : r;
}
