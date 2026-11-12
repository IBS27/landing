import { createFileRoute } from "@tanstack/react-router";
import { PAGES_VIEWS, PagesPage, type PagesView } from "@/features/misc/PagesPage";

export const Route = createFileRoute("/pages")({
  validateSearch: (s: Record<string, unknown>): { view?: PagesView } => ({
    view: PAGES_VIEWS.includes(s.view as PagesView) ? (s.view as PagesView) : undefined,
  }),
  component: PagesRoute,
});

function PagesRoute() {
  const { view } = Route.useSearch();
  return <PagesPage view={view ?? "discover"} />;
}
