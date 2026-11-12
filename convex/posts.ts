import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mergedStream, stream } from "convex-helpers/server/stream";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { canView, enrichPost, enrichPosts, loadAudience } from "./lib/posts";
import { canPostOnProfile } from "./lib/settings";
import schema from "./schema";
import { media, postAttachment, privacy } from "./validators";

const upload = v.object({
  storageId: v.id("_storage"),
  kind: v.union(v.literal("image"), v.literal("video")),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

/* ---------------- Queries ---------------- */

/** A single post (permalink, dialog). Null when missing or hidden from the viewer. */
export const get = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return null;
    const a = await loadAudience(ctx, ctx.viewer._id);
    if (!(await canView(ctx, post, a))) return null;
    return enrichPost(ctx, post, a);
  },
});

/**
 * A post by an id taken from a URL (`/photo/<id>`, permalinks). Any string is
 * accepted: ids that are malformed or belong to another table resolve to null
 * instead of failing argument validation.
 */
export const getFromUrl = viewerQuery({
  args: { postId: v.string() },
  handler: async (ctx, { postId }) => {
    const id = ctx.db.normalizeId("posts", postId);
    const post = id ? await ctx.db.get(id) : null;
    if (!post) return null;
    const a = await loadAudience(ctx, ctx.viewer._id);
    if (!(await canView(ctx, post, a))) return null;
    return enrichPost(ctx, post, a);
  },
});

/**
 * A profile timeline: the person's own non-group posts plus posts others
 * wrote on their wall, newest first.
 */
export const byTimeline = viewerQuery({
  args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId, paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const s = stream(ctx.db, schema);
    const own = s
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .filterWith(
        async (p) =>
          !p.groupId &&
          !p.eventId &&
          (!p.timelineUserId || p.timelineUserId === userId) &&
          (await canView(ctx, p, a)),
      );
    const onWall = s
      .query("posts")
      .withIndex("by_timeline", (q) => q.eq("timelineUserId", userId))
      .order("desc")
      .filterWith(async (p) => p.authorId !== userId && (await canView(ctx, p, a)));
    const result = await mergedStream([own, onWall], ["createdAt"]).paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/** A group's discussion feed, newest first. Private groups require membership. */
export const byGroup = viewerQuery({
  args: { groupId: v.id("groups"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { groupId, paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const group = await ctx.db.get(groupId);
    if (!group || (group.privacy === "private" && !a.groups.has(groupId)))
      return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/* ---------------- Mutations ---------------- */

export const generateUploadUrl = viewerMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

async function resolveUploads(
  ctx: MutationCtx,
  uploads: {
    storageId: Id<"_storage">;
    kind: "image" | "video";
    width?: number;
    height?: number;
  }[],
) {
  const out: Doc<"posts">["media"] = [];
  for (const u of uploads) {
    const url = await ctx.storage.getUrl(u.storageId);
    if (url) out.push({ url, kind: u.kind, width: u.width, height: u.height });
  }
  return out;
}

export const create = viewerMutation({
  args: {
    text: v.optional(v.string()),
    background: v.optional(v.string()),
    media: v.optional(v.array(media)),
    uploads: v.optional(v.array(upload)),
    attachments: v.optional(v.array(postAttachment)),
    feeling: v.optional(v.string()),
    place: v.optional(v.string()),
    taggedIds: v.optional(v.array(v.id("users"))),
    privacy: v.optional(privacy),
    groupId: v.optional(v.id("groups")),
    timelineUserId: v.optional(v.id("users")),
    sharedPostId: v.optional(v.id("posts")),
  },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const text = args.text?.trim() || undefined;
    const allMedia = [...(args.media ?? []), ...(await resolveUploads(ctx, args.uploads ?? []))];
    const attachments = args.attachments ?? [];
    if (!text && allMedia.length === 0 && attachments.length === 0 && !args.sharedPostId)
      throw new ConvexError("A post needs some content");

    if (args.groupId) {
      const member = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId!).eq("userId", viewerId))
        .unique();
      if (!member) throw new ConvexError("Join the group to post in it");
    }
    const timelineUserId =
      args.timelineUserId && args.timelineUserId !== viewerId ? args.timelineUserId : undefined;
    if (timelineUserId && !(await canPostOnProfile(ctx, timelineUserId, viewerId))) {
      const owner = await ctx.db.get(timelineUserId);
      throw new ConvexError(
        `${owner?.firstName ?? "This person"} has limited who can post on their profile.`,
      );
    }

    const now = Date.now();
    const postId = await ctx.db.insert("posts", {
      authorId: viewerId,
      groupId: args.groupId,
      timelineUserId,
      text,
      // Backgrounds only apply to short, text-only posts (as on Facebook).
      background:
        args.background && allMedia.length === 0 && (text?.length ?? 0) <= 130
          ? args.background
          : undefined,
      media: allMedia,
      attachments,
      sharedPostId: args.sharedPostId,
      feeling: args.feeling,
      place: args.place,
      taggedIds: args.taggedIds?.length ? args.taggedIds : undefined,
      privacy: args.privacy ?? (args.groupId ? "public" : "friends"),
      createdAt: now,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
    });

    const snippet = text ? `: "${text.slice(0, 60)}"` : ".";
    if (args.sharedPostId) {
      const original = await ctx.db.get(args.sharedPostId);
      if (original) {
        await ctx.db.patch(original._id, { shareCount: original.shareCount + 1 });
        await notify(ctx, {
          userId: original.authorId,
          actorId: viewerId,
          kind: "mention",
          text: "shared your post.",
          postId,
        });
      }
    }
    if (timelineUserId)
      await notify(ctx, {
        userId: timelineUserId,
        actorId: viewerId,
        kind: "mention",
        text: `posted on your timeline${snippet}`,
        postId,
      });
    for (const id of args.taggedIds ?? [])
      await notify(ctx, {
        userId: id,
        actorId: viewerId,
        kind: "mention",
        text: "tagged you in a post.",
        postId,
      });
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (group) {
        await ctx.db.patch(group._id, { lastActivityAt: now });
        const admins = await ctx.db
          .query("groupMembers")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();
        for (const m of admins.filter((m) => m.role !== "member"))
          await notify(ctx, {
            userId: m.userId,
            actorId: viewerId,
            kind: "group_post",
            text: `posted in ${group.name}${snippet}`,
            postId,
            groupId: group._id,
          });
      }
    }
    return postId;
  },
});

export const update = viewerMutation({
  args: {
    postId: v.id("posts"),
    text: v.optional(v.string()),
    background: v.optional(v.union(v.string(), v.null())),
    privacy: v.optional(privacy),
    feeling: v.optional(v.union(v.string(), v.null())),
    place: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { postId, text, background, privacy, feeling, place }) => {
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found");
    if (post.authorId !== ctx.viewer._id) throw new ConvexError("Only the author can edit");
    await ctx.db.patch(postId, {
      ...(text !== undefined && { text: text.trim() || undefined }),
      ...(background !== undefined && { background: background ?? undefined }),
      ...(privacy !== undefined && { privacy }),
      ...(feeling !== undefined && { feeling: feeling ?? undefined }),
      ...(place !== undefined && { place: place ?? undefined }),
      editedAt: Date.now(),
    });
  },
});

export const remove = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return;
    const a = await loadAudience(ctx, ctx.viewer._id);
    const allowed =
      post.authorId === a.viewerId ||
      post.timelineUserId === a.viewerId ||
      (post.groupId !== undefined && a.adminGroups.has(post.groupId));
    if (!allowed) throw new ConvexError("You can't delete this post");

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    for (const c of comments) {
      await deleteReactions(ctx, "comment", c._id);
      await ctx.db.delete(c._id);
    }
    await deleteReactions(ctx, "post", postId);
    const subs = await ctx.db
      .query("postSubscriptions")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);
    // Notifications about the post would otherwise link to a deleted page.
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    for (const n of notes) await ctx.db.delete(n._id);
    // Saved rows pointing here are skipped by `saved:list` once the post is gone.
    if (post.sharedPostId) {
      const original = await ctx.db.get(post.sharedPostId);
      if (original)
        await ctx.db.patch(original._id, { shareCount: Math.max(0, original.shareCount - 1) });
    }
    await ctx.db.delete(postId);
  },
});

async function deleteReactions(ctx: MutationCtx, targetType: "post" | "comment", id: string) {
  const rows = await ctx.db
    .query("reactions")
    .withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", id))
    .collect();
  for (const r of rows) await ctx.db.delete(r._id);
}

/** Groups the viewer can post or share into, most recently visited first. */
export const postTargets = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    rows.sort((x, y) => (y.lastVisitedAt ?? y.joinedAt) - (x.lastVisitedAt ?? x.joinedAt));
    const groups = await Promise.all(rows.map((r) => ctx.db.get(r.groupId)));
    return groups
      .filter((g) => g !== null)
      .map((g) => ({ _id: g._id, name: g.name, cover: g.cover, privacy: g.privacy }));
  },
});

/** The viewer's friends (people only) for tagging and sharing pickers. */
export const friendPicker = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const users = await Promise.all(rows.map((r) => ctx.db.get(r.friendId)));
    return users
      .filter((u) => u !== null && (u.kind ?? "person") === "person")
      .map((u) => ({ _id: u!._id, name: u!.name, avatar: u!.avatar }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** "Turn on / off notifications for this post". */
export const setSubscribed = viewerMutation({
  args: { postId: v.id("posts"), on: v.boolean() },
  handler: async (ctx, { postId, on }) => {
    const userId = ctx.viewer._id;
    const row = await ctx.db
      .query("postSubscriptions")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();
    if (!on) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (row) return;
    const post = await ctx.db.get(postId);
    if (!post || !(await canView(ctx, post, await loadAudience(ctx, userId))))
      throw new ConvexError("Post not found");
    await ctx.db.insert("postSubscriptions", { userId, postId, createdAt: Date.now() });
  },
});

/* ---------- Hide post / Snooze ---------- */

const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** The viewer's hidden posts and the authors they've snoozed (still in effect). */
export async function feedHides(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("feedHides")
    .withIndex("by_user_target", (q) => q.eq("userId", userId))
    .collect();
  const now = Date.now();
  return {
    posts: rows.filter((r) => r.kind === "post").map((r) => r.targetId),
    snoozed: rows.filter((r) => r.kind === "snooze" && (r.until ?? 0) > now).map((r) => r.targetId),
  };
}

export const hides = viewerQuery({
  args: {},
  handler: (ctx) => feedHides(ctx, ctx.viewer._id),
});

async function setHide(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "post" | "snooze",
  targetId: string,
  until?: number,
) {
  const row = await ctx.db
    .query("feedHides")
    .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("targetId", targetId))
    .first();
  if (row) await ctx.db.patch(row._id, { kind, until });
  else await ctx.db.insert("feedHides", { userId, kind, targetId, until });
}

/** "Hide post": collapses it to a "Hidden · Undo" card for this viewer. */
export const hide = viewerMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    if (await ctx.db.get(postId)) await setHide(ctx, ctx.viewer._id, "post", postId);
  },
});

/** "Snooze <name> for 30 days": their posts leave the viewer's feeds until then. */
export const snooze = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (userId !== ctx.viewer._id && (await ctx.db.get(userId)))
      await setHide(ctx, ctx.viewer._id, "snooze", userId, Date.now() + SNOOZE_MS);
  },
});

/** Undo a hide or a snooze. */
export const unhide = viewerMutation({
  args: { targetId: v.string() },
  handler: async (ctx, { targetId }) => {
    const rows = await ctx.db
      .query("feedHides")
      .withIndex("by_user_target", (q) => q.eq("userId", ctx.viewer._id).eq("targetId", targetId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
