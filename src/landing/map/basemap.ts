import type { StyleSpecification } from "maplibre-gl";
import type { Bounds } from "./types";

/**
 * The basemap: OpenFreeMap's Positron (light) and Dark styles, the same keyless
 * vector tiles and styles the static maps in `public/seed/maps` were rendered
 * from (`scripts/maps/build.py`), so the live map matches them.
 */
const STYLE_URL = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** San Francisco, edge to edge. */
export const SF_BOUNDS: Bounds = { west: -122.515, south: 37.706, east: -122.356, north: 37.812 };
/** How far the camera may roam: the Bay Area around the city. */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-122.95, 37.45],
  [-121.85, 38.1],
];
export const MIN_ZOOM = 9.5;
export const MAX_ZOOM = 17.5;

const cache = new Map<string, Promise<StyleSpecification>>();

/** The basemap style for a theme, tuned to Facebook's surfaces. */
export function loadBasemap(theme: "light" | "dark"): Promise<StyleSpecification> {
  let style = cache.get(theme);
  if (!style) {
    style = fetch(STYLE_URL[theme])
      .then((r) => {
        if (!r.ok) throw new Error(`Basemap style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then((s) => tune(s, theme));
    style.catch(() => cache.delete(theme));
    cache.set(theme, style);
  }
  return style;
}

/** Basemap labels that our neighborhood labels replace when that layer is on. */
export const PLACE_LABEL_LAYERS = ["label_other", "place_other", "place_suburb"];

function tune(style: StyleSpecification, theme: "light" | "dark"): StyleSpecification {
  const layers = style.layers
    // Calm the map: no house numbers, POI clutter or one-way arrows.
    .filter((l) => !/housenumber|poi|oneway|shield/.test(l.id))
    .map((layer) => {
      if (!("paint" in layer) || !layer.paint) return layer;
      const paint = Object.fromEntries(
        Object.entries(layer.paint)
          // Patterns (Dark's wood texture) aren't in the sprite; the fill color stands in.
          .filter(([k]) => k !== "fill-pattern")
          .map(([k, v]) => [k, theme === "dark" && k.endsWith("color") ? liftAll(v) : v]),
      );
      return { ...layer, paint } as typeof layer;
    });
  return { ...style, layers };
}

/* ───────────── Dark tuning ───────────── */

/**
 * Lift the near-black Dark style to Facebook's dark surface tones: the same
 * curve `scripts/maps/build.py` applies to the static dark maps (v → 22 + 0.95v).
 */
const lift = (v: number) => Math.round(22 + v * 0.95);

function liftAll(value: unknown): unknown {
  if (typeof value === "string") return liftColor(value);
  if (Array.isArray(value)) return value.map(liftAll);
  return value;
}

function liftColor(css: string): string {
  const rgba = parseColor(css);
  if (!rgba) return css;
  const [r, g, b, a] = rgba;
  return `rgba(${lift(r)},${lift(g)},${lift(b)},${a})`;
}

/** `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, `hsl()` and `hsla()`; null for anything else. */
export function parseColor(css: string): [number, number, number, number] | null {
  const s = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)).concat(1) as [
      number,
      number,
      number,
      number,
    ];
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (!fn?.[1] || fn[2] === undefined) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  const num = (p: string | undefined) => Number.parseFloat(p ?? "");
  const alpha = parts[3] === undefined ? 1 : num(parts[3]);
  if (fn[1].startsWith("rgb")) {
    const [r, g, b] = parts.map(num);
    if ([r, g, b, alpha].some((x) => x === undefined || Number.isNaN(x))) return null;
    return [r as number, g as number, b as number, alpha];
  }
  const h = num(parts[0]);
  const sat = num(parts[1]) / 100;
  const l = num(parts[2]) / 100;
  if ([h, sat, l, alpha].some(Number.isNaN)) return null;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), alpha];
}
