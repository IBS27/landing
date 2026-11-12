import { createFileRoute } from "@tanstack/react-router";
import { StoryViewerPage } from "@/features/feed/StoryViewer";

export const Route = createFileRoute("/stories/$storyId")({
  component: StoryRoute,
});

function StoryRoute() {
  const { storyId } = Route.useParams();
  return <StoryViewerPage storyId={storyId} />;
}
