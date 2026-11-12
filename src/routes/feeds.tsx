import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/feeds")({
  component: () => <Placeholder title="Feeds" />,
});
