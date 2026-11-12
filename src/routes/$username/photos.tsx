import { createFileRoute } from "@tanstack/react-router";
import { PhotosTab } from "@/features/profile";

export const Route = createFileRoute("/$username/photos")({
  component: PhotosTab,
});
