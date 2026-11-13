import { createFileRoute } from "@tanstack/react-router";
import { NeighborhoodPage } from "@/landing/neighborhoods/NeighborhoodPage";

export const Route = createFileRoute("/landing/find/neighborhoods/$slug")({
  component: function NeighborhoodRoute() {
    const { slug } = Route.useParams();
    return <NeighborhoodPage key={slug} slug={slug} />;
  },
});
