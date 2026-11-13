import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarCheck,
  Check,
  ChevronRight,
  Lock,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import { useQ } from "@/app/viewer";
import { toEvent, toGroup, toProfile } from "@/landing/links";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { PopoverPanel } from "@/ui/overlays";
import { Avatar, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { ActivityView } from "../../../convex/checkIns";

export type CheckIn = NonNullable<FunctionReturnType<typeof api.checkIns.current>>;
type Level = CheckIn["level"];

/** `LEVELS` in convex/lib/checkIns.ts (server-only), for the progress bar and the rule. */
const LEVELS = [
  { id: "explore", label: "Explore", rule: "from move-in day" },
  { id: "regular", label: "Regular", rule: "a month in, with 2 things done" },
  { id: "local", label: "Local", rule: "in month 3, with 6 things done" },
] as const;

const TZ = "America/Los_Angeles";
const eventDay = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1 event, 2 new friends". Empty when nothing counts. */
function countsText(a: Pick<ActivityView, "events" | "groups" | "friends">) {
  return [
    a.events.length && plural(a.events.length, "event", "events"),
    a.groups.length && plural(a.groups.length, "Group", "Groups"),
    a.friends.length && plural(a.friends.length, "new friend", "new friends"),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Landing → Crew & Journeys → Journeys: the weekly check-in (#33). What you
 * did since move-in (each count opens the Events, Groups and people behind
 * it), this week and last, your level and what the next one needs, and one
 * thing to try this weekend. Private to you.
 */
export function CheckInCard() {
  const data = useQ(api.checkIns.current, {});
  if (data === undefined) return <CheckInSkeleton />;
  if (data === null) return null;
  return <CheckInView data={data} />;
}

export function CheckInView({ data }: { data: CheckIn }) {
  const titleId = useId();
  const weeks = Math.floor(data.days / 7);
  return (
    <Card className="overflow-hidden" aria-labelledby={titleId}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4">
        <div className="min-w-0">
          <h2 id={titleId} className="font-bold text-[17px] text-primary leading-5">
            {weeks < 1 ? "Your first week" : `${plural(weeks, "week", "weeks")} in`}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-secondary text-sm leading-4">
            <Lock size={12} className="shrink-0" aria-hidden />
            Your check-in. Only you can see it.
          </p>
        </div>
        <LevelChip level={data.level} />
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2 px-4">
        <Stat
          n={data.total.events.length}
          label={data.total.events.length === 1 ? "event" : "events"}
          icon={<CalendarCheck size={16} aria-hidden />}
          title="Events you went to"
        >
          {data.total.events.map((e) => (
            <ItemRow
              key={e._id}
              link={toEvent(e._id)}
              title={e.title}
              meta={`${eventDay.format(e.startAt)}${data.total.journeyStops.includes(e._id) ? ", on your Journey" : ""}`}
              icon={<CalendarCheck size={16} aria-hidden />}
            />
          ))}
        </Stat>
        <Stat
          n={data.total.groups.length}
          label={data.total.groups.length === 1 ? "Group" : "Groups"}
          icon={<UsersRound size={16} aria-hidden />}
          title="Groups you joined"
        >
          {data.total.groups.map((g) => (
            <ItemRow
              key={g._id}
              link={toGroup({ slug: g.slug })}
              title={g.name}
              icon={<UsersRound size={16} aria-hidden />}
            />
          ))}
        </Stat>
        <Stat
          n={data.total.friends.length}
          label={data.total.friends.length === 1 ? "new friend" : "new friends"}
          icon={<UserPlus size={16} aria-hidden />}
          title="New friends since you moved"
        >
          {data.total.friends.map((f) => (
            <ItemRow
              key={f._id}
              link={toProfile(f)}
              title={f.name}
              icon={<Avatar src={f.avatar} alt="" size={28} />}
            />
          ))}
        </Stat>
      </div>
      {data.total.journeyStops.length > 0 && (
        <p className="mt-2 px-4 text-secondary text-sm">
          {plural(data.total.journeyStops.length, "event was", "events were")} on your Journeys.
        </p>
      )}

      <dl className="mt-3 grid gap-1 px-4 text-[15px] leading-5">
        {data.thisWeek && (
          <WeekLine label="This week so far" activity={data.thisWeek} empty="Nothing yet" />
        )}
        {data.lastWeek && (
          <WeekLine
            label={
              data.thisWeek && data.thisWeek.week !== data.lastWeek.week + 1
                ? `Week ${data.lastWeek.week}`
                : "Last week"
            }
            activity={data.lastWeek}
            empty="A quiet week, and that's fine"
          />
        )}
      </dl>

      <LevelProgress level={data.level} />

      {data.suggestion && <Suggestion s={data.suggestion} />}
    </Card>
  );
}

/* ---------- Counts ---------- */

/** A total that opens the list of what's behind it. */
function Stat({
  n,
  label,
  icon,
  title,
  children,
}: {
  n: number;
  label: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="font-bold text-[24px] text-primary tabular-nums leading-7">{n}</span>
      <span className="flex min-w-0 max-w-full items-center gap-1 text-secondary text-sm leading-4 [&>svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
    </>
  );
  const tile = "flex min-w-0 flex-col items-start gap-1 rounded-lg bg-comment px-3 py-2.5";
  if (n === 0) return <div className={tile}>{body}</div>;
  return (
    <PopoverPanel
      align="start"
      width={320}
      trigger={
        <button
          type="button"
          aria-label={`${n} ${label}: see which`}
          className={cn(tile, "text-left transition-colors hover:bg-hover active:scale-[0.98]")}
        >
          {body}
        </button>
      }
    >
      <p className="px-4 pt-3 pb-1 font-bold text-[17px] text-primary">{title}</p>
      <ul className="max-h-[320px] overflow-y-auto p-2">{children}</ul>
    </PopoverPanel>
  );
}

function ItemRow({
  link,
  title,
  meta,
  icon,
}: {
  link: ReturnType<typeof toEvent> | ReturnType<typeof toGroup> | ReturnType<typeof toProfile>;
  title: string;
  meta?: string;
  icon: ReactNode;
}) {
  return (
    <li>
      <Link
        {...link}
        className="flex items-center gap-3 rounded-md px-2 py-2 text-primary hover:bg-hover"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-secondary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[15px]">{title}</span>
          {meta && <span className="block text-secondary text-xs">{meta}</span>}
        </span>
      </Link>
    </li>
  );
}

function WeekLine({
  label,
  activity,
  empty,
}: {
  label: string;
  activity: ActivityView;
  empty: string;
}) {
  const text = countsText(activity);
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-semibold text-primary">{label}:</dt>
      <dd className={text ? "text-primary" : "text-secondary"}>{text || empty}</dd>
    </div>
  );
}

/* ---------- Level ---------- */

function LevelChip({ level }: { level: Level }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-btn-soft px-3 font-semibold text-btn-soft-text text-sm">
      <Sparkles size={14} aria-hidden />
      {level.label}
    </span>
  );
}

/** What the next level still needs, in plain words. */
function nextText(next: NonNullable<Level["next"]>) {
  const more =
    next.moreNeeded > 0 &&
    `${plural(next.moreNeeded, "more event, Group or new friend", "more events, Groups or new friends")}`;
  if (next.daysLeft > 0 && more)
    return `${next.label} in ${plural(next.daysLeft, "day", "days")}, after ${more}.`;
  if (next.daysLeft > 0) return `${next.label} in ${plural(next.daysLeft, "day", "days")}.`;
  return `${next.label} after ${more}.`;
}

function LevelProgress({ level }: { level: Level }) {
  return (
    <section className="mx-4 mt-4 border-divider border-t pt-3" aria-label="Your level">
      <ol className="grid grid-cols-3 gap-1">
        {LEVELS.map((l, i) => (
          <li key={l.id} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full", i < level.rank ? "bg-fb" : "bg-btn")} />
            <span
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs",
                i + 1 === level.rank ? "font-semibold text-primary" : "text-secondary",
              )}
            >
              {i < level.rank - 1 && <Check size={12} aria-hidden />}
              {l.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[15px] text-primary leading-5">
        {level.next ? nextText(level.next) : "You're a Local. Welcome home."}
      </p>
      <details className="group mt-1">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-secondary text-sm hover:underline">
          How levels work
          <ChevronRight
            size={14}
            className="transition-transform group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <p className="mt-1 text-secondary text-sm leading-[18px]">
          {LEVELS.map((l) => `${l.label} ${l.rule}`).join(". ")}. Things done are Events you went
          to, Groups you joined and new friends. No streaks or rankings, and nobody else sees your
          level.
        </p>
      </details>
    </section>
  );
}

/* ---------- What to try next ---------- */

function Suggestion({ s }: { s: NonNullable<CheckIn["suggestion"]> }) {
  return (
    <section
      className="mx-4 mt-3 mb-4 rounded-lg bg-comment px-3 py-3"
      aria-label="Try this weekend"
    >
      <p className="flex items-start gap-2 text-[15px] text-primary leading-5">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-fb" aria-hidden />
        <span>{s.text}</span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
        {s.event &&
          (s.event.viewerGoing ? (
            <Link
              {...toEvent(s.event._id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-btn-soft px-3 font-semibold text-btn-soft-text text-sm"
            >
              <Check size={16} aria-hidden />
              You're going
            </Link>
          ) : (
            <Link
              {...toEvent(s.event._id)}
              className="inline-flex h-8 items-center rounded-md bg-btn-primary px-3 font-semibold text-sm text-white hover:bg-btn-primary-hover"
            >
              See event
            </Link>
          ))}
        {!s.event && s.group && (
          <Link
            {...toGroup({ slug: s.group.slug })}
            className="inline-flex h-8 items-center rounded-md bg-btn-primary px-3 font-semibold text-sm text-white hover:bg-btn-primary-hover"
          >
            Open {s.group.name}
          </Link>
        )}
        <SourcesChip sources={s.sources} />
        {s.via === "model" && <span className="text-secondary text-xs">Written by Muse</span>}
      </div>
    </section>
  );
}

function CheckInSkeleton() {
  return (
    <Card className="space-y-3 p-4" aria-busy>
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[62px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-1.5 w-full" />
    </Card>
  );
}

/** What they did that week (#33), each linking to the Event, Group or person. */
export function WeekActivity({ activity }: { activity: ActivityView }) {
  const items = [
    ...activity.events.map((e) => ({
      key: e._id,
      link: toEvent(e._id),
      label: e.title,
      icon: <CalendarCheck size={12} aria-hidden />,
    })),
    ...activity.groups.map((g) => ({
      key: g._id,
      link: toGroup({ slug: g.slug }),
      label: `Joined ${g.name}`,
      icon: <UsersRound size={12} aria-hidden />,
    })),
    ...activity.friends.map((f) => ({
      key: f._id,
      link: toProfile(f),
      label: `Friends with ${f.firstName}`,
      icon: <UserPlus size={12} aria-hidden />,
    })),
  ];
  if (items.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="What you did that week">
      {items.map((i) => (
        <li key={i.key} className="min-w-0 max-w-full">
          <Link
            {...i.link}
            className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-btn px-2 font-semibold text-primary text-xs hover:bg-hover"
          >
            {i.icon}
            <span className="truncate">{i.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
