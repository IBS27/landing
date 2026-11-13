import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { FollowLink, PostCard, PostSkeleton } from "@/features/posts";
import { NoMuteHint } from "@/features/posts/VideoPlayer";
import { usePageTitle } from "@/layout/DocumentTitle";
import { compactCount } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { PostView } from "../../../convex/lib/posts";
import type { SearchParams, SearchTab } from "./params";
import {
  EventRow,
  GroupRow,
  ListingGrid,
  ModuleCard,
  NoResults,
  PageRow,
  PersonRow,
} from "./ResultCards";
import { SearchRail } from "./SearchRail";

const POST_PAGE = 10;

type EntityType = "people" | "pages" | "groups" | "events" | "listings";

const TAB_TYPES: Partial<Record<SearchTab, EntityType[]>> = {
  top: ["people", "pages", "groups", "events", "listings"],
  people: ["people"],
  pages: ["pages"],
  groups: ["groups"],
  events: ["events"],
  marketplace: ["listings"],
};

/** Hold the last result while a new query (next page, new filter) loads. */
function useSticky<T>(value: T | undefined, resetKey: string) {
  const ref = useRef<{ key: string; value: T } | null>(null);
  if (value !== undefined) ref.current = { key: resetKey, value };
  return value ?? (ref.current?.key === resetKey ? ref.current.value : undefined);
}

function usePosts(params: SearchParams, tab: SearchTab) {
  const enabled = (tab === "top" || tab === "reels") && !!params.q.trim();
  const reels = tab === "reels";
  const [limit, setLimit] = useState(reels ? 24 : POST_PAGE);
  const filterKey = JSON.stringify([
    tab,
    params.q,
    params.recent,
    params.seen,
    params.date,
    params.from,
    params.loc,
  ]);
  // Start from the first page again whenever the query or a filter changes.
  const [limitKey, setLimitKey] = useState(filterKey);
  if (limitKey !== filterKey) {
    setLimitKey(filterKey);
    setLimit(reels ? 24 : POST_PAGE);
  }
  const live = useQ(
    api.search.posts,
    enabled
      ? reels
        ? { q: params.q, limit, media: "video", year: params.date }
        : {
            q: params.q,
            limit,
            recent: params.recent,
            seen: params.seen,
            year: params.date,
            from: params.from,
            place: params.loc,
          }
      : "skip",
  );
  const data = useSticky(live, filterKey);
  const more = useCallback(() => setLimit((l) => l + (reels ? 24 : POST_PAGE)), [reels]);
  return {
    enabled,
    posts: data?.posts as PostView[] | undefined,
    hasMore: !!data?.hasMore,
    loadingMore: live === undefined && data !== undefined,
    more,
  };
}

function InfiniteSentinel({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && onVisible(), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [active, onVisible]);
  return <div ref={ref} className="h-px" />;
}

/** A 9:16 reel tile: first frame of the video, play count and caption. */
function ReelTile({ post }: { post: PostView }) {
  const video = post.media.find((m) => m.kind === "video");
  if (!video) return null;
  return (
    <Link
      to="/reel/$reelId"
      params={{ reelId: post._id }}
      className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-black"
    >
      <video
        src={`${video.url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-[filter] group-hover:brightness-90"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="absolute bottom-2 left-2 right-2 flex flex-col gap-1 text-white">
        {post.text && (
          <span className="line-clamp-2 font-semibold text-[13px] leading-4">{post.text}</span>
        )}
        <span className="flex items-center gap-1 font-semibold text-[13px] leading-4">
          <Play size={12} fill="currentColor" strokeWidth={0} />
          {compactCount(post.viewCount ?? 0)}
        </span>
      </span>
    </Link>
  );
}

function ReelsGrid({ posts, title, q }: { posts: PostView[]; title?: string; q?: string }) {
  return (
    <Card className="rounded-xl p-4">
      {title && <h2 className="pb-3 font-bold text-[20px] text-primary leading-6">{title}</h2>}
      <div className="grid grid-cols-3 gap-2">
        {posts.map((p) => (
          <ReelTile key={p._id} post={p} />
        ))}
      </div>
      {q !== undefined && (
        <Link
          to="/search/$tab"
          params={{ tab: "reels" }}
          search={{ q }}
          className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          See all
        </Link>
      )}
    </Card>
  );
}

function RowsCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-xl px-4 py-2">{children}</Card>;
}

type Module = { key: string; node: ReactNode };

const NO_ENTITIES = { people: [], pages: [], groups: [], events: [], listings: [], places: [] };

/**
 * All results, in Facebook's order: People (or the strongest entity module)
 * leads, then posts with the other modules (Reels, Groups, Pages, Events,
 * Marketplace) interleaved every couple of posts.
 */
function TopResults({
  q,
  entities,
  reels,
  posts,
}: {
  q: string;
  entities: NonNullable<ReturnType<typeof useEntities>>;
  reels: PostView[];
  posts: PostView[];
}) {
  const modules: Module[] = [];
  if (entities.people.length > 0)
    modules.push({
      key: "people",
      node: (
        <ModuleCard title="People" seeAll="people" q={q}>
          {entities.people.map((p) => (
            <PersonRow key={p._id} p={p} />
          ))}
        </ModuleCard>
      ),
    });
  if (entities.groups.length > 0)
    modules.push({
      key: "groups",
      node: (
        <ModuleCard title="Groups" seeAll="groups" q={q}>
          {entities.groups.map((g) => (
            <GroupRow key={g._id} g={g} />
          ))}
        </ModuleCard>
      ),
    });
  if (reels.length > 0)
    modules.push({
      key: "reels",
      node: <ReelsGrid title="Reels" posts={reels.slice(0, 3)} q={q} />,
    });
  if (entities.pages.length > 0)
    modules.push({
      key: "pages",
      node: (
        <ModuleCard title="Pages" seeAll="pages" q={q}>
          {entities.pages.map((p) => (
            <PageRow key={p._id} page={p} />
          ))}
        </ModuleCard>
      ),
    });
  if (entities.events.length > 0)
    modules.push({
      key: "events",
      node: (
        <ModuleCard title="Events" seeAll="events" q={q}>
          {entities.events.map((e) => (
            <EventRow key={e._id} e={e} />
          ))}
        </ModuleCard>
      ),
    });
  if (entities.listings.length > 0)
    modules.push({
      key: "marketplace",
      node: (
        <ModuleCard title="Marketplace" seeAll="marketplace" q={q}>
          <ListingGrid items={entities.listings.slice(0, 3)} />
        </ModuleCard>
      ),
    });

  // The lead module, then two posts before each further module; leftovers go last.
  // Only People, Groups or Pages lead; Reels, Events and Marketplace always follow posts.
  const lead = ["people", "groups", "pages"].includes(modules[0]?.key) ? modules[0] : undefined;
  const rest = lead ? modules.slice(1) : modules;
  const out: ReactNode[] = [];
  if (lead) out.push(<Fragment key={lead.key}>{lead.node}</Fragment>);
  posts.forEach((p, i) => {
    out.push(
      <NoMuteHint key={p._id}>
        <PostCard post={p} hideable={false} nameSuffix={<FollowLink post={p} />} />
      </NoMuteHint>,
    );
    const m = i % 2 === 1 ? rest[(i - 1) / 2] : undefined;
    if (m) out.push(<Fragment key={m.key}>{m.node}</Fragment>);
  });
  for (const m of rest.slice(Math.floor(posts.length / 2)))
    out.push(<Fragment key={m.key}>{m.node}</Fragment>);
  return <>{out}</>;
}

function useEntities(tab: SearchTab, params: SearchParams) {
  const q = params.q.trim();
  const types = TAB_TYPES[tab];
  const entityKey = JSON.stringify([
    tab,
    q,
    params.fof,
    params.city,
    params.pub,
    params.mine,
    params.online,
    params.when,
    params.max,
  ]);
  const live = useQ(
    api.search.results,
    types && q
      ? {
          q,
          types,
          limit: tab === "top" ? 3 : 50,
          filters: {
            friendsOfFriends: params.fof,
            city: params.city,
            publicGroups: params.pub,
            myGroups: params.mine,
            onlineEvents: params.online,
            eventDate: params.when,
            maxPrice: params.max,
          },
        }
      : "skip",
  );
  return useSticky(live, entityKey);
}

export function SearchPage({ tab, params }: { tab: SearchTab; params: SearchParams }) {
  const q = params.q.trim();
  const types = TAB_TYPES[tab];
  const entities = useEntities(tab, params);
  const posts = usePosts(params, tab);
  // The All tab's Reels module.
  const topReels = useQ(
    api.search.posts,
    tab === "top" && q ? { q, limit: 3, media: "video" } : "skip",
  );

  usePageTitle(q ? `${q} - Search` : "Search");

  const loading = (types && q && !entities) || (posts.enabled && !posts.posts);
  const entityCount = entities
    ? entities.people.length +
      entities.pages.length +
      entities.groups.length +
      entities.events.length +
      entities.listings.length
    : 0;
  const postCount = posts.posts?.length ?? 0;
  // With a post filter on, All narrows to matching posts (no entity modules), like Facebook.
  const postFiltered =
    tab === "top" && !!(params.recent || params.seen || params.date || params.from || params.loc);
  const empty = !q || (!loading && (postFiltered ? 0 : entityCount) === 0 && postCount === 0);

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col md:flex-row md:items-start">
      <SearchRail tab={tab} params={params} />
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-8 pb-8">
        <div className="flex w-full max-w-[680px] flex-col gap-4">
          {loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : empty ? (
            <NoResults />
          ) : (
            <>
              {entities && tab === "top" && (
                <TopResults
                  q={q}
                  entities={postFiltered ? NO_ENTITIES : entities}
                  reels={postFiltered ? [] : ((topReels?.posts as PostView[] | undefined) ?? [])}
                  posts={posts.posts ?? []}
                />
              )}
              {entities && tab === "people" && (
                <RowsCard>
                  {entities.people.map((p) => (
                    <PersonRow key={p._id} p={p} />
                  ))}
                </RowsCard>
              )}
              {entities && tab === "pages" && (
                <RowsCard>
                  {entities.pages.map((p) => (
                    <PageRow key={p._id} page={p} />
                  ))}
                </RowsCard>
              )}
              {entities && tab === "groups" && (
                <RowsCard>
                  {entities.groups.map((g) => (
                    <GroupRow key={g._id} g={g} />
                  ))}
                </RowsCard>
              )}
              {entities && tab === "events" && (
                <RowsCard>
                  {entities.events.map((e) => (
                    <EventRow key={e._id} e={e} />
                  ))}
                </RowsCard>
              )}
              {entities && tab === "marketplace" && (
                <ModuleCard title="Marketplace" q={q}>
                  <ListingGrid items={entities.listings} />
                </ModuleCard>
              )}
              {tab === "reels" && posts.posts && <ReelsGrid posts={posts.posts} />}
              {posts.enabled && (
                <>
                  <InfiniteSentinel
                    active={posts.hasMore && !posts.loadingMore}
                    onVisible={posts.more}
                  />
                  {posts.loadingMore && <PostSkeleton />}
                  {!posts.hasMore && postCount > 0 && (
                    <p className="py-4 text-center text-[15px] text-secondary">End of results</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
