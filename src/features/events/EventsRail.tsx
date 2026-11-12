import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQ } from "@/app/viewer";
import { RailDivider, RailHeading, RailItem } from "@/features/feed/SideRail";
import {
  CATEGORY_GLYPH_CLASS,
  CalendarGridGlyph,
  EVENT_CATEGORY_GLYPHS,
  GiftGlyph,
  PersonGlyph,
} from "@/features/misc/glyphs";
import { BellFilled } from "@/features/misc/icons";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { hideBroken, relativeDate } from "./format";

export const CATEGORIES: { name: string }[] = Object.keys(EVENT_CATEGORY_GLYPHS).map((name) => ({
  name,
}));

/** Facebook's filled calendar-grid glyph (Events "Home"). */
export const CalendarGridIcon = CalendarGridGlyph;
export const PersonIcon = PersonGlyph;

function CategoryGlyph({ name }: { name: string }) {
  const G = EVENT_CATEGORY_GLYPHS[name];
  return G ? <G className={CATEGORY_GLYPH_CLASS} /> : null;
}

export type RailSection = "home" | "yours" | "birthdays" | "notifications" | "none";
export type YoursTab = "going" | "interested" | "invitations" | "hosting" | "past";

export const YOURS_TABS: { tab: YoursTab; label: string }[] = [
  { tab: "going", label: "Going" },
  { tab: "invitations", label: "Invitations" },
  { tab: "interested", label: "Interested" },
  { tab: "hosting", label: "Hosting" },
  { tab: "past", label: "Past events" },
];

/** Shell for every Events page: 360px white rail + grey main area. */
export function EventsLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      {rail}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export function RailShell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col overflow-y-auto bg-card shadow-[1px_0_0_var(--shadow-1)] min-[900px]:flex",
        className,
      )}
    >
      {children}
    </nav>
  );
}

export function RailSearch({
  value,
  placeholder = "Search events",
}: {
  value?: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(value ?? "");
  return (
    <form
      className="mx-4 mt-2 mb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) void navigate({ to: "/events/search", search: { q: q.trim() } });
      }}
    >
      <label className="flex h-9 items-center gap-1.5 rounded-full bg-input pl-2.5 text-secondary">
        <Search size={16} strokeWidth={2.4} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
      </label>
    </form>
  );
}

/** The Events left rail (home, Your events, birthdays, permalink). */
export function EventsRail({
  section,
  yoursTab,
  recommendedFor,
  label = "Event Dashboard",
}: {
  section: RailSection;
  yoursTab?: YoursTab;
  /** On an event permalink: show "Recommended events" (excluding this one). */
  recommendedFor?: Id<"events">;
  label?: string;
}) {
  const [open, setOpen] = useState(section === "yours");
  const counts = useQ(api.events.yourCounts, {});
  return (
    <RailShell label={label}>
      <h1 className="px-4 pt-[15px] pb-0.5 font-bold text-[24px] text-primary leading-7">Events</h1>
      <RailSearch />
      <div className="flex flex-col px-2">
        <RailItem
          icon={<CalendarGridIcon />}
          label="Home"
          selected={section === "home"}
          to="/events"
        />
        <div className="relative">
          <RailItem
            icon={<PersonIcon />}
            label="Your events"
            selected={section === "yours" && !open}
            to="/events/yours"
            search={{ tab: "going" }}
          />
          <button
            type="button"
            aria-label={open ? "Your events, Collapse button" : "Your events, Expand button"}
            onClick={() => setOpen((o) => !o)}
            className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-hover"
          >
            <ChevronDown
              size={20}
              strokeWidth={2.4}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
        {open &&
          YOURS_TABS.map((t) => (
            <Link
              key={t.tab}
              to="/events/yours"
              search={{ tab: t.tab }}
              className={cn(
                "flex h-11 items-center justify-between rounded-lg pr-3 pl-14 font-medium text-[15px] text-primary",
                section === "yours" && yoursTab === t.tab ? "bg-wash" : "hover:bg-hover",
              )}
            >
              {t.label}
              {t.tab === "invitations" && (counts?.invitations ?? 0) > 0 && (
                <span className="font-normal text-[13px] text-secondary">
                  {counts?.invitations}
                </span>
              )}
            </Link>
          ))}
        <RailItem
          icon={<GiftGlyph />}
          label="Birthdays"
          selected={section === "birthdays"}
          to="/events/birthdays"
        />
        <RailItem
          icon={<BellFilled />}
          label="Notifications"
          selected={section === "notifications"}
          to="/events/notifications"
        />
      </div>
      <div className="px-4 pt-3 pb-3">
        <Link
          to="/events/create"
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-btn-primary px-3 font-semibold text-[15px] text-white transition-colors hover:bg-btn-primary-hover active:scale-[0.99]"
        >
          <Plus size={18} strokeWidth={2.6} />
          Create new event
        </Link>
      </div>
      <div className="px-2">
        <RailDivider />
      </div>
      {recommendedFor && <Recommended excludeId={recommendedFor} />}
      <div className="flex flex-col px-2 pb-4">
        <RailHeading>Categories</RailHeading>
        {CATEGORIES.map((c) => (
          <RailItem
            key={c.name}
            icon={<CategoryGlyph name={c.name} />}
            label={c.name}
            to="/events/search"
            search={{ q: c.name, category: c.name }}
          />
        ))}
      </div>
    </RailShell>
  );
}

function Recommended({ excludeId }: { excludeId: Id<"events"> }) {
  const recs = useQ(api.events.recommended, { excludeId, limit: 3 });
  if (!recs || recs.length === 0) return null;
  return (
    <div className="px-2 pb-1">
      <div className="flex items-center justify-between px-2 pt-1 pb-1">
        <h2 className="font-semibold text-[17px] text-primary">Recommended events</h2>
        <Link to="/events" className="rounded px-1 text-[15px] text-link hover:bg-hover">
          See all
        </Link>
      </div>
      {recs.map((e) => (
        <Link
          key={e._id}
          to="/events/$eventId"
          params={{ eventId: e._id }}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
        >
          <img
            src={e.cover}
            onError={hideBroken}
            alt=""
            className="h-14 w-[75px] shrink-0 rounded-lg border border-black/10 object-cover dark:border-white/5"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-negative leading-4">
              {relativeDate(e.startAt, e.endAt)}
            </span>
            <span className="line-clamp-2 font-semibold text-[15px] text-primary leading-5">
              {e.title}
            </span>
          </span>
        </Link>
      ))}
      <RailDivider />
    </div>
  );
}
