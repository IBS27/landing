import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconButton } from "@/ui/primitives";
import { GearFilled } from "./icons";

/**
 * Facebook's 360px white "app" sidebar (Video, Gaming, Pages, Settings,
 * Fundraisers): sticky under the header, H1 + optional round action, then rows.
 */
export function AppRail({
  title,
  label,
  action,
  children,
  className,
}: {
  title: ReactNode;
  label: string;
  action?: ReactNode;
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
      <div className="flex min-h-[52px] items-center justify-between px-4 pt-[11px] pb-[5px]">
        <h1 className="font-bold text-[24px] text-primary leading-7">{title}</h1>
        {action}
      </div>
      <div className="flex flex-col px-2 pb-4">{children}</div>
    </nav>
  );
}

/** The round grey gear in a rail header ("Edit notification settings"). */
export function RailGear({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <IconButton label={label} onClick={onClick}>
      <GearFilled className="text-icon" />
    </IconButton>
  );
}

export function RailSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="mx-2 mt-1 mb-2 flex h-9 items-center gap-1.5 rounded-full bg-input pr-2 pl-2.5">
      <Search size={16} strokeWidth={2.5} className="shrink-0 text-icon-secondary" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent pt-[7px] pb-[9px] text-[15px] text-primary outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

type RowProps = {
  icon: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  selected?: boolean;
  /** Gaming, Pages and Settings use 17px labels; Video and Events 15px. */
  large?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
  to?: string;
  search?: Record<string, unknown>;
  /** Image/avatar icons replace the grey circle. */
  bare?: boolean;
};

/** 52px rail row: 36px icon circle (blue when selected) + label. */
export function AppRailItem({
  icon,
  label,
  sub,
  selected,
  large,
  trailing,
  onClick,
  to,
  search,
  bare,
}: RowProps) {
  const cls = cn(
    "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
    selected ? "bg-wash dark:bg-hover" : "hover:bg-hover",
  );
  const inner = (
    <>
      {bare ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      ) : (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-accent text-white" : "bg-btn text-icon",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-medium text-primary",
            large ? "text-[17px] leading-5" : "text-[15px] leading-5",
          )}
        >
          {label}
        </span>
        {sub && <span className="block truncate text-[13px] text-secondary leading-4">{sub}</span>}
      </span>
      {trailing}
    </>
  );
  if (to)
    return (
      <Link
        to={to}
        search={search}
        // The router marks prefix matches as current (Home `/landing` matches every
        // section), so only an exact match may add to `selected`.
        activeOptions={{ exact: true }}
        className={cls}
        onClick={onClick}
        aria-current={selected ? "page" : undefined}
      >
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
    >
      {inner}
    </button>
  );
}

export function AppRailDivider() {
  return <div className="mx-2 my-2 h-px bg-divider" />;
}

export function AppRailHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pt-2 pb-1">
      <h2 className="font-semibold text-[17px] text-primary leading-5">{children}</h2>
      {action}
    </div>
  );
}

/** Page footer links shared by Bookmarks and the account menu. */
export const FOOTER_LINKS = ["Privacy", "Terms", "Advertising", "Ad Choices", "Cookies", "More"];

export function AdChoicesGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" className="ml-0.5 inline-block" aria-hidden>
      <path
        d="M2.5 1.8v8.4L10 6 2.5 1.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
