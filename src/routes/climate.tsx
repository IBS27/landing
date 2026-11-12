import { createFileRoute } from "@tanstack/react-router";
import { ClimatePage } from "@/features/misc/ClimatePage";

export const Route = createFileRoute("/climate")({
  component: ClimatePage,
});
