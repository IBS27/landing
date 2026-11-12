import { createFileRoute } from "@tanstack/react-router";
import { AdActivityPage } from "@/features/misc/AdActivityPage";

export const Route = createFileRoute("/ads/activity")({
  component: AdActivityPage,
});
