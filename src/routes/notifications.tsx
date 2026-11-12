import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/notifications")({
  component: () => <Placeholder title="Notifications" />,
});
