import { CalendarDays, House, ShoppingBag, Users } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { PinsInBounds } from "../../../convex/lib/mapPins";
import { LandingMap } from "./LandingMap";
import type { Bounds, ListingPin, MapLayer, PinKind } from "./types";
import { useMediaQuery } from "./useEnv";

const KINDS: readonly { kind: PinKind; label: string; icon: ReactNode }[] = [
  { kind: "homes", label: "Homes", icon: <House size={16} strokeWidth={2.25} /> },
  { kind: "events", label: "Events", icon: <CalendarDays size={16} strokeWidth={2.25} /> },
  { kind: "groups", label: "Groups", icon: <Users size={16} strokeWidth={2.25} /> },
  { kind: "items", label: "Marketplace", icon: <ShoppingBag size={16} strokeWidth={2.25} /> },
];
const DEFAULT_KINDS: readonly PinKind[] = ["homes", "events", "groups"];

/** Queries snap outward to this grid, so small pans reuse the last result. */
const GRID = 0.02;
function snap(b: Bounds): Bounds {
  const down = (v: number) => Math.floor(v / GRID) * GRID;
  const up = (v: number) => Math.ceil(v / GRID) * GRID;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    west: r(down(b.west)),
    south: r(down(b.south)),
    east: r(up(b.east)),
    north: r(up(b.north)),
  };
}

/**
 * Find's browse view: homes, Events and Groups across San Francisco from
 * `map.inBounds` for whatever area is on screen, over the neighborhood shapes
 * (#15). `aside` is the list beside the map (below it on narrow screens).
 * `homes`, when given, are the pins the Homes chip shows (apartment search
 * results, #10) instead of every home in view.
 */
export function FindMap({ aside, homes }: { aside?: ReactNode; homes?: readonly ListingPin[] }) {
  const [kinds, setKinds] = useState<readonly PinKind[]>(DEFAULT_KINDS);
  const [area, setArea] = useState<Bounds | null>(null);
  const showHomes = homes !== undefined && kinds.includes("homes");
  const asked = homes ? kinds.filter((k) => k !== "homes") : kinds;
  const result = useQ(api.map.inBounds, area ? { bounds: area, kinds: [...asked] } : "skip");
  // Keep the last pins on screen while the next area loads.
  const last = useRef<PinsInBounds | undefined>(undefined);
  if (result) last.current = result;
  const pins = result ?? last.current;
  const hoods = useQ(api.neighborhoods.boundaries, {});

  const layers = useMemo<MapLayer[]>(
    () => [
      { kind: "neighborhoods", items: hoods ?? [] },
      ...(showHomes ? ([{ kind: "listings", items: homes }] as const) : []),
      ...(pins
        ? ([
            { kind: "listings", items: pins.listings },
            { kind: "events", items: pins.events },
            { kind: "groups", items: pins.groups },
          ] as const)
        : []),
    ],
    [pins, hoods, homes, showHomes],
  );
  const empty =
    result !== undefined &&
    result.listings.length +
      result.events.length +
      result.groups.length +
      (showHomes ? homes.length : 0) ===
      0;

  const toggle = (k: PinKind) =>
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <FindMapView
      aside={aside}
      layers={layers}
      kinds={kinds}
      onToggle={toggle}
      empty={empty}
      onBoundsChange={(b) => {
        const next = snap(b);
        setArea((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
      }}
    />
  );
}

/** Find's map, its layer chips and the list beside it, given the layers to draw. */
export function FindMapView({
  aside,
  layers,
  kinds,
  onToggle,
  empty,
  onBoundsChange,
}: {
  aside?: ReactNode;
  layers: readonly MapLayer[];
  kinds: readonly PinKind[];
  onToggle: (k: PinKind) => void;
  /** The current area has nothing to show. */
  empty: boolean;
  onBoundsChange?: (b: Bounds) => void;
}) {
  // Wide screens: the list in a 400px column beside a full-height map.
  // Narrow screens: title, then the map, then the list, in one scrolling page.
  const wide = useMediaQuery("(min-width: 1200px)");
  // The map reaches the bottom of the window (and the app's floating New message button) unless the list sits below it.
  const atBottom = !aside || wide;
  return (
    <div
      className={cn(
        "grid grid-cols-1",
        aside
          ? `min-[1200px]:h-[calc(100dvh-56px)] min-[1200px]:grid-cols-[400px_minmax(0,1fr)] min-[1200px]:grid-rows-[auto_minmax(0,1fr)]`
          : "h-[calc(100dvh-56px)]",
      )}
    >
      <header
        className={cn(
          "px-4 pt-5 pb-4",
          aside ? `min-[1200px]:col-start-1 min-[1200px]:row-start-1` : "sr-only",
        )}
      >
        <h1 className="font-bold text-[24px] text-primary leading-7">Find</h1>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          Homes, Groups and Events across San Francisco.
        </p>
      </header>
      <div
        className={cn(
          "relative",
          aside
            ? `h-[64dvh] min-h-[420px] min-[1200px]:col-start-2 min-[1200px]:row-span-2 min-[1200px]:row-start-1 min-[1200px]:h-auto min-[1200px]:min-h-0`
            : "h-full",
        )}
      >
        <LandingMap
          layers={layers}
          focus="city"
          // Top: the layer chips. Bottom: the app's floating New message button.
          padding={{ top: 64, bottom: atBottom ? 64 : 0 }}
          label="Map of homes, Events and Groups in San Francisco"
          onBoundsChange={onBoundsChange}
          className="absolute inset-0"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-3 sm:p-4">
            <fieldset className="pointer-events-auto -mx-3 flex min-w-0 max-w-[calc(100%+1.5rem)] gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0">
              <legend className="sr-only">Show on the map</legend>
              {KINDS.map(({ kind, label, icon }) => (
                <Chip
                  key={kind}
                  on={kinds.includes(kind)}
                  icon={icon}
                  label={label}
                  onClick={() => onToggle(kind)}
                />
              ))}
            </fieldset>
            {empty && (
              <p
                role="status"
                className="pointer-events-auto rounded-full bg-card px-3 py-1.5 text-[13px] text-secondary leading-4 shadow-[var(--lm-float)]"
              >
                {kinds.length
                  ? "Nothing here yet. Zoom out or show more on the map."
                  : "Choose what to show on the map."}
              </p>
            )}
          </div>
        </LandingMap>
      </div>
      {aside && (
        <div
          className={`px-4 pt-4 pb-10 min-[1200px]:col-start-1 min-[1200px]:row-start-2 min-[1200px]:overflow-y-auto min-[1200px]:pt-0`}
        >
          {aside}
        </div>
      )}
    </div>
  );
}

function Chip({
  on,
  icon,
  label,
  onClick,
}: {
  on: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold text-[15px] leading-5 shadow-[var(--lm-float)] transition-colors active:scale-[0.98]",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent",
        on
          ? "bg-[color-mix(in_srgb,var(--card),var(--accent)_14%)] text-btn-soft-text"
          : "bg-card text-primary hover:bg-[color-mix(in_srgb,var(--card),var(--primary-text)_5%)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
