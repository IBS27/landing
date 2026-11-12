import { createFileRoute } from "@tanstack/react-router";
import { PostsTab } from "@/features/profile";

export const Route = createFileRoute("/$username/")({
  component: PostsTab,
});
