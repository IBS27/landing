import { useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostFeed";

/**
 * `/<username>/posts/<id>`: the post expanded with its comments, centered.
 * `commentId` (`?comment_id=`) opens the comments at that comment, highlighted.
 */
export function PostPermalink({ postId, commentId }: { postId: string; commentId?: string }) {
  const post = useQ(api.posts.get, { postId: postId as Id<"posts"> });
  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-4">
      {post === undefined ? (
        <PostSkeleton />
      ) : post === null ? (
        <Unavailable />
      ) : (
        <PostCard post={post} expanded focusCommentId={commentId as Id<"comments"> | undefined} />
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <h1 className="font-bold text-lg text-secondary">This content isn't available right now</h1>
      <p className="mt-2 max-w-md text-secondary">
        When this happens, it's usually because the owner only shared it with a small group of
        people, changed who can see it or it's been deleted.
      </p>
      <a href="/" className="mt-6 rounded-md bg-btn-primary px-12 py-2 font-semibold text-white">
        Go to Feed
      </a>
    </div>
  );
}
