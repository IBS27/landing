import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/create/rental")({
  component: () => <Placeholder title="Property for sale or rent" />,
});
