import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { statesAmount } from "../convex/lib/proposals";
import {
  renterPrice,
  type SubletInput,
  subletLadder,
  subletMoveProblems,
} from "../convex/lib/subleases";
import { create } from "../convex/subleases";
import { fakeCtx, type Row } from "./fakeDb";

const input = (chat: SubletInput["chat"], yourLastPrice: number | null = null): SubletInput => ({
  listing: {
    title: "Room in a Mission flat",
    askingRent: 1600,
    neighborhood: "Mission",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    availableFrom: "Jun 1",
    availableTo: "Aug 31",
    description: "Sunny room",
  },
  limits: { minRent: 1450, notes: null },
  yourLastPrice,
  chat,
  renter: [],
});
const renter = (text: string) => ({ from: "renter" as const, text });
const you = (text: string) => ({ from: "you" as const, text });

describe("renterPrice", () => {
  test("reads the renter's latest rent after your last message", () => {
    expect(renterPrice([renter("Would you take 1,300?")])).toBe(1300);
    expect(renterPrice([renter("$1400 ok?")])).toBe(1400);
    expect(renterPrice([renter("1300?"), you("I could do $1525"), renter("Hi!")])).toBe(null);
  });

  test("ignores parts of other numbers", () => {
    expect(renterPrice([renter("Is it 1200 sqft?")])).toBe(null);
    expect(renterPrice([renter("Is it 1200 square feet?")])).toBe(null);
    expect(renterPrice([renter("Unit 12345678?")])).toBe(null);
  });
});

describe("subletMoveProblems, any move", () => {
  test("no move names a rent under the floor", () => {
    const i = input([renter("1300?")]);
    const message = {
      move: "message" as const,
      amount: 0,
      text: "I can do $1300/month.",
      rationale: "r",
    };
    expect(subletMoveProblems(message, i)).not.toEqual([]);
    expect(subletMoveProblems({ ...message, text: "I can do 1300/month." }, i)).not.toEqual([]);
    expect(subletMoveProblems({ ...message, text: "I can do $1,300.00/month." }, i)).not.toEqual(
      [],
    );
    expect(subletMoveProblems({ ...message, text: "I can do $1,500/month." }, i)).toEqual([]);
  });
});

describe("subletLadder", () => {
  test("first message gets the basics and a tour invite", () => {
    const m = subletLadder(input([renter("Is this still available?")]));
    expect(m.move).toBe("message");
    expect(m.text).toContain("$1,600/month");
  });

  test("stays between the lowest rent and asking, and every move passes the checks", () => {
    const runs: [SubletInput["chat"], number | null][] = [
      [[renter("Is this still available?")], null],
      [[renter("Would you take 1,300?")], null],
      [[renter("How about 1400?")], 1450],
      [[renter("Ok, I can do 1500")], 1450],
      [[renter("I'll pay 1700")], null],
      [[renter("1449?")], 1460],
    ];
    for (const [chat, last] of runs) {
      const i = input(chat, last);
      const m = subletLadder(i);
      expect(subletMoveProblems(m, i)).toEqual([]);
      if (m.move === "offer" || m.move === "accept") {
        expect(m.amount).toBeGreaterThanOrEqual(1450);
        expect(m.amount).toBeLessThanOrEqual(1600);
        expect(statesAmount(m.text, m.amount)).toBe(true);
      }
    }
  });

  test("counters, accepts and declines at the floor", () => {
    expect(subletLadder(input([renter("Would you take 1,300?")]))).toMatchObject({
      move: "offer",
      amount: 1450,
    });
    expect(subletLadder(input([renter("How about 1400?")], 1450)).move).toBe("walk_away");
    expect(subletLadder(input([renter("Ok, I can do 1500")], 1450))).toMatchObject({
      move: "accept",
      amount: 1500,
    });
    expect(subletLadder(input([renter("I'll pay 1700")]))).toMatchObject({
      move: "accept",
      amount: 1600,
    });
  });
});

describe("subletMoveProblems", () => {
  const ok = { move: "offer" as const, amount: 1500, text: "I could do $1500.", rationale: "r" };

  test("keeps prices between the floor and asking, and counters never go up", () => {
    const i = input([renter("1300?")], 1480);
    expect(subletMoveProblems({ ...ok, amount: 1400, text: "$1400" }, i)).not.toEqual([]);
    expect(subletMoveProblems({ ...ok, amount: 1700, text: "$1700" }, i)).not.toEqual([]);
    expect(subletMoveProblems(ok, i)).toContain("a counter can't go above your last price of 1480");
  });

  test("the text states the rent, with no address or payment asks", () => {
    const i = input([renter("1300?")]);
    expect(subletMoveProblems(ok, i)).toEqual([]);
    expect(subletMoveProblems({ ...ok, text: "I could do 1,500." }, i)).not.toEqual([]);
    expect(subletMoveProblems({ ...ok, text: "$1500, deposit by Venmo" }, i)).not.toEqual([]);
    // #73's scam signals apply to the lister's own messages.
    expect(subletMoveProblems({ ...ok, text: "$1500. Text me on WhatsApp" }, i)).not.toEqual([]);
    expect(subletMoveProblems({ ...ok, text: "$1500, come by 123 Valencia St" }, i)).not.toEqual(
      [],
    );
  });
});

test("a sublet can't be listed for dates that have passed", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const tables: Record<string, Row[]> = { users: [{ _id: "users:maya" }], listings: [] };
  const handler = (
    create as unknown as { _handler: (c: MutationCtx, a: object) => Promise<unknown> }
  )._handler;
  await expect(
    handler(fakeCtx(tables), {
      viewerId: "users:maya",
      title: "Room in a Mission flat",
      rent: 1600,
      minRent: 1450,
      description: "Sunny room.",
      photos: [{ url: "/p/room.jpg" }],
      neighborhood: "Mission",
      propertyType: "room",
      bedrooms: 1,
      bathrooms: 1,
      availableFrom: Date.now() - 60 * DAY,
      availableTo: Date.now() - 30 * DAY,
      furnished: true,
    }),
  ).rejects.toThrow("These dates have already passed");
  expect(tables.listings).toHaveLength(0);
});
