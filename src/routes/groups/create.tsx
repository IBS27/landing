import { createFileRoute } from "@tanstack/react-router";
import { CreateGroupPage } from "@/features/groups/CreateGroupPage";

export const Route = createFileRoute("/groups/create")({
  component: CreateGroupPage,
});
