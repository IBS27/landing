import { createFileRoute } from "@tanstack/react-router";
import { LifestylePage } from "@/landing/roommates/LifestylePage";

export const Route = createFileRoute("/landing/place/roommates")({
  component: LifestylePage,
});
