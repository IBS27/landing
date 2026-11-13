import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { MapPin, MessageCircleWarning, Route, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useM, useQ } from "@/app/viewer";
import { toEvent } from "@/landing/links";
import { LandingMap, type RouteStop } from "@/landing/map/LandingMap";
import { timeAgo } from "@/lib/citations";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Tooltip } from "@/ui/overlays";
import { Card, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { WeekendStopView } from "../../../convex/weekendRoutes";

export type WeekendRouteData = FunctionReturnType<typeof api.weekendRoutes.get>;

const WEEK = 7 * 24 * 60 * 60_000;

/**
 * A neighborhood's Weekend Route (#18): four to six stops locals agree on,
 * morning to night, on the map with a citation per stop. The route is shared
 * and built in the background; the first viewer of a neighborhood without one
 * starts the build. Mount it on the neighborhood page (#16).
 */
export function WeekendRoute({
  neighborhoodId,
  className,
}: {
  neighborhoodId: Id<"neighborhoods">;
  className?: string;
}) {
  const data = useQ(api.weekendRoutes.get, { neighborhoodId });
  const request = useM(api.weekendRoutes.request);
  const asked = useRef<string | null>(null);
  const due =
    data !== undefined &&
    !data.building &&
    !data.failed &&
    (!data.route || Date.now() - data.route.generatedAt > WEEK);
  useEffect(() => {
    if (!due || asked.current === neighborhoodId) return;
    asked.current = neighborhoodId;
    void request({ neighborhoodId }).catch(() => {});
  }, [due, neighborhoodId, request]);
  return <WeekendRouteCard data={data} className={className} />;
}

/** The card itself, for whatever data `api.weekendRoutes.get` returned (undefined while loading). */
export function WeekendRouteCard({
  data,
  className,
}: {
  data: WeekendRouteData | undefined;
  className?: string;
}) {
  const route = data?.route;
  const stops = route?.stops ?? [];
  return (
    <Card className={cn("overflow-hidden", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-bold text-lg text-primary leading-6">Weekend Route</h2>
          <p className="mt-0.5 text-secondary text-sm leading-[18px]">
            {route ? (
              <RouteMeta via={route.via} generatedAt={route.generatedAt} />
            ) : (
              "What locals agree on, from their Group threads"
            )}
          </p>
        </div>
        {route?.via === "fallback" && (
          <Tooltip content="Built without AI: the places locals mention most, plus this weekend's Events">
            <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-btn px-2.5 font-semibold text-secondary text-xs">
              Most discussed
            </span>
          </Tooltip>
        )}
      </header>

      {data === undefined ? (
        <Loading />
      ) : !route || stops.length === 0 ? (
        <Empty data={data} />
      ) : (
        <>
          <RouteMap stops={stops} />
          <ol className="px-2 pt-2 pb-2">
            {stops.map((s) => (
              <StopRow key={s.key} stop={s} n={pinNumber(stops, s)} />
            ))}
          </ol>
          {data.building && (
            <p className="flex items-center gap-2 border-divider border-t px-4 py-3 text-secondary text-sm">
              <Spinner size={14} /> Updating: {data.building.label}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function RouteMeta({ via, generatedAt }: { via: "model" | "fallback"; generatedAt: number }) {
  const lead = via === "model" ? "What locals agree on" : "Places locals mention most";
  return (
    <>
      {lead} · Updated {timeAgo(generatedAt)}
    </>
  );
}

/* ---------- Map ---------- */

/** Map numbers count pinned stops only (a stop off #15's place list has no pin). */
function pinNumber(stops: readonly WeekendStopView[], stop: WeekendStopView) {
  if (!stop.point) return null;
  return stops.filter((s) => s.point).indexOf(stop) + 1;
}

function RouteMap({ stops }: { stops: readonly WeekendStopView[] }) {
  const pinned: RouteStop[] = stops.flatMap((s) =>
    s.point
      ? [
          {
            key: s.key,
            name: s.name,
            point: s.point,
            note: `${timeLabel(s)} · ${s.why}`,
            sources: s.sources,
            ...(s.eventId && { link: { kind: "event" as const, _id: s.eventId } }),
          },
        ]
      : [],
  );
  if (pinned.length === 0) return null;
  return (
    <LandingMap
      layers={[{ kind: "route", stops: pinned }]}
      focus="layers"
      label="Weekend Route map"
      className="relative h-[280px] w-full border-divider border-y max-sm:h-[220px]"
    />
  );
}

/* ---------- Stops ---------- */

const TIME_LABEL: Record<WeekendStopView["timeOfDay"], string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

const eventTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function timeLabel(s: WeekendStopView) {
  return s.startAt !== undefined ? eventTime.format(s.startAt) : TIME_LABEL[s.timeOfDay];
}

function StopRow({ stop, n }: { stop: WeekendStopView; n: number | null }) {
  return (
    <li className="flex gap-3 rounded-lg px-2 py-2.5">
      <div className="flex flex-col items-center">
        {n !== null ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fb font-bold text-[13px] text-white tabular-nums">
            <span className="sr-only">Stop </span>
            {n}
          </span>
        ) : (
          <Tooltip content="Not on the map: this place isn't on the neighborhood's place list">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-secondary">
              <MapPin size={14} aria-hidden />
            </span>
          </Tooltip>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-secondary text-xs uppercase tracking-wide">
          {timeLabel(stop)}
          {stop.eventId && " · Event"}
        </p>
        <h3 className="mt-0.5 font-semibold text-base text-primary leading-5">
          {stop.eventId ? (
            <Link {...toEvent(stop.eventId)} className="hover:underline">
              {stop.name}
            </Link>
          ) : (
            stop.name
          )}
        </h3>
        <p className="mt-0.5 text-primary text-sm leading-[18px]">{stop.why}</p>
        {stop.disagreement && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-comment px-2.5 py-2">
            <MessageCircleWarning size={16} className="mt-px shrink-0 text-secondary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-primary text-sm leading-[18px]">
                <span className="font-semibold">Locals disagree: </span>
                {stop.disagreement.note}
              </p>
              <SourcesChip sources={stop.disagreement.sources} className="mt-1.5" />
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SourcesChip sources={stop.sources} />
          {stop.matches.length > 0 && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-btn-soft px-2 font-semibold text-btn-soft-text text-xs">
              <Sparkles size={12} aria-hidden />
              Fits your interest in {stop.matches.join(", ").toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- Loading and empty ---------- */

function Loading() {
  return (
    <div className="space-y-3 px-4 pb-4" aria-busy>
      <Skeleton className="h-[220px] w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ data }: { data: WeekendRouteData }) {
  if (data.building)
    return (
      <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-8 text-center">
        <Spinner size={24} />
        <p className="font-semibold text-base text-primary">Planning a route from local threads</p>
        <p className="text-secondary text-sm">{data.building.label}</p>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-8 text-center">
      <Route size={28} className="text-secondary" aria-hidden />
      <p className="font-semibold text-base text-primary">
        {data.failed ? "We couldn't plan a route right now" : "No Weekend Route yet"}
      </p>
      <p className="max-w-[380px] text-secondary text-sm">
        {data.failed
          ? "Try again in a few minutes."
          : "Locals haven't recommended enough places in this neighborhood's Groups to plan a day."}
      </p>
    </div>
  );
}
