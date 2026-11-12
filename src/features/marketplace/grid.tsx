import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn, price } from "@/lib/format";
import { Skeleton, Spinner } from "@/ui/primitives";
import { bedsBaths, type ListingCard } from "../../../convex/lib/listings";

export function priceLabel(n: number) {
  return n === 0 ? "FREE" : price(n);
}

/** "98K miles" */
export function milesLabel(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}K miles` : `${n.toLocaleString("en-US")} miles`;
}

/** One Marketplace grid card: square photo, price, title, location. */
export function ListingCardView({ l, footer }: { l: ListingCard; footer?: ReactNode }) {
  const rentLine = l.rental && l.rental.listingType !== "sale" ? ` · ${bedsBaths(l.rental)}` : "";
  return (
    <div className="pb-3">
      <Link
        to="/marketplace/item/$listingId"
        params={{ listingId: l._id }}
        className="group block rounded-md"
      >
        <div className="relative aspect-square overflow-hidden rounded-[6px] border border-black/10 bg-input dark:border-white/10">
          {l.photo && (
            <img
              src={l.photo}
              alt={l.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
          {l.justListed && l.status === "active" && (
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
        <div className="mt-2 flex items-baseline gap-1.5 truncate text-[17px] leading-5">
          <span className="font-semibold text-primary">
            {priceLabel(l.price)}
            {rentLine && <span className="font-normal">{rentLine}</span>}
          </span>
          {l.originalPrice !== null && l.originalPrice > l.price && (
            <span className="font-medium text-secondary line-through">
              {price(l.originalPrice)}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[15px] text-primary leading-5 group-hover:underline">
          {l.title}
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

export const gridClass = "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-2 gap-y-1";

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
}: {
  data: { items: ListingCard[]; hasMore: boolean } | undefined;
  onMore: () => void;
  empty?: ReactNode;
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
        {data.items.map((l) => (
          <ListingCardView key={l._id} l={l} />
        ))}
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
