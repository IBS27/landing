import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/create/item")({
  component: () => <Placeholder title="Item for sale" />,
});
