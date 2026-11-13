import { createFileRoute } from "@tanstack/react-router";
import { ListingTrustPage } from "@/landing/search/ListingTrustPage";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/landing/find/listing/$listingId")({
  component: function ListingRoute() {
    const { listingId } = Route.useParams();
    return <ListingTrustPage key={listingId} listingId={listingId as Id<"listings">} />;
  },
});
