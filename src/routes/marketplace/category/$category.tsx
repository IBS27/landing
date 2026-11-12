import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/features/marketplace/BrowsePages";
import { parseMpSearch } from "@/features/marketplace/filters";

export const Route = createFileRoute("/marketplace/category/$category")({
  validateSearch: parseMpSearch,
  component: function CategoryRoute() {
    const { category } = Route.useParams();
    const search = Route.useSearch();
    return <CategoryPage key={category} slug={category} search={search} />;
  },
});
