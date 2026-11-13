import { createFileRoute } from "@tanstack/react-router";
import { FindMap } from "@/landing/map/FindMap";
import { RentalsToReview } from "@/landing/search/RentalsToReview";
import { ComingSoon } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/find/")({
  component: () => (
    <FindMap
      aside={
        <>
          <RentalsToReview />
          <ComingSoon
            items={[
              "Apartment search tuned to your profile, with verified listings and vouches from your network",
              "Neighborhood pages with cited scores for things to do, food, transit and fit",
              "Try the neighborhood: compare two places side by side",
            ]}
          />
        </>
      }
    />
  ),
});
