import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

export const Route = createFileRoute("/landing/move-out/")({
  component: () => (
    <LandingPage title="Move out" description="Sell what you own and sublease your place.">
      <ComingSoon
        items={[
          "Go through your tracked items and pick what to sell",
          "Landing creates the Marketplace listings and negotiates the sales",
          "Sublease your place with the same scam protection as apartment search",
        ]}
      />
    </LandingPage>
  ),
});
