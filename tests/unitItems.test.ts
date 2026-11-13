import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { itemSize, manualScene, type Placement } from "../convex/lib/unitScene";
import { picker, placed, unitForRoom } from "../convex/unitItems";
import { save } from "../convex/unitScenes";
import { fakeCtx, type Row } from "./fakeDb";

// Shopping → 3D (#131): picker sources, ownership and placement sources.
function handler<A, R>(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler;
}
type Picker = {
  entries: {
    key: string;
    group: string;
    title: string;
    sale: string | null;
    fromListingId?: string;
  }[];
  picked: string | null;
};
const runPicker = (ctx: MutationCtx, args: Record<string, unknown>) =>
  handler<Record<string, unknown>, Picker>(picker)(ctx, args);
const runSave = (ctx: MutationCtx, args: Record<string, unknown>) =>
  handler<Record<string, unknown>, number>(save)(ctx, args);
const scene = manualScene(4, 5);
const base = {
  label: "Item",
  kind: "table" as const,
  x: 2,
  z: 2,
  rotation: 0,
  ...itemSize("table"),
  color: "#76958f",
  measured: false,
};
const listing = (id: string, title: string, extra: Record<string, unknown> = {}): Row => ({
  _id: id,
  sellerId: "seller",
  title,
  description: `${title} in walnut`,
  price: 40,
  photos: [`/seed/${id}.jpg`],
  category: "furniture",
  status: "active",
  location: { neighborhood: "Mission" },
  badges: [],
  createdAt: 10,
  updatedAt: 10,
  viewCount: 0,
  ...extra,
});
function world() {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "u1" }, { _id: "u2" }, { _id: "seller" }],
    rooms: [
      {
        _id: "r1",
        userId: "u1",
        name: "Bedroom",
        photos: [],
        vibe: { styles: [], palette: [], keywords: ["walnut"], summary: "", origin: "typed" },
      },
    ],
    listings: [
      listing("l-match", "Walnut side table", { createdAt: 30 }),
      listing("l-saved", "Linen floor lamp", { description: "Bright lamp", createdAt: 20 }),
      listing("l-bought", "Walnut crash pad", { createdAt: 15 }),
      listing("l-rental", "Walnut studio", {
        rental: {},
        category: "propertyrentals",
        createdAt: 5,
      }),
      listing("l-sale", "Billy bookcase", { sellerId: "u1", description: "Tall", createdAt: 1 }),
    ],
    saved: [
      { _id: "sv1", userId: "u1", kind: "listing", refId: "l-saved", createdAt: 3 },
      { _id: "sv2", userId: "u1", kind: "listing", refId: "l-rental", createdAt: 2 },
      { _id: "sv3", userId: "u1", kind: "listing", refId: "l-bought", createdAt: 1 },
      { _id: "sv4", userId: "u1", kind: "post", refId: "p1", createdAt: 4 },
    ],
    ownedItems: [
      {
        _id: "o-bought",
        userId: "u1",
        title: "Walnut crash pad",
        price: 150,
        acquiredAt: 2,
        photos: ["/seed/pad.jpg"],
        source: { kind: "marketplace", listingId: "l-bought", conversationId: "c1" },
        createdAt: 2,
      },
      {
        _id: "o-shelf",
        userId: "u1",
        title: "Billy bookcase",
        price: 60,
        acquiredAt: 1,
        photos: [],
        source: { kind: "manual" },
        saleListingId: "l-sale",
        createdAt: 1,
      },
      {
        _id: "o-other",
        userId: "u2",
        title: "Someone else's chair",
        price: 10,
        acquiredAt: 1,
        photos: [],
        source: { kind: "manual" },
        createdAt: 1,
      },
    ],
    unitScenes: [
      {
        _id: "s1",
        ownerId: "u1",
        roomId: "r1",
        scene,
        placements: [],
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

describe("item picker", () => {
  test("lists the owner's items first, then room matches, then saved; bought listings only once", async () => {
    const { ctx } = world();
    const { entries } = await runPicker(ctx, { viewerId: "u1", id: "s1" });
    expect(entries.map((e) => `${e.group}:${e.key}`)).toEqual([
      "yours:owned:o-bought",
      "yours:owned:o-shelf",
      "matches:listing:l-match",
      "saved:listing:l-saved",
    ]);
    // The move-out sale listing shows on the owned item (#43).
    expect(entries.find((e) => e.key === "owned:o-shelf")?.sale).toBe("active");
    expect(entries.find((e) => e.key === "owned:o-bought")?.sale).toBeNull();
    // A purchase placed earlier as its listing is recognised as placed.
    expect(entries.find((e) => e.key === "owned:o-bought")).toMatchObject({
      fromListingId: "l-bought",
    });
  });
  test("is private to the unit's owner", async () => {
    const { ctx } = world();
    await expect(runPicker(ctx, { viewerId: "u2", id: "s1" })).rejects.toThrow("Unit not found");
    await expect(
      handler<Record<string, unknown>, unknown>(unitForRoom)(ctx, { viewerId: "u2", roomId: "r1" }),
    ).rejects.toThrow("Room not found");
    const theirs = await handler<Record<string, unknown>, unknown[]>(placed)(ctx, {
      viewerId: "u2",
    });
    expect(theirs).toEqual([]);
  });
  test("a linked pick is included when allowed and refused otherwise", async () => {
    const { ctx } = world();
    // Someone else's item is never shown.
    const other = await runPicker(ctx, {
      viewerId: "u1",
      id: "s1",
      pick: { ownedItemId: "o-other" },
    });
    expect(other.picked).toBeNull();
    expect(other.entries.some((e) => e.key === "owned:o-other")).toBe(false);
    // A listing the owner already bought is picked as their own item.
    const bought = await runPicker(ctx, {
      viewerId: "u1",
      id: "s1",
      pick: { listingId: "l-bought" },
    });
    expect(bought.picked).toBe("owned:o-bought");
    // A visible listing outside matches and saved still comes up, after the owner's items.
    const { tables, ctx: ctx2 } = world();
    tables.listings.push(listing("l-extra", "Rattan chair", { description: "Cane", createdAt: 2 }));
    const extra = await runPicker(fakeCtx(tables), {
      viewerId: "u1",
      id: "s1",
      pick: { listingId: "l-extra" },
    });
    expect(extra.picked).toBe("listing:l-extra");
    expect(extra.entries[2]).toMatchObject({ key: "listing:l-extra", group: "marketplace" });
    // Rentals and listings from blocked sellers are not placeable.
    tables.blocks = [{ _id: "b1", userId: "u1", blockedId: "seller" }];
    const blocked = await runPicker(fakeCtx(tables), {
      viewerId: "u1",
      id: "s1",
      pick: { listingId: "l-extra" },
    });
    expect(blocked.picked).toBeNull();
    expect(
      (await runPicker(ctx2, { viewerId: "u1", id: "s1", pick: { listingId: "l-rental" } })).picked,
    ).toBeNull();
  });
});

describe("placement sources", () => {
  test("records an owned item and keeps working after its Marketplace listing is deleted", async () => {
    const { ctx, tables } = world();
    await ctx.db.delete("l-bought" as never);
    const p: Placement = {
      ...base,
      id: "p1",
      label: "Walnut crash pad",
      ownedItemId: "o-bought" as never,
    };
    expect(
      await runSave(ctx, { viewerId: "u1", id: "s1", revision: 0, scene, placements: [p] }),
    ).toBe(1);
    expect((tables.unitScenes[0].placements as Placement[])[0].ownedItemId).toBe(
      "o-bought" as never,
    );
    const where = await handler<Record<string, unknown>, { ownedItemIds: string[] }[]>(placed)(
      ctx,
      {
        viewerId: "u1",
        roomId: "r1",
      },
    );
    expect(where[0].ownedItemIds).toEqual(["o-bought"]);
    // Picker still offers the item from its own photos and price.
    const { entries } = await runPicker(ctx, { viewerId: "u1", id: "s1" });
    expect(entries[0]).toMatchObject({ key: "owned:o-bought", title: "Walnut crash pad" });
  });
  test("records a listing source and keeps saved references whose listing later disappears", async () => {
    const { ctx, tables } = world();
    const p: Placement = { ...base, id: "p1", listingId: "l-match" as never };
    await runSave(ctx, { viewerId: "u1", id: "s1", revision: 0, scene, placements: [p] });
    expect((tables.unitScenes[0].placements as Placement[])[0].listingId).toBe("l-match" as never);
    await ctx.db.delete("l-match" as never);
    expect(
      await runSave(ctx, {
        viewerId: "u1",
        id: "s1",
        revision: 1,
        scene,
        placements: [{ ...p, x: 1.5 }],
      }),
    ).toBe(2);
  });
  test("rejects someone else's item, an unavailable new listing and two sources", async () => {
    const { ctx } = world();
    const save0 = (p: Placement) =>
      runSave(ctx, { viewerId: "u1", id: "s1", revision: 0, scene, placements: [p] });
    await expect(save0({ ...base, id: "p", ownedItemId: "o-other" as never })).rejects.toThrow(
      "Item not found",
    );
    await expect(save0({ ...base, id: "p", listingId: "l-gone" as never })).rejects.toThrow(
      "Listing is unavailable",
    );
    await expect(
      save0({ ...base, id: "p", ownedItemId: "o-bought" as never, listingId: "l-match" as never }),
    ).rejects.toThrow("one source");
  });
  test("finds the owner's unit for a room", async () => {
    const { ctx } = world();
    const run = handler<Record<string, unknown>, string | null>(unitForRoom);
    expect(await run(ctx, { viewerId: "u1", roomId: "r1" })).toBe("s1");
  });
});

describe("seed", () => {
  test("Maya's bedroom has vibe matches and her owned items point at real listings and chats", async () => {
    const { roomSeeds } = await import("../convex/seed/world/rooms");
    const { ownedItemSeeds } = await import("../convex/seed/world/ownedItems");
    const { listings } = await import("../convex/seed/world/listings");
    const { conversations } = await import("../convex/seed/world/messages");
    const { rankVibeMatches, NOT_DECOR } = await import("../convex/lib/vibeMatch");
    const room = roomSeeds.find((r) => r.username === "maya.chen");
    expect(room?.vibe).toBeDefined();
    const others = listings.filter(
      (l) =>
        l.seller !== "maya.chen" &&
        !NOT_DECOR.has(l.category) &&
        (l.status ?? "active") === "active",
    );
    const ranked = rankVibeMatches(
      room!.vibe!,
      others.map((l, i) => ({
        id: l.key,
        title: l.title,
        description: l.description,
        createdAt: i,
      })),
    );
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    const mine = ownedItemSeeds.filter((o) => o.username === "maya.chen");
    expect(mine.some((o) => o.bought)).toBe(true);
    expect(mine.some((o) => o.selling)).toBe(true);
    for (const o of mine) {
      if (o.bought) {
        const l = listings.find((x) => x.key === o.bought?.listing);
        expect(l?.title).toBe(o.title);
        const c = conversations.find((x) => x.key === o.bought?.conversation);
        expect(c?.listing).toBe(o.bought.listing);
        expect(c?.members).toContain("maya.chen");
      }
      if (o.selling) expect(listings.find((x) => x.key === o.selling)?.seller).toBe("maya.chen");
    }
  });
});
