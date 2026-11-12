import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/groups/joins")({
  component: () => <Placeholder title="Your groups" />,
});
