import type { Id } from "../../../convex/_generated/dataModel";

/** The tree `comments.list` returns: top-level comments, their replies, and replies to those. */
type Tree = readonly {
  _id: Id<"comments">;
  replies: readonly { _id: Id<"comments">; replies: readonly { _id: Id<"comments"> }[] }[];
}[];

/**
 * Where a linked comment (`?comment_id=`) sits in the thread tree: its top-level
 * thread and, when it's a reply to a reply, the depth-2 reply above it. Null
 * when the viewer can't see it (deleted, or in a thread whose author is
 * blocked either way, which `comments.list` leaves out) or it isn't on this
 * post: the permalink then shows as usual.
 */
export type CommentPath = {
  target: Id<"comments">;
  /** The top-level comment whose thread holds the target (the target itself at depth 1). */
  thread: Id<"comments">;
  /** The depth-2 reply holding the target: the target itself at depth 2, absent at depth 1. */
  reply?: Id<"comments">;
};

export function findComment(threads: Tree, id: Id<"comments"> | undefined): CommentPath | null {
  if (!id) return null;
  for (const t of threads) {
    if (t._id === id) return { target: id, thread: t._id };
    for (const r of t.replies) {
      if (r._id === id || r.replies.some((n) => n._id === id)) {
        return { target: id, thread: t._id, reply: r._id };
      }
    }
  }
  return null;
}
