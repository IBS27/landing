import { createFileRoute } from "@tanstack/react-router";
import { EventSearch } from "@/features/events/EventSearch";

export const Route = createFileRoute("/events/search")({
  validateSearch: (s: Record<string, unknown>): { q: string; category?: string } => ({
    q: typeof s.q === "string" ? s.q : "",
    ...(typeof s.category === "string" && s.category ? { category: s.category } : {}),
  }),
  component: function SearchRoute() {
    const { q, category } = Route.useSearch();
    return <EventSearch key={`${q}|${category ?? ""}`} q={q} category={category} />;
  },
});
