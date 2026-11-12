import { Link, useNavigate } from "@tanstack/react-router";
import { List, MapPin, Search, Users } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { ToastProvider } from "./EventActions";
import { EventRow } from "./EventCard";
import { CATEGORIES, CalendarGridIcon, EventsLayout, RailShell } from "./EventsRail";
import { DATE_LABELS, type DateRange, rangeFor, todayStart } from "./format";

/** /events/search?q=&category= — "Search Results" with rail filters. */
export function EventSearch({ q, category }: { q: string; category?: string }) {
  const navigate = useNavigate();
  const [text, setText] = useState(q);
  const [date, setDate] = useState<DateRange>("any");
  const [place, setPlace] = useState("");
  const [friends, setFriends] = useState(false);
  const day = todayStart();
  const range = useMemo(() => rangeFor(date, day), [date, day]);
  const results = useQ(api.events.search, {
    q: q || undefined,
    place: place || undefined,
    category,
    popularWithFriends: friends || undefined,
    ...range,
  });

  const rail = (
    <RailShell label="Events">
      <Link to="/events" className="px-4 pt-[14px] text-[15px] text-primary hover:underline">
        Events
      </Link>
      <h1 className="px-4 font-bold text-[24px] text-primary leading-7">Search Results</h1>
      <form
        className="mx-4 mt-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/events/search", search: { q: text.trim() } });
        }}
      >
        <label className="flex h-9 items-center gap-1.5 rounded-full bg-input pl-2.5 text-secondary">
          <Search size={16} strokeWidth={2.4} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search events"
            aria-label="Search events"
            className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
      </form>
      <div className="flex flex-col gap-1 px-2">
        <FilterRow icon={<CalendarGridIcon />} label="Dates">
          <select
            aria-label="Filter by Dates"
            value={date}
            onChange={(e) => setDate(e.target.value as DateRange)}
            className="h-[37px] w-full rounded-md border border-divider bg-card px-2 text-[15px] text-primary"
          >
            {(Object.keys(DATE_LABELS) as DateRange[]).map((k) => (
              <option key={k} value={k}>
                {k === "any" ? "Anytime" : DATE_LABELS[k]}
              </option>
            ))}
          </select>
        </FilterRow>
        <FilterRow
          icon={<MapPin size={20} fill="currentColor" stroke="var(--secondary-button)" />}
          label="Location"
        >
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Seattle, Washington"
            aria-label="Location"
            className="h-[33px] w-full rounded-lg border border-divider bg-card px-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
          />
        </FilterRow>
        <FilterRow icon={<List size={20} strokeWidth={2.4} />} label="Categories">
          <select
            aria-label="Filter by Categories"
            value={category ?? ""}
            onChange={(e) =>
              void navigate({
                to: "/events/search",
                search: e.target.value
                  ? { q: e.target.value, category: e.target.value }
                  : { q: q === category ? "" : q },
              })
            }
            className="h-[37px] w-full rounded-md border border-divider bg-card px-2 text-[15px] text-primary"
          >
            <option value="">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterRow>
        <div className="flex min-h-[60px] items-center gap-3 rounded-lg px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon">
            <Users size={20} fill="currentColor" />
          </span>
          <span className="flex-1 font-medium text-[15px] text-primary">Popular with friends</span>
          <button
            type="button"
            role="switch"
            aria-checked={friends}
            aria-label="Popular with friends"
            onClick={() => setFriends((f) => !f)}
            className={cn(
              "relative mr-2 h-6 w-11 rounded-full transition-colors",
              friends ? "bg-accent" : "bg-[#8f9297]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.5)] transition-[left]",
                friends ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>
    </RailShell>
  );

  return (
    <ToastProvider>
      <EventsLayout rail={rail}>
        <div className="mx-auto flex max-w-[680px] flex-col gap-2 px-4 pt-8 pb-10">
          {results === undefined ? (
            [0, 1, 2, 3].map((i) => (
              <Card key={i} className="flex items-center gap-3 rounded-xl px-4 py-4">
                <Skeleton className="h-[60px] w-[60px] rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </Card>
            ))
          ) : results.length === 0 ? (
            <Card className="rounded-xl px-6 py-12 text-center">
              <p className="font-bold text-[20px] text-secondary leading-6">No results found</p>
              <p className="mt-1 text-[15px] text-secondary">
                Try different keywords or filters to find events.
              </p>
            </Card>
          ) : (
            results.map((e) => <EventRow key={e._id} event={e} />)
          )}
        </div>
      </EventsLayout>
    </ToastProvider>
  );
}

function FilterRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg px-2 py-2">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon">
          {icon}
        </span>
        <span className="font-medium text-[15px] text-primary">{label}</span>
      </div>
      <div className="mt-2 pl-[44px]">{children}</div>
    </div>
  );
}
