import { createFileRoute } from "@tanstack/react-router";
import { PostPermalink } from "@/features/posts";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/$username/posts/$postId")({
  beforeLoad: ({ params }) => requireConvexId(params.postId),
  component: PermalinkRoute,
});

function PermalinkRoute() {
  const { postId } = Route.useParams();
  return <PostPermalink postId={postId} />;
}
