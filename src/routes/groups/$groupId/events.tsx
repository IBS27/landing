import { createFileRoute } from "@tanstack/react-router";
import { EventsTab } from "@/features/groups/EventsTab";

export const Route = createFileRoute("/groups/$groupId/events")({
  component: EventsTab,
});
