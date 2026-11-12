import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/features/feed/HomePage";

export const Route = createFileRoute("/")({
  component: HomePage,
});
