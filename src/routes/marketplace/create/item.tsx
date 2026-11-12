import { createFileRoute } from "@tanstack/react-router";
import { ListingComposer } from "@/features/marketplace/Composer";

export const Route = createFileRoute("/marketplace/create/item")({
  component: () => <ListingComposer kind="item" />,
});
