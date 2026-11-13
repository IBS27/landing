import { useState } from "react";
import { useQ } from "@/app/viewer";
import { FindMap } from "@/landing/map/FindMap";
import { NeighborhoodsLink } from "@/landing/neighborhoods/NeighborhoodsLink";
import { ComingSoon } from "@/landing/shell/LandingPage";
import { api } from "../../../convex/_generated/api";
import type { RentalFilters } from "../../../convex/lib/rentalFit";
import { RentalResults } from "./RentalResults";

/**
 * `/landing/find`: apartment search (#10) beside the Find map. The ranked
 * results are the map's Homes pins.
 */
export function FindPage() {
  const [filters, setFilters] = useState<RentalFilters>({});
  const data = useQ(api.rentals.search, { filters });
  const homes = data?.results.flatMap((r) => (r.pin ? [r.pin] : [])) ?? [];
  return (
    <FindMap
      homes={homes}
      aside={
        <>
          <NeighborhoodsLink />
          <RentalResults data={data} filters={filters} onFilters={setFilters} />
          <ComingSoon
            items={[
              "Cited neighborhood scores for things to do, food, transit and fit",
              "Try the neighborhood: compare two places side by side",
            ]}
          />
        </>
      }
    />
  );
}
