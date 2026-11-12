import { useCoverEdgeColors } from "./PhotoGrid";

/** Facebook's fade curve under the nav (measured at 2x): strong for ~60px, gone by the bottom. */
const FADE = [
  [0, 1],
  [3.4, 0.89],
  [10.3, 0.81],
  [17.2, 0.7],
  [27.6, 0.54],
  [37.9, 0.39],
  [48.3, 0.29],
  [58.6, 0.22],
  [69, 0.16],
  [79.3, 0.11],
  [89.7, 0.06],
  [100, 0],
] as const;
const MASK = `linear-gradient(to bottom, ${FADE.map(([at, a]) => `rgba(0,0,0,${a}) ${at}%`).join(", ")})`;

/**
 * The side fill behind a cover on profiles, Pages, groups and events: each
 * side carries the colour of the cover's own edge, fading vertically into the
 * card (348px under a profile or group cover, 264px beside an event cover).
 * Falls back to a blurred copy of the cover when the image can't be sampled.
 */
export function CoverWash({
  cover,
  height = 348,
}: {
  cover: string | null | undefined;
  height?: number;
}) {
  const edges = useCoverEdgeColors(cover ?? undefined);
  if (!cover || edges === undefined) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
      style={{
        height,
        maskImage: MASK,
        backgroundImage: edges
          ? `linear-gradient(to right, ${edges.left} 50%, ${edges.right} 50%)`
          : undefined,
      }}
    >
      {!edges && (
        <img src={cover} alt="" className="h-full w-full scale-110 object-cover blur-[40px]" />
      )}
    </div>
  );
}
