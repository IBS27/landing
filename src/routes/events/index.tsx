import { createFileRoute } from "@tanstack/react-router";
import { EventsHome } from "@/features/events/EventsHome";

export const Route = createFileRoute("/events/")({
  component: EventsHome,
});
