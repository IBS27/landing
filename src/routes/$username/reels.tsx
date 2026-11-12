import { createFileRoute } from "@tanstack/react-router";
import { ReelsTab } from "@/features/profile";

export const Route = createFileRoute("/$username/reels")({
  component: ReelsTab,
});
