import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/$username/photos")({
  component: () => <Placeholder title="Photos" />,
});
