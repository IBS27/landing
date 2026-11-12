import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/stories/create")({
  component: () => <Placeholder title="Create story" />,
});
