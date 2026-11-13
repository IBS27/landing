import { createFileRoute } from "@tanstack/react-router";
import { RoomCard } from "@/landing/move-in/RoomCard";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/place/")({
  component: () => (
    <LandingPage
      title="My Place"
      description="Move in, decorate and run the house with your roommates."
    >
      <div className="flex flex-col gap-4">
        <RoomCard />
        <ComingSoon
          items={[
            "Roommate matching that starts from your network",
            "Marketplace items that match your room's vibe",
            "Everything you get is tracked for resale later",
            "A house Group for bills, chores and groceries",
          ]}
        />
      </div>
    </LandingPage>
  ),
});
