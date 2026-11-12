import { createFileRoute } from "@tanstack/react-router";
import { asTab, validateSearchParams } from "@/features/search/params";
import { SearchPage } from "@/features/search/SearchPage";

export const Route = createFileRoute("/search/$tab")({
  validateSearch: validateSearchParams,
  component: SearchRoute,
});

function SearchRoute() {
  const { tab } = Route.useParams();
  const params = Route.useSearch();
  return <SearchPage tab={asTab(tab)} params={params} />;
}
