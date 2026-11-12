import { createFileRoute } from "@tanstack/react-router";
import { CityBriefPage } from "@/landing/profile/CityBrief";

/** Landing onboarding: the City Profile brief (#3). */
export const Route = createFileRoute("/landing/welcome")({
  component: CityBriefPage,
});
