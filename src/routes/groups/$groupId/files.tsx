import { createFileRoute } from "@tanstack/react-router";
import { FilesTab } from "@/features/groups/FeaturedTab";

export const Route = createFileRoute("/groups/$groupId/files")({
  component: FilesTab,
});
