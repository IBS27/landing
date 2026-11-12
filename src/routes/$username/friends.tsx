import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/$username/friends")({
  component: () => <Placeholder title="Friends" />,
});
