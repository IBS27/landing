import { createFileRoute } from "@tanstack/react-router";
import { SearchTab } from "@/features/profile";

export const Route = createFileRoute("/$username/search")({
  validateSearch: (s: Record<string, unknown>): { q: string } => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: function ProfileSearchRoute() {
    const { q } = Route.useSearch();
    return <SearchTab q={q} />;
  },
});
