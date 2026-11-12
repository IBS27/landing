import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/friends/requests")({
  component: () => <Placeholder title="Friend requests" />,
});
