import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/format";
import type { ReactionType } from "../../../convex/validators";

export type { ReactionType };

export const REACTIONS: { type: ReactionType; label: string; color: string }[] = [
  { type: "like", label: "Like", color: "#0866FF" },
  { type: "love", label: "Love", color: "#F33E58" },
  { type: "care", label: "Care", color: "#F7B125" },
  { type: "haha", label: "Haha", color: "#F7B125" },
  { type: "wow", label: "Wow", color: "#F7B125" },
  { type: "sad", label: "Sad", color: "#F7B125" },
  { type: "angry", label: "Angry", color: "#E9710F" },
];
export const reactionMeta = (t: ReactionType) => REACTIONS.find((r) => r.type === t)!;

/* ---------- Facebook's round reaction emoji, drawn as SVG ---------- */

function Face({ id, children, angry }: { id: string; children: ReactNode; angry?: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
          {angry ? (
            <>
              <stop offset="0" stopColor="#E04300" />
              <stop offset="1" stopColor="#FFA320" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#FEEA70" />
              <stop offset="1" stopColor="#F69B30" />
            </>
          )}
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="8" fill={`url(#${id}-f)`} />
      {children}
    </>
  );
}

export function ReactionIcon({
  type,
  size = 18,
  className,
}: {
  type: ReactionType;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const dark = "#262626";
  let body: ReactNode;
  switch (type) {
    case "like":
      body = (
        <>
          <defs>
            <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#18AFFF" />
              <stop offset="1" stopColor="#0062DF" />
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="8" fill={`url(#${id}-l)`} />
          <path
            fill="#fff"
            d="M12.16 7.9c.18.2.29.47.29.75 0 .37-.18.7-.47.9.1.16.15.35.15.55 0 .43-.25.8-.62.98.05.12.08.26.08.4 0 .62-.5 1.12-1.12 1.12H7.73c-.46 0-.9-.13-1.27-.37l-.4-.25V7.03l1.55-2.36c.18-.28.28-.6.28-.94V3.4c0-.3.24-.55.55-.55.66 0 1.2.54 1.2 1.2v.66c0 .36-.08.71-.22 1.04l-.32.72h2.5c.62 0 1.12.5 1.12 1.12 0 .3-.12.57-.31.77ZM4.2 7.1h.94c.25 0 .45.2.45.45v4.3c0 .25-.2.45-.45.45H4.2a.45.45 0 0 1-.45-.45v-4.3c0-.25.2-.45.45-.45Z"
          />
        </>
      );
      break;
    case "love":
      body = (
        <>
          <defs>
            <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF6680" />
              <stop offset="1" stopColor="#E61739" />
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="8" fill={`url(#${id}-h)`} />
          <path
            fill="#fff"
            d="M10.47 4.5C9.4 4.5 8.55 5.13 8 5.9c-.55-.77-1.4-1.4-2.47-1.4-1.57 0-2.6 1.3-2.6 2.8 0 2.45 3.1 4.34 4.5 5.07.36.19.78.19 1.14 0 1.4-.73 4.5-2.62 4.5-5.07 0-1.5-1.03-2.8-2.6-2.8Z"
          />
        </>
      );
      break;
    case "care":
      body = (
        <Face id={id}>
          <path
            d="M4.2 6.7c.45-.65 1.45-.65 1.9 0M9.9 6.7c.45-.65 1.45-.65 1.9 0"
            stroke={dark}
            strokeWidth=".8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M6.8 8.5c.7.45 1.7.45 2.4 0"
            stroke={dark}
            strokeWidth=".75"
            fill="none"
            strokeLinecap="round"
          />
          <path
            fill="#F55065"
            d="M10.2 9.5c-.9 0-1.7.55-2.2 1.3-.5-.75-1.3-1.3-2.2-1.3-1.3 0-2.2 1-2.2 2.3 0 2 2.6 3.5 3.8 4.1.4.2.8.2 1.2 0 1.2-.6 3.8-2.1 3.8-4.1 0-1.3-.9-2.3-2.2-2.3Z"
          />
          <ellipse
            cx="4.6"
            cy="12.9"
            rx="1.5"
            ry="2.1"
            transform="rotate(-35 4.6 12.9)"
            fill="#FBCC47"
            stroke="#E6942D"
            strokeWidth=".35"
          />
          <ellipse
            cx="11.4"
            cy="12.9"
            rx="1.5"
            ry="2.1"
            transform="rotate(35 11.4 12.9)"
            fill="#FBCC47"
            stroke="#E6942D"
            strokeWidth=".35"
          />
        </Face>
      );
      break;
    case "haha":
      body = (
        <Face id={id}>
          <path
            d="M3.8 5.6 5.7 6.4 3.8 7.2M12.2 5.6l-1.9.8 1.9.8"
            stroke={dark}
            strokeWidth=".85"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            fill={dark}
            d="M3.6 8.7h8.8c.2 0 .35.17.32.37C12.4 11.4 10.4 13.4 8 13.4s-4.4-2-4.72-4.33a.33.33 0 0 1 .32-.37Z"
          />
          <path
            fill="#F55065"
            d="M5.3 12.15c.75-.65 1.65-.95 2.7-.95s1.95.3 2.7.95c-.75.8-1.65 1.25-2.7 1.25s-1.95-.45-2.7-1.25Z"
          />
        </Face>
      );
      break;
    case "wow":
      body = (
        <Face id={id}>
          <path
            d="M3.9 4.1c.55-.5 1.25-.7 1.95-.55M12.1 4.1c-.55-.5-1.25-.7-1.95-.55"
            stroke={dark}
            strokeWidth=".7"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="5.4" cy="6.4" rx=".95" ry="1.25" fill={dark} />
          <ellipse cx="10.6" cy="6.4" rx=".95" ry="1.25" fill={dark} />
          <ellipse cx="8" cy="11.1" rx="1.9" ry="2.5" fill={dark} />
        </Face>
      );
      break;
    case "sad":
      body = (
        <Face id={id}>
          <path
            d="M3.7 5.3c.6-.15 1.3-.5 1.75-1.05M12.3 5.3c-.6-.15-1.3-.5-1.75-1.05"
            stroke={dark}
            strokeWidth=".7"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="5.4" cy="7.4" rx=".95" ry="1.1" fill={dark} />
          <ellipse cx="10.6" cy="7.4" rx=".95" ry="1.1" fill={dark} />
          <path
            d="M5.9 12.3c.55-.55 1.3-.85 2.1-.85s1.55.3 2.1.85"
            stroke={dark}
            strokeWidth=".85"
            fill="none"
            strokeLinecap="round"
          />
          <path
            fill="#4FA3F7"
            d="M11.6 8.9c.35.55.85 1.2.85 1.75a.85.85 0 0 1-1.7 0c0-.55.5-1.2.85-1.75Z"
          />
        </Face>
      );
      break;
    case "angry":
      body = (
        <Face id={id} angry>
          <path
            d="M3.7 6.2l2.6.75M12.3 6.2l-2.6.75"
            stroke={dark}
            strokeWidth=".9"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="5.5" cy="8" rx=".85" ry=".8" fill={dark} />
          <ellipse cx="10.5" cy="8" rx=".85" ry=".8" fill={dark} />
          <path
            d="M6.1 12.1c.55-.3 1.2-.45 1.9-.45s1.35.15 1.9.45"
            stroke={dark}
            strokeWidth=".95"
            fill="none"
            strokeLinecap="round"
          />
        </Face>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={reactionMeta(type).label}
    >
      {body}
    </svg>
  );
}

/** Overlapping stack of the top reaction types (feed bar, comment chips). */
export function ReactionIcons({
  types,
  size = 18,
  ring = true,
}: {
  types: ReactionType[];
  size?: number;
  ring?: boolean;
}) {
  return (
    <span className="inline-flex items-center">
      {types.map((t, i) => (
        <span
          key={t}
          className={cn(
            "relative inline-flex rounded-full",
            ring && "ring-2 ring-card",
            i > 0 && "-ml-1",
          )}
          style={{ zIndex: types.length - i }}
        >
          <ReactionIcon type={t} size={size} />
        </span>
      ))}
    </span>
  );
}

/* ---------- Reaction picker (long hover on Like) ---------- */

/**
 * Hover-intent wrapper: shows the reaction dock after a short hover and keeps
 * it open while the pointer moves between the trigger and the dock.
 */
export function useReactionHover(openDelay = 500, closeDelay = 350) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return {
    open,
    close: () => {
      clear();
      setOpen(false);
    },
    bind: {
      onMouseEnter: () => {
        clear();
        timer.current = setTimeout(() => setOpen(true), open ? 0 : openDelay);
      },
      onMouseLeave: () => {
        clear();
        timer.current = setTimeout(() => setOpen(false), closeDelay);
      },
    },
  };
}

export function ReactionPicker({
  onPick,
  size = 39,
  className,
}: {
  onPick: (t: ReactionType) => void;
  size?: number;
  className?: string;
}) {
  const [hovered, setHovered] = useState<ReactionType | null>(null);
  return (
    <div
      role="toolbar"
      aria-label="Reactions"
      className={cn(
        "flex animate-[rx-dock_180ms_ease-out] items-end gap-1 rounded-full bg-popover p-1 shadow-[0_2px_8px_var(--shadow-2),0_0_0_1px_var(--shadow-1)]",
        className,
      )}
      onMouseLeave={() => setHovered(null)}
    >
      {REACTIONS.map((r, i) => (
        <button
          key={r.type}
          type="button"
          aria-label={r.label}
          onMouseEnter={() => setHovered(r.type)}
          onClick={(e) => {
            e.stopPropagation();
            onPick(r.type);
          }}
          className="relative origin-bottom transition-transform duration-150 ease-out"
          style={{
            transform:
              hovered === r.type
                ? "scale(1.3) translateY(-4px)"
                : hovered
                  ? "scale(0.92)"
                  : undefined,
          }}
        >
          {hovered === r.type && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 font-semibold text-[11px] text-white">
              {r.label}
            </span>
          )}
          <span
            className="block animate-[rx-pop_320ms_cubic-bezier(.3,1.6,.6,1)_both]"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <span
              className="block animate-[rx-bob_1.6s_ease-in-out_infinite]"
              style={{ animationDelay: `${400 + i * 120}ms` }}
            >
              <ReactionIcon type={r.type} size={size} />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
