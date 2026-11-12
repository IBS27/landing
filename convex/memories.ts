import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { enrichPosts, loadAudience } from "./lib/posts";
import { getSummaries } from "./lib/users";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function hides(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("memoryHides")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();
}

/** "YYYY-MM-DD" of a timestamp in the viewer's local time. */
function localDay(at: number, tzOffset: number) {
  return new Date(at - tzOffset * 60_000).toISOString().slice(0, 10);
}

/**
 * "On this day": the viewer's posts, and posts friends left on their
 * profile, from this calendar day in earlier years, minus hidden people
 * and dates. `tzOffset` is the client's `Date#getTimezoneOffset()` so "this
 * day" is the viewer's local day, not the server's (UTC).
 */
export const list = viewerQuery({
  args: {
    month: v.number(),
    day: v.number(),
    year: v.number(),
    tzOffset: v.optional(v.number()),
  },
  handler: async (ctx, { month, day, year, tzOffset = 0 }) => {
    const me = ctx.viewer._id;
    const [mine, onMyProfile, hidden] = await Promise.all([
      ctx.db
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", me))
        .collect(),
      ctx.db
        .query("posts")
        .withIndex("by_timeline", (q) => q.eq("timelineUserId", me))
        .collect(),
      hides(ctx, me),
    ]);
    const people = new Set<Id<"users">>();
    const ranges: { start: string; end: string }[] = [];
    for (const h of hidden) {
      if (h.kind === "person") people.add(h.personId);
      else ranges.push(h);
    }
    const byId = new Map<Id<"posts">, Doc<"posts">>();
    for (const p of [...mine, ...onMyProfile]) byId.set(p._id, p);
    const hits = [...byId.values()].filter((p) => {
      const d = new Date(p.createdAt - tzOffset * 60_000);
      if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day || d.getUTCFullYear() >= year)
        return false;
      const involved = [p.authorId, p.timelineUserId, ...(p.taggedIds ?? [])];
      if (involved.some((id) => id && people.has(id))) return false;
      const local = localDay(p.createdAt, tzOffset);
      return !ranges.some((r) => r.start <= local && local <= r.end);
    });
    hits.sort((a, b) => b.createdAt - a.createdAt);
    return enrichPosts(ctx, hits, await loadAudience(ctx, me));
  },
});

/** Hide People and Hide Dates lists for the Memories settings panes. */
export const hidden = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await hides(ctx, ctx.viewer._id);
    const users = await getSummaries(
      ctx,
      rows.flatMap((r) => (r.kind === "person" ? [r.personId] : [])),
    );
    const people = [];
    const dates = [];
    for (const r of rows) {
      if (r.kind === "person") {
        const user = users.get(r.personId);
        if (user) people.push({ _id: r._id, user });
      } else dates.push({ _id: r._id, start: r.start, end: r.end });
    }
    return { people, dates };
  },
});

export const hidePerson = viewerMutation({
  args: { personId: v.id("users") },
  handler: async (ctx, { personId }) => {
    if (personId === ctx.viewer._id) throw new ConvexError("You can't hide yourself");
    const rows = await hides(ctx, ctx.viewer._id);
    if (rows.some((r) => r.kind === "person" && r.personId === personId)) return;
    await ctx.db.insert("memoryHides", {
      userId: ctx.viewer._id,
      kind: "person",
      personId,
      createdAt: Date.now(),
    });
  },
});

export const hideDates = viewerMutation({
  args: { start: v.string(), end: v.string() },
  handler: async (ctx, { start, end }) => {
    if (!DAY.test(start) || !DAY.test(end)) throw new ConvexError("Pick a start and end date");
    const [s, e] = start <= end ? [start, end] : [end, start];
    await ctx.db.insert("memoryHides", {
      userId: ctx.viewer._id,
      kind: "dates",
      start: s,
      end: e,
      createdAt: Date.now(),
    });
  },
});

/** Removes one hidden person or date range. */
export const unhide = viewerMutation({
  args: { hideId: v.id("memoryHides") },
  handler: async (ctx, { hideId }) => {
    const row = await ctx.db.get(hideId);
    if (!row || row.userId !== ctx.viewer._id) return;
    await ctx.db.delete(hideId);
  },
});
