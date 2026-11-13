import { createFileRoute } from "@tanstack/react-router";
import { RoomCard } from "@/landing/move-in/RoomCard";
import { RoommatesCard } from "@/landing/roommates/RoommatesCard";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/place/")({
  component: () => (
    <LandingPage
      title="My Place"
      description="Move in, decorate and run the house with your roommates."
    >
      <RoommatesCard />
      <RoomCard />
      <ComingSoon
        items={[
          "Roommate candidates from your network, with the habits you share",
          "Marketplace items that match your room's vibe",
          "Everything you get is tracked for resale later",
          "A house Group for bills, chores and groceries",
        ]}
      />
    </LandingPage>
  ),
});
