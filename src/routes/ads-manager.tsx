import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/ads-manager")({
  component: () => <Placeholder title="Ads Manager" />,
});
