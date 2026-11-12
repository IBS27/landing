import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/$username/about")({
  component: () => <Placeholder title="About" />,
});
