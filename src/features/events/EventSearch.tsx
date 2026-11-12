import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useQ } from "@/app/viewer";
import { ListGlyph, PeopleGlyph, PinGlyph } from "@/features/misc/glyphs";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
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
      <Link
        to="/events"
        className="mx-4 mt-4 self-start text-[15px] text-primary leading-5 hover:underline"
      >
        Events
      </Link>
      <h1 className="px-4 font-bold text-[24px] text-primary leading-7">Search Results</h1>
      <form
        className="mx-4 mt-2.5 mb-[23px]"
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
      <div className="flex flex-col px-2">
        <FilterRow icon={<CalendarGridIcon />}>
          <FilterMenu
            label="Dates"
            aria="Filter by Dates"
            value={date === "any" ? undefined : DATE_LABELS[date]}
            options={(Object.keys(DATE_LABELS) as DateRange[]).map((k) => ({
              key: k,
              label: k === "any" ? "Anytime" : DATE_LABELS[k],
              active: k === date,
              onSelect: () => setDate(k),
            }))}
          />
        </FilterRow>
        <FilterRow icon={<PinGlyph />}>
          <label className="relative flex h-[37px] w-full items-center rounded-md hover:bg-hover focus-within:bg-hover">
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Location"
              aria-label="Location"
              className="h-full w-full bg-transparent pr-8 pl-2 text-[15px] text-primary outline-none placeholder:text-primary"
            />
            <span className="pointer-events-none absolute right-3 text-icon-secondary">
              <Caret />
            </span>
          </label>
        </FilterRow>
        <FilterRow icon={<ListGlyph />}>
          <FilterMenu
            label="Categories"
            aria="Filter by Categories"
            value={category}
            options={[
              {
                key: "",
                label: "Any category",
                active: !category,
                onSelect: () =>
                  void navigate({
                    to: "/events/search",
                    search: { q: q === category ? "" : q },
                  }),
              },
              ...CATEGORIES.map((c) => ({
                key: c.name,
                label: c.name,
                active: c.name === category,
                onSelect: () =>
                  void navigate({ to: "/events/search", search: { q: c.name, category: c.name } }),
              })),
            ]}
          />
        </FilterRow>
        <FilterRow icon={<PeopleGlyph />} className="min-h-[68px]">
          <button
            type="button"
            role="switch"
            aria-checked={friends}
            aria-label="Popular with friends"
            onClick={() => setFriends((f) => !f)}
            className="flex h-[37px] w-full items-center justify-between rounded-md pr-2 pl-2 text-left hover:bg-hover"
          >
            <span className="text-[15px] text-primary">Popular with friends</span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                friends ? "bg-accent" : "bg-[#8f9297]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.5)] transition-[left]",
                  friends ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        </FilterRow>
      </div>
    </RailShell>
  );

  return (
    <ToastProvider>
      <EventsLayout rail={rail}>
        <div className="mx-auto flex max-w-[712px] flex-col gap-4 px-4 pt-8 pb-10">
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
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[60px] items-center gap-2 px-2", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Caret() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M10 14a1 1 0 0 1-.755-.349L5.329 9.182a1.367 1.367 0 0 1-.205-1.46A1.184 1.184 0 0 1 6.2 7h7.6a1.18 1.18 0 0 1 1.074.721 1.357 1.357 0 0 1-.2 1.457l-3.918 4.474A1 1 0 0 1 10 14z" />
    </svg>
  );
}

/** Collapsed "label ▾" row that opens a listbox (Facebook's rail comboboxes). */
function FilterMenu({
  label,
  aria,
  value,
  options,
}: {
  label: string;
  aria: string;
  value?: string;
  options: { key: string; label: string; active: boolean; onSelect: () => void }[];
}) {
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`${aria}: ${value ?? (label === "Dates" ? "Anytime" : "Any category")}`}
          className="flex h-[37px] w-full items-center justify-between rounded-md pr-3 pl-2 text-left hover:bg-hover data-[state=open]:bg-hover"
        >
          <span
            className={cn("truncate text-[15px] text-primary leading-5", value && "font-semibold")}
          >
            {value ?? label}
          </span>
          <span className="shrink-0 text-icon-secondary">
            <Caret />
          </span>
        </button>
      </MenuTrigger>
      <MenuContent width={284} align="start" className="max-h-[360px] overflow-y-auto">
        {options.map((o) => (
          <MenuItem
            key={o.key}
            label={<span className={cn(o.active && "text-link")}>{o.label}</span>}
            onSelect={o.onSelect}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}
