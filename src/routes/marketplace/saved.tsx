import { createFileRoute } from "@tanstack/react-router";
import { SavedListingsPage } from "@/features/marketplace/YouPages";

export const Route = createFileRoute("/marketplace/saved")({
  component: SavedListingsPage,
});
