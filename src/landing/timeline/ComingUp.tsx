import { Link, type LinkOptions } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { BellRing, CalendarCheck, Inbox, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { toEvent, toInbox, toJourneys } from "@/landing/links";
import { CountBadge } from "@/ui/primitives";
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
    <li>
      <Link {...link} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-hover">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[14px] text-primary leading-[18px]">
            {title}
          </span>
          {meta && <span className="block text-[12px] text-secondary leading-4">{meta}</span>}
        </span>
        {trailing}
      </Link>
    </li>
  );
}

const roundIcon = (node: ReactNode) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
    {node}
  </span>
);

/** When the day-of reminder (#134) goes out, while it's still ahead. */
function Reminder({
  via,
  remindAt,
  startAt,
  now,
}: {
  via: "notification" | "chat";
  remindAt: number;
  startAt: number;
  now: number;
}) {
  if (via === "chat")
    return (
      <span className="flex items-center gap-1">
        <MessageCircle size={11} aria-hidden /> Reminder in the plan's chat
      </span>
    );
  if (remindAt <= now) return null;
  const sameDay = DAY.format(remindAt) === DAY.format(startAt);
  return (
    <span className="flex items-center gap-1">
      <BellRing size={11} aria-hidden /> Reminder {sameDay ? "that day" : DAY.format(remindAt)} at{" "}
      {time(remindAt)}
    </span>
  );
}

/**
 * "Coming up": Muse drafts waiting in the Landing Inbox, this week's
 * check-in, and Events the person is going to this week, with when each
 * day-of reminder goes out.
 */
export function ComingUp({ data, now }: { data: ComingUpData; now: number }) {
  // The query reruns when data changes, not as time passes: drop Events that started since.
  const events = data.events.filter((e) => e.startAt > now);
  return (
    <section className="mt-3" aria-label="Coming up">
      <h3 className="font-semibold text-[13px] text-secondary">Coming up</h3>
      {events.length === 0 && !data.checkIn && !data.drafts ? (
        <p className="mt-1 text-[13px] text-secondary leading-[18px]">
          Nothing this week. Events you're going to, check-ins and drafts waiting for your OK show
          up here.
        </p>
      ) : (
        <ul className="-mx-2 mt-1">
          {data.drafts && (
            <Row
              link={toInbox()}
              icon={roundIcon(<Inbox size={16} aria-hidden />)}
              title={data.drafts.text}
              meta="Nothing is sent until you approve it."
              trailing={<CountBadge count={data.drafts.count} />}
            />
          )}
          {data.checkIn && (
            <Row
              link={toJourneys()}
              icon={roundIcon(<CalendarCheck size={16} aria-hidden />)}
              title="This week's check-in"
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
                  className="h-8 w-8 shrink-0 rounded-lg bg-btn object-cover"
                />
              }
              title={e.title}
              meta={
                <>
                  <span className="block truncate">
                    {DAY.format(e.startAt)} · {time(e.startAt)}
                    {e.online ? " · Online" : e.venue ? ` · ${e.venue}` : ""}
                  </span>
                  <Reminder via={e.via} remindAt={e.remindAt} startAt={e.startAt} now={now} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
