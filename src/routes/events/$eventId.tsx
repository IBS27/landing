import { createFileRoute } from "@tanstack/react-router";
import { EventPage } from "@/features/events/EventPage";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/events/$eventId")({
  beforeLoad: ({ params }) => requireConvexId(params.eventId),
  validateSearch: (s: Record<string, unknown>): { tab?: "discussion" } =>
    s.tab === "discussion" ? { tab: "discussion" } : {},
  component: function EventRoute() {
    const { eventId } = Route.useParams();
    const { tab } = Route.useSearch();
    return <EventPage key={eventId} eventId={eventId} tab={tab ?? "about"} />;
  },
});
