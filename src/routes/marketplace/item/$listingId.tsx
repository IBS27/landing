import { createFileRoute } from "@tanstack/react-router";
import { ItemPage } from "@/features/marketplace/ItemPage";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/marketplace/item/$listingId")({
  beforeLoad: ({ params }) => requireConvexId(params.listingId),
  component: function ItemRoute() {
    const { listingId } = Route.useParams();
    return <ItemPage key={listingId} listingId={listingId} />;
  },
});
