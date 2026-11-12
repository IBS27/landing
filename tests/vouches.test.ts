import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import {
  cleanNote,
  FOF_SCAN_MAX,
  FRIEND_READ_BUDGET,
  listerNetwork,
  removeVouch,
  saveVouch,
  VOUCH_NOTE_MAX,
} from "../convex/lib/vouches";
import {
  nameList,
  relationLine,
  relationshipLine,
  viaLine,
  vouchesTitle,
} from "../src/landing/search/vouchCopy";
import { fakeCtx, type Row } from "./fakeDb";

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
});

describe("saveVouch and removeVouch", () => {
  const me = (u: string) => user(u) as unknown as Doc<"users">;

  test("creates, updates and removes one vouch per pair", async () => {
    const w = world();
    const ctx = fakeCtx(w);
    const first = await saveVouch(ctx, me("F1"), id("L"), {
      relationship: "lived_with",
      note: "  Shared a flat\n for a year ",
    });
    let mine = w.vouches.filter((v) => v.voucherId === "F1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ relationship: "lived_with", note: "Shared a flat for a year" });

    const again = await saveVouch(ctx, me("F1"), id("L"), { relationship: "worked_with" });
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
    expect(vouchesTitle("none", 2)).toBe("2 vouches from your network");
    expect(vouchesTitle("you", 1)).toBe("1 person vouches for you");
    expect(vouchesTitle("you", 3)).toBe("3 people vouch for you");
  });
});
