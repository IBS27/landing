import { describe, expect, test } from "bun:test";
import { type LayoutItem, placeItems, placementsOverlap } from "../convex/lib/itemLayout";
import {
  ALL_ITEM_KINDS,
  blocksFloor,
  canWalk,
  inside,
  itemSize,
  manualScene,
  type Placement,
  type PlacementKind,
  placementProblems,
  pointSegment,
  roomCenter,
  type UnitScene,
  WALL_MOUNT_Y,
} from "../convex/lib/unitScene";
import heathmead from "../scripts/unit-scenes/heathmead.result.json";
import detailed from "../scripts/unit-scenes/heathmead-detailed.result.json";

// Auto-layout for Landing Home's Apartment tab (#150).
const item = (kind: PlacementKind, extra: Partial<LayoutItem> = {}): LayoutItem => ({
  id: `${kind}-${extra.id ?? 1}`,
  kind,
  ...itemSize(kind),
  label: `A ${kind}`,
  color: "#8899aa",
  ...extra,
});
const coffee = { width: 1.1, depth: 0.6, height: 0.45 };
const home = () => [
  ...ALL_ITEM_KINDS.filter((k) => k !== "table").map((k) => item(k)),
  item("table", coffee),
];
const front = (p: Placement) => ({ x: Math.sin(p.rotation), z: Math.cos(p.rotation) });
const kind = (out: Placement[], k: PlacementKind) => out.find((p) => p.kind === k)!;
const roomOf = (scene: UnitScene, p: Placement) =>
  scene.rooms.find((r) => inside(p, r.polygon))?.id;

/** Nothing collides, nothing is out of bounds, and wall art hangs flush on a wall. */
function expectSound(scene: UnitScene, placements: Placement[]) {
  for (const p of placements) expect([p.id, placementProblems(scene, p)]).toEqual([p.id, []]);
  for (const [i, a] of placements.entries())
    for (const b of placements.slice(i + 1))
      expect([a.id, b.id, placementsOverlap(a, b)]).toEqual([a.id, b.id, false]);
  for (const p of placements.filter((x) => x.kind === "art")) {
    expect(p.y).toBeGreaterThanOrEqual(WALL_MOUNT_Y);
    expect(blocksFloor(p)).toBe(false);
    // Its back touches a wall's surface.
    const gap = Math.min(
      ...scene.walls.map((w) => pointSegment(p, w.a, w.b) - w.thickness / 2 - p.depth / 2),
    );
    expect(Math.abs(gap)).toBeLessThan(0.011);
  }
  for (const p of placements.filter((x) => x.kind !== "art")) expect(p.y).toBeUndefined();
}

/** Every 10 cm cell a person can walk to from a point, around the placements. */
function reach(scene: UnitScene, placements: Placement[], from: Point) {
  const step = 0.1;
  const key = (x: number, z: number) => `${x},${z}`;
  const start = [Math.round(from.x / step), Math.round(from.z / step)];
  const seen = new Set([key(start[0], start[1])]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = key(x + dx, z + dz);
      if (!seen.has(k) && canWalk(scene, { x: (x + dx) * step, z: (z + dz) * step }, placements)) {
        seen.add(k);
        queue.push([x + dx, z + dz]);
      }
    }
  }
  return seen;
}
type Point = { x: number; z: number };

/** A living room and a bedroom side by side, with a door in the wall between them. */
function twoRooms(): UnitScene {
  const wall = (id: string, a: Point, b: Point, door?: number) => ({
    id,
    a,
    b,
    height: 2.5,
    thickness: 0.12,
    color: "#eeeeee",
    openings: door
      ? [{ kind: "door" as const, offset: door, width: 0.9, bottom: 0, height: 2.1 }]
      : [],
    evidence: { basis: "estimated" as const, sources: [] },
  });
  const room = (id: string, name: string, x0: number, x1: number) => ({
    id,
    name,
    polygon: [
      { x: x0, z: 0 },
      { x: x1, z: 0 },
      { x: x1, z: 4 },
      { x: x0, z: 4 },
    ],
    floorColor: "#c7b69e",
    evidence: { basis: "estimated" as const, sources: [] },
  });
  return {
    version: 1,
    title: "Two rooms",
    notes: [],
    rooms: [room("living", "Living room", 0, 5), room("bed", "Bedroom", 5, 9)],
    walls: [
      wall("n", { x: 0, z: 0 }, { x: 9, z: 0 }),
      wall("e", { x: 9, z: 0 }, { x: 9, z: 4 }),
      wall("s", { x: 9, z: 4 }, { x: 0, z: 4 }),
      wall("w", { x: 0, z: 4 }, { x: 0, z: 0 }),
      wall("mid", { x: 5, z: 0 }, { x: 5, z: 4 }, 1.5),
    ],
  };
}

describe("a studio", () => {
  const scene = manualScene(5, 6, "Studio");
  const out = placeItems(scene, [], home());

  test("places one of every kind without collisions, in the order given", () => {
    expect(out.map((p) => p.id)).toEqual(home().map((i) => i.id));
    expect(out.every((p) => p.measured === false && p.label.startsWith("A "))).toBe(true);
    expectSound(scene, out);
  });
  test("is deterministic", () => {
    expect(placeItems(scene, [], home())).toEqual(out);
  });
  test("big items back onto a wall and face into the room", () => {
    for (const k of ["sofa", "bed", "storage", "desk"] as const) {
      const p = kind(out, k);
      const f = front(p);
      // One step out of the front is floor; one step out of the back is past the wall.
      const reach = p.depth / 2 + 0.2;
      expect(inside({ x: p.x + f.x * reach, z: p.z + f.z * reach }, scene.rooms[0].polygon)).toBe(
        true,
      );
      expect(inside({ x: p.x - f.x * reach, z: p.z - f.z * reach }, scene.rooms[0].polygon)).toBe(
        false,
      );
      expect(Math.abs(p.rotation)).toBeLessThanOrEqual(Math.PI);
    }
  });
  test("the rug and coffee table sit in front of the sofa, art hangs over a sofa or bed", () => {
    const sofa = kind(out, "sofa"),
      f = front(sofa);
    for (const k of ["rug", "table"] as const) {
      const p = kind(out, k);
      const ahead = (p.x - sofa.x) * f.x + (p.z - sofa.z) * f.z;
      const aside = Math.abs((p.x - sofa.x) * f.z - (p.z - sofa.z) * f.x);
      expect(ahead).toBeGreaterThan(0);
      expect(aside).toBeLessThan(0.05);
    }
    const art = kind(out, "art");
    const under = [sofa, kind(out, "bed")].some(
      (o) => Math.hypot(art.x - o.x, art.z - o.z) < o.depth / 2 + 0.2,
    );
    expect(under).toBe(true);
    // The chair is pulled up to the desk, facing it.
    const desk = kind(out, "desk"),
      chair = kind(out, "chair");
    expect(Math.hypot(chair.x - desk.x, chair.z - desk.z)).toBeLessThan(1);
    expect(Math.cos(chair.rotation - desk.rotation)).toBeCloseTo(-1);
  });
  test("lamps and plants go to corners", () => {
    for (const k of ["lamp", "plant"] as const) {
      const p = kind(out, k);
      const corner = Math.min(
        ...scene.rooms[0].polygon.map((v) => Math.hypot(v.x - p.x, v.z - p.z)),
      );
      expect(corner).toBeLessThan(1);
    }
  });
  test("more items avoid what is already there", () => {
    const more = placeItems(scene, out, [
      item("plant", { id: "2" }),
      item("art", { id: "2" }),
      item("storage", { id: "2", width: 0.8, depth: 0.32, height: 1.8 }),
    ]);
    expect(more.length).toBe(3);
    expectSound(scene, [...out, ...more]);
  });
  test("an item that fits nowhere is left out, and the rest are still placed", () => {
    const out = placeItems(
      scene,
      [],
      [item("sofa", { id: "huge", width: 9, depth: 8 }), item("lamp", { id: "lamp" })],
    );
    expect(out.map((p) => p.id)).toEqual(["lamp"]);
    expect(placeItems(scene, [], [])).toEqual([]);
  });
});

describe("two rooms with a door", () => {
  const scene = twoRooms();
  const out = placeItems(scene, [], home());

  test("each kind goes to the room that suits it, or the one asked for", () => {
    expectSound(scene, out);
    expect(roomOf(scene, kind(out, "bed"))).toBe("bed");
    expect(roomOf(scene, kind(out, "desk"))).toBe("bed");
    expect(roomOf(scene, kind(out, "chair"))).toBe("bed");
    for (const k of ["sofa", "rug", "table", "lamp", "plant", "art"] as const)
      expect(roomOf(scene, kind(out, k))).toBe("living");
    const [asked, unknown] = placeItems(
      scene,
      [],
      [item("plant", { room: "bed" }), item("lamp", { room: "nowhere" })],
    );
    expect(roomOf(scene, asked)).toBe("bed");
    expect(roomOf(scene, unknown)).toBe("living");
  });
  test("the doorway stays clear and walkable", () => {
    const door = { x: 5, z: 1.95 };
    for (const p of out.filter(blocksFloor))
      expect(Math.hypot(p.x - door.x, p.z - door.z)).toBeGreaterThan(0.6);
    expect(reach(scene, out, { x: 4.4, z: 1.95 }).has("56,20")).toBe(true);
  });
  test("nothing backs onto the door, and tall storage keeps off windows", () => {
    const windowed = twoRooms();
    windowed.walls[0].openings = [
      { kind: "window", offset: 0.2, width: 4.6, bottom: 0.9, height: 1.2 },
    ];
    const tall = item("storage", { width: 0.8, depth: 0.32, height: 1.8, room: "living" });
    const [p] = placeItems(windowed, [], [tall]);
    expect(placementProblems(windowed, p)).toEqual([]);
    // Not under the north wall's window.
    expect(p.z).toBeGreaterThan(0.5);
    // A low sofa may sit under it.
    const [sofa] = placeItems(windowed, [], [item("sofa", { room: "living" })]);
    expect(placementProblems(windowed, sofa)).toEqual([]);
  });
  test("a second bed goes to a bedroom without one; art avoids furniture it would hang behind", () => {
    const three = twoRooms();
    three.rooms.push({ ...three.rooms[1], id: "bed2", name: "Bedroom 2" });
    three.rooms[2].polygon = three.rooms[1].polygon.map((p) => ({ x: p.x + 4, z: p.z }));
    const beds = placeItems(three, [], [item("bed"), item("bed", { id: "2" })]);
    expect(new Set(beds.map((b) => roomOf(three, b)))).toEqual(new Set(["bed", "bed2"]));
    const bookcase = item("storage", { width: 3.2, depth: 0.32, height: 2.2, room: "bed" });
    const filled = placeItems(scene, [], [bookcase, item("art", { room: "bed" })]);
    expectSound(scene, filled);
  });
});

describe("a real generated apartment", () => {
  const items = () => [...home(), item("bed", { id: "2", width: 0.9 })];

  test("furnishes the Heathmead layout room by room", () => {
    const scene = heathmead.output.scene as UnitScene;
    const out = placeItems(scene, [], items());
    expectSound(scene, out);
    expect(roomOf(scene, kind(out, "sofa"))).toBe("lounge");
    expect(new Set(out.filter((p) => p.kind === "bed").map((p) => roomOf(scene, p)))).toEqual(
      new Set(["bedroom1", "bedroom2"]),
    );
    expect(placeItems(scene, [], items())).toEqual(out);
    // No room is cut off or cut in two: nearly all its free floor is reachable from the hall.
    const walked = reach(scene, out, roomCenter(scene.rooms.find((r) => r.id === "hall")!));
    for (const r of scene.rooms.filter((x) => ["lounge", "bedroom1", "bedroom2"].includes(x.id))) {
      const free: string[] = [];
      for (let x = 0; x < 120; x++)
        for (let z = 0; z < 80; z++) {
          const p = { x: x * 0.1, z: z * 0.1 };
          if (inside(p, r.polygon) && canWalk(scene, p, out)) free.push(`${x},${z}`);
        }
      expect(free.filter((k) => walked.has(k)).length / free.length).toBeGreaterThan(0.9);
    }
  });
  test("keeps clear of the fixtures Muse found in its photos", () => {
    const scene = detailed.output.scene as UnitScene;
    expect(scene.appearance?.objects.length).toBeGreaterThan(0);
    const out = placeItems(scene, [], items());
    expectSound(scene, out);
    const more = placeItems(scene, out, [item("plant", { id: "2" }), item("lamp", { id: "2" })]);
    expectSound(scene, [...out, ...more]);
  });
});
