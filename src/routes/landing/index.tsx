import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/landing/shell/HomePage";

export const Route = createFileRoute("/landing/")({
  component: HomePage,
});
