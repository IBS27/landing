import { createFileRoute } from "@tanstack/react-router";
import { FindMap } from "@/landing/map/FindMap";
import { NeighborhoodsLink } from "@/landing/neighborhoods/NeighborhoodsLink";
import { RentalResults } from "@/landing/search/RentalResults";
import { ComingSoon } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/find/")({
  component: () => (
    <FindMap
      aside={
        <>
          <NeighborhoodsLink />
          <RentalResults />
          <ComingSoon
            items={[
              "Cited neighborhood scores for things to do, food, transit and fit",
              "Try the neighborhood: compare two places side by side",
            ]}
          />
        </>
      }
    />
  ),
});
