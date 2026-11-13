import { createFileRoute } from "@tanstack/react-router";
import { RentalsToReview } from "@/landing/search/RentalsToReview";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/find/")({
  component: () => (
    <LandingPage
      title="Find"
      description="Apartments and neighborhoods tuned to your City Profile."
    >
      <RentalsToReview />
      <ComingSoon
        items={[
          "Apartment search tuned to your profile, with verified listings and vouches from your network",
          "Neighborhood pages with cited scores for things to do, food, transit and fit",
          "Try the neighborhood: compare two places side by side",
          "A San Francisco map of the Groups, Events and listings near each place",
        ]}
      />
    </LandingPage>
  ),
});
