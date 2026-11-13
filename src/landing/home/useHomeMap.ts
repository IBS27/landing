import type { Map as MlMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import type {
  Bounds,
  LatLng,
  ListingPin,
  MapFocus,
  MapLayer,
  PinKind,
  RouteStop,
} from "@/landing/map/types";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ChatCommand, ChatContext } from "../../../convex/lib/homeChatRules";
import type { PinsInBounds } from "../../../convex/lib/mapPins";
import { pointsBounds, shapeBounds, unionBounds } from "./places";

const GLOBE = { center: { lat: 33, lng: -108 }, zoom: 0.95, pitch: 0, bearing: 0 };
const SF: Bounds = { west: -122.515, south: 37.706, east: -122.356, north: 37.812 };
/** From here in, the map is about the city: layer chips, pins, the crew and "Your place". */
const CITY_ZOOM = 9;
/** A close view leans in, turned a little, so the buildings stand up. City-wide views stay flat. */
const TILT = { pitch: 52, bearing: -18 };
/** Buildings are fully up from here (`overlays.ts`). */
const CLOSE_ZOOM = 14.8;
/** What the map shows before anyone asks: the social layer. */
const DEFAULT_KINDS: readonly PinKind[] = ["events", "groups"];

/** A chat command that changes what the map shows (the rest open pages or the Apartment tab). */
export type MapCommand = Extract<
  ChatCommand,
  {
    kind:
      | "show_move"
      | "fly_neighborhood"
      | "compare"
      | "weekend_route"
      | "show_rentals"
      | "show_pins"
      | "show_crew";
  }
>;
const MAP_KINDS = [
  "show_move",
  "fly_neighborhood",
  "compare",
  "weekend_route",
  "show_rentals",
  "show_pins",
  "show_crew",
] as const satisfies readonly MapCommand["kind"][];
export const isMapCommand = (c: ChatCommand): c is MapCommand =>
  (MAP_KINDS as readonly string[]).includes(c.kind);

/** Map queries snap outward to a grid, so small pans reuse the last result. */
function snap(b: Bounds): Bounds {
  const g = 0.02;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    west: r(Math.floor(b.west / g) * g),
    south: r(Math.floor(b.south / g) * g),
    east: r(Math.ceil(b.east / g) * g),
    north: r(Math.ceil(b.north / g) * g),
  };
}

/**
 * Landing Home's map: one camera that travels globe → Bay Area → a
 * neighborhood, and what it shows. From city level in, Events and Groups are
 * on by default (#56), with rentals ranked for the viewer (#10), neighborhood
 * shapes (#15), Weekend Routes (#18), comparisons (#19) and the Move-in Crew
 * at neighborhood level (#30) as the chat or the layer chips ask. Pins come
 * from `map.inBounds` for the area on screen, snapped to a grid.
 */
export function useHomeMap() {
  const hoods = useQ(api.neighborhoods.boundaries, {});
  const crew = useQ(api.crews.myCrew, {});

  const [map, setMap] = useState<MlMap | null>(null);
  const [focus, setFocus] = useState<MapFocus>(GLOBE);
  const [zoom, setZoom] = useState(GLOBE.zoom);
  const [area, setArea] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [kinds, setKinds] = useState<readonly PinKind[]>(DEFAULT_KINDS);
  /** Homes are the viewer's ranked rentals up to this rent (null: any rent); undefined: every home in view. */
  const [rentalMax, setRentalMax] = useState<number | null | undefined>(undefined);
  const [routeSlug, setRouteSlug] = useState<string | null>(null);
  const [showCrew, setShowCrew] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);

  const inCity = zoom >= CITY_ZOOM;
  const hoodBySlug = useMemo(() => new Map((hoods ?? []).map((h) => [h.slug, h])), [hoods]);

  /** Moves the camera, even to the view it last moved to (the person may have panned away). */
  const moves = useRef(0);
  const go = useCallback((f: Exclude<MapFocus, string>) => {
    moves.current += 1;
    setFocus({ ...f, at: moves.current });
  }, []);

  /* ── Data for what's on the map ── */
  const ranked = kinds.includes("homes") && rentalMax !== undefined;
  const rentals = useQ(
    api.rentals.search,
    ranked ? { filters: rentalMax ? { maxPrice: rentalMax } : {} } : "skip",
  );
  const asked = kinds.filter((k) => !(k === "homes" && ranked));
  const pinArgs = area && inCity && asked.length ? { bounds: snap(area), kinds: asked } : "skip";
  const found = useQ(api.map.inBounds, pinArgs);
  // Keep the last pins on screen while the next area loads.
  const lastPins = useRef<PinsInBounds | undefined>(undefined);
  if (pinArgs === "skip") lastPins.current = undefined;
  else if (found) lastPins.current = found;
  const pins = found ?? lastPins.current;

  const routeHood = routeSlug ? hoodBySlug.get(routeSlug) : undefined;
  const routeId = routeHood?._id as Id<"neighborhoods"> | undefined;
  const route = useQ(api.weekendRoutes.get, routeId ? { neighborhoodId: routeId } : "skip");
  // No route yet (or a stale one): start a build, as the neighborhood page does (#18).
  const requestRoute = useM(api.weekendRoutes.request);
  useEffect(() => {
    if (routeId && route && !route.route && !route.building && !route.failed)
      void requestRoute({ neighborhoodId: routeId }).catch(() => undefined);
  }, [routeId, route, requestRoute]);
  // Pinned stops only, as on the neighborhood page (#18).
  const stops = useMemo<RouteStop[] | undefined>(
    () =>
      route?.route?.stops.flatMap((s) =>
        s.point
          ? [
              {
                key: s.key,
                name: s.name,
                point: s.point,
                note: s.why,
                sources: s.sources,
                ...(s.eventId && { link: { kind: "event" as const, _id: s.eventId } }),
              },
            ]
          : [],
      ),
    [route],
  );

  /** The ranked rentals' pins by listing id, for a chat card's "show on the map". */
  const rentalPins = useMemo(
    () =>
      new Map<string, ListingPin>(
        (rentals?.results ?? []).flatMap((r) => (r.pin ? [[r._id, r.pin] as const] : [])),
      ),
    [rentals],
  );

  const layers = useMemo<MapLayer[]>(() => {
    const all = hoods ?? [];
    const shown = compare ? all.filter((h) => compare.includes(h.slug)) : zoom > 8 ? all : [];
    const out: MapLayer[] = [
      {
        kind: "neighborhoods",
        items: shown,
        selected: compare ?? selected ?? undefined,
        // The map leaves the camera to us here: lean in to the neighborhood.
        onSelect: (n) => {
          setCompare(null);
          setSelected(n.slug);
          go({ bounds: shapeBounds(n), minZoom: CLOSE_ZOOM, ...TILT });
        },
      },
    ];
    if (inCity) {
      // Homes come from one place at a time: the ranked rentals, or every home in view.
      const homes = ranked
        ? [...rentalPins.values()]
        : (pins?.listings.filter((l) => l.home && kinds.includes("homes")) ?? []);
      const items = pins?.listings.filter((l) => !l.home && kinds.includes("items")) ?? [];
      if (homes.length || items.length) out.push({ kind: "listings", items: [...homes, ...items] });
      if (pins && kinds.includes("events")) out.push({ kind: "events", items: pins.events });
      if (pins && kinds.includes("groups")) out.push({ kind: "groups", items: pins.groups });
    }
    if (stops?.length) out.push({ kind: "route", stops });
    return out;
  }, [hoods, compare, zoom, inCity, selected, ranked, rentalPins, pins, kinds, stops, go]);

  // When a Weekend Route arrives (or its stops change), frame it. The same
  // stops delivered again leave the camera where the person put it.
  const frameRoute = useCallback(() => {
    const b = pointsBounds(stops?.map((s) => s.point) ?? [], 0.003);
    if (b) go({ bounds: b, minZoom: 14.4, ...TILT });
    return b !== null;
  }, [stops, go]);
  const framed = useRef("");
  useEffect(() => {
    const key = stops?.map((s) => s.key).join("|") ?? "";
    if (framed.current === key) return;
    framed.current = key;
    frameRoute();
  }, [stops, frameRoute]);

  const onMapReady = useCallback((m: MlMap) => {
    // A softer, label-free globe; normal detail once zoomed in.
    for (const l of m.getStyle().layers ?? []) {
      try {
        if (l.type === "symbol")
          m.setPaintProperty(l.id, "text-opacity", [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0,
            7,
            1,
          ]);
      } catch {
        // A layer without text.
      }
    }
    // Switching to the globe can reset the camera; start over the Americas.
    if (m.getZoom() < 3)
      m.easeTo({
        center: [GLOBE.center.lng, GLOBE.center.lat],
        zoom: GLOBE.zoom,
        // Keep the globe above the chat.
        offset: [0, -65],
        duration: 0,
      });
    setMap(m);
  }, []);

  const onBoundsChange = useCallback((b: Bounds, z: number) => {
    setArea(b);
    setZoom(z);
  }, []);

  /* ── Moving the camera ── */
  const fitHood = useCallback(
    (slug: string) => {
      const h = hoodBySlug.get(slug);
      if (!h) return;
      setSelected(slug);
      go({ bounds: shapeBounds(h), minZoom: CLOSE_ZOOM, ...TILT });
    },
    [hoodBySlug, go],
  );
  const showCity = useCallback(() => go({ bounds: SF }), [go]);
  const showWorld = useCallback(() => go(GLOBE), [go]);
  /** Leans in on one approximate point (a listing's area, the person's place). */
  const flyTo = useCallback(
    (p: LatLng) => go({ center: p, zoom: CLOSE_ZOOM + 0.4, ...TILT }),
    [go],
  );
  /** Frames a few approximate points at once (what Muse found): flat, so every marker reads. */
  const frame = useCallback(
    (points: readonly LatLng[]) => {
      if (points.length === 1) return flyTo(points[0]);
      const b = pointsBounds(points, 0.004);
      if (b) go({ bounds: b });
    },
    [flyTo, go],
  );

  /** Runs a chat command that changes the map. */
  const apply = useCallback(
    (cmd: MapCommand) => {
      // A Weekend Route stays while the map is on its neighborhood (its Events and Groups included).
      const slug = "slug" in cmd ? cmd.slug : undefined;
      if (cmd.kind !== "weekend_route" && !(cmd.kind === "show_pins" && !slug))
        setRouteSlug((cur) => (cur === slug ? cur : null));
      switch (cmd.kind) {
        case "show_move":
          setCompare(null);
          setSelected(null);
          return showCity();
        case "fly_neighborhood":
          setCompare(null);
          return fitHood(cmd.slug);
        case "compare": {
          const a = hoodBySlug.get(cmd.a);
          const b = hoodBySlug.get(cmd.b);
          if (!a || !b) return;
          setCompare([cmd.a, cmd.b]);
          setSelected(cmd.a);
          return go({ bounds: unionBounds([shapeBounds(a), shapeBounds(b)]) ?? SF });
        }
        case "weekend_route":
          setCompare(null);
          setSelected(cmd.slug);
          setRouteSlug(cmd.slug);
          // Already on the map: back to it. Otherwise the neighborhood, until its stops arrive.
          if (cmd.slug !== routeSlug || !frameRoute()) fitHood(cmd.slug);
          return;
        case "show_rentals":
          setKinds(["homes"]);
          setRentalMax(cmd.maxPrice ?? null);
          return showCity();
        case "show_pins":
          setKinds([cmd.layer]);
          if (cmd.layer === "homes") setRentalMax(undefined);
          if (cmd.slug) fitHood(cmd.slug);
          else if (zoom < 11) showCity();
          return;
        case "show_crew":
          setShowCrew(true);
          return showCity();
      }
    },
    [fitHood, frameRoute, go, hoodBySlug, routeSlug, showCity, zoom],
  );

  const toggleKind = useCallback(
    (k: PinKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])),
    [],
  );

  /* ── Crew faces, at neighborhood level only ── */
  const crewSpots = useMemo(() => {
    if (!showCrew || !crew || !inCity) return [];
    const bySlug = new Map<string, { avatars: string[]; names: string[] }>();
    for (const m of crew.members) {
      const anchor = m.anchors.find((a) => a.kind === "neighborhood");
      const slug = anchor?.kind === "neighborhood" ? anchor.slugs[0] : undefined;
      if (!slug || !hoodBySlug.has(slug)) continue;
      const spot = bySlug.get(slug) ?? { avatars: [], names: [] };
      if (m.user.avatar) spot.avatars.push(m.user.avatar);
      spot.names.push(m.user.firstName ?? m.user.name);
      bySlug.set(slug, spot);
    }
    return [...bySlug].flatMap(([slug, s]) => {
      const hood = hoodBySlug.get(slug);
      return hood ? [{ slug, label: hood.label, center: hood.center, ...s }] : [];
    });
  }, [showCrew, crew, inCity, hoodBySlug]);

  const stage: ChatContext["stage"] = zoom < 5 ? "globe" : zoom < 12.5 ? "city" : "hood";

  return {
    hoods,
    hoodBySlug,
    /** The MapLibre map once loaded, for markers the page adds. */
    map,
    mapProps: { layers, focus, onMapReady, onBoundsChange, highlightListing: highlight },
    stage,
    zoom,
    inCity,
    selected,
    kinds,
    toggleKind,
    /** Null when the viewer isn't in a crew. */
    crew: crew ? { on: showCrew, toggle: () => setShowCrew((on) => !on) } : null,
    crewSpots,
    rentalPins,
    setHighlight,
    apply,
    fitHood,
    flyTo,
    frame,
    showCity,
    showWorld,
    /** Events and Groups, for "what's on near my place". */
    showSocial: useCallback(() => setKinds(DEFAULT_KINDS), []),
  };
}
