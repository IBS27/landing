import { CalendarDays, House, ShoppingBag, Users } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { PinsInBounds } from "../../../convex/lib/mapPins";
import { LandingMap } from "./LandingMap";
import type { Bounds, MapLayer, PinKind } from "./types";

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
 * Find's browse map: homes, Events and Groups across San Francisco, from
 * `map.inBounds` for whatever area is on screen. Neighborhood shapes join
 * this view once #15's `neighborhoods.boundaries` lands.
 */
export function FindMap() {
  const [kinds, setKinds] = useState<readonly PinKind[]>(DEFAULT_KINDS);
  const [area, setArea] = useState<Bounds | null>(null);
  const result = useQ(api.map.inBounds, area ? { bounds: area, kinds: [...kinds] } : "skip");
  // Keep the last pins on screen while the next area loads.
  const last = useRef<PinsInBounds | undefined>(undefined);
  if (result) last.current = result;
  const pins = result ?? last.current;

  const layers = useMemo<MapLayer[]>(
    () =>
      pins
        ? [
            { kind: "listings", items: pins.listings },
            { kind: "events", items: pins.events },
            { kind: "groups", items: pins.groups },
          ]
        : [],
    [pins],
  );
  const empty =
    result !== undefined &&
    result.listings.length + result.events.length + result.groups.length === 0;

  const toggle = (k: PinKind) =>
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <FindMapView
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

/** Find's map and its layer chips, given the layers to draw. */
export function FindMapView({
  layers,
  kinds,
  onToggle,
  empty,
  onBoundsChange,
}: {
  layers: readonly MapLayer[];
  kinds: readonly PinKind[];
  onToggle: (k: PinKind) => void;
  /** The current area has nothing to show. */
  empty: boolean;
  onBoundsChange?: (b: Bounds) => void;
}) {
  return (
    <div className="relative h-[calc(100dvh-56px)] w-full">
      <h1 className="sr-only">Find</h1>
      <LandingMap
        layers={layers}
        focus="city"
        // Top: the layer chips. Bottom: the app's floating New message button.
        padding={{ top: 64, bottom: 64 }}
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
