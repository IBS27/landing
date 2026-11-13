import { createFileRoute } from "@tanstack/react-router";
import { CrewPage } from "@/landing/journeys/CrewPage";

export const Route = createFileRoute("/landing/crew/")({
  component: CrewPage,
});
