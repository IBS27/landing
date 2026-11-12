import { createFileRoute } from "@tanstack/react-router";
import { MemoriesPage } from "@/features/feed/MemoriesPage";

export const Route = createFileRoute("/memories")({
  component: MemoriesPage,
});
