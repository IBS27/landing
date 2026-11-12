import { createFileRoute } from "@tanstack/react-router";
import { SuggestionsPage } from "@/features/friends";

export const Route = createFileRoute("/friends/suggestions")({
  validateSearch: (s: Record<string, unknown>): { profile?: string } =>
    typeof s.profile === "string" ? { profile: s.profile } : {},
  component: function Page() {
    const { profile } = Route.useSearch();
    return <SuggestionsPage profile={profile} />;
  },
});
