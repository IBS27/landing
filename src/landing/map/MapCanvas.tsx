import {
  AttributionControl,
  type GeoJSONFeature,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  Map as MlMap,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, plural } from "@/lib/format";
import { loadBasemap, MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM, SF_BOUNDS } from "./basemap";
import { MapMarker } from "./MapMarker";
import {
  addOverlays,
  HOOD_FILL,
  type OverlayData,
  overlayData,
  type Pin,
  SRC,
  setOverlayData,
} from "./overlays";
import { PreviewCard, type Selected } from "./PreviewCard";
import {
  ClusterBubble,
  type ClusterCounts,
  DateBadge,
  GroupAvatar,
  PricePill,
  pillPrice,
  StopMarker,
} from "./pins";
import type { Bounds, LandingMapProps, LatLng, MapFocus } from "./types";
import { useIsDark, useReducedMotion, useWidth } from "./useEnv";

// MapLibre finds its worker next to its own module, which bundlers move: point it at the bundled copy.
setWorkerUrl(workerUrl);

/** Below this map width the preview card becomes a bottom sheet. */
const COMPACT = 640;
const EDGE = 16;
/** Pin z-order: quiet price pills under avatars and dates, route stops on top. */
const Z = { listing: 1, group: 2, event: 3, cluster: 4, stop: 5, hover: 8, card: 10 } as const;

type Visible =
  | { id: string; kind: "pin"; pin: Pin }
  | {
      id: string;
      kind: "cluster";
      clusterId: number;
      lng: number;
      lat: number;
      counts: ClusterCounts;
    };

/**
 * The Landing map (see `LandingMap.tsx` for the public, lazy-loaded entry).
 * MapLibre draws the basemap, neighborhood shapes and the route line; pins,
 * clusters and cards are DOM buttons pinned to coordinates.
 */
export default function MapCanvas({
  layers,
  focus = "city",
  onBoundsChange,
  label = "Map of San Francisco",
  className,
  children,
  padding,
}: LandingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MlMap | null>(null);
  const [failed, setFailed] = useState(false);
  const dark = useIsDark();
  const reduced = useReducedMotion();
  const width = useWidth(container);
  const compact = width > 0 && width < COMPACT;
  const [pt, pr, pb, pl] = [padding?.top, padding?.right, padding?.bottom, padding?.left];
  const insets = useMemo<Insets>(
    () => ({ top: pt ?? 0, right: pr ?? 0, bottom: pb ?? 0, left: pl ?? 0 }),
    [pt, pr, pb, pl],
  );

  const data = useMemo(() => overlayData(layers), [layers]);
  const pinsByKey = useMemo(() => new Map(data.pins.map((p) => [p.key, p])), [data.pins]);
  const latest = useRef({ data, pinsByKey, dark, onBoundsChange, insets, focus });
  latest.current = { data, pinsByKey, dark, onBoundsChange, insets, focus };

  const [visible, setVisible] = useState<Visible[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  /* ── Create the map once ── */
  useEffect(() => {
    let cancelled = false;
    let created: MlMap | null = null;
    const { dark: startDark, insets: pad, focus: start } = latest.current;
    loadBasemap(startDark ? "dark" : "light")
      .then((style) => {
        const el = container.current;
        if (cancelled || !el) return;
        const m = new MlMap({
          container: el,
          style,
          ...(typeof start === "object" && "center" in start
            ? { center: [start.center.lng, start.center.lat] as [number, number], zoom: start.zoom }
            : {
                bounds: focusBounds(start, latest.current.data) ?? toLngLat(SF_BOUNDS),
                fitBoundsOptions: { padding: fitPadding(pad, el) },
              }),
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: MAX_BOUNDS,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          renderWorldCopies: false,
          attributionControl: false,
          fadeDuration: 150,
        });
        m.touchZoomRotate.disableRotation();
        m.keyboard.disableRotation();
        m.addControl(new AttributionControl({ compact: true }), "bottom-left");
        created = m;
        m.on("load", () => {
          addOverlays(m, latest.current.data, latest.current.dark);
          // Narrow maps start with the credits folded behind the "i", clear of the app's floating buttons.
          if (el.clientWidth < COMPACT)
            el.querySelector(".maplibregl-ctrl-attrib")?.classList.remove(
              "maplibregl-compact-show",
            );
          setMap(m);
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      created?.remove();
    };
  }, []);

  /* ── Theme: swap the basemap, then re-add our layers ── */
  const themed = useRef(dark);
  useEffect(() => {
    if (!map || themed.current === dark) return;
    themed.current = dark;
    let live = true;
    loadBasemap(dark ? "dark" : "light")
      .then((style) => {
        if (!live) return;
        map.once("style.load", () => addOverlays(map, latest.current.data, latest.current.dark));
        map.setStyle(style, { diff: false });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [map, dark]);

  /* ── Data ── */
  useEffect(() => {
    if (map?.getSource(SRC.pins)) setOverlayData(map, data);
  }, [map, data]);

  /* ── Which pins and clusters are on screen ── */
  const refresh = useCallback(() => {
    if (!map?.getSource(SRC.pins)) return;
    const seen = new Set<string>();
    const next: Visible[] = [];
    for (const f of map.querySourceFeatures(SRC.pins)) {
      const v = toVisible(f, latest.current.pinsByKey);
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);
      next.push(v);
    }
    setVisible((prev) => (sameVisible(prev, next) ? prev : next));
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const onData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (e.sourceId === SRC.pins && e.isSourceLoaded) refresh();
    };
    map.on("moveend", refresh);
    map.on("sourcedata", onData);
    map.on("idle", refresh);
    refresh();
    return () => {
      map.off("moveend", refresh);
      map.off("sourcedata", onData);
      map.off("idle", refresh);
    };
  }, [map, refresh]);

  // A selected pin that's gone from the data (filtered out, or a new area) closes its card.
  useEffect(() => {
    if (selected && selected.kind !== "stop") {
      const key = `${selected.kind[0]}:${selected.pin._id}`;
      if (!pinsByKey.has(key)) setSelected(null);
    }
  }, [pinsByKey, selected]);

  /* ── Bounds out ── */
  useEffect(() => {
    if (!map) return;
    const report = () => {
      const b = map.getBounds();
      latest.current.onBoundsChange?.(
        { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        map.getZoom(),
      );
    };
    map.on("moveend", report);
    report();
    return () => {
      map.off("moveend", report);
    };
  }, [map]);

  /* ── Focus in: move when the feature asks for a new view ── */
  const focusKey = JSON.stringify(focus);
  const firstFocus = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the focus value, not its identity.
  useEffect(() => {
    if (!map) return;
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    const el = container.current;
    if (typeof focus === "object" && "center" in focus) {
      map.easeTo({
        center: [focus.center.lng, focus.center.lat],
        zoom: focus.zoom,
        ...motion(reduced),
      });
    } else {
      const b = focusBounds(focus, latest.current.data) ?? toLngLat(SF_BOUNDS);
      if (el) map.fitBounds(b, { padding: fitPadding(insets, el), ...motion(reduced) });
    }
  }, [map, focusKey]);

  /* ── Neighborhoods: hover highlight, click to zoom in ── */
  const hoodLayer = layers.find((l) => l.kind === "neighborhoods");
  const onHoodSelect = useRef(hoodLayer?.kind === "neighborhoods" ? hoodLayer.onSelect : undefined);
  onHoodSelect.current = hoodLayer?.kind === "neighborhoods" ? hoodLayer.onSelect : undefined;
  useEffect(() => {
    if (!map) return;
    let hover: number | string | null = null;
    const setHover = (id: number | string | null) => {
      if (hover === id) return;
      if (hover !== null && map.getSource(SRC.hoods))
        map.setFeatureState({ source: SRC.hoods, id: hover }, { hover: false });
      hover = id;
      if (id !== null) map.setFeatureState({ source: SRC.hoods, id }, { hover: true });
      map.getCanvas().style.cursor = id === null ? "" : "pointer";
    };
    const onMove = (e: MapLayerMouseEvent) => {
      if (inMarker(e.originalEvent.target)) return setHover(null);
      setHover(e.features?.[0]?.id ?? null);
    };
    const onLeave = () => setHover(null);
    const onClick = (e: MapMouseEvent) => {
      if (inMarker(e.originalEvent.target)) return;
      setSelected(null);
      const f = map.queryRenderedFeatures(e.point, { layers: [HOOD_FILL] })[0];
      const hood = latest.current.data.hoods.find((n) => n.slug === f?.properties.slug);
      if (!hood || !container.current) return;
      map.fitBounds(polygonBounds(hood.polygon), {
        padding: fitPadding(latest.current.insets, container.current, 48),
        maxZoom: 15,
        ...motion(reduced),
      });
      onHoodSelect.current?.(hood);
    };
    map.on("mousemove", HOOD_FILL, onMove);
    map.on("mouseleave", HOOD_FILL, onLeave);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", HOOD_FILL, onMove);
      map.off("mouseleave", HOOD_FILL, onLeave);
      map.off("click", onClick);
    };
  }, [map, reduced]);

  /* ── Selection ── */
  // Focus moves into an opened card and back to its pin when the card closes,
  // so keyboard users don't tab past every other pin to reach it.
  const trigger = useRef<HTMLElement | null>(null);
  const open = (s: Selected) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(s);
  };
  const close = (restoreFocus: boolean) => {
    setSelected(null);
    if (restoreFocus && trigger.current?.isConnected)
      trigger.current.focus({ preventScroll: true });
  };
  const openPin = (p: Pin) => open(toSelected(p));
  // The card shows the latest data for its pin or stop, so a price change shows at once.
  const shown = useMemo<Selected | null>(() => {
    if (!selected) return null;
    if (selected.kind === "stop") {
      const n = data.stops.findIndex((s) => s.key === selected.stop.key);
      const stop = data.stops[n];
      return stop ? { kind: "stop", stop, n: n + 1 } : null;
    }
    const p = pinsByKey.get(`${selected.kind[0]}:${selected.pin._id}`);
    return p ? toSelected(p) : null;
  }, [selected, data.stops, pinsByKey]);
  const selectedKey =
    selected === null
      ? null
      : selected.kind === "stop"
        ? `s:${selected.stop.key}`
        : `${selected.kind[0]}:${selected.pin._id}`;
  const selectedPoint: LatLng | null =
    shown === null ? null : shown.kind === "stop" ? shown.stop.point : shown.pin.point;

  const expand = async (v: Extract<Visible, { kind: "cluster" }>) => {
    if (!map) return;
    let zoom = map.getZoom() + 2;
    try {
      const source = map.getSource<GeoJSONSource>(SRC.pins);
      if (source) zoom = await source.getClusterExpansionZoom(v.clusterId);
    } catch {
      // The cluster was re-made by a data update; zooming in two levels is close enough.
    }
    map.easeTo({
      center: [v.lng, v.lat],
      zoom: Math.min(zoom + 0.25, MAX_ZOOM),
      ...motion(reduced),
    });
  };

  // Keep an opened card fully on screen, and on phones keep its pin clear of
  // the sheet: nudge the map, never the card.
  const card = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a different card opens.
  useEffect(() => {
    if (!selectedKey) return;
    const frame = requestAnimationFrame(() => {
      card.current?.querySelector<HTMLElement>("[role=dialog]")?.focus({ preventScroll: true });
      const el = card.current;
      const box = container.current?.getBoundingClientRect();
      if (!map || !el || !box || !selectedPoint) return;
      const r = el.getBoundingClientRect();
      const top = box.top + insets.top + EDGE;
      if (compact) {
        const pin = map.project([selectedPoint.lng, selectedPoint.lat]);
        const pinY = box.top + pin.y;
        const below = pinY + 32 - (r.top - EDGE);
        const above = top + 24 - pinY;
        const dy = below > 0 ? below : above > 0 ? -above : 0;
        if (dy) map.panBy([0, dy], motion(reduced));
        return;
      }
      const bottom = box.bottom - insets.bottom - EDGE;
      const left = box.left + insets.left + EDGE;
      const right = box.right - insets.right - EDGE;
      const dx = r.left < left ? r.left - left : r.right > right ? r.right - right : 0;
      const dy = r.top < top ? r.top - top : r.bottom > bottom ? r.bottom - bottom : 0;
      if (dx || dy) map.panBy([dx, dy], motion(reduced));
    });
    return () => cancelAnimationFrame(frame);
  }, [map, selectedKey, compact]);

  const zoomBy = (d: number) => map?.easeTo({ zoom: map.getZoom() + d, ...motion(reduced) });

  return (
    <div className={className}>
      <section
        aria-label={label}
        className="lm-root relative isolate h-full w-full overflow-hidden bg-[#f2f3f0] dark:bg-[#1f1f20]"
        onKeyDown={(e) => {
          if (e.key === "Escape" && selected) {
            e.stopPropagation();
            close(true);
          }
        }}
      >
        <div ref={container} className="h-full w-full" />

        {map &&
          visible.map((v) => {
            if (v.kind === "cluster") {
              const parts = [
                v.counts.listing && plural(v.counts.listing, "listing"),
                v.counts.event && plural(v.counts.event, "event"),
                v.counts.group && plural(v.counts.group, "group"),
              ].filter(Boolean);
              return (
                <MapMarker
                  key={v.id}
                  map={map}
                  lng={v.lng}
                  lat={v.lat}
                  z={hovered === v.id ? Z.hover : Z.cluster}
                >
                  <ClusterBubble
                    counts={v.counts}
                    aria-label={`${parts.join(", ")}. Zoom in`}
                    onClick={() => expand(v)}
                    onMouseEnter={() => setHovered(v.id)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </MapMarker>
              );
            }
            const p = v.pin;
            const isSel = selectedKey === p.key;
            const common = {
              selected: isSel,
              onClick: () => (isSel ? close(false) : openPin(p)),
              onMouseEnter: () => setHovered(p.key),
              onMouseLeave: () => setHovered(null),
            };
            return (
              <MapMarker
                key={p.key}
                map={map}
                lng={p.pin.point.lng}
                lat={p.pin.point.lat}
                z={isSel ? Z.card - 1 : hovered === p.key ? Z.hover : Z[p.kind]}
              >
                {p.kind === "listing" ? (
                  <PricePill
                    pin={p.pin}
                    aria-label={`${pillPrice(p.pin.price)}, ${p.pin.title}, ${p.pin.area}`}
                    {...common}
                  />
                ) : p.kind === "event" ? (
                  <DateBadge pin={p.pin} aria-label={`Event: ${p.pin.title}`} {...common} />
                ) : (
                  <GroupAvatar pin={p.pin} aria-label={`Group: ${p.pin.name}`} {...common} />
                )}
              </MapMarker>
            );
          })}

        {map &&
          data.stops.map((s, i) => {
            const key = `s:${s.key}`;
            const isSel = selectedKey === key;
            return (
              <MapMarker
                key={key}
                map={map}
                lng={s.point.lng}
                lat={s.point.lat}
                z={isSel ? Z.card - 1 : hovered === key ? Z.hover : Z.stop}
              >
                <StopMarker
                  n={i + 1}
                  selected={isSel}
                  aria-label={`Stop ${i + 1}: ${s.name}`}
                  onClick={() => (isSel ? close(false) : open({ kind: "stop", stop: s, n: i + 1 }))}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                />
              </MapMarker>
            );
          })}

        {map && shown && selectedPoint && !compact && (
          <MapMarker
            key={selectedKey}
            map={map}
            lng={selectedPoint.lng}
            lat={selectedPoint.lat}
            anchor="bottom"
            offset={[0, shown.kind === "listing" ? -19 : -24]}
            z={Z.card}
            isolate
          >
            <div ref={card} className="lm-card-in pb-1">
              <PreviewCard selected={shown} compact={false} onClose={() => close(true)} />
            </div>
          </MapMarker>
        )}

        {shown && compact && (
          <div
            ref={card}
            className="lm-sheet-in absolute inset-x-3 z-20"
            style={{ bottom: insets.bottom + 12 }}
          >
            <PreviewCard key={selectedKey} selected={shown} compact onClose={() => close(true)} />
          </div>
        )}

        <div
          className={cn(
            "absolute top-4 right-4 z-10 flex-col overflow-hidden rounded-[10px] bg-card shadow-[var(--lm-float)]",
            // Phones pinch to zoom; the buttons would crowd the chips.
            compact ? "hidden" : "flex",
          )}
        >
          <ZoomButton label="Zoom in" onClick={() => zoomBy(1)}>
            <Plus size={18} strokeWidth={2.25} />
          </ZoomButton>
          <span className="mx-2 h-px bg-divider-soft" />
          <ZoomButton label="Zoom out" onClick={() => zoomBy(-1)}>
            <Minus size={18} strokeWidth={2.25} />
          </ZoomButton>
        </div>

        {!map && !failed && <div className="lm-skeleton absolute inset-0" aria-hidden />}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="max-w-[280px] text-[15px] text-secondary leading-5">
              The map couldn't load. Check your connection and refresh the page.
            </p>
          </div>
        )}

        {children}
      </section>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center text-icon transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none active:bg-pressed"
    >
      {children}
    </button>
  );
}

/* ───────────── Helpers ───────────── */

type Insets = { top: number; right: number; bottom: number; left: number };

function motion(reduced: boolean) {
  return reduced ? { duration: 0 } : { duration: 420, essential: false };
}

function fitPadding(p: Insets, el: HTMLElement, extra = 24) {
  // Never let padding swallow the map on small screens.
  const w = el.clientWidth;
  const h = el.clientHeight;
  const clamp = (v: number, size: number) => Math.max(0, Math.min(v + extra, size * 0.3));
  return {
    top: clamp(p.top, h),
    bottom: clamp(p.bottom, h),
    left: clamp(p.left, w),
    right: clamp(p.right, w),
  };
}

function toLngLat(b: Bounds): LngLatBoundsLike {
  return [
    [b.west, b.south],
    [b.east, b.north],
  ];
}

/** The box a focus asks for; null means "all of San Francisco". */
function focusBounds(focus: MapFocus, data: OverlayData): LngLatBoundsLike | null {
  if (focus === "city") return null;
  if (typeof focus === "object") {
    if ("bounds" in focus) return toLngLat(focus.bounds);
    const d = 0.01 * 2 ** (13 - focus.zoom);
    return toLngLat({
      west: focus.center.lng - d,
      east: focus.center.lng + d,
      south: focus.center.lat - d * 0.8,
      north: focus.center.lat + d * 0.8,
    });
  }
  // Pins and stops decide the view; neighborhoods only when there's nothing else.
  let pts: LatLng[] = [...data.pins.map((p) => p.pin.point), ...data.stops.map((s) => s.point)];
  if (!pts.length) pts = data.hoods.map((n) => n.center);
  if (!pts.length) return null;
  const b = pts.reduce<Bounds>(
    (a, p) => ({
      west: Math.min(a.west, p.lng),
      east: Math.max(a.east, p.lng),
      south: Math.min(a.south, p.lat),
      north: Math.max(a.north, p.lat),
    }),
    { west: 180, east: -180, south: 90, north: -90 },
  );
  // A single point still needs a neighborhood's worth of context around it.
  const pad = 0.004;
  return toLngLat({
    west: b.west - pad,
    east: b.east + pad,
    south: b.south - pad,
    north: b.north + pad,
  });
}

function polygonBounds(polygon: number[][][][]): LngLatBoundsLike {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const poly of polygon)
    for (const [lng, lat] of poly[0] ?? []) {
      if (lng === undefined || lat === undefined) continue;
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  return [
    [west, south],
    [east, north],
  ];
}

function toSelected(p: Pin): Selected {
  if (p.kind === "listing") return { kind: "listing", pin: p.pin };
  if (p.kind === "event") return { kind: "event", pin: p.pin };
  return { kind: "group", pin: p.pin };
}

function inMarker(target: EventTarget | null) {
  return target instanceof Element && target.closest(".maplibregl-marker") !== null;
}

function toVisible(f: GeoJSONFeature, pins: Map<string, Pin>): Visible | null {
  const p = f.properties;
  if (p.cluster) {
    if (f.geometry.type !== "Point") return null;
    const [lng, lat] = f.geometry.coordinates;
    if (lng === undefined || lat === undefined) return null;
    return {
      id: `c:${p.cluster_id}`,
      kind: "cluster",
      clusterId: Number(p.cluster_id),
      lng,
      lat,
      counts: { listing: Number(p.listing), event: Number(p.event), group: Number(p.group) },
    };
  }
  const pin = pins.get(String(p.key));
  return pin ? { id: pin.key, kind: "pin", pin } : null;
}

function sameVisible(a: Visible[], b: Visible[]) {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((v) => [v.id, v]));
  return a.every((v) => sameItem(v, byId.get(v.id)));
}

function sameItem(a: Visible, b: Visible | undefined) {
  if (!b) return false;
  if (a.kind === "pin" && b.kind === "pin") return a.pin === b.pin;
  if (a.kind === "cluster" && b.kind === "cluster") return a.lng === b.lng && a.lat === b.lat;
  return false;
}
