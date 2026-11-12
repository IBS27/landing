import { createFileRoute } from "@tanstack/react-router";
import { SellingPage, type SellingTab } from "@/features/marketplace/YouPages";

const TABS: SellingTab[] = ["dashboard", "listings", "announcements", "insights"];

export const Route = createFileRoute("/marketplace/you/selling")({
  validateSearch: (s: Record<string, unknown>): { tab?: SellingTab } =>
    TABS.includes(s.tab as SellingTab) && s.tab !== "listings" ? { tab: s.tab as SellingTab } : {},
  component: function SellingRoute() {
    const { tab } = Route.useSearch();
    return <SellingPage tab={tab ?? "listings"} />;
  },
});
