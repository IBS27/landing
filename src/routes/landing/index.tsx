import { createFileRoute } from "@tanstack/react-router";
import { LandingHome } from "@/landing/home/LandingHome";

export const Route = createFileRoute("/landing/")({
  component: LandingHome,
});
