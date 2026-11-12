import { createFileRoute } from "@tanstack/react-router";
import { StoryArchivePage } from "@/features/feed/StoryArchive";

export const Route = createFileRoute("/stories/archive")({
  component: StoryArchivePage,
});
