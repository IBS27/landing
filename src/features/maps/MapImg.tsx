import { cn } from "@/lib/format";
import { darkMapSrc } from "./lookup";

/**
 * A generated static map: the light Positron render, swapped for its dark-style
 * twin in dark mode. The hidden variant isn't fetched (lazy + display:none).
 */
export function MapImg({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const base = cn("pointer-events-none select-none", className);
  return (
    <>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        draggable={false}
        className={cn(base, "block dark:hidden")}
      />
      <img
        src={darkMapSrc(src)}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        draggable={false}
        className={cn(base, "hidden dark:block")}
      />
    </>
  );
}
