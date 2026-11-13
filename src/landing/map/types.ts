import type { Id } from "../../../convex/_generated/dataModel";
import type { CitedSource, NonEmpty } from "../../../convex/lib/citations";
import type {
  Bounds,
  EventPin,
  GroupPin,
  LatLng,
  ListingPin,
  PinKind,
} from "../../../convex/lib/mapPins";

export type { Bounds, EventPin, GroupPin, LatLng, ListingPin, PinKind };

/**
 * A neighborhood boundary: one row of `neighborhoods.boundaries` (#15).
 * `polygon` is GeoJSON MultiPolygon coordinates (polygons → rings → [lng, lat]).
 */
export type NeighborhoodShape = {
  _id: string;
  slug: string;
  label: string;
  park: boolean;
  center: LatLng;
  polygon: number[][][][];
};

/** What a route stop links to. Links go through `src/landing/links.ts`. */
export type StopLink =
  | { kind: "event"; _id: Id<"events"> }
  | { kind: "group"; slug: string }
  | { kind: "listing"; _id: Id<"listings"> };

/** One stop of a Weekend Route (#18), in order. Every stop cites its sources (#7). */
export type RouteStop = {
  /** Stable key for the stop. */
  key: string;
  name: string;
  point: LatLng;
  /** "Saturday, 8 AM" or what locals say about it. */
  note?: string;
  sources: NonEmpty<CitedSource>;
  link?: StopLink;
};

/** One layer of `<LandingMap>`: typed data straight from a feature's query. */
export type MapLayer =
  | {
      kind: "neighborhoods";
      items: readonly NeighborhoodShape[];
      /** Called after the map zooms to a clicked neighborhood (#16 routes to its page). */
      onSelect?: (n: NeighborhoodShape) => void;
      /** Slug of a neighborhood to keep highlighted (a neighborhood page's own shape). */
      selected?: string;
    }
  | { kind: "listings"; items: readonly ListingPin[] }
  | { kind: "events"; items: readonly EventPin[] }
  | { kind: "groups"; items: readonly GroupPin[] }
  | { kind: "route"; stops: readonly RouteStop[] };

/**
 * Where the camera starts: all of San Francisco, everything in the layers, a
 * box, or a point. The map moves again only when `focus` changes.
 */
export type MapFocus = "city" | "layers" | { bounds: Bounds } | { center: LatLng; zoom: number };

export type LandingMapProps = {
  layers: readonly MapLayer[];
  focus?: MapFocus;
  /** Fires after the camera settles, with the visible area. */
  onBoundsChange?: (bounds: Bounds, zoom: number) => void;
  /** Space taken by floating UI over the map edges, kept clear when fitting and opening cards. */
  padding?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  /** Accessible name for the map region. */
  label?: string;
  /** Sizes and places the map (it fills this box): `h-[420px]`, `absolute inset-0`. */
  className?: string;
  /** Map controls and floating UI the feature adds (e.g. Find's layer chips). */
  children?: React.ReactNode;
};
