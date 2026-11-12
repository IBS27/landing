import { createFileRoute } from "@tanstack/react-router";
import { JoinsPage } from "@/features/groups/JoinsPage";

export const Route = createFileRoute("/groups/joins")({
  component: JoinsPage,
});
