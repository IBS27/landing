import { createFileRoute } from "@tanstack/react-router";
import { MpNotificationsPage } from "@/features/marketplace/YouPages";

export const Route = createFileRoute("/marketplace/notifications")({
  component: MpNotificationsPage,
});
