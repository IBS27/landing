import type { ReactNode } from "react";
import { Fragment, useEffect, useRef } from "react";
import { Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PostCard } from "./PostCard";
import type { PostView } from "./types";
import { useViewerPaginated } from "./usePaginated";

export type FeedSource =
  | { kind: "home" }
  | { kind: "timeline"; userId: Id<"users"> }
  | { kind: "group"; groupId: Id<"groups"> }
  | { kind: "recent"; filter: "all" | "favorites" | "friends" | "groups" | "pages" };

const PAGE = 5;

function useFeed(source: FeedSource) {
  const home = useViewerPaginated(api.feed.home, source.kind === "home" ? {} : "skip", PAGE);
  const timeline = useViewerPaginated(
    api.posts.byTimeline,
    source.kind === "timeline" ? { userId: source.userId } : "skip",
    PAGE,
  );
  const group = useViewerPaginated(
    api.posts.byGroup,
    source.kind === "group" ? { groupId: source.groupId } : "skip",
    PAGE,
  );
  const recent = useViewerPaginated(
    api.feed.recent,
    source.kind === "recent" ? { filter: source.filter } : "skip",
    PAGE,
  );
  return { home, timeline, group, recent }[source.kind];
}

/**
 * A paginated list of PostCards with skeletons and infinite scroll.
 * Cards are stacked with Facebook's 12px gap; the parent sets the width.
 * `interleave(i)` renders extra cards (ads, the Reels shelf) after post `i`.
 */
export function PostFeed({
  source,
  empty,
  interleave,
}: {
  source: FeedSource;
  empty?: ReactNode;
  interleave?: (index: number) => ReactNode;
}) {
  const { results, status, loadMore } = useFeed(source);
  const sentinel = useRef<HTMLDivElement>(null);
  const posts = results as PostView[];

  useEffect(() => {
    const el = sentinel.current;
    if (!el || status !== "CanLoadMore") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore(PAGE);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore]);

  if (status === "LoadingFirstPage")
    return (
      <div className="flex flex-col gap-3">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );

  if (posts.length === 0 && status === "Exhausted")
    return (
      <>
        {empty ?? (
          <Card className="rounded-xl">
            <EmptyState
              title="No posts yet"
              body="When there are posts to show, you'll see them here."
            />
          </Card>
        )}
      </>
    );

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p, i) => (
        <Fragment key={p._id}>
          <PostCard post={p} />
          {interleave?.(i)}
        </Fragment>
      ))}
      <div ref={sentinel} />
      {(status === "LoadingMore" || status === "CanLoadMore") && <PostSkeleton />}
    </div>
  );
}

/** Grey placeholder shaped like a post card. */
export function PostSkeleton() {
  return (
    <Card className="rounded-xl p-3" aria-hidden>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="mt-4 h-[220px] w-full rounded-lg" />
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
      </div>
    </Card>
  );
}
