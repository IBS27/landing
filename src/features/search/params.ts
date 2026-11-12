/** URL state of the search results page (`/search/$tab?q=…&filters`). */
export type SearchParams = {
  q: string;
  /** Posts: newest first. */
  recent?: boolean;
  /** Posts the viewer reacted to (or wrote). */
  seen?: boolean;
  /** Posts: year posted. */
  date?: number;
  from?: "you" | "friends" | "groups" | "public";
  /** People: friends and friends of friends. */
  fof?: boolean;
  city?: string;
  /** Groups. */
  pub?: boolean;
  mine?: boolean;
  /** Events. */
  online?: boolean;
  when?: "today" | "tomorrow" | "week" | "month";
  /** Marketplace max price. */
  max?: number;
};

export const TAB_KEYS = [
  "top",
  "posts",
  "people",
  "photos",
  "videos",
  "marketplace",
  "pages",
  "places",
  "groups",
  "events",
] as const;
export type SearchTab = (typeof TAB_KEYS)[number];

export function asTab(t: string): SearchTab {
  return (TAB_KEYS as readonly string[]).includes(t) ? (t as SearchTab) : "top";
}

const FROM = ["you", "friends", "groups", "public"] as const;
const WHEN = ["today", "tomorrow", "week", "month"] as const;

const bool = (v: unknown) => (v === true || v === "true" || v === 1 ? true : undefined);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown) =>
  list.includes(v as T) ? (v as T) : undefined;

export function validateSearchParams(s: Record<string, unknown>): SearchParams {
  return {
    q: typeof s.q === "string" ? s.q : "",
    recent: bool(s.recent),
    seen: bool(s.seen),
    date: num(s.date),
    from: oneOf(FROM, s.from),
    fof: bool(s.fof),
    city: typeof s.city === "string" && s.city ? s.city : undefined,
    pub: bool(s.pub),
    mine: bool(s.mine),
    online: bool(s.online),
    when: oneOf(WHEN, s.when),
    max: num(s.max),
  };
}
