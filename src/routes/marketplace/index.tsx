import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "@/features/marketplace/BrowsePages";

export const Route = createFileRoute("/marketplace/")({
  component: BrowsePage,
});
