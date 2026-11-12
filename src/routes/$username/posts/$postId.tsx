import { createFileRoute } from "@tanstack/react-router";
import { PostPermalink } from "@/features/posts";

export const Route = createFileRoute("/$username/posts/$postId")({
  component: PermalinkRoute,
});

function PermalinkRoute() {
  const { postId } = Route.useParams();
  return <PostPermalink postId={postId} />;
}
