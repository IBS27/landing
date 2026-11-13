import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarCheck,
  CalendarDays,
  Footprints,
  MapPin,
  MessageCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { CheckInCard, WeekActivity } from "@/landing/journeys/CheckInCard";
import { toEvent, toGroup, toProfile } from "@/landing/links";
import { LandingMap, type RouteStop } from "@/landing/map/LandingMap";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Button, Card, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { JourneyStopView } from "../../../convex/journeys";

type ThisWeek = FunctionReturnType<typeof api.journeys.thisWeek>;
type Journey = NonNullable<ThisWeek["journey"]>;
type Person = JourneyStopView["crew"]["going"][number];

/** The first 90 days, in weekends (`JOURNEY_WEEKS` in convex/lib/journeys.ts, which is server-only). */
const JOURNEY_WEEKS = 13;

/** "Dev", "Dev and Priya", "Dev, Priya and Sam". */
function nameList(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const TZ = "America/Los_Angeles";
const dayMonth = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  month: "long",
  day: "numeric",
});
const eventTime = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const TIME_LABEL: Record<JourneyStopView["timeOfDay"], string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

/** "Nov 14-15". Saturday to Sunday, San Francisco time. */
function weekendLabel(start: number) {
  const sat = dayMonth.format(start);
  const sun = dayMonth.format(start + 26 * 3_600_000);
  const [m1] = sat.split(" ");
  const [m2, d2] = sun.split(" ");
  return m1 === m2 ? `${sat}-${d2}` : `${sat}-${sun}`;
}

const timeLabel = (s: JourneyStopView) =>
  s.startAt !== undefined ? eventTime.format(s.startAt) : TIME_LABEL[s.timeOfDay];

/**
 * Landing → Crew & Journeys → Journeys (#32): this weekend's route for each
 * week of the first 90 days, from real Events and Group plans, with the Move-in
 * Crew members who are going and a Muse-drafted "Mind if I join you?" that waits
 * in Landing Inbox. Earlier weeks are listed below. The page header and tabs
 * come from `CrewTabs`.
 */
export function JourneysPage() {
  const data = useQ(api.journeys.thisWeek, {});
  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <CheckInCard />
      {data === undefined ? <Loading /> : <ThisWeekView data={data} />}
      <PastWeeks currentWeekOf={data?.week?.weekOf ?? null} />
    </div>
  );
}

function ThisWeekView({ data }: { data: ThisWeek }) {
  switch (data.status) {
    case "noProfile":
      return (
        <Notice
          title="Set up your City Profile first"
          body="Journeys start from your move-in date, neighborhoods and interests."
          action={{ to: "/landing/welcome", label: "Set up your City Profile" }}
        />
      );
    case "noMoveIn":
      return (
        <Notice
          title="Add your move-in date"
          body="Your first Journey arrives the weekend you move in."
          action={{ to: "/landing/profile", label: "Edit City Profile" }}
        />
      );
    case "before":
      return (
        <Notice
          title={`Your Journeys start ${data.moveInAt ? longDate.format(data.moveInAt) : "when you move in"}`}
          body="Every weekend of your first 90 days, you'll get a plan built from Events and Group plans in your neighborhoods, with your Move-in Crew."
          action={{ to: "/landing/crew", label: "See your Move-in Crew" }}
        />
      );
    case "after":
      return (
        <Notice
          title="Your first 90 days are done"
          body="You've been here long enough to be a local. Your past weeks are below."
        />
      );
    case "during":
      return data.week ? (
        <>
          <WeekHeader week={data.week.week} start={data.week.start} journey={data.journey} />
          {data.journey ? (
            <JourneyCards journey={data.journey} />
          ) : (
            <Notice
              title="This weekend's Journey is on its way"
              body="Journeys are planned every morning from the latest Events and Group plans. Check back soon."
            />
          )}
        </>
      ) : null;
  }
}

/* ---------- Header ---------- */

function WeekHeader({
  week,
  start,
  journey,
}: {
  week: number;
  start: number;
  journey: Journey | null;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h2 className="font-bold text-[17px] text-primary leading-5">
          Week {week} of {JOURNEY_WEEKS}
        </h2>
        <p className="text-[13px] text-secondary">This weekend, {weekendLabel(start)}</p>
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${JOURNEY_WEEKS}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Week ${week} of your first ${JOURNEY_WEEKS} weeks`}
      >
        {Array.from({ length: JOURNEY_WEEKS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full",
              i < week - 1 ? "bg-fb/40" : i === week - 1 ? "bg-fb" : "bg-btn",
            )}
          />
        ))}
      </div>
      {journey && journey.neighborhoods.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-secondary text-sm">
          <MapPin size={14} className="shrink-0" aria-hidden />
          From Events and Group plans in {nameList(journey.neighborhoods)}
        </p>
      )}
    </Card>
  );
}

/* ---------- The week ---------- */

function JourneyCards({ journey }: { journey: Journey }) {
  const toast = useToast();
  if (journey.stops.length === 0 && journey.more.length === 0)
    return (
      <Notice
        title="No plans in your neighborhoods this weekend"
        body="Nobody has posted an Event or Group plan near you for this weekend yet. Journeys update every morning."
      />
    );
  return (
    <>
      {journey.stops.length > 0 && (
        <Card className="overflow-hidden">
          <header className="px-4 pt-4 pb-3">
            <h2 className="font-bold text-[17px] text-primary leading-5">Your weekend route</h2>
            <p className="mt-0.5 text-secondary text-sm leading-4">
              Real plans, with places locals recommend around them
            </p>
          </header>
          <RouteMap stops={journey.stops} />
          <ol className="px-2 py-2">
            {journey.stops.map((s, i) => (
              <StopRow
                key={s.key}
                stop={s}
                n={pinNumber(journey.stops, s)}
                last={i === journey.stops.length - 1}
                crewOptedIn={journey.crewOptedIn}
                onToast={toast.show}
              />
            ))}
          </ol>
        </Card>
      )}
      {journey.more.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="px-4 pt-4 pb-1 font-bold text-[17px] text-primary leading-5">
            Also this weekend
          </h2>
          <ul className="px-2 pb-2">
            {journey.more.map((s, i) => (
              <StopRow
                key={s.key}
                stop={s}
                n={null}
                last={i === journey.more.length - 1}
                crewOptedIn={journey.crewOptedIn}
                onToast={toast.show}
              />
            ))}
          </ul>
        </Card>
      )}
      {!journey.crewOptedIn && (
        <Notice
          title="See who's going"
          body="Join your Move-in Crew to see when people arriving with you are going to the same plans."
          action={{ to: "/landing/crew", label: "Join your Move-in Crew" }}
        />
      )}
      {toast.node}
    </>
  );
}

function pinNumber(stops: readonly JourneyStopView[], stop: JourneyStopView) {
  if (!stop.point) return null;
  return stops.filter((s) => s.point).indexOf(stop) + 1;
}

function RouteMap({ stops }: { stops: readonly JourneyStopView[] }) {
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
      label="This weekend's route"
      className="relative h-[300px] w-full border-divider border-y max-sm:h-[220px]"
    />
  );
}

function StopRow({
  stop,
  n,
  last,
  crewOptedIn,
  onToast,
}: {
  stop: JourneyStopView;
  n: number | null;
  last: boolean;
  crewOptedIn: boolean;
  onToast: (m: string) => void;
}) {
  const isEvent = stop.eventId !== undefined;
  return (
    <li className={cn("flex gap-3 rounded-lg px-2 py-3", stop.over && "opacity-60")}>
      <div className="flex flex-col items-center">
        <StopMarker n={n} isEvent={isEvent} />
        {!last && n !== null && <span className="mt-1 w-px flex-1 bg-divider" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[13px] text-secondary leading-4">
          {timeLabel(stop)}
          {stop.group ? " · Group plan" : isEvent ? " · Event" : ""}
          {stop.over && " · Ended"}
        </p>
        <h3 className="mt-1 font-semibold text-[15px] text-primary leading-5">
          {stop.eventId ? (
            <Link {...toEvent(stop.eventId)} className="hover:underline">
              {stop.name}
            </Link>
          ) : (
            stop.name
          )}
        </h3>
        {stop.group && (
          <p className="mt-0.5 text-secondary text-sm">
            in{" "}
            <Link {...toGroup({ slug: stop.group.slug })} className="font-semibold hover:underline">
              {stop.group.name}
            </Link>
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-primary text-sm leading-[18px]">{stop.why}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SourcesChip sources={stop.sources} />
          {stop.matches.length > 0 && (
            <span className="inline-flex items-center gap-1 text-secondary text-sm">
              <Sparkles size={14} className="shrink-0" aria-hidden />
              Fits your interest in {stop.matches.join(", ").toLowerCase()}
            </span>
          )}
        </div>
        {stop.eventId && !stop.over && crewOptedIn && (
          <CrewOverlap stop={stop} eventId={stop.eventId} onToast={onToast} />
        )}
      </div>
    </li>
  );
}

function StopMarker({ n, isEvent }: { n: number | null; isEvent: boolean }) {
  if (n !== null)
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fb font-bold text-[13px] text-white tabular-nums">
        <span className="sr-only">Stop </span>
        {n}
      </span>
    );
  return (
    <Tooltip content={isEvent ? "Event" : "Not on the map: this place isn't on the place list"}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-secondary">
        {isEvent ? <CalendarCheck size={14} aria-hidden /> : <MapPin size={14} aria-hidden />}
      </span>
    </Tooltip>
  );
}

/* ---------- Crew overlap ---------- */

function firstNames(people: readonly Person[]) {
  return people.map((p) => p.firstName);
}

function Faces({ people }: { people: readonly Person[] }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, 4).map((p) => (
        <Link
          key={p._id}
          {...toProfile(p)}
          className="rounded-full ring-2 ring-card"
          title={p.name}
        >
          <Avatar src={p.avatar} alt={p.name} size={28} />
        </Link>
      ))}
    </span>
  );
}

/**
 * "Zoe and Dan are going. Join?" Going is the viewer's own RSVP. The message
 * is drafted by Muse and waits in Landing Inbox until they approve it.
 */
function CrewOverlap({
  stop,
  eventId,
  onToast,
}: {
  stop: JourneyStopView;
  eventId: Id<"events">;
  onToast: (m: string) => void;
}) {
  const { going, inGroup } = stop.crew;
  const respond = useM(api.events.respond);
  const draftJoin = useM(api.journeys.draftJoin);
  const [jobId, setJobId] = useState<Id<"aiJobs"> | null>(null);
  const [busy, setBusy] = useState(false);
  const job = useQ(api.ai.jobs.get, jobId ? { jobId } : "skip");
  const drafting = jobId !== null && !stop.draftId && job?.status !== "failed";

  if (going.length === 0 && inGroup.length === 0) return null;
  const names = firstNames(going);
  const verb = going.length === 1 ? "is" : "are";

  const join = async () => {
    setBusy(true);
    try {
      await respond({ eventId, status: "going" });
      onToast("You're going. Want to let them know?");
    } catch (e) {
      onToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const ask = async () => {
    try {
      setJobId(await draftJoin({ eventId }));
    } catch (e) {
      onToast(errorText(e));
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-comment px-3 py-2.5">
      {going.length > 0 && (
        <div className="flex items-center gap-2.5">
          <Faces people={going} />
          <p className="min-w-0 flex-1 text-[15px] text-primary leading-5">
            {stop.viewerGoing ? (
              <>
                <span className="font-semibold">{nameList(["You", ...names])}</span> are going
              </>
            ) : (
              <>
                <span className="font-semibold">{nameList(names)}</span> {verb} going. Join?
              </>
            )}
          </p>
        </div>
      )}
      {inGroup.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-secondary text-sm">
          <UsersRound size={14} aria-hidden />
          {nameList(firstNames(inGroup))} {inGroup.length === 1 ? "is" : "are"} in{" "}
          {stop.group?.name ?? "this Group"}
        </p>
      )}
      {going.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {!stop.viewerGoing && (
            <Button
              variant="primary"
              size="sm"
              icon={<Footprints size={16} aria-hidden />}
              onClick={join}
              disabled={busy}
            >
              Going
            </Button>
          )}
          {stop.draftId ? (
            <Link
              to="/landing/inbox"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-btn-soft px-3 font-semibold text-btn-soft-text text-sm"
            >
              <MessageCircle size={16} aria-hidden />
              Draft waiting in Inbox
            </Link>
          ) : drafting ? (
            <span className="inline-flex h-8 items-center gap-2 px-1 text-secondary text-sm">
              <Spinner size={14} /> Muse is drafting a message
            </span>
          ) : (
            <Button
              variant={stop.viewerGoing ? "soft" : "secondary"}
              size="sm"
              icon={<MessageCircle size={16} aria-hidden />}
              onClick={ask}
            >
              Message {going.length === 1 ? names[0] : "them"}
            </Button>
          )}
        </div>
      )}
      {job?.status === "failed" && !stop.draftId && (
        <p className="mt-2 text-secondary text-sm">
          Muse couldn't draft that: {job.error ?? "try again"}.
        </p>
      )}
      {going.length > 0 && !stop.draftId && !drafting && (
        <p className="mt-2 text-secondary text-xs">
          Muse drafts it for you to review. Nothing is sent until you approve it in your Inbox.
        </p>
      )}
    </div>
  );
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong";
}

/* ---------- Past weeks ---------- */

function PastWeeks({ currentWeekOf }: { currentWeekOf: string | null }) {
  const weeks = useQ(api.journeys.pastWeeks, {});
  const past = weeks?.filter((w) => w.weekOf !== currentWeekOf) ?? [];
  if (past.length === 0) return null;
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[17px] text-primary leading-5">Past weeks</h2>
      <ol className="mt-1 flex flex-col divide-y divide-divider">
        {past.map((w) => (
          <li key={w._id} className="flex gap-3 py-3 last:pb-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
              <CalendarDays size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[15px] text-primary leading-5">
                Week {w.week}
                <span className="font-normal text-secondary"> · {weekendLabel(w.startsAt)}</span>
              </p>
              <p className="mt-0.5 text-secondary text-sm leading-[18px]">
                {w.stops.length === 0
                  ? "No plans that weekend"
                  : w.stops.map((s, i) => (
                      <span key={s.key}>
                        {i > 0 && ", "}
                        {s.eventId ? (
                          <Link {...toEvent(s.eventId)} className="text-primary hover:underline">
                            {s.name}
                          </Link>
                        ) : (
                          s.name
                        )}
                      </span>
                    ))}
              </p>
              {w.checkIn && <WeekActivity activity={w.checkIn} />}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------- Shared ---------- */

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { to: "/landing/welcome" | "/landing/profile" | "/landing/crew"; label: string };
}) {
  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-[17px] text-primary leading-5">{title}</h2>
        <p className="mt-0.5 text-[15px] text-secondary leading-5">{body}</p>
      </div>
      {action && (
        <Link
          to={action.to}
          className="flex h-9 shrink-0 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
        >
          {action.label}
        </Link>
      )}
    </Card>
  );
}

function Loading(): ReactNode {
  return (
    <>
      <Card className="space-y-3 p-4" aria-busy>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-1.5 w-full" />
      </Card>
      <Card className="space-y-3 p-4" aria-busy>
        <Skeleton className="h-[240px] w-full" />
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
      </Card>
    </>
  );
}
