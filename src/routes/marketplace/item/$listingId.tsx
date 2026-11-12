import { createFileRoute } from "@tanstack/react-router";
import { ItemPage } from "@/features/marketplace/ItemPage";

export const Route = createFileRoute("/marketplace/item/$listingId")({
  component: function ItemRoute() {
    const { listingId } = Route.useParams();
    return <ItemPage key={listingId} listingId={listingId} />;
  },
});
