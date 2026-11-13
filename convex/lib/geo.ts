/**
 * Small, dependency-free geometry for neighborhood boundaries. Coordinates
 * follow GeoJSON: a position is `[lng, lat]`, a ring is a closed list of
 * positions, a polygon is `[outer, ...holes]`, and a MultiPolygon is a list of
 * polygons. Distances use a local equirectangular projection, which is accurate
 * to well under a meter at city scale.
 */

export type LatLng = { lat: number; lng: number };
/** `[lng, lat]`, as in GeoJSON. */
export type Position = number[];
export type Ring = Position[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];
export type BBox = { west: number; south: number; east: number; north: number };

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

export function bboxOf(mp: MultiPolygon): BBox {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const polygon of mp) {
    for (const [lng, lat] of polygon[0] ?? []) {
      box.west = Math.min(box.west, lng);
      box.east = Math.max(box.east, lng);
      box.south = Math.min(box.south, lat);
      box.north = Math.max(box.north, lat);
    }
  }
  return box;
}

/** Whether `p` is inside `box`, grown by `padMeters` on every side. */
export function inBBox(p: LatLng, box: BBox, padMeters = 0): boolean {
  const dLat = padMeters / M_PER_DEG_LAT;
  const dLng = padMeters / mPerDegLng(p.lat);
  return (
    p.lat >= box.south - dLat &&
    p.lat <= box.north + dLat &&
    p.lng >= box.west - dLng &&
    p.lng <= box.east + dLng
  );
}

/** Even-odd ray casting. Points exactly on an edge may land on either side. */
export function pointInRing(p: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInMultiPolygon(p: LatLng, mp: MultiPolygon): boolean {
  return mp.some(
    ([outer, ...holes]) =>
      outer !== undefined && pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h)),
  );
}

/** Meters from `p` to the segment `a`–`b` (positions). */
function segmentMeters(p: LatLng, a: Position, b: Position): number {
  const kx = mPerDegLng(p.lat);
  const ax = (a[0] - p.lng) * kx;
  const ay = (a[1] - p.lat) * M_PER_DEG_LAT;
  const dx = (b[0] - p.lng) * kx - ax;
  const dy = (b[1] - p.lat) * M_PER_DEG_LAT - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Meters from `p` to the nearest edge of `mp` (holes included), inside or out. */
export function edgeDistanceMeters(p: LatLng, mp: MultiPolygon): number {
  let best = Infinity;
  for (const polygon of mp) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        best = Math.min(best, segmentMeters(p, ring[i - 1], ring[i]));
      }
    }
  }
  return best;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Area of a ring in square meters (absolute), around its first vertex. */
export function ringAreaMeters(ring: Ring): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0][1];
  const kx = mPerDegLng(lat0);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum +=
      (ring[j][0] - ring[0][0]) * kx * (ring[i][1] - lat0) * M_PER_DEG_LAT -
      (ring[i][0] - ring[0][0]) * kx * (ring[j][1] - lat0) * M_PER_DEG_LAT;
  }
  return Math.abs(sum) / 2;
}

/**
 * Douglas–Peucker simplification of a closed ring to `toleranceMeters`,
 * rounding to `decimals`. Keeps at least 4 positions (a closed triangle).
 */
export function simplifyRing(ring: Ring, toleranceMeters: number, decimals = 5): Ring {
  const pts = ring.slice(0, -1);
  if (pts.length <= 3) return roundRing(ring, decimals);
  const keep = new Array<boolean>(pts.length + 1).fill(false);
  const closed = [...pts, pts[0]];
  keep[0] = true;
  keep[closed.length - 1] = true;
  // Split at the vertex farthest from the first, so the closed ring has a real chord.
  let far = 1;
  let farD = -1;
  const origin = { lat: pts[0][1], lng: pts[0][0] };
  for (let i = 1; i < pts.length; i++) {
    const d = segmentMeters(origin, pts[i], pts[i]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = true;
  const stack: [number, number][] = [
    [0, far],
    [far, closed.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let idx = -1;
    let best = 0;
    for (let i = a + 1; i < b; i++) {
      const d = segmentMeters({ lat: closed[i][1], lng: closed[i][0] }, closed[a], closed[b]);
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (idx !== -1 && best > toleranceMeters) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  let out = closed.filter((_, i) => keep[i]);
  if (out.length < 4) out = [closed[0], closed[far], closed[Math.max(1, far >> 1)], closed[0]];
  return roundRing(out, decimals);
}

function roundRing(ring: Ring, decimals: number): Ring {
  const f = 10 ** decimals;
  const out: Ring = [];
  for (const [lng, lat] of ring) {
    const p = [Math.round(lng * f) / f, Math.round(lat * f) / f];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  return out;
}

/**
 * Google's encoded polyline format (precision 1e5), used to keep generated
 * boundary files compact. Positions are `[lng, lat]` on both sides.
 */
export function encodePolyline(ring: Ring): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const put = (delta: number) => {
    let v = delta < 0 ? ~(delta << 1) : delta << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of ring) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    put(la - prevLat);
    put(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

export function decodePolyline(s: string): Ring {
  const ring: Ring = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const take = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += take();
    lng += take();
    ring.push([lng / 1e5, lat / 1e5]);
  }
  return ring;
}

/**
 * A point well inside the MultiPolygon's largest polygon (approximately the
 * pole of inaccessibility), for labels and pins. Always inside the shape.
 */
export function labelPoint(mp: MultiPolygon): LatLng {
  const polygon = [...mp].sort(
    (a, b) => ringAreaMeters(b[0] ?? []) - ringAreaMeters(a[0] ?? []),
  )[0];
  if (!polygon?.[0]?.length) throw new Error("labelPoint: empty polygon");
  const shape: MultiPolygon = [polygon];
  const box = bboxOf(shape);
  const score = (p: LatLng) =>
    pointInMultiPolygon(p, shape) ? edgeDistanceMeters(p, shape) : -Infinity;
  let best: LatLng = { lat: polygon[0][0][1], lng: polygon[0][0][0] };
  let bestScore = -Infinity;
  let span = { lat: box.north - box.south, lng: box.east - box.west };
  let center = { lat: (box.north + box.south) / 2, lng: (box.east + box.west) / 2 };
  const N = 24;
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = {
          lat: center.lat - span.lat / 2 + (span.lat * i) / N,
          lng: center.lng - span.lng / 2 + (span.lng * j) / N,
        };
        const s = score(p);
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
    }
    center = best;
    span = { lat: (span.lat * 4) / N, lng: (span.lng * 4) / N };
  }
  if (bestScore === -Infinity) throw new Error("labelPoint: no interior point found");
  return { lat: Math.round(best.lat * 1e5) / 1e5, lng: Math.round(best.lng * 1e5) / 1e5 };
}
