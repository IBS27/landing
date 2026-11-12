import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/features/marketplace/BrowsePages";
import { parseMpSearch } from "@/features/marketplace/filters";

export const Route = createFileRoute("/marketplace/search")({
  validateSearch: parseMpSearch,
  component: function SearchRoute() {
    return <SearchPage search={Route.useSearch()} />;
  },
});
