import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import type { Id } from "./_generated/dataModel";
import { viewerQuery } from "./lib/functions";
import { canView, enrichPosts, loadAudience } from "./lib/posts";
import { userSummary } from "./lib/users";
import schema from "./schema";

/**
 * Read-only media surfaces: the Video (Watch) feed, Reels, saved videos and
 * the ads the viewer has seen. The seed world has photos rather than video
 * files, so photo posts stand in as video posters and reel sources.
 */

/** Video feed: visible posts with media, newest first. */
export const videos = viewerQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const result = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => p.media.length > 0 && !p.sponsored && (await canView(ctx, p, a)))
      .paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/**
 * Reels: single-photo-or-more posts, newest first. When `startId` is given
 * that post leads the list (direct /reel/<id> links).
 */
export const reels = viewerQuery({
  args: { startId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { startId, limit = 30 }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const picked = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(
        async (p) => p.media.length > 0 && !p.sponsored && !p.groupId && (await canView(ctx, p, a)),
      )
      .take(limit);
    const start = startId ? ctx.db.normalizeId("posts", startId) : null;
    if (start && !picked.some((p) => p._id === start)) {
      const doc = await ctx.db.get(start);
      if (doc && doc.media.length > 0 && (await canView(ctx, doc, a))) picked.unshift(doc);
    } else if (start) {
      const i = picked.findIndex((p) => p._id === start);
      picked.unshift(...picked.splice(i, 1));
    }
    return enrichPosts(ctx, picked, a);
  },
});

/** Saved posts that carry media ("Saved videos"). */
export const savedVideos = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("saved")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    const posts = [];
    for (const r of rows) {
      if (r.kind !== "post") continue;
      const p = await ctx.db.get(r.refId as Id<"posts">);
      if (p && p.media.length > 0 && (await canView(ctx, p, a))) posts.push(p);
    }
    return enrichPosts(ctx, posts, a);
  },
});

/** "Your Watchlist": Pages with their newest media post time. */
export const watchlist = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_persona", (q) => q.eq("isPersona", false))
      .collect();
    const pages = users.filter((u) => u.kind === "page");
    const out = await Promise.all(
      pages.map(async (u) => {
        const recent = await ctx.db
          .query("posts")
          .withIndex("by_author", (q) => q.eq("authorId", u._id))
          .order("desc")
          .take(20);
        const withMedia = recent.filter((p) => p.media.length > 0);
        return {
          ...userSummary(u),
          latestAt: withMedia[0]?.createdAt ?? null,
          newCount: withMedia.filter((p) => Date.now() - p.createdAt < 7 * 86_400_000).length,
        };
      }),
    );
    return out.sort((x, y) => (y.latestAt ?? 0) - (x.latestAt ?? 0));
  },
});

/** Recent ad activity: sponsored posts the viewer would have seen, newest first. */
export const adActivity = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const ads = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => p.sponsored === true && (await canView(ctx, p, a)))
      .take(30);
    return enrichPosts(ctx, ads, a);
  },
});
