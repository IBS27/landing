import { Link, type LinkOptions } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  BellRing,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Inbox,
  MessageCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { toEvent, toInbox, toJourneys } from "@/landing/links";
import { Card, CountBadge } from "@/ui/primitives";
import type { api } from "../../../convex/_generated/api";

type ComingUpData = FunctionReturnType<typeof api.home.timeline>["comingUp"];

const TZ = "America/Los_Angeles";
const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const time = (t: number) => TIME.format(t).replace(":00", "");

function Row({
  icon,
  title,
  meta,
  trailing,
  link,
}: {
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  trailing?: ReactNode;
  link: LinkOptions;
}) {
  return (
    <li className="px-2">
      <Link
        {...link}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[15px] text-primary leading-5">{title}</span>
          {meta && <span className="block text-[13px] text-secondary leading-4">{meta}</span>}
        </span>
        {trailing ?? (
          <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
        )}
      </Link>
    </li>
  );
}

/** When the day-of reminder (#134) goes out, while it's still ahead. */
function Reminder({
  via,
  remindAt,
  now,
}: {
  via: "notification" | "chat";
  remindAt: number;
  now: number;
}) {
  if (via === "chat")
    return (
      <span className="mt-0.5 flex items-center gap-1">
        <MessageCircle size={12} aria-hidden /> Reminder in the plan's chat
      </span>
    );
  if (remindAt <= now) return null;
  return (
    <span className="mt-0.5 flex items-center gap-1">
      <BellRing size={12} aria-hidden /> Reminder {DAY.format(remindAt)} at {time(remindAt)}
    </span>
  );
}

const roundIcon = (node: ReactNode) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
    {node}
  </span>
);

/**
 * "Coming up": Events the person is going to this week (with when the day-of
 * reminder goes out), this week's check-in, and Muse drafts waiting in the
 * Landing Inbox.
 */
export function ComingUp({ data, now }: { data: ComingUpData; now: number }) {
  // The query reruns when data changes, not as time passes: drop Events that started since.
  const events = data.events.filter((e) => e.startAt > now);
  const empty = events.length === 0 && !data.checkIn && !data.drafts;
  return (
    <Card className="py-2">
      <h2 className="px-4 pt-1 pb-1 font-bold text-[17px] text-primary leading-5">Coming up</h2>
      {empty ? (
        <p className="flex items-start gap-2 px-4 pt-1 pb-2 text-[15px] text-secondary leading-5">
          <CalendarDays size={18} className="mt-px shrink-0 text-icon-secondary" aria-hidden />
          Nothing this week. Events you're going to, check-ins and drafts waiting for your OK show
          up here.
        </p>
      ) : (
        <ul>
          {data.drafts && (
            <Row
              link={toInbox()}
              icon={roundIcon(<Inbox size={20} aria-hidden />)}
              title={data.drafts.text}
              meta="Nothing is sent until you approve it"
              trailing={<CountBadge count={data.drafts.count} />}
            />
          )}
          {data.checkIn && (
            <Row
              link={toJourneys()}
              icon={roundIcon(<CalendarCheck size={20} aria-hidden />)}
              title={`Week ${data.checkIn.week} check-in`}
              meta={data.checkIn.text}
            />
          )}
          {events.map((e) => (
            <Row
              key={e._id}
              link={toEvent(e._id)}
              icon={
                <img
                  src={e.cover}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg bg-btn object-cover"
                />
              }
              title={e.title}
              meta={
                <>
                  <span className="block truncate">
                    {DAY.format(e.startAt)} · {time(e.startAt)}
                    {e.online ? " · Online" : e.venue ? ` · ${e.venue}` : ""}
                  </span>
                  <Reminder via={e.via} remindAt={e.remindAt} now={now} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
