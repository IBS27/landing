import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn, plural } from "@/lib/format";
import { Avatar, Button } from "@/ui/primitives";
import type { PersonCard } from "../../../convex/friends";

export type { PersonCard };

/** "[avatars] 12 mutual friends", or nothing when there are none. */
export function MutualLine({
  person,
  size = 16,
  className,
}: {
  person: Pick<PersonCard, "mutualCount" | "mutuals">;
  size?: number;
  className?: string;
}) {
  if (person.mutualCount === 0) return null;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {person.mutuals.length > 0 && (
        <span className="flex shrink-0">
          {person.mutuals.map((m, i) => (
            <span
              key={m._id}
              className={cn("rounded-full ring-2 ring-card", i > 0 && "-ml-1")}
              style={{ zIndex: 2 - i }}
            >
              <Avatar src={m.avatar} size={size} />
            </span>
          ))}
        </span>
      )}
      <span className="truncate">{plural(person.mutualCount, "mutual friend")}</span>
    </span>
  );
}

/**
 * The 5-up grid card on Friends home (requests and People you may know):
 * square photo, name, mutual friends and two stacked buttons.
 */
export function PersonGridCard({
  person,
  children,
  note,
}: {
  person: PersonCard;
  /** The button stack. */
  children: ReactNode;
  /** Replaces the mutual line after an action ("Request sent"). */
  note?: ReactNode;
}) {
  return (
    <li className="p-1">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-divider bg-card shadow-base">
        <Link
          to="/$username"
          params={{ username: person.username }}
          className="block aspect-square overflow-hidden border-divider border-b"
        >
          <img
            src={person.avatar}
            alt=""
            className="h-full w-full object-cover transition-[filter] hover:brightness-95"
          />
        </Link>
        <div className="flex flex-1 flex-col px-3 pt-[10px] pb-3">
          <Link
            to="/$username"
            params={{ username: person.username }}
            className="truncate font-semibold text-[17px] text-primary leading-5 hover:underline"
          >
            {person.name}
          </Link>
          <div className="mt-1 flex h-6 items-center text-[15px] text-secondary">
            {note ?? <MutualLine person={person} />}
          </div>
          <div className="mt-auto flex flex-col gap-[6px] pt-2">{children}</div>
        </div>
      </div>
    </li>
  );
}

/** Full-width 36px button used in the grid cards. */
export function CardButton({
  variant,
  onClick,
  disabled,
  children,
}: {
  variant: "primary" | "secondary" | "soft";
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button variant={variant} block onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

/**
 * A row in the sub-page sidebars (requests, suggestions, all friends):
 * 60px avatar, name, meta and an optional button pair. Selecting it previews
 * the profile on the right.
 */
export function PersonRow({
  person,
  selected,
  onSelect,
  meta,
  actions,
  trailing,
}: {
  person: PersonCard;
  selected: boolean;
  onSelect: () => void;
  meta?: ReactNode;
  actions?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer gap-3 rounded-lg p-2 text-left transition-colors",
        selected ? "bg-highlight" : "hover:bg-hover",
      )}
    >
      <Avatar src={person.avatar} size={60} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-[2px]">
            <div className="truncate font-semibold text-[15px] text-primary leading-5">
              {person.name}
            </div>
            {meta && <div className="mt-[2px] text-[13px] text-secondary leading-4">{meta}</div>}
          </div>
          {trailing}
        </div>
        {actions && (
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
