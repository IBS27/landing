import { createFileRoute } from "@tanstack/react-router";
import { ReelsPage } from "@/features/watch/ReelsPage";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/reel_/$reelId")({
  beforeLoad: ({ params }) => requireConvexId(params.reelId),
  component: ReelRoute,
});

function ReelRoute() {
  const { reelId } = Route.useParams();
  return <ReelsPage startId={reelId} />;
}
