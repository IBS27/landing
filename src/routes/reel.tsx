import { createFileRoute } from "@tanstack/react-router";
import { ReelsPage } from "@/features/watch/ReelsPage";

export const Route = createFileRoute("/reel")({
  component: () => <ReelsPage />,
});
