import { createFileRoute } from "@tanstack/react-router";
import { CityProfilePage } from "@/landing/profile/CityProfilePage";

export const Route = createFileRoute("/landing/profile/")({
  component: CityProfilePage,
});
