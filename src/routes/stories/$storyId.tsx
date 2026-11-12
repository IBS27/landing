import { createFileRoute } from "@tanstack/react-router";
import { StoryViewerPage } from "@/features/feed/StoryViewer";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/stories/$storyId")({
  beforeLoad: ({ params }) => requireConvexId(params.storyId),
  component: StoryRoute,
});

function StoryRoute() {
  const { storyId } = Route.useParams();
  return <StoryViewerPage storyId={storyId} />;
}
