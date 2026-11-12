import { createFileRoute } from "@tanstack/react-router";
import { AllFriendsPage } from "@/features/friends";

export const Route = createFileRoute("/friends/list")({
  validateSearch: (s: Record<string, unknown>): { profile?: string } =>
    typeof s.profile === "string" ? { profile: s.profile } : {},
  component: function Page() {
    const { profile } = Route.useSearch();
    return <AllFriendsPage profile={profile} />;
  },
});
