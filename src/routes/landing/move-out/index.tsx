import { createFileRoute } from "@tanstack/react-router";
import { MoveOutPlace } from "@/landing/move-out/MoveOutPlace";
import { SellItems } from "@/landing/move-out/SellItems";
import { Sublets } from "@/landing/move-out/Sublets";
import { LandingPage } from "@/landing/shell/LandingPage";

/** `?sublet=place` opens the sublet form filled in from the viewer's place (#141). */
type Search = { sublet?: "place" };

export const Route = createFileRoute("/landing/move-out/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    s.sublet === "place" ? { sublet: "place" } : {},
  component: MoveOut,
});

function MoveOut() {
  const { sublet } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LandingPage title="Move out" description="Sublease your place and sell what you own.">
      <MoveOutPlace />
      <Sublets
        fromPlace={sublet === "place"}
        onClose={() => navigate({ search: {}, replace: true })}
      />
      <SellItems />
    </LandingPage>
  );
}
