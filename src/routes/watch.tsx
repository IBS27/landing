import { createFileRoute } from "@tanstack/react-router";
import { WATCH_TABS, WatchPage, type WatchTab } from "@/features/watch/WatchPage";

type Search = { tab?: WatchTab; q?: string };

export const Route = createFileRoute("/watch")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: WATCH_TABS.includes(s.tab as WatchTab) ? (s.tab as WatchTab) : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: WatchRoute,
});

function WatchRoute() {
  const { tab, q } = Route.useSearch();
  return <WatchPage tab={tab ?? "home"} q={q} />;
}
