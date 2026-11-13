import type { UnitAppearance } from "../../../convex/lib/unitAppearance";
import {
  distance,
  inside,
  type Placement,
  type Point,
  pointSegment,
  type UnitScene,
  WALL_MOUNT_Y,
} from "../../../convex/lib/unitScene";

/**
 * The geometry behind moving things in the Apartment tab (#150): pure, so it
 * is tested without a renderer. Axes as everywhere else: x right, z down the
 * plan, y up; an item's front faces (sin rotation, cos rotation).
 */

/** Where an item is: what `apartment.moveItem` takes. */
export type Pose = { x: number; z: number; rotation: number; y?: number };

const EPS = 0.001;
/** How high a wall-mounted item's base may be dragged or nudged, metres. */
export const WALL_Y = { min: WALL_MOUNT_Y, max: 2.2 } as const;

/** A yaw in (−π, π], which always passes the placement range check. */
export const yaw = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));

/** Hangs on a wall instead of standing on the floor: it slides along walls when moved. */
export const wallMounted = (p: Pick<Placement, "kind" | "y">) =>
  p.kind === "art" || (p.y ?? 0) >= WALL_MOUNT_Y;

function inRoom(scene: UnitScene, x: number, z: number) {
  probe.x = x;
  probe.z = z;
  for (const r of scene.rooms) if (inside(probe, r.polygon)) return true;
  return false;
}
const probe: Point = { x: 0, z: 0 };

/**
 * Where a floor item dragged to `next` may go: there, when that is inside a
 * room; else it slides along whichever axis still is; else it stays at `last`
 * (its last position inside a room). An item never leaves every room.
 */
export function stayInRooms(
  scene: UnitScene,
  next: Point,
  last: Point,
  out: Point = { x: 0, z: 0 },
) {
  const { x, z } = next;
  if (inRoom(scene, x, z)) {
    out.x = x;
    out.z = z;
  } else if (inRoom(scene, x, last.z)) {
    out.x = x;
    out.z = last.z;
  } else if (inRoom(scene, last.x, z)) {
    out.x = last.x;
    out.z = z;
  } else {
    out.x = last.x;
    out.z = last.z;
  }
  return out;
}

export type WallSnap = {
  x: number;
  z: number;
  /** Faces into the room. */
  rotation: number;
  wallId: string;
  /** The wall's height, for how high the item can hang. */
  wallHeight: number;
  /** How far along the wall (from its `a` end) the item's centre is. */
  offset: number;
};

/** Whether a footprint centred at (cx, cz), along (ux, uz) and facing (nx, nz), lies inside one room. */
function fits(
  scene: UnitScene,
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  nx: number,
  nz: number,
  halfWidth: number,
  halfDepth: number,
) {
  const hit = (r: UnitScene["rooms"][number], x: number, z: number) => {
    probe.x = x;
    probe.z = z;
    return inside(probe, r.polygon);
  };
  for (const r of scene.rooms) {
    if (!hit(r, cx, cz)) continue;
    let all = true;
    for (let i = 0; i < 4 && all; i++) {
      const a = i & 1 ? halfWidth : -halfWidth,
        d = i & 2 ? halfDepth : -halfDepth;
      all = hit(r, cx + ux * a + nx * d, cz + uz * a + nz * d);
    }
    if (all) return true;
  }
  return false;
}

/** How far along a wall the search for a clear stretch looks, and its step, metres. */
const SLIDE = { step: 0.1, max: 60 } as const;

/**
 * The nearest place on a wall for something that hangs: flat against the
 * wall's surface, wholly inside one room and turned to face into it, clear
 * of the walls that meet this one at its ends. Where the wall runs past the
 * room's end, the item slides back to the nearest stretch that is inside it.
 * In a scene where nothing fits that way, any wall side with floor in front
 * of it will do. Null when no wall faces a room. `depth` is the item's
 * thickness off the wall.
 */
export function snapToWall(
  scene: UnitScene,
  at: Point,
  item: { width: number; depth: number },
  out: WallSnap = { x: 0, z: 0, rotation: 0, wallId: "", wallHeight: 0, offset: 0 },
): WallSnap | null {
  // A wall that meets this one at a corner comes in by half its thickness.
  let corner = 0;
  for (const w of scene.walls) corner = Math.max(corner, w.thickness / 2);
  const halfWidth = item.width / 2,
    halfDepth = item.depth / 2;
  for (let strict = 1; strict >= 0; strict--) {
    let best = Number.POSITIVE_INFINITY;
    for (const w of scene.walls) {
      const len = distance(w.a, w.b);
      if (len < EPS) continue;
      const ux = (w.b.x - w.a.x) / len,
        uz = (w.b.z - w.a.z) / len;
      const lo = halfWidth + corner,
        raw = (at.x - w.a.x) * ux + (at.z - w.a.z) * uz;
      const first = lo <= len - lo ? Math.max(lo, Math.min(len - lo, raw)) : len / 2;
      const off = w.thickness / 2 + halfDepth;
      for (let sign = 1; sign >= -1; sign -= 2) {
        const nx = -uz * sign,
          nz = ux * sign;
        const ok = (t: number) =>
          strict
            ? fits(
                scene,
                w.a.x + ux * t + nx * off,
                w.a.z + uz * t + nz * off,
                ux,
                uz,
                nx,
                nz,
                halfWidth,
                halfDepth,
              )
            : inRoom(
                scene,
                w.a.x + ux * t + nx * (off + halfDepth + 0.05),
                w.a.z + uz * t + nz * (off + halfDepth + 0.05),
              );
        let t = first,
          found = ok(t);
        // The nearest stretch of this wall the item fits on, a step at a time either way.
        for (let k = 1; !found && strict && k <= SLIDE.max; k++)
          for (let way = -1; way <= 1 && !found; way += 2) {
            const next = first + way * k * SLIDE.step;
            if (next < lo - EPS || next > len - lo + EPS) continue;
            t = next;
            found = ok(t);
          }
        if (!found) continue;
        const x = w.a.x + ux * t + nx * off,
          z = w.a.z + uz * t + nz * off;
        const d = Math.hypot(at.x - x, at.z - z);
        if (d >= best) continue;
        best = d;
        out.x = x;
        out.z = z;
        out.rotation = Math.atan2(nx, nz);
        out.wallId = w.id;
        out.wallHeight = w.height;
        out.offset = t;
      }
    }
    if (Number.isFinite(best)) return out;
  }
  return null;
}

/** The base height a wall-mounted item may have on a wall this tall. */
export function wallY(y: number, itemHeight: number, wallHeight: number) {
  const max = Math.max(WALL_Y.min, Math.min(WALL_Y.max, wallHeight - itemHeight - 0.05));
  return Math.max(WALL_Y.min, Math.min(max, y));
}

/** Whether something hung at `snap` covers a door or window of its wall. */
export function overOpening(
  scene: UnitScene,
  snap: Pick<WallSnap, "wallId" | "offset">,
  item: { width: number; height: number; y: number },
) {
  const wall = scene.walls.find((w) => w.id === snap.wallId);
  if (!wall) return false;
  return wall.openings.some(
    (o) =>
      o.offset < snap.offset + item.width / 2 - EPS &&
      o.offset + o.width > snap.offset - item.width / 2 + EPS &&
      o.bottom < item.y + item.height - EPS &&
      o.bottom + o.height > item.y + EPS,
  );
}

/**
 * The world direction an arrow key moves a floor item, for a camera that
 * looks at the scene from `azimuth` (the angle of the camera's offset from
 * its target, from +z towards +x): "up" is away from the camera, "right" is
 * screen right, each snapped to the nearest plan axis.
 */
export function arrowStep(azimuth: number, key: "up" | "down" | "left" | "right"): Point {
  const quarter = Math.round(azimuth / (Math.PI / 2));
  const s = Math.round(Math.sin((quarter * Math.PI) / 2)),
    c = Math.round(Math.cos((quarter * Math.PI) / 2));
  // Away from the camera is −(sin, cos); screen right is (cos, −sin). `|| 0` avoids −0.
  if (key === "up") return { x: -s || 0, z: -c || 0 };
  if (key === "down") return { x: s || 0, z: c || 0 };
  if (key === "right") return { x: c || 0, z: -s || 0 };
  return { x: -c || 0, z: s || 0 };
}

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number; height: number };

/** The box around every room and wall. */
export function sceneBounds(scene: UnitScene): Bounds {
  const points = [
    ...scene.rooms.flatMap((r) => r.polygon),
    ...scene.walls.flatMap((w) => [w.a, w.b]),
  ];
  if (!points.length) return { minX: 0, maxX: 4, minZ: 0, maxZ: 5, height: 2.5 };
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
    height: Math.max(2.4, ...scene.walls.map((w) => w.height)),
  };
}

/**
 * How far a camera must be from its target to see a whole box. The camera
 * sits at `azimuth` (from +z towards +x) and `polar` (from straight up)
 * around the target and looks at it. The box is centred on the target in x
 * and z (`halfX`, `halfZ`) and runs from `below` to `above` it in y. `tanX`
 * and `tanY` are the tangents of the half field of view that may be used on
 * each screen axis (less than the camera's when part of the screen is covered).
 */
export function fitDistance(
  box: { halfX: number; halfZ: number; below: number; above: number },
  azimuth: number,
  polar: number,
  tanX: number,
  tanY: number,
) {
  const sp = Math.sin(polar),
    cp = Math.cos(polar),
    sa = Math.sin(azimuth),
    ca = Math.cos(azimuth);
  let d = 0;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.halfX : -box.halfX,
      y = i & 2 ? box.above : -box.below,
      z = i & 4 ? box.halfZ : -box.halfZ;
    // The corner in camera axes: right, up, and how far past the target it is.
    const right = x * ca - z * sa,
      up = -x * cp * sa + y * sp - z * cp * ca,
      past = -(x * sp * sa + y * cp + z * sp * ca);
    d = Math.max(d, Math.abs(right) / tanX - past, Math.abs(up) / tanY - past);
  }
  return d;
}

/**
 * The corner to look at the unit from: `base` (an azimuth, from +z towards
 * +x), or its mirror in x, in z or in both, whichever shows the most
 * furniture from the front. It moves off `base` only when another corner is
 * clearly better, and prefers the corners on `base`'s side.
 */
export function viewAzimuth(
  placements: readonly Pick<Placement, "kind" | "rotation" | "width" | "height">[],
  base: number,
): number {
  let best = base,
    top = Number.NEGATIVE_INFINITY,
    weight = 0;
  for (const p of placements) if (p.kind !== "rug") weight += p.width * p.height;
  const corners = [base, -base, Math.PI - base, base - Math.PI];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    // Each earlier corner keeps a head start, so near-ties stay with the default.
    let score = -i * 0.08 * weight;
    for (const p of placements)
      if (p.kind !== "rug") score += p.width * p.height * Math.cos(p.rotation - a);
    if (score > top + 1e-9) {
      top = score;
      best = a;
    }
  }
  return best;
}

export type WallSide = {
  /** The wall's midpoint and its normal (to the left of a → b). */
  x: number;
  z: number;
  nx: number;
  nz: number;
  /** Whether a room lies on the normal's side, and on the other side. */
  front: boolean;
  back: boolean;
};

/** For each wall, in order: which of its sides face a room. */
export function wallSides(scene: UnitScene): WallSide[] {
  return scene.walls.map((w) => {
    const len = distance(w.a, w.b) || 1;
    const ux = (w.b.x - w.a.x) / len,
      uz = (w.b.z - w.a.z) / len;
    const nx = -uz,
      nz = ux,
      reach = w.thickness / 2 + 0.2;
    let front = false,
      back = false;
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const px = w.a.x + ux * len * f,
        pz = w.a.z + uz * len * f;
      front ||= inRoom(scene, px + nx * reach, pz + nz * reach);
      back ||= inRoom(scene, px - nx * reach, pz - nz * reach);
    }
    return { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2, nx, nz, front, back };
  });
}

/**
 * The dollhouse cutaway: marks (1) in `lowered` each wall that stands between
 * a camera at `camera` (in plan) and a room, so only those are cut down and
 * the walls behind the rooms stay up. An outside wall is lowered while the
 * camera is on its outer side; a wall between two rooms always hides one of
 * them. Within `margin` of a wall's plane it keeps its state, so walls don't
 * flicker as the camera passes. Returns whether anything changed.
 */
export function lowerWalls(
  sides: readonly WallSide[],
  camera: Point,
  lowered: Uint8Array,
  margin = 0.3,
): boolean {
  let changed = false;
  for (let i = 0; i < sides.length; i++) {
    const s = sides[i];
    let next = lowered[i];
    if (s.front === s.back) next = 1;
    else {
      // Positive on the room's side of the wall.
      const d = ((camera.x - s.x) * s.nx + (camera.z - s.z) * s.nz) * (s.front ? 1 : -1);
      if (d < -margin) next = 1;
      else if (d > margin) next = 0;
    }
    if (next !== lowered[i]) {
      lowered[i] = next;
      changed = true;
    }
  }
  return changed;
}

/** A fixture this thin (metres) hangs on its wall: curtains, radiators, wall lights. */
const FLAT = 0.22;

/**
 * The fixtures to draw while some walls are cut down: something flat that
 * hangs on a lowered wall (curtains, say) is cut at the same height, so it
 * doesn't stand in the air above the wall. Everything else is unchanged, and
 * so is the appearance itself when nothing is cut.
 */
export function cutFixtures(
  scene: UnitScene,
  appearance: UnitAppearance,
  lowered: ReadonlySet<string>,
  cut: number,
): UnitAppearance {
  const walls = scene.walls.filter((w) => lowered.has(w.id));
  if (!walls.length) return appearance;
  let changed = false;
  const objects = appearance.objects.flatMap((o) => {
    const thin = Math.min(o.size.x, o.size.z);
    const at = { x: o.position.x, z: o.position.z };
    const hung =
      thin <= FLAT &&
      o.position.y + o.size.y > cut &&
      walls.some((w) => pointSegment(at, w.a, w.b) <= w.thickness / 2 + thin / 2 + 0.12);
    if (!hung) return [o];
    changed = true;
    const parts = o.parts.flatMap((p) => {
      const turned = p.rotation.x !== 0 || p.rotation.z !== 0;
      const bottom = o.position.y + p.position.y - p.size.y / 2,
        top = bottom + p.size.y;
      // A sphere or a tilted part isn't sliced: it goes with whichever side its centre is on.
      if (p.shape === "sphere" || turned) return o.position.y + p.position.y < cut ? [p] : [];
      if (bottom >= cut - 0.01) return [];
      if (top <= cut) return [p];
      const height = cut - bottom;
      return [
        {
          ...p,
          size: { ...p.size, y: height },
          position: { ...p.position, y: bottom + height / 2 - o.position.y },
        },
      ];
    });
    return parts.length ? [{ ...o, parts }] : [];
  });
  return changed ? { ...appearance, objects } : appearance;
}
