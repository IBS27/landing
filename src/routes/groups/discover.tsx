import { createFileRoute } from "@tanstack/react-router";
import { DiscoverPage } from "@/features/groups/DiscoverPage";

export const Route = createFileRoute("/groups/discover")({
  component: DiscoverPage,
});
