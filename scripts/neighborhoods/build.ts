/**
 * Builds the neighborhood data the app and the seed use, from live public sources.
 *
 *   bun scripts/neighborhoods/build.ts            # everything
 *   bun scripts/neighborhoods/build.ts boundaries # one step (boundaries | transit | addresses | service)
 *
 * 1. boundaries: DataSF "Analysis Neighborhoods" (41 polygons, public domain), simplified to
 *    ~5 m → convex/lib/neighborhoodBoundaries.ts
 * 2. transit: BART, SFMTA (Muni Metro) and Caltrain GTFS feeds, plus each station's or line's
 *    official page as the human-readable source → convex/seed/world/neighborhoods/transit.ts
 * 3. addresses: OpenStreetMap (Overpass) intersections for the seeded rentals' cross streets, and
 *    the event venue points from scripts/maps/build.py → convex/seed/lib/geocoded.ts
 * 4. service: per neighborhood, weekday trips an hour, Muni lines (all-night ones flagged) and last
 *    trains from the GTFS feeds, plus 311 streetlight requests (DataSF)
 *    → convex/seed/world/neighborhoods/service.ts
 *
 * Every external source is recorded as a snapshot (url, title, publisher, verbatim snippet,
 * fetchedAt) for the `externalSources` table (#7). Licenses: DataSF is public domain (ODC PDDL),
 * OpenStreetMap is ODbL, and the SFMTA, BART and Caltrain feeds are published for public reuse
 * (SFMTA's license ships in its feed). No dependencies beyond Bun.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  bboxOf,
  decodePolyline,
  distanceMeters,
  edgeDistanceMeters,
  encodePolyline,
  type LatLng,
  labelPoint,
  type MultiPolygon,
  pointInMultiPolygon,
  ringAreaMeters,
  simplifyRing,
} from "../../convex/lib/geo";
import { neighborhoods as places } from "../../convex/seed/lib/places";
import { rentals } from "../../convex/seed/world/rentals";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "../..");
const UA = "Mozilla/5.0 (compatible; neighborhood-data-script/1.0)";
const SIMPLIFY_METERS = 5;
/** Islands and slivers smaller than this are dropped (never a neighborhood's largest polygon). */
const MIN_POLYGON_M2 = 2_000;

type Snapshot = { url: string; title: string; publisher: string; snippet: string; fetchedAt: number };

// ── Fetching ────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, init?: RequestInit, tries = 5): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
        redirect: "follow",
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      await Bun.sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`fetch failed: ${url}: ${String(last)}`);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

type Page = { url: string; title: string; text: string[]; meta: Record<string, string> };

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Fetches an HTML page: final URL after redirects, title, meta tags, and visible text lines. */
async function fetchPage(url: string): Promise<Page | null> {
  const res = await fetchWithRetry(url);
  if (!res.ok) return null;
  const html = await res.text();
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const name = /(?:name|property)="([^"]+)"/i.exec(m[1])?.[1];
    const content = /content="([^"]*)"/i.exec(m[1])?.[1];
    if (name && content !== undefined) meta[name.toLowerCase()] = decodeEntities(content).trim();
  }
  const title =
    meta["og:title"] ?? decodeEntities(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim();
  const body = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, "\n");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { url: res.url, title, text, meta };
}

/**
 * Citation chips show at most this many characters (`SNIPPET_MAX` in convex/lib/citations.ts),
 * so snippets are stored no longer, with the supporting words up front.
 */
const SNIPPET_MAX = 160;

/** Cut to `max` characters on a word boundary, like `snippet()` in convex/lib/citations.ts. */
function cut(text: string, max = SNIPPET_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max * 0.6 ? head.slice(0, space) : head).trimEnd()}…`;
}

// ── Zip and CSV (GTFS) ─────────────────────────────────────────────────────

function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const files = new Map<string, Uint8Array>();
  let p = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip central directory");
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = buf.subarray(start, start + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, new Uint8Array(inflateRawSync(data)));
    else throw new Error(`unsupported zip method ${method} for ${name}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function parseCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(",");
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

type Gtfs = {
  url: string;
  files: Map<string, Uint8Array>;
  fetchedAt: number;
  /** Last service date in the feed's calendar ("2026-08-28"). Stop locations outlive it. */
  serviceThrough: string;
};

function table(feed: Gtfs, name: string): { rows: Record<string, string>[]; lines: string[] } {
  const bytes = feed.files.get(name);
  if (!bytes) throw new Error(`${feed.url} has no ${name}`);
  const lines = new TextDecoder()
    .decode(bytes)
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
  return { rows, lines: lines.slice(1) };
}

async function loadFeed(url: string): Promise<Gtfs> {
  const fetchedAt = Date.now();
  const feed: Gtfs = { url, files: unzip(await fetchBytes(url)), fetchedAt, serviceThrough: "" };
  const ends: string[] = [];
  if (feed.files.has("calendar.txt")) ends.push(...table(feed, "calendar.txt").rows.map((r) => r.end_date));
  if (feed.files.has("calendar_dates.txt")) {
    ends.push(...table(feed, "calendar_dates.txt").rows.map((r) => r.date));
  }
  const last = ends.filter((d) => /^\d{8}$/.test(d)).sort().at(-1) ?? "";
  feed.serviceThrough = last ? `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6)}` : "";
  if (feed.serviceThrough && new Date(`${feed.serviceThrough}T23:59:59Z`).getTime() < fetchedAt) {
    console.warn(`  ! ${url}: schedule ended ${feed.serviceThrough}; stop locations still used`);
  }
  return feed;
}

// ── 1. Boundaries ─────────────────────────────────────────────────────────

const DATASF_DATASET = "https://data.sf.gov/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/j2bu-swwd";
const DATASF_META = "https://data.sf.gov/api/views/j2bu-swwd.json";
const DATASF_GEOJSON = "https://data.sf.gov/resource/j2bu-swwd.geojson?$limit=1000";

type Boundary = { slug: string; name: string; polygon: MultiPolygon };

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function buildBoundaries(): Promise<Boundary[]> {
  const fetchedAt = Date.now();
  const meta = await fetchJson<{ name: string; description: string; rowsUpdatedAt: number }>(
    DATASF_META,
  );
  const geo = await fetchJson<{
    features: { properties: { nhood: string }; geometry: { type: string; coordinates: MultiPolygon } }[];
  }>(DATASF_GEOJSON);
  if (geo.features.length !== 41) throw new Error(`expected 41 neighborhoods, got ${geo.features.length}`);
  // The sentence that says what the boundaries are: "...created these 41 neighborhoods by
  // grouping 2010 Census tracts, using common real estate and residents' definitions...".
  const description = meta.description.replace(/\s+/g, " ");
  const from = description.indexOf("created these 41 neighborhoods");
  if (from < 0) throw new Error("DataSF description changed; pick a new passage");
  const upTo = description.indexOf("definitions", from);
  const summary = `…${description.slice(from, upTo > 0 ? upTo + "definitions".length : undefined)}`;
  const source: Snapshot = {
    url: DATASF_DATASET,
    title: `${meta.name} | DataSF`,
    publisher: "DataSF",
    snippet: cut(summary),
    fetchedAt,
  };

  const boundaries: Boundary[] = geo.features
    .map((f) => {
      if (f.geometry.type !== "MultiPolygon") throw new Error(`${f.properties.nhood}: ${f.geometry.type}`);
      const polygons = f.geometry.coordinates
        .map((polygon) => polygon.map((ring) => simplifyRing(ring, SIMPLIFY_METERS)))
        .filter((polygon) => polygon[0] && polygon[0].length >= 4);
      const largest = Math.max(...polygons.map((p) => ringAreaMeters(p[0])));
      const kept = polygons
        .filter((p) => ringAreaMeters(p[0]) >= Math.min(MIN_POLYGON_M2, largest))
        .map(([outer, ...holes]) => [outer, ...holes.filter((h) => h.length >= 4 && ringAreaMeters(h) >= 50)]);
      return { slug: slugify(f.properties.nhood), name: f.properties.nhood, polygon: kept };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const rows = boundaries.map((b) => {
    const center = labelPoint(b.polygon);
    const box = bboxOf(b.polygon);
    const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
    return `  ${JSON.stringify(b.slug)}: {
    name: ${JSON.stringify(b.name)},
    center: { lat: ${center.lat}, lng: ${center.lng} },
    bbox: { west: ${r5(box.west)}, south: ${r5(box.south)}, east: ${r5(box.east)}, north: ${r5(box.north)} },
    rings: [${b.polygon.map((p) => `[${p.map((ring) => JSON.stringify(encodePolyline(ring))).join(", ")}]`).join(", ")}],
  },`;
  });
  const points = boundaries.reduce((n, b) => n + b.polygon.flat().reduce((m, r) => m + r.length, 0), 0);
  const out = `/**
 * Generated by scripts/neighborhoods/build.ts from DataSF's "Analysis Neighborhoods"
 * (${DATASF_DATASET}, public domain, rows updated ${new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10)}).
 * Do not edit by hand: rerun the script. Rings are simplified to ~${SIMPLIFY_METERS} m (${points} points in all)
 * and stored as encoded polylines (\`decodePolyline\` in ./geo); positions are [lng, lat].
 */
import type { BBox, LatLng } from "./geo";

export type EncodedBoundary = {
  /** DataSF's name for the neighborhood. */
  name: string;
  /** Label point, always inside the largest polygon. */
  center: LatLng;
  bbox: BBox;
  /** Polygons → rings (outer first, then holes) as encoded polylines. */
  rings: string[][];
};

/** The DataSF snapshot every boundary cites. */
export const BOUNDARY_SOURCE = ${JSON.stringify(source, null, 2)};

/** Keyed by slug: the DataSF name, slugified. */
export const BOUNDARIES: Record<string, EncodedBoundary> = {
${rows.join("\n")}
};
`;
  write("convex/lib/neighborhoodBoundaries.ts", out);
  console.log(`boundaries: ${boundaries.length} neighborhoods, ${points} points`);
  return boundaries;
}

async function loadBoundaries(): Promise<Boundary[]> {
  // Reads the generated file back (used when only later steps run).
  const { BOUNDARIES } = await import("../../convex/lib/neighborhoodBoundaries");
  const out = Object.entries(BOUNDARIES).map(([slug, b]) => ({
    slug,
    name: b.name,
    polygon: b.rings.map((p) => p.map(decodePolyline)),
  }));
  if (out.length !== 41) throw new Error("run the boundaries step first");
  return out;
}

/** True when the point is in (or within 25 m of) San Francisco's neighborhoods. */
function inSf(p: LatLng, boundaries: Boundary[]): boolean {
  return boundaries.some(
    (b) => pointInMultiPolygon(p, b.polygon) || edgeDistanceMeters(p, b.polygon) <= 25,
  );
}

// ── 2. Transit ──────────────────────────────────────────────────────────────

const BART_GTFS = "https://www.bart.gov/dev/schedules/google_transit.zip";
const MUNI_GTFS = "https://muni-gtfs.apps.sfmta.com/data/muni_gtfs-current.zip";
const CALTRAIN_GTFS = "https://data.trilliumtransit.com/gtfs/caltrain-ca-us/caltrain-ca-us.zip";
const BART_LINE_ORDER = ["Red", "Orange", "Yellow", "Green", "Blue", "Grey"];
const METRO_LINES = ["J", "K", "L", "M", "N", "T"];
/** Muni Metro subway stations (Market Street subway, Twin Peaks Tunnel, Central Subway). */
const SUBWAY =
  /^(?:Metro )?(Embarcadero|Montgomery|Powell|Civic Center|Van Ness|Church|Castro|Forest Hill|West Portal|Chinatown - Rose Pak|Union Square\/Market St|Yerba Buena\/Moscone) Station/;
const SUBWAY_NAMES: Record<string, string> = {
  "Chinatown - Rose Pak": "Chinatown–Rose Pak",
  "Union Square/Market St": "Union Square/Market Street",
};

type StationOut = {
  key: string;
  system: "bart" | "muni_metro" | "caltrain";
  name: string;
  lines: string[];
  point: LatLng;
  sources: string[];
};
type LineOut = {
  key: string;
  system: "muni_metro";
  line: string;
  name: string;
  stops: { name: string; point: LatLng }[];
  sources: string[];
};

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
const pt = (lat: string, lng: string): LatLng => ({
  lat: Math.round(Number(lat) * 1e6) / 1e6,
  lng: Math.round(Number(lng) * 1e6) / 1e6,
});

function feedSnapshot(
  feed: Gtfs,
  publisher: string,
  title: string,
  rowText: string,
): Snapshot {
  // Say which schedule the row comes from, so an expired feed is visible in the citation.
  const window = feed.serviceThrough ? `, schedule through ${feed.serviceThrough}` : "";
  return {
    url: feed.url,
    title: `${title}${window}`,
    publisher,
    snippet: cut(rowText),
    fetchedAt: feed.fetchedAt,
  };
}

async function buildTransit(boundaries: Boundary[]) {
  const sources = new Map<string, Snapshot>();
  /** GTFS rows are cited per station, so each gets its own snapshot keyed by url + row. */
  const rowSource = (snap: Snapshot) => {
    const key = `${snap.url}#${snap.snippet}`;
    sources.set(key, snap);
    return key;
  };
  const pageSource = async (url: string, publisher: string, pick: (p: Page) => string | null) => {
    const fetchedAt = Date.now();
    const page = await fetchPage(url);
    if (!page) {
      console.warn(`  ! no page at ${url}`);
      return null;
    }
    const snippet = pick(page);
    if (!snippet) {
      console.warn(`  ! nothing quotable on ${page.url}`);
      return null;
    }
    const snap: Snapshot = { url: page.url, title: page.title, publisher, snippet: cut(snippet), fetchedAt };
    sources.set(snap.url, snap);
    return snap.url;
  };
  const stations: StationOut[] = [];
  const lines: LineOut[] = [];

  // BART: stations with the lines that stop there.
  const bart = await loadFeed(BART_GTFS);
  {
    const routes = new Map(
      table(bart, "routes.txt").rows.map((r) => [r.route_id, r.route_short_name.split("-")[0]]),
    );
    const tripRoute = new Map(table(bart, "trips.txt").rows.map((t) => [t.trip_id, t.route_id]));
    const stopsTable = table(bart, "stops.txt");
    const parentOf = new Map(stopsTable.rows.map((s) => [s.stop_id, s.parent_station || s.stop_id]));
    const linesAt = new Map<string, Set<string>>();
    for (const st of table(bart, "stop_times.txt").rows) {
      const color = routes.get(tripRoute.get(st.trip_id) ?? "");
      const parent = parentOf.get(st.stop_id);
      if (!color || !parent) continue;
      if (!linesAt.has(parent)) linesAt.set(parent, new Set());
      linesAt.get(parent)?.add(color);
    }
    for (const [i, s] of stopsTable.rows.entries()) {
      if (s.location_type !== "1") continue;
      const point = pt(s.stop_lat, s.stop_lon);
      if (!inSf(point, boundaries)) continue;
      const page = s.stop_url
        ? await pageSource(s.stop_url, "BART", (p) =>
            p.text.find((l) => /^\d+ .+, San Francisco, CA \d{5}$/.test(l)) ?? null,
          )
        : null;
      const feedKey = rowSource(
        feedSnapshot(bart, "BART", "BART GTFS schedule feed (stops.txt)", stopsTable.lines[i]),
      );
      stations.push({
        key: `bart:${s.stop_id.toLowerCase()}`,
        system: "bart",
        name: s.stop_name,
        lines: BART_LINE_ORDER.filter((c) => linesAt.get(s.stop_id)?.has(c)),
        point,
        sources: page ? [page, feedKey] : [feedKey],
      });
    }
  }

  // Muni Metro: each line's stops (both directions, deduped by name) and the subway stations.
  const muni = await loadFeed(MUNI_GTFS);
  {
    const routesTable = table(muni, "routes.txt");
    const metro = routesTable.rows
      .map((r, i) => ({ ...r, line: routesTable.lines[i] }))
      .filter((r) => r.route_type === "0" && METRO_LINES.includes(r.route_short_name));
    const routeIds = new Set(metro.map((r) => r.route_id));
    const trips = table(muni, "trips.txt").rows.filter((t) => routeIds.has(t.route_id));
    const tripInfo = new Map(trips.map((t) => [t.trip_id, t]));
    const stopsTable = table(muni, "stops.txt");
    const stopRow = new Map(stopsTable.rows.map((s, i) => [s.stop_id, { ...s, line: stopsTable.lines[i] }]));
    const tripStops = new Map<string, { seq: number; stop: string }[]>();
    const stopTimes = muni.files.get("stop_times.txt");
    if (!stopTimes) throw new Error("muni feed has no stop_times.txt");
    const text = new TextDecoder().decode(stopTimes).replace(/^﻿/, "").split(/\r?\n/);
    const header = text[0].split(",");
    const [iTrip, iStop, iSeq] = ["trip_id", "stop_id", "stop_sequence"].map((h) => header.indexOf(h));
    for (let n = 1; n < text.length; n++) {
      const cells = text[n].split(",");
      const trip = cells[iTrip];
      if (!tripInfo.has(trip)) continue;
      if (!tripStops.has(trip)) tripStops.set(trip, []);
      tripStops.get(trip)?.push({ seq: Number(cells[iSeq]), stop: cells[iStop] });
    }
    // Subway stations: one point per station (the average of its platforms), used both for the
    // station fact and wherever a line stops there, so the two always agree.
    const platforms = new Map<string, { lat: number; lng: number; rows: string[] }>();
    for (const s of stopsTable.rows) {
      const sub = SUBWAY.exec(s.stop_name);
      if (!sub) continue;
      const name = `${SUBWAY_NAMES[sub[1]] ?? sub[1]} Station`;
      const cur = platforms.get(name) ?? { lat: 0, lng: 0, rows: [] };
      cur.lat += Number(s.stop_lat);
      cur.lng += Number(s.stop_lon);
      cur.rows.push(stopRow.get(s.stop_id)?.line ?? "");
      platforms.set(name, cur);
    }
    const stationPoint = new Map(
      [...platforms].map(([name, p]) => [
        name,
        pt(String(p.lat / p.rows.length), String(p.lng / p.rows.length)),
      ]),
    );
    const stopOf = (stopId: string) => {
      const s = stopRow.get(stopId);
      if (!s) return null;
      const sub = SUBWAY.exec(s.stop_name);
      const name = sub ? `${SUBWAY_NAMES[sub[1]] ?? sub[1]} Station` : s.stop_name;
      return { name, point: stationPoint.get(name) ?? pt(s.stop_lat, s.stop_lon) };
    };
    /** Stops closer than this are the same stop (opposite platforms, renamed directions). */
    const SAME_STOP_METERS = 60;
    const servedBy = new Map<string, Set<string>>();
    for (const r of metro) {
      const pages = await pageSource(
        r.route_url,
        "SFMTA",
        (p) => p.meta["og:description"] ?? p.meta.description ?? null,
      );
      const feedKey = rowSource(
        feedSnapshot(muni, "SFMTA", "SFMTA Muni GTFS schedule feed (routes.txt)", r.line),
      );
      // Longest trip per direction gives the full ordered stop list.
      const longest = new Map<string, { seq: number; stop: string }[]>();
      for (const t of trips) {
        if (t.route_id !== r.route_id) continue;
        const stops = (tripStops.get(t.trip_id) ?? []).sort((a, b) => a.seq - b.seq);
        const cur = longest.get(t.direction_id);
        if (!cur || stops.length > cur.length) longest.set(t.direction_id, stops);
      }
      // One direction is the backbone, in route order. The other direction adds only stops the
      // backbone doesn't have, each inserted on the backbone segment it sits beside.
      const ordered: { name: string; point: LatLng }[] = [];
      const known = (x: { name: string; point: LatLng }) =>
        ordered.some((o) => o.name === x.name || distanceMeters(o.point, x.point) < SAME_STOP_METERS);
      const [first, ...others] = [...longest.keys()].sort();
      for (const dir of [first, ...others]) {
        for (const { stop } of longest.get(dir) ?? []) {
          const x = stopOf(stop);
          if (!x) continue;
          if (!servedBy.has(x.name)) servedBy.set(x.name, new Set());
          servedBy.get(x.name)?.add(r.route_short_name);
          if (known(x)) continue;
          if (dir === first || ordered.length < 2) {
            ordered.push(x);
            continue;
          }
          // Cheapest insertion: the spot (either end included) that lengthens the path least.
          const d = (i: number) => distanceMeters(ordered[i].point, x.point);
          let at = 0;
          let best = d(0);
          for (let i = 1; i <= ordered.length; i++) {
            const added =
              i === ordered.length
                ? d(i - 1)
                : d(i - 1) + d(i) - distanceMeters(ordered[i - 1].point, ordered[i].point);
            if (added < best) {
              best = added;
              at = i;
            }
          }
          ordered.splice(at, 0, x);
        }
      }
      const inCity = ordered.filter((s) => inSf(s.point, boundaries));
      lines.push({
        key: `muni:${r.route_short_name.toLowerCase()}`,
        system: "muni_metro",
        line: r.route_short_name,
        name: `${r.route_short_name} ${titleCase(r.route_long_name)}`,
        stops: inCity,
        sources: pages ? [pages, feedKey] : [feedKey],
      });
    }
    for (const [name, p] of [...platforms].sort((a, b) => a[0].localeCompare(b[0]))) {
      const served = [...(servedBy.get(name) ?? [])].sort();
      if (served.length === 0) continue;
      const point = stationPoint.get(name);
      if (!point || !inSf(point, boundaries)) continue;
      const feedKey = rowSource(
        feedSnapshot(muni, "SFMTA", "SFMTA Muni GTFS schedule feed (stops.txt)", p.rows[0]),
      );
      const linePages = lines
        .filter((l) => served.includes(l.line))
        .map((l) => l.sources[0])
        .filter((u) => !u.includes("#"));
      stations.push({
        key: `muni:${slugify(name)}`,
        system: "muni_metro",
        name,
        lines: served,
        point,
        sources: [feedKey, ...linePages.slice(0, 2)],
      });
    }
  }

  // Caltrain: stations in the city and the service patterns that stop there.
  const caltrain = await loadFeed(CALTRAIN_GTFS);
  {
    const routes = new Map(
      table(caltrain, "routes.txt").rows.map((r) => [
        r.route_id,
        r.route_short_name.replace(/ (Weekday|Weekend)$/, ""),
      ]),
    );
    const tripRoute = new Map(table(caltrain, "trips.txt").rows.map((t) => [t.trip_id, t.route_id]));
    const stopsTable = table(caltrain, "stops.txt");
    const parentOf = new Map(stopsTable.rows.map((s) => [s.stop_id, s.parent_station || s.stop_id]));
    const servedAt = new Map<string, Set<string>>();
    for (const st of table(caltrain, "stop_times.txt").rows) {
      const route = routes.get(tripRoute.get(st.trip_id) ?? "");
      const parent = parentOf.get(st.stop_id);
      if (!route || !parent) continue;
      if (!servedAt.has(parent)) servedAt.set(parent, new Set());
      servedAt.get(parent)?.add(route);
    }
    for (const [i, s] of stopsTable.rows.entries()) {
      if (s.location_type !== "1") continue;
      const point = pt(s.stop_lat, s.stop_lon);
      if (!inSf(point, boundaries)) continue;
      const name = s.stop_name.replace(/ Caltrain/, "").replace(/ Station$/, "");
      const pageUrl = `https://www.caltrain.com/station/${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const page = await pageSource(pageUrl, "Caltrain", (p) =>
        p.text.find((l) => /^\d+ .+, San Francisco,? (CA )?\d{5}$/.test(l)) ?? null,
      );
      const feedKey = rowSource(
        feedSnapshot(caltrain, "Caltrain", "Caltrain GTFS schedule feed (stops.txt)", stopsTable.lines[i]),
      );
      stations.push({
        key: `caltrain:${s.stop_id}`,
        system: "caltrain",
        name: s.stop_name,
        lines: ["Local", "Limited", "Express", "South County"].filter((r) => servedAt.get(s.stop_id)?.has(r)),
        point,
        sources: page ? [page, feedKey] : [feedKey],
      });
    }
  }

  const used = new Set([...stations, ...lines].flatMap((f) => f.sources));
  const snapshots = Object.fromEntries([...sources].filter(([k]) => used.has(k)));
  const out = `/**
 * Generated by scripts/neighborhoods/build.ts from the BART, SFMTA (Muni Metro) and Caltrain GTFS
 * feeds and the agencies' station and line pages. Do not edit by hand: rerun the script.
 * Facts are assigned to neighborhoods by point-in-polygon when the seed plan is built.
 */
import type { SourceSnapshot, TransitLineSeed, TransitStationSeed } from "../../types";

/** Source snapshots, keyed by the ids the facts below cite. */
export const TRANSIT_SOURCES: Record<string, SourceSnapshot> = ${JSON.stringify(snapshots, null, 2)};

export const TRANSIT_STATIONS: readonly TransitStationSeed[] = ${JSON.stringify(stations, null, 2)};

export const TRANSIT_LINES: readonly TransitLineSeed[] = ${JSON.stringify(lines, null, 2)};
`;
  write("convex/seed/world/neighborhoods/transit.ts", out);
  console.log(
    `transit: ${stations.length} stations (${stations.filter((s) => s.system === "bart").length} BART, ${stations.filter((s) => s.system === "muni_metro").length} Muni Metro, ${stations.filter((s) => s.system === "caltrain").length} Caltrain), ${lines.length} Metro lines, ${Object.keys(snapshots).length} sources`,
  );
}

// ── 3. Addresses ────────────────────────────────────────────────────────────

const ABBR: Record<string, string> = {
  st: "Street",
  ave: "Avenue",
  av: "Avenue",
  blvd: "Boulevard",
  dr: "Drive",
  rd: "Road",
  hwy: "Highway",
  pl: "Place",
  ter: "Terrace",
  ct: "Court",
  ln: "Lane",
  way: "Way",
};
const streetName = (s: string) => {
  const words = s.trim().split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase().replace(/\.$/, "") ?? "";
  if (ABBR[last]) words[words.length - 1] = ABBR[last];
  return words.join(" ");
};
const CITY_BBOX: Record<string, [number, number, number, number]> = {
  "San Francisco, CA": [37.7, -122.53, 37.84, -122.35],
  "Berkeley, CA": [37.84, -122.33, 37.91, -122.23],
  "Oakland, CA": [37.75, -122.33, 37.89, -122.14],
  "Mountain View, CA": [37.35, -122.12, 37.43, -122.03],
};

/** Public Overpass instances, tried in order (the main one rate-limits bursts). */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function overpass(init: RequestInit): Promise<Response> {
  let last: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetchWithRetry(url, init, 2);
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status} from ${url}`);
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Overpass failed: ${String(last)}`);
}

async function intersection(address: string, city: string, near: LatLng): Promise<LatLng | null> {
  const [a, b] = address.split("&").map((s) => s.trim());
  const box = CITY_BBOX[city];
  if (!a || !b || !box) return null;
  const rx = (s: string) => `^${streetName(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
  const q = `[out:json][timeout:25];way["highway"]["name"~"${rx(a)}",i](${box.join(",")})->.a;way["highway"]["name"~"${rx(b)}",i](${box.join(",")})->.b;node(w.a)->.na;node(w.b)->.nb;node.na.nb;out;`;
  const res = await overpass({
    method: "POST",
    // Overpass refuses browser-style user agents.
    headers: {
      "User-Agent": "neighborhood-data-script/1.0",
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const els = ((await res.json()) as { elements: { lat: number; lon: number }[] }).elements;
  if (els.length === 0) return null;
  // Streets can cross twice; take the crossing nearest the neighborhood.
  const best = els
    .map((e) => ({ lat: e.lat, lng: e.lon }))
    .sort((x, y) => Math.hypot(x.lat - near.lat, x.lng - near.lng) - Math.hypot(y.lat - near.lat, y.lng - near.lng))[0];
  return { lat: Math.round(best.lat * 1e6) / 1e6, lng: Math.round(best.lng * 1e6) / 1e6 };
}

async function buildAddresses() {
  const points: Record<string, LatLng> = {};
  const missing: string[] = [];
  for (const r of rentals) {
    const address = r.rental?.address;
    if (!address) continue;
    const place = places[r.hood];
    const key = `${address}, ${place.city}`;
    if (points[key]) continue;
    const p = await intersection(address, place.city, place);
    if (p) points[key] = p;
    else missing.push(key);
    await Bun.sleep(1000);
  }
  const maps = readFileSync(join(ROOT, "scripts/maps/build.py"), "utf8");
  const venues = /VENUES = \{([\s\S]*?)\n\}/.exec(maps)?.[1] ?? "";
  for (const m of venues.matchAll(/"([^"]+)": \("[^"]+", ([\d.-]+), ([\d.-]+)\)/g)) {
    points[m[1]] = { lat: Number(m[2]), lng: Number(m[3]) };
  }
  if (missing.length) console.warn(`  ! no intersection for:\n    ${missing.join("\n    ")}`);
  const out = `/**
 * Generated by scripts/neighborhoods/build.ts. Do not edit by hand: rerun the script.
 * - Rental cross streets ("Guerrero St & 21st St, San Francisco, CA"): OpenStreetMap intersections (Overpass, ODbL).
 * - Event venues: the points scripts/maps/build.py renders the venue maps from, keyed by the event's address.
 */
import type { LatLng } from "../../lib/geo";

export const ADDRESS_POINTS: Record<string, LatLng> = ${JSON.stringify(points, null, 2)};
`;
  write("convex/seed/lib/geocoded.ts", out);
  console.log(`addresses: ${Object.keys(points).length} points, ${missing.length} missing`);
}

// ── 4. Service: how often transit runs, and late at night ───────────────────

const DAY_MS = 86_400_000;
const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
type DayType = "weekday" | "saturday" | "sunday";
const DAY_TYPES: Record<DayType, string> = {
  weekday: "wednesday",
  saturday: "saturday",
  sunday: "sunday",
};
/** Stops serve both sides of a boundary street, as in the seed (`STATION_REACH_METERS`). */
const STOP_REACH_METERS = 40;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const seconds = (hms: string) => {
  const [h, m, sec] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + (sec || 0);
};

/** Service ids running on `date` (YYYYMMDD). */
function servicesOn(feed: Gtfs, date: string): Set<string> {
  const day = DOW[new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00Z`).getUTCDay()];
  const on = new Set<string>();
  if (feed.files.has("calendar.txt")) {
    for (const r of table(feed, "calendar.txt").rows) {
      if (r[day] === "1" && r.start_date <= date && date <= r.end_date) on.add(r.service_id);
    }
  }
  if (feed.files.has("calendar_dates.txt")) {
    for (const r of table(feed, "calendar_dates.txt").rows) {
      if (r.date !== date) continue;
      if (r.exception_type === "1") on.add(r.service_id);
      else on.delete(r.service_id);
    }
  }
  return on;
}

/**
 * An ordinary recent date of each day type. Regular service repeats every week and special days
 * (holidays, events, alternate schedules) don't, so of the last eight weeks up to today (or the
 * feed's last service day, if it has ended) take the most common set of running services, and
 * its latest date.
 */
function referenceDates(feed: Gtfs): Record<DayType, string> {
  const end = feed.serviceThrough
    ? Math.min(feed.fetchedAt, Date.parse(`${feed.serviceThrough}T12:00:00Z`))
    : feed.fetchedAt;
  const out = {} as Record<DayType, string>;
  for (const [type, day] of Object.entries(DAY_TYPES) as [DayType, string][]) {
    const seen = new Map<string, { count: number; latest: string }>();
    for (let t = end; t > end - 56 * DAY_MS; t -= DAY_MS) {
      if (DOW[new Date(t).getUTCDay()] !== day) continue;
      const date = ymd(t);
      const running = [...servicesOn(feed, date)].sort();
      if (running.length === 0) continue;
      const sig = running.join("|");
      const cur = seen.get(sig);
      seen.set(sig, { count: (cur?.count ?? 0) + 1, latest: cur?.latest ?? date });
    }
    const best = [...seen.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0];
    if (!best) throw new Error(`${feed.url}: no ${type} service in the last eight weeks`);
    out[type] = best.latest;
  }
  return out;
}

/** `board`: riders can get on here (not a drop-off-only stop or the end of the trip). */
type StopEvent = { stop: string; t: number; row: number; seq: number; board: boolean };
type Trip = { route: string; service: string; direction: string; events: StopEvent[] };
/** Trips running on any of `services`, with their stop events (row = stop_times line index). */
function tripsOf(feed: Gtfs, services: Set<string>) {
  const trips = new Map<string, Trip>();
  for (const t of table(feed, "trips.txt").rows) {
    if (!services.has(t.service_id)) continue;
    trips.set(t.trip_id, {
      route: t.route_id,
      service: t.service_id,
      direction: t.direction_id ?? "",
      events: [],
    });
  }
  const bytes = feed.files.get("stop_times.txt");
  if (!bytes) throw new Error(`${feed.url} has no stop_times.txt`);
  const lines = new TextDecoder().decode(bytes).replace(/^﻿/, "").split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const [iTrip, iStop, iDep, iArr, iSeq, iPickup] = [
    "trip_id",
    "stop_id",
    "departure_time",
    "arrival_time",
    "stop_sequence",
    "pickup_type",
  ].map((h) => header.indexOf(h));
  for (let n = 1; n < lines.length; n++) {
    if (!lines[n]) continue;
    const c = lines[n].includes('"') ? parseCsvLine(lines[n]) : lines[n].split(",");
    const trip = trips.get(c[iTrip]);
    const time = c[iDep] || c[iArr];
    if (!trip || !time) continue;
    trip.events.push({ stop: c[iStop], t: seconds(time), row: n, seq: Number(c[iSeq]), board: c[iPickup] !== "1" });
  }
  // Nobody boards at the end of a trip, whatever its pickup_type says.
  for (const trip of trips.values()) {
    const last = trip.events.reduce<StopEvent | null>((a, e) => (a && a.seq > e.seq ? a : e), null);
    if (last) last.board = false;
  }
  return { trips, lines };
}

type RouteOut = {
  line: string;
  name: string;
  mode: "bus" | "metro" | "streetcar" | "cable_car";
  allNight: boolean;
};
type LastTrainOut = {
  system: "bart" | "caltrain";
  station: string;
  /** Where the last train in this direction goes ("Antioch"): one entry per direction. */
  toward?: string;
  weekday?: number;
  saturday?: number;
  sunday?: number;
};
type ServiceOut = {
  neighborhood: string;
  tripsPerHour: number;
  routes: RouteOut[];
  lastTrains: LastTrainOut[];
  sources: string[];
};

async function buildService() {
  const { neighborhoodsNear } = await import("../../convex/lib/neighborhoods");
  const sources = new Map<string, Snapshot>();
  const cite = (snap: Snapshot) => {
    const key = `${snap.url}#${snap.snippet}`;
    sources.set(key, snap);
    return key;
  };
  const hoods = new Map<
    string,
    {
      weekdayTrips: Set<string>;
      routes: Map<string, RouteOut & { trips: number; rowKey: string; nightKey?: string }>;
      lastTrains: Map<string, LastTrainOut & { rowKey?: string }>;
      stopRow: Map<string, string>;
    }
  >();
  const hood = (slug: string) => {
    let h = hoods.get(slug);
    if (!h) {
      h = { weekdayTrips: new Set(), routes: new Map(), lastTrains: new Map(), stopRow: new Map() };
      hoods.set(slug, h);
    }
    return h;
  };
  const DAYTIME: [number, number] = [7 * 3600, 19 * 3600];
  // All-night service runs in the middle of the night; lines that start before dawn don't count.
  const isNight = (t: number) => t % 86_400 >= 1.5 * 3600 && t % 86_400 < 3.5 * 3600;

  const feeds = [
    { system: "bart" as const, url: BART_GTFS, publisher: "BART", name: "BART" },
    { system: "muni" as const, url: MUNI_GTFS, publisher: "SFMTA", name: "SFMTA Muni" },
    { system: "caltrain" as const, url: CALTRAIN_GTFS, publisher: "Caltrain", name: "Caltrain" },
  ];
  for (const f of feeds) {
    const feed = await loadFeed(f.url);
    const dates = referenceDates(feed);
    const byDay = Object.fromEntries(
      (Object.keys(dates) as DayType[]).map((d) => [d, servicesOn(feed, dates[d])]),
    ) as Record<DayType, Set<string>>;
    console.log(`  ${f.name}: reference days ${JSON.stringify(dates)}`);
    const { trips, lines } = tripsOf(feed, new Set(Object.values(byDay).flatMap((s) => [...s])));
    const stopsTable = table(feed, "stops.txt");
    const stopById = new Map(stopsTable.rows.map((s, i) => [s.stop_id, { ...s, line: stopsTable.lines[i] }]));
    const routesTable = table(feed, "routes.txt");
    const routeById = new Map(routesTable.rows.map((r, i) => [r.route_id, { ...r, line: routesTable.lines[i] }]));
    /** Where a trip ends, by station name ("Antioch", "Tamien"): clearer than many headsigns. */
    const destination = (trip: Trip) => {
      const end = trip.events.reduce<StopEvent | null>((a, e) => (a && a.seq > e.seq ? a : e), null);
      const s = end ? stopById.get(end.stop) : undefined;
      const station = s?.parent_station ? stopById.get(s.parent_station) : s;
      return station?.stop_name
        .replace(/ Caltrain Station$| Station$/, "")
        .replace(/ \(.*\)$/, "")
        .trim();
    };
    // Where each stop is (a platform takes its station's point, like the station facts).
    const where = new Map<string, string[]>();
    const hoodsOf = (stopId: string) => {
      let w = where.get(stopId);
      if (!w) {
        const s = stopById.get(stopId);
        const at = s?.parent_station ? (stopById.get(s.parent_station) ?? s) : s;
        w = at ? neighborhoodsNear(pt(at.stop_lat, at.stop_lon), STOP_REACH_METERS) : [];
        where.set(stopId, w);
      }
      return w;
    };
    for (const [tripId, trip] of trips) {
      const route = routeById.get(trip.route);
      if (!route) continue;
      const weekday = byDay.weekday.has(trip.service);
      for (const e of trip.events) {
        for (const slug of hoodsOf(e.stop)) {
          const h = hood(slug);
          if (weekday && e.t >= DAYTIME[0] && e.t < DAYTIME[1]) h.weekdayTrips.add(`${f.system}:${tripId}`);
          if (f.system === "muni") {
            const mode: RouteOut["mode"] =
              route.route_type === "5"
                ? "cable_car"
                : route.route_type === "0"
                  ? METRO_LINES.includes(route.route_short_name)
                    ? "metro"
                    : "streetcar"
                  : "bus";
            const owl = /owl/i.test(route.route_long_name);
            const r =
              h.routes.get(route.route_id) ??
              ({
                line: route.route_short_name,
                name: owl ? titleCase(route.route_long_name) : `${route.route_short_name} ${titleCase(route.route_long_name)}`,
                mode,
                allNight: false,
                trips: 0,
                rowKey: "",
              } satisfies RouteOut & { trips: number; rowKey: string });
            if (isNight(e.t)) {
              r.allNight = true;
              // Cite the night run itself: a route's description may not say it runs all night here.
              r.nightKey ??= cite(
                feedSnapshot(feed, f.publisher, `${f.name} GTFS schedule feed (stop_times.txt)`, lines[e.row]),
              );
            }
            if (weekday) r.trips++;
            if (!r.rowKey) {
              r.rowKey = cite(feedSnapshot(feed, f.publisher, `${f.name} GTFS schedule feed (routes.txt)`, route.line));
            }
            h.routes.set(route.route_id, r);
            if (!h.stopRow.has(route.route_id)) h.stopRow.set(route.route_id, stopById.get(e.stop)?.line ?? "");
          } else if (e.board) {
            // Last departures: only stops where riders can board.
            const platform = stopById.get(e.stop);
            const stationId = platform?.parent_station || e.stop;
            const station = stopById.get(stationId);
            if (!station) continue;
            // One last train per direction: the last one toward Millbrae isn't the last one toward Antioch.
            const id = `${stationId}:${trip.direction}`;
            const last =
              h.lastTrains.get(id) ??
              ({ system: f.system, station: station.stop_name } satisfies LastTrainOut & { rowKey?: string });
            for (const d of Object.keys(byDay) as DayType[]) {
              if (!byDay[d].has(trip.service)) continue;
              if ((last[d] ?? -1) < e.t) {
                last[d] = e.t;
                if (d === "weekday" || !last.rowKey) {
                  last.toward = destination(trip);
                  last.rowKey = cite(
                    feedSnapshot(feed, f.publisher, `${f.name} GTFS schedule feed (stop_times.txt)`, lines[e.row]),
                  );
                }
              }
            }
            h.lastTrains.set(id, last);
          }
        }
      }
    }
  }

  const out: ServiceOut[] = [...hoods.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([slug, h]) => {
      const routes = [...h.routes.values()].sort(
        (a, b) => Number(b.allNight) - Number(a.allNight) || b.trips - a.trips || a.line.localeCompare(b.line),
      );
      const lastTrains = [...h.lastTrains.values()].sort(
        (a, b) => a.station.localeCompare(b.station) || (a.toward ?? "").localeCompare(b.toward ?? ""),
      );
      // Citations: every displayed last train and all-night line keeps its own row (the night
      // run, for all-night lines), then a couple of the busiest lines.
      const keys = [
        ...lastTrains.flatMap((l) => (l.rowKey ? [l.rowKey] : [])),
        ...routes.filter((r) => r.allNight).map((r) => r.nightKey ?? r.rowKey),
        ...routes
          .filter((r) => !r.allNight)
          .slice(0, 2)
          .map((r) => r.rowKey),
      ];
      return {
        neighborhood: slug,
        tripsPerHour: Math.round(h.weekdayTrips.size / ((DAYTIME[1] - DAYTIME[0]) / 3600)),
        routes: routes.map(({ line, name, mode, allNight }) => ({ line, name, mode, allNight })),
        lastTrains: lastTrains.map(({ system, station, toward, weekday, saturday, sunday }) => ({
          system,
          station,
          toward,
          weekday: weekday === undefined ? undefined : Math.round(weekday / 60),
          saturday: saturday === undefined ? undefined : Math.round(saturday / 60),
          sunday: sunday === undefined ? undefined : Math.round(sunday / 60),
        })),
        sources: [...new Set(keys)],
      };
    })
    .filter((s) => s.sources.length > 0);

  // 311 streetlight repair requests in the last 90 days, per neighborhood (DataSF 311 Cases).
  const fetchedAt = Date.now();
  const since = new Date(fetchedAt - 90 * DAY_MS).toISOString().slice(0, 10);
  const { SF_NEIGHBORHOODS } = await import("../../convex/lib/neighborhoods");
  const lights: { neighborhood: string; count: number; since: number; until: number; sources: string[] }[] = [];
  for (const n of SF_NEIGHBORHOODS) {
    const where = `service_name='Streetlights' AND requested_datetime >= '${since}T00:00:00' AND analysis_neighborhood='${n.name.replace(/'/g, "''")}'`;
    const url = `https://data.sf.gov/resource/vw6y-z8j6.json?$select=${encodeURIComponent("analysis_neighborhood, count(*) AS requests")}&$where=${encodeURIComponent(where)}&$group=analysis_neighborhood`;
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`311 HTTP ${res.status} for ${n.name}`);
    const text = (await res.text()).trim();
    const rows = JSON.parse(text) as { requests?: string }[];
    const count = Number(rows[0]?.requests ?? 0);
    if (count === 0) continue;
    const key = cite({
      url,
      title: `311 Cases: Streetlights requests in ${n.name} since ${since} | DataSF`,
      publisher: "DataSF",
      snippet: cut(text),
      fetchedAt,
    });
    lights.push({ neighborhood: n.slug, count, since: Date.parse(`${since}T00:00:00-08:00`), until: fetchedAt, sources: [key] });
    await Bun.sleep(150);
  }

  const used = new Set([...out, ...lights].flatMap((x) => x.sources));
  const snapshots = Object.fromEntries([...sources].filter(([k]) => used.has(k)));
  write(
    "convex/seed/world/neighborhoods/service.ts",
    `/**
 * Generated by scripts/neighborhoods/build.ts (service step). Do not edit by hand: rerun the script.
 * - Transit service per neighborhood, from the BART, SFMTA (Muni, all modes) and Caltrain GTFS feeds on an
 *   ordinary recent weekday, Saturday and Sunday: weekday trips an hour (7am-7pm) stopping there, the Muni lines
 *   that stop there and which run all night (1:30-3:30am), and the last BART and Caltrain departures (minutes after
 *   the service day's midnight; past 1440 is after midnight).
 * - 311 streetlight repair requests in the last 90 days, from DataSF's 311 Cases.
 * Stops are filed under every neighborhood within ${STOP_REACH_METERS} m, like the station facts.
 */
import type { ServiceSeed, SourceSnapshot, StreetlightSeed } from "../../types";

export const SERVICE_SOURCES: Record<string, SourceSnapshot> = ${JSON.stringify(snapshots, null, 2)};

export const NEIGHBORHOOD_SERVICE: readonly ServiceSeed[] = ${JSON.stringify(out, null, 2)};

export const STREETLIGHT_REQUESTS: readonly StreetlightSeed[] = ${JSON.stringify(lights, null, 2)};
`,
  );
  console.log(
    `service: ${out.length} neighborhoods with transit, ${out.reduce((n, s) => n + s.routes.filter((r) => r.allNight).length, 0)} all-night line stops, ${lights.length} with 311 streetlight requests, ${Object.keys(snapshots).length} sources`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

const written: string[] = [];
function write(rel: string, text: string) {
  writeFileSync(join(ROOT, rel), text);
  written.push(rel);
}

const steps = new Set(process.argv.slice(2));
const all = steps.size === 0;
const boundaries = all || steps.has("boundaries") ? await buildBoundaries() : await loadBoundaries();
if (all || steps.has("transit")) await buildTransit(boundaries);
if (all || steps.has("addresses")) await buildAddresses();
if (all || steps.has("service")) await buildService();
if (written.length) {
  Bun.spawnSync(["bunx", "biome", "format", "--write", ...written], { cwd: ROOT, stdout: "inherit" });
}
