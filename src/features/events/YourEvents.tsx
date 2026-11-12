import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import { ToastProvider } from "./EventActions";
import { EventCard, EventCardSkeleton } from "./EventCard";
import { EventsLayout, EventsRail, YOURS_TABS, type YoursTab } from "./EventsRail";

const EMPTY: Record<YoursTab, { title: string; body: string }> = {
  going: {
    title: "No upcoming events",
    body: "Events you're going to will appear here.",
  },
  interested: {
    title: "No upcoming events",
    body: "Events you're interested in will appear here.",
  },
  invitations: {
    title: "No invitations",
    body: "When friends invite you to events, you'll see them here.",
  },
  hosting: {
    title: "No upcoming events",
    body: "Events you're hosting will appear here.",
  },
  past: { title: "No past events", body: "Events you went to or hosted will appear here." },
};

/** /events/yours?tab= — Going, Invitations, Interested, Hosting, Past. */
export function YourEvents({ tab }: { tab: YoursTab }) {
  const events = useQ(api.events.yours, { tab });
  return (
    <ToastProvider>
      <EventsLayout rail={<EventsRail section="yours" yoursTab={tab} />}>
        <div className="px-4 pt-4 pb-10 min-[900px]:px-[44px]">
          <section className="mx-auto max-w-[992px] rounded-xl border border-divider bg-card p-[25px] pt-[18px]">
            <h2 className="font-bold text-[24px] text-primary leading-7">Your events</h2>
            <div className="mt-[14px] mb-4 flex flex-wrap gap-2" role="tablist">
              {YOURS_TABS.map((t) => (
                <Link
                  key={t.tab}
                  to="/events/yours"
                  search={{ tab: t.tab }}
                  role="tab"
                  aria-selected={t.tab === tab}
                  className={cn(
                    "flex h-9 items-center rounded-full px-3 font-semibold text-[15px] transition-[filter] hover:brightness-95 dark:hover:brightness-125",
                    t.tab === tab ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-btn-text",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
            {events === undefined ? (
              <div className="grid grid-cols-1 gap-x-[14px] gap-y-[19px] px-[3px] md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <CalendarDays size={56} strokeWidth={1.4} className="text-secondary" />
                <p className="mt-3 font-bold text-[20px] text-secondary leading-6">
                  {EMPTY[tab].title}
                </p>
                <p className="mt-1 max-w-sm text-[15px] text-secondary">{EMPTY[tab].body}</p>
                <Link
                  to="/events"
                  className="mt-4 flex h-9 items-center rounded-lg bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text hover:brightness-95"
                >
                  Discover events
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-[14px] gap-y-[19px] px-[3px] md:grid-cols-2 xl:grid-cols-3">
                {events.map((e) => (
                  <EventCard key={e._id} event={e} />
                ))}
              </div>
            )}
          </section>
        </div>
      </EventsLayout>
    </ToastProvider>
  );
}
