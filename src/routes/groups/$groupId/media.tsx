import { createFileRoute } from "@tanstack/react-router";
import { MediaTab } from "@/features/groups/MediaTab";

export const Route = createFileRoute("/groups/$groupId/media")({
  component: MediaTab,
});
