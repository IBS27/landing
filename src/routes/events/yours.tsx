import { createFileRoute } from "@tanstack/react-router";
import type { YoursTab } from "@/features/events/EventsRail";
import { YourEvents } from "@/features/events/YourEvents";

const TABS: YoursTab[] = ["going", "interested", "invitations", "hosting", "past"];

export const Route = createFileRoute("/events/yours")({
  validateSearch: (s: Record<string, unknown>): { tab: YoursTab } => ({
    tab: TABS.includes(s.tab as YoursTab) ? (s.tab as YoursTab) : "going",
  }),
  component: function YoursRoute() {
    const { tab } = Route.useSearch();
    return <YourEvents tab={tab} />;
  },
});
