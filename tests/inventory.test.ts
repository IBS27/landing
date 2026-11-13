import { describe, expect, setSystemTime, test } from "bun:test";
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
