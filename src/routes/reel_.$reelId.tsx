import { createFileRoute } from "@tanstack/react-router";
import { ReelsPage } from "@/features/watch/ReelsPage";

export const Route = createFileRoute("/reel_/$reelId")({
  component: ReelRoute,
});

function ReelRoute() {
  const { reelId } = Route.useParams();
  return <ReelsPage startId={reelId} />;
}
