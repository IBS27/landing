import { createFileRoute } from "@tanstack/react-router";
import { AboutTab } from "@/features/groups/AboutTab";

export const Route = createFileRoute("/groups/$groupId/about")({
  component: AboutTab,
});
