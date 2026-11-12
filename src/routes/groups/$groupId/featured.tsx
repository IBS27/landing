import { createFileRoute } from "@tanstack/react-router";
import { FeaturedTab } from "@/features/groups/FeaturedTab";

export const Route = createFileRoute("/groups/$groupId/featured")({
  component: FeaturedTab,
});
