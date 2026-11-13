import type { CitedSource, NonEmpty } from "../../convex/lib/citations";
import { scheduleEndedOn } from "../../convex/lib/scheduleWindow";
import { compactCount, plural, price } from "./format";

/** Text for citation sources. Pure, so ages are computed at render and stay current. */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const eventFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const UNITS = [
  [YEAR, "year"],
  [MONTH, "month"],
  [WEEK, "week"],
  [DAY, "day"],
  [HOUR, "hour"],
  [MIN, "minute"],
] as const;

/** "just now", "5 minutes ago", "2 weeks ago", "1 year ago". Future times read "in 3 days". */
export function timeAgo(ts: number, now = Date.now()) {
  const d = Math.abs(now - ts);
  const unit = UNITS.find(([ms]) => d >= ms);
  if (!unit) return "just now";
  const span = plural(Math.floor(d / unit[0]), unit[1]);
  return ts > now ? `in ${span}` : `${span} ago`;
}

/** Who or what the source is: "Maya Chen in Mission Climbers", "Run Club Saturday". */
export function sourceTitle(s: CitedSource) {
  switch (s.kind) {
    case "post":
      return s.group ? `${s.author.name} in ${s.group.name}` : s.author.name;
    case "comment":
      return s.group
        ? `${s.author.name} commented in ${s.group.name}`
        : `${s.author.name} commented`;
    case "event":
    case "listing":
    case "external":
      return s.title;
    case "group":
      return s.name;
  }
}

/** Live counts and age: "15 comments · 2 weeks ago". */
export function sourceMeta(s: CitedSource, now = Date.now()) {
  switch (s.kind) {
    case "post":
      return join(
        s.commentCount > 0 && plural(s.commentCount, "comment"),
        timeAgo(s.createdAt, now),
      );
    case "comment":
      return join(
        s.replyCount > 0 && plural(s.replyCount, "reply", "replies"),
        timeAgo(s.createdAt, now),
      );
    case "event": {
      const past = s.startAt < now;
      return join(
        past ? timeAgo(s.startAt, now) : eventFmt.format(s.startAt),
        s.goingCount > 0 && `${compactCount(s.goingCount)} ${past ? "went" : "going"}`,
      );
    }
    case "listing":
      return join(
        s.status === "sold" ? "Sold" : price(s.price),
        s.neighborhood,
        `listed ${timeAgo(s.createdAt, now)}`,
      );
    case "group":
      return join(
        `${compactCount(s.memberCount)} ${s.memberCount === 1 ? "member" : "members"}`,
        `active ${timeAgo(s.lastActivityAt, now)}`,
      );
    case "external":
      // A transit schedule whose window has ended still backs its facts, but may be out of date.
      return join(
        s.publisher,
        scheduleEndedOn(s.title, now)
          ? "schedule may be out of date"
          : `fetched ${dateFmt.format(s.fetchedAt)}`,
      );
  }
}

/**
 * "Schedule may be out of date (ended Aug 28, 2026)" when any of `sources` is a transit
 * schedule whose window has ended (the earliest end), else null.
 */
export function outdatedSchedule(sources: readonly CitedSource[], now = Date.now()) {
  const ended = sources.flatMap((s) => {
    if (s.kind !== "external") return [];
    const on = scheduleEndedOn(s.title, now);
    return on ? [{ on, t: Date.parse(on) }] : [];
  });
  const first = ended.sort((a, b) => a.t - b.t)[0];
  return first ? `Schedule may be out of date (ended ${first.on})` : null;
}

/** The chip's text: one source's meta, or "3 sources". */
export function chipLabel(sources: NonEmpty<CitedSource>, now = Date.now()) {
  return sources.length === 1 ? sourceMeta(sources[0], now) : plural(sources.length, "source");
}

function join(...parts: (string | false | null)[]) {
  return parts.filter(Boolean).join(" · ");
}
