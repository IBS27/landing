import { createFileRoute } from "@tanstack/react-router";
import { type FriendsFilter, FriendsTab } from "@/features/profile";

const FILTERS: FriendsFilter[] = ["all", "mutual", "recent", "birthdays", "city", "hometown"];

export const Route = createFileRoute("/$username/friends")({
  validateSearch: (s: Record<string, unknown>): { tab?: FriendsFilter } =>
    FILTERS.includes(s.tab as FriendsFilter) ? { tab: s.tab as FriendsFilter } : {},
  component: function FriendsRoute() {
    const { tab } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <FriendsTab
        filter={tab ?? "all"}
        onFilter={(f) => void navigate({ search: f === "all" ? {} : { tab: f }, replace: true })}
      />
    );
  },
});
