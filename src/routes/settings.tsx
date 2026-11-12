import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/settings")({
  component: () => <Placeholder title="Settings" />,
});
