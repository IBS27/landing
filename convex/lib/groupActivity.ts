import type { Doc } from "../_generated/dataModel";

/**
 * Group activity ("10+ posts a day"). Members outside the seeded world post
 * too: like `externalMemberCount`, their activity is an estimate. On Facebook a
 * busy group of ~25K members sees about ten posts a day, so the base rate is
 * one post a day per 2,500 members, scaled by a stable per-group factor
 * (0.55–1.45×, from the slug) so groups of a similar size don't all read the
 * same. Seeded posts are counted exactly on top.
 */
export function externalPostsPerDay(g: Doc<"groups">) {
  return (g.externalMemberCount / 2500) * activityFactor(g.slug);
}

function activityFactor(slug: string) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return 0.55 + ((h >>> 0) % 1000) / 1110;
}

/** "10+ posts a day", "4 posts a day", "3 posts a week", "8 posts a month", "No recent posts". */
export function activityLabel(perDay: number) {
  if (perDay <= 0) return "No recent posts";
  if (perDay >= 10) return "10+ posts a day";
  if (perDay >= 1) {
    const n = Math.round(perDay);
    return `${n} ${n === 1 ? "post" : "posts"} a day`;
  }
  const week = Math.round(perDay * 7);
  if (week >= 1) return `${week} ${week === 1 ? "post" : "posts"} a week`;
  const m = Math.max(1, Math.round(perDay * 30));
  return `${m} ${m === 1 ? "post" : "posts"} a month`;
}
