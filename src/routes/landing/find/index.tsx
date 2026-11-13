import { createFileRoute } from "@tanstack/react-router";
import { FindMap } from "@/landing/map/FindMap";
import { RentalResults } from "@/landing/search/RentalResults";
import { ComingSoon } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/find/")({
  component: () => (
    <FindMap
      aside={
        <>
          <RentalResults />
          <ComingSoon
            items={[
              "Neighborhood pages with cited scores for things to do, food, transit and fit",
              "Try the neighborhood: compare two places side by side",
            ]}
          />
        </>
      }
    />
  ),
});
