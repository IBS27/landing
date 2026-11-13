import { type Infer, v } from "convex/values";
import { appearanceProblems, unitAppearance } from "./unitAppearance";

const point = v.object({ x: v.number(), z: v.number() });
const evidence = v.object({
  basis: v.union(v.literal("measured"), v.literal("estimated"), v.literal("unknown")),
  sources: v.array(v.string()),
});
export const opening = v.object({
  kind: v.union(v.literal("door"), v.literal("window")),
  offset: v.number(),
  width: v.number(),
  bottom: v.number(),
  height: v.number(),
});
export const unitScene = v.object({
  version: v.literal(1),
  appearance: v.optional(unitAppearance),
  title: v.string(),
  notes: v.array(v.string()),
  rooms: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      polygon: v.array(point),
      floorColor: v.string(),
      evidence,
    }),
  ),
  walls: v.array(
    v.object({
      id: v.string(),
      a: point,
      b: point,
      height: v.number(),
      thickness: v.number(),
      color: v.string(),
      openings: v.array(opening),
      evidence,
    }),
  ),
});
export const placement = v.object({
  id: v.string(),
  listingId: v.optional(v.id("listings")),
  label: v.string(),
  kind: v.union(v.literal("sofa"), v.literal("bed"), v.literal("table"), v.literal("storage")),
  x: v.number(),
  z: v.number(),
  rotation: v.number(),
  width: v.number(),
  depth: v.number(),
  height: v.number(),
  color: v.string(),
  measured: v.boolean(),
});
export const sceneSource = v.object({
  key: v.string(),
  label: v.string(),
  kind: v.union(v.literal("photo"), v.literal("floorplan"), v.literal("video")),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
});
export type UnitScene = Infer<typeof unitScene>;
export type Placement = Infer<typeof placement>;
export type SceneSource = Infer<typeof sceneSource>;
export type Point = Infer<typeof point>;
export type Wall = UnitScene["walls"][number];
export const MAX_SOURCES = 20;
const EPS = 0.001;
const finite = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
const color = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
const validPoint = (p: Point) => finite(p.x, -100, 100) && finite(p.z, -100, 100);
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function area(p: Point[]) {
  return (
    Math.abs(
      p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a.x * b.z - b.x * a.z;
      }, 0),
    ) / 2
  );
}
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  return cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS;
}
export function pointSegment(p: Point, a: Point, b: Point) {
  const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
  const t = len2
    ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / len2))
    : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
}
export function inside(p: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (pointSegment(p, a, b) < EPS) return true;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
      hit = !hit;
  }
  return hit;
}
export function sceneProblems(scene: UnitScene, sourceKeys?: string[]) {
  const errors: string[] = scene.appearance
    ? appearanceProblems(scene.appearance, scene, sourceKeys)
    : [];
  if (
    scene.rooms.length > 24 ||
    scene.walls.length > 160 ||
    scene.rooms.some((r) => r.polygon.length > 32) ||
    scene.walls.some((w) => w.openings.length > 12)
  )
    return ["Scene exceeds geometry limits"];
  if (new TextEncoder().encode(JSON.stringify(scene)).byteLength > 300_000)
    return ["Scene exceeds storage limits"];
  if (!scene.title.trim() || scene.title.length > 120)
    errors.push("Use a title of 1–120 characters");
  if (scene.notes.length > 12 || scene.notes.some((n) => n.length > 500))
    errors.push("Notes exceed limits");
  if (scene.rooms.length < 1 || scene.rooms.length > 24 || scene.walls.length > 160)
    errors.push("Use 1–24 rooms and at most 160 walls");
  const ids = new Set<string>();
  for (const item of [...scene.rooms, ...scene.walls]) {
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(item.id) || ids.has(item.id))
      errors.push(`Invalid or duplicate id ${item.id}`);
    ids.add(item.id);
    if (
      item.evidence.sources.length > MAX_SOURCES ||
      (sourceKeys && item.evidence.sources.some((k) => !sourceKeys.includes(k)))
    )
      errors.push(`${item.id}: unknown evidence`);
  }
  for (const r of scene.rooms) {
    if (!r.name.trim() || r.name.length > 80 || !color(r.floorColor))
      errors.push(`${r.id}: invalid name or color`);
    const p = r.polygon;
    if (
      p.length < 3 ||
      p.length > 32 ||
      p.some((a) => !validPoint(a)) ||
      area(p) < 0.2 ||
      area(p) > 2000
    )
      errors.push(`${r.id}: invalid floor polygon`);
    for (let i = 0; i < p.length; i++) {
      if (distance(p[i], p[(i + 1) % p.length]) < 0.05) errors.push(`${r.id}: duplicate corner`);
      for (let j = i + 2; j < p.length; j++) {
        if (i === 0 && j === p.length - 1) continue;
        const a = p[i],
          b = p[(i + 1) % p.length],
          c = p[j],
          d = p[(j + 1) % p.length];
        if (
          segmentsCross(a, b, c, d) ||
          pointSegment(a, c, d) < EPS ||
          pointSegment(b, c, d) < EPS ||
          pointSegment(c, a, b) < EPS ||
          pointSegment(d, a, b) < EPS
        )
          errors.push(`${r.id}: crossed floor edges`);
      }
    }
  }
  if (errors.length) return [...new Set(errors)].slice(0, 30);
  for (const object of scene.appearance?.objects ?? []) {
    const room = scene.rooms.find((r) => r.id === object.roomId);
    if (!room || !inside({ x: object.position.x, z: object.position.z }, room.polygon))
      errors.push(`${object.id}: object center outside its room`);
  }
  const strictlyInside = (p: Point, polygon: Point[]) =>
    inside(p, polygon) &&
    polygon.every((a, i) => pointSegment(p, a, polygon[(i + 1) % polygon.length]) > EPS);
  for (let i = 0; i < scene.rooms.length; i++)
    for (let j = i + 1; j < scene.rooms.length; j++) {
      const a = scene.rooms[i],
        b = scene.rooms[j];
      if (
        a.polygon.some((p) => strictlyInside(p, b.polygon)) ||
        b.polygon.some((p) => strictlyInside(p, a.polygon)) ||
        strictlyInside(roomCenter(a), b.polygon) ||
        strictlyInside(roomCenter(b), a.polygon) ||
        a.polygon.some((p, k) =>
          b.polygon.some((q, l) =>
            segmentsCross(
              p,
              a.polygon[(k + 1) % a.polygon.length],
              q,
              b.polygon[(l + 1) % b.polygon.length],
            ),
          ),
        )
      )
        errors.push(`${a.id} overlaps ${b.id}`);
    }
  for (let i = 0; i < scene.walls.length; i++)
    for (let j = i + 1; j < scene.walls.length; j++) {
      const a = scene.walls[i],
        b = scene.walls[j],
        len = distance(a.a, a.b);
      if (len < EPS) continue;
      const ux = (a.b.x - a.a.x) / len,
        uz = (a.b.z - a.a.z) / len;
      const perpendicular = (p: Point) => Math.abs((p.x - a.a.x) * uz - (p.z - a.a.z) * ux);
      if (perpendicular(b.a) < EPS && perpendicular(b.b) < EPS) {
        const p = (b.a.x - a.a.x) * ux + (b.a.z - a.a.z) * uz,
          q = (b.b.x - a.a.x) * ux + (b.b.z - a.a.z) * uz;
        if (Math.min(len, Math.max(p, q)) - Math.max(0, Math.min(p, q)) > EPS)
          errors.push(`${a.id} overlaps wall ${b.id}`);
      }
    }
  for (const w of scene.walls) {
    const length = distance(w.a, w.b);
    if (
      !validPoint(w.a) ||
      !validPoint(w.b) ||
      length < 0.05 ||
      !finite(w.height, 1.9, 8) ||
      !finite(w.thickness, 0.03, 0.6) ||
      !color(w.color)
    )
      errors.push(`${w.id}: invalid wall`);
    if (w.openings.length > 12) errors.push(`${w.id}: too many openings`);
    const sorted = [...w.openings].sort((a, b) => a.offset - b.offset);
    let end = 0;
    for (const o of sorted) {
      if (
        !finite(o.offset, 0, length) ||
        !finite(o.width, 0.3, length) ||
        o.offset + o.width > length + EPS ||
        !finite(o.bottom, 0, w.height) ||
        !finite(o.height, 0.3, w.height) ||
        o.bottom + o.height > w.height + EPS ||
        o.offset < end - EPS ||
        (o.kind === "door" && (o.bottom !== 0 || o.height < 1.9))
      )
        errors.push(`${w.id}: opening outside wall or overlapping`);
      end = o.offset + o.width;
    }
  }
  if (!errors.length && scene.appearance) {
    for (const wall of scene.walls)
      for (const door of wall.openings) {
        if (door.kind !== "door") continue;
        const center = along(wall, door.offset + door.width / 2),
          length = distance(wall.a, wall.b);
        for (const offset of [-0.35, 0, 0.35]) {
          const p = {
            x: center.x - ((wall.b.z - wall.a.z) / length) * offset,
            z: center.z + ((wall.b.x - wall.a.x) / length) * offset,
          };
          if (canStand(scene, p) && !canWalk(scene, p)) {
            errors.push(
              `Observed fixtures obstruct doorway ${wall.id} near (${p.x.toFixed(2)}, ${p.z.toFixed(2)}). Keep the opening and approach clear`,
            );
            break;
          }
        }
      }
  }
  return [...new Set(errors)].slice(0, 30);
}

/** Cuboids shared by rendering, walkthrough collision and furniture checks. */
export function wallParts(w: Wall) {
  const length = distance(w.a, w.b);
  const parts: { start: number; end: number; bottom: number; top: number }[] = [];
  let cursor = 0;
  for (const o of [...w.openings].sort((a, b) => a.offset - b.offset)) {
    if (o.offset > cursor) parts.push({ start: cursor, end: o.offset, bottom: 0, top: w.height });
    if (o.bottom > 0)
      parts.push({ start: o.offset, end: o.offset + o.width, bottom: 0, top: o.bottom });
    if (o.bottom + o.height < w.height)
      parts.push({
        start: o.offset,
        end: o.offset + o.width,
        bottom: o.bottom + o.height,
        top: w.height,
      });
    cursor = o.offset + o.width;
  }
  if (cursor < length) parts.push({ start: cursor, end: length, bottom: 0, top: w.height });
  return parts;
}
export function along(w: Wall, offset: number): Point {
  const len = distance(w.a, w.b);
  return {
    x: w.a.x + ((w.b.x - w.a.x) * offset) / len,
    z: w.a.z + ((w.b.z - w.a.z) * offset) / len,
  };
}
export function canStand(scene: UnitScene, p: Point, radius = 0.18) {
  if (!scene.rooms.some((r) => inside(p, r.polygon))) return false;
  return scene.walls.every((w) =>
    wallParts(w).every(
      (s) =>
        s.bottom >= 1.8 ||
        pointSegment(p, along(w, s.start), along(w, s.end)) >= radius + w.thickness / 2,
    ),
  );
}
/** Conservative obstacle footprints shared by walking and placement warnings. */
export function canWalk(scene: UnitScene, p: Point, placements: Placement[] = [], radius = 0.18) {
  if (!canStand(scene, p, radius)) return false;
  const obstacles = [
    ...placements.map((o) => ({
      x: o.x,
      z: o.z,
      width: o.width,
      depth: o.depth,
      rotation: o.rotation,
    })),
    ...(scene.appearance?.objects ?? [])
      .filter((o) => o.position.y < 1.8 && o.position.y + o.size.y > 0.1)
      .map((o) => ({
        x: o.position.x,
        z: o.position.z,
        width: o.size.x,
        depth: o.size.z,
        rotation: o.rotation,
      })),
  ];
  return obstacles.every((o) => {
    const c = Math.cos(o.rotation),
      s = Math.sin(o.rotation),
      dx = p.x - o.x,
      dz = p.z - o.z;
    const x = Math.abs(dx * c - dz * s),
      z = Math.abs(dx * s + dz * c);
    return Math.hypot(Math.max(0, x - o.width / 2), Math.max(0, z - o.depth / 2)) >= radius;
  });
}
export function roomCenter(room: UnitScene["rooms"][number]): Point {
  const p = room.polygon;
  const avg = {
    x: p.reduce((s, a) => s + a.x, 0) / p.length,
    z: p.reduce((s, a) => s + a.z, 0) / p.length,
  };
  if (inside(avg, p)) return avg;
  const minX = Math.min(...p.map((a) => a.x)),
    maxX = Math.max(...p.map((a) => a.x));
  const minZ = Math.min(...p.map((a) => a.z)),
    maxZ = Math.max(...p.map((a) => a.z));
  for (let x = minX + 0.25; x < maxX; x += 0.25)
    for (let z = minZ + 0.25; z < maxZ; z += 0.25) if (inside({ x, z }, p)) return { x, z };
  return p[0];
}
export function placementCorners(
  p: Pick<Placement, "x" | "z" | "rotation" | "width" | "depth">,
): Point[] {
  const c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => ({
    x: p.x + ((x * p.width) / 2) * c + ((z * p.depth) / 2) * s,
    z: p.z - ((x * p.width) / 2) * s + ((z * p.depth) / 2) * c,
  }));
}
export function placementProblems(scene: UnitScene, p: Placement): string[] {
  if (
    !p.id ||
    p.id.length > 80 ||
    !p.label.trim() ||
    p.label.length > 120 ||
    !validPoint(p) ||
    !finite(p.rotation, -Math.PI * 2, Math.PI * 2) ||
    ![p.width, p.depth, p.height].every((n) => finite(n, 0.05, 12)) ||
    !color(p.color)
  )
    return ["Invalid furniture dimensions or position"];
  const corners = placementCorners(p);
  if (!scene.rooms.some((r) => corners.every((c) => inside(c, r.polygon)) && inside(p, r.polygon)))
    return ["Item extends outside a room"];
  for (const w of scene.walls)
    for (const s of wallParts(w)) {
      if (s.bottom >= p.height) continue;
      const a = along(w, s.start),
        b = along(w, s.end);
      if (
        inside(a, corners) ||
        inside(b, corners) ||
        corners.some(
          (c, i) =>
            segmentsCross(c, corners[(i + 1) % 4], a, b) || pointSegment(c, a, b) < w.thickness / 2,
        )
      )
        return ["Item intersects a wall"];
    }
  for (const object of scene.appearance?.objects ?? []) {
    if (object.position.y >= p.height) continue;
    const other = placementCorners({
      ...p,
      x: object.position.x,
      z: object.position.z,
      width: object.size.x,
      depth: object.size.z,
      rotation: object.rotation,
    });
    if (rectanglesOverlap(corners, other)) return [`Item overlaps ${object.label}`];
  }
  return [];
}
function rectanglesOverlap(a: Point[], b: Point[]) {
  return [a, b].every((polygon) =>
    polygon.every((point, i) => {
      const next = polygon[(i + 1) % 4];
      const axis = { x: point.z - next.z, z: next.x - point.x };
      const project = (p: Point) => p.x * axis.x + p.z * axis.z;
      const aa = a.map(project),
        bb = b.map(project);
      return (
        Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) >
        EPS
      );
    }),
  );
}
export function manualScene(
  width = 4,
  length = 5,
  title = "Your room",
  measured = false,
): UnitScene {
  const polygon = [
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: length },
    { x: 0, z: length },
  ];
  const evidence = { basis: measured ? ("measured" as const) : ("unknown" as const), sources: [] };
  return {
    version: 1,
    title,
    notes: measured
      ? ["Room dimensions entered by you. Ceiling height is estimated."]
      : ["Example dimensions. Enter your measurements before judging furniture fit."],
    rooms: [{ id: "room", name: title, polygon, floorColor: "#c7b69e", evidence }],
    walls: polygon.map((a, i) => ({
      id: `wall-${i}`,
      a,
      b: polygon[(i + 1) % 4],
      height: 2.5,
      thickness: 0.12,
      color: "#eee9df",
      openings: [],
      evidence: { basis: "estimated", sources: [] },
    })),
  };
}
