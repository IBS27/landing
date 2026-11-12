import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/gaming/play")({
  component: () => <Placeholder title="Play games" />,
});
