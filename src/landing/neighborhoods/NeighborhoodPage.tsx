import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronRight, MapPinOff } from "lucide-react";
import { useMemo } from "react";
import { useQ } from "@/app/viewer";
import { toCompare } from "@/landing/links";
import { LandingMap, type MapLayer } from "@/landing/map/LandingMap";
import { plural } from "@/lib/format";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { NeighborhoodPageData } from "../../../convex/lib/neighborhoodPage";
import {
  EventsSection,
  ForYouSection,
  GroupsSection,
  PeopleSection,
  SkipsProvider,
} from "./sections";
import { ScoresSlot, WeekendRouteSlot } from "./slots";

/** `/landing/find/neighborhoods/$slug`: one neighborhood, from `neighborhoods.page`. */
export function NeighborhoodPage({ slug }: { slug: string }) {
  const data = useQ(api.neighborhoods.page, { slug });
  if (data === undefined) return <PageSkeleton />;
  if (data === null) return <NotFound />;
  return <NeighborhoodPageView data={data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-12 lg:px-8">{children}</div>;
}

function Crumbs({ here }: { here?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[13px] leading-4">
      <Link to="/landing/find" className="text-secondary hover:underline">
        Find
      </Link>
      <ChevronRight size={14} className="text-secondary" aria-hidden />
      {here ? (
        <>
          <Link to="/landing/find/neighborhoods" className="text-secondary hover:underline">
            Neighborhoods
          </Link>
          <ChevronRight size={14} className="text-secondary" aria-hidden />
          <span aria-current="page" className="font-semibold text-primary">
            {here}
          </span>
        </>
      ) : (
        <span aria-current="page" className="font-semibold text-primary">
          Neighborhoods
        </span>
      )}
    </nav>
  );
}

export { Crumbs as NeighborhoodCrumbs };

/** The page itself, given its data. */
export function NeighborhoodPageView({ data }: { data: NeighborhoodPageData }) {
  const { neighborhood: n, groups, events, forYou, people } = data;
  const layers = useMemo<MapLayer[]>(
    () => [
      {
        kind: "neighborhoods",
        items: [
          {
            _id: n._id,
            slug: n.slug,
            label: n.label,
            park: n.park,
            center: n.center,
            polygon: n.polygon,
          },
        ],
        selected: n.slug,
      },
      {
        kind: "groups",
        items: groups.flatMap((g) =>
          g.point
            ? [
                {
                  _id: g._id,
                  slug: g.slug,
                  name: g.name,
                  cover: g.cover,
                  privacy: g.privacy,
                  memberCount: g.memberCount,
                  point: g.point,
                },
              ]
            : [],
        ),
      },
      {
        kind: "events",
        items: events.flatMap((e) =>
          e.point
            ? [
                {
                  _id: e._id,
                  title: e.title,
                  cover: e.cover,
                  startAt: e.startAt,
                  place: e.place,
                  point: e.point,
                },
              ]
            : [],
        ),
      },
    ],
    [n, groups, events],
  );
  const facts = [
    n.name !== n.label ? n.name : null,
    groups.length > 0 && plural(groups.length, "Group"),
    events.length > 0 ? plural(events.length, "upcoming event") : "No upcoming events",
  ].filter(Boolean);

  return (
    <SkipsProvider>
      <Shell>
        <Crumbs here={n.label} />
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-[28px] text-primary leading-8 tracking-[-0.01em]">
              {n.label}
            </h1>
            <p className="mt-1 text-[15px] text-secondary leading-5">{facts.join(" · ")}</p>
          </div>
          <Link
            {...toCompare(n.slug)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125"
          >
            <ArrowLeftRight size={16} aria-hidden />
            Compare
          </Link>
        </header>
        <Card className="relative mb-4 overflow-hidden">
          <LandingMap
            layers={layers}
            focus={{ bounds: n.bbox }}
            padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
            label={`Map of ${n.label} with its Groups and Events`}
            className="h-[260px] sm:h-[320px]"
          />
        </Card>
        <ScoresSlot neighborhoodId={n._id} slug={n.slug} />
        <div className="grid grid-cols-1 items-start gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <ForYouSection forYou={forYou} label={n.label} />
            <WeekendRouteSlot neighborhoodId={n._id} slug={n.slug} />
            <EventsSection events={events} label={n.label} />
            <GroupsSection groups={groups} label={n.label} />
          </div>
          <aside className="min-w-0">
            <PeopleSection people={people} label={n.label} />
          </aside>
        </div>
      </Shell>
    </SkipsProvider>
  );
}

function PageSkeleton() {
  return (
    <Shell>
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[260px] w-full rounded-lg sm:h-[320px]" />
        <div className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <Crumbs />
      <Card className="mt-4 flex flex-col items-center px-6 py-12 text-center">
        <MapPinOff size={32} className="text-secondary" aria-hidden />
        <h1 className="mt-3 font-bold text-[20px] text-primary leading-6">
          We couldn't find that neighborhood
        </h1>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          Pick one of San Francisco's neighborhoods from the list.
        </p>
        <Link
          to="/landing/find/neighborhoods"
          className="mt-4 flex h-9 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
        >
          See all neighborhoods
        </Link>
      </Card>
    </Shell>
  );
}
