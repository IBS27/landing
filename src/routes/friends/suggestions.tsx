import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/friends/suggestions")({
  component: () => <Placeholder title="Suggestions" />,
});
