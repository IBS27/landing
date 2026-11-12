import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Plus, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, IconButton } from "@/ui/primitives";
import { CATEGORIES } from "../../../convex/lib/listings";
import {
  BagIcon,
  BellFill,
  CATEGORY_ICONS,
  GearIcon,
  InboxIcon,
  ShieldIcon,
  StoreIcon,
  TagIcon,
} from "./icons";
import { LocationDialog, useMarketplaceLocation } from "./location";

/* ───────────── Page shell ───────────── */

/** Fixed 360px white Marketplace rail + main column. */
export function MpShell({
  rail,
  children,
  mainClassName,
}: {
  rail: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-56px)]">
      <nav
        aria-label="Marketplace sidebar"
        className="fixed top-14 left-0 z-10 hidden h-[calc(100vh-56px)] w-[360px] flex-col bg-card min-[900px]:flex"
      >
        {rail}
      </nav>
      <main
        className={cn("min-w-0 px-4 pb-10 min-[900px]:ml-[360px] min-[900px]:px-8", mainClassName)}
      >
        {children}
      </main>
    </div>
  );
}

/* ───────────── Rail parts ───────────── */

type RowProps = {
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  chevron?: boolean;
  to?: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  /** The row's leading slot is an avatar, not an icon circle. */
  bare?: boolean;
};

/** 52px rail row: 36px grey icon circle (blue when active) + 15px/500 label. */
export function RailRow({
  icon,
  label,
  active,
  chevron,
  to,
  search,
  params,
  href,
  onClick,
  trailing,
  bare,
}: RowProps) {
  const cls = cn(
    "flex h-[52px] w-full items-center gap-3 rounded-lg px-2 text-left transition-colors",
    active ? "bg-wash" : "hover:bg-hover",
  );
  const inner = (
    <>
      {bare ? (
        icon
      ) : (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            active ? "bg-[#1877F2] text-white" : "bg-btn text-icon",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5">
        {label}
      </span>
      {trailing}
      {chevron && <ChevronRight size={22} strokeWidth={1.75} className="mr-1 text-secondary" />}
    </>
  );
  if (to)
    return (
      <Link to={to} search={search} params={params} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

export function RailDivider({ className }: { className?: string }) {
  return <div className={cn("mx-2 h-px bg-divider", className)} />;
}

export function RailTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2">
      <h2 className="font-semibold text-[17px] text-primary leading-5">{children}</h2>
      {action}
    </div>
  );
}

export function CreateListingButton({ className }: { className?: string }) {
  return (
    <Link
      to="/marketplace/create"
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125",
        className,
      )}
    >
      <Plus size={20} strokeWidth={2.5} />
      Create new listing
    </Link>
  );
}

export function RailSearch({
  initial = "",
  category,
  placeholder = "Search Marketplace",
}: {
  initial?: string;
  category?: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        void navigate({
          to: "/marketplace/search",
          search: { q: q.trim(), ...(category ? { category } : {}) },
        });
      }}
      className="mx-4 flex h-9 items-center gap-1.5 rounded-full bg-input pl-[10px] pr-3"
    >
      <Search size={16} strokeWidth={2.25} className="shrink-0 text-icon-secondary" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
      />
    </form>
  );
}

/** "Seattle, Washington · Within 40 mi" (opens the location dialog). */
export function LocationLink({ className }: { className?: string }) {
  const loc = useMarketplaceLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-[27px] w-full items-center rounded-md px-2 text-left font-semibold text-[15px] text-link leading-5 hover:underline",
          className,
        )}
      >
        {loc.name}, {loc.region} · Within {loc.radiusMi} mi
      </button>
      <LocationDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** "Seattle · 40 mi" header link with a pin. */
export function LocationChip() {
  const loc = useMarketplaceLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1 rounded-md px-1 text-[15px] text-link hover:underline"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
          <path d="M8 0a6 6 0 0 0-6 6c0 4.2 5.2 9.4 5.4 9.6a.8.8 0 0 0 1.2 0C8.8 15.4 14 10.2 14 6a6 6 0 0 0-6-6Zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
        </svg>
        {loc.name} · {loc.radiusMi} mi
      </button>
      <LocationDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CategoryList({
  active,
  linkFor,
}: {
  active?: string;
  /** Override where a category row goes (search keeps the query). */
  linkFor?: (slug: string) => { to: string; search?: Record<string, unknown> };
}) {
  return (
    <>
      {CATEGORIES.map((c) => {
        const link = linkFor?.(c.slug) ?? {
          to: "/marketplace/category/$category",
        };
        return (
          <RailRow
            key={c.slug}
            icon={CATEGORY_ICONS[c.slug]}
            label={c.label}
            active={active === c.slug}
            to={link.to}
            params={linkFor ? undefined : { category: c.slug }}
            search={link.search}
          />
        );
      })}
      {!linkFor && (
        <RailRow
          icon={CATEGORY_ICONS.groups}
          label="Buy and sell groups"
          active={active === "groups"}
          to="/marketplace/groups"
        />
      )}
    </>
  );
}

/* ───────────── Rails ───────────── */

export type MainRailActive =
  | "browse"
  | "notifications"
  | "inbox"
  | "status"
  | "groups"
  | (string & {})
  | null;

/** The Marketplace home rail (Browse all, Notifications, Inbox, ... Categories). */
export function MainRail({
  active,
  onSettings,
}: {
  active: MainRailActive;
  onSettings?: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <div className="mt-[11px] flex h-9 items-center justify-between px-4">
        <h1 className="font-bold text-[24px] text-primary leading-7">Marketplace</h1>
        <IconButton
          label="Edit Marketplace Settings"
          onClick={() => (onSettings ? onSettings() : setSettingsOpen(true))}
        >
          <GearIcon size={20} />
        </IconButton>
      </div>
      <div className="mt-1.5">
        <RailSearch />
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
        <RailRow
          icon={<StoreIcon />}
          label="Browse all"
          active={active === "browse"}
          to="/marketplace"
        />
        <RailRow
          icon={<BellFill />}
          label="Notifications"
          active={active === "notifications"}
          to="/marketplace/notifications"
        />
        <RailRow
          icon={<InboxIcon />}
          label="Inbox"
          active={active === "inbox"}
          to="/marketplace/inbox"
        />
        <RailRow
          icon={<ShieldIcon />}
          label="Marketplace status"
          active={active === "status"}
          to="/marketplace/status"
        />
        <RailRow icon={<BagIcon />} label="Buying" chevron to="/marketplace/you" />
        <RailRow icon={<TagIcon />} label="Selling" chevron to="/marketplace/you/selling" />
        <CreateListingButton className="mx-2 mt-2" />
        <RailDivider className="mt-2" />
        <div className="pt-4">
          <RailTitle>Location</RailTitle>
          <LocationLink className="mt-2" />
        </div>
        <RailDivider className="mt-3" />
        <div className="pt-4">
          <RailTitle>Categories</RailTitle>
          <CategoryList active={active ?? undefined} />
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const viewer = useViewer();
  const [locOpen, setLocOpen] = useState(false);
  const loc = useMarketplaceLocation();
  return (
    <>
      <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Marketplace settings">
        <div className="p-2">
          <RailRow
            bare
            icon={<Avatar src={viewer.avatar} size={36} />}
            label={
              <span>
                Marketplace profile
                <span className="block font-normal text-[13px] text-secondary">{viewer.name}</span>
              </span>
            }
            to="/$username"
            params={{ username: viewer.username }}
          />
          <RailRow
            icon={<BellFill />}
            label="Marketplace notifications"
            to="/marketplace/notifications"
          />
          <RailRow
            icon={
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
                <path d="M8 0a6 6 0 0 0-6 6c0 4.2 5.2 9.4 5.4 9.6a.8.8 0 0 0 1.2 0C8.8 15.4 14 10.2 14 6a6 6 0 0 0-6-6Zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
              </svg>
            }
            label={
              <span>
                Location
                <span className="block font-normal text-[13px] text-secondary">
                  {loc.name}, {loc.region} · Within {loc.radiusMi} mi
                </span>
              </span>
            }
            onClick={() => {
              onClose();
              setLocOpen(true);
            }}
          />
        </div>
      </Modal>
      <LocationDialog open={locOpen} onClose={() => setLocOpen(false)} />
    </>
  );
}

/** Breadcrumb + title header used by category, search and composer rails. */
export function CrumbHeader({
  crumbs,
  title,
}: {
  crumbs: { label: string; to?: string }[];
  title: string;
}) {
  return (
    <div className="px-4 pt-[21px]">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-[13px] text-secondary leading-4"
      >
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-1">
            {i > 0 && <span>›</span>}
            {c.to ? (
              <Link to={c.to} className="font-semibold hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="font-semibold">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <h1 className="mt-px font-bold text-[24px] text-primary leading-7">{title}</h1>
    </div>
  );
}

/** Buying / Selling rails: back arrow, "Marketplace" crumb and title. */
export function SubRailHeader({ title }: { title: string }) {
  return (
    <div className="flex items-start gap-3 px-4 pt-[21px]">
      <Link
        to="/marketplace"
        aria-label="Back to Marketplace"
        className="mt-[9px] flex h-6 w-6 items-center justify-center rounded-full text-icon hover:bg-hover"
      >
        <ArrowLeft size={20} strokeWidth={2} />
      </Link>
      <div>
        <Link
          to="/marketplace"
          className="font-semibold text-[13px] text-secondary leading-4 hover:underline"
        >
          Marketplace
        </Link>
        <h1 className="mt-px font-bold text-[24px] text-primary leading-7">{title}</h1>
      </div>
    </div>
  );
}
