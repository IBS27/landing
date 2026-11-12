import { createFileRoute } from "@tanstack/react-router";
import { CreateChooserPage } from "@/features/marketplace/CreatePages";

export const Route = createFileRoute("/marketplace/create/")({
  component: CreateChooserPage,
});
