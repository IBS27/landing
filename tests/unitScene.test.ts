import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { checkValue } from "../convex/ai/outputSchema";
import {
  blocksFloor,
  canStand,
  canWalk,
  manualScene,
  type Placement,
  placementProblems,
  roomCenter,
  sceneProblems,
  type UnitScene,
  unitScene,
} from "../convex/lib/unitScene";
import { layoutMedia, unitSceneTask } from "../convex/lib/unitSceneTask";
import { acceptCandidate, create, ownScene, save, saveCandidate } from "../convex/unitScenes";
import result from "../scripts/unit-scenes/heathmead.result.json";
import detailedResult from "../scripts/unit-scenes/heathmead-detailed.result.json";
import initialDetailedResult from "../scripts/unit-scenes/heathmead-detailed-initial.result.json";
import videoResult from "../scripts/unit-scenes/heathmead-video.result.json";
import { fakeCtx, type Row } from "./fakeDb";

// Run registered Convex handlers against the same in-memory DB as the project's other tests.
function handler<A, R>(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler;
}
const id = (s: string) => s as never;
const unit = manualScene(4, 5);
const item: Placement = {
  id: "sofa",
  label: "Sofa",
  kind: "sofa",
  x: 2,
  z: 2,
  rotation: 0,
  width: 2,
  depth: 1,
  height: 0.8,
  color: "#8899aa",
  measured: false,
};
function db() {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "u1" }, { _id: "u2" }],
    rooms: [
      { _id: "r1", userId: "u1", name: "Bedroom", photos: [], size: { widthFt: 10, lengthFt: 12 } },
    ],
    unitScenes: [
      {
        _id: "s1",
        ownerId: "u1",
        scene: unit,
        placements: [item],
        sources: [],
        description: "",
        revision: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
  return { tables, ctx: fakeCtx(tables) };
}
describe("unit geometry", () => {
  test("rejects crossed polygons, duplicate walls, unknown evidence and overlapping rooms", () => {
    expect(sceneProblems(unit)).toEqual([]);
    const crossed = structuredClone(unit);
    crossed.rooms[0].polygon = [
      { x: 0, z: 0 },
      { x: 4, z: 5 },
      { x: 4, z: 0 },
      { x: 0, z: 5 },
    ];
    expect(sceneProblems(crossed).length).toBeGreaterThan(0);
    expect(
      sceneProblems({
        ...unit,
        walls: [...unit.walls, { ...unit.walls[0], id: "duplicate" }],
      }).join(),
    ).toContain("overlaps wall");
    expect(
      sceneProblems({
        ...unit,
        rooms: [...unit.rooms, { ...unit.rooms[0], id: "duplicate-room" }],
      }).join(),
    ).toContain("overlaps");
    const unknown = structuredClone(unit);
    unknown.rooms[0].evidence.sources = ["made-up"];
    expect(sceneProblems(unknown, []).join()).toContain("unknown evidence");
  });
  test("starts valid with a long listing title", () => {
    expect(sceneProblems(manualScene(4, 5, "x".repeat(100)))).toEqual([]);
  });
  test("walks through doors but not walls, windows, or outside the unit", () => {
    const scene = manualScene(4, 5);
    scene.walls.push({
      id: "partition",
      a: { x: 0, z: 2.5 },
      b: { x: 4, z: 2.5 },
      height: 2.5,
      thickness: 0.12,
      color: "#ffffff",
      evidence: { basis: "estimated", sources: [] },
      openings: [{ kind: "door", offset: 1.5, width: 1, bottom: 0, height: 2.1 }],
    });
    expect(canStand(scene, { x: 2, z: 2.5 })).toBe(true);
    expect(canStand(scene, { x: 1, z: 2.5 })).toBe(false);
    expect(canStand(scene, { x: -1, z: 2 })).toBe(false);
    scene.walls[4].openings[0] = {
      kind: "window",
      offset: 1.5,
      width: 1,
      bottom: 0.8,
      height: 1.2,
    };
    expect(canStand(scene, { x: 2, z: 2.5 })).toBe(false);
  });
  test("detects rotated furniture crossing walls and invalid dimensions", () => {
    expect(placementProblems(unit, item)).toEqual([]);
    expect(placementProblems(unit, { ...item, x: 0.5, rotation: Math.PI / 4 })).toContain(
      "Item extends outside a room",
    );
    expect(placementProblems(unit, { ...item, width: NaN })[0]).toContain("Invalid");
  });
  test("AI-off fallback supplies no invented reconstructed geometry", () => {
    expect(
      unitSceneTask.fallback(
        { title: "Room", description: "", measurements: null, evidence: [] },
        [],
      ).scene,
    ).toBeNull();
  });
  test("uses a supplied floor plan for topology and falls back to photos when no plan exists", () => {
    const media = [
      { key: "plan", kind: "image" as const, url: "https://example.com/plan.png" },
      { key: "photo", kind: "image" as const, url: "https://example.com/room.jpg" },
    ];
    expect(layoutMedia(media, [{ key: "plan", kind: "floorplan" }])).toEqual([media[0]]);
    expect(layoutMedia(media.slice(1), [{ key: "photo", kind: "photo" }])).toEqual(media.slice(1));
  });
  test("unmodified real Muse output validates and all eight spaces connect through doorways", () => {
    for (const generated of [result, videoResult, detailedResult]) {
      const scene = generated.output.scene as UnitScene;
      expect(checkValue(unitScene, scene).errors).toEqual([]);
      expect(sceneProblems(scene)).toEqual([]);
      const step = 0.1;
      const start = roomCenter(scene.rooms.find((r) => r.id === "hall")!);
      const key = (x: number, z: number) => `${x},${z}`;
      const first = [Math.round(start.x / step), Math.round(start.z / step)];
      const seen = new Set([key(first[0], first[1])]);
      const queue = [first];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x, z] = queue[cursor];
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx,
            nz = z + dz,
            k = key(nx, nz);
          if (!seen.has(k) && canWalk(scene, { x: nx * step, z: nz * step })) {
            seen.add(k);
            queue.push([nx, nz]);
          }
        }
      }
      for (const room of scene.rooms) {
        const c = roomCenter(room);
        expect(seen.has(key(Math.round(c.x / step), Math.round(c.z / step)))).toBe(true);
      }
    }
  });
  test("rejects malformed visual assemblies, missing evidence, and oversized generated geometry", () => {
    expect(sceneProblems(initialDetailedResult.output.scene as UnitScene).join()).toContain(
      "obstruct doorway",
    );
    const scene = structuredClone(detailedResult.output.scene) as UnitScene;
    scene.appearance!.objects[0].parts[0].position.x = 999;
    expect(sceneProblems(scene).join()).toContain("part");
    const badReference = structuredClone(detailedResult.output.scene) as UnitScene;
    badReference.appearance!.surfaces[0].materialId = "missing";
    expect(sceneProblems(badReference).join()).toContain("surface reference");
    const ungrounded = structuredClone(detailedResult.output.scene) as UnitScene;
    ungrounded.appearance!.objects[0].sources = [];
    expect(sceneProblems(ungrounded).join()).toContain("evidence");
    const oversized = structuredClone(detailedResult.output.scene) as UnitScene;
    oversized.appearance!.objects = Array(65).fill(oversized.appearance!.objects[0]);
    expect(sceneProblems(oversized).join()).toContain("limits");
  });
  test("walk collisions include rotated placed furniture and inferred fixtures", () => {
    expect(canWalk(unit, { x: 2, z: 2 }, [item])).toBe(false);
    expect(canWalk(unit, { x: 3.6, z: 4 }, [item])).toBe(true);
    const scene = detailedResult.output.scene as UnitScene;
    const cabinet = scene.appearance!.objects[0];
    expect(canWalk(scene, cabinet.position)).toBe(false);
    const testItem = {
      ...item,
      x: cabinet.position.x,
      z: cabinet.position.z,
      width: 0.1,
      depth: 0.1,
    };
    expect(placementProblems(scene, testItem).join()).toContain("overlaps");
  });
});
describe("rugs and wall art (#150)", () => {
  const rug: Placement = { ...item, id: "rug", kind: "rug", width: 1.6, depth: 2.3, height: 0.02 };
  // Hung on the north wall (thickness 0.12), its back flush with the wall's surface.
  const art: Placement = {
    ...item,
    id: "art",
    kind: "art",
    width: 0.6,
    depth: 0.03,
    height: 0.8,
    z: 0.06 + 0.015,
    y: 1.2,
  };
  test("neither is in the way of walking; furniture still is", () => {
    expect(blocksFloor(item)).toBe(true);
    expect(blocksFloor(rug)).toBe(false);
    expect(blocksFloor(art)).toBe(false);
    expect(blocksFloor({ ...art, y: 0.5 })).toBe(true);
    expect(canWalk(unit, { x: 2, z: 2 }, [rug])).toBe(true);
    expect(canWalk(unit, { x: 2, z: 0.25 }, [art])).toBe(true);
    expect(canWalk(unit, { x: 2, z: 0.25 }, [{ ...art, y: 0 }])).toBe(false);
    expect(canWalk(unit, { x: 2, z: 2 }, [item])).toBe(false);
  });
  test("wall art may sit flush on a wall; anything still has to stay inside a room", () => {
    expect(placementProblems(unit, art)).toEqual([]);
    expect(placementProblems(unit, rug)).toEqual([]);
    // Sunk a centimetre into the surface: fine hung on the wall, not standing on the floor.
    expect(placementProblems(unit, { ...art, z: art.z - 0.01 })).toEqual([]);
    expect(placementProblems(unit, { ...art, z: art.z - 0.01, y: 0 })).toEqual([
      "Item intersects a wall",
    ]);
    expect(placementProblems(unit, { ...art, z: art.z - 0.05 })).toEqual([
      "Item intersects a wall",
    ]);
    expect(placementProblems(unit, { ...art, z: -0.5 })).toEqual(["Item extends outside a room"]);
    expect(placementProblems(unit, { ...rug, x: 0.2 })).toEqual(["Item extends outside a room"]);
    expect(placementProblems(unit, { ...art, y: 4.5 })[0]).toContain("Invalid");
    expect(placementProblems(unit, { ...rug, height: 0.001 })[0]).toContain("Invalid");
  });
  test("neither collides with the fixtures Muse found", () => {
    const scene = detailedResult.output.scene as UnitScene;
    const cabinet = scene.appearance!.objects[0];
    const at = { x: cabinet.position.x, z: cabinet.position.z, width: 0.1, depth: 0.1 };
    expect(placementProblems(scene, { ...item, ...at }).join()).toContain("overlaps");
    expect(placementProblems(scene, { ...rug, ...at })).toEqual([]);
    expect(placementProblems(scene, { ...art, ...at, y: 2 })).toEqual([]);
  });
  test("saving accepts a height above the floor within range", async () => {
    const { ctx, tables } = db();
    const run = (placements: Placement[], revision: number) =>
      handler(save)(ctx, { viewerId: "u1", id: "s1", revision, scene: unit, placements });
    await run([rug, art], 0);
    expect(tables.unitScenes[0].placements).toEqual([rug, art]);
    await expect(run([{ ...art, y: 4.5 }], 1)).rejects.toThrow("Invalid item dimensions");
    await expect(run([{ ...art, y: -1 }], 1)).rejects.toThrow("Invalid item dimensions");
    await expect(run([{ ...rug, height: 0.001 }], 1)).rejects.toThrow("Invalid item dimensions");
  });
});
describe("private scene persistence", () => {
  test("another viewer cannot read or overwrite a scene", async () => {
    const { ctx } = db();
    await expect(ownScene(ctx, id("s1"), id("u2"))).rejects.toThrow("Unit not found");
    await expect(
      handler(save)(ctx, { viewerId: "u2", id: "s1", revision: 0, scene: unit, placements: [] }),
    ).rejects.toThrow("Unit not found");
  });
  test("room creation is idempotent and converts measured feet to meters", async () => {
    const { ctx, tables } = db();
    const run = handler<Record<string, unknown>, string>(create);
    const a = await run(ctx, { viewerId: "u1", roomId: "r1" }),
      b = await run(ctx, { viewerId: "u1", roomId: "r1" });
    expect(a).toBe(b);
    const row = tables.unitScenes.find((r) => r._id === a)!;
    expect((row.scene as UnitScene).rooms[0].polygon[1].x).toBeCloseTo(3.048);
    await expect(run(ctx, { viewerId: "u2", roomId: "r1" })).rejects.toThrow("Room not found");
  });
  test("saving rejects a stale version and invalidates older generation candidates", async () => {
    const { ctx, tables } = db();
    tables.unitScenes[0].candidate = manualScene(7, 8);
    await handler(save)(ctx, {
      viewerId: "u1",
      id: "s1",
      revision: 0,
      scene: unit,
      placements: [item],
    });
    expect(tables.unitScenes[0].candidate).toBeUndefined();
    await expect(
      handler(save)(ctx, { viewerId: "u1", id: "s1", revision: 0, scene: unit, placements: [] }),
    ).rejects.toThrow("another tab");
    expect(tables.unitScenes[0].placements).toEqual([item]);
  });
  test("late model results cannot overwrite edited geometry; applying a candidate retains items", async () => {
    const { ctx, tables } = db();
    const row = tables.unitScenes[0];
    row.jobId = "j1";
    row.revision = 1;
    // The build was started at revision 1; a result from the stage before it is stale.
    row.generation = { status: "layout", revision: 1, autoApply: false };
    await handler(saveCandidate)(ctx, {
      id: "s1",
      ownerId: "u1",
      revision: 0,
      jobId: "j1",
      candidate: manualScene(8, 9),
      explanation: "",
      runId: "run1",
    });
    expect(row.candidate).toBeUndefined();
    expect(row.scene).toEqual(unit);
    await handler(saveCandidate)(ctx, {
      id: "s1",
      ownerId: "u1",
      revision: 1,
      jobId: "j1",
      candidate: manualScene(8, 9),
      explanation: "",
      runId: "run1",
    });
    await handler(acceptCandidate)(ctx, { viewerId: "u1", id: "s1", revision: 2 });
    expect(row.placements).toEqual([item]);
    expect(row.revision).toBe(3);
  });
});
