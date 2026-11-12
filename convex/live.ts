import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { canView, enrichPost, enrichPosts, loadAudience } from "./lib/posts";
import { friendIds } from "./lib/users";
import { privacy, reactionType } from "./validators";

/**
 * Live video. Going live publishes a post flagged `live` ("is live now" with
 * a LIVE badge) that friends see in real time until the host ends it ("Live
 * video ended"). The host's page sends a heartbeat (every 15s); if it stops
 * (tab closed, connection lost) a scheduled check ends the broadcast.
 *
 * The stream itself is peer-to-peer WebRTC, one-to-many: every open player
 * registers a `liveViewers` session, the host's Live Producer offers its
 * camera and microphone to each session, and offers, answers and ICE
 * candidates travel through `liveSignals`. Viewers ping every 10s; a session
 * that stops pinging is dropped (and its connection closed by the host).
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
  await ctx.scheduler.runAfter(0, internal.live.cleanup, { postId: post._id });
}

/** A viewer session that hasn't pinged for this long has left. */
const VIEWER_STALE_MS = 30_000;

async function deleteSessionSignals(ctx: MutationCtx, sessionId: Id<"liveViewers">) {
  for (const toHost of [true, false]) {
    const rows = await ctx.db
      .query("liveSignals")
      .withIndex("by_session_dir", (q) => q.eq("sessionId", sessionId).eq("toHost", toHost))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
}

async function dropSession(ctx: MutationCtx, sessionId: Id<"liveViewers">) {
  await deleteSessionSignals(ctx, sessionId);
  if (await ctx.db.get(sessionId)) await ctx.db.delete(sessionId);
}

/** The viewer's own session, or null when it has been dropped. */
async function ownSession(ctx: QueryCtx, sessionId: Id<"liveViewers">, userId: Id<"users">) {
  const s = await ctx.db.get(sessionId);
  return s && s.userId === userId ? s : null;
}

/** A live post the viewer may watch, or null. */
async function watchable(ctx: QueryCtx, postId: Id<"posts">, viewerId: Id<"users">) {
  const post = await ctx.db.get(postId);
  if (!post || !isLive(post)) return null;
  return (await canView(ctx, post, await loadAudience(ctx, viewerId))) ? post : null;
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

/** Authors broadcasting right now that the viewer can see (red live rings in Contacts and Stories). */
export const liveAuthorIds = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const recent = await ctx.db.query("posts").withIndex("by_created").order("desc").take(300);
    const ids = new Set<Id<"users">>();
    for (const p of recent) if (isLive(p) && (await canView(ctx, p, a))) ids.add(p.authorId);
    return [...ids];
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
    if (!post) {
      // Deleted while live: drop its viewers, signals and reactions.
      await ctx.scheduler.runAfter(0, internal.live.cleanup, { postId });
      return;
    }
    if (!post.live || !isLive(post)) return;
    const now = Date.now();
    if (now - post.live.lastSeenAt > STALE_MS) await endLive(ctx, post, post.live.lastSeenAt);
    else await ctx.scheduler.runAfter(STALE_MS, internal.live.checkStale, { postId });
  },
});

/** Once a broadcast ends: its viewer sessions, signals and floating reactions go. */
export const cleanup = internalMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const sessions = await ctx.db
      .query("liveViewers")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    for (const s of sessions) await dropSession(ctx, s._id);
    const reactions = await ctx.db
      .query("liveReactions")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);
  },
});

/* ---------------------------------------------------------------- */
/* Viewers                                                          */
/* ---------------------------------------------------------------- */

/** A player opened the broadcast: register a session the host will stream to. */
export const join = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await watchable(ctx, postId, ctx.viewer._id);
    if (!post) return null;
    const now = Date.now();
    const sessionId = await ctx.db.insert("liveViewers", {
      postId,
      userId: ctx.viewer._id,
      connected: false,
      joinedAt: now,
      lastSeenAt: now,
    });
    await ctx.scheduler.runAfter(VIEWER_STALE_MS, internal.live.checkViewer, { sessionId });
    return sessionId;
  },
});

/** The player is still open (every 10s), and whether the stream is reaching it. */
export const ping = viewerMutation({
  args: { sessionId: v.id("liveViewers"), connected: v.optional(v.boolean()) },
  handler: async (ctx, { sessionId, connected }) => {
    const s = await ownSession(ctx, sessionId, ctx.viewer._id);
    if (!s) return false;
    await ctx.db.patch(sessionId, {
      lastSeenAt: Date.now(),
      ...(connected === undefined ? {} : { connected }),
    });
    return true;
  },
});

/** The player closed (or scrolled away for good). */
export const leave = viewerMutation({
  args: { sessionId: v.id("liveViewers") },
  handler: async (ctx, { sessionId }) => {
    if (await ownSession(ctx, sessionId, ctx.viewer._id)) await dropSession(ctx, sessionId);
  },
});

/** Drops a session whose player stopped pinging; otherwise checks again later. */
export const checkViewer = internalMutation({
  args: { sessionId: v.id("liveViewers") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return;
    if (Date.now() - s.lastSeenAt > VIEWER_STALE_MS) await dropSession(ctx, sessionId);
    else await ctx.scheduler.runAfter(VIEWER_STALE_MS, internal.live.checkViewer, { sessionId });
  },
});

/** "N watching": distinct people (other than the host) the stream has reached. */
export const stats = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post?.live) return null;
    if (!(await canView(ctx, post, await loadAudience(ctx, ctx.viewer._id)))) return null;
    const sessions = await ctx.db
      .query("liveViewers")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    const watching = new Set(
      sessions.filter((s) => s.connected && s.userId !== post.authorId).map((s) => s.userId),
    );
    return { viewers: watching.size };
  },
});

/* ---------------------------------------------------------------- */
/* Signaling                                                        */
/* ---------------------------------------------------------------- */

const signalType = v.union(v.literal("offer"), v.literal("answer"), v.literal("ice"));
const MAX_SIGNAL = 64_000;

/** The host's open viewer sessions (the connections the producer keeps). */
export const sessions = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== ctx.viewer._id || !isLive(post)) return [];
    const rows = await ctx.db
      .query("liveViewers")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    return rows.map((s) => ({ _id: s._id, userId: s.userId }));
  },
});

/** Host → one viewer. A new offer starts a fresh connection, so older signals go. */
export const signalViewer = viewerMutation({
  args: { sessionId: v.id("liveViewers"), type: signalType, payload: v.string() },
  handler: async (ctx, { sessionId, type, payload }) => {
    if (payload.length > MAX_SIGNAL) throw new ConvexError("Signal too large");
    const s = await ctx.db.get(sessionId);
    if (!s) return;
    const post = await ctx.db.get(s.postId);
    if (!post || post.authorId !== ctx.viewer._id || !isLive(post)) return;
    if (type === "offer") await deleteSessionSignals(ctx, sessionId);
    await ctx.db.insert("liveSignals", {
      postId: s.postId,
      sessionId,
      toHost: false,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

/** Viewer → host. */
export const signalHost = viewerMutation({
  args: { sessionId: v.id("liveViewers"), type: signalType, payload: v.string() },
  handler: async (ctx, { sessionId, type, payload }) => {
    if (payload.length > MAX_SIGNAL) throw new ConvexError("Signal too large");
    const s = await ownSession(ctx, sessionId, ctx.viewer._id);
    if (!s) return;
    await ctx.db.insert("liveSignals", {
      postId: s.postId,
      sessionId,
      toHost: true,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

/** Answers and ICE candidates from every viewer, oldest first (host only). */
export const hostSignals = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== ctx.viewer._id) return [];
    const rows = await ctx.db
      .query("liveSignals")
      .withIndex("by_post_dir", (q) => q.eq("postId", postId).eq("toHost", true))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      sessionId: r.sessionId,
      type: r.type,
      payload: r.payload,
    }));
  },
});

/** The host's offer and ICE candidates for one session, oldest first. */
export const viewerSignals = viewerQuery({
  args: { sessionId: v.id("liveViewers") },
  handler: async (ctx, { sessionId }) => {
    if (!(await ownSession(ctx, sessionId, ctx.viewer._id))) return null;
    const rows = await ctx.db
      .query("liveSignals")
      .withIndex("by_session_dir", (q) => q.eq("sessionId", sessionId).eq("toHost", false))
      .collect();
    return rows.map((r) => ({ _id: r._id, type: r.type, payload: r.payload }));
  },
});

/* ---------------------------------------------------------------- */
/* Floating reactions                                               */
/* ---------------------------------------------------------------- */

/** Reactions older than this have finished floating and are pruned. */
const REACTION_TTL_MS = 60_000;

/** Tap a reaction during the broadcast; it floats up for everyone watching. */
export const react = viewerMutation({
  args: { postId: v.id("posts"), type: reactionType },
  handler: async (ctx, { postId, type }) => {
    const userId = ctx.viewer._id;
    if (!(await watchable(ctx, postId, userId))) return;
    const now = Date.now();
    const recent = await ctx.db
      .query("liveReactions")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("desc")
      .take(200);
    // A burst of taps from one person is capped (8 per 3 seconds).
    if (recent.filter((r) => r.userId === userId && now - r.createdAt < 3000).length >= 8) return;
    for (const r of recent) if (now - r.createdAt > REACTION_TTL_MS) await ctx.db.delete(r._id);
    await ctx.db.insert("liveReactions", { postId, userId, type, createdAt: now });
  },
});

/** The latest reactions; players float the ones that arrive while they watch. */
export const reactions = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post?.live || !(await canView(ctx, post, await loadAudience(ctx, ctx.viewer._id))))
      return [];
    const rows = await ctx.db
      .query("liveReactions")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("desc")
      .take(30);
    return rows.map((r) => ({ _id: r._id, type: r.type }));
  },
});
