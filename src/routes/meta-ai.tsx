import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/meta-ai")({
  component: () => <Placeholder title="Meta AI" />,
});
