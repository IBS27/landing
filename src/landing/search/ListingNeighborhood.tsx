import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { toCompare, toNeighborhood } from "@/landing/links";
import { LandingMap, type MapLayer } from "@/landing/map/LandingMap";
import { NeighborhoodScores } from "@/landing/neighborhoods/NeighborhoodScores";
import { WeekendRoutePeek } from "@/landing/neighborhoods/WeekendRoute";
import { Card } from "@/ui/primitives";
import type { api } from "../../../convex/_generated/api";

type Trust = NonNullable<FunctionReturnType<typeof api.trust.forListing>>;

/**
 * A rental's neighborhood, one tap from the rest of it: its page, the three
 * shared scores with sources, a peek at its Weekend Route and "Try the
 * neighborhood" with it picked. The map shows the listing's approximate pin
 * inside the neighborhood. Nothing for a listing outside San Francisco.
 */
export function ListingNeighborhood({
  neighborhood: n,
  pin,
}: {
  neighborhood: Trust["neighborhood"];
  pin: Trust["pin"];
}) {
  const layers = useMemo<MapLayer[]>(
    () =>
      n
        ? [
            { kind: "neighborhoods", items: [n], selected: n.slug },
            { kind: "listings", items: pin ? [pin] : [] },
          ]
        : [],
    [n, pin],
  );
  if (!n) return null;
  return (
    <Card className="overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[13px] text-secondary leading-4">The neighborhood</p>
          <h2 className="mt-0.5 font-bold text-[20px] text-primary leading-6">
            <Link {...toNeighborhood(n)} className="hover:underline">
              {n.label}
            </Link>
          </h2>
        </div>
        <Link
          {...toCompare(n.slug)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125"
        >
          <ArrowLeftRight size={16} aria-hidden />
          Compare with…
        </Link>
      </header>
      <LandingMap
        layers={layers}
        focus={{ bounds: n.bbox }}
        padding={{ top: 16, bottom: 16, left: 16, right: 16 }}
        label={`Map of ${n.label} with this listing's approximate area`}
        className="relative h-[200px] w-full border-divider border-y sm:h-[240px]"
      />
      <div className="px-4 pt-3 pb-2">
        <h3 className="font-bold text-[17px] text-primary leading-5">How {n.label} scores</h3>
        <p className="mt-0.5 text-secondary text-sm leading-[18px]">
          Compared with other San Francisco neighborhoods, from public data.
        </p>
        <div className="mt-1">
          <NeighborhoodScores neighborhoodId={n._id} compact />
        </div>
      </div>
      <div className="border-divider border-t px-4 py-3 empty:hidden">
        <WeekendRoutePeek neighborhoodId={n._id} slug={n.slug} />
      </div>
      <Link
        {...toNeighborhood(n)}
        className="flex items-center gap-2 border-divider border-t px-4 py-3 font-semibold text-[15px] text-primary transition-colors hover:bg-hover"
      >
        <span className="min-w-0 flex-1">Groups, Events and people in {n.label}</span>
        <ChevronRight size={20} className="shrink-0 text-secondary" aria-hidden />
      </Link>
    </Card>
  );
}
