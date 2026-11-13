import { createFileRoute } from "@tanstack/react-router";
import { HouseCard } from "@/landing/living/HouseCard";
import { Negotiations } from "@/landing/living/Negotiations";
import { OwnedItems } from "@/landing/move-in/OwnedItems";
import { RoomCard } from "@/landing/move-in/RoomCard";
import { RoommatesCard } from "@/landing/roommates/RoommatesCard";
import { LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/place/")({
  component: () => (
    <LandingPage
      title="My Place"
      description="Move in, decorate and run the house with your roommates."
    >
      <Negotiations />
      <RoommatesCard />
      <HouseCard />
      <RoomCard />
      <OwnedItems />
    </LandingPage>
  ),
});
