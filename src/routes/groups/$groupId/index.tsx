import { createFileRoute } from "@tanstack/react-router";
import { DiscussionTab } from "@/features/groups/DiscussionTab";

export const Route = createFileRoute("/groups/$groupId/")({
  component: DiscussionTab,
});
