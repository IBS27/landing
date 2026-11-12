import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/marketplace/inbox")({
  component: () => <Placeholder title="Marketplace inbox" />,
});
