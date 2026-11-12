import { createFileRoute } from "@tanstack/react-router";
import { FriendRequestsPage } from "@/features/friends";

export const Route = createFileRoute("/friends/requests")({
  validateSearch: (s: Record<string, unknown>): { profile?: string } =>
    typeof s.profile === "string" ? { profile: s.profile } : {},
  component: function Page() {
    const { profile } = Route.useSearch();
    return <FriendRequestsPage profile={profile} />;
  },
});
