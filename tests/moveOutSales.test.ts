import { describe, expect, test } from "bun:test";
import {
  buyerPrice,
  type SaleInput,
  type SaleMove,
  saleLadder,
  saleMoveProblems,
} from "../convex/lib/moveOutSales";

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
    expect(say("offer", 30, "Could you do $30?")).toEqual([]);
  });
});
