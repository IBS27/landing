import { createFileRoute } from "@tanstack/react-router";
import { NewMessagePage } from "@/features/messenger/MessagesPage";

export const Route = createFileRoute("/messages/new")({
  component: NewMessagePage,
});
