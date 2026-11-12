import { createFileRoute } from "@tanstack/react-router";
import { BuyingPage, type BuyingTab } from "@/features/marketplace/YouPages";

const TABS: BuyingTab[] = ["activity", "orders", "offers", "alerts", "following"];

export const Route = createFileRoute("/marketplace/you/")({
  validateSearch: (s: Record<string, unknown>): { tab?: BuyingTab } =>
    TABS.includes(s.tab as BuyingTab) && s.tab !== "activity" ? { tab: s.tab as BuyingTab } : {},
  component: function BuyingRoute() {
    const { tab } = Route.useSearch();
    return <BuyingPage tab={tab ?? "activity"} />;
  },
});
