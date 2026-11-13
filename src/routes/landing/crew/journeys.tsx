import { createFileRoute } from "@tanstack/react-router";
import { JourneysPage } from "@/landing/journeys/JourneysPage";

export const Route = createFileRoute("/landing/crew/journeys")({
  component: JourneysPage,
});
