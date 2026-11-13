import { createFileRoute } from "@tanstack/react-router";
import { Negotiations } from "@/landing/living/Negotiations";
import { OwnedItems } from "@/landing/move-in/OwnedItems";
import { RoomCard } from "@/landing/move-in/RoomCard";
import { RoommatesCard } from "@/landing/roommates/RoommatesCard";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/place/")({
  component: () => (
    <LandingPage
      title="My Place"
      description="Move in, decorate and run the house with your roommates."
    >
      <Negotiations />
      <RoommatesCard />
      <RoomCard />
      <OwnedItems />
      <ComingSoon
        items={[
          "Marketplace items that match your room's vibe",
          "A house Group for bills, chores and groceries",
        ]}
      />
    </LandingPage>
  ),
});
