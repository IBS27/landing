import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/features/marketplace/YouPages";

export const Route = createFileRoute("/marketplace/inbox")({
  validateSearch: (s: Record<string, unknown>): { tab?: "buying" } =>
    s.tab === "buying" ? { tab: "buying" } : {},
  component: function InboxRoute() {
    const { tab } = Route.useSearch();
    return <InboxPage role={tab ?? "selling"} />;
  },
});
