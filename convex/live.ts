import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
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
 *
 * The host's page also records the broadcast and uploads it in parts while on
 * air; when it ends, the parts are joined into the replay (`liveReplay.ts`)
 * and the post becomes a normal video post ("<name> was live.").
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
    // A recording the host never finished (tab closed) still becomes the replay.
    await ctx.scheduler.runAfter(ORPHAN_MS, internal.live.finalizeOrphans, { postId });
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
    // Access can be lost mid-broadcast (blocked, audience changed): stop serving this player.
    if (!(await watchable(ctx, s.postId, ctx.viewer._id))) {
      await dropSession(ctx, sessionId);
      return false;
    }
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

/* ---------------------------------------------------------------- */
/* Recording and replay                                             */
/* ---------------------------------------------------------------- */

/** Parts per take: 15 minutes of 30-second parts, with room for short flushes. */
const MAX_PARTS = 48;
/** The host may still upload and finish a recording this long after the broadcast ends. */
const FINISH_WINDOW_MS = 10 * 60_000;
/** An unfinished recording is joined (or dropped) this long after the broadcast ends. */
const ORPHAN_MS = 3 * 60_000;

/** The host's broadcast, live or recently ended (for uploading its recording). */
async function hostBroadcast(ctx: QueryCtx, postId: Id<"posts">, userId: Id<"users">) {
  const post = await ctx.db.get(postId);
  if (!post?.live || post.authorId !== userId) return null;
  const endedAt = post.live.endedAt;
  if (endedAt !== undefined && Date.now() - endedAt > FINISH_WINDOW_MS) return null;
  return post;
}

async function takeParts(ctx: QueryCtx, postId: Id<"posts">, take: string) {
  return ctx.db
    .query("liveRecordingParts")
    .withIndex("by_post_take", (q) => q.eq("postId", postId).eq("take", take))
    .collect();
}

async function dropParts(ctx: MutationCtx, parts: Doc<"liveRecordingParts">[], keep?: string) {
  for (const p of parts) {
    if (p.storageId !== keep) await ctx.storage.delete(p.storageId).catch(() => {});
    await ctx.db.delete(p._id);
  }
}

/** Where the host uploads the next recording part (or the replay's poster frame). */
export const recordingUploadUrl = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    if (!(await hostBroadcast(ctx, postId, ctx.viewer._id)))
      throw new ConvexError("Live video not found");
    return ctx.storage.generateUploadUrl();
  },
});

export const addRecordingPart = viewerMutation({
  args: {
    postId: v.id("posts"),
    take: v.string(),
    seq: v.number(),
    storageId: v.id("_storage"),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, { postId, take, seq, storageId, width, height }) => {
    const meta = await ctx.db.system.get(storageId);
    const ok =
      (await hostBroadcast(ctx, postId, ctx.viewer._id)) &&
      take.length <= 64 &&
      Number.isInteger(seq) &&
      seq >= 0 &&
      seq < MAX_PARTS &&
      (!meta?.contentType || meta.contentType.startsWith("video/"));
    const parts = ok ? await takeParts(ctx, postId, take) : [];
    if (!ok || parts.some((p) => p.seq === seq)) {
      await ctx.storage.delete(storageId).catch(() => {});
      throw new ConvexError("Couldn't save this part of your live video");
    }
    await ctx.db.insert("liveRecordingParts", {
      postId,
      take,
      seq,
      storageId,
      width,
      height,
      createdAt: Date.now(),
    });
  },
});

/**
 * The host stopped recording and every part is uploaded: end the broadcast
 * (if it's still on) and join the parts into the replay.
 */
export const finishRecording = viewerMutation({
  args: {
    postId: v.id("posts"),
    take: v.string(),
    parts: v.number(),
    posterStorageId: v.optional(v.id("_storage")),
    width: v.number(),
    height: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const post = await hostBroadcast(ctx, args.postId, ctx.viewer._id);
    if (!post) throw new ConvexError("Live video not found");
    await endLive(ctx, post, Date.now());
    const parts = await takeParts(ctx, args.postId, args.take);
    if (parts.length !== args.parts || parts.some((p, i) => p.seq !== i)) {
      await dropParts(ctx, parts);
      throw new ConvexError("Some of your live video didn't upload");
    }
    const last = parts.at(-1);
    if (last) await ctx.db.patch(last._id, { final: true });
    await ctx.scheduler.runAfter(0, internal.liveReplay.assemble, {
      postId: args.postId,
      take: args.take,
      posterStorageId: args.posterStorageId,
      width: args.width,
      height: args.height,
      duration: args.duration,
    });
  },
});

/** The host's upload failed: its parts go, and the post keeps the "Live video ended" card. */
export const discardRecording = viewerMutation({
  args: { postId: v.id("posts"), take: v.string() },
  handler: async (ctx, { postId, take }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== ctx.viewer._id) return;
    await dropParts(ctx, await takeParts(ctx, postId, take));
  },
});

export const recordingParts = internalQuery({
  args: { postId: v.id("posts"), take: v.string() },
  handler: async (ctx, { postId, take }) =>
    (await takeParts(ctx, postId, take)).map((p) => ({ seq: p.seq, storageId: p.storageId })),
});

/** The joined recording becomes the post's video; its parts go. */
export const attachReplay = internalMutation({
  args: {
    postId: v.id("posts"),
    take: v.string(),
    storageId: v.id("_storage"),
    posterStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const parts = await takeParts(ctx, args.postId, args.take);
    const post = await ctx.db.get(args.postId);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!post?.live || post.media.length > 0 || !url) {
      // Deleted meanwhile, or another take already became the replay.
      await dropParts(ctx, parts);
      if (!parts.some((p) => p.storageId === args.storageId))
        await ctx.storage.delete(args.storageId).catch(() => {});
      if (args.posterStorageId) await ctx.storage.delete(args.posterStorageId).catch(() => {});
      return;
    }
    const poster = args.posterStorageId
      ? ((await ctx.storage.getUrl(args.posterStorageId)) ?? undefined)
      : undefined;
    await ctx.db.patch(args.postId, {
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
    });
    await dropParts(ctx, parts, args.storageId);
  },
});

export const discardTake = internalMutation({
  args: { postId: v.id("posts"), take: v.string() },
  handler: async (ctx, { postId, take }) => {
    await dropParts(ctx, await takeParts(ctx, postId, take));
  },
});

/**
 * After a broadcast ends: a recording the host never finished (the tab
 * closed mid-broadcast) is joined from the parts that arrived, when they run
 * unbroken from the start; anything else is dropped.
 */
export const finalizeOrphans = internalMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const rows = await ctx.db
      .query("liveRecordingParts")
      .withIndex("by_post_take", (q) => q.eq("postId", postId))
      .collect();
    const takes = new Map<string, Doc<"liveRecordingParts">[]>();
    for (const r of rows) takes.set(r.take, [...(takes.get(r.take) ?? []), r]);
    const post = await ctx.db.get(postId);
    let best: Doc<"liveRecordingParts">[] | null = null;
    for (const parts of takes.values()) {
      // A finished take is being joined right now.
      if (parts.some((p) => p.final)) continue;
      const unbroken = parts.every((p, i) => p.seq === i);
      if (post && post.media.length === 0 && unbroken && parts.length > (best?.length ?? 0)) {
        if (best) await dropParts(ctx, best);
        best = parts;
      } else await dropParts(ctx, parts);
    }
    if (best?.[0])
      await ctx.scheduler.runAfter(0, internal.liveReplay.assemble, {
        postId,
        take: best[0].take,
        width: best[0].width,
        height: best[0].height,
      });
  },
});
