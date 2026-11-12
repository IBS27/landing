import { createFileRoute } from "@tanstack/react-router";
import { BuySellGroupsPage } from "@/features/marketplace/YouPages";

export const Route = createFileRoute("/marketplace/groups")({
  component: BuySellGroupsPage,
});
