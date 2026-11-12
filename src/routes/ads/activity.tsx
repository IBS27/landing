import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/ads/activity")({
  component: () => <Placeholder title="Recent ad activity" />,
});
