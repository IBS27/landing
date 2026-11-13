import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { PLACE_LABEL_LAYERS } from "./basemap";
import type {
  EventPin,
  GroupPin,
  ListingPin,
  MapLayer,
  NeighborhoodShape,
  RouteStop,
} from "./types";

/**
 * The map's own GL layers: neighborhood shapes and labels, the route line, and
 * the clustered pin source the DOM pins are read from. They're added again
 * after every basemap swap (light ↔ dark), from the latest data.
 */

export const SRC = { pins: "lm-pins", hoods: "lm-hoods", route: "lm-route" } as const;
export const HOOD_FILL = "lm-hood-fill";

export type Pin =
  | { kind: "listing"; key: string; pin: ListingPin }
  | { kind: "event"; key: string; pin: EventPin }
  | { kind: "group"; key: string; pin: GroupPin };

export type OverlayData = {
  pins: Pin[];
  hoods: readonly NeighborhoodShape[];
  /** Slug of the highlighted neighborhood. */
  selectedHood: string | null;
  stops: readonly RouteStop[];
};

export function overlayData(layers: readonly MapLayer[]): OverlayData {
  const out: OverlayData = { pins: [], hoods: [], selectedHood: null, stops: [] };
  for (const layer of layers) {
    if (layer.kind === "listings")
      for (const pin of layer.items) out.pins.push({ kind: "listing", key: `l:${pin._id}`, pin });
    else if (layer.kind === "events")
      for (const pin of layer.items) out.pins.push({ kind: "event", key: `e:${pin._id}`, pin });
    else if (layer.kind === "groups")
      for (const pin of layer.items) out.pins.push({ kind: "group", key: `g:${pin._id}`, pin });
    else if (layer.kind === "neighborhoods") {
      out.hoods = layer.items;
      out.selectedHood = layer.selected ?? null;
    } else out.stops = layer.stops;
  }
  return out;
}

const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

function pinsGeo(pins: Pin[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.pin.point.lng, p.pin.point.lat] },
      properties: { key: p.key, kind: p.kind },
    })),
  };
}

function hoodsGeo(hoods: readonly NeighborhoodShape[], selected: string | null): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hoods.map((n, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "MultiPolygon", coordinates: n.polygon },
      properties: { slug: n.slug, label: n.label, park: n.park, selected: n.slug === selected },
    })),
  };
}

/** Labels sit at each neighborhood's label point, not wherever the renderer picks. */
function hoodLabelsGeo(hoods: readonly NeighborhoodShape[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hoods
      .filter((n) => !n.park)
      .map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.center.lng, n.center.lat] },
        properties: { label: n.label },
      })),
  };
}

function routeGeo(stops: readonly RouteStop[]): FeatureCollection {
  if (stops.length < 2) return empty;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: stops.map((s) => [s.point.lng, s.point.lat]) },
        properties: {},
      },
    ],
  };
}

const kindIs = (k: Pin["kind"]) => ["case", ["==", ["get", "kind"], k], 1, 0];

/** Theme colors for GL layers (CSS variables don't reach the canvas). */
function palette(dark: boolean) {
  return dark
    ? {
        blue: "#2d88ff",
        edge: "rgba(226,229,233,0.16)",
        label: "#b0b3b8",
        halo: "rgba(28,28,29,0.85)",
        casing: "#252728",
      }
    : {
        blue: "#0866ff",
        edge: "rgba(8,8,9,0.14)",
        label: "#65686c",
        halo: "rgba(255,255,255,0.9)",
        casing: "#ffffff",
      };
}

/** Add (or re-add after a style swap) every source and layer, then fill them. */
export function addOverlays(map: MlMap, data: OverlayData, dark: boolean) {
  const c = palette(dark);
  // Draw under the basemap's labels: before the first symbol layer above every road and area.
  const styleLayers = map.getStyle().layers;
  const lastShape = styleLayers.findLastIndex((l) => l.type !== "symbol");
  const firstLabel = styleLayers[lastShape + 1]?.id;

  if (!map.getSource(SRC.hoods)) {
    map.addSource(SRC.hoods, { type: "geojson", data: empty });
    map.addSource(`${SRC.hoods}-labels`, { type: "geojson", data: empty });
    // The selected neighborhood stays as highlighted as a hovered one.
    const hover = (on: number, off: number) => [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      on,
      ["boolean", ["get", "selected"], false],
      on,
      off,
    ];
    map.addLayer(
      {
        id: HOOD_FILL,
        type: "fill",
        source: SRC.hoods,
        paint: {
          "fill-color": c.blue,
          "fill-opacity": hover(dark ? 0.14 : 0.07, 0) as never,
          "fill-opacity-transition": { duration: 150 },
        },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: "lm-hood-edge",
        type: "line",
        source: SRC.hoods,
        layout: { "line-join": "round" },
        paint: {
          "line-color": c.edge,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 15, 1.4],
        },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: "lm-hood-edge-hover",
        type: "line",
        source: SRC.hoods,
        layout: { "line-join": "round" },
        paint: {
          "line-color": c.blue,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.25, 15, 2],
          "line-opacity": hover(0.9, 0) as never,
          "line-opacity-transition": { duration: 150 },
        },
      },
      firstLabel,
    );
    map.addLayer({
      id: "lm-hood-label",
      type: "symbol",
      source: `${SRC.hoods}-labels`,
      minzoom: 11.6,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11.6, 10.5, 15, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 7,
        "text-padding": 6,
      },
      paint: {
        "text-color": c.label,
        "text-halo-color": c.halo,
        "text-halo-width": 1.4,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.6, 0, 12.2, 1],
      },
    });
  }

  if (!map.getSource(SRC.route)) {
    map.addSource(SRC.route, { type: "geojson", data: empty });
    map.addLayer(
      {
        id: "lm-route-casing",
        type: "line",
        source: SRC.route,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.casing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 9],
        },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: "lm-route-line",
        type: "line",
        source: SRC.route,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.blue,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 4.5],
        },
      },
      firstLabel,
    );
  }

  if (!map.getSource(SRC.pins)) {
    map.addSource(SRC.pins, {
      type: "geojson",
      data: empty,
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 14,
      clusterProperties: {
        listing: ["+", kindIs("listing")],
        event: ["+", kindIs("event")],
        group: ["+", kindIs("group")],
      },
    });
    // Invisible: pins are DOM buttons, but the source needs a layer to tile.
    map.addLayer({
      id: "lm-pins-probe",
      type: "circle",
      source: SRC.pins,
      paint: { "circle-radius": 1, "circle-opacity": 0, "circle-stroke-opacity": 0 },
    });
  }

  setOverlayData(map, data);
}

export function setOverlayData(map: MlMap, data: OverlayData) {
  const set = (id: string, geo: FeatureCollection) =>
    (map.getSource(id) as GeoJSONSource | undefined)?.setData(geo);
  set(SRC.pins, pinsGeo(data.pins));
  set(SRC.hoods, hoodsGeo(data.hoods, data.selectedHood));
  set(`${SRC.hoods}-labels`, hoodLabelsGeo(data.hoods));
  set(SRC.route, routeGeo(data.stops));
  // Our neighborhood labels replace the basemap's while that layer has shapes.
  for (const id of PLACE_LABEL_LAYERS)
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", data.hoods.length ? "none" : "visible");
}
