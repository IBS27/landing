import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "@/features/saved/SavedPage";

export const Route = createFileRoute("/saved")({
  validateSearch: (s: Record<string, unknown>): { list?: string } => ({
    list: typeof s.list === "string" && s.list ? s.list : undefined,
  }),
  component: SavedRoute,
});

function SavedRoute() {
  const { list } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <SavedPage list={list} onList={(l) => void navigate({ search: l ? { list: l } : {} })} />;
}
