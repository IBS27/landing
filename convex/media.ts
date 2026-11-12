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

/** A post the Video feed shows: a non-sponsored, non-Reel, non-event video post. */
function isFeedVideo(p: Doc<"posts">) {
  return !!videoOf(p) && !p.sponsored && !isReelPost(p) && !p.eventId;
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
      .filterWith(async (p) => isFeedVideo(p) && (await canView(ctx, p, a)))
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

/** Reels the viewer hid or reported from the Reels shelf. */
async function hiddenSet(ctx: QueryCtx, viewerId: Id<"users">) {
  const rows = await ctx.db
    .query("hiddenPosts")
    .withIndex("by_user_post", (q) => q.eq("userId", viewerId))
    .collect();
  return new Set<Id<"posts">>(rows.map((r) => r.postId));
}

/**
 * Reels: vertical video posts, newest first, each with whether the viewer
 * follows its author. When `startId` is given that reel leads the list
 * (direct /reel/<id> links), or the result is null when it isn't a reel the
 * viewer can see. Reels the viewer hid are left out, except one opened by its
 * direct link.
 */
export const reels = viewerQuery({
  args: { startId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { startId, limit = 40 }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const hidden = await hiddenSet(ctx, a.viewerId);
    const picked = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => isReelPost(p) && !hidden.has(p._id) && (await canView(ctx, p, a)))
      .take(limit);
    if (startId !== undefined) {
      // A direct link must name a visible reel; anything else is unavailable.
      const start = ctx.db.normalizeId("posts", startId);
      const i = start ? picked.findIndex((p) => p._id === start) : -1;
      if (i >= 0) picked.unshift(...picked.splice(i, 1));
      else {
        const doc = start ? await ctx.db.get(start) : null;
        if (!doc || !isReelPost(doc) || !(await canView(ctx, doc, a))) return null;
        picked.unshift(doc);
      }
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
    const hidden = await hiddenSet(ctx, a.viewerId);
    const posts = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => isReelPost(p) && !hidden.has(p._id) && (await canView(ctx, p, a)))
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

/**
 * Hide a reel (shelf "Hide reel") or report it ("Report"; reported reels are
 * hidden too). `hidden: false` undoes a hide.
 */
export const hideReel = viewerMutation({
  args: {
    postId: v.id("posts"),
    hidden: v.boolean(),
    reason: v.optional(v.union(v.literal("hidden"), v.literal("reported"))),
  },
  handler: async (ctx, { postId, hidden, reason = "hidden" }) => {
    const viewerId = ctx.viewer._id;
    const post = await ctx.db.get(postId);
    if (!post || !isReelPost(post)) throw new ConvexError("Reel not found");
    const row = await ctx.db
      .query("hiddenPosts")
      .withIndex("by_user_post", (q) => q.eq("userId", viewerId).eq("postId", postId))
      .first();
    if (!hidden) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (row) {
      if (reason === "reported" && row.reason !== "reported")
        await ctx.db.patch(row._id, { reason });
    } else
      await ctx.db.insert("hiddenPosts", {
        userId: viewerId,
        postId,
        reason,
        createdAt: Date.now(),
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

const WEEK = 7 * 86_400_000;

/**
 * "Your Watchlist": the Pages and people the viewer follows, newest video
 * first, each with how many of its videos from the last 7 days the viewer
 * hasn't watched yet ("N new videos"). Only videos the Video feed shows
 * count (Reels live in Reels), so watching them there clears the count.
 * Followed people only appear once
 * they've posted a video; followed Pages always do.
 */
export const watchlist = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const a = await loadAudience(ctx, viewerId);
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect();
    const now = Date.now();
    const rows = await Promise.all(
      follows.map(async ({ targetId }) => {
        const u = await ctx.db.get(targetId);
        if (!u) return null;
        const recent = await ctx.db
          .query("posts")
          .withIndex("by_author", (q) => q.eq("authorId", u._id))
          .order("desc")
          .take(30);
        const videos = [];
        for (const p of recent) if (isFeedVideo(p) && (await canView(ctx, p, a))) videos.push(p);
        if (videos.length === 0 && u.kind !== "page") return null;
        let newCount = 0;
        for (const p of videos) {
          if (now - p.createdAt >= WEEK) break;
          const seen = await ctx.db
            .query("videoViews")
            .withIndex("by_user_post", (q) => q.eq("userId", viewerId).eq("postId", p._id))
            .first();
          if (!seen) newCount++;
        }
        return { ...userSummary(u), latestAt: videos[0]?.createdAt ?? null, newCount };
      }),
    );
    return rows.filter((r) => r !== null).sort((x, y) => (y.latestAt ?? 0) - (x.latestAt ?? 0));
  },
});

/** Count a video as watched (it played for ≥3s). Clears it from the Watchlist's "new". */
export const recordView = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const userId = ctx.viewer._id;
    const post = await ctx.db.get(postId);
    if (!post || !videoOf(post)) return;
    const row = await ctx.db
      .query("videoViews")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();
    if (!row) await ctx.db.insert("videoViews", { userId, postId, viewedAt: Date.now() });
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
