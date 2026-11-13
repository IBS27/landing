import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { listForSale, mine, saleDrafts } from "../convex/inventory";
import { fakeCtx, type Row } from "./fakeDb";

/* Selling tracked items at move-out (#43), through the Convex functions. */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown>, viewer = "maya") =>
  (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args });

const ACQUIRED = Date.UTC(2026, 9, 15);

const item = (id: string, o: Partial<Row> = {}): Row => ({
  _id: `ownedItems:${id}`,
  userId: "users:maya",
  title: "Brass floor lamp",
  price: 40,
  acquiredAt: ACQUIRED,
  photos: ["/seed/lamp.jpg"],
  source: { kind: "manual" },
  createdAt: ACQUIRED,
  ...o,
});

// What Maya bought from Kai on Marketplace (#36), in the Mission.
const bought: Row = {
  _id: "listings:pad",
  sellerId: "users:kai",
  title: "Black Diamond Mondo crash pad",
  price: 250,
  category: "sporting",
  photos: ["/p/1.jpg"],
  location: { city: "San Francisco, CA", neighborhood: "Mission", lat: 37.7599, lng: -122.4148 },
  status: "sold",
};

function world(items: Row[], extra: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "users:maya" }, { _id: "users:kai" }],
    neighborhoods: [{ _id: "neighborhoods:mission", slug: "mission" }],
    listings: [bought],
    ownedItems: items,
    ...extra,
  };
  return { ctx: fakeCtx(tables), tables };
}

const sell = (itemId: string, o: Record<string, unknown> = {}) => ({
  itemId: `ownedItems:${itemId}`,
  title: "Brass floor lamp",
  price: 20,
  category: "household",
  ...o,
});

describe("listForSale", () => {
  test("creates an active Marketplace listing from the item and links it back", async () => {
    const { ctx, tables } = world([item("lamp")]);
    const ids = (await call(listForSale, ctx, {
      items: [sell("lamp", { title: "  Brass floor lamp ", price: 19.6 })],
      neighborhood: "Mission",
    })) as string[];
    expect(ids).toHaveLength(1);
    const listing = tables.listings.find((l) => l._id === ids[0]);
    expect(listing).toMatchObject({
      sellerId: "users:maya",
      title: "Brass floor lamp",
      price: 20,
      category: "household",
      photos: ["/seed/lamp.jpg"],
      description: "Selling as I move out. Got it October 2026.",
      location: { neighborhood: "Mission" },
      neighborhoodId: "neighborhoods:mission",
      status: "active",
      badges: [],
    });
    expect(tables.ownedItems[0].saleListingId).toBe(ids[0]);
  });

  test("refuses someone else's item", async () => {
    const { ctx, tables } = world([item("lamp", { userId: "users:kai" })]);
    await expect(
      call(listForSale, ctx, { items: [sell("lamp")], neighborhood: "Mission" }),
    ).rejects.toThrow("Item not found");
    expect(tables.listings).toHaveLength(1);
  });

  test("refuses an item that's already listed, even twice in one call", async () => {
    const live: Row = { ...bought, _id: "listings:mine", sellerId: "users:maya", status: "active" };
    const a = world([item("lamp", { saleListingId: "listings:mine" })], {
      listings: [bought, live],
    });
    await expect(
      call(listForSale, a.ctx, { items: [sell("lamp")], neighborhood: "Mission" }),
    ).rejects.toThrow("Brass floor lamp is already listed");

    const b = world([item("lamp")]);
    await expect(
      call(listForSale, b.ctx, { items: [sell("lamp"), sell("lamp")], neighborhood: "Mission" }),
    ).rejects.toThrow("already listed");
  });

  test("a deleted sale listing no longer counts as listed", async () => {
    const { ctx, tables } = world([item("lamp", { saleListingId: "listings:gone" })]);
    const [id] = (await call(listForSale, ctx, {
      items: [sell("lamp")],
      neighborhood: "Mission",
    })) as string[];
    expect(tables.ownedItems[0].saleListingId).toBe(id);
  });

  test("refuses a category that isn't for items", async () => {
    const { ctx } = world([item("lamp")]);
    await expect(
      call(listForSale, ctx, {
        items: [sell("lamp", { category: "propertyrentals" })],
        neighborhood: "Mission",
      }),
    ).rejects.toThrow("Choose a category");
  });

  test("refuses an item without photos", async () => {
    const { ctx } = world([item("lamp", { photos: [] })]);
    await expect(
      call(listForSale, ctx, { items: [sell("lamp")], neighborhood: "Mission" }),
    ).rejects.toThrow("Add a photo of Brass floor lamp first");
  });

  test("applies Marketplace's own validation", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ title: "   " }, "Add a title"],
      [{ price: -1 }, "Enter a valid price"],
      [{ price: Number.NaN }, "Enter a valid price"],
    ];
    for (const [o, message] of cases) {
      const { ctx } = world([item("lamp")]);
      await expect(
        call(listForSale, ctx, { items: [sell("lamp", o)], neighborhood: "Mission" }),
      ).rejects.toThrow(message);
    }
    const many = world([item("lamp", { photos: Array.from({ length: 11 }, (_, i) => `/p/${i}`) })]);
    await expect(
      call(listForSale, many.ctx, { items: [sell("lamp")], neighborhood: "Mission" }),
    ).rejects.toThrow("You can add up to 10 photos");
  });

  test("refuses an empty pick or an unknown neighborhood", async () => {
    const { ctx } = world([item("lamp")]);
    await expect(call(listForSale, ctx, { items: [], neighborhood: "Mission" })).rejects.toThrow(
      "Pick something to sell",
    );
    await expect(
      call(listForSale, ctx, { items: [sell("lamp")], neighborhood: "Atlantis" }),
    ).rejects.toThrow("Choose a location");
  });
});

describe("mine", () => {
  test("shows the sale listing until it's deleted", async () => {
    const live: Row = { ...bought, _id: "listings:mine", sellerId: "users:maya", status: "active" };
    const { ctx } = world(
      [
        item("lamp", { saleListingId: "listings:mine" }),
        item("desk", { title: "Desk", saleListingId: "listings:gone" }),
      ],
      { listings: [bought, live] },
    );
    const rows = (await call(mine, ctx, {})) as { title: string; saleListingId: string | null }[];
    expect(Object.fromEntries(rows.map((r) => [r.title, r.saleListingId]))).toEqual({
      "Brass floor lamp": "listings:mine",
      Desk: null,
    });
  });
});

describe("saleDrafts", () => {
  test("pre-fills title, photos and price, plus category and place for Marketplace buys", async () => {
    const pad = item("pad", {
      title: "Black Diamond Mondo crash pad",
      price: 190,
      photos: ["/p/1.jpg"],
      source: { kind: "marketplace", listingId: "listings:pad", conversationId: "conversations:c" },
    });
    const { ctx } = world([item("lamp"), pad]);
    const drafts = await call(saleDrafts, ctx, {
      itemIds: ["ownedItems:lamp", "ownedItems:pad"],
    });
    expect(drafts).toEqual([
      {
        itemId: "ownedItems:lamp",
        title: "Brass floor lamp",
        price: 40,
        photos: ["/seed/lamp.jpg"],
        category: "household",
        neighborhood: null,
      },
      {
        itemId: "ownedItems:pad",
        title: "Black Diamond Mondo crash pad",
        price: 190,
        photos: ["/p/1.jpg"],
        category: "sporting",
        neighborhood: "Mission",
      },
    ]);
  });

  test("leaves out other people's items and ones already listed", async () => {
    const live: Row = { ...bought, _id: "listings:mine", sellerId: "users:maya", status: "active" };
    const { ctx } = world(
      [
        item("lamp", { saleListingId: "listings:mine" }),
        item("kais", { userId: "users:kai" }),
        item("desk", { title: "Desk", saleListingId: "listings:gone" }),
      ],
      { listings: [bought, live] },
    );
    const drafts = (await call(saleDrafts, ctx, {
      itemIds: ["ownedItems:lamp", "ownedItems:kais", "ownedItems:desk"],
    })) as { itemId: string }[];
    expect(drafts.map((d) => d.itemId)).toEqual(["ownedItems:desk"]);
  });
});
