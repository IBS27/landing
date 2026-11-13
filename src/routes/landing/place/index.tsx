import { createFileRoute } from "@tanstack/react-router";
import { Negotiations } from "@/landing/living/Negotiations";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/place/")({
  component: () => (
    <LandingPage
      title="My Place"
      description="Move in, decorate and run the house with your roommates."
    >
      <Negotiations />
      <ComingSoon
        items={[
          "Roommate matching that starts from your network",
          "Scan your room and find Marketplace items that match your vibe",
          "Everything you get is tracked for resale later",
          "A house Group for bills, chores and groceries",
        ]}
      />
    </LandingPage>
  ),
});
