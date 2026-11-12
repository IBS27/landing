import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/groups/$groupId/media")({
  component: () => <Placeholder title="Media" />,
});
