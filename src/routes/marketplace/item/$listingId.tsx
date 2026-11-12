import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/item/$listingId")({
  component: () => <Placeholder title="Listing" />,
});
