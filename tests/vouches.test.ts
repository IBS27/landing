import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import {
  BLOCK_READ_MAX,
  cleanNote,
  FOF_SCAN_MAX,
  FRIEND_LOOKUP_MAX,
  FRIEND_READ_BUDGET,
  FRIENDS_READ_MAX,
  listerNetwork,
  PAIR_CHECK_MAX,
  removeVouch,
  saveVouch,
  VOUCH_SCAN_MAX,
  VOUCHES_SHOWN,
} from "../convex/lib/vouches";
import { VOUCH_NOTE_MAX } from "../convex/lib/vouchNote";
import {
  nameList,
  relationLine,
  relationshipLine,
  viaLine,
  vouchesTitle,
} from "../src/landing/search/vouchCopy";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

const id = (s: string) => s as never;
const DAY = 86_400_000;

const user = (_id: string) => ({
  _id,
  name: `${_id} Lastname`,
  firstName: _id,
  username: _id.toLowerCase(),
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
});

let n = 0;
const friends = (a: string, b: string): Row[] => [
  { _id: `fr${++n}`, userId: a, friendId: b, createdAt: 0 },
  { _id: `fr${++n}`, userId: b, friendId: a, createdAt: 0 },
];
const block = (a: string, b: string): Row => ({
  _id: `bl${++n}`,
  userId: a,
  blockedId: b,
  createdAt: 0,
});
const vouch = (voucherId: string, subjectId: string, daysAgo: number, note?: string): Row => ({
  _id: `vo${++n}`,
  voucherId,
  subjectId,
  relationship: "rented_from",
  note,
  createdAt: -daysAgo * DAY,
  updatedAt: -daysAgo * DAY,
});

/**
 * V is the viewer and L the lister. F1, F2 are V's friends; F1 and Bk are L's
 * friends, so L is a friend of friends (Bk is blocked by V, so never shown).
 * P is a friend of F1 and F2 but not V. O has no connection to V. Q vouched for
 * L and was later blocked by L.
 */
function world() {
  return {
    users: ["V", "F1", "F2", "L", "P", "O", "Bk", "Q", "S"].map(user),
    friendships: [
      ...friends("V", "F1"),
      ...friends("V", "F2"),
      ...friends("V", "Bk"),
      ...friends("L", "F1"),
      ...friends("L", "Bk"),
      ...friends("P", "F1"),
      ...friends("P", "F2"),
      ...friends("Q", "F2"),
    ],
    blocks: [block("V", "Bk"), block("L", "Q"), block("S", "V")],
    vouches: [
      vouch("O", "L", 1),
      vouch("P", "L", 2, "Great landlord"),
      vouch("F2", "L", 5),
      vouch("Bk", "L", 3),
      vouch("Q", "L", 4),
      vouch("V", "L", 30),
    ],
  };
}

describe("listerNetwork", () => {
  test("shows mutual friends and only vouches from the viewer's network, closest first", async () => {
    const net = await listerNetwork(fakeCtx(world()), id("V"), id("L"));
    expect(net?.relation).toBe("friend_of_friend");
    expect(net?.mutualFriends.map((u) => u._id)).toEqual(id(["F1"]));
    expect(net?.mutualFriendCount).toBe(1);
    expect(net?.vouches.map((v) => [v.voucher._id, v.via])).toEqual([
      ["V", "you"],
      ["F2", "friend"],
      ["P", "friend_of_friend"],
    ]);
    const p = net?.vouches[2];
    expect(p?.bridges.map((u) => u._id)).toEqual(id(["F1", "F2"]));
    expect(p?.bridgeCount).toBe(2);
    expect(p?.note).toBe("Great landlord");
  });

  test("a friend lister and an unconnected lister", async () => {
    const w = world();
    expect((await listerNetwork(fakeCtx(w), id("V"), id("F1")))?.relation).toBe("friend");
    const none = await listerNetwork(fakeCtx(w), id("V"), id("O"));
    expect(none).toEqual({
      relation: "none",
      mutualFriends: [],
      mutualFriendCount: 0,
      vouches: [],
      vouchTotal: 0,
      partial: false,
    });
  });

  test("the lister sees every vouch for them, except from people they blocked", async () => {
    const net = await listerNetwork(fakeCtx(world()), id("L"), id("L"));
    expect(net?.relation).toBe("you");
    expect(net?.mutualFriends).toEqual([]);
    expect(net?.vouches.map((v) => [v.voucher._id, v.via])).toEqual([
      ["Bk", "friend"],
      ["P", "friend_of_friend"],
      ["V", "friend_of_friend"],
      ["O", "other"],
      ["F2", "other"],
    ]);
  });

  test("nothing when the viewer and lister are blocked either way", async () => {
    expect(await listerNetwork(fakeCtx(world()), id("V"), id("S"))).toBeNull();
    expect(await listerNetwork(fakeCtx(world()), id("S"), id("V"))).toBeNull();
  });

  test("many newer outsider vouches never hide the viewer's or a friend's", async () => {
    const w = world();
    const crowd = Array.from({ length: FOF_SCAN_MAX + 20 }, (_, i) => `X${i}`);
    w.users.push(...crowd.map(user));
    w.vouches.push(...crowd.map((x) => vouch(x, "L", 0)));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches.map((v) => [v.voucher._id, v.via])).toEqual([
      ["V", "you"],
      ["F2", "friend"],
    ]);
    expect(net?.partial).toBe(true);
  });

  test("an edited vouch counts as recent", async () => {
    const w = world();
    const p = w.vouches.find((v) => v.voucherId === "P");
    if (p) p.updatedAt = 1;
    const crowd = Array.from({ length: FOF_SCAN_MAX }, (_, i) => `X${i}`);
    w.users.push(...crowd.map(user));
    w.vouches.push(...crowd.map((x) => vouch(x, "L", 0)));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches.map((v) => v.voucher._id)).toEqual(id(["V", "F2", "P"]));
  });

  test("stops checking friends of friends once the friendship read budget is spent", async () => {
    const w = world();
    const many = Array.from({ length: FRIEND_READ_BUDGET + 1 }, (_, i) => `Y${i}`);
    w.users.push(user("Hub"), ...many.map(user));
    w.friendships.push(...many.flatMap((y) => friends("Hub", y)), ...friends("Hub", "F1"));
    w.vouches.push(vouch("Hub", "L", 0));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches.map((v) => v.voucher._id)).toEqual(id(["V", "F2"]));
    expect(net?.partial).toBe(true);
  });

  test("past the scan, the viewer's own and friends' vouches are looked up directly", async () => {
    const w = world();
    const crowd = Array.from({ length: VOUCH_SCAN_MAX + 5 }, (_, i) => `X${i}`);
    w.users.push(...crowd.map(user));
    w.vouches.push(...crowd.map((x) => vouch(x, "L", 0)));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches.map((v) => [v.voucher._id, v.via])).toEqual([
      ["V", "you"],
      ["F2", "friend"],
    ]);
    expect(net?.partial).toBe(true);
  });

  test("past the scan with too many friends to look up, the viewer's own vouch still shows", async () => {
    const w = world();
    const pals = Array.from({ length: FRIEND_LOOKUP_MAX }, (_, i) => `Pal${i}`);
    const crowd = Array.from({ length: VOUCH_SCAN_MAX + 5 }, (_, i) => `X${i}`);
    w.users.push(...pals.map(user), ...crowd.map(user));
    w.friendships.push(...pals.flatMap((x) => friends("V", x)));
    w.vouches.push(...crowd.map((x) => vouch(x, "L", 0)));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches.map((v) => v.voucher._id)).toEqual(id(["V"]));
    expect(net?.partial).toBe(true);
  });

  test("a voided friend vouch doesn't mask unchecked friends-of-friends vouches", async () => {
    const w = world();
    w.blocks.push(block("L", "F2"));
    const fv = w.vouches.find((v) => v.voucherId === "F2");
    if (fv) fv.updatedAt = 10;
    const crowd = Array.from({ length: FOF_SCAN_MAX }, (_, i) => `X${i}`);
    w.users.push(...crowd.map(user));
    w.vouches.push(...crowd.map((x) => vouch(x, "L", 0)));
    w.vouches = w.vouches.filter((v) => v.voucherId !== "V");
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches).toEqual([]);
    expect(net?.partial).toBe(true);
  });

  test("returns at most VOUCHES_SHOWN vouches and counts the rest", async () => {
    const w = world();
    const pals = Array.from({ length: VOUCHES_SHOWN + 5 }, (_, i) => `Pal${i}`);
    w.users.push(...pals.map(user));
    w.friendships.push(...pals.flatMap((x) => friends("V", x)));
    w.vouches.push(...pals.map((x) => vouch(x, "L", 1)));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.vouches).toHaveLength(VOUCHES_SHOWN);
    expect(net?.vouches[0]?.via).toBe("you");
    expect(net?.vouchTotal).toBe(VOUCHES_SHOWN + 5 + 3);
  });

  test("a lister blocked by thousands of accounts: bounded reads, and blocks still void vouches", async () => {
    const w = world();
    const haters = Array.from({ length: 3 * BLOCK_READ_MAX }, (_, i) => `H${i}`);
    w.users.push(...haters.map(user));
    w.blocks.push(...haters.map((h) => block(h, "L")));
    // F1 blocked L after vouching; that block is past what the block lists read.
    w.blocks.push(block("F1", "L"));
    w.vouches.push(vouch("F1", "L", 0));
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const net = await listerNetwork(fakeCtx(w, stats), id("V"), id("L"));
    expect(net?.vouches.map((v) => v.voucher._id)).toEqual(id(["V", "F2", "P"]));
    expect(net?.partial).toBe(false);
    expect(stats.docs).toBeLessThan(2 * BLOCK_READ_MAX + 500);
    expect(stats.ranges).toBeLessThan(1000);
  });

  test("a viewer whose block list is too long to read still hides blocked people", async () => {
    const w = world();
    const others = Array.from({ length: BLOCK_READ_MAX + 5 }, (_, i) => `Z${i}`);
    w.users.push(...others.map(user));
    // V blocked Bk (a mutual friend and voucher) after more blocks than the lists read.
    w.blocks = [
      ...others.map((z) => block("V", z)),
      { ...block("V", "Bk"), createdAt: 1 },
      block("L", "Q"),
      block("S", "V"),
    ];
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.mutualFriends.map((u) => u._id)).toEqual(id(["F1"]));
    expect(net?.vouches.map((v) => v.voucher._id)).toEqual(id(["V", "F2", "P"]));
    expect(await listerNetwork(fakeCtx(w), id("V"), id("S"))).toBeNull();
  });

  test("past the pair-check budget, unchecked people are left out and the result is partial", async () => {
    const w = world();
    const others = Array.from({ length: BLOCK_READ_MAX + 5 }, (_, i) => `Z${i}`);
    const pals = Array.from({ length: PAIR_CHECK_MAX + 20 }, (_, i) => `Pal${i}`);
    w.users.push(...others.map(user), ...pals.map(user));
    w.blocks.push(...others.map((z) => block("V", z)));
    w.friendships.push(...pals.flatMap((x) => [...friends("V", x), ...friends("L", x)]));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("L"));
    expect(net?.mutualFriendCount).toBeLessThan(pals.length + 1);
    expect(net?.partial).toBe(true);
  });

  test("a friend past the friend-list read cap is still a friend", async () => {
    const w = world();
    const pals = Array.from({ length: FRIENDS_READ_MAX }, (_, i) => `Pal${i}`);
    w.users.push(...pals.map(user), user("Late"));
    w.friendships.push(...pals.flatMap((x) => friends("V", x)), ...friends("V", "Late"));
    const net = await listerNetwork(fakeCtx(w), id("V"), id("Late"));
    expect(net?.relation).toBe("friend");
    expect(net?.partial).toBe(true);
  });
});

describe("saveVouch and removeVouch", () => {
  const me = (u: string) => user(u) as unknown as Doc<"users">;

  test("creates (notifying the lister once), updates and removes one vouch per pair", async () => {
    const w = world();
    const ctx = fakeCtx(w);
    const first = await saveVouch(ctx, me("F1"), id("L"), {
      relationship: "lived_with",
      note: "  Shared a flat\n for a year ",
    });
    let mine = w.vouches.filter((v) => v.voucherId === "F1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ relationship: "lived_with", note: "Shared a flat for a year" });

    const notes = () => (w as Record<string, Row[]>).notifications ?? [];
    expect(notes()).toHaveLength(1);
    expect(notes()[0]).toMatchObject({ userId: "L", actorId: "F1", kind: "vouch" });

    const again = await saveVouch(ctx, me("F1"), id("L"), { relationship: "worked_with" });
    expect(notes()).toHaveLength(1);
    expect(again).toBe(first);
    mine = w.vouches.filter((v) => v.voucherId === "F1");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.relationship).toBe("worked_with");
    expect(mine[0]?.note).toBeUndefined();

    await removeVouch(ctx, id("F1"), id("L"));
    expect(w.vouches.filter((v) => v.voucherId === "F1")).toHaveLength(0);
    await removeVouch(ctx, id("F1"), id("L"));
  });

  test("refuses yourself, blocked people and missing people", async () => {
    const ctx = fakeCtx(world());
    const r = { relationship: "know_personally" } as const;
    await expect(saveVouch(ctx, me("V"), id("V"), r)).rejects.toThrow("yourself");
    await expect(saveVouch(ctx, me("V"), id("S"), r)).rejects.toThrow("isn't available");
    await expect(saveVouch(ctx, me("V"), id("Bk"), r)).rejects.toThrow("isn't available");
    await expect(saveVouch(ctx, me("V"), id("nobody"), r)).rejects.toThrow("isn't available");
  });

  test("cleanNote trims, drops empty notes and caps the length", () => {
    expect(cleanNote(undefined)).toBeUndefined();
    expect(cleanNote("   ")).toBeUndefined();
    expect(cleanNote(" a \n b ")).toBe("a b");
    expect(cleanNote("x".repeat(VOUCH_NOTE_MAX))).toHaveLength(VOUCH_NOTE_MAX);
    expect(() => cleanNote("x".repeat(VOUCH_NOTE_MAX + 1))).toThrow();
  });
});

describe("vouch copy", () => {
  const derek = { name: "Derek Holloway", firstName: "Derek" };
  const p = (firstName: string) => ({ firstName });

  test("nameList", () => {
    expect(nameList([])).toBe("");
    expect(nameList([p("Dev")])).toBe("Dev");
    expect(nameList([p("Dev"), p("Priya")])).toBe("Dev and Priya");
    expect(nameList([p("Dev"), p("Priya"), p("Kai")])).toBe("Dev, Priya and 1 other");
    expect(nameList([p("Dev"), p("Priya")], 5)).toBe("Dev, Priya and 3 others");
  });

  test("relationLine", () => {
    expect(relationLine("you", derek, [], 0)).toBe("This is your listing");
    expect(relationLine("friend", derek, [], 0)).toBe("Derek is your friend");
    expect(relationLine("friend", derek, [p("Dev")], 1)).toBe(
      "Derek is your friend · 1 mutual friend",
    );
    expect(relationLine("friend_of_friend", derek, [p("Jordan")], 1)).toBe("Friends with Jordan");
    expect(relationLine("none", derek, [], 0, true)).toBe("No mutual friends found with Derek");
    expect(relationLine("none", derek, [], 0)).toBe("No one in your network is friends with Derek");
  });

  test("viaLine, relationshipLine and vouchesTitle", () => {
    expect(viaLine({ via: "friend", bridges: [], bridgeCount: 0 })).toBe("Your friend");
    const bridges = [user("Dev"), user("Priya")];
    expect(viaLine({ via: "friend_of_friend", bridges: id(bridges), bridgeCount: 4 })).toBe(
      "Friend of Dev, Priya and 2 others",
    );
    expect(viaLine({ via: "other", bridges: [], bridgeCount: 0 })).toBe("Not in your network");
    expect(relationshipLine("rented_from", derek)).toBe("Rented from Derek");
    expect(vouchesTitle("friend_of_friend", 0)).toBe("No vouches from your network");
    expect(vouchesTitle("friend_of_friend", 0, true)).toBe("No vouches found in your network");
    expect(vouchesTitle("you", 0, true)).toBe("No vouches found");
    expect(vouchesTitle("none", 2)).toBe("2 vouches from your network");
    expect(vouchesTitle("you", 1)).toBe("1 person vouches for you");
    expect(vouchesTitle("you", 3)).toBe("3 people vouch for you");
  });
});
