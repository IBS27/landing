import { cn } from "@/lib/format";
import { MapImg } from "../maps/MapImg";

/**
 * A static map image (Positron-style render of the real area, see
 * public/seed/maps) with Marketplace's "approximate area" circle centred on
 * the place. Dark mode swaps in the dark-style render.
 */
export function MapTile({
  src,
  alt,
  height,
  radius,
  className,
  info,
}: {
  src: string;
  alt: string;
  height: number;
  radius: number;
  className?: string;
  /** Show the "i" map-info badge (as on Facebook's map strip). */
  info?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full select-none overflow-hidden bg-[#f2f2f0] dark:bg-[#1b1b1b]",
        className,
      )}
      style={{ height }}
    >
      <MapImg src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0866FF] bg-[#0866FF]/15"
        style={{ width: radius * 2, height: radius * 2 }}
      />
      {info && (
        <span
          title="© OpenStreetMap contributors © OpenMapTiles"
          className="absolute right-1.5 bottom-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white font-bold font-serif text-[#1c1e21] text-[11px] leading-none shadow-[0_0_0_1.5px_#1c1e21]"
        >
          i
        </span>
      )}
    </div>
  );
}
