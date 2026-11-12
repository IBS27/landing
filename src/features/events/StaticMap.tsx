import { Info } from "lucide-react";
import { venueMap } from "../maps/lookup";
import { MapImg } from "../maps/MapImg";

/**
 * The event location map: a static Positron-style render of the real streets
 * around the venue (public/seed/maps), with Facebook's red venue pin. Falls
 * back to the neighborhood or city map for addresses without a venue map, and
 * renders nothing when the place is unknown.
 */
export function StaticMap({
  address,
  city,
  height = 324,
}: {
  address: string | null | undefined;
  city: string;
  height?: number;
}) {
  const map = venueMap(address, city);
  if (!map) return null;
  return (
    <div className="relative overflow-hidden bg-[#f2f2f0] dark:bg-[#1b1b1b]" style={{ height }}>
      <MapImg
        src={map.src}
        alt={address ? `Map of ${address}` : `Map of ${city}`}
        width={map.width}
        height={map.height}
        className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      />
      <svg
        width="26"
        height="36"
        viewBox="-13 -34 26 36"
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_1px_1px_rgba(0,0,0,.3)]"
        style={{ marginTop: 2 }}
      >
        <path
          d="M0 0C-3-6-12-12-12-21a12 12 0 0 1 24 0C12-12 3-6 0 0Z"
          fill="#f02849"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="0" cy="-21" r="4.5" fill="#fff" />
      </svg>
      <span className="absolute right-3 bottom-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
        <Info size={14} strokeWidth={2.6} />
      </span>
    </div>
  );
}
