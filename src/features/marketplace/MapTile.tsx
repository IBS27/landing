import { cn } from "@/lib/format";
import { MAP_IMG_CLASS } from "../maps/lookup";

/**
 * A static map image (OpenStreetMap render of the real area, see
 * public/seed/maps) with Marketplace's "approximate area" circle centred on
 * the place. Dark mode darkens the map through a CSS filter.
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
        "relative w-full select-none overflow-hidden bg-[#f2efe9] dark:bg-[#242526]",
        className,
      )}
      style={{ height }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn("absolute inset-0 h-full w-full object-cover", MAP_IMG_CLASS)}
      />
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0866FF] bg-[#0866FF]/15"
        style={{ width: radius * 2, height: radius * 2 }}
      />
      {info && (
        <span
          title="© OpenStreetMap contributors"
          className="absolute right-1.5 bottom-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white font-bold font-serif text-[#1c1e21] text-[11px] leading-none shadow-[0_0_0_1.5px_#1c1e21]"
        >
          i
        </span>
      )}
    </div>
  );
}
