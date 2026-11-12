import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/groups/create")({
  component: () => <Placeholder title="Create group" />,
});
