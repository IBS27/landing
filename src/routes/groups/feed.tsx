import { createFileRoute } from "@tanstack/react-router";
import { GroupsFeedPage } from "@/features/groups/GroupsFeedPage";

export const Route = createFileRoute("/groups/feed")({
  component: GroupsFeedPage,
});
