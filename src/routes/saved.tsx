import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "@/features/saved/SavedPage";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
});
