import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { canView, loadAudience } from "./lib/posts";
import { getSummaries } from "./lib/users";
import { reactionSummary } from "./reactions";

/**
 * All comments on a post, oldest first, with replies nested one level
 * (Facebook flattens deeper replies into the same thread).
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
    const users = await getSummaries(
      ctx,
      rows.map((r) => r.authorId),
    );
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const author = users.get(c.authorId);
        if (!author) return null;
        const reactions = await reactionSummary(ctx, "comment", c._id, ctx.viewer._id);
        const parent = c.parentId ? rows.find((r) => r._id === c.parentId) : undefined;
        // A reply to a reply mentions the person being answered, like Facebook.
        const replyTo =
          parent?.parentId !== undefined ? (users.get(parent.authorId) ?? null) : null;
        return {
          _id: c._id,
          parentId: c.parentId ?? null,
          text: c.text,
          media: c.media ?? null,
          createdAt: c.createdAt,
          author,
          replyTo,
          reactions,
          canEdit: c.authorId === ctx.viewer._id,
          canDelete: c.authorId === ctx.viewer._id || post.authorId === ctx.viewer._id,
        };
      }),
    );
    type C = NonNullable<(typeof enriched)[number]>;
    const all = enriched.filter((c): c is C => c !== null);
    const byId = new Map(all.map((c) => [c._id, c]));
    // Thread root of each comment (replies of replies attach to the top-level comment).
    const rootOf = (c: C): Id<"comments"> => {
      let cur = c;
      while (cur.parentId && byId.has(cur.parentId)) cur = byId.get(cur.parentId)!;
      return cur._id;
    };
    const top = all.filter((c) => !c.parentId);
    return top.map((c) => ({
      ...c,
      replies: all.filter((r) => r.parentId && rootOf(r) === c._id),
    }));
  },
});

export const add = viewerMutation({
  args: {
    postId: v.id("posts"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    /** An attached photo, uploaded via `posts:generateUploadUrl`. */
    photo: v.optional(
      v.object({
        storageId: v.id("_storage"),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { postId, text, parentId, photo }) => {
    const body = text.trim();
    const photoUrl = photo ? await ctx.storage.getUrl(photo.storageId) : null;
    if (!body && !photoUrl) throw new ConvexError("Write something first");
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found");
    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      postId,
      authorId: ctx.viewer._id,
      parentId,
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
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, { replyCount: parent.replyCount + 1 });
        await notify(ctx, {
          userId: parent.authorId,
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
