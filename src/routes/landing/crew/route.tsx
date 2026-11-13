import { createFileRoute } from "@tanstack/react-router";
import { CrewTabs } from "@/landing/journeys/CrewTabs";

export const Route = createFileRoute("/landing/crew")({
  component: CrewTabs,
});
