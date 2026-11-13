import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import {
  buyerPrice,
  type SaleInput,
  type SaleMove,
  saleLadder,
  saleMoveProblems,
} from "../convex/lib/moveOutSales";
import { saveReply, setTerms } from "../convex/moveOutSales";
import { fakeCtx, type Row } from "./fakeDb";

const base = (chat: SaleInput["chat"], yourLastPrice: number | null = null): SaleInput => ({
  item: { title: "IKEA desk lamp", askingPrice: 40, description: "Works great." },
  limits: { minPrice: 30 },
  yourLastPrice,
  chat,
});

describe("buyerPrice", () => {
  test("reads the buyer's price after the seller's last message, using #36's parser", () => {
    expect(buyerPrice(base([{ from: "buyer", text: "Would you take 20?" }]))).toBe(20);
    expect(
      buyerPrice(
        base([
          { from: "buyer", text: "Would you take 20?" },
          { from: "you", text: "Could you do $35?" },
        ]),
      ),
    ).toBeNull();
  });
});

describe("saleLadder", () => {
  test("a first question gets availability and pickup", () => {
    const m = saleLadder(base([{ from: "buyer", text: "Is this still available?" }]));
    expect(m).toMatchObject({ move: "message", amount: 0 });
    expect(m.text).toContain("$40");
    expect(saleMoveProblems(m, base([]))).toEqual([]);
  });
  test("accepts at or above the lowest price", () => {
    const input = base([{ from: "buyer", text: "I can do 32" }]);
    const m = saleLadder(input);
    expect(m).toMatchObject({ move: "accept", amount: 32 });
    expect(saleMoveProblems(m, input)).toEqual([]);
  });
  test("counters toward the floor, never under it", () => {
    const input = base([{ from: "buyer", text: "Would you take 20?" }]);
    const m = saleLadder(input);
    expect(m.move).toBe("offer");
    expect(m.amount).toBeGreaterThanOrEqual(30);
    expect(m.amount).toBeLessThan(40);
    expect(saleMoveProblems(m, input)).toEqual([]);
  });
  test("declines politely once already at the floor", () => {
    const input = base([{ from: "buyer", text: "20 is my max" }], 30);
    expect(saleLadder(input)).toMatchObject({ move: "walk_away", amount: 0 });
  });
});

describe("saleMoveProblems", () => {
  const input = base([{ from: "buyer", text: "Would you take 20?" }], 35);
  test("rejects prices under the floor, over asking, or above the last counter", () => {
    expect(
      saleMoveProblems(
        { move: "offer", amount: 25, text: "Could you do $25?", rationale: "r" },
        input,
      ),
    ).toContain("amount 25 is under the seller's lowest price of 30");
    expect(
      saleMoveProblems({ move: "accept", amount: 45, text: "$45 works", rationale: "r" }, input),
    ).toContain("amount 45 is over the asking price of 40");
    expect(
      saleMoveProblems(
        { move: "offer", amount: 38, text: "Could you do $38?", rationale: "r" },
        input,
      ),
    ).toContain("a counter can't go above your last price of 35");
  });
  test("the text must state the amount and never share payment or address details", () => {
    expect(
      saleMoveProblems(
        { move: "offer", amount: 32, text: "Could you meet me higher?", rationale: "r" },
        input,
      ),
    ).toContain("text must state the price as $32");
    expect(
      saleMoveProblems(
        { move: "message", amount: 0, text: "Send it on Venmo first", rationale: "r" },
        input,
      ).some((x) => x.includes("payment")),
    ).toBe(true);
    expect(
      saleMoveProblems(
        { move: "message", amount: 0, text: "Come to 123 Valencia St", rationale: "r" },
        input,
      ),
    ).toContain("text must not share the street address");
  });
});

describe("the floor stays private", () => {
  test("no fallback reply names the floor unless it's the price on offer", () => {
    const chats: [SaleInput["chat"], number | null][] = [
      [[{ from: "buyer", text: "Is it still available?" }], null],
      [[{ from: "buyer", text: "Is it still available?" }], 30],
      [[{ from: "buyer", text: "Would you take 20?" }], null],
      [[{ from: "buyer", text: "20 is my max" }], 30],
      [[{ from: "buyer", text: "I can do 30" }], 35],
    ];
    for (const [chat, last] of chats) {
      const input = base(chat, last);
      const m = saleLadder(input);
      expect(saleMoveProblems(m, input)).toEqual([]);
      if (!((m.move === "offer" || m.move === "accept") && m.amount === 30))
        expect(m.text).not.toMatch(/\b30\b/);
    }
  });
  test("a reply that names the floor is rejected", () => {
    const input = base([{ from: "buyer", text: "Would you take 20?" }], 35);
    const say = (move: SaleMove["move"], amount: number, text: string) =>
      saleMoveProblems({ move, amount, text, rationale: "r" }, input);
    expect(say("walk_away", 0, "Sorry, $30 is the lowest I can go.")).toContain(
      "text must not reveal the seller's lowest price",
    );
    expect(say("offer", 33, "Could you do $33? I can't go under 30.")).toContain(
      "text must not reveal the seller's lowest price",
    );
    expect(say("offer", 35, "Could you do $35? My minimum is $30.00.")).toContain(
      "text must not reveal the seller's lowest price",
    );
    expect(say("offer", 30, "Could you do $30?")).toEqual([]);
  });
});

/* The waiting draft per chat, through the Convex functions. */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, args);

function world(extra: Record<string, Row[]> = {}) {
  const scheduled: { fn: unknown; args: unknown }[] = [];
  const tables: Record<string, Row[]> = {
    users: [{ _id: "users:maya" }, { _id: "users:jordan" }],
    listings: [
      {
        _id: "listings:lamp",
        sellerId: "users:maya",
        title: "IKEA desk lamp",
        description: "Works great.",
        photos: [],
        location: { neighborhood: "Mission" },
        price: 40,
        status: "active",
        createdAt: 1,
      },
    ],
    ownedItems: [
      {
        _id: "ownedItems:lamp",
        userId: "users:maya",
        saleListingId: "listings:lamp",
        saleMinPrice: 30,
        saleMuse: "active",
        saleTermsAt: 50,
      },
    ],
    conversations: [
      {
        _id: "conversations:c1",
        kind: "marketplace",
        listingId: "listings:lamp",
        memberIds: ["users:maya", "users:jordan"],
      },
    ],
    conversationMembers: [
      { _id: "cm1", conversationId: "conversations:c1", userId: "users:maya" },
      { _id: "cm2", conversationId: "conversations:c1", userId: "users:jordan" },
    ],
    blocks: [],
    saleChats: [],
    proposals: [],
    proposalEvents: [],
    messages: [],
    ...extra,
  };
  const later = async (_at: number, fn: unknown, args: unknown) => {
    scheduled.push({ fn, args });
  };
  const ctx = {
    ...fakeCtx(tables),
    scheduler: { runAfter: later, runAt: later },
  } as unknown as MutationCtx;
  return { ctx, tables, scheduled };
}

const reply = (o: Record<string, unknown> = {}) => ({
  conversationId: "conversations:c1",
  move: "message",
  amount: 0,
  text: "Hi! Yes, it's still available.",
  rationale: "Confirms it's available.",
  handledThrough: 10,
  termsAt: 50,
  via: "fallback",
  ...o,
});

const pending = (tables: Record<string, Row[]>) =>
  tables.proposals.filter((p) => p.status === "pending");

describe("saveReply keeps one waiting draft per chat", () => {
  test("a reply is a proposal with a draft only the seller sees, nothing sent", async () => {
    const { ctx, tables } = world();
    await call(saveReply, ctx, reply());
    expect(pending(tables)).toHaveLength(1);
    expect(tables.proposals[0]).toMatchObject({ ownerId: "users:maya" });
    expect(tables.messages).toHaveLength(1);
    expect(tables.messages[0].status).toBe("pending_approval");
    expect(tables.saleChats[0]).toMatchObject({ handledThrough: 10, lastMove: "message" });
  });
  test("a newer reply replaces the waiting one", async () => {
    const { ctx, tables } = world();
    await call(saveReply, ctx, reply());
    await call(saveReply, ctx, reply({ handledThrough: 20, text: "Still here!" }));
    expect(pending(tables)).toHaveLength(1);
    expect(tables.proposals.map((p) => p.status)).toEqual(["expired", "pending"]);
    expect(tables.messages).toHaveLength(1);
    expect(tables.messages[0].text).toBe("Still here!");
  });
  test("an older run finishing late never replaces a newer draft", async () => {
    const { ctx, tables } = world();
    await call(saveReply, ctx, reply({ handledThrough: 20 }));
    await call(saveReply, ctx, reply({ handledThrough: 10, text: "Old" }));
    expect(tables.proposals).toHaveLength(1);
    expect(tables.messages[0].text).not.toBe("Old");
  });
  test("a run drafted under older terms saves nothing and drafts again", async () => {
    const { ctx, tables, scheduled } = world();
    await call(saveReply, ctx, reply({ termsAt: 20 }));
    expect(tables.proposals).toHaveLength(0);
    expect(scheduled).toHaveLength(1);
  });
  test("paused, Muse saves nothing", async () => {
    const { ctx, tables } = world();
    tables.ownedItems[0].saleMuse = "paused";
    await call(saveReply, ctx, reply());
    expect(tables.proposals).toHaveLength(0);
  });
  test("nothing is drafted across a block", async () => {
    const { ctx, tables } = world({
      blocks: [{ _id: "b1", userId: "users:jordan", blockedId: "users:maya" }],
    });
    await expect(call(saveReply, ctx, reply())).rejects.toThrow();
    expect(tables.proposals).toHaveLength(0);
  });
});

describe("setTerms", () => {
  const terms = (o: Record<string, unknown>) => ({
    viewerId: "users:maya",
    itemId: "ownedItems:lamp",
    ...o,
  });
  test("a raised floor withdraws the waiting draft and drafts again", async () => {
    const { ctx, tables, scheduled } = world();
    await call(saveReply, ctx, reply({ move: "accept", amount: 32, text: "$32 works for me." }));
    scheduled.length = 0;
    await call(setTerms, ctx, terms({ minPrice: 35 }));
    expect(pending(tables)).toHaveLength(0);
    expect(tables.messages).toHaveLength(0);
    expect(tables.saleChats[0].handledThrough).toBe(0);
    expect(scheduled).toHaveLength(1);
  });
  test("a lowered floor keeps the waiting draft", async () => {
    const { ctx, tables, scheduled } = world();
    await call(saveReply, ctx, reply({ move: "accept", amount: 32, text: "$32 works for me." }));
    scheduled.length = 0;
    await call(setTerms, ctx, terms({ minPrice: 25 }));
    expect(pending(tables)).toHaveLength(1);
    expect(scheduled).toHaveLength(0);
  });
  test("only the item's owner can change its terms", async () => {
    const { ctx } = world();
    await expect(
      call(setTerms, ctx, terms({ viewerId: "users:jordan", minPrice: 20 })),
    ).rejects.toThrow("Item not found");
  });
});
