import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/crew/")({
  component: () => (
    <LandingPage
      title="Crew & Journeys"
      description="Your Move-in Crew and a plan for your first 90 days."
    >
      <ComingSoon
        items={[
          "Move-in Crew: meet people arriving the same month, matched on interests",
          "A new Weekend Route every week, built from real Events and Group plans",
          "Weekly check-ins and levels: Explore, Regular, Local",
          "Turn crew chat into real plans",
        ]}
      />
    </LandingPage>
  ),
});
