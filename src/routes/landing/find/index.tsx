import { createFileRoute } from "@tanstack/react-router";
import { FindMap } from "@/landing/map/FindMap";
import { NeighborhoodsLink } from "@/landing/neighborhoods/NeighborhoodsLink";
import { RentalsToReview } from "@/landing/search/RentalsToReview";
import { ComingSoon } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/find/")({
  component: () => (
    <FindMap
      aside={
        <>
          <NeighborhoodsLink />
          <RentalsToReview />
          <ComingSoon
            items={[
              "Apartment search tuned to your profile, with verified listings and vouches from your network",
              "Cited neighborhood scores for things to do, food, transit and fit",
              "Try the neighborhood: compare two places side by side",
            ]}
          />
        </>
      }
    />
  ),
});
