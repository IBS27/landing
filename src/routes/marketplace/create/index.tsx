import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/create/")({
  component: () => <Placeholder title="Create new listing" />,
});
