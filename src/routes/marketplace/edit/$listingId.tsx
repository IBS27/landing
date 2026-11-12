import { createFileRoute } from "@tanstack/react-router";
import { EditListingPage } from "@/features/marketplace/CreatePages";
import { requireConvexId } from "@/lib/ids";

export const Route = createFileRoute("/marketplace/edit/$listingId")({
  beforeLoad: ({ params }) => requireConvexId(params.listingId),
  component: function EditRoute() {
    const { listingId } = Route.useParams();
    return <EditListingPage key={listingId} listingId={listingId} />;
  },
});
