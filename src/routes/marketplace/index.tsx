import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/")({
  component: () => <Placeholder title="Marketplace" />,
});
