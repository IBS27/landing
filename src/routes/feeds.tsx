import { createFileRoute } from "@tanstack/react-router";
import { type FeedFilter, FeedsPage } from "@/features/feed/FeedsPage";

const FILTERS: FeedFilter[] = ["all", "favorites", "friends", "groups", "pages"];

export const Route = createFileRoute("/feeds")({
  validateSearch: (s: Record<string, unknown>): { filter?: FeedFilter } => ({
    filter: FILTERS.includes(s.filter as FeedFilter) ? (s.filter as FeedFilter) : undefined,
  }),
  component: FeedsRoute,
});

function FeedsRoute() {
  const { filter = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <FeedsPage
      filter={filter}
      onFilter={(f) => void navigate({ search: f === "all" ? {} : { filter: f } })}
    />
  );
}
