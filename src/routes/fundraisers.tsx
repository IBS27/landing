import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/fundraisers")({
  component: () => <Placeholder title="Fundraisers" />,
});
