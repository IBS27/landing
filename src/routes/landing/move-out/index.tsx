import { createFileRoute } from "@tanstack/react-router";
import { Sublets } from "@/landing/move-out/Sublets";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/move-out/")({
  component: () => (
    <LandingPage title="Move out" description="Sell what you own and sublease your place.">
      <Sublets />
      <ComingSoon
        items={[
          "Go through your tracked items and pick what to sell",
          "Landing creates the Marketplace listings and negotiates the sales",
        ]}
      />
    </LandingPage>
  ),
});
