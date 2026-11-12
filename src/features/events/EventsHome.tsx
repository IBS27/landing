import { CalendarDays, Check, ChevronDown, MapPin } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import { ToastProvider } from "./EventActions";
import { EventCard, EventCardSkeleton } from "./EventCard";
import { EventsLayout, EventsRail } from "./EventsRail";
import { DATE_LABELS, type DateRange, rangeFor, todayStart } from "./format";

type Pill = "top" | "friends" | "following";
const PILLS: { value: Pill; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "friends", label: "Friends" },
  { value: "following", label: "Following" },
];

type Loc = "any" | "local" | "online";
const LOC_LABELS: Record<Loc, string> = {
  any: "My location",
  local: "San Francisco, California",
  online: "Online events",
};

/** /events — "Discover events". */
export function EventsHome() {
  const [pill, setPill] = useState<Pill>("top");
  const [date, setDate] = useState<DateRange>("any");
  const [loc, setLoc] = useState<Loc>("any");
  const day = todayStart();
  const range = useMemo(() => rangeFor(date, day), [date, day]);
  const events = useQ(api.events.discover, {
    filter: pill,
    location: loc === "any" ? undefined : loc,
    ...range,
  });

  return (
    <ToastProvider>
      <EventsLayout rail={<EventsRail section="home" />}>
        <div className="px-4 pt-4 pb-10 min-[900px]:px-[44px]">
          <section className="mx-auto max-w-[992px] rounded-xl border border-divider bg-card p-[25px] pt-[18px]">
            <h2 className="font-bold text-[24px] text-primary leading-7">Discover events</h2>
            <div className="mt-[14px] mb-4 flex flex-wrap items-center gap-2">
              <Dropdown
                icon={
                  <MapPin size={18} strokeWidth={2.4} fill="currentColor" stroke="var(--card)" />
                }
                label={LOC_LABELS[loc]}
              >
                {(Object.keys(LOC_LABELS) as Loc[]).map((k) => (
                  <MenuItem
                    key={k}
                    label={LOC_LABELS[k]}
                    icon={loc === k ? <Check size={18} /> : <span />}
                    onSelect={() => setLoc(k)}
                  />
                ))}
              </Dropdown>
              <Dropdown
                icon={<CalendarDays size={18} strokeWidth={2.2} />}
                label={DATE_LABELS[date]}
              >
                {(Object.keys(DATE_LABELS) as DateRange[]).map((k) => (
                  <MenuItem
                    key={k}
                    label={DATE_LABELS[k]}
                    icon={date === k ? <Check size={18} /> : <span />}
                    onSelect={() => setDate(k)}
                  />
                ))}
              </Dropdown>
              <span className="w-1" />
              {PILLS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={pill === p.value}
                  onClick={() => setPill(p.value)}
                  className={cn(
                    "h-9 rounded-full px-3 font-semibold text-[15px] transition-[filter] hover:brightness-95 dark:hover:brightness-125",
                    pill === p.value ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-btn-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {events === undefined ? (
              <Grid>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </Grid>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <CalendarDays size={56} strokeWidth={1.4} className="text-secondary" />
                <p className="mt-3 font-bold text-[20px] text-secondary leading-6">No events</p>
                <p className="mt-1 max-w-sm text-[15px] text-secondary">
                  Try a different filter or date to discover more events.
                </p>
              </div>
            ) : (
              <Grid>
                {events.map((e) => (
                  <EventCard key={e._id} event={e} />
                ))}
              </Grid>
            )}
          </section>
        </div>
      </EventsLayout>
    </ToastProvider>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-[14px] gap-y-[19px] px-[3px] md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

function Dropdown({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 data-[state=open]:bg-btn-soft data-[state=open]:text-btn-soft-text dark:hover:brightness-125"
        >
          {icon}
          {label}
          <ChevronDown size={18} strokeWidth={2.4} className="ml-1" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" width={260}>
        {children}
      </MenuContent>
    </Menu>
  );
}
