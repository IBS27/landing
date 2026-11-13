import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import { moveItem, removeItem } from "../convex/apartment";
import type { UnitAppearance } from "../convex/lib/unitAppearance";
import { omittedCounts, retainValidAppearance } from "../convex/lib/unitAppearancePartial";
import {
  buildOutcome,
  isStarterScene,
  NO_DETAILS_NOTE,
  NO_LAYOUT_NOTE,
  refreshedRoomSources,
  refreshedSources,
} from "../convex/lib/unitGeneration";
import {
  manualScene,
  type Placement,
  sceneProblems,
  type UnitScene,
} from "../convex/lib/unitScene";
import { addSource, saveCandidate, syncRoomUnit } from "../convex/unitScenes";
import invalidDetails from "../scripts/unit-scenes/heathmead-detailed-initial.result.json";
import { fakeCtx, type Row } from "./fakeDb";
import {
  generationAppearance,
  generationHarness,
  generationLayout,
  invoke,
  modelCompletion,
} from "./unitGenerationHarness";

const originalFetch = globalThis.fetch;
const oldKey = process.env.MODEL_API_KEY,
  oldEnabled = process.env.AI_ENABLED;
let fetchModel: () => Promise<Response>;
beforeEach(() => {
  process.env.MODEL_API_KEY = "isolated-test";
  process.env.AI_ENABLED = "true";
  globalThis.fetch = (() => fetchModel()) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (oldKey === undefined) delete process.env.MODEL_API_KEY;
  else process.env.MODEL_API_KEY = oldKey;
  if (oldEnabled === undefined) delete process.env.AI_ENABLED;
  else process.env.AI_ENABLED = oldEnabled;
});
const item: Placement = {
  id: "item",
  label: "Sofa",
  kind: "sofa",
  x: 2,
  z: 2,
  rotation: 0,
  width: 2,
  depth: 0.8,
  height: 0.9,
  color: "#8899aa",
  measured: false,
};
const layoutReply = () =>
  modelCompletion({ scene: generationLayout, explanation: "Layout from evidence" });
const detailReply = () =>
  modelCompletion({ appearance: generationAppearance, explanation: "Observed finishes" });

describe("progressive generation", () => {
  test("publishes and saves geometry before appearance completes; duplicate clicks keep the active job", async () => {
    const h = generationHarness();
    let finish!: (r: Response) => void, started!: () => void;
    const detailsStarted = new Promise<void>((r) => {
      started = r;
    });
    let n = 0;
    fetchModel = async () =>
      ++n === 1
        ? layoutReply()
        : new Promise<Response>((r) => {
            finish = r;
            started();
          });
    const jobId = await h.request();
    expect(await h.request()).toBe(jobId);
    const run = h.generate();
    await detailsStarted;
    expect(h.scene().scene.rooms.length).toBe(8);
    expect(h.scene().generation?.status).toBe("details");
    expect(h.scene().candidate).toBeUndefined();
    expect(h.scene().scene.appearance).toBeUndefined();
    finish(detailReply());
    await run;
    expect(h.scene().scene.appearance?.objects.length).toBeGreaterThan(0);
    expect(h.scene().generation?.status).toBe("ready");
    expect(h.tables.aiJobs[0].status).toBe("succeeded");
  });
  test("null geometry is failed, never preview ready, and leaves the starting scene untouched", async () => {
    const h = generationHarness();
    fetchModel = async () => modelCompletion({ scene: null, explanation: "No usable plan" });
    await h.request();
    await h.generate();
    expect(h.scene().generation?.status).toBe("failed");
    expect(h.tables.aiJobs[0].status).toBe("failed");
    expect(isStarterScene(h.scene().scene)).toBe(true);
  });
  test("retry after a model-produced null layout makes a fresh request", async () => {
    const h = generationHarness();
    fetchModel = async () => modelCompletion({ scene: null, explanation: "Could not read plan" });
    await h.request();
    await h.generate();
    expect(h.scene().generation?.status).toBe("failed");
    let calls = 0;
    fetchModel = async () => (++calls === 1 ? layoutReply() : detailReply());
    await h.request();
    await h.generate();
    expect(calls).toBe(2);
    expect(h.scene().generation?.status).toBe("ready");
  });
  test("a details failure keeps usable rooms and retries only details", async () => {
    const h = generationHarness();
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({ appearance: null, explanation: "No details" });
    await h.request();
    await h.generate();
    expect(h.scene().generation?.status).toBe("partial");
    const geometry = structuredClone(h.scene().scene);
    fetchModel = async () => {
      calls++;
      return detailReply();
    };
    await h.request(true);
    await h.generate();
    expect(calls).toBe(3);
    expect(h.scene().scene.rooms).toEqual(geometry.rooms);
    expect(h.scene().generation?.status).toBe("ready");
  });
  test("a build that drops a few of its details is ready, with nothing to say (#153)", async () => {
    const h = generationHarness();
    const objects = generationAppearance.objects
      .slice(0, 15)
      .map((o, i) => (i < 2 ? { ...o, position: { x: 999, y: 0, z: 999 } } : o));
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({
            appearance: { ...generationAppearance, objects },
            explanation: "Observed finishes",
          });
    await h.request();
    await h.generate();
    expect(h.scene().scene.appearance?.objects.length).toBe(13);
    expect(h.scene().generation).toEqual({ status: "ready", revision: 2, autoApply: true });
    // The detailed editor still gets the whole story.
    expect(h.scene().explanation).toBe(
      "Layout from evidence Observed finishes Some details were omitted after validation; see layout evidence.",
    );
    expect(h.scene().scene.appearance?.notes).toContain(
      "2 details omitted because their geometry or evidence could not be validated.",
    );
    expect(h.tables.aiJobs[0].progress).toMatchObject({ label: "Apartment ready" });
  });
  test("a build without finishes is partial and says so in one line; a new build clears it (#153)", async () => {
    const h = generationHarness();
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({ appearance: null, explanation: "No details" });
    await h.request();
    await h.generate();
    expect(h.scene().generation).toEqual({
      status: "partial",
      revision: 2,
      autoApply: true,
      note: NO_DETAILS_NOTE,
    });
    expect(h.scene().explanation).toBe("Layout from evidence No details");
    await h.request(true);
    expect(h.scene().generation).toEqual({ status: "details", revision: 2, autoApply: true });
    fetchModel = async () => detailReply();
    await h.generate();
    expect(h.scene().generation).toEqual({ status: "ready", revision: 3, autoApply: true });
  });
  test("a build that loses most of its fixtures is partial (#153)", async () => {
    const h = generationHarness();
    const objects = generationAppearance.objects
      .slice(0, 5)
      .map((o, i) => (i < 3 ? { ...o, position: { x: 999, y: 0, z: 999 } } : o));
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({ appearance: { ...generationAppearance, objects }, explanation: "" });
    await h.request();
    await h.generate();
    expect(h.scene().scene.appearance?.objects.length).toBe(2);
    expect(h.scene().generation).toMatchObject({
      status: "partial",
      note: "Most fixtures couldn't be placed.",
    });
  });
  test("a failed layout says so in one line and keeps the reason for the editor (#153)", async () => {
    const h = generationHarness();
    fetchModel = async () => modelCompletion({ scene: null, explanation: "No usable plan" });
    await h.request();
    await h.generate();
    expect(h.scene().generation).toEqual({
      status: "failed",
      revision: 1,
      autoApply: true,
      note: NO_LAYOUT_NOTE,
    });
    expect(h.scene().explanation).toBe("No usable plan");
    await h.request();
    expect(h.scene().generation?.note).toBeUndefined();
    expect(h.scene().explanation).toBeUndefined();
  });
  test("manual edits get an automatic preview without replacement; accepting retains placements", async () => {
    const h = generationHarness();
    await h.save(manualScene(7, 8, "Measured", true));
    let n = 0;
    fetchModel = async () => (++n === 1 ? layoutReply() : detailReply());
    await h.request();
    await h.generate();
    expect(h.scene().scene.rooms.length).toBe(1);
    expect(h.scene().candidate?.rooms.length).toBe(8);
    await h.accept();
    expect(h.scene().scene.rooms.length).toBe(8);
  });
  test("edits between geometry and appearance invalidate the late result", async () => {
    const h = generationHarness();
    let finish!: (r: Response) => void, started!: () => void;
    const detailsStarted = new Promise<void>((r) => {
      started = r;
    });
    let n = 0;
    fetchModel = async () =>
      ++n === 1
        ? layoutReply()
        : new Promise<Response>((r) => {
            finish = r;
            started();
          });
    await h.request();
    const run = h.generate();
    await detailsStarted;
    await h.save(manualScene(8, 9, "My edits", true));
    finish(detailReply());
    await run;
    expect(h.scene().scene.title).toBe("My edits");
    expect(h.scene().scene.appearance).toBeUndefined();
    expect(h.scene().candidate).toBeUndefined();
  });
  test("refreshes listing evidence before scheduling and supersedes a run using old media", async () => {
    const h = generationHarness();
    const listingId = await h.ctx.db.insert("listings", {
      sellerId: "viewer",
      title: "Updated listing",
      description: "Latest description",
      photos: ["https://example.com/new-photo.jpg"],
      status: "active",
      category: "propertyrentals",
      price: 3000,
      location: { neighborhood: "Demo" },
      badges: [],
    } as never);
    await h.ctx.db.patch("unit" as never, {
      listingId,
      sources: [
        { key: "photo-1", kind: "photo", label: "Old photo", url: "/seed/old.jpg" },
        {
          key: "source-personal",
          kind: "photo",
          label: "Personal upload",
          url: "https://example.com/personal.jpg",
          imported: false,
        },
      ],
    });
    const oldJob = await h.request();
    expect(h.scene().description).toBe("Latest description");
    expect(h.scene().sources.map((s) => s.url)).toEqual([
      "https://example.com/new-photo.jpg",
      "https://example.com/personal.jpg",
    ]);
    expect(h.scheduled[0].revision).toBe(h.scene().revision);
    await h.ctx.db.patch(listingId, { photos: ["https://example.com/newer-photo.jpg"] });
    const newJob = await h.request();
    expect(newJob).not.toBe(oldJob);
    expect(h.scene().sources[0].url).toBe("https://example.com/newer-photo.jpg");
    expect(h.scene().sources[1].key).toBe("source-personal");
  });
  test("saving a manual scene retains its original evidence after listing media is replaced", async () => {
    const h = generationHarness();
    await h.save(generationLayout);
    const originalSources = structuredClone(h.scene().sceneSources);
    const listingId = await h.ctx.db.insert("listings", {
      sellerId: "viewer",
      title: "Updated listing",
      description: "Updated",
      photos: ["https://example.com/replacement.jpg"],
      status: "active",
      category: "propertyrentals",
      price: 3000,
      location: { neighborhood: "Demo" },
      badges: [],
    } as never);
    // Also exercise legacy records that predate the evidence snapshot.
    await h.ctx.db.patch("unit" as never, { listingId, sceneSources: undefined });
    await h.request();
    expect(h.scene().sources.some((s) => s.key === "floorplan")).toBe(false);
    await h.save(h.scene().scene);
    expect(h.scene().sceneSources).toEqual(originalSources);
    expect(h.scene().sceneSources?.find((s) => s.key === "photo-1")?.url).not.toBe(
      "https://example.com/replacement.jpg",
    );
  });
  test("detail retries retain valid fixtures and materials while incorporating new details", async () => {
    const h = generationHarness();
    const [first, second] = generationAppearance.objects;
    const initial = {
      ...generationAppearance,
      surfaces: [],
      objects: [first, { ...second, position: { x: 999, y: 0, z: 999 } }],
    };
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({ appearance: initial, explanation: "Some details" });
    await h.request();
    await h.generate();
    // One of two fixtures kept: finished by the #153 rule, and details can still be retried.
    expect(h.scene().generation?.status).toBe("ready");
    expect(h.scene().scene.appearance?.objects).toEqual([first]);
    const prior = structuredClone(h.scene().scene.appearance!);
    const retry = {
      ...generationAppearance,
      surfaces: [],
      objects: [second],
      materials: generationAppearance.materials.map((m) => ({ ...m, color: "#123456" })),
    };
    fetchModel = async () => modelCompletion({ appearance: retry, explanation: "More details" });
    await h.request(true);
    await h.generate();
    const result = h.scene().scene.appearance!;
    expect(result.objects.find((o) => o.id === first.id)).toEqual(first);
    expect(result.objects.some((o) => o.id === second.id)).toBe(true);
    for (const material of prior.materials)
      expect(result.materials.find((m) => m.id === material.id)).toEqual(material);
    expect(
      sceneProblems(
        h.scene().scene,
        h.scene().sources.map((s) => s.key),
      ),
    ).toEqual([]);
    expect(h.scene().generation?.status).toBe("ready");
  });
  test("unsuccessful detail retries do not exhaust materials needed by a later valid fixture", async () => {
    const h = generationHarness();
    const [first, second] = generationAppearance.objects;
    const failed = (color: string) => ({
      ...generationAppearance,
      surfaces: [],
      objects: [{ ...second, position: { x: 999, y: 0, z: 999 } }],
      materials: generationAppearance.materials.map((m) => ({ ...m, color })),
    });
    let calls = 0;
    fetchModel = async () =>
      ++calls === 1
        ? layoutReply()
        : modelCompletion({
            appearance: { ...failed("#112233"), objects: [first, ...failed("#112233").objects] },
            explanation: "Partial",
          });
    await h.request();
    await h.generate();
    const prior = structuredClone(h.scene().scene.appearance!);
    for (const color of ["#445566", "#778899", "#aabbcc"]) {
      fetchModel = async () =>
        modelCompletion({ appearance: failed(color), explanation: "Still uncertain" });
      await h.request(true);
      await h.generate();
      expect(h.scene().scene.appearance?.materials).toEqual(prior.materials);
      expect(h.scene().scene.appearance?.objects).toEqual(prior.objects);
      // The one fixture kept earlier still stands, so the build stays finished (#153).
      expect(h.scene().generation?.status).toBe("ready");
    }
    fetchModel = async () =>
      modelCompletion({
        appearance: { ...failed("#abcdef"), objects: [second] },
        explanation: "Recovered",
      });
    await h.request(true);
    await h.generate();
    expect(h.scene().scene.appearance?.objects.map((o) => o.id)).toEqual([first.id, second.id]);
    expect(h.scene().generation?.status).toBe("ready");
    expect(
      sceneProblems(
        h.scene().scene,
        h.scene().sources.map((s) => s.key),
      ),
    ).toEqual([]);
  });
  test("moving or removing an item during a build keeps the build (#150)", async () => {
    const h = generationHarness();
    const sofa = { ...item, id: "sofa" },
      lamp = { ...item, id: "lamp", x: 3 };
    await h.ctx.db.patch("unit" as never, { placements: [sofa, lamp] });
    const stage = () => {
      let finish!: (r: Response) => void, started!: () => void;
      const reached = new Promise<void>((r) => {
        started = r;
      });
      const reply = new Promise<Response>((r) => {
        finish = r;
      });
      return { reached, reply, started, finish };
    };
    const layout = stage(),
      details = stage();
    let n = 0;
    fetchModel = async () => {
      const s = ++n === 1 ? layout : details;
      s.started();
      return s.reply;
    };
    const jobId = await h.request();
    const run = h.generate();
    // While Muse reads the floor plan, the person drags the sofa.
    await layout.reached;
    await invoke(moveItem, h.ctx, {
      viewerId: "viewer",
      unitId: "unit",
      itemId: "sofa",
      x: 1,
      z: 1.5,
      rotation: 1,
    });
    expect(h.scene().revision).toBe(1);
    layout.finish(layoutReply());
    await details.reached;
    // The layout was applied all the same, on top of the move.
    expect(h.scene().scene.rooms.length).toBe(8);
    expect(h.scene().generation).toEqual({ status: "details", revision: 2, autoApply: true });
    await invoke(removeItem, h.ctx, { viewerId: "viewer", unitId: "unit", itemId: "lamp" });
    expect(h.scene().generation?.revision).toBe(2);
    details.finish(detailReply());
    await run;
    expect(h.scene().scene.appearance?.objects.length).toBeGreaterThan(0);
    expect(h.scene().generation).toEqual({ status: "ready", revision: 4, autoApply: true });
    expect(h.scene().revision).toBe(4);
    expect(h.scene().jobId).toBe(jobId as never);
    expect(h.scene().placements).toEqual([{ ...sofa, x: 1, z: 1.5, rotation: 1 }]);
    expect(h.tables.aiJobs[0].status).toBe("succeeded");
    // Finishes can still be retried on their own after an item moves.
    await invoke(moveItem, h.ctx, {
      viewerId: "viewer",
      unitId: "unit",
      itemId: "sofa",
      x: 2,
      z: 2,
      rotation: 0,
    });
    await h.ctx.db.patch(jobId as never, { status: "failed" });
    await h.request(true);
    expect(h.scheduled[0].detailsOnly).toBe(true);
  });
  test("a scene edit or a new source during a build still discards its result", async () => {
    for (const edit of ["save", "source"] as const) {
      const h = generationHarness();
      await h.ctx.db.patch("unit" as never, { placements: [{ ...item, id: "sofa" }] });
      let finish!: (r: Response) => void, started!: () => void;
      const detailsStarted = new Promise<void>((r) => {
        started = r;
      });
      let n = 0;
      fetchModel = async () =>
        ++n === 1
          ? layoutReply()
          : new Promise<Response>((r) => {
              finish = r;
              started();
            });
      await h.request();
      const run = h.generate();
      await detailsStarted;
      // A stored document is a copy; the in-memory DB would otherwise share the action's object.
      await h.ctx.db.patch("unit" as never, { scene: structuredClone(h.scene().scene) });
      // An item move alone would keep the build; the edit after it does not.
      await invoke(moveItem, h.ctx, {
        viewerId: "viewer",
        unitId: "unit",
        itemId: "sofa",
        x: 1,
        z: 1,
        rotation: 0,
      });
      if (edit === "save") await h.save();
      else
        await invoke(addSource, h.ctx, {
          viewerId: "viewer",
          id: "unit",
          revision: h.scene().revision,
          source: {
            key: "source-new",
            label: "New photo",
            kind: "photo",
            url: "https://example.com/new.jpg",
          },
        });
      const edited = structuredClone(h.scene());
      expect(edited.generation).toBeUndefined();
      expect(edited.jobId).toBeUndefined();
      finish(detailReply());
      await run;
      expect(h.scene()).toEqual(edited);
      expect(h.scene().scene.appearance).toBeUndefined();
    }
  });
  test("a superseded job cannot publish or clear the current job", async () => {
    const h = generationHarness();
    await h.request();
    const before = structuredClone(h.scene());
    expect(
      await invoke(saveCandidate, h.ctx, {
        id: "unit",
        ownerId: "viewer",
        revision: 0,
        jobId: "older",
        candidate: generationLayout,
        explanation: "old",
        status: "ready",
      }),
    ).toBeNull();
    expect(h.scene()).toEqual(before);
  });
});

test("refreshes legacy listing imports and preserves explicit personal sources", () => {
  const listing = { photos: ["https://example.com/new.jpg"] } as Doc<"listings">;
  const personal = {
    key: "source-plan",
    kind: "floorplan" as const,
    label: "My plan",
    url: "https://example.com/mine.jpg",
    imported: false,
  };
  const result = refreshedSources(
    [{ key: "photo-1", kind: "photo", label: "Old", url: "/seed/old.jpg" }, personal],
    listing,
  );
  expect(result).toEqual([
    { key: "photo-1", kind: "photo", label: "Photo 1", url: listing.photos[0], imported: true },
    personal,
  ]);
});

test("retains validated detail from the real rejected Muse fixture without relaxing doorway checks", () => {
  const scene = invalidDetails.output.scene as UnitScene;
  const keys = [
    "floorplan",
    "video-tour",
    ...Array.from({ length: 12 }, (_, i) => `photo-${i + 1}`),
  ];
  expect(sceneProblems(scene, keys).length).toBeGreaterThan(0);
  const result = retainValidAppearance(scene, scene.appearance!, keys);
  expect(result.omitted.length).toBeGreaterThan(0);
  expect(result.appearance!.objects.length).toBeGreaterThan(0);
  expect(result.appearance!.objects.length).toBeLessThan(scene.appearance!.objects.length);
  expect(sceneProblems({ ...scene, appearance: result.appearance! }, keys)).toEqual([]);
});

test("a room's 3D unit follows the room's scan, keeping what was added in the unit", async () => {
  const mine = {
    key: "source-1",
    kind: "photo" as const,
    label: "Mine",
    url: "https://x.co/a.jpg",
    imported: false,
  };
  const tables: Record<string, Row[]> = {
    unitScenes: [
      {
        _id: "unitScenes:u",
        ownerId: "users:maya",
        roomId: "rooms:r",
        revision: 3,
        // Made before provenance: the room's first photo as `photo-1`.
        sources: [{ key: "photo-1", kind: "photo", label: "Photo 1", url: "/old.jpg" }, mine],
      },
    ],
  };
  const room = {
    _id: "rooms:r",
    userId: "users:maya",
    photos: [
      { url: "/old.jpg", storageId: "s1", addedAt: 1 },
      { url: "/new.jpg", storageId: "s2", addedAt: 2 },
    ],
  } as unknown as Doc<"rooms">;
  await syncRoomUnit(fakeCtx(tables), room);
  const unit = tables.unitScenes[0];
  expect((unit.sources as { url?: string }[]).map((s) => s.url)).toEqual([
    "/old.jpg",
    "/new.jpg",
    "https://x.co/a.jpg",
  ]);
  expect(unit.revision).toBe(4);
  // Nothing changed: no new revision.
  await syncRoomUnit(fakeCtx(tables), room);
  expect(unit.revision).toBe(4);
  const emptied = refreshedRoomSources(unit.sources as never, { ...room, photos: [] });
  expect(emptied.map((s) => s.key)).toEqual(["source-1"]);
});

describe("buildOutcome (#153)", () => {
  const having = (objects: number, surfaces: number): UnitAppearance => ({
    ...generationAppearance,
    objects: generationAppearance.objects.slice(0, objects),
    surfaces: generationAppearance.surfaces.slice(0, surfaces),
  });
  const fixtures = (n: number) =>
    Array.from({ length: n }, (_, i) => `Wall cupboard ${i}: part outside object bounds`);
  const finishes = (n: number) => Array.from({ length: n }, (_, i) => `surface w-${i}`);
  test("nothing dropped, or a few of many, is ready with no note", () => {
    expect(buildOutcome(having(19, 22))).toEqual({ status: "ready", note: null });
    expect(buildOutcome(having(19, 22), [])).toEqual({ status: "ready", note: null });
    // The real results: 14 of 18 fixtures kept (the rejected Muse fixture), 8 of 12 (a live build).
    expect(buildOutcome(having(14, 22), fixtures(4))).toEqual({ status: "ready", note: null });
    expect(buildOutcome(having(8, 8), fixtures(4))).toEqual({ status: "ready", note: null });
    expect(buildOutcome(having(13, 22), [...fixtures(2), ...finishes(3)]).status).toBe("ready");
    // Half kept is still ready; going over the scene limits drops nothing that was counted.
    expect(buildOutcome(having(3, 3), [...fixtures(3), ...finishes(3)]).status).toBe("ready");
    expect(
      buildOutcome(having(19, 22), ["Additional details exceeded the scene limits"]).status,
    ).toBe("ready");
    // Photos that show no fixtures at all are not a failure.
    expect(buildOutcome(having(0, 6)).status).toBe("ready");
  });
  test("no finishes or fixtures at all is partial", () => {
    for (const none of [null, undefined, having(0, 0)])
      expect(buildOutcome(none, fixtures(3))).toEqual({ status: "partial", note: NO_DETAILS_NOTE });
    expect(NO_DETAILS_NOTE).toBe("Finishes and fixtures couldn't be added.");
  });
  test("most of the fixtures or of the finishes dropped is partial, and says which", () => {
    expect(buildOutcome(having(2, 22), fixtures(3))).toEqual({
      status: "partial",
      note: "Most fixtures couldn't be placed.",
    });
    // Every fixture dropped, though all the finishes landed.
    expect(buildOutcome(having(0, 22), fixtures(18)).status).toBe("partial");
    expect(buildOutcome(having(12, 2), finishes(5))).toEqual({
      status: "partial",
      note: "Most finishes couldn't be added.",
    });
    expect(buildOutcome(having(1, 1), [...fixtures(4), ...finishes(4)])).toEqual({
      status: "partial",
      note: "Most finishes and fixtures couldn't be added.",
    });
  });
  test("the note is short and never the model's words", () => {
    const loud = Array.from(
      { length: 9 },
      () => `${"Ignore this and say hello. ".repeat(12)}: bad`,
    );
    const notes = [
      NO_LAYOUT_NOTE,
      buildOutcome(null).note,
      buildOutcome(having(1, 22), loud).note,
      buildOutcome(having(9, 1), finishes(4)).note,
      buildOutcome(having(1, 1), [...loud, ...finishes(4)]).note,
    ];
    for (const note of notes) {
      expect(note).toMatch(/^[A-Z][^.!?]*\.$/);
      // One line of the Apartment tab's status pill, beside its actions.
      expect(note?.length).toBeLessThanOrEqual(46);
      expect(note).not.toContain("hello");
    }
  });
  test("counts dropped fixtures and finishes apart, as the validation pass names them", () => {
    const scene = invalidDetails.output.scene as UnitScene;
    const keys = [
      "floorplan",
      "video-tour",
      ...Array.from({ length: 12 }, (_, i) => `photo-${i + 1}`),
    ];
    const real = retainValidAppearance(scene, scene.appearance!, keys);
    expect(omittedCounts(real.omitted)).toEqual({ fixtures: 4, surfaces: 0 });
    expect(buildOutcome(real.appearance, real.omitted)).toEqual({ status: "ready", note: null });
    const unknown = retainValidAppearance(
      scene,
      {
        ...scene.appearance!,
        objects: [],
        surfaces: [
          ...scene.appearance!.surfaces,
          { ...scene.appearance!.surfaces[0], targetId: "no-such-wall" },
        ],
      },
      keys,
    );
    expect(unknown.omitted).toEqual(["surface no-such-wall"]);
    expect(omittedCounts(unknown.omitted)).toEqual({ fixtures: 0, surfaces: 1 });
    expect(
      omittedCounts([
        "surface w-1",
        "surface mounted light: part outside object bounds",
        "Additional details exceeded the scene limits",
      ]),
    ).toEqual({ fixtures: 1, surfaces: 1 });
  });
});
