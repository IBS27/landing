import { createFileRoute } from "@tanstack/react-router";
import { MEMORY_VIEWS, MemoriesPage, type MemoryView } from "@/features/feed/MemoriesPage";

export const Route = createFileRoute("/memories")({
  validateSearch: (s: Record<string, unknown>): { view?: MemoryView } => ({
    view: MEMORY_VIEWS.includes(s.view as MemoryView) ? (s.view as MemoryView) : undefined,
  }),
  component: MemoriesRoute,
});

function MemoriesRoute() {
  const { view = "home" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MemoriesPage
      view={view}
      onView={(v) => void navigate({ search: v === "home" ? {} : { view: v } })}
    />
  );
}
