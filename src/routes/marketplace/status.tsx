import { createFileRoute } from "@tanstack/react-router";
import { MpStatusPage } from "@/features/marketplace/YouPages";

export const Route = createFileRoute("/marketplace/status")({
  component: MpStatusPage,
});
