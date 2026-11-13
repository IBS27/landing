import { createFileRoute } from "@tanstack/react-router";
import { PostPermalink } from "@/features/posts";
import { isConvexId, requireConvexId } from "@/lib/ids";

/** `?comment_id=` opens the post at that comment (citations link comments here). */
type Search = { comment_id?: string };

export const Route = createFileRoute("/$username/posts/$postId")({
  beforeLoad: ({ params }) => requireConvexId(params.postId),
  // A malformed comment id is dropped, so the link still opens the post.
  validateSearch: (s: Record<string, unknown>): Search => ({
    comment_id:
      typeof s.comment_id === "string" && isConvexId(s.comment_id) ? s.comment_id : undefined,
  }),
  component: PermalinkRoute,
});

function PermalinkRoute() {
  const { postId } = Route.useParams();
  const { comment_id } = Route.useSearch();
  return <PostPermalink postId={postId} commentId={comment_id} />;
}
