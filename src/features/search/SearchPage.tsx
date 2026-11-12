import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { PostCard, PostSkeleton } from "@/features/posts";
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
  PlaceRow,
} from "./ResultCards";
import { SearchRail } from "./SearchRail";

const POST_PAGE = 10;

type EntityType = "people" | "pages" | "groups" | "events" | "listings" | "places";

const TAB_TYPES: Partial<Record<SearchTab, EntityType[]>> = {
  top: ["people", "pages", "groups", "events", "listings"],
  people: ["people"],
  pages: ["pages"],
  groups: ["groups"],
  events: ["events"],
  marketplace: ["listings"],
  places: ["places"],
};

/** Hold the last result while a new query (next page, new filter) loads. */
function useSticky<T>(value: T | undefined, resetKey: string) {
  const ref = useRef<{ key: string; value: T } | null>(null);
  if (value !== undefined) ref.current = { key: resetKey, value };
  return value ?? (ref.current?.key === resetKey ? ref.current.value : undefined);
}

function usePosts(params: SearchParams, tab: SearchTab) {
  const enabled = ["top", "posts", "photos", "videos"].includes(tab) && !!params.q.trim();
  const [limit, setLimit] = useState(POST_PAGE);
  const filterKey = JSON.stringify([
    tab,
    params.q,
    params.recent,
    params.seen,
    params.date,
    params.from,
  ]);
  // Start from the first page again whenever the query or a filter changes.
  const [limitKey, setLimitKey] = useState(filterKey);
  if (limitKey !== filterKey) {
    setLimitKey(filterKey);
    setLimit(POST_PAGE);
  }
  const live = useQ(
    api.search.posts,
    enabled
      ? {
          q: params.q,
          limit,
          media: tab === "photos" ? "photo" : tab === "videos" ? "video" : undefined,
          recent: params.recent,
          seen: tab === "photos" || tab === "videos" ? undefined : params.seen,
          year: params.date,
          from: params.from,
        }
      : "skip",
  );
  const data = useSticky(live, filterKey);
  const more = useCallback(() => setLimit((l) => l + POST_PAGE), []);
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

function PhotoGridResults({ posts }: { posts: PostView[] }) {
  const photos = posts.flatMap((p) =>
    p.media
      .filter((m) => m.kind === "image")
      .map((m, i) => ({ key: `${p._id}-${i}`, url: m.url, post: p })),
  );
  return (
    <Card className="rounded-xl p-4">
      <h2 className="pb-3 font-bold text-[20px] text-primary leading-6">Photos</h2>
      <div className="grid grid-cols-3 gap-1">
        {photos.map((ph) => (
          <Link
            key={ph.key}
            to="/$username/posts/$postId"
            params={{ username: ph.post.author.username, postId: ph.post._id }}
            className="aspect-square overflow-hidden rounded-md bg-btn"
          >
            <img
              src={ph.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-[filter] hover:brightness-95"
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function RowsCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-xl px-4 py-2">{children}</Card>;
}

export function SearchPage({ tab, params }: { tab: SearchTab; params: SearchParams }) {
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
  const liveEntities = useQ(
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
  const entities = useSticky(liveEntities, entityKey);
  const posts = usePosts(params, tab);

  useEffect(() => {
    document.title = q ? `${q} - Search | Facebook` : "Search | Facebook";
    return () => {
      document.title = "Facebook";
    };
  }, [q]);

  const loading = (types && q && !entities) || (posts.enabled && !posts.posts);
  const entityCount = entities
    ? entities.people.length +
      entities.pages.length +
      entities.groups.length +
      entities.events.length +
      entities.listings.length +
      entities.places.length
    : 0;
  const postCount = posts.posts?.length ?? 0;
  const photoCount =
    tab === "photos"
      ? (posts.posts ?? []).reduce(
          (n, p) => n + p.media.filter((m) => m.kind === "image").length,
          0,
        )
      : postCount;
  const empty = !q || (!loading && entityCount === 0 && photoCount === 0);

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
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
                <>
                  {entities.people.length > 0 && (
                    <ModuleCard title="People" seeAll="people" q={q}>
                      {entities.people.map((p) => (
                        <PersonRow key={p._id} p={p} />
                      ))}
                    </ModuleCard>
                  )}
                  {entities.pages.length > 0 && (
                    <ModuleCard title="Pages" seeAll="pages" q={q}>
                      {entities.pages.map((p) => (
                        <PageRow key={p._id} page={p} />
                      ))}
                    </ModuleCard>
                  )}
                  {entities.groups.length > 0 && (
                    <ModuleCard title="Groups" seeAll="groups" q={q}>
                      {entities.groups.map((g) => (
                        <GroupRow key={g._id} g={g} />
                      ))}
                    </ModuleCard>
                  )}
                  {entities.events.length > 0 && (
                    <ModuleCard title="Events" seeAll="events" q={q}>
                      {entities.events.map((e) => (
                        <EventRow key={e._id} e={e} />
                      ))}
                    </ModuleCard>
                  )}
                  {entities.listings.length > 0 && (
                    <ModuleCard title="Marketplace" seeAll="marketplace" q={q}>
                      <ListingGrid items={entities.listings.slice(0, 3)} />
                    </ModuleCard>
                  )}
                </>
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
              {entities && tab === "places" && (
                <RowsCard>
                  {entities.places.map((p) => (
                    <PlaceRow key={p.name} p={p} />
                  ))}
                </RowsCard>
              )}
              {entities && tab === "marketplace" && (
                <ModuleCard title="Marketplace" q={q}>
                  <ListingGrid items={entities.listings} />
                </ModuleCard>
              )}

              {tab === "photos" && posts.posts && <PhotoGridResults posts={posts.posts} />}
              {tab !== "photos" &&
                posts.posts?.map((p) => <PostCard key={p._id} post={p} hideable={false} />)}
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
