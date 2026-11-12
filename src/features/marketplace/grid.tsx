import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { PlayGlyph } from "@/features/posts/VideoPlayer";
import { cn, price } from "@/lib/format";
import { Avatar, Skeleton, Spinner } from "@/ui/primitives";
import { homeTitle, type ListingCard } from "../../../convex/lib/listings";
import type { MarketplaceAd } from "../../../convex/listings";

export function priceLabel(n: number) {
  return n === 0 ? "FREE" : price(n);
}

/** "98K miles" */
export function milesLabel(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}K miles` : `${n.toLocaleString("en-US")} miles`;
}

/**
 * Facebook's "Just listed" pill marks listings posted in the last several hours
 * (well under a day), so only a few tiles per screen carry it.
 */
const JUST_LISTED_MS = 12 * 60 * 60 * 1000;

/** One Marketplace grid card: square photo, price, title, location. */
export function ListingCardView({ l, footer }: { l: ListingCard; footer?: ReactNode }) {
  const title = l.rental ? homeTitle(l.rental, l.title) : l.title;
  // Judged on the viewer's clock: a cached query result must not keep the pill on old listings.
  const justListed = l.status === "active" && Date.now() - l.createdAt < JUST_LISTED_MS;
  return (
    <div className="pb-3">
      <Link
        to="/marketplace/item/$listingId"
        params={{ listingId: l._id }}
        className="group block rounded-md"
      >
        <div className="relative aspect-square overflow-hidden rounded-[6px] border border-black/10 bg-input dark:border-white/10">
          {l.photo && (
            <img src={l.photo} alt={title} loading="lazy" className="h-full w-full object-cover" />
          )}
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
          {justListed && (
            <span className="absolute top-2 left-2 rounded bg-white px-1 py-0.5 font-medium text-[#080809] text-[12px] leading-4">
              Just listed
            </span>
          )}
          {l.status !== "active" && (
            <span className="absolute top-2 left-2 rounded bg-white px-1 py-0.5 font-medium text-[#080809] text-[12px] leading-4">
              {l.status === "sold" ? "Sold" : "Pending"}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1.5 truncate text-[17px] leading-5">
          <span className="font-semibold text-primary">{priceLabel(l.price)}</span>
          {l.originalPrice !== null && l.originalPrice > l.price && (
            <span className="font-medium text-secondary line-through">
              {price(l.originalPrice)}
            </span>
          )}
          {l.hasVideo && <VideoBadge />}
        </div>
        <p className="mt-1 truncate text-[15px] text-primary leading-5 group-hover:underline">
          {title}
        </p>
        <p className="mt-1 truncate text-[13px] text-secondary leading-4">{l.city}</p>
        {l.mileage !== null && (
          <p className="truncate text-[13px] text-secondary leading-4">{milesLabel(l.mileage)}</p>
        )}
      </Link>
      {footer}
    </div>
  );
}

/** The small grey video-camera chip Facebook puts beside the price of listings with a video. */
function VideoBadge() {
  return (
    <span
      role="img"
      aria-label="Has video"
      className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-btn text-primary"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden>
        <rect x="0.5" y="2.5" width="7.5" height="7" rx="1.6" />
        <path d="M8.8 5.1 11 3.7c.25-.16.5 0 .5.3v4c0 .3-.25.46-.5.3L8.8 6.9Z" />
      </svg>
    </span>
  );
}

/** A Sponsored tile in the Marketplace grid: a Page's ad creative, its logo, headline and "Ad". */
export function AdTile({ ad }: { ad: MarketplaceAd }) {
  return (
    <div className="pb-3">
      <Link
        to="/$username/posts/$postId"
        params={{ username: ad.page.username, postId: ad.postId }}
        className="group block rounded-md"
      >
        <div className="relative aspect-square overflow-hidden rounded-[6px] border border-black/10 bg-input dark:border-white/10">
          <img
            src={ad.image}
            alt={ad.headline}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
          <span className="absolute top-2 left-2 rounded-full bg-white p-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
            <Avatar src={ad.page.avatar} size={32} />
          </span>
          {ad.video && (
            <span className="absolute top-1/2 left-1/2 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-black/50 text-white">
              <PlayGlyph size={34} className="ml-1" />
            </span>
          )}
        </div>
        <p className="mt-3 truncate font-semibold text-[15px] text-primary leading-5">
          {ad.page.name}
        </p>
        <p className="mt-1 truncate text-[15px] text-primary leading-5 group-hover:underline">
          {ad.headline}
        </p>
        <p className="mt-1 text-[13px] text-secondary leading-4">Ad</p>
      </Link>
    </div>
  );
}

/** Grid slots for ads: the 10th tile, then every 24 listings after it. */
const AD_FIRST = 9;
const AD_EVERY = 24;

export const gridClass = "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-2";

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={gridClass}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pb-3">
          <Skeleton className="aspect-square w-full rounded-[6px]" />
          <Skeleton className="mt-2 h-4 w-16" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Infinite grid: renders the items it has and asks for more when the
 * sentinel scrolls into view.
 */
export function ListingGrid({
  data,
  onMore,
  empty,
  ads,
}: {
  data: { items: ListingCard[]; hasMore: boolean } | undefined;
  onMore: () => void;
  empty?: ReactNode;
  /** Sponsored tiles to interleave (Browse all only, like Facebook). */
  ads?: MarketplaceAd[];
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = data?.hasMore ?? false;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onMore();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onMore]);

  if (!data) return <GridSkeleton />;
  if (data.items.length === 0)
    return (
      <>
        {empty ?? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="font-bold text-[20px] text-secondary leading-6">No listings found</p>
            <p className="mt-1 text-[15px] text-secondary">
              Try changing your filters or location, or searching for something else.
            </p>
          </div>
        )}
      </>
    );
  return (
    <>
      <div className={gridClass}>
        {data.items.map((l, i) => {
          const slot = i - AD_FIRST;
          const ad =
            ads && ads.length > 0 && slot >= 0 && slot % AD_EVERY === 0
              ? ads[(slot / AD_EVERY) % ads.length]
              : undefined;
          return (
            <Fragment key={l._id}>
              {ad && <AdTile ad={ad} />}
              <ListingCardView l={l} />
            </Fragment>
          );
        })}
      </div>
      <div ref={sentinel} className={cn("flex justify-center py-6", !hasMore && "hidden")}>
        <Spinner />
      </div>
    </>
  );
}

/** A query result that keeps the previous value while new args load (no flicker). */
export function useSticky<T>(value: T | undefined, resetKey: string): T | undefined {
  const last = useRef<{ key: string; value: T } | null>(null);
  if (value !== undefined) last.current = { key: resetKey, value };
  return value ?? (last.current?.key === resetKey ? last.current.value : undefined);
}

/** A growing page size for infinite grids. Resets when `resetKey` changes. */
export function useGrowingLimit(resetKey: string, step = 24) {
  const [state, setState] = useState({ key: resetKey, limit: step });
  const limit = state.key === resetKey ? state.limit : step;
  const more = useCallback(
    () => setState((s) => ({ key: resetKey, limit: (s.key === resetKey ? s.limit : step) + step })),
    [resetKey, step],
  );
  return { limit, more };
}
