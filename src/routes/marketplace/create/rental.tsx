import { createFileRoute } from "@tanstack/react-router";
import { ListingComposer } from "@/features/marketplace/Composer";

export const Route = createFileRoute("/marketplace/create/rental")({
  component: () => <ListingComposer kind="property" />,
});
