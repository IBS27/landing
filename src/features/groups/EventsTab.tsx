import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Check, Star } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Button, Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { isMember, useGroup } from "./context";
import { CalendarGlyph } from "./icons";

type GroupEvent = FunctionReturnType<typeof api.groups.events>["upcoming"][number];

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "SAT, NOV 15 AT 7:00 PM" */
export function eventDate(ts: number) {
  const parts = dateFmt.formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")}`.toUpperCase();
}

/** Events: upcoming and past events hosted in the group. */
export function EventsTab() {
  const group = useGroup();
  const data = useQ(api.groups.events, { groupId: group._id });
  const [showPast, setShowPast] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
      <Card className="rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[20px] text-primary">Upcoming events</h2>
          {isMember(group) && (
            <Link
              to="/events/create"
              search={{ group: group._id }}
              className="flex h-9 items-center rounded-md bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125"
            >
              Create event
            </Link>
          )}
        </div>
        {data === undefined ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data.upcoming.length === 0 ? (
          <EmptyState icon={<CalendarGlyph size={40} />} title="No upcoming events" />
        ) : (
          <div className="mt-2 flex flex-col">
            {data.upcoming.map((e) => (
              <EventRow key={e._id} e={e} />
            ))}
          </div>
        )}
      </Card>
      {data && data.past.length > 0 && (
        <Card className="rounded-xl p-4">
          <h2 className="font-bold text-[20px] text-primary">Past events</h2>
          <div className="mt-2 flex flex-col">
            {(showPast ? data.past : data.past.slice(0, 3)).map((e) => (
              <EventRow key={e._id} e={e} past />
            ))}
          </div>
          {data.past.length > 3 && (
            <Button
              variant="secondary"
              block
              className="mt-3"
              onClick={() => setShowPast((s) => !s)}
            >
              {showPast ? "See less" : "See all"}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

function EventRow({ e, past }: { e: GroupEvent; past?: boolean }) {
  const respond = useM(api.events.respond);
  const interested = e.viewerStatus === "interested";
  const going = e.viewerStatus === "going";
  return (
    <div className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-hover">
      <Link to="/events/$eventId" params={{ eventId: e._id }} className="shrink-0">
        <img src={e.cover} alt="" className="h-[68px] w-[120px] rounded-lg object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[13px] text-[#E41E3F] dark:text-[#F3425F]">
          {eventDate(e.startAt)}
        </p>
        <Link
          to="/events/$eventId"
          params={{ eventId: e._id }}
          className="line-clamp-2 font-semibold text-[17px] text-primary leading-[22px] hover:underline"
        >
          {e.title}
        </Link>
        <p className="truncate text-[13px] text-secondary">
          {e.online ? "Online" : [e.venue, e.city].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[13px] text-secondary">
          {e.interested.toLocaleString("en-US")} interested · {e.going.toLocaleString("en-US")}{" "}
          going
        </p>
      </div>
      {!past && (
        <Button
          variant={interested || going ? "soft" : "secondary"}
          icon={
            going ? (
              <Check size={16} strokeWidth={3} />
            ) : (
              <Star size={16} fill={interested ? "currentColor" : "none"} />
            )
          }
          onClick={() =>
            void respond({ eventId: e._id, status: interested || going ? "none" : "interested" })
          }
        >
          {going ? "Going" : "Interested"}
        </Button>
      )}
    </div>
  );
}
