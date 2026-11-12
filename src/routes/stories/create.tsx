import { createFileRoute } from "@tanstack/react-router";
import { StoryCreator } from "@/features/feed/StoryCreator";

export const Route = createFileRoute("/stories/create")({
  component: StoryCreator,
});
