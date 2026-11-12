import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { type Audience, canView, enrichPosts, loadAudience } from "./lib/posts";
import { userSummary } from "./lib/users";
import schema from "./schema";
import { privacy } from "./validators";

/**
 * Media surfaces: the Video (Watch) feed, Reels, the Home Reels shelf, saved
 * videos and ad activity, plus creating video posts / reels from uploads.
 * Only posts that carry a real video file appear on video surfaces.
 */

const videoOf = (p: Doc<"posts">) => p.media.find((m) => m.kind === "video");

/** A Reel: a single vertical video (flagged `isReel`, or any 9:16-ish upload). */
export function isReelPost(p: Doc<"posts">) {
  if (p.sponsored || p.groupId || p.eventId || p.media.length !== 1) return false;
  const m = p.media[0];
  if (m.kind !== "video") return false;
  return p.isReel === true || (!!m.width && !!m.height && m.height > m.width);
}

/** Video feed: visible non-Reel video posts, newest first. */
export const videos = viewerQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const result = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(
        async (p) =>
          !!videoOf(p) &&
          !p.sponsored &&
          !isReelPost(p) &&
          !p.eventId &&
          (await canView(ctx, p, a)),
      )
      .paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/** Authors the viewer follows: friends plus `follows` rows (people or Pages). */
async function followedSet(ctx: QueryCtx, a: Audience) {
  const rows = await ctx.db
    .query("follows")
    .withIndex("by_user", (q) => q.eq("userId", a.viewerId))
    .collect();
  return new Set<Id<"users">>([...a.friends, ...rows.map((r) => r.targetId)]);
}

/**
 * Reels: vertical video posts, newest first, each with whether the viewer
 * follows its author. When `startId` is given that reel leads the list
 * (direct /reel/<id> links).
 */
export const reels = viewerQuery({
  args: { startId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { startId, limit = 40 }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const picked = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => isReelPost(p) && (await canView(ctx, p, a)))
      .take(limit);
    const start = startId ? ctx.db.normalizeId("posts", startId) : null;
    if (start && !picked.some((p) => p._id === start)) {
      const doc = await ctx.db.get(start);
      if (doc && isReelPost(doc) && (await canView(ctx, doc, a))) picked.unshift(doc);
    } else if (start) {
      const i = picked.findIndex((p) => p._id === start);
      picked.unshift(...picked.splice(i, 1));
    }
    const following = await followedSet(ctx, a);
    const views = await enrichPosts(ctx, picked, a);
    return views.map((p) => ({
      ...p,
      viewerFollowsAuthor: p.author._id === a.viewerId || following.has(p.author._id),
    }));
  },
});

/** The Home "Reels" shelf: the newest Reels with poster, preview and caption. */
export const reelsShelf = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const posts = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => isReelPost(p) && (await canView(ctx, p, a)))
      .take(10);
    return posts.map((p) => {
      const m = p.media[0];
      return {
        _id: p._id,
        video: m.url,
        poster: m.poster ?? null,
        caption: p.text?.trim() || null,
      };
    });
  },
});

/** Follow a person or Page from Reels (Facebook follows are separate from friend requests). */
export const follow = viewerMutation({
  args: { targetId: v.id("users"), follow: v.boolean() },
  handler: async (ctx, { targetId, follow }) => {
    const viewerId = ctx.viewer._id;
    if (targetId === viewerId) throw new ConvexError("You can't follow yourself");
    if (!(await ctx.db.get(targetId))) throw new ConvexError("Profile not found");
    const row = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", targetId))
      .first();
    if (follow && !row)
      await ctx.db.insert("follows", { userId: viewerId, targetId, createdAt: Date.now() });
    if (!follow && row) await ctx.db.delete(row._id);
  },
});

/**
 * Create a video post from an upload (Create reel, or a video from the post
 * composer). Vertical videos become Reels. The poster is a frame the client
 * captured and uploaded alongside.
 */
export const createVideoPost = viewerMutation({
  args: {
    storageId: v.id("_storage"),
    posterStorageId: v.optional(v.id("_storage")),
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    text: v.optional(v.string()),
    privacy: v.optional(privacy),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Upload not found");
    const meta = await ctx.db.system.get(args.storageId);
    if (meta?.contentType && !meta.contentType.startsWith("video/"))
      throw new ConvexError("Choose a video file");
    const poster = args.posterStorageId
      ? ((await ctx.storage.getUrl(args.posterStorageId)) ?? undefined)
      : undefined;
    const tall = args.height > args.width;
    return ctx.db.insert("posts", {
      authorId: ctx.viewer._id,
      text: args.text?.trim() || undefined,
      media: [
        {
          url,
          kind: "video",
          width: args.width,
          height: args.height,
          duration: args.duration,
          poster,
        },
      ],
      attachments: [],
      privacy: args.privacy ?? "public",
      isReel: tall || undefined,
      createdAt: Date.now(),
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
    });
  },
});

/** Saved video posts ("Saved videos"). */
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
      if (p && videoOf(p) && (await canView(ctx, p, a))) posts.push(p);
    }
    return enrichPosts(ctx, posts, a);
  },
});

/** "Your Watchlist": Pages with their newest video post time. */
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
        const withMedia = recent.filter((p) => !!videoOf(p));
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
