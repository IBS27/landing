import { describe, expect, test } from "bun:test";
import { placeItems } from "../convex/lib/itemLayout";
import {
  inside,
  itemSize,
  manualScene,
  type Placement,
  placementProblems,
  type UnitScene,
  WALL_MOUNT_Y,
} from "../convex/lib/unitScene";
import detailed from "../scripts/unit-scenes/heathmead-detailed.result.json";
import {
  arrowStep,
  cutFixtures,
  fitDistance,
  lowerWalls,
  overOpening,
  sceneBounds,
  snapToWall,
  stayInRooms,
  viewAzimuth,
  wallMounted,
  wallSides,
  wallY,
  yaw,
} from "../src/landing/apartment/placing";

// Moving things in Landing Home's Apartment tab (#150).
const room = manualScene(4, 5);
const flat = detailed.output.scene as UnitScene;
const art = (extra: Partial<Placement> = {}): Placement => ({
  id: "art",
  label: "A print",
  kind: "art",
  ...itemSize("art"),
  x: 2,
  z: 2,
  y: 1.2,
  rotation: 0,
  color: "#8899aa",
  measured: false,
  ...extra,
});
const front = (rotation: number) => ({ x: Math.sin(rotation), z: Math.cos(rotation) });

describe("wall-mounted items", () => {
  test("art and anything hung high slides along walls; floor items don't", () => {
    expect(wallMounted({ kind: "art" })).toBe(true);
    expect(wallMounted({ kind: "decor", y: WALL_MOUNT_Y })).toBe(true);
    expect(wallMounted({ kind: "decor", y: 0.4 })).toBe(false);
    expect(wallMounted({ kind: "sofa" })).toBe(false);
  });

  test("snaps flat against the nearest wall's room side, facing into the room", () => {
    const size = itemSize("art");
    // Near the top wall (z = 0), which is 0.12 thick.
    const top = snapToWall(room, { x: 2, z: 0.6 }, size)!;
    expect(top.wallId).toBe("wall-0");
    expect(top.x).toBeCloseTo(2);
    expect(top.z).toBeCloseTo(0.06 + size.depth / 2);
    expect(front(top.rotation).z).toBeCloseTo(1);
    // Near the right wall (x = 4): it faces −x.
    const right = snapToWall(room, { x: 3.7, z: 2.5 }, size)!;
    expect(right.wallId).toBe("wall-1");
    expect(right.x).toBeCloseTo(4 - 0.06 - size.depth / 2);
    expect(front(right.rotation).x).toBeCloseTo(-1);
    // A pointer outside the room still lands on the inside face.
    const outside = snapToWall(room, { x: 2, z: -3 }, size)!;
    expect(outside.wallId).toBe("wall-0");
    expect(outside.z).toBeGreaterThan(0);
  });

  test("stops clear of the wall that meets this one at the corner", () => {
    const size = itemSize("art");
    const s = snapToWall(room, { x: 0.1, z: -1 }, size)!;
    expect(s.wallId).toBe("wall-0");
    expect(s.x).toBeCloseTo(size.width / 2 + 0.06);
    expect(placementProblems(room, art({ ...s }))).toEqual([]);
  });

  test("every snapped position is a valid placement, wherever the pointer is", () => {
    for (const scene of [room, flat]) {
      const b = sceneBounds(scene);
      let found = 0;
      for (let x = b.minX - 1; x <= b.maxX + 1; x += 0.37)
        for (let z = b.minZ - 1; z <= b.maxZ + 1; z += 0.41) {
          const s = snapToWall(scene, { x, z }, itemSize("art"));
          if (!s) continue;
          found++;
          const p = art({ x: s.x, z: s.z, rotation: s.rotation, y: wallY(1.2, 0.8, s.wallHeight) });
          // It hangs inside a room, and the floor in front of it is in that room too.
          expect(scene.rooms.some((r) => inside(p, r.polygon))).toBe(true);
          const ahead = front(s.rotation);
          expect(
            scene.rooms.some((r) =>
              inside({ x: s.x + ahead.x * 0.1, z: s.z + ahead.z * 0.1 }, r.polygon),
            ),
          ).toBe(true);
          expect(Math.abs(s.rotation)).toBeLessThanOrEqual(Math.PI + 1e-9);
          expect(placementProblems(scene, p).filter((e) => e !== "Item intersects a wall")).toEqual(
            [],
          );
        }
      expect(found).toBeGreaterThan(20);
    }
  });

  test("agrees with where the auto-layout hangs art", () => {
    const [placed] = placeItems(
      room,
      [],
      [{ id: "a", kind: "art", ...itemSize("art"), label: "A print", color: "#8899aa" }],
    );
    const s = snapToWall(room, placed, placed)!;
    expect(s.x).toBeCloseTo(placed.x);
    expect(s.z).toBeCloseTo(placed.z);
    expect(yaw(s.rotation)).toBeCloseTo(yaw(placed.rotation));
  });

  test("no wall that faces a room: nothing to snap to", () => {
    expect(snapToWall({ ...room, walls: [] }, { x: 1, z: 1 }, itemSize("art"))).toBeNull();
  });

  test("height stays on the wall, between hanging height and the ceiling", () => {
    expect(wallY(0.2, 0.8, 2.5)).toBe(WALL_MOUNT_Y);
    expect(wallY(1.3, 0.8, 2.5)).toBe(1.3);
    expect(wallY(3, 0.8, 2.5)).toBeCloseTo(1.65);
    expect(wallY(3, 0.3, 4)).toBe(2.2);
    // Taller than the wall allows: it stays at hanging height.
    expect(wallY(1.5, 2, 2.5)).toBe(WALL_MOUNT_Y);
  });

  test("knows when it covers a door or window", () => {
    const scene: UnitScene = {
      ...room,
      walls: room.walls.map((w) =>
        w.id === "wall-0"
          ? { ...w, openings: [{ kind: "window", offset: 1, width: 1, bottom: 1, height: 1 }] }
          : w,
      ),
    };
    const at = (x: number) => snapToWall(scene, { x, z: 0.3 }, itemSize("art"))!;
    expect(overOpening(scene, at(1.5), { width: 0.6, height: 0.8, y: 1.2 })).toBe(true);
    expect(overOpening(scene, at(3), { width: 0.6, height: 0.8, y: 1.2 })).toBe(false);
    // Hung entirely above the window.
    expect(overOpening(scene, at(1.5), { width: 0.6, height: 0.3, y: 2.05 })).toBe(false);
  });
});

describe("floor items", () => {
  test("go where they are dragged inside a room", () => {
    expect(stayInRooms(room, { x: 1, z: 4 }, { x: 2, z: 2 })).toEqual({ x: 1, z: 4 });
  });

  test("never leave every room: they slide along the edge, or stay put", () => {
    // Dragged out through the right wall: x holds, z follows.
    expect(stayInRooms(room, { x: 6, z: 3 }, { x: 3.9, z: 2 })).toEqual({ x: 3.9, z: 3 });
    // Out through the bottom: z holds, x follows.
    expect(stayInRooms(room, { x: 1, z: 9 }, { x: 2, z: 4.9 })).toEqual({ x: 1, z: 4.9 });
    // Out past a corner: it stays where it last was.
    expect(stayInRooms(room, { x: 9, z: 9 }, { x: 3.9, z: 4.9 })).toEqual({ x: 3.9, z: 4.9 });
  });

  test("a long drag across a real flat always ends inside a room", () => {
    const start = flat.rooms[0].polygon.reduce(
      (s, p, _, all) => ({ x: s.x + p.x / all.length, z: s.z + p.z / all.length }),
      { x: 0, z: 0 },
    );
    let at = stayInRooms(flat, start, start);
    for (let i = 0; i < 400; i++) {
      const to = {
        x: start.x + Math.sin(i * 0.37) * i * 0.05,
        z: start.z + Math.cos(i * 0.21) * i * 0.05,
      };
      at = { ...stayInRooms(flat, to, at) };
      expect(flat.rooms.some((r) => inside(at, r.polygon))).toBe(true);
    }
  });

  test("writes into the point it is given, without allocating", () => {
    const out = { x: 0, z: 0 };
    expect(stayInRooms(room, { x: 1, z: 1 }, { x: 2, z: 2 }, out)).toBe(out);
  });

  test("arrow keys follow the screen, snapped to the plan's axes", () => {
    // Camera south of the scene (+z), looking north.
    expect(arrowStep(0, "up")).toEqual({ x: 0, z: -1 });
    expect(arrowStep(0, "right")).toEqual({ x: 1, z: 0 });
    expect(arrowStep(0.6, "left")).toEqual({ x: -1, z: 0 });
    // Camera east of the scene (+x), looking west: screen right is north.
    expect(arrowStep(Math.PI / 2, "up")).toEqual({ x: -1, z: 0 });
    expect(arrowStep(Math.PI / 2, "right")).toEqual({ x: 0, z: -1 });
    expect(arrowStep(-Math.PI, "down")).toEqual({ x: 0, z: -1 });
    for (const a of [-3, -1.2, 0.3, 0.9, 2.5])
      for (const key of ["up", "down", "left", "right"] as const) {
        const d = arrowStep(a, key);
        expect(Math.abs(d.x) + Math.abs(d.z)).toBe(1);
      }
  });

  test("a yaw always fits the placement range", () => {
    for (const r of [0, 3, -3, 7, -40, Math.PI * 2]) {
      expect(Math.abs(yaw(r))).toBeLessThanOrEqual(Math.PI);
      expect(Math.sin(yaw(r))).toBeCloseTo(Math.sin(r));
    }
  });
});

describe("framing", () => {
  test("the whole box is in view from the distance it gives, and not from much nearer", () => {
    const box = { halfX: 3, halfZ: 5, below: 0.8, above: 1.8 };
    const tanX = 0.5,
      tanY = 0.25;
    for (const azimuth of [0, 0.66, 2, -2.4])
      for (const polar of [0.2, 0.93, 1.4]) {
        const d = fitDistance(box, azimuth, polar, tanX, tanY);
        const sp = Math.sin(polar),
          cp = Math.cos(polar),
          sa = Math.sin(azimuth),
          ca = Math.cos(azimuth);
        const eye = { x: d * sp * sa, y: d * cp, z: d * sp * ca };
        let tightest = 0;
        for (const x of [-3, 3])
          for (const y of [-0.8, 1.8])
            for (const z of [-5, 5]) {
              // The corner seen from the eye, in camera axes.
              const v = { x: x - eye.x, y: y - eye.y, z: z - eye.z };
              const depth = -(v.x * sp * sa + v.y * cp + v.z * sp * ca);
              const right = v.x * ca - v.z * sa;
              const up = -v.x * cp * sa + v.y * sp - v.z * cp * ca;
              expect(depth).toBeGreaterThan(0);
              const use = Math.max(Math.abs(right) / (depth * tanX), Math.abs(up) / (depth * tanY));
              expect(use).toBeLessThanOrEqual(1 + 1e-9);
              tightest = Math.max(tightest, use);
            }
        expect(tightest).toBeCloseTo(1);
      }
  });

  test("looks from the corner the furniture faces, and stays with the default when it can", () => {
    const base = 0.66;
    const facing = (rotation: number, kind: Placement["kind"] = "sofa") => ({
      kind,
      rotation,
      width: 2,
      height: 0.9,
    });
    expect(viewAzimuth([], base)).toBe(base);
    // Facing +z or +x: the default corner already sees the fronts.
    expect(viewAzimuth([facing(0)], base)).toBe(base);
    expect(viewAzimuth([facing(Math.PI / 2)], base)).toBe(base);
    // Against the right wall, facing −x: look from the left.
    expect(viewAzimuth([facing(-Math.PI / 2)], base)).toBe(-base);
    // Facing −z: from behind, on the default side.
    expect(viewAzimuth([facing(Math.PI)], base)).toBe(Math.PI - base);
    expect(viewAzimuth([facing(Math.PI), facing(-Math.PI / 2)], base)).toBe(base - Math.PI);
    // A rug has no front.
    expect(viewAzimuth([facing(Math.PI, "rug")], base)).toBe(base);
  });

  test("bounds cover every room and wall", () => {
    expect(sceneBounds(room)).toEqual({ minX: 0, maxX: 4, minZ: 0, maxZ: 5, height: 2.5 });
    const b = sceneBounds(flat);
    for (const r of flat.rooms)
      for (const p of r.polygon) {
        expect(p.x).toBeGreaterThanOrEqual(b.minX);
        expect(p.x).toBeLessThanOrEqual(b.maxX);
        expect(p.z).toBeGreaterThanOrEqual(b.minZ);
        expect(p.z).toBeLessThanOrEqual(b.maxZ);
      }
  });
});

describe("cutaway", () => {
  const sides = wallSides(room);
  const lowered = (camera: { x: number; z: number }, from = new Uint8Array(room.walls.length)) => {
    lowerWalls(sides, camera, from);
    return room.walls.filter((_, i) => from[i]).map((w) => w.id);
  };

  test("each outside wall faces the room on one side only", () => {
    for (const s of sides) expect(s.front !== s.back).toBe(true);
  });

  test("only the walls between the camera and the room come down", () => {
    // wall-0 is z = 0, wall-1 is x = 4, wall-2 is z = 5, wall-3 is x = 0.
    expect(lowered({ x: 9, z: 10 })).toEqual(["wall-1", "wall-2"]);
    expect(lowered({ x: -5, z: -5 })).toEqual(["wall-0", "wall-3"]);
    expect(lowered({ x: 2, z: 12 })).toEqual(["wall-2"]);
    // Straight above the room: every wall stays up.
    expect(lowered({ x: 2, z: 2.5 })).toEqual([]);
  });

  test("a wall keeps its state while the camera is within the margin of its plane", () => {
    const flags = new Uint8Array(room.walls.length);
    expect(lowered({ x: 2, z: 6 }, flags)).toEqual(["wall-2"]);
    // Just inside the wall's plane: still down.
    expect(lowered({ x: 2, z: 4.9 }, flags)).toEqual(["wall-2"]);
    expect(lowerWalls(sides, { x: 2, z: 4.9 }, flags)).toBe(false);
    // Well inside: back up.
    expect(lowered({ x: 2, z: 4 }, flags)).toEqual([]);
  });

  test("a wall between two rooms is always down; reports only real changes", () => {
    const inner = wallSides(flat);
    const between = inner.filter((s) => s.front && s.back);
    expect(between.length).toBeGreaterThan(0);
    const flags = new Uint8Array(flat.walls.length);
    expect(lowerWalls(inner, { x: 50, z: 50 }, flags)).toBe(true);
    inner.forEach((s, i) => {
      if (s.front && s.back) expect(flags[i]).toBe(1);
    });
    expect(lowerWalls(inner, { x: 50, z: 50 }, flags)).toBe(false);
    // From the opposite corner, a different set of outside walls is down.
    const other = new Uint8Array(flat.walls.length);
    lowerWalls(inner, { x: -50, z: -50 }, other);
    expect([...other]).not.toEqual([...flags]);
  });
});

describe("fixtures on lowered walls", () => {
  const appearance = flat.appearance!;
  const all = new Set(flat.walls.map((w) => w.id));

  test("nothing lowered: the appearance is returned as it is", () => {
    expect(cutFixtures(flat, appearance, new Set(), 0.42)).toBe(appearance);
  });

  test("flat things hung on a lowered wall are cut at the wall's height; the rest is untouched", () => {
    const cut = cutFixtures(flat, appearance, all, 0.42);
    const before = new Map(appearance.objects.map((o) => [o.id, o]));
    let trimmed = 0;
    for (const o of cut.objects) {
      const was = before.get(o.id)!;
      if (o === was) continue;
      trimmed++;
      expect(Math.min(was.size.x, was.size.z)).toBeLessThanOrEqual(0.22);
      for (const p of o.parts)
        expect(o.position.y + p.position.y + p.size.y / 2).toBeLessThanOrEqual(0.42 + 1e-9);
    }
    const gone = appearance.objects.filter((o) => !cut.objects.some((c) => c.id === o.id));
    expect(trimmed + gone.length).toBeGreaterThan(0);
    // Deep fixtures (kitchen units, the bath) keep their full height.
    for (const o of appearance.objects)
      if (Math.min(o.size.x, o.size.z) > 0.22) expect(cut.objects).toContain(o);
    // Nothing the cut doesn't reach is changed: only the walls named are considered.
    const one = cutFixtures(flat, appearance, new Set([flat.walls[0].id]), 0.42);
    expect(one.objects.filter((o) => !appearance.objects.includes(o)).length).toBeLessThanOrEqual(
      cut.objects.filter((o) => !appearance.objects.includes(o)).length,
    );
  });
});
