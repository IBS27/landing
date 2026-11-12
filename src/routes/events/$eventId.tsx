import { createFileRoute } from "@tanstack/react-router";
import { EventPage } from "@/features/events/EventPage";

export const Route = createFileRoute("/events/$eventId")({
  validateSearch: (s: Record<string, unknown>): { tab?: "discussion" } =>
    s.tab === "discussion" ? { tab: "discussion" } : {},
  component: function EventRoute() {
    const { eventId } = Route.useParams();
    const { tab } = Route.useSearch();
    return <EventPage key={eventId} eventId={eventId} tab={tab ?? "about"} />;
  },
});
