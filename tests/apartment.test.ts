import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import { validate } from "convex-helpers/validators";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import * as jobs from "../convex/ai/jobs";
import type { ApartmentView, FurnishReply } from "../convex/apartment";
import * as apartment from "../convex/apartment";
import type { FurnishInput } from "../convex/lib/furnishTask";
import { type ItemModel, itemModelProblems, proxyModel } from "../convex/lib/itemModel";
import { itemSize, manualScene, type Placement, placementProblems } from "../convex/lib/unitScene";
import { save } from "../convex/unitScenes";
import { fakeCtx, type Row } from "./fakeDb";
import { invoke, modelCompletion } from "./unitGenerationHarness";

// Landing Home's Apartment tab (#150): the unit, its items, furnishing and item models.
type Args = Record<string, unknown>;
const HTTPS = "https://example.com/photo.jpg";
const oldKey = process.env.MODEL_API_KEY,
  oldEnabled = process.env.AI_ENABLED;
const originalFetch = globalThis.fetch;
/** What the model answers; each call's request body is recorded. */
let reply: (body: { model: string; messages: { content: unknown }[] }) => unknown;
let requests: { model: string }[];
const ai = (on: boolean) => {
  if (on) process.env.MODEL_API_KEY = "isolated-test";
  else delete process.env.MODEL_API_KEY;
  process.env.AI_ENABLED = "true";
};
beforeEach(() => {
  ai(false);
  requests = [];
  reply = () => {
    throw new Error("Unexpected model call");
  };
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    return modelCompletion(reply(body));
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (oldKey === undefined) delete process.env.MODEL_API_KEY;
  else process.env.MODEL_API_KEY = oldKey;
  if (oldEnabled === undefined) delete process.env.AI_ENABLED;
  else process.env.AI_ENABLED = oldEnabled;
});

const listing = (id: string, title: string, price: number, extra: Args = {}): Row => ({
  _id: id,
  sellerId: "seller",
  title,
  description: `${title}.`,
  price,
  photos: [`/seed/${id}.jpg`],
  category: "furniture",
  status: "active",
  location: { city: "San Francisco, CA", neighborhood: "Mission" },
  badges: [],
  createdAt: 100,
  updatedAt: 100,
  viewCount: 0,
  ...extra,
});
const base: Omit<Placement, "id"> = {
  label: "Item",
  kind: "table",
  x: 2.5,
  z: 3,
  rotation: 0,
  ...itemSize("table"),
  color: "#76958f",
  measured: false,
};
const READY = manualScene(5, 6, "Sunny one-bedroom");

function world(
  opts: {
    scene?: "none" | "starter" | "ready";
    photos?: string[];
    /** Rows that must exist before the fake DB indexes them by id. */
    more?: Record<string, Row[]>;
  } = {},
) {
  const tables: Record<string, Row[]> = {
    users: ["u1", "u2", "seller", "blocked"].map((_id) => ({ _id })),
    blocks: [{ _id: "b1", userId: "u1", blockedId: "blocked" }],
    neighborhoods: [
      {
        _id: "n1",
        slug: "mission",
        name: "Mission",
        center: { lat: 37.76, lng: -122.42 },
      },
    ],
    places: [
      {
        _id: "p1",
        userId: "u1",
        listingId: "home",
        neighborhoodId: "n1",
        moveIn: "2026-12-01",
        status: "moving_in",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    listings: [
      listing("home", "Sunny one-bedroom", 3200, {
        category: "propertyrentals",
        rental: { listingType: "rent", propertyType: "apartment", bedrooms: 1, bathrooms: 1 },
        photos: opts.photos ?? ["/seed/home-1.jpg", "/seed/home-2.jpg"],
        location: {
          city: "San Francisco, CA",
          neighborhood: "Mission",
          lat: 37.7612345,
          lng: -122.4198765,
        },
        neighborhoodId: "n1",
      }),
      listing("sofa", "Mid-century teak sofa", 400, { createdAt: 90 }),
      listing("bed", "Queen bed frame, walnut", 250, { createdAt: 89 }),
      listing("table", "Mid century coffee table", 120, { createdAt: 88 }),
      listing("rug", "Wool rug, cozy", 80, { category: "household", createdAt: 87 }),
      listing("lamp", "Brass floor lamp", 60, { category: "household", createdAt: 86 }),
      listing("plant", "Monstera plant", 25, { category: "garden", createdAt: 85 }),
      listing("poster", "Framed poster", 30, { category: "hobbies", createdAt: 84 }),
      // Never candidates:
      listing("mine", "My own walnut sofa", 10, { sellerId: "u1" }),
      listing("hidden", "Blocked seller's teak sofa", 10, { sellerId: "blocked" }),
      listing("sold", "Sold walnut sofa", 10, { status: "sold" }),
      listing("car", "Walnut-trim vintage car", 10, { category: "vehicles" }),
      listing("gone-seller", "Teak sofa from a deleted account", 10, { sellerId: "nobody" }),
      listing("pricey", "Designer walnut sofa", 5000),
    ],
    unitScenes:
      (opts.scene ?? "ready") === "none"
        ? []
        : [
            {
              _id: "unit",
              _creationTime: 1,
              ownerId: "u1",
              listingId: "home",
              scene: opts.scene === "starter" ? manualScene(4, 5, "Sunny one-bedroom") : READY,
              placements: [],
              sources: [],
              description: "",
              revision: 0,
              manuallyEdited: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
    itemModels: [],
    ownedItems: [],
    aiJobs: [],
    aiRuns: [],
  };
  for (const [table, rows] of Object.entries(opts.more ?? {}))
    tables[table] = [...(tables[table] ?? []), ...rows];
  const ctx = fakeCtx(tables);
  const scheduled: { name: string; args: Args }[] = [];
  ctx.scheduler = {
    runAfter: async (_delay: number, ref: FunctionReference<"action" | "mutation">, args: Args) => {
      scheduled.push({ name: getFunctionName(ref), args });
      return "scheduled" as Id<"_scheduled_functions">;
    },
  } as MutationCtx["scheduler"];
  const action = {
    runQuery: async (ref: FunctionReference<"query">, args: Args) => {
      switch (getFunctionName(ref)) {
        case "apartment:context":
          return structuredClone(await invoke(apartment.context, ctx, args));
        case "apartment:modelContext":
          return structuredClone(await invoke(apartment.modelContext, ctx, args));
        case "ai/sources:resolve":
          return [];
        case "ai/runs:wrongTableIds":
          return (args.ids as { id: string; table: string }[])
            .filter(({ id, table }) => ctx.db.normalizeId(table as never, id) === null)
            .map(({ id }) => id);
        case "ai/runs:cached":
          return null;
        default:
          throw new Error(`Unexpected query: ${getFunctionName(ref)}`);
      }
    },
    runMutation: async (ref: FunctionReference<"mutation">, args: Args) => {
      switch (getFunctionName(ref)) {
        case "apartment:place":
          return invoke(apartment.place, ctx, args);
        case "apartment:saveModel":
          return invoke(apartment.saveModel, ctx, args);
        case "ai/jobs:update":
          return invoke(jobs.update, ctx, args);
        case "ai/runs:log":
          return ctx.db.insert("aiRuns", args as never);
        default:
          throw new Error(`Unexpected mutation: ${getFunctionName(ref)}`);
      }
    },
  } as unknown as ActionCtx;
  const unit = () => tables.unitScenes[0] as unknown as Doc<"unitScenes">;
  const as = (viewerId: string) => ({
    // Every result is held to the function's `returns` validator, as Convex does.
    get: async () => {
      const view = await invoke<ApartmentView>(apartment.get, ctx, { viewerId });
      validate(apartment.apartmentView, view, { throw: true });
      return view;
    },
    build: () => invoke<string>(apartment.build, ctx, { viewerId }),
    move: (itemId: string, to: Args, unitId = "unit") =>
      invoke<number>(apartment.moveItem, ctx, { viewerId, unitId, itemId, ...to }),
    remove: (itemId: string, unitId = "unit") =>
      invoke<number>(apartment.removeItem, ctx, { viewerId, unitId, itemId }),
    add: (listingId: string, unitId = "unit") =>
      invoke<string>(apartment.addItem, ctx, { viewerId, unitId, listingId }),
    furnish: async (vibe: string, budget?: number) => {
      const r = await invoke<FurnishReply>(apartment.furnish, action, {
        viewerId,
        vibe,
        ...(budget === undefined ? {} : { budget }),
      });
      validate(apartment.furnishReply, r, { throw: true });
      return r;
    },
    context: (vibe: string, budget?: number) =>
      apartment.furnishContext(ctx, {
        viewerId: viewerId as Id<"users">,
        vibe,
        ...(budget === undefined ? {} : { budget }),
      }),
  });
  /** Runs the scheduled item-model job, as the scheduler would. */
  const runModels = async () => {
    const at = scheduled.findIndex((s) => s.name === "apartment:buildModels");
    const [job] = scheduled.splice(at, 1);
    await invoke(apartment.buildModels, action, job.args);
  };
  const placeRow = (p: Partial<Placement> & { id: string }) => {
    tables.unitScenes[0].placements = [...unit().placements, { ...base, ...p }];
  };
  return { tables, ctx, action, scheduled, unit, as, me: as("u1"), runModels, placeRow };
}
const ready = (c: Awaited<ReturnType<ReturnType<typeof world>["me"]["context"]>>) => {
  if (!c.ready) throw new Error(`Not ready: ${c.text}`);
  return c;
};
const ids = (input: FurnishInput) => input.candidates.map((c) => c.id);

describe("apartment.get", () => {
  test("someone with no place has nothing", async () => {
    const w = world();
    expect(await w.as("u2").get()).toEqual({
      aiOn: false,
      place: null,
      unit: null,
      items: [],
      spent: 0,
    });
  });
  test("a place from a listing: its public title and an approximate point, never the address", async () => {
    const w = world({ scene: "none" });
    const view = await w.me.get();
    expect(view.place).toMatchObject({
      listingId: "home",
      title: "Sunny one-bedroom",
      neighborhood: "Mission",
      moveIn: "2026-12-01",
      status: "moving_in",
    });
    const point = view.place?.point;
    expect(point).not.toBeNull();
    expect(point).not.toEqual({ lat: 37.7612345, lng: -122.4198765 });
    expect(Math.abs((point?.lat ?? 0) - 37.7612345)).toBeLessThan(0.004);
    expect(view.unit).toBeNull();
  });
  test("a place found elsewhere uses the neighborhood's centre and its own unit", async () => {
    const w = world({ scene: "none" });
    delete w.tables.places[0].listingId;
    expect((await w.me.get()).place).toMatchObject({
      listingId: null,
      title: "Your place in Mission",
      point: { lat: 37.76, lng: -122.42 },
    });
    const id = await w.me.build();
    expect(await w.me.build()).toBe(id);
    expect(w.tables.unitScenes.length).toBe(1);
    expect(w.unit().listingId).toBeUndefined();
    const view = await w.me.get();
    expect(view.unit).toMatchObject({ id, state: "starter", canBuild: false, jobId: null });
    // A room's scene is never mistaken for the place's unit.
    w.tables.unitScenes.push({
      ...w.tables.unitScenes[0],
      _id: "room-unit",
      roomId: "r1",
      updatedAt: 9e15,
    });
    expect((await w.me.get()).unit?.id).toBe(id);
  });
  test("a place whose listing the viewer can no longer see leaks nothing about it", async () => {
    const w = world();
    w.tables.listings[0].sellerId = "blocked";
    const view = await w.me.get();
    expect(view.place).toMatchObject({ listingId: null, title: "Your place in Mission" });
    expect(view.place?.point).toEqual({ lat: 37.76, lng: -122.42 });
    expect(view.unit).toBeNull();
  });
  test("starter, building, ready, partial and failed states", async () => {
    const w = world({ scene: "starter", photos: [HTTPS] });
    expect((await w.me.get()).unit).toMatchObject({ state: "starter", canBuild: false });
    ai(true);
    const starter = await w.me.get();
    expect(starter.aiOn).toBe(true);
    expect(starter.unit).toMatchObject({
      state: "starter",
      canBuild: true,
      revision: 0,
      jobId: null,
      explanation: null,
      furnishing: null,
    });
    await w.me.build();
    const jobId = w.unit().jobId;
    expect((await w.me.get()).unit).toMatchObject({ state: "building", jobId });
    // The layout arrives while finishes are still being added.
    await w.ctx.db.patch("unit" as never, { scene: READY });
    expect((await w.me.get()).unit).toMatchObject({ state: "building", jobId });
    const finish = async (status: string, scene = READY) => {
      await w.ctx.db.patch(jobId as never, { status: "succeeded" });
      await w.ctx.db.patch("unit" as never, {
        scene,
        generation: { status, revision: w.unit().revision, autoApply: true },
        explanation: "From the floor plan",
      });
      return (await w.me.get()).unit;
    };
    expect(await finish("ready")).toMatchObject({
      state: "ready",
      jobId: null,
      explanation: "From the floor plan",
    });
    expect(await finish("partial")).toMatchObject({ state: "partial" });
    expect(await finish("failed", manualScene(4, 5, "Sunny one-bedroom"))).toMatchObject({
      state: "failed",
    });
    // A hand-made scene with no build is simply ready.
    await w.ctx.db.patch("unit" as never, { scene: READY, generation: undefined });
    expect((await w.me.get()).unit).toMatchObject({ state: "ready" });
  });
  test("items: listings, owned things, plain shapes, and what they cost", async () => {
    const w = world({
      more: {
        ownedItems: [
          {
            _id: "o1",
            userId: "u1",
            title: "My desk",
            price: 70,
            photos: ["/seed/desk.jpg"],
            source: { kind: "manual" },
          },
          {
            _id: "o-bought",
            userId: "u1",
            title: "Monstera plant",
            price: 25,
            photos: [],
            source: { kind: "marketplace", listingId: "plant", conversationId: "c1" },
          },
          {
            _id: "o-theirs",
            userId: "u2",
            title: "Their chair",
            price: 5,
            photos: [],
            source: { kind: "manual" },
          },
        ],
      },
    });
    w.tables.itemModels = [
      {
        _id: "m1",
        ownerId: "u1",
        listingId: "sofa",
        kind: "sofa",
        status: "ready",
        model: proxyModel("sofa", itemSize("sofa"), "#888888"),
        createdAt: 1,
        updatedAt: 1,
      },
      // Someone else's model of the same listing is never shown.
      { _id: "m2", ownerId: "u2", listingId: "rug", kind: "rug", status: "ready", updatedAt: 1 },
      {
        _id: "m3",
        ownerId: "u1",
        listingId: "lamp",
        kind: "lamp",
        status: "building",
        updatedAt: Date.now(),
      },
      {
        _id: "m4",
        ownerId: "u1",
        listingId: "table",
        kind: "table",
        status: "building",
        updatedAt: 1,
      },
    ];
    w.placeRow({ id: "a", listingId: "sofa" as never, label: "Saved sofa label", kind: "sofa" });
    w.placeRow({ id: "b", listingId: "rug" as never, kind: "rug" });
    w.placeRow({ id: "c", listingId: "lamp" as never, kind: "lamp" });
    w.placeRow({ id: "d", listingId: "table" as never });
    w.placeRow({ id: "e", listingId: "plant" as never, kind: "plant" });
    w.placeRow({ id: "f", listingId: "mine" as never });
    w.placeRow({ id: "g", listingId: "sold" as never, label: "Sold sofa" });
    w.placeRow({ id: "h", listingId: "hidden" as never, label: "Saved label" });
    w.placeRow({ id: "i", ownedItemId: "o1" as never, label: "Desk" });
    w.placeRow({ id: "j", ownedItemId: "o-theirs" as never, label: "Chair" });
    w.placeRow({ id: "k", label: "Your table" });
    w.placeRow({ id: "l", listingId: "sofa" as never, kind: "sofa" });
    const view = await w.me.get();
    const item = (id: string) => view.items.find((i) => i.id === id);
    expect(view.items.map((i) => i.id)).toEqual("abcdefghijkl".split(""));
    expect(item("a")).toMatchObject({
      listingId: "sofa",
      ownedItemId: null,
      title: "Mid-century teak sofa",
      price: 400,
      photo: "/seed/sofa.jpg",
      available: true,
      modelStatus: "ready",
    });
    expect(itemModelProblems(item("a")?.model as ItemModel)).toEqual([]);
    expect(item("b")).toMatchObject({ modelStatus: "none", model: null });
    expect(item("c")).toMatchObject({ modelStatus: "building", model: null });
    // A build that lost its job reads as failed.
    expect(item("d")).toMatchObject({ modelStatus: "failed", model: null });
    expect(item("g")).toMatchObject({ title: "Sold walnut sofa", price: 10, available: false });
    // Hidden from the viewer: only the label they saved.
    expect(item("h")).toEqual({
      id: "h",
      listingId: "hidden" as never,
      ownedItemId: null,
      title: "Saved label",
      price: null,
      photo: null,
      available: false,
      model: null,
      modelStatus: "none",
    });
    expect(item("i")).toMatchObject({
      ownedItemId: "o1",
      listingId: null,
      title: "My desk",
      price: 70,
      photo: "/seed/desk.jpg",
      available: true,
    });
    expect(item("j")).toMatchObject({ title: "Chair", price: null, photo: null });
    expect(item("k")).toMatchObject({ title: "Your table", price: null, listingId: null });
    // Sofa (once) + rug + lamp + table. Not the plant they own, their own listing, or sold and hidden ones.
    expect(view.spent).toBe(400 + 80 + 60 + 120);
    expect(view.unit?.placements.length).toBe(12);
  });
});

describe("apartment.build", () => {
  test("needs a place", async () => {
    const w = world();
    await expect(w.as("u2").build()).rejects.toThrow("Choose your place first");
  });
  test("creates the unit once from the place's listing and starts one build", async () => {
    const w = world({ scene: "none", photos: [HTTPS, "/seed/local.jpg"] });
    ai(true);
    const id = await w.me.build();
    expect(w.tables.unitScenes.length).toBe(1);
    expect(w.unit()).toMatchObject({
      ownerId: "u1",
      listingId: "home",
      placements: [],
      generation: { status: "layout", autoApply: true },
    });
    expect(w.unit().scene.title).toBe("Sunny one-bedroom");
    expect(w.scheduled.filter((s) => s.name === "unitScenes:generate").length).toBe(1);
    expect(w.scheduled[0].args).toMatchObject({ id, ownerId: "u1", revision: w.unit().revision });
    // Again, and after it fails: no second unit, no second build.
    expect(await w.me.build()).toBe(id);
    await w.ctx.db.patch(w.unit().jobId as never, { status: "failed" });
    await w.ctx.db.patch(id as never, {
      generation: { status: "failed", revision: w.unit().revision, autoApply: true },
    });
    expect(await w.me.build()).toBe(id);
    expect(w.tables.unitScenes.length).toBe(1);
    expect(w.scheduled.filter((s) => s.name === "unitScenes:generate").length).toBe(1);
  });
  test("never fails or builds without AI or media Muse can read", async () => {
    const off = world({ scene: "none", photos: [HTTPS] });
    await off.me.build();
    expect(off.scheduled).toEqual([]);
    expect(off.unit().generation).toBeUndefined();
    ai(true);
    const local = world({ scene: "none" });
    await local.me.build();
    expect(local.scheduled).toEqual([]);
    const bare = world({ scene: "none", photos: [] });
    await bare.me.build();
    expect(bare.scheduled).toEqual([]);
    expect((await bare.me.get()).unit).toMatchObject({ state: "starter", canBuild: false });
    // A scene that is already built or hand-edited is left alone.
    const built = world({ photos: [HTTPS] });
    await built.me.build();
    expect(built.scheduled).toEqual([]);
  });
});

describe("items", () => {
  test("only the owner can move, remove or add", async () => {
    const w = world();
    w.placeRow({ id: "a" });
    const other = w.as("u2");
    await expect(other.move("a", { x: 1, z: 1, rotation: 0 })).rejects.toThrow("Unit not found");
    await expect(other.remove("a")).rejects.toThrow("Unit not found");
    await expect(other.add("sofa")).rejects.toThrow("Unit not found");
    expect(w.unit().placements).toEqual([{ ...base, id: "a" }]);
    expect(w.unit().revision).toBe(0);
  });
  test("moving bumps the revision and leaves the scene and any build untouched", async () => {
    const w = world();
    w.placeRow({ id: "a" });
    await w.ctx.db.patch("unit" as never, {
      jobId: "job",
      candidate: manualScene(7, 8),
      generation: { status: "details", revision: 0, autoApply: true },
      manuallyEdited: false,
    });
    const before = structuredClone(w.unit());
    expect(await w.me.move("a", { x: 1.5, z: 2, rotation: Math.PI / 2 })).toBe(1);
    const { placements, revision, updatedAt, ...rest } = w.unit();
    const { placements: _p, revision: _r, updatedAt: was, ...same } = before;
    expect(rest).toEqual(same);
    expect(revision).toBe(1);
    expect(updatedAt).toBeGreaterThan(was);
    expect(placements).toEqual([{ ...base, id: "a", x: 1.5, z: 2, rotation: Math.PI / 2 }]);
    // The same move again writes nothing.
    expect(await w.me.move("a", { x: 1.5, z: 2, rotation: Math.PI / 2 })).toBe(1);
    // An open editor's stale save is refused.
    await expect(
      invoke(save, w.ctx, {
        viewerId: "u1",
        id: "unit",
        revision: 0,
        scene: READY,
        placements: [],
      }),
    ).rejects.toThrow("another tab");
  });
  test("moving keeps, sets and clears the height of the base", async () => {
    const w = world();
    w.placeRow({ id: "art", kind: "art", ...itemSize("art"), y: 1.2 });
    await w.me.move("art", { x: 2, z: 0.08, rotation: 0 });
    expect(w.unit().placements[0].y).toBe(1.2);
    await w.me.move("art", { x: 2, z: 0.08, rotation: 0, y: 1.5 });
    expect(w.unit().placements[0].y).toBe(1.5);
    await w.me.move("art", { x: 2, z: 0.08, rotation: 0, y: 0 });
    expect("y" in w.unit().placements[0]).toBe(false);
    expect(w.unit().revision).toBe(3);
  });
  test("moving validates like the editor's save", async () => {
    const w = world();
    w.placeRow({ id: "a" });
    const bad = (to: Args) =>
      expect(w.me.move("a", { x: 1, z: 1, rotation: 0, ...to })).rejects.toThrow(
        "Invalid item position",
      );
    await bad({ x: Number.NaN });
    await bad({ x: 101 });
    await bad({ z: -101 });
    await bad({ rotation: 7 });
    await bad({ y: -0.1 });
    await bad({ y: 4.1 });
    await expect(w.me.move("nope", { x: 1, z: 1, rotation: 0 })).rejects.toThrow("Item not found");
    expect(w.unit().revision).toBe(0);
  });
  test("removing takes the item out once", async () => {
    const w = world();
    w.placeRow({ id: "a" });
    w.placeRow({ id: "b" });
    expect(await w.me.remove("a")).toBe(1);
    expect(w.unit().placements.map((p) => p.id)).toEqual(["b"]);
    expect(await w.me.remove("a")).toBe(1);
    expect(w.unit().revision).toBe(1);
  });
  test("adding places a visible, active Marketplace listing where it fits", async () => {
    const w = world();
    w.placeRow({ id: "a" });
    const id = await w.me.add("sofa");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    const placed = w.unit().placements[1];
    expect(placed).toMatchObject({
      id,
      listingId: "sofa",
      label: "Mid-century teak sofa",
      kind: "sofa",
      ...itemSize("sofa"),
      color: "#b98a5a",
      measured: false,
    });
    expect(placementProblems(w.unit().scene, placed)).toEqual([]);
    expect(w.unit().revision).toBe(1);
    // Already placed: the same item, no second copy.
    expect(await w.me.add("sofa")).toBe(id);
    expect(w.unit().placements.length).toBe(2);
    // Without AI no model is built: the tab shows the stand-in shape.
    expect(w.tables.itemModels).toEqual([]);
    expect(w.scheduled).toEqual([]);
    expect((await w.me.get()).items[1]).toMatchObject({ modelStatus: "none", model: null });
    // A title that names no kind is placed as decor.
    await w.ctx.db.patch("lamp" as never, { title: "Mystery object" });
    await w.me.add("lamp");
    expect(w.unit().placements[2]).toMatchObject({ kind: "decor", color: "#b9ab98" });
  });
  test("adding refuses rentals, sold, hidden and own listings, and a full unit", async () => {
    const w = world();
    for (const id of ["home", "sold", "hidden", "gone-seller", "car", "missing"])
      await expect(w.me.add(id)).rejects.toThrow("This listing isn't available");
    await expect(w.me.add("mine")).rejects.toThrow("your own listing");
    w.tables.unitScenes[0].placements = Array.from({ length: 80 }, (_, i) => ({
      ...base,
      id: `p${i}`,
    }));
    await expect(w.me.add("sofa")).rejects.toThrow("At most 80 items");
    expect(w.unit().revision).toBe(0);
  });
  test("with AI on, adding starts the item's model", async () => {
    const w = world();
    ai(true);
    await w.me.add("sofa");
    expect(w.tables.itemModels).toMatchObject([
      { ownerId: "u1", listingId: "sofa", kind: "sofa", status: "building" },
    ]);
    expect(w.tables.aiJobs).toMatchObject([{ kind: "itemModels", key: "unit:1", userId: "u1" }]);
    expect(w.scheduled[0]).toMatchObject({
      name: "apartment:buildModels",
      args: { ownerId: "u1", items: [{ listingId: "sofa", kind: "sofa", ...itemSize("sofa") }] },
    });
    // A model that is ready or being built isn't started again.
    await w.me.remove(w.unit().placements[0].id);
    await w.me.add("sofa");
    expect(w.tables.itemModels.length).toBe(1);
    expect(w.scheduled.filter((s) => s.name === "apartment:buildModels").length).toBe(1);
  });
});

describe("furnish: what Muse reads", () => {
  test("candidates the viewer can use, best vibe match first, then the basics", async () => {
    const w = world();
    const c = ready(await w.me.context("cozy mid-century, walnut"));
    // Not their own, a blocked or deleted seller's, sold, a vehicle, the rental, or over budget.
    expect(ids(c.input)).toEqual(["sofa", "pricey", "bed", "table", "rug", "lamp", "plant"]);
    expect(c.input.candidates[0]).toEqual({
      key: "listing:sofa",
      id: "sofa",
      title: "Mid-century teak sofa",
      price: 400,
      category: "furniture",
      condition: null,
      description: "Mid-century teak sofa.",
    });
    expect(c.input).toMatchObject({
      vibe: "cozy mid-century, walnut",
      asked: [],
      budget: null,
      rooms: [{ id: "room", name: "Sunny one-bedroom", area: 30 }],
      placed: [],
    });
    expect(c).toMatchObject({ unitId: "unit", limited: false, budget: null, spent: 0 });
  });
  test("drops what is already placed and what the remaining budget can't buy", async () => {
    const w = world();
    w.placeRow({ id: "a", listingId: "sofa" as never, kind: "sofa", label: "Teak sofa" });
    const c = ready(await w.me.context("mid-century", 600));
    // $600 in all, $400 already placed: $200 left.
    expect(c.input.budget).toEqual({ total: 600, spent: 400, remaining: 200 });
    expect(ids(c.input)).toEqual(["table", "rug", "lamp", "plant"]);
    expect(c.input.placed).toEqual([{ kind: "sofa", label: "Teak sofa", price: 400 }]);
    expect(c).toMatchObject({ budget: 600, spent: 400 });
    // Over budget already: nothing is affordable.
    expect(ids(ready(await w.me.context("mid-century", 300)).input)).toEqual([]);
  });
  test("caps the candidates and their text, and keeps protected traits out", async () => {
    const w = world();
    for (let i = 0; i < 60; i++) {
      const { _id, ...row } = listing("", `Walnut side table ${i}`, 20, { createdAt: i });
      await w.ctx.db.insert("listings", row as never);
    }
    await w.ctx.db.patch("sofa" as never, {
      title: `Sofa from a Christian family ${"x".repeat(200)}`,
      description: `Selling because I am 62 years old. ${"long ".repeat(100)}`,
    });
    const c = ready(await w.me.context("walnut for my Muslim household"));
    expect(c.input.candidates.length).toBe(40);
    expect(c.vibe).not.toContain("Muslim");
    const sofa = c.input.candidates.find((x) => x.id === "sofa");
    expect(sofa?.title.length).toBeLessThanOrEqual(130);
    expect(sofa?.title).not.toContain("Christian");
    expect(sofa?.description.length).toBeLessThanOrEqual(210);
    expect(sofa?.description).not.toContain("62");
    expect(JSON.stringify(c.input)).not.toContain("/seed/");
  });
  test("remembers the vibe and budget; a shopping list keeps the remembered look", async () => {
    const w = world();
    await w.ctx.db.patch("unit" as never, { furnishing: { vibe: "boho rattan", budget: 900 } });
    expect(ready(await w.me.context(""))).toMatchObject({ vibe: "boho rattan", budget: 900 });
    const lamp = ready(await w.me.context("add a lamp"));
    expect(lamp).toMatchObject({ vibe: "boho rattan", budget: 900 });
    expect(lamp.input.asked).toEqual(["lamp"]);
    // Words that describe no look change nothing either.
    expect(ready(await w.me.context("furnish my apartment please")).vibe).toBe("boho rattan");
    expect(ready(await w.me.context("japandi", 500))).toMatchObject({
      vibe: "japandi",
      budget: 500,
    });
    expect((await w.me.get()).unit?.furnishing).toEqual({ vibe: "boho rattan", budget: 900 });
  });
  test("rate-limits Muse per viewer", async () => {
    const w = world();
    const run = (userId: string, task: string, ago: number): Row => ({
      _id: `run-${Math.random()}`,
      userId,
      task,
      createdAt: Date.now() - ago,
    });
    w.tables.aiRuns = [
      ...Array.from({ length: 3 }, () => run("u1", "muse.furnish", 1000)),
      ...Array.from({ length: 30 }, () => run("u1", "muse.homeChat", 1000)),
      ...Array.from({ length: 30 }, () => run("u2", "muse.furnish", 1000)),
    ];
    expect(ready(await w.me.context("cozy")).limited).toBe(false);
    w.tables.aiRuns.push(run("u1", "muse.furnish", 2000));
    expect(ready(await w.me.context("cozy")).limited).toBe(true);
    w.tables.aiRuns = Array.from({ length: 20 }, () => run("u1", "muse.furnish", 10 * 60_000));
    expect(ready(await w.me.context("cozy")).limited).toBe(true);
  });
  test("waits for a place, a unit and a build in flight; the starter room works without AI", async () => {
    const none = world();
    expect(await none.as("u2").context("cozy")).toMatchObject({
      ready: false,
      text: "Choose your place first, and I can furnish it.",
    });
    expect(await world({ scene: "none" }).me.context("cozy")).toMatchObject({ ready: false });
    await expect(none.as("ghost").context("cozy")).rejects.toThrow("Unknown viewer");
    // AI off: the starter room is all there will be, so it is furnished.
    const starter = world({ scene: "starter", photos: [HTTPS] });
    expect((await starter.me.context("cozy")).ready).toBe(true);
    // AI on and buildable: build first.
    ai(true);
    const unbuilt = await starter.me.context("cozy", 700);
    expect(unbuilt).toMatchObject({ ready: false, budget: 700, spent: 0 });
    expect(!unbuilt.ready && unbuilt.text).toContain("isn't ready yet");
    await starter.me.build();
    const building = await starter.me.context("cozy");
    expect(!building.ready && building.text).toContain("still being built");
    // The build failed: the starter room is furnished after all.
    await starter.ctx.db.patch(starter.unit().jobId as never, { status: "failed" });
    await starter.ctx.db.patch("unit" as never, {
      generation: { status: "failed", revision: starter.unit().revision, autoApply: true },
    });
    expect((await starter.me.context("cozy")).ready).toBe(true);
  });
});

describe("apartment.furnish", () => {
  test("without AI, Landing's rules pick, place and remember", async () => {
    const w = world();
    const r = await w.me.furnish("cozy mid-century, walnut", 700);
    expect(r.via).toBe("rules");
    expect(r.items.map((i) => [i.listingId as string, i.kind, i.price])).toEqual([
      ["bed", "bed", 250],
      ["sofa", "sofa", 400],
      ["plant", "plant", 25],
    ]);
    expect(r).toMatchObject({ total: 675, spent: 675, budget: 700 });
    expect(r.text).toBe(
      "Picked 3 items for a cozy mid-century, walnut feel: $675 of your $700. They're in your apartment to review; nothing is bought yet.",
    );
    expect(r.sources).toEqual([
      { label: "Queen bed frame, walnut · $250", href: "/marketplace/item/bed" },
      { label: "Mid-century teak sofa · $400", href: "/marketplace/item/sofa" },
      { label: "Monstera plant · $25", href: "/marketplace/item/plant" },
    ]);
    expect(r.items[1]).toMatchObject({
      title: "Mid-century teak sofa",
      photo: "/seed/sofa.jpg",
      reason: 'Mid-century: "mid-century", "teak"',
    });
    // Placed for real, each where it has no problems, with the vibe and budget remembered.
    const unit = w.unit();
    expect(unit.placements.map((p) => p.id)).toEqual(r.items.map((i) => i.itemId));
    for (const p of unit.placements) expect(placementProblems(unit.scene, p)).toEqual([]);
    expect(unit.furnishing).toEqual({ vibe: "cozy mid-century, walnut", budget: 700 });
    expect(unit.revision).toBe(1);
    expect(requests).toEqual([]);
    expect((await w.me.get()).spent).toBe(675);
  });
  test("the budget is for the whole apartment: a second ask spends only what is left", async () => {
    const w = world();
    await w.me.furnish("mid-century", 700);
    // $25 left of $700: nothing more fits, and nothing is placed twice.
    const again = await w.me.furnish("");
    expect(again).toMatchObject({ items: [], total: 0, spent: 675, budget: 700, sources: [] });
    expect(again.text).toContain("Nothing on Marketplace fits");
    expect(w.unit().revision).toBe(1);
    // Raising the budget adds the next basics, and "add a lamp" only a lamp.
    const more = await w.me.furnish("", 900);
    expect(more.items.map((i) => i.listingId as string)).toEqual(["table", "rug"]);
    expect(more).toMatchObject({ total: 200, spent: 875, budget: 900 });
    expect(more.text).toContain("$200 more, $875 of your $900");
    const lamp = await w.me.furnish("add a lamp", 1000);
    expect(lamp.items.map((i) => i.listingId as string)).toEqual(["lamp"]);
    expect(w.unit().furnishing).toEqual({ vibe: "mid-century", budget: 1000 });
    expect(w.unit().placements.length).toBe(6);
  });
  test("places nothing before there is a unit, and for anyone but the owner", async () => {
    const w = world({ scene: "none" });
    expect(await w.me.furnish("cozy", 500)).toEqual({
      text: "Your apartment model isn't ready yet. Open the Apartment tab to build it, then ask again.",
      via: "rules",
      items: [],
      total: 0,
      spent: 0,
      budget: null,
      sources: [],
    });
    const other = world();
    const r = await other.as("u2").furnish("cozy", 500);
    expect(r.items).toEqual([]);
    expect(other.unit().placements).toEqual([]);
    expect(other.unit().furnishing).toBeUndefined();
    await expect(
      invoke(apartment.place, other.ctx, { viewerId: "u2", unitId: "unit", vibe: "x", picks: [] }),
    ).rejects.toThrow("Unit not found");
  });
  test("rejects a budget that isn't a dollar amount and a vibe that is far too long", async () => {
    const w = world();
    await expect(w.me.furnish("cozy", -1)).rejects.toThrow("dollar amount");
    await expect(w.me.furnish("cozy", Number.NaN)).rejects.toThrow("dollar amount");
    await expect(w.me.furnish("cozy", 2_000_000)).rejects.toThrow("dollar amount");
    await expect(w.me.furnish("x".repeat(801))).rejects.toThrow("Vibe too long");
    await w.me.furnish("cozy", 99.6);
    expect(w.unit().furnishing?.budget).toBe(100);
  });
  test("with AI on, Muse's valid picks are placed and its words returned", async () => {
    const w = world();
    ai(true);
    reply = (body) => {
      const prompt = JSON.stringify(body.messages);
      // Muse sees the candidates' capped fields, never photos or links.
      expect(prompt).toContain("Mid-century teak sofa");
      expect(prompt).not.toContain("/seed/");
      return {
        text: "A teak sofa and a wool rug set a warm mid-century base, inside your budget.",
        picks: [
          {
            listingId: "sofa",
            kind: "sofa",
            room: "room",
            ...itemSize("sofa"),
            reason: "Teak, the heart of the look",
          },
          { listingId: "rug", kind: "rug", ...itemSize("rug"), reason: "Warm underfoot" },
        ],
      };
    };
    const r = await w.me.furnish("warm mid-century", 600);
    expect(r.via).toBe("muse");
    expect(r.text).toBe(
      "A teak sofa and a wool rug set a warm mid-century base, inside your budget.",
    );
    expect(r.items.map((i) => [i.listingId as string, i.reason])).toEqual([
      ["sofa", "Teak, the heart of the look"],
      ["rug", "Warm underfoot"],
    ]);
    expect(r).toMatchObject({ total: 480, spent: 480, budget: 600 });
    expect(requests.map((q) => q.model)).toEqual(["muse-spark-1.3"]);
    expect(w.tables.aiRuns).toMatchObject([
      { task: "muse.furnish", userId: "u1", outcome: "model" },
    ]);
    // Each placed listing gets a model row and one job builds them.
    expect(w.tables.itemModels.map((m) => [m.listingId, m.status])).toEqual([
      ["sofa", "building"],
      ["rug", "building"],
    ]);
    expect(w.scheduled.filter((s) => s.name === "apartment:buildModels").length).toBe(1);
  });
  test("Muse's rejected answers fall back to the rules", async () => {
    const w = world();
    ai(true);
    const answers = [
      // Over budget, then a listing it wasn't given.
      {
        text: "Here you go.",
        picks: [{ listingId: "pricey", kind: "sofa", ...itemSize("sofa"), reason: "Nice" }],
      },
      {
        text: "Here you go.",
        picks: [{ listingId: "mine", kind: "sofa", ...itemSize("sofa"), reason: "Nice" }],
      },
    ];
    reply = () => answers.shift();
    const r = await w.me.furnish("mid-century", 700);
    expect(requests.length).toBe(2);
    expect(r.via).toBe("rules");
    expect(r.items.map((i) => i.listingId as string)).toEqual(["bed", "sofa", "plant"]);
    expect(w.unit().placements.some((p) => p.listingId === ("mine" as never))).toBe(false);
    expect(w.tables.aiRuns).toMatchObject([
      { outcome: "fallback", fallbackReason: "invalid_output" },
    ]);
  });
  test("over the rate limit, the rules answer without calling the model", async () => {
    const w = world();
    ai(true);
    w.tables.aiRuns = Array.from({ length: 4 }, (_, i) => ({
      _id: `r${i}`,
      userId: "u1",
      task: "muse.furnish",
      createdAt: Date.now() - 1000,
    }));
    const r = await w.me.furnish("mid-century", 700);
    expect(r.via).toBe("rules");
    expect(r.items.length).toBe(3);
    expect(requests).toEqual([]);
  });
  test("placing checks every pick again", async () => {
    const w = world();
    w.placeRow({ id: "a", listingId: "table" as never });
    const pick = (listingId: string, extra: Args = {}) => ({
      listingId,
      kind: "sofa",
      ...itemSize("sofa"),
      reason: "Because",
      ...extra,
    });
    const out = await invoke<{ items: FurnishReply["items"]; spent: number }>(
      apartment.place,
      w.ctx,
      {
        viewerId: "u1",
        unitId: "unit",
        vibe: "cozy",
        budget: 600,
        picks: [
          pick("sold"),
          pick("mine"),
          pick("home"),
          pick("table"),
          pick("sofa", { room: "nowhere", width: 99 }),
          pick("sofa"),
          pick("bed", { kind: "bed", ...itemSize("bed") }),
          pick("lamp", { kind: "lamp", ...itemSize("lamp"), reason: `  ${"r".repeat(300)}` }),
        ],
      },
    );
    // $120 was placed; the $400 sofa fits, the $250 bed no longer does, the $60 lamp does.
    expect(out.items.map((i) => i.listingId as string)).toEqual(["sofa", "lamp"]);
    expect(out.spent).toBe(580);
    expect(out.items[1].reason.length).toBe(160);
    const [, sofa] = w.unit().placements;
    // The impossible width is replaced with a typical one, and the unknown room ignored.
    expect(sofa).toMatchObject({ kind: "sofa", ...itemSize("sofa") });
    expect(placementProblems(w.unit().scene, sofa)).toEqual([]);
    expect(w.unit()).toMatchObject({ revision: 1, furnishing: { vibe: "cozy", budget: 600 } });
    // Nothing placed (hidden, or over what is left): the look is still remembered, the revision stays.
    await invoke(apartment.place, w.ctx, {
      viewerId: "u1",
      unitId: "unit",
      vibe: "boho",
      budget: 600,
      picks: [pick("hidden"), pick("pricey"), pick("gone-seller")],
    });
    expect(w.unit().placements.length).toBe(3);
    expect(w.unit()).toMatchObject({ revision: 1, furnishing: { vibe: "boho" } });
  });
});

describe("item models", () => {
  const model = (color = "#8a5a3c") => proxyModel("sofa", itemSize("sofa"), color);

  test("Muse's valid model is stored; the tab then shows it", async () => {
    const w = world();
    ai(true);
    await w.me.add("sofa");
    await w.me.add("lamp");
    const lamp = proxyModel("lamp", { width: 0.4, depth: 0.4, height: 1.6 }, "#d4a137");
    reply = (body) => (JSON.stringify(body.messages).includes("Brass floor lamp") ? lamp : model());
    await w.runModels();
    await w.runModels();
    expect(w.tables.itemModels.map((m) => [m.listingId, m.status, m.error])).toEqual([
      ["sofa", "ready", undefined],
      ["lamp", "ready", undefined],
    ]);
    expect(w.tables.itemModels[0].model).toEqual(model());
    expect(w.tables.itemModels[0].runId).toBeDefined();
    expect(w.tables.aiJobs.map((j) => [j.status, (j.progress as { label: string }).label])).toEqual(
      [
        ["succeeded", "Modelling 1 of 1"],
        ["succeeded", "Modelling 1 of 1"],
      ],
    );
    // Seed photos are local, so Spark models from the words alone, for this owner only.
    expect(requests.map((q) => q.model)).toEqual(["muse-spark-1.3", "muse-spark-1.3"]);
    expect(w.tables.aiRuns.every((r) => r.task === "muse.itemModel" && r.userId === "u1")).toBe(
      true,
    );
    const view = await w.me.get();
    expect(view.items.map((i) => i.modelStatus)).toEqual(["ready", "ready"]);
    expect(view.items[0].model).toEqual(model());
  });
  test("several models share one job; photos Muse can read go to Wonder", async () => {
    const w = world();
    ai(true);
    await w.ctx.db.patch("sofa" as never, {
      photos: [HTTPS, "/seed/local.jpg", HTTPS, HTTPS, HTTPS],
      description: `Deep seats. I am 62 years old. ${"x".repeat(900)}`,
    });
    reply = (body) => {
      const text = JSON.stringify(body.messages);
      if (!text.includes("Mid-century teak sofa"))
        return proxyModel("rug", itemSize("rug"), "#888888");
      // Three photos at most, and no protected traits.
      expect(text.split(HTTPS).length - 1).toBe(3);
      expect(text).not.toContain("62 years");
      return model();
    };
    await invoke(apartment.place, w.ctx, {
      viewerId: "u1",
      unitId: "unit",
      vibe: "cozy",
      picks: [
        { listingId: "sofa", kind: "sofa", ...itemSize("sofa"), reason: "r" },
        { listingId: "rug", kind: "rug", ...itemSize("rug"), reason: "r" },
      ],
    });
    await w.runModels();
    expect(requests.map((q) => q.model).sort()).toEqual(["muse-spark-1.3", "muse-wonder-1.0"]);
    expect(w.tables.itemModels.map((m) => m.status)).toEqual(["ready", "ready"]);
    expect(w.tables.aiJobs).toMatchObject([
      { status: "succeeded", progress: { label: "Modelling 2 of 2", done: 2, total: 2 } },
    ]);
  });
  test("a rejected or failed model stores nothing, so the stand-in stays", async () => {
    const w = world();
    ai(true);
    await w.me.add("sofa");
    const broken = model();
    broken.parts[0].position.x = 9;
    reply = () => broken;
    await w.runModels();
    expect(w.tables.itemModels[0]).toMatchObject({ status: "failed" });
    expect(w.tables.itemModels[0].model).toBeUndefined();
    expect(w.tables.itemModels[0].error).toContain("invalid_output");
    expect(requests.length).toBe(2);
    expect(w.tables.aiJobs[0].status).toBe("succeeded");
    expect((await w.me.get()).items[0]).toMatchObject({ modelStatus: "failed", model: null });
    // Placing it again retries.
    await w.me.remove(w.unit().placements[0].id);
    await w.me.add("sofa");
    expect(w.tables.itemModels[0]).toMatchObject({ status: "building" });
    expect(w.tables.itemModels[0].error).toBeUndefined();
    // AI switched off before the job runs: the fallback is not stored as a model.
    ai(false);
    await w.runModels();
    expect(w.tables.itemModels[0]).toMatchObject({ status: "failed" });
    expect(w.tables.itemModels[0].model).toBeUndefined();
  });
  test("a listing its owner can no longer see is never sent to Muse", async () => {
    const w = world();
    ai(true);
    await w.me.add("sofa");
    await w.ctx.db.patch("sofa" as never, { sellerId: "blocked" });
    await w.runModels();
    expect(requests).toEqual([]);
    expect(w.tables.itemModels[0]).toMatchObject({
      status: "failed",
      error: "Listing is unavailable",
    });
    expect(
      await invoke(apartment.modelContext, w.ctx, {
        ownerId: "u2",
        item: { listingId: "missing", kind: "sofa", ...itemSize("sofa") },
      }),
    ).toBeNull();
  });
  test("saving checks the model again and ignores a row that isn't there", async () => {
    const empty = world();
    await invoke(apartment.saveModel, empty.ctx, {
      ownerId: "u1",
      listingId: "sofa",
      model: model(),
    });
    expect(empty.tables.itemModels).toEqual([]);
    const row = (_id: string, ownerId: string): Row => ({
      _id,
      ownerId,
      listingId: "sofa",
      kind: "sofa",
      status: "building",
      updatedAt: 1,
    });
    const w = world({ more: { itemModels: [row("m1", "u1"), row("m2", "u2")] } });
    const saveModel = (args: Args) =>
      invoke(apartment.saveModel, w.ctx, { ownerId: "u1", ...args });
    const bad = model();
    bad.materials[0].color = "red";
    await saveModel({ listingId: "sofa", model: bad });
    expect(w.tables.itemModels[0]).toMatchObject({ status: "failed" });
    expect(w.tables.itemModels[0].model).toBeUndefined();
    await saveModel({ listingId: "sofa", model: model() });
    expect(w.tables.itemModels[0]).toMatchObject({ status: "ready", model: model() });
    expect(w.tables.itemModels[0].error).toBeUndefined();
    // Another owner's row for the same listing is untouched.
    expect(w.tables.itemModels[1]).toMatchObject({ status: "building" });
  });
});
