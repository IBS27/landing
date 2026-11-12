import { useNavigate } from "@tanstack/react-router";
import { useM, useQ } from "@/app/viewer";
import { BellIcon } from "@/icons";
import { cn, shortAge } from "@/lib/format";
import { Avatar, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { EventsLayout, EventsRail } from "./EventsRail";
import { hideBroken } from "./format";

/** /events/notifications — invitations, responses and reminders for events. */
export function EventNotifications() {
  const items = useQ(api.events.notifications, {});
  const setRead = useM(api.notifications.setRead);
  const navigate = useNavigate();
  return (
    <EventsLayout rail={<EventsRail section="notifications" />}>
      <div className="mx-auto max-w-[680px] px-4 pt-4 pb-10">
        <Card className="rounded-xl p-2">
          <h2 className="px-2 pt-2 pb-2 font-bold text-[24px] text-primary leading-7">
            Notifications
          </h2>
          {items === undefined ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center text-secondary">
              <BellIcon size={48} />
              <p className="mt-3 font-bold text-[20px] leading-6">No event notifications</p>
              <p className="mt-1 text-[15px]">
                Invitations and updates about events will appear here.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => {
                  if (!n.read) void setRead({ id: n._id, read: true });
                  void navigate({ to: "/events/$eventId", params: { eventId: n.event._id } });
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
              >
                <span className="relative shrink-0">
                  {n.actor ? (
                    <Avatar src={n.actor.avatar} size={56} />
                  ) : (
                    <img
                      src={n.event.cover}
                      onError={hideBroken}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  )}
                  <span className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-[#f3425f] text-white">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
                      <path d="M4.5 1a.75.75 0 0 1 .75.75V2.5h5.5v-.75a.75.75 0 0 1 1.5 0v.75h.25A2.5 2.5 0 0 1 15 5v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a2.5 2.5 0 0 1 2.5-2.5h.25v-.75A.75.75 0 0 1 4.5 1ZM2.5 7v5.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7h-11Z" />
                    </svg>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[15px] leading-5",
                      n.read ? "text-secondary" : "text-primary",
                    )}
                  >
                    {n.actor && <span className="font-semibold text-primary">{n.actor.name} </span>}
                    {n.text}
                  </span>
                  <span
                    className={cn(
                      "block text-[13px]",
                      n.read ? "text-secondary" : "font-semibold text-fb",
                    )}
                  >
                    {shortAge(n.createdAt)}
                  </span>
                </span>
                {!n.read && <span className="h-3 w-3 shrink-0 rounded-full bg-fb" />}
              </button>
            ))
          )}
        </Card>
      </div>
    </EventsLayout>
  );
}
