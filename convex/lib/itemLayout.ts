import type { Id } from "../_generated/dataModel";
import {
  along,
  area,
  blocksFloor,
  canStand,
  distance,
  inside,
  type Placement,
  type PlacementKind,
  type Point,
  placementCorners,
  placementProblems,
  pointSegment,
  rectanglesOverlap,
  roomCenter,
  type UnitScene,
  WALL_MOUNT_Y,
  wallParts,
} from "./unitScene";

/**
 * Where Marketplace items go when Muse furnishes the apartment (#150): a
 * deterministic auto-layout, one item at a time. The person can drag anything
 * afterwards; this only has to give a sensible, collision-free start.
 *
 * Conventions (the same as the renderer's `Furniture` in UnitCanvas): an
 * item's `rotation` is its yaw around Y, its back is at local −z and its
 * front faces local +z, which in the plan is (sin rotation, cos rotation).
 * An item against a wall is turned so its front faces into the room. Only
 * wall art has a `y` (the height of its base); everything else stands on the
 * floor.
 */

export type LayoutItem = {
  id: string;
  kind: PlacementKind;
  /** Metres. For wall art, `depth` is its thickness off the wall. */
  width: number;
  depth: number;
  height: number;
  /** A room id to put it in; anything else picks a room by kind. */
  room?: string;
  label: string;
  listingId?: Id<"listings">;
  color: string;
};

type Room = UnitScene["rooms"][number];
type Spot = { p: Placement; score: number };

/** Space left between a floor item's back and the wall's surface. */
const GAP = 0.02;
/** Wall art hangs with its base this high, lower under a low ceiling and higher above furniture. */
const ART_Y = 1.2;
/** Clear floor kept on both sides of every door, tried in order: a tight room gives some up. */
const DOOR_CLEAR = [0.9, 0.45, 0] as const;
/** Interior search step. */
const GRID = 0.25;
const EPS = 0.001;

/** Rugs first only among flat things: big wall items go down first so rugs and tables can follow them. */
const PHASE: Record<PlacementKind, number> = {
  bed: 0,
  sofa: 0,
  storage: 1,
  desk: 1,
  rug: 2,
  table: 3,
  chair: 4,
  lamp: 5,
  plant: 5,
  decor: 6,
  art: 7,
};

const LIVING = [/living|lounge|main|studio|family|sitting|great/i];
const ROOM_NAMES: Record<PlacementKind, RegExp[]> = {
  bed: [/bed/i],
  sofa: LIVING,
  table: LIVING,
  rug: LIVING,
  lamp: LIVING,
  plant: LIVING,
  art: LIVING,
  decor: LIVING,
  chair: LIVING,
  desk: [/office|study/i, /bed/i],
  storage: [/bed/i, /hall|entry|entrance/i],
};

const front = (rotation: number): Point => ({ x: Math.sin(rotation), z: Math.cos(rotation) });
const right = (rotation: number): Point => ({ x: Math.cos(rotation), z: -Math.sin(rotation) });
const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + b.x * k, z: a.z + b.z * k });
/** A yaw in (−π, π], so it always passes the placement range check. */
const yaw = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));

/**
 * Whether two placements collide. Rugs lie under everything and only collide
 * with other rugs; everything else collides when the footprints overlap and
 * the heights do too (art above a sofa doesn't touch it).
 */
export function placementsOverlap(a: Placement, b: Placement): boolean {
  if (a.kind === "rug" || b.kind === "rug") {
    if (a.kind !== b.kind) return false;
  } else {
    const a0 = a.y ?? 0,
      b0 = b.y ?? 0;
    if (a0 + a.height <= b0 + EPS || b0 + b.height <= a0 + EPS) return false;
  }
  return rectanglesOverlap(placementCorners(a), placementCorners(b));
}

/**
 * Places `items` in the scene around what is already there, and returns the
 * new placements in the order the items were given. Deterministic: the same
 * scene, placements and items always give the same result. An item that fits
 * nowhere in its room is left out: match the result to the items by `id`.
 */
export function placeItems(
  scene: UnitScene,
  existing: readonly Placement[],
  items: readonly LayoutItem[],
): Placement[] {
  if (!scene.rooms.length) return [];
  const layout = new Layout(scene, existing);
  const order = items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        PHASE[a.item.kind] - PHASE[b.item.kind] ||
        b.item.width * b.item.depth - a.item.width * a.item.depth ||
        a.i - b.i,
    );
  const out: (Placement | null)[] = new Array(items.length).fill(null);
  for (const { item, i } of order) out[i] = layout.place(item);
  return out.filter((p): p is Placement => p !== null);
}

class Layout {
  private readonly placed: Placement[];
  private readonly rooms: { room: Room; area: number; center: Point }[];
  private readonly doors: Point[];
  private readonly grids = new Map<string, Point[]>();

  constructor(
    private readonly scene: UnitScene,
    existing: readonly Placement[],
  ) {
    this.placed = [...existing];
    this.rooms = scene.rooms.map((room) => ({
      room,
      area: area(room.polygon),
      center: roomCenter(room),
    }));
    this.doors = scene.walls.flatMap((w) =>
      w.openings.filter((o) => o.kind === "door").map((o) => along(w, o.offset + o.width / 2)),
    );
  }

  place(item: LayoutItem): Placement | null {
    const room = this.chooseRoom(item);
    const base: Placement = {
      id: item.id,
      ...(item.listingId ? { listingId: item.listingId } : {}),
      label: item.label,
      kind: item.kind,
      x: 0,
      z: 0,
      rotation: 0,
      width: item.width,
      depth: item.depth,
      height: item.height,
      color: item.color,
      measured: false,
    };
    const center = this.rooms.find((r) => r.room === room)?.center ?? roomCenter(room);
    const byScore = (spots: Spot[]) => spots.sort((a, b) => b.score - a.score);
    // The kind's own spots first; failing those, anywhere on the floor, nearest the middle.
    const turns = [this.axis(room, base), yaw(this.axis(room, base) + Math.PI / 2)];
    const anywhere = (): Spot[] =>
      item.kind === "art"
        ? []
        : turns.flatMap((rotation) =>
            this.grid(room).map((g) => ({
              p: { ...base, ...g, rotation },
              score: -distance(g, center),
            })),
          );
    let chosen: Placement | undefined;
    for (const spots of [() => this.spots(room, base), anywhere]) {
      const sorted = byScore(spots());
      for (const clear of DOOR_CLEAR) {
        const zones = this.doorZones(clear);
        chosen = sorted.find((s) => this.fits(s.p, zones))?.p;
        if (chosen) break;
      }
      if (chosen) break;
    }
    if (chosen) this.placed.push(chosen);
    return chosen ?? null;
  }

  /* ---------------- Rooms ---------------- */

  private roomOf(p: Point): Room | undefined {
    return this.scene.rooms.find((r) => inside(p, r.polygon));
  }
  private inRoom(room: Room, kinds: readonly PlacementKind[]) {
    return this.placed.filter((o) => kinds.includes(o.kind) && inside(o, room.polygon));
  }
  private largest(rooms: readonly { room: Room; area: number }[]) {
    return rooms.reduce((best, r) => (r.area > best.area ? r : best)).room;
  }

  private chooseRoom(item: LayoutItem): Room {
    const asked = this.scene.rooms.find((r) => r.id === item.room);
    if (asked) return asked;
    // A chair goes to a desk that has none.
    if (item.kind === "chair") {
      const desk = this.placed.find((o) => o.kind === "desk" && !this.seated(o));
      const room = desk && this.roomOf(desk);
      if (room) return room;
    }
    for (const name of ROOM_NAMES[item.kind]) {
      let named = this.rooms.filter((r) => name.test(r.room.name));
      // A second bed goes to a bedroom that has none.
      if (item.kind === "bed") {
        const empty = named.filter((r) => !this.inRoom(r.room, ["bed"]).length);
        if (empty.length) named = empty;
      }
      if (named.length) return this.largest(named);
    }
    return this.largest(this.rooms);
  }

  /** Whether a chair already faces this desk or table. */
  private seated(o: Placement) {
    const seat = add(o, front(o.rotation), o.depth / 2 + 0.35);
    return this.placed.some((c) => c.kind === "chair" && distance(c, seat) < 0.6);
  }

  /** The yaw that lines an item's longer side up with the room's longest wall. */
  private axis(room: Room, p: Pick<Placement, "width" | "depth">) {
    const poly = room.polygon;
    let a = poly[0],
      b = poly[1 % poly.length];
    for (let i = 0; i < poly.length; i++) {
      const c = poly[i],
        d = poly[(i + 1) % poly.length];
      if (distance(c, d) > distance(a, b) + EPS) {
        a = c;
        b = d;
      }
    }
    const len = distance(a, b) || 1,
      u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    // Local +x is (cos r, −sin r); local +z is (sin r, cos r).
    return p.width >= p.depth ? yaw(Math.atan2(-u.z, u.x)) : yaw(Math.atan2(u.x, u.z));
  }

  /* ---------------- Checks ---------------- */

  /** Rectangles on both sides of every door that floor items keep out of. */
  private doorZones(clear: number): Point[][] {
    return this.scene.walls.flatMap((w) => {
      const len = distance(w.a, w.b);
      if (len < EPS) return [];
      const rotation = Math.atan2(-(w.b.z - w.a.z) / len, (w.b.x - w.a.x) / len);
      return w.openings
        .filter((o) => o.kind === "door")
        .map((o) =>
          placementCorners({
            ...along(w, o.offset + o.width / 2),
            rotation,
            width: o.width + 0.1,
            depth: clear * 2,
          }),
        );
    });
  }

  private fits(p: Placement, doorZones: Point[][]): boolean {
    if (placementProblems(this.scene, p).length) return false;
    const corners = placementCorners(p);
    if (blocksFloor(p) && doorZones.some((z) => rectanglesOverlap(corners, z))) return false;
    if (this.placed.some((o) => placementsOverlap(p, o))) return false;
    const base = p.y ?? 0,
      top = base + p.height;
    // Fixtures: floor items are covered by `placementProblems`; a rug keeps off
    // floor-standing fixtures and art off anything it would hang in front of.
    return !(this.scene.appearance?.objects ?? []).some(
      (o) =>
        (p.kind === "rug"
          ? o.position.y < 0.05
          : o.position.y < top - EPS && o.position.y + o.size.y > base + EPS) &&
        rectanglesOverlap(
          corners,
          placementCorners({
            x: o.position.x,
            z: o.position.z,
            width: o.size.x,
            depth: o.size.z,
            rotation: o.rotation,
          }),
        ),
    );
  }

  /** Whether a point on a wall's centreline has solid wall from `from` up to `to`. */
  private solid(q: Point, from: number, to: number) {
    return this.scene.walls.some((w) =>
      wallParts(w).some(
        (s) =>
          s.bottom <= from + EPS &&
          s.top >= to - EPS &&
          pointSegment(q, along(w, s.start), along(w, s.end)) <= 0.03,
      ),
    );
  }

  /* ---------------- Candidates ---------------- */

  private spots(room: Room, base: Placement): Spot[] {
    const sofa = this.inRoom(room, ["sofa"])[0];
    const rest = this.inRoom(room, ["sofa", "bed"]);
    const center = this.rooms.find((r) => r.room === room)?.center ?? roomCenter(room);
    const near = (to: Point, rotation: number, weight = 1): Spot[] =>
      this.grid(room).map((g) => ({
        p: { ...base, ...g, rotation },
        score: -weight * distance(g, to),
      }));
    const corners = (score: (g: Point) => number): Spot[] =>
      this.grid(room).map((g) => ({
        p: { ...base, ...g, rotation: this.axis(room, base) },
        score: -Math.min(...room.polygon.map((v) => distance(v, g))) + score(g),
      }));
    const nearest = (g: Point, others: readonly Placement[], cap: number) =>
      others.length ? Math.min(cap, ...others.map((o) => distance(o, g))) : 0;

    switch (base.kind) {
      case "sofa": {
        const rug = this.inRoom(room, ["rug"])[0];
        return this.wallSpots(room, base, "centre", rug);
      }
      case "bed":
        return this.wallSpots(room, base, "centre");
      case "storage":
      case "desk":
        return this.wallSpots(room, base, "end");
      case "rug": {
        if (!sofa) return near(center, this.axis(room, base));
        // In front of the sofa, long side along it, tucked a little under its front.
        const wide = base.width >= base.depth;
        const rotation = yaw(sofa.rotation + (wide ? 0 : Math.PI / 2));
        const reach = wide ? base.depth : base.width;
        const spot = add(sofa, front(sofa.rotation), sofa.depth / 2 + reach / 2 - 0.25);
        return [{ p: { ...base, ...spot, rotation }, score: 1 }, ...near(spot, rotation)];
      }
      case "table": {
        const anchor = sofa ?? rest[0];
        if (anchor && Math.max(base.width, base.depth) <= 0.65) {
          // A side table or nightstand: beside the sofa or bed, level with its back.
          const side = (sign: number): Spot => ({
            p: {
              ...base,
              ...add(
                add(
                  anchor,
                  right(anchor.rotation),
                  sign * (anchor.width / 2 + base.width / 2 + 0.05),
                ),
                front(anchor.rotation),
                -anchor.depth / 2 + base.depth / 2,
              ),
              rotation: anchor.rotation,
            },
            score: 2 + sign * 0.5,
          });
          return [side(1), side(-1), ...near(anchor, anchor.rotation)];
        }
        if (sofa && base.height <= 0.55) {
          // A coffee table: in front of the sofa, long side along it.
          const wide = base.width >= base.depth;
          const rotation = yaw(sofa.rotation + (wide ? 0 : Math.PI / 2));
          const reach = wide ? base.depth : base.width;
          const spot = add(sofa, front(sofa.rotation), sofa.depth / 2 + 0.4 + reach / 2);
          return [{ p: { ...base, ...spot, rotation }, score: 1 }, ...near(spot, rotation)];
        }
        return near(center, this.axis(room, base));
      }
      case "chair": {
        const desk = this.inRoom(room, ["desk"]).find((o) => !this.seated(o));
        const table = this.inRoom(room, ["table"]).find((o) => o.height > 0.6 && !this.seated(o));
        const at = desk ?? table;
        if (!at) return this.wallSpots(room, base, "end");
        // Pulled up to the desk or table, facing it.
        const spot = add(at, front(at.rotation), at.depth / 2 + base.depth / 2 + 0.05);
        const rotation = yaw(at.rotation + Math.PI);
        return [{ p: { ...base, ...spot, rotation }, score: 1 }, ...near(spot, rotation)];
      }
      case "lamp":
        // A corner, the one nearest the sofa or bed.
        return corners((g) => -0.3 * nearest(g, rest, 6));
      case "plant":
      case "decor": {
        // A corner, away from other small things.
        const small = this.inRoom(room, ["lamp", "plant", "decor"]);
        return corners((g) => 0.3 * nearest(g, small, 2));
      }
      case "art":
        return this.wallSpots(room, base, "centre", undefined, rest);
    }
  }

  /** Interior points of a room on the search grid, in a fixed order. */
  private grid(room: Room): Point[] {
    let points = this.grids.get(room.id);
    if (points) return points;
    const xs = room.polygon.map((p) => p.x),
      zs = room.polygon.map((p) => p.z);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    // Coarser in very large rooms, so the search stays bounded.
    const step = Math.max(GRID, Math.sqrt(((maxX - minX) * (maxZ - minZ)) / 2500));
    points = [];
    for (let x = minX + step / 2; x < maxX; x += step)
      for (let z = minZ + step / 2; z < maxZ; z += step)
        if (inside({ x, z }, room.polygon)) points.push({ x, z });
    this.grids.set(room.id, points);
    return points;
  }

  /**
   * Positions with the item's back against a wall of the room and its front
   * facing in, on wall that is solid behind it: no door, and no window lower
   * than the item. "centre" prefers the middle of a long wall, "end" a corner.
   * Wall art sits flush and hangs clear of furniture below it, centred over a
   * sofa or bed on that wall when there is one (`over`).
   */
  private wallSpots(
    room: Room,
    base: Placement,
    mode: "centre" | "end",
    toward?: Point,
    over: readonly Placement[] = [],
  ): Spot[] {
    const art = base.kind === "art";
    const spots: Spot[] = [];
    for (const w of this.scene.walls) {
      const len = distance(w.a, w.b);
      if (len < EPS) continue;
      const u = { x: (w.b.x - w.a.x) / len, z: (w.b.z - w.a.z) / len };
      // The stretch of this wall that runs along the room (a wall can pass several rooms).
      const reach = room.polygon.map((v) => (v.x - w.a.x) * u.x + (v.z - w.a.z) * u.z);
      const lo = Math.max(0, Math.min(...reach)),
        hi = Math.min(len, Math.max(...reach));
      if (hi - lo < EPS) continue;
      const middle = (lo + hi) / 2;
      const span = hi - lo - base.width;
      const step = Math.max(GRID, span / 60);
      // The middle, both corners (clear of a side wall as thick as this one), then every step.
      const corner = base.width / 2 + w.thickness / 2 + GAP;
      const offsets = span > 0 ? [middle, lo + corner, hi - corner] : [middle];
      for (let t = lo + base.width / 2; span > 0 && t <= hi - base.width / 2 + EPS; t += step)
        offsets.push(t);
      for (const sign of [1, -1]) {
        const n = { x: -u.z * sign, z: u.x * sign };
        const rotation = Math.atan2(n.x, n.z);
        for (const t of offsets) {
          const onWall = add(w.a, u, t);
          const at = add(onWall, n, w.thickness / 2 + base.depth / 2 + (art ? 0 : GAP));
          if (!inside(at, room.polygon)) continue;
          let p: Placement = { ...base, ...at, rotation };
          let bonus = 0;
          if (art) {
            // Above whatever stands against the wall here.
            const probe = placementCorners({ ...p, ...add(at, n, 0.2), depth: base.depth + 0.4 });
            const below = this.placed.filter(
              (o) => blocksFloor(o) && rectanglesOverlap(probe, placementCorners(o)),
            );
            const y = Math.max(
              WALL_MOUNT_Y,
              Math.min(ART_Y, w.height - base.height - 0.1),
              ...below.map((o) => (o.y ?? 0) + o.height + 0.2),
            );
            if (y + base.height > w.height) continue;
            p = { ...p, y };
            for (const o of over) {
              const back = add(o, front(o.rotation), -o.depth / 2);
              const off = distance(back, onWall);
              if (off < w.thickness / 2 + 0.3 + o.width / 2) bonus = Math.max(bonus, 10 - off * 5);
            }
          }
          const from = p.y ?? 0;
          const to = art ? from + base.height : Math.min(base.height, 2) - 0.3;
          if (
            ![-0.45, -0.225, 0, 0.225, 0.45].every((f) =>
              this.solid(add(onWall, u, f * base.width), from, to),
            )
          )
            continue;
          const off = Math.abs(t - middle);
          // Room to stand in front of it, so it doesn't cut the room in two.
          const ahead = add(at, n, base.depth / 2 + 0.45);
          const open = art || (inside(ahead, room.polygon) && canStand(this.scene, ahead));
          spots.push({
            p,
            score:
              bonus +
              (mode === "centre" ? Math.min(hi - lo, 5) * 0.3 - off : off) +
              (open ? 0 : -5) +
              0.3 *
                (this.doors.length ? Math.min(2.5, ...this.doors.map((d) => distance(d, at))) : 0) -
              (toward ? 0.2 * distance(at, toward) : 0),
          });
        }
      }
    }
    return spots;
  }
}
