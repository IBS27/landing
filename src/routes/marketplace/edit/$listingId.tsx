import { createFileRoute } from "@tanstack/react-router";
import { EditListingPage } from "@/features/marketplace/CreatePages";

export const Route = createFileRoute("/marketplace/edit/$listingId")({
  component: function EditRoute() {
    const { listingId } = Route.useParams();
    return <EditListingPage key={listingId} listingId={listingId} />;
  },
});
