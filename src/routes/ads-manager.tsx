import { createFileRoute } from "@tanstack/react-router";
import { AdsManagerPage } from "@/features/misc/AdsManagerPage";

export const Route = createFileRoute("/ads-manager")({
  component: AdsManagerPage,
});
