import { Search } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { PLACES, RADII } from "../../../convex/lib/listings";
import { metersPerPixel, REGION_ZOOM, regionMap } from "../maps/lookup";
import { MapTile } from "./MapTile";

export type MpLocation = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  radiusMi: number;
};

const KEY = "fb-clone:marketplace-location";
const DEFAULT: MpLocation = {
  name: "Seattle",
  region: "Washington",
  lat: 47.6062,
  lng: -122.3321,
  radiusMi: 40,
};

/* Per-viewer browse location (a convenience preference), shared by every Marketplace page. */
let current: MpLocation = read();
const listeners = new Set<() => void>();

function read(): MpLocation {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<MpLocation>;
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || !v.name) return DEFAULT;
    return { ...DEFAULT, ...v };
  } catch {
    return DEFAULT;
  }
}

export function setMarketplaceLocation(next: MpLocation) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; the location still applies for this tab.
  }
  for (const l of listeners) l();
}

export function useMarketplaceLocation() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** The `near` argument for listing queries. */
export function useNear() {
  const loc = useMarketplaceLocation();
  return useMemo(
    () => ({ lat: loc.lat, lng: loc.lng, radiusMi: loc.radiusMi }),
    [loc.lat, loc.lng, loc.radiusMi],
  );
}

/** Facebook's "Change location" dialog: place search, radius and a map preview. */
export function LocationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useMarketplaceLocation();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<MpLocation>(loc);
  const [focused, setFocused] = useState(false);
  const matches = PLACES.filter((p) =>
    `${p.name} ${p.region}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else setPlace(loc);
      }}
      title="Change location"
      width={548}
    >
      <div className="p-4">
        <p className="text-[15px] text-secondary leading-5">
          Search by city, neighborhood or ZIP code.
        </p>
        <div className="relative mt-3">
          <label className="flex h-[52px] items-center gap-2 rounded-md border border-divider px-3 focus-within:border-fb">
            <Search size={16} className="text-secondary" />
            <span className="sr-only">Location</span>
            <input
              value={focused ? query : query || `${place.name}, ${place.region}`}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Location"
              className="min-w-0 flex-1 bg-transparent text-[17px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
          {focused && (
            <div className="absolute inset-x-0 top-[56px] z-10 rounded-lg bg-popover p-2 shadow-elevated">
              {matches.length === 0 && (
                <p className="px-2 py-3 text-[15px] text-secondary">No results</p>
              )}
              {matches.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPlace({ ...place, name: p.name, region: p.region, lat: p.lat, lng: p.lng });
                    setQuery("");
                    setFocused(false);
                  }}
                  className="block w-full rounded-md px-2 py-2 text-left text-[15px] hover:bg-hover"
                >
                  {p.name}, {p.region}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="mt-3 block">
          <span className="font-semibold text-[15px] text-primary">Radius</span>
          <select
            value={place.radiusMi}
            onChange={(e) => setPlace({ ...place, radiusMi: Number(e.target.value) })}
            className="mt-1 h-11 w-full rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none focus:border-fb"
          >
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} {r === 1 ? "mile" : "miles"}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 overflow-hidden rounded-lg">
          <MapTile
            src={regionMap(place.name) ?? regionMap("Seattle") ?? ""}
            alt={`Map of ${place.name}, ${place.region}`}
            height={220}
            radius={Math.max(
              6,
              (place.radiusMi * 1609.34) / metersPerPixel(REGION_ZOOM, place.lat),
            )}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-divider border-t px-4 py-3">
        <Button variant="link" className={cn("px-3")} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="w-[90px]"
          onClick={() => {
            setMarketplaceLocation(place);
            onClose();
          }}
        >
          Apply
        </Button>
      </div>
    </Modal>
  );
}
