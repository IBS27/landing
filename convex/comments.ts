import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { canView, loadAudience } from "./lib/posts";
import { getSummaries } from "./lib/users";
import { reactionSummary } from "./reactions";

/** Facebook nests replies at most three levels deep (comment → reply → reply). */
export const MAX_DEPTH = 3;

/**
 * All comments on a post, oldest first, as Facebook's three-level tree:
 * top-level comments with `replies`, each reply with its own `replies`.
 * Deeper legacy rows fold into their depth-3 ancestor's level.
 */
export const list = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return [];
    const a = await loadAudience(ctx, ctx.viewer._id);
    if (!(await canView(ctx, post, a))) return [];
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    const rowById = new Map(rows.map((r) => [r._id, r]));
    // A reply opens with its tagged name: stored on new replies, else the parent's author.
    // When the parent's author answers in their own thread, they're answering the latest
    // earlier sibling by someone else.
    const tagOf = (c: Doc<"comments">): Id<"users"> | null => {
      if (!c.parentId) return null;
      if (c.replyToId !== undefined) return c.replyToId;
      const parent = rowById.get(c.parentId);
      if (!parent) return null;
      if (parent.authorId !== c.authorId) return parent.authorId;
      const earlier = rows.filter(
        (r) => r.parentId === c.parentId && r.createdAt < c.createdAt && r.authorId !== c.authorId,
      );
      return earlier.at(-1)?.authorId ?? null;
    };
    // Comments by people blocked either way are hidden along with their replies.
    const blockedThread = (c: Doc<"comments">): boolean => {
      if (a.blocked.has(c.authorId)) return true;
      const parent = c.parentId ? rowById.get(c.parentId) : undefined;
      return parent ? blockedThread(parent) : false;
    };
    const users = await getSummaries(ctx, [
      ...rows.map((r) => r.authorId),
      ...rows.flatMap((r) => {
        const t = tagOf(r);
        return t ? [t] : [];
      }),
    ]);
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const author = users.get(c.authorId);
        if (!author || blockedThread(c)) return null;
        const reactions = await reactionSummary(ctx, "comment", c._id, ctx.viewer._id);
        const tag = tagOf(c);
        return {
          _id: c._id,
          parentId: c.parentId ?? null,
          text: c.text,
          media: c.media ?? null,
          createdAt: c.createdAt,
          author,
          replyTo: tag ? (users.get(tag) ?? null) : null,
          reactions,
          canEdit: c.authorId === ctx.viewer._id,
          canDelete: c.authorId === ctx.viewer._id || post.authorId === ctx.viewer._id,
        };
      }),
    );
    type C = NonNullable<(typeof enriched)[number]>;
    const all = enriched.filter((c): c is C => c !== null);
    const byId = new Map(all.map((c) => [c._id, c]));
    // Ancestor chain, nearest first (stops at missing rows).
    const chain = (c: C): C[] => {
      const out: C[] = [];
      let cur = c;
      while (cur.parentId && byId.has(cur.parentId)) {
        cur = byId.get(cur.parentId)!;
        out.push(cur);
      }
      return out;
    };
    // Where each comment shows: top level, under a depth-2 reply, or under a top-level comment.
    const level2 = new Map<Id<"comments">, C[]>();
    const level3 = new Map<Id<"comments">, C[]>();
    const top: C[] = [];
    for (const c of all) {
      const up = chain(c);
      if (up.length === 0) top.push(c);
      else if (up.length === 1) level2.set(up[0]._id, [...(level2.get(up[0]._id) ?? []), c]);
      else {
        const anchor = up[up.length - 2];
        level3.set(anchor._id, [...(level3.get(anchor._id) ?? []), c]);
      }
    }
    return top.map((c) => ({
      ...c,
      replies: (level2.get(c._id) ?? []).map((r) => ({
        ...r,
        replies: level3.get(r._id) ?? [],
      })),
    }));
  },
});

export const add = viewerMutation({
  args: {
    postId: v.id("posts"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    /** The name the reply is tagged with; omit (or null) for none. */
    replyToId: v.optional(v.union(v.id("users"), v.null())),
    /** An attached photo, uploaded via `posts:generateUploadUrl`. */
    photo: v.optional(
      v.object({
        storageId: v.id("_storage"),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { postId, text, parentId: replyingTo, replyToId, photo }) => {
    const body = text.trim();
    const photoUrl = photo ? await ctx.storage.getUrl(photo.storageId) : null;
    if (!body && !photoUrl) throw new ConvexError("Write something first");
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found");
    if (await isBlockedEitherWay(ctx, ctx.viewer._id, post.authorId))
      throw new ConvexError("You can't comment on this post.");
    // Replying at the deepest level adds a sibling (tagged with the person answered).
    const answered = replyingTo ? await ctx.db.get(replyingTo) : null;
    if (replyingTo && (!answered || answered.postId !== postId))
      throw new ConvexError("Comment not found");
    let parentId = answered?._id;
    if (answered) {
      let depth = 1;
      for (let c = answered; c.parentId; depth++) {
        const up = await ctx.db.get(c.parentId);
        if (!up) break;
        c = up;
      }
      if (depth >= MAX_DEPTH && answered.parentId) parentId = answered.parentId;
    }
    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      postId,
      authorId: ctx.viewer._id,
      parentId,
      replyToId: parentId ? (replyToId ?? null) : undefined,
      text: body,
      media: photoUrl
        ? { url: photoUrl, kind: "image", width: photo?.width, height: photo?.height }
        : undefined,
      createdAt: now,
      reactionCount: 0,
      replyCount: 0,
    });
    await ctx.db.patch(postId, { commentCount: post.commentCount + 1 });
    const snippet = body.slice(0, 60) || "📷 Photo";
    if (parentId && answered) {
      const parent = parentId === answered._id ? answered : await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parent._id, { replyCount: parent.replyCount + 1 });
        await notify(ctx, {
          userId: answered.authorId,
          actorId: ctx.viewer._id,
          kind: "reply",
          text: `replied to your comment: "${snippet}"`,
          postId,
          commentId,
        });
      }
    }
    await notify(ctx, {
      userId: post.authorId,
      actorId: ctx.viewer._id,
      kind: "comment",
      text: `commented on your post: "${snippet}"`,
      postId,
      commentId,
      groupId: post.groupId,
    });
    return commentId;
  },
});

export const edit = viewerMutation({
  args: { commentId: v.id("comments"), text: v.string() },
  handler: async (ctx, { commentId, text }) => {
    const c = await ctx.db.get(commentId);
    if (!c) throw new ConvexError("Comment not found");
    if (c.authorId !== ctx.viewer._id) throw new ConvexError("Only the author can edit");
    const body = text.trim();
    if (!body) throw new ConvexError("A comment can't be empty");
    await ctx.db.patch(commentId, { text: body });
  },
});

export const remove = viewerMutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    const c = await ctx.db.get(commentId);
    if (!c) return;
    const post = await ctx.db.get(c.postId);
    if (c.authorId !== ctx.viewer._id && post?.authorId !== ctx.viewer._id)
      throw new ConvexError("You can't delete this comment");
    // Remove the comment and its whole reply subtree.
    const doomed: Id<"comments">[] = [commentId];
    for (let i = 0; i < doomed.length; i++) {
      const children = await ctx.db
        .query("comments")
        .withIndex("by_parent", (q) => q.eq("parentId", doomed[i]))
        .collect();
      doomed.push(...children.map((ch) => ch._id));
    }
    for (const id of doomed) {
      const rx = await ctx.db
        .query("reactions")
        .withIndex("by_target", (q) => q.eq("targetType", "comment").eq("targetId", id))
        .collect();
      for (const r of rx) await ctx.db.delete(r._id);
      await ctx.db.delete(id);
    }
    if (c.parentId) {
      const parent = await ctx.db.get(c.parentId);
      if (parent)
        await ctx.db.patch(parent._id, { replyCount: Math.max(0, parent.replyCount - 1) });
    }
    if (post)
      await ctx.db.patch(post._id, {
        commentCount: Math.max(0, post.commentCount - doomed.length),
      });
  },
});
