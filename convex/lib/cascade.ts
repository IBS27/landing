import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Deleting a post or a comment together with what hangs off it. Shared by
 * `posts.remove`, `comments.remove` and demo-user cleanup (`lib/demoPurge.ts`).
 */

export async function deleteReactionsOn(
  ctx: MutationCtx,
  targetType: "post" | "comment" | "message",
  id: string,
) {
  const rows = await ctx.db
    .query("reactions")
    .withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", id))
    .collect();
  for (const r of rows) await ctx.db.delete(r._id);
}

/**
 * A comment and its whole reply subtree, with their reactions, downvotes and
 * notifications, keeping the post's `commentCount` and the parent's
 * `replyCount` right.
 */
export async function deleteCommentTree(ctx: MutationCtx, c: Doc<"comments">) {
  const doomed: Id<"comments">[] = [c._id];
  for (let i = 0; i < doomed.length; i++) {
    const children = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentId", doomed[i]))
      .collect();
    doomed.push(...children.map((ch) => ch._id));
  }
  for (const id of doomed) {
    await deleteReactionsOn(ctx, "comment", id);
    const downvotes = await ctx.db
      .query("commentDownvotes")
      .withIndex("by_comment_user", (q) => q.eq("commentId", id))
      .collect();
    for (const d of downvotes) await ctx.db.delete(d._id);
    await ctx.db.delete(id);
  }
  // Comment and reply notifications quote the text, so they go with it.
  const gone = new Set<Id<"comments">>(doomed);
  const notes = await ctx.db
    .query("notifications")
    .withIndex("by_post", (q) => q.eq("postId", c.postId))
    .collect();
  for (const n of notes) if (n.commentId && gone.has(n.commentId)) await ctx.db.delete(n._id);
  if (c.parentId) {
    const parent = await ctx.db.get(c.parentId);
    if (parent) await ctx.db.patch(parent._id, { replyCount: Math.max(0, parent.replyCount - 1) });
  }
  const post = await ctx.db.get(c.postId);
  if (post)
    await ctx.db.patch(post._id, { commentCount: Math.max(0, post.commentCount - doomed.length) });
  return doomed.length;
}

/**
 * A post with its comments, reactions, subscriptions, notifications and live
 * video rows (recording parts' files too), and the share count it added to the
 * post it shared. Saved rows pointing here are skipped by `saved:list`.
 */
export async function deletePostCascade(ctx: MutationCtx, post: Doc<"posts">) {
  const postId = post._id;
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const c of comments) {
    await deleteReactionsOn(ctx, "comment", c._id);
    const downvotes = await ctx.db
      .query("commentDownvotes")
      .withIndex("by_comment_user", (q) => q.eq("commentId", c._id))
      .collect();
    for (const d of downvotes) await ctx.db.delete(d._id);
    await ctx.db.delete(c._id);
  }
  await deleteReactionsOn(ctx, "post", postId);
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
  await deleteLiveRows(ctx, postId);
  if (post.sharedPostId) {
    const original = await ctx.db.get(post.sharedPostId);
    if (original)
      await ctx.db.patch(original._id, { shareCount: Math.max(0, original.shareCount - 1) });
  }
  await ctx.db.delete(postId);
}

async function deleteLiveRows(ctx: MutationCtx, postId: Id<"posts">) {
  const viewers = await ctx.db
    .query("liveViewers")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const s of viewers) await ctx.db.delete(s._id);
  for (const toHost of [true, false]) {
    const signals = await ctx.db
      .query("liveSignals")
      .withIndex("by_post_dir", (q) => q.eq("postId", postId).eq("toHost", toHost))
      .collect();
    for (const s of signals) await ctx.db.delete(s._id);
  }
  const reactions = await ctx.db
    .query("liveReactions")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const r of reactions) await ctx.db.delete(r._id);
  const parts = await ctx.db
    .query("liveRecordingParts")
    .withIndex("by_post_take", (q) => q.eq("postId", postId))
    .collect();
  for (const p of parts) {
    await ctx.storage.delete(p.storageId).catch(() => {});
    await ctx.db.delete(p._id);
  }
}
