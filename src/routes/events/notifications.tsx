import { createFileRoute } from "@tanstack/react-router";
import { EventNotifications } from "@/features/events/EventNotifications";

export const Route = createFileRoute("/events/notifications")({
  component: EventNotifications,
});
