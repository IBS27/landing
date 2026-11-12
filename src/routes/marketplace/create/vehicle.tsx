import { createFileRoute } from "@tanstack/react-router";
import { ListingComposer } from "@/features/marketplace/Composer";

export const Route = createFileRoute("/marketplace/create/vehicle")({
  component: () => <ListingComposer kind="vehicle" />,
});
