import { createFileRoute } from "@tanstack/react-router";
import { UnitPage, type UnitSearch } from "@/landing/move-in/unit/UnitPage";
export const Route = createFileRoute("/landing/place/unit")({
  validateSearch: (s: Record<string, unknown>): UnitSearch => ({
    unit: typeof s.unit === "string" ? s.unit : undefined,
    room: typeof s.room === "string" ? s.room : undefined,
    listing: typeof s.listing === "string" ? s.listing : undefined,
  }),
  component: () => {
    const search = Route.useSearch();
    return <UnitPage {...search} />;
  },
});
