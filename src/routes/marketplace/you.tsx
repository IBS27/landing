import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/you")({
  component: () => <Placeholder title="Selling" />,
});
