import { createFileRoute } from "@tanstack/react-router";
import { GamingPage } from "@/features/gaming/GamingPage";

export const Route = createFileRoute("/gaming/")({
  component: GamingPage,
});
