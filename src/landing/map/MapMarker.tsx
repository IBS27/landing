import { Marker, type Map as MlMap, type PositionAnchor } from "maplibre-gl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Events a floating card keeps to itself, so pressing, scrolling or double-clicking it doesn't move the map. */
const ISOLATED = ["mousedown", "touchstart", "wheel", "dblclick"] as const;

/**
 * React content pinned to a map coordinate: a MapLibre `Marker` whose element
 * is a React portal. MapLibre positions it with a transform as the camera
 * moves, so nothing re-renders while panning.
 */
export function MapMarker({
  map,
  lng,
  lat,
  z = 0,
  anchor = "center",
  offset,
  isolate,
  children,
}: {
  map: MlMap;
  lng: number;
  lat: number;
  z?: number;
  anchor?: PositionAnchor;
  offset?: [number, number];
  /** Keep pointer and wheel events from reaching the map (cards, not pins). */
  isolate?: boolean;
  children: ReactNode;
}) {
  const [el] = useState(() => document.createElement("div"));
  const marker = useRef<Marker | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: created once per map; position updates below.
  useEffect(() => {
    const m = new Marker({ element: el, anchor, offset, subpixelPositioning: true })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.current = m;
    return () => {
      m.remove();
      marker.current = null;
    };
  }, [map, el, anchor]);

  useEffect(() => {
    marker.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  useEffect(() => {
    if (offset) marker.current?.setOffset(offset);
  }, [offset?.[0], offset?.[1]]);

  useEffect(() => {
    el.style.zIndex = String(z);
  }, [el, z]);

  useEffect(() => {
    if (!isolate) return;
    const stop = (e: Event) => e.stopPropagation();
    for (const type of ISOLATED) el.addEventListener(type, stop, { passive: true });
    return () => {
      for (const type of ISOLATED) el.removeEventListener(type, stop);
    };
  }, [el, isolate]);

  return createPortal(children, el);
}
