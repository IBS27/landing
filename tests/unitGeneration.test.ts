import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import { retainValidAppearance } from "../convex/lib/unitAppearancePartial";
import { isStarterScene, refreshedSources } from "../convex/lib/unitGeneration";
import { manualScene, sceneProblems, type UnitScene } from "../convex/lib/unitScene";
import { saveCandidate } from "../convex/unitScenes";
import invalidDetails from "../scripts/unit-scenes/heathmead-detailed-initial.result.json";
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
