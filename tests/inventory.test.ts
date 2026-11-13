import { describe, expect, setSystemTime, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { add, addPhotos, remove } from "../convex/inventory";
import { afterProposalApproved } from "../convex/lib/inventory";
import { dayStart, today } from "../src/landing/move-in/OwnedItems";
import { fakeCtx, type Row } from "./fakeDb";

const NOW = Date.UTC(2026, 10, 12);

const listing: Row = {
  _id: "listings:pad",
  sellerId: "users:kai",
  title: "Black Diamond Mondo crash pad",
  price: 250,
  photos: ["/p/1.jpg", "/p/2.jpg"],
};

const proposal = (o: { kind?: "offer" | "message"; amount?: number; owner?: string } = {}) =>
  ({
    _id: "proposals:1",
    ownerId: o.owner ?? "users:maya",
    payload:
      (o.kind ?? "offer") === "offer"
        ? {
            kind: "offer",
            conversationId: "conversations:c",
            listingId: "listings:pad",
            amount: o.amount ?? 190,
            text: "$190 works for me.",
          }
        : { kind: "message", conversationId: "conversations:c", text: "Thanks!" },
  }) as never;

const negotiation = (o: { lastMove?: string; pending?: string } = {}): Row => ({
  _id: "negotiations:n",
  buyerId: "users:maya",
  listingId: "listings:pad",
  conversationId: "conversations:c",
  pendingProposalId: o.pending ?? "proposals:1",
  lastMove: o.lastMove ?? "accept",
});

function world(n: Row) {
  const tables: Record<string, Row[]> = {
    listings: [listing],
    negotiations: [n],
    ownedItems: [],
  };
  return { ctx: fakeCtx(tables), tables };
}

describe("afterProposalApproved", () => {
  test("an approved Muse acceptance adds the item with the agreed price, date and photos", async () => {
    const { ctx, tables } = world(negotiation());
    await afterProposalApproved(ctx, proposal(), NOW);
    expect(tables.ownedItems).toHaveLength(1);
    expect(tables.ownedItems[0]).toMatchObject({
      userId: "users:maya",
      title: "Black Diamond Mondo crash pad",
      price: 190,
      acquiredAt: NOW,
      photos: ["/p/1.jpg", "/p/2.jpg"],
      source: { kind: "marketplace", listingId: "listings:pad", conversationId: "conversations:c" },
    });
  });
  test("adds the item once, however often it's approved", async () => {
    const { ctx, tables } = world(negotiation());
    await afterProposalApproved(ctx, proposal(), NOW);
    await afterProposalApproved(ctx, proposal(), NOW + 1000);
    expect(tables.ownedItems).toHaveLength(1);
  });
  test("an opening offer or counter isn't a purchase", async () => {
    const { ctx, tables } = world(negotiation({ lastMove: "offer" }));
    await afterProposalApproved(ctx, proposal(), NOW);
    expect(tables.ownedItems).toHaveLength(0);
  });
  test("only the negotiation's own current draft counts", async () => {
    const { ctx, tables } = world(negotiation({ pending: "proposals:other" }));
    await afterProposalApproved(ctx, proposal(), NOW);
    expect(tables.ownedItems).toHaveLength(0);
  });
  test("messages and the seller's own proposals don't add anything", async () => {
    const a = world(negotiation());
    await afterProposalApproved(a.ctx, proposal({ kind: "message" }), NOW);
    expect(a.tables.ownedItems).toHaveLength(0);
    const b = world(negotiation());
    await afterProposalApproved(b.ctx, proposal({ owner: "users:kai" }), NOW);
    expect(b.tables.ownedItems).toHaveLength(0);
  });
});

/* The viewer's own items, through the Convex functions. */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, { viewerId: "users:maya", ...args });

function mine(item: Partial<Row> = {}, listingStatus = "active") {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "users:maya" }, { _id: "users:kai" }],
    ownedItems: [
      {
        _id: "ownedItems:lamp",
        userId: "users:maya",
        title: "IKEA desk lamp",
        price: 40,
        photos: [],
        saleListingId: "listings:lamp",
        ...item,
      },
    ],
    listings: [{ _id: "listings:lamp", sellerId: "users:maya", status: listingStatus }],
    conversations: [{ _id: "conversations:c1", listingId: "listings:lamp" }],
    saleChats: [
      {
        _id: "saleChats:s1",
        conversationId: "conversations:c1",
        itemId: "ownedItems:lamp",
        pendingProposalId: "proposals:p1",
      },
    ],
    proposals: [{ _id: "proposals:p1", ownerId: "users:maya", status: "pending" }],
    proposalEvents: [],
    messages: [],
    saved: [{ _id: "saved:1", kind: "listing", refId: "listings:lamp", userId: "users:kai" }],
  };
  return { ctx: fakeCtx(tables), tables };
}

describe("inventory functions", () => {
  test("what you paid keeps its cents", async () => {
    const { ctx, tables } = mine();
    await call(add, ctx, { title: "Lamp shade", price: 49.99, acquiredAt: 1, photos: [] });
    expect(tables.ownedItems.at(-1)?.price).toBe(49.99);
  });

  test("an item without a photo can get one later", async () => {
    const { ctx, tables } = mine();
    await call(addPhotos, ctx, { itemId: "ownedItems:lamp", photos: [{ url: "/p/lamp.jpg" }] });
    expect(tables.ownedItems[0].photos).toEqual(["/p/lamp.jpg"]);
    await expect(
      call(addPhotos, ctx, {
        viewerId: "users:kai",
        itemId: "ownedItems:lamp",
        photos: [{ url: "/p/x.jpg" }],
      }),
    ).rejects.toThrow("Item not found");
  });

  test("removing a listed item takes its listing down, with Muse's waiting reply", async () => {
    const { ctx, tables } = mine();
    await call(remove, ctx, { itemId: "ownedItems:lamp" });
    expect(tables.ownedItems).toHaveLength(0);
    expect(tables.listings).toHaveLength(0);
    expect(tables.saved).toHaveLength(0);
    expect(tables.saleChats).toHaveLength(0);
    expect(tables.proposals[0].status).toBe("expired");
  });

  test("a sold listing stays as the record of the sale", async () => {
    const { ctx, tables } = mine({}, "sold");
    await call(remove, ctx, { itemId: "ownedItems:lamp" });
    expect(tables.ownedItems).toHaveLength(0);
    expect(tables.listings).toHaveLength(1);
  });
});

describe("manual item date", () => {
  test("today's default isn't in the future before noon", () => {
    setSystemTime(new Date(2026, 10, 12, 9, 0));
    try {
      expect(dayStart(today())).toBeLessThanOrEqual(Date.now());
    } finally {
      setSystemTime();
    }
  });
});
