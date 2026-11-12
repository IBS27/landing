import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/saved")({
  component: () => <Placeholder title="Saved" />,
});
