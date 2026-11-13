import { createFileRoute } from "@tanstack/react-router";
import { SellItems } from "@/landing/move-out/SellItems";
import { Sublets } from "@/landing/move-out/Sublets";
import { LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/move-out/")({
  component: () => (
    <LandingPage title="Move out" description="Sell what you own and sublease your place.">
      <SellItems />
      <Sublets />
    </LandingPage>
  ),
});
