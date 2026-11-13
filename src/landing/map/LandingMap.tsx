import { lazy, Suspense } from "react";
import type { LandingMapProps } from "./types";

const MapCanvas = lazy(() => import("./MapCanvas"));

/**
 * Landing's shared San Francisco map (#56). Pass typed layers straight from
 * your queries; the map makes no queries of its own:
 *
 *   <LandingMap
 *     layers={[{ kind: "neighborhoods", items: hoods }, { kind: "route", stops }]}
 *     focus="layers"
 *   />
 *
 * Pins open a preview card that links to the Group, Event or listing through
 * `src/landing/links.ts`. MapLibre loads in its own chunk on first use.
 * The map never asks for the viewer's location.
 */
export function LandingMap(props: LandingMapProps) {
  return (
    <Suspense
      fallback={
        <div aria-hidden className={props.className}>
          <div className="lm-skeleton h-full w-full bg-comment" />
        </div>
      }
    >
      <MapCanvas {...props} />
    </Suspense>
  );
}

export type {
  Bounds,
  EventPin,
  GroupPin,
  LandingMapProps,
  ListingPin,
  MapFocus,
  MapLayer,
  NeighborhoodShape,
  RouteStop,
} from "./types";
