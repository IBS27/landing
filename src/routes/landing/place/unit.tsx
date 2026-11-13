import { createFileRoute } from "@tanstack/react-router";
import { UnitPage, type UnitSearch } from "@/landing/move-in/unit/UnitPage";

const str = (x: unknown) => (typeof x === "string" && x ? x : undefined);
export const Route = createFileRoute("/landing/place/unit")({
  validateSearch: (s: Record<string, unknown>): UnitSearch => ({
    unit: str(s.unit),
    room: str(s.room),
    listing: str(s.listing),
    placeItem: str(s.placeItem),
    placeListing: str(s.placeListing),
  }),
  component: () => {
    const search = Route.useSearch();
    return <UnitPage {...search} />;
  },
});
