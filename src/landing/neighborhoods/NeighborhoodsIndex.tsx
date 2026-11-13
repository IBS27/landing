import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQ } from "@/app/viewer";
import { LandingMap, type MapLayer } from "@/landing/map/LandingMap";
import { useMediaQuery } from "@/landing/map/useEnv";
import { plural } from "@/lib/format";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { DirectoryEntry } from "../../../convex/lib/neighborhoodPage";
import { compareSearch } from "./compare";
import { NeighborhoodCrumbs } from "./NeighborhoodPage";

/**
 * `/landing/find/neighborhoods`: every San Francisco neighborhood on the map
 * (click one to open its page) and in a list, the viewer's own first.
 */
export function NeighborhoodsIndex() {
  const data = useQ(api.neighborhoods.directory, {});
  return <NeighborhoodsIndexView data={data} />;
}

type Directory = { neighborhoods: DirectoryEntry[]; hasProfile: boolean };

export function NeighborhoodsIndexView({ data }: { data: Directory | undefined }) {
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 1200px)");
  const [q, setQ] = useState("");
  const layers = useMemo<MapLayer[]>(
    () => [
      {
        kind: "neighborhoods",
        items: data?.neighborhoods ?? [],
        onSelect: (n) =>
          navigate({ to: "/landing/find/neighborhoods/$slug", params: { slug: n.slug } }),
      },
    ],
    [data, navigate],
  );
  const all = data?.neighborhoods ?? [];
  const needle = q.trim().toLowerCase();
  const match = (n: DirectoryEntry) =>
    !needle || n.label.toLowerCase().includes(needle) || n.name.toLowerCase().includes(needle);
  const yours = all.filter((n) => n.yours && match(n));
  // "Try the neighborhood" starts from the viewer's first two, when they have them.
  const mine = all.filter((n) => n.yours);
  const rest = all.filter((n) => !n.yours && match(n));

  return (
    <div className="grid grid-cols-1 min-[1200px]:h-[calc(100dvh-56px)] min-[1200px]:grid-cols-[400px_minmax(0,1fr)] min-[1200px]:grid-rows-[auto_minmax(0,1fr)]">
      <header className="px-4 pt-5 pb-3 min-[1200px]:col-start-1 min-[1200px]:row-start-1">
        <NeighborhoodCrumbs />
        <h1 className="font-bold text-[24px] text-primary leading-7">Neighborhoods</h1>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          Groups, events and people in each part of San Francisco, and what fits you.
        </p>
        <Link
          to="/landing/find/neighborhoods/compare"
          search={compareSearch({ a: mine[0]?.slug, b: mine[1]?.slug })}
          className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-md bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125"
        >
          <ArrowLeftRight size={16} aria-hidden />
          Compare two neighborhoods
        </Link>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-full bg-input px-3 text-secondary focus-within:ring-2 focus-within:ring-accent">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search neighborhoods</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search neighborhoods"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-secondary"
          />
        </label>
      </header>
      <div className="relative h-[56dvh] min-h-[360px] min-[1200px]:col-start-2 min-[1200px]:row-span-2 min-[1200px]:row-start-1 min-[1200px]:h-auto min-[1200px]:min-h-0">
        <LandingMap
          layers={layers}
          focus="city"
          padding={{ top: 16, bottom: wide ? 64 : 16 }}
          label="Map of San Francisco's neighborhoods"
          className="absolute inset-0"
        />
      </div>
      <div className="px-2 pt-2 pb-10 min-[1200px]:col-start-1 min-[1200px]:row-start-2 min-[1200px]:overflow-y-auto min-[1200px]:pt-0">
        {data === undefined ? (
          <div className="flex flex-col gap-2 px-2 pt-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {yours.length > 0 && (
              <List title="In your City Profile" items={yours} hasProfile={data.hasProfile} />
            )}
            <List
              title={yours.length > 0 ? "All neighborhoods" : undefined}
              items={rest}
              hasProfile={data.hasProfile}
            />
            {yours.length + rest.length === 0 && (
              <p className="px-2 py-6 text-center text-[15px] text-secondary">
                No neighborhood called "{q.trim()}".
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function List({
  title,
  items,
  hasProfile,
}: {
  title?: string;
  items: DirectoryEntry[];
  hasProfile: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="pb-2">
      {title && (
        <h2 className="px-2 pt-3 pb-1 font-semibold text-[17px] text-primary leading-5">{title}</h2>
      )}
      <ul>
        {items.map((n) => (
          <li key={n._id}>
            <Row n={n} hasProfile={hasProfile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ n, hasProfile }: { n: DirectoryEntry; hasProfile: boolean }) {
  const counts =
    n.groupCount + n.eventCount === 0
      ? n.park
        ? "Park"
        : "No Groups or upcoming events yet"
      : [
          n.groupCount > 0 && plural(n.groupCount, "Group"),
          n.eventCount > 0 && plural(n.eventCount, "upcoming event"),
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <Link
      to="/landing/find/neighborhoods/$slug"
      params={{ slug: n.slug }}
      className="group flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover active:bg-pressed"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate font-semibold text-[15px] text-primary leading-5">
            {n.label}
          </span>
          {n.name !== n.label && (
            <span className="truncate text-[13px] text-secondary leading-4">{n.name}</span>
          )}
        </span>
        <span className="block truncate text-[13px] text-secondary leading-4">{counts}</span>
      </span>
      {hasProfile && n.matchCount > 0 && (
        <span
          title={
            n.matchCount === 1
              ? "1 Group or event here matches your interests"
              : `${n.matchCount} Groups and events here match your interests`
          }
          className="shrink-0 rounded-full bg-btn-soft px-2 py-0.5 font-semibold text-[12px] text-btn-soft-text leading-4"
        >
          {n.matchCount} match you
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-secondary" aria-hidden />
    </Link>
  );
}
