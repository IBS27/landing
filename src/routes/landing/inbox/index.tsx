import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/landing/inbox/InboxPage";

export const Route = createFileRoute("/landing/inbox/")({
  component: InboxPage,
});
