import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, Clapperboard, Compass, MonitorPlay, Radio, Tv } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import {
  AppRail,
  AppRailDivider,
  AppRailHeading,
  AppRailItem,
  RailGear,
  RailSearch,
} from "@/features/misc/AppRail";
import { PostDialog, PostSkeleton, type PostView, useViewerPaginated } from "@/features/posts";
import { compactCount, shortAge } from "@/lib/format";
import { Avatar, Button, Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { VideoCard, VideoPlayer } from "./VideoCard";

export type WatchTab = "home" | "live" | "shows" | "explore" | "saved";
export const WATCH_TABS: WatchTab[] = ["home", "live", "shows", "explore", "saved"];

const NAV: { tab: WatchTab | "reels"; label: string; Icon: typeof Tv }[] = [
  { tab: "home", label: "Home", Icon: MonitorPlay },
  { tab: "live", label: "Live", Icon: Radio },
  { tab: "reels", label: "Reels", Icon: Clapperboard },
  { tab: "shows", label: "Shows", Icon: Tv },
  { tab: "explore", label: "Explore", Icon: Compass },
  { tab: "saved", label: "Saved videos", Icon: Bookmark },
];

/** /watch — Facebook's Video destination. */
export function WatchPage({ tab, q }: { tab: WatchTab; q?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(q ?? "");
  const watchlist = useQ(api.media.watchlist, {});
  const setTab = (t: WatchTab) => void navigate({ to: "/watch", search: { tab: t } });

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <AppRail title="Video" label="Video" action={<RailGear label="Video settings" />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/watch", search: { tab: "explore", q: query || undefined } });
          }}
        >
          <RailSearch value={query} onChange={setQuery} placeholder="Search videos" />
        </form>
        {NAV.map(({ tab: t, label, Icon }) =>
          t === "reels" ? (
            <AppRailItem key={t} icon={<Icon size={20} />} label={label} to="/reel" />
          ) : (
            <AppRailItem
              key={t}
              icon={<Icon size={20} />}
              label={label}
              selected={tab === t}
              onClick={() => setTab(t)}
            />
          ),
        )}
        <AppRailDivider />
        <AppRailHeading
          action={
            <button
              type="button"
              onClick={() => setTab("shows")}
              className="rounded-md px-2 py-1 text-[15px] text-link hover:bg-hover"
            >
              Manage
            </button>
          }
        >
          Your Watchlist
        </AppRailHeading>
        {watchlist === undefined
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))
          : watchlist.slice(0, 8).map((p) => (
              <Link
                key={p._id}
                to="/$username"
                params={{ username: p.username }}
                className="flex min-h-[52px] items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
              >
                <Avatar src={p.avatar} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[15px] text-primary leading-5">
                    {p.name}
                  </span>
                  {p.newCount > 0 && (
                    <span className="block truncate text-[13px] text-link leading-4">
                      {p.newCount === 1 ? "1 new video" : `${p.newCount} new videos`}
                    </span>
                  )}
                </span>
                {p.newCount > 0 && <span className="h-3 w-3 shrink-0 rounded-full bg-fb" />}
              </Link>
            ))}
      </AppRail>

      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-[760px]">
          {tab === "home" && <HomeFeed />}
          {tab === "live" && <Live />}
          {tab === "shows" && <Shows />}
          {tab === "explore" && <Explore q={q} />}
          {tab === "saved" && <SavedVideos />}
        </div>
      </main>
    </div>
  );
}

function useInfinite(status: string, loadMore: (n: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || status !== "CanLoadMore") return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && loadMore(5), {
      rootMargin: "1200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore]);
  return ref;
}

function HomeFeed() {
  const { results, status, loadMore } = useViewerPaginated(api.media.videos, {}, 4);
  const sentinel = useInfinite(status, loadMore);
  const posts = results as PostView[];
  if (status === "LoadingFirstPage")
    return (
      <div className="flex flex-col gap-4">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  if (posts.length === 0)
    return (
      <Card className="rounded-xl">
        <EmptyState
          title="No videos to show"
          body="Videos from friends, Pages and groups you follow will appear here."
        />
      </Card>
    );
  return (
    <div className="flex flex-col gap-4">
      {posts.map((p) => (
        <VideoCard key={p._id} post={p} />
      ))}
      <div ref={sentinel} />
      {(status === "LoadingMore" || status === "CanLoadMore") && <PostSkeleton />}
    </div>
  );
}

function Live() {
  return (
    <>
      <h2 className="pt-1 pb-3 font-bold text-[20px] text-primary leading-6">Live</h2>
      <Card className="rounded-xl">
        <EmptyState
          icon={<Radio size={48} strokeWidth={1.5} />}
          title="No live videos right now"
          body="When Pages and people you follow go live, you'll see their broadcasts here."
        />
      </Card>
    </>
  );
}

function Shows() {
  const dir = useQ(api.pages.directory, {});
  const toggle = useM(api.pages.toggleFollow);
  const pages = dir ? [...dir.followed, ...dir.discover.filter((p) => !p.following)] : undefined;
  return (
    <>
      <h2 className="pt-1 pb-3 font-bold text-[20px] text-primary leading-6">Shows</h2>
      <div className="grid grid-cols-2 gap-4 min-[1100px]:grid-cols-3">
        {pages === undefined
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[240px] rounded-xl" />)
          : pages.map((p) => (
              <Card key={p._id} className="overflow-hidden rounded-xl">
                <Link to="/$username" params={{ username: p.username }} className="block">
                  <div className="relative aspect-video bg-btn">
                    {p.cover && <img src={p.cover} alt="" className="h-full w-full object-cover" />}
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-semibold text-[12px] text-white">
                      Show
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 p-3">
                  <Avatar src={p.avatar} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/$username"
                      params={{ username: p.username }}
                      className="block truncate font-semibold text-[15px] text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-[13px] text-secondary">
                      {compactCount(p.followers)} followers
                    </p>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <Button
                    block
                    variant={p.following ? "secondary" : "soft"}
                    onClick={() => void toggle({ pageId: p._id })}
                  >
                    {p.following ? "Following" : "Follow"}
                  </Button>
                </div>
              </Card>
            ))}
      </div>
    </>
  );
}

function Explore({ q }: { q?: string }) {
  const { results, status, loadMore } = useViewerPaginated(api.media.videos, {}, 12);
  const sentinel = useInfinite(status, loadMore);
  const [open, setOpen] = useState<PostView | null>(null);
  const posts = useMemo(() => {
    const all = results as PostView[];
    if (!q) return all;
    const needle = q.toLowerCase();
    return all.filter(
      (p) => p.text?.toLowerCase().includes(needle) || p.author.name.toLowerCase().includes(needle),
    );
  }, [results, q]);
  return (
    <>
      <h2 className="pt-1 pb-3 font-bold text-[20px] text-primary leading-6">
        {q ? `Results for "${q}"` : "Explore"}
      </h2>
      {status === "LoadingFirstPage" ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card className="rounded-xl">
          <EmptyState title="No results" body="Try searching for something else." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {posts.map((p) => (
            <Card key={p._id} className="overflow-hidden rounded-xl">
              <VideoPlayer post={p} />
              <button
                type="button"
                onClick={() => setOpen(p)}
                className="flex w-full items-start gap-2 p-3 text-left hover:bg-hover"
              >
                <Avatar src={p.author.avatar} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold text-[15px] text-primary leading-5">
                    {p.text?.split("\n")[0] || `${p.author.name}'s video`}
                  </span>
                  <span className="block truncate text-[13px] text-secondary">
                    {p.author.name} · {shortAge(p.createdAt)}
                  </span>
                </span>
              </button>
            </Card>
          ))}
        </div>
      )}
      <div ref={sentinel} />
      {open && <PostDialog post={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SavedVideos() {
  const posts = useQ(api.media.savedVideos, {});
  return (
    <>
      <h2 className="pt-1 pb-3 font-bold text-[20px] text-primary leading-6">Saved videos</h2>
      {posts === undefined ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <Card className="rounded-xl">
          <EmptyState
            icon={<Bookmark size={48} strokeWidth={1.5} />}
            title="No saved videos"
            body="Save videos from the ... menu on a post to watch them later."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <VideoCard key={p._id} post={p} />
          ))}
        </div>
      )}
    </>
  );
}
