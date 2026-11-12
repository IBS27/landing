import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * The 360px white app sidebar used by Feeds, Saved and Memories
 * (sticky under the header, scrolls on its own).
 */
export function SideRail({
  title,
  action,
  label,
  children,
}: {
  title: string;
  action?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col overflow-y-auto bg-card min-[900px]:flex"
    >
      <div className="flex items-center justify-between px-4 pt-[11px] pb-2">
        <h1 className="font-bold text-[24px] text-primary leading-7">{title}</h1>
        {action}
      </div>
      <div className="flex flex-col px-2 pb-4">{children}</div>
    </nav>
  );
}

type RailItemProps = {
  icon: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  selected?: boolean;
  /** Saved tints only the icon; most rails also tint the row. */
  tintRow?: boolean;
  onClick?: () => void;
  to?: string;
  search?: Record<string, unknown>;
};

/** 52px rail row: 36px icon circle (blue when selected) + 15px/500 label. */
export function RailItem({
  icon,
  label,
  sub,
  selected,
  tintRow = true,
  onClick,
  to,
  search,
}: RailItemProps) {
  const cls = cn(
    "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
    selected && tintRow ? "bg-wash" : "hover:bg-hover",
  );
  const inner = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-accent text-white" : "bg-btn text-icon",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[15px] text-primary leading-5">
          {label}
        </span>
        {sub && <span className="block truncate text-[13px] text-secondary leading-4">{sub}</span>}
      </span>
    </>
  );
  if (to)
    return (
      <Link to={to} search={search} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

export function RailDivider() {
  return <div className="mx-2 my-2 h-px bg-divider" />;
}

export function RailHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-2 pt-1 pb-2 font-semibold text-[17px] text-primary">{children}</h2>;
}
