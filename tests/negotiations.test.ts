import { describe, expect, test } from "bun:test";
import {
  comparableMedian,
  ladderMove,
  type MoveOutput,
  moveProblems,
  type NegotiationInput,
  sellerFlags,
  sellerPrice,
} from "../convex/lib/negotiations";

const seller = (text: string) => ({ from: "seller" as const, text });
const you = (text: string) => ({ from: "you" as const, text });

function input(over: Partial<NegotiationInput> = {}): NegotiationInput {
  return {
    listing: {
      title: "Crash pad, barely used",
      askingPrice: 250,
      condition: "used_good",
      daysListed: 3,
      description: "",
    },
    comparables: [],
    limits: { maxPrice: 200, targetPrice: 170, notes: null },
    yourLastOffer: null,
    chat: [],
    thingsToCheck: [],
    ...over,
  };
}

const comps = (...prices: number[]) =>
  prices.map((price) => ({ title: "Crash pad", price, status: "active" }));

describe("sellerPrice", () => {
  test("reads the last plausible amount after the buyer's last message", () => {
    expect(sellerPrice([you("$170?"), seller("could you do 220?")], 250)).toBe(220);
    expect(sellerPrice([seller("$1,200 firm")], 1500)).toBe(1200);
    expect(sellerPrice([seller("could you do 220?"), you("$195?")], 250)).toBeNull();
  });

  test("ignores counts, times and amounts outside a fifth of asking to asking", () => {
    expect(sellerPrice([seller("I have 2 of these")], 250)).toBeNull();
    expect(sellerPrice([seller("Pickup after 10pm works")], 250)).toBeNull();
    expect(sellerPrice([seller("I paid 400 for it, 230 is my lowest")], 250)).toBe(230);
  });
});

describe("moveProblems", () => {
  const move = (m: Partial<MoveOutput>): MoveOutput => ({
    move: "offer",
    amount: 180,
    text: "Would you take $180?",
    rationale: "Below asking.",
    ...m,
  });

  test("keeps priced moves within the max and stated in the text", () => {
    expect(moveProblems(move({}), input())).toEqual([]);
    expect(moveProblems(move({ amount: 210, text: "$210?" }), input())).toContain(
      "amount 210 is over the buyer's max of 200",
    );
    expect(moveProblems(move({ text: "Would you take 180?" }), input())).toContain(
      "text must say the amount as $180",
    );
  });

  test("never offers below the last sent offer or at asking", () => {
    expect(moveProblems(move({}), input({ yourLastOffer: 190 }))).toContain(
      "an offer can't go below your last offer of 190",
    );
    expect(
      moveProblems(move({}), input({ listing: { ...input().listing, askingPrice: 180 } })),
    ).toContain("an offer must be below the asking price (use accept to agree)");
  });
});

describe("ladderMove", () => {
  test("opens at the ideal price, else 75% of comparables or asking", () => {
    expect(ladderMove(input()).amount).toBe(170);
    const noTarget = { maxPrice: 200, targetPrice: null, notes: null };
    expect(ladderMove(input({ limits: noTarget })).amount).toBe(190);
    const cited = ladderMove(input({ limits: noTarget, comparables: comps(200, 160, 180) }));
    expect(cited.amount).toBe(135);
    expect(cited.rationale).toContain("$180 median for 3 similar listings");
  });

  test("meets halfway, caps at the max, accepts within it and walks away at it", () => {
    const counter = ladderMove(input({ yourLastOffer: 170, chat: [seller("could you do 220?")] }));
    expect(counter).toMatchObject({ move: "offer", amount: 195 });
    const capped = ladderMove(input({ yourLastOffer: 195, chat: [seller("230")] }));
    expect(capped).toMatchObject({ move: "offer", amount: 200 });
    const accept = ladderMove(input({ yourLastOffer: 195, chat: [seller("200 and it's yours")] }));
    expect(accept).toMatchObject({ move: "accept", amount: 200 });
    const walk = ladderMove(input({ yourLastOffer: 200, chat: [seller("230 is my lowest")] }));
    expect(walk.move).toBe("walk_away");
  });

  test("a reply without a price never raises the offer or walks away", () => {
    for (const last of [170, 200]) {
      const m = ladderMove(input({ yourLastOffer: last, chat: [seller("Yes, that works")] }));
      expect(m).toMatchObject({ move: "message", amount: 0 });
      expect(m.text).toContain(`$${last}`);
    }
  });

  test("every ladder move passes the code checks", () => {
    for (const i of [
      input(),
      input({ yourLastOffer: 170, chat: [seller("could you do 220?")] }),
      input({ yourLastOffer: 195, chat: [seller("200 and it's yours")] }),
      input({ yourLastOffer: 200, chat: [seller("230")] }),
      input({ yourLastOffer: 170, chat: [seller("still available")] }),
    ])
      expect(moveProblems(ladderMove(i), i)).toEqual([]);
  });
});

test("comparableMedian needs enough comparables", () => {
  expect(comparableMedian(input({ comparables: comps(100, 200) }))).toBeNull();
  expect(comparableMedian(input({ comparables: comps(100, 200, 150) }))).toBe(150);
});

test("sellerFlags keeps #73's rules that apply to goods", () => {
  expect(sellerFlags([seller("Venmo me and it's yours"), you("text me")])).toHaveLength(1);
  expect(sellerFlags([seller("Can you pick up Saturday?")])).toEqual([]);
});
