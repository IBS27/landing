import { createFileRoute } from "@tanstack/react-router";
import { PeopleTab } from "@/features/groups/PeopleTab";

export const Route = createFileRoute("/groups/$groupId/members")({
  component: PeopleTab,
});
