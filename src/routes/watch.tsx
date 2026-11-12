import { createFileRoute } from "@tanstack/react-router";
import { VideoTheaterPage } from "@/features/posts/VideoTheater";
import { WATCH_TABS, WatchPage, type WatchTab } from "@/features/watch/WatchPage";

/** `v` is Facebook's video theater (`/watch?v=<postId>`); without it, the Video home. */
type Search = { tab?: WatchTab; q?: string; v?: string };

export const Route = createFileRoute("/watch")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: WATCH_TABS.includes(s.tab as WatchTab) ? (s.tab as WatchTab) : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    // Numeric-looking ids arrive parsed; keep whatever was given so it can be rejected.
    v: s.v === undefined || s.v === "" ? undefined : String(s.v),
  }),
  component: WatchRoute,
});

function WatchRoute() {
  const { tab, q, v } = Route.useSearch();
  if (v) return <VideoTheaterPage postId={v} />;
  return <WatchPage tab={tab ?? "home"} q={q} />;
}
