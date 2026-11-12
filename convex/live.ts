import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { canView, enrichPost, enrichPosts, loadAudience } from "./lib/posts";
import { friendIds } from "./lib/users";
import { privacy } from "./validators";

/**
 * Live video. The clone has no media server: the host sees their own camera
 * preview, and going live publishes a post flagged `live` ("is live now" with
 * a LIVE badge) that friends see in real time until the host ends it ("was
 * live" / "Live video ended"). The host's page sends a heartbeat (every 15s);
 * if it stops
 * (tab closed, connection lost) a scheduled check ends the broadcast.
 */

/** A broadcast whose host hasn't checked in for this long has ended. */
const STALE_MS = 45_000;

const isLive = (p: Doc<"posts">) => !!p.live && p.live.endedAt === undefined;

async function activeLiveOf(ctx: QueryCtx, userId: Id<"users">) {
  const recent = await ctx.db
    .query("posts")
    .withIndex("by_author", (q) => q.eq("authorId", userId))
    .order("desc")
    .take(20);
  return recent.find(isLive) ?? null;
}

async function endLive(ctx: MutationCtx, post: Doc<"posts">, at: number) {
  if (!post.live || post.live.endedAt !== undefined) return;
  await ctx.db.patch(post._id, { live: { ...post.live, endedAt: at } });
}

/** The viewer's own broadcast in progress (the producer page resumes it after a reload). */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const post = await activeLiveOf(ctx, ctx.viewer._id);
    if (!post) return null;
    return enrichPost(ctx, post, await loadAudience(ctx, ctx.viewer._id));
  },
});

/** Broadcasts in progress the viewer can see, newest first (Video → Live). */
export const active = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const recent = await ctx.db.query("posts").withIndex("by_created").order("desc").take(300);
    const live: Doc<"posts">[] = [];
    for (const p of recent) if (isLive(p) && (await canView(ctx, p, a))) live.push(p);
    return enrichPosts(ctx, live, a);
  },
});

/** "Go live": publish the live post, tell friends, and start watching the heartbeat. */
export const start = viewerMutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    privacy,
  },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const now = Date.now();
    // One broadcast at a time: a stale one from an earlier session ends now.
    const existing = await activeLiveOf(ctx, viewerId);
    if (existing) await endLive(ctx, existing, now);

    const title = args.title?.trim().slice(0, 255) || undefined;
    const postId = await ctx.db.insert("posts", {
      authorId: viewerId,
      text: args.description?.trim() || title,
      media: [],
      attachments: [],
      privacy: args.privacy,
      createdAt: now,
      live: { title, startedAt: now, lastSeenAt: now },
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
    });

    if (args.privacy !== "only_me")
      for (const userId of await friendIds(ctx, viewerId))
        await notify(ctx, {
          userId,
          actorId: viewerId,
          kind: "live",
          text: title ? `is live now: "${title.slice(0, 60)}".` : "is live now.",
          postId,
        });

    await ctx.scheduler.runAfter(STALE_MS, internal.live.checkStale, { postId });
    return postId;
  },
});

/** The host's page is still broadcasting. */
export const heartbeat = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== ctx.viewer._id || !isLive(post) || !post.live) return false;
    await ctx.db.patch(postId, { live: { ...post.live, lastSeenAt: Date.now() } });
    return true;
  },
});

/** "End live video". */
export const end = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== ctx.viewer._id) throw new ConvexError("Live video not found");
    await endLive(ctx, post, Date.now());
  },
});

/** Ends a broadcast whose host stopped sending heartbeats; otherwise checks again later. */
export const checkStale = internalMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post?.live || !isLive(post)) return;
    const now = Date.now();
    if (now - post.live.lastSeenAt > STALE_MS) await endLive(ctx, post, post.live.lastSeenAt);
    else await ctx.scheduler.runAfter(STALE_MS, internal.live.checkStale, { postId });
  },
});
