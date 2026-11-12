import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/features/policies/PolicyPage";

export const Route = createFileRoute("/policies/$page")({
  component: function PolicyRoute() {
    const { page } = Route.useParams();
    return <PolicyPage slug={page} />;
  },
});
