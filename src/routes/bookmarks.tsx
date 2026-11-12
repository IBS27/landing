import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/misc/BookmarksPage";

export const Route = createFileRoute("/bookmarks")({
  component: BookmarksPage,
});
