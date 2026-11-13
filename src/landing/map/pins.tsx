import type { ComponentProps } from "react";
import { cn } from "@/lib/format";
import type { EventPin, GroupPin, ListingPin } from "./types";

/**
 * The map's DOM pins. Each is a real button, so pins are keyboard-reachable and
 * read by screen readers. Hierarchy: price pills (listings) are the quietest,
 * Group avatars and Event date badges carry a picture or a date, and numbered
 * route stops sit on top in Facebook blue.
 */

type PinButton = Omit<ComponentProps<"button">, "children"> & { selected?: boolean };

const base =
  "lm-pin relative block cursor-pointer outline-none transition-[transform,box-shadow,background-color,color] duration-150 ease-out hover:scale-[1.07] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.97]";

const lift = "shadow-[var(--lm-float)]";

/** "$3,250" / "$45K" / "$1.2M" / "Free": short enough for a pill. */
export function pillPrice(n: number) {
  if (n === 0) return "Free";
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString("en-US")}`;
}

export function PricePill({ pin, selected, className, ...props }: PinButton & { pin: ListingPin }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        base,
        lift,
        "h-[26px] whitespace-nowrap rounded-full px-2.5 font-bold text-[13px] tabular-nums leading-[26px]",
        selected ? "scale-[1.07] bg-primary text-card" : "bg-card text-primary",
        className,
      )}
      {...props}
    >
      {pillPrice(pin.price)}
    </button>
  );
}

export function DateBadge({ pin, selected, className, ...props }: PinButton & { pin: EventPin }) {
  const d = new Date(pin.startAt);
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        base,
        lift,
        "flex w-[34px] flex-col items-center overflow-hidden rounded-[8px] bg-card pt-[3px] pb-[2px]",
        selected && "scale-[1.07] ring-2 ring-primary",
        className,
      )}
      {...props}
    >
      <span className="font-bold text-[9px] text-badge uppercase leading-[11px] tracking-[0.04em]">
        {d.toLocaleString("en-US", { month: "short" })}
      </span>
      <span className="font-bold text-[15px] text-primary tabular-nums leading-[18px]">
        {d.getDate()}
      </span>
    </button>
  );
}

export function GroupAvatar({ pin, selected, className, ...props }: PinButton & { pin: GroupPin }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        base,
        lift,
        "h-[34px] w-[34px] overflow-hidden rounded-[10px] border-2 border-card bg-card",
        selected && "scale-[1.07] ring-2 ring-fb",
        className,
      )}
      {...props}
    >
      <img src={pin.cover} alt="" draggable={false} className="h-full w-full object-cover" />
    </button>
  );
}

export function StopMarker({ n, selected, className, ...props }: PinButton & { n: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        base,
        "flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-card bg-fb font-bold text-[14px] text-white tabular-nums shadow-[0_1px_3px_var(--lm-drop)]",
        selected && "scale-[1.12] shadow-[0_0_0_4px_rgba(8,102,255,0.22),0_1px_3px_var(--lm-drop)]",
        className,
      )}
      {...props}
    >
      {n}
    </button>
  );
}

export type ClusterCounts = { listing: number; event: number; group: number };

/**
 * A cluster: the count on a card-colored disc with a soft halo, sized by how
 * many pins it holds. Its accessible name says what's inside.
 */
export function ClusterBubble({
  counts,
  className,
  ...props
}: PinButton & { counts: ClusterCounts }) {
  const total = counts.listing + counts.event + counts.group;
  const size = total < 10 ? 32 : total < 50 ? 38 : 44;
  return (
    <button
      type="button"
      className={cn(
        base,
        "flex items-center justify-center rounded-full bg-card font-bold text-[14px] text-primary tabular-nums",
        "shadow-[0_0_0_5px_color-mix(in_srgb,var(--card)_55%,transparent),0_1px_3px_var(--lm-drop),0_0_0_0.5px_var(--lm-edge)]",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {total}
    </button>
  );
}
