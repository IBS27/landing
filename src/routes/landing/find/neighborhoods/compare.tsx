import { createFileRoute } from "@tanstack/react-router";
import { ComparePage } from "@/landing/neighborhoods/ComparePage";
import { compareSearch } from "@/landing/neighborhoods/compare";

export const Route = createFileRoute("/landing/find/neighborhoods/compare")({
  validateSearch: compareSearch,
  component: function CompareRoute() {
    const { a, b } = Route.useSearch();
    return <ComparePage a={a} b={b} />;
  },
});
