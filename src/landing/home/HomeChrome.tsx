import { Link, type LinkProps } from "@tanstack/react-router";
import {
  Box,
  Building2,
  CalendarDays,
  ChevronLeft,
  CircleUserRound,
  Footprints,
  History,
  House,
  Inbox,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  PackageOpen,
  ReceiptText,
  Scale,
  ScanLine,
  Search,
  ShoppingBag,
  Sofa,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { toCompare, toHome, toLandingPage, toMyPlace, toUnit } from "@/landing/links";
import type { PinKind } from "@/landing/map/types";
import { cn } from "@/lib/format";
import { PopoverPanel } from "@/ui/overlays";
import type { ChatSession } from "./useChatLog";

/**
 * Landing Home's controls over the stage: the Map and Apartment tabs, the
 * map's breadcrumb and layer chips, the "Explore" menu of Landing's pages,
 * and the past-chats panel. All glass over the map (`home.css`).
 */

export type HomeView = "map" | "apartment";
const VIEWS = [
  { view: "map", label: "Map" },
  { view: "apartment", label: "Apartment" },
] as const satisfies readonly { view: HomeView; label: string }[];

/** The element ids of the two tab panels, for `aria-controls`. */
export const PANEL_ID: Record<HomeView, string> = {
  map: "lh-panel-map",
  apartment: "lh-panel-apartment",
};
const tabId = (v: HomeView) => `lh-tab-${v}`;

/** Map or Apartment: two views of the same move, with one chat under both. */
export function HomeTabs({
  view,
  onChange,
  building,
}: {
  view: HomeView;
  onChange: (v: HomeView) => void;
  /** The apartment's 3D model is being built: a dot on its tab. */
  building: boolean;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const at = VIEWS.findIndex((t) => t.view === view);
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (at + 1) % VIEWS.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (at + VIEWS.length - 1) % VIEWS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? VIEWS.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(VIEWS[to].view);
    tabs.current?.querySelector<HTMLElement>(`#${tabId(VIEWS[to].view)}`)?.focus();
  };
  return (
    <div
      ref={tabs}
      role="tablist"
      aria-label="View"
      className="lh-tabs lh-glass"
      onKeyDown={onKeyDown}
    >
      {VIEWS.map(({ view: v, label }) => (
        <button
          key={v}
          type="button"
          role="tab"
          id={tabId(v)}
          aria-selected={view === v}
          aria-controls={PANEL_ID[v]}
          tabIndex={view === v ? 0 : -1}
          onClick={() => onChange(v)}
          className="lh-tab lh-focus"
        >
          {v === "map" ? <MapIcon size={15} aria-hidden /> : <Box size={15} aria-hidden />}
          {label}
          {v === "apartment" && building && (
            <>
              <span className="lh-building-dot" aria-hidden />
              <span className="sr-only">, building its 3D model</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Map: breadcrumb and layers ───────────── */

export type Crumb = { label: string; run: () => void };

/** World / Bay Area / Mission. Narrow stages show the current level and a way up. */
export function Breadcrumb({ crumbs }: { crumbs: readonly Crumb[] }) {
  const last = crumbs[crumbs.length - 1];
  const up = crumbs[crumbs.length - 2];
  if (!last) return null;
  return (
    <nav aria-label="Where the map is" className="lh-crumbs lh-glass">
      <span className="lh-crumbs-full">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex min-w-0 items-center">
            {i > 0 && (
              <span className="mx-0.5 text-disabled" aria-hidden>
                /
              </span>
            )}
            <button
              type="button"
              onClick={c.run}
              aria-current={c === last ? "location" : undefined}
              className={cn(
                "lh-focus truncate rounded-full px-1.5 py-0.5",
                c === last ? "font-semibold text-primary" : "text-secondary hover:text-primary",
              )}
            >
              {c.label}
            </button>
          </span>
        ))}
      </span>
      <span className="lh-crumbs-short">
        {up && (
          <button
            type="button"
            onClick={up.run}
            aria-label={`Back to ${up.label}`}
            className="lh-focus -ml-1 flex h-6 w-6 items-center justify-center rounded-full text-secondary hover:text-primary"
          >
            <ChevronLeft size={16} strokeWidth={2.4} />
          </button>
        )}
        <button
          type="button"
          onClick={last.run}
          className="lh-focus truncate rounded-full px-1 py-0.5 font-semibold text-primary"
        >
          {last.label}
        </button>
      </span>
    </nav>
  );
}

const LAYERS: readonly { kind: PinKind; label: string; Icon: LucideIcon }[] = [
  { kind: "homes", label: "Homes", Icon: House },
  { kind: "events", label: "Events", Icon: CalendarDays },
  { kind: "groups", label: "Groups", Icon: Users },
  { kind: "items", label: "Marketplace", Icon: ShoppingBag },
];

/**
 * What the map shows: homes, Events, Groups, Marketplace items and the
 * Move-in Crew (only for someone in a crew). The chat sets these too.
 */
export function LayerChips({
  kinds,
  onToggle,
  crew,
}: {
  kinds: readonly PinKind[];
  onToggle: (k: PinKind) => void;
  crew: { on: boolean; toggle: () => void } | null;
}) {
  return (
    <fieldset className="lh-layers">
      <legend className="sr-only">Show on the map</legend>
      {LAYERS.map(({ kind, label, Icon }) => (
        <LayerChip key={kind} on={kinds.includes(kind)} onClick={() => onToggle(kind)}>
          <Icon size={14} strokeWidth={2.25} aria-hidden />
          {label}
        </LayerChip>
      ))}
      {crew && (
        <LayerChip on={crew.on} onClick={crew.toggle}>
          <UsersRound size={14} strokeWidth={2.25} aria-hidden />
          Crew
        </LayerChip>
      )}
    </fieldset>
  );
}

function LayerChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("lh-layer lh-focus", on ? "lh-layer-on" : "lh-glass")}
    >
      {children}
    </button>
  );
}

/* ───────────── Everything else in Landing ───────────── */

const PAGES: readonly { label: string; line: string; Icon: LucideIcon; link: LinkProps }[] = [
  {
    label: "Find a place",
    line: "Rentals ranked for you.",
    Icon: Search,
    link: toLandingPage("find"),
  },
  {
    label: "Neighborhoods",
    line: "Scores and weekend routes.",
    Icon: MapIcon,
    link: toLandingPage("neighborhoods"),
  },
  {
    label: "Compare neighborhoods",
    line: "Try two side by side.",
    Icon: Scale,
    link: toCompare(),
  },
  {
    label: "Your place",
    line: "Move in and track what you own.",
    Icon: Sofa,
    link: toMyPlace(),
  },
  {
    label: "3D apartment",
    line: "Your place, furnished by chat.",
    Icon: Building2,
    link: toHome({ view: "apartment" }),
  },
  {
    label: "3D editor",
    line: "Change the layout by hand.",
    Icon: Box,
    link: toUnit(),
  },
  {
    label: "Room scan",
    line: "Scan your room and pick a style.",
    Icon: ScanLine,
    link: toLandingPage("room"),
  },
  {
    label: "Roommates",
    line: "Say how you live and see who fits.",
    Icon: Users,
    link: toLandingPage("roommates"),
  },
  {
    label: "Your house",
    line: "Chores, bills and groceries.",
    Icon: ReceiptText,
    link: toLandingPage("house"),
  },
  {
    label: "Move-in Crew",
    line: "People arriving when you do.",
    Icon: UsersRound,
    link: toLandingPage("crew"),
  },
  {
    label: "Journeys",
    line: "Check-ins for your first 90 days.",
    Icon: Footprints,
    link: toLandingPage("journeys"),
  },
  {
    label: "Move out",
    line: "Sublet your room, sell your things.",
    Icon: PackageOpen,
    link: toLandingPage("moveout"),
  },
  {
    label: "City Profile",
    line: "What Landing knows about you.",
    Icon: CircleUserRound,
    link: toLandingPage("profile"),
  },
  {
    label: "Inbox",
    line: "Drafts waiting for your OK.",
    Icon: Inbox,
    link: toLandingPage("inbox"),
  },
];

/** "Explore": every part of Landing with one line each, so nothing depends on the right phrase. */
export function ExploreMenu() {
  const [open, setOpen] = useState(false);
  return (
    <PopoverPanel
      open={open}
      onOpenChange={setOpen}
      width={540}
      className="max-w-[calc(100vw-16px)]"
      trigger={
        <button
          type="button"
          aria-label="Explore Landing"
          className={cn("lh-top-btn lh-focus", open ? "lh-top-btn-on" : "lh-glass text-primary")}
        >
          <LayoutGrid size={16} aria-hidden />
          <span className="lh-top-label">Explore</span>
        </button>
      }
    >
      <div className="overflow-y-auto p-2">
        <p className="px-2 pt-1.5 pb-2 text-[13px] text-secondary">
          Everything in Landing. You can also just ask Muse for any of it.
        </p>
        <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {PAGES.map(({ label, line, Icon, link }) => (
            <li key={label}>
              <Link
                {...link}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg p-2 outline-none hover:bg-hover focus-visible:bg-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[15px] text-primary leading-5">
                    {label}
                  </span>
                  <span className="block truncate text-[13px] text-secondary leading-4">
                    {line}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PopoverPanel>
  );
}

/* ───────────── Past chats ───────────── */

export function ChatsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="Chats"
      aria-expanded={open}
      aria-controls="lh-history"
      onClick={onToggle}
      className={cn("lh-top-btn lh-focus", open ? "lh-top-btn-on" : "lh-glass text-primary")}
    >
      <History size={16} aria-hidden />
      <span className="lh-top-label">Chats</span>
    </button>
  );
}

export function ChatHistory({
  open,
  sessions,
  currentId,
  onOpen,
  onNew,
  onClose,
}: {
  open: boolean;
  sessions: readonly ChatSession[];
  currentId: string;
  onOpen: (s: ChatSession) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      id="lh-history"
      aria-label="Past chats"
      className="lh-history lh-glass flex flex-col gap-2.5 p-3.5"
      inert={!open}
    >
      <div className="flex items-center gap-2">
        <b className="flex-1 text-[18px] text-primary">Chats</b>
        <button
          type="button"
          onClick={onNew}
          className="lh-focus rounded-full bg-btn px-3 py-1.5 font-semibold text-[13px] text-btn-text"
        >
          New chat
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="lh-focus rounded-full bg-btn p-1.5 text-btn-text"
        >
          <X size={16} />
        </button>
      </div>
      <div className="-mx-1.5 flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="px-2 text-[13px] text-secondary">
            Your chats show up here once you ask something.
          </p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s)}
            aria-current={s.id === currentId ? "true" : undefined}
            className={cn(
              "lh-focus block w-full rounded-xl px-2 py-2 text-left hover:bg-hover",
              s.id === currentId && "bg-highlight",
            )}
          >
            <span className="block truncate font-semibold text-[14px] text-primary">{s.title}</span>
            <span className="block text-[12px] text-secondary">
              {new Date(s.updatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" · "}
              {s.messages.length} messages
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
