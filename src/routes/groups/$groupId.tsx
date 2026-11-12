import { createFileRoute } from "@tanstack/react-router";
import { GroupPage } from "@/features/groups/GroupPage";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupPage,
});
