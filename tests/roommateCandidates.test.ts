import { describe, expect, test } from "bun:test";
import {
  byCandidateRank,
  CANDIDATES_SHOWN,
  COMPARE_MAX,
  type Overlap,
  overlapOf,
  type RoommateCandidate,
  roommateCandidates,
} from "../convex/lib/roommates";
import { networkReach, REACH_FRIENDS_MAX } from "../convex/lib/vouches";
import { askMessage, namesShown, overlapLine } from "../src/landing/roommates/candidateCopy";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

const id = (s: string) => s as never;

const user = (_id: string): Row => ({
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
  { _id: `fr${++n}`, userId: a, friendId: b, createdAt: n },
  { _id: `fr${++n}`, userId: b, friendId: a, createdAt: n },
];
const block = (a: string, b: string): Row => ({
  _id: `bl${++n}`,
  userId: a,
  blockedId: b,
  createdAt: 0,
});
const vouch = (voucherId: string, subjectId: string): Row => ({
  _id: `vo${++n}`,
  voucherId,
  subjectId,
  relationship: "lived_with",
  createdAt: n,
  updatedAt: n,
});
const lifestyle = (userId: string, shared = true): Row => ({
  _id: `rl_${userId}`,
  userId,
  answers: { sleep: "early", quietHours: "10pm" },
  shared,
  sharedAt: shared ? 1 : undefined,
  updatedAt: 1,
});
const fact = (userId: string, key: string, value: unknown, source = "stated"): Row => ({
  _id: `f${++n}`,
  userId,
  key,
  value,
  source,
  evidence: { kind: "brief", summary: "x" },
  confidence: 1,
  updatedAt: 1,
});
const plans = (userId: string, month: string, slugs: string[], budget: object): Row[] => [
  fact(userId, "moveIn", { month }),
  fact(userId, "budget", budget),
  ...slugs.map((slug) => fact(userId, "neighborhood", { slug })),
];

/**
 * V is the viewer. F1, F2 are V's friends; V blocked Bk, who is still in V's
 * friend list (stale data). Seen as V:
 * - A: V's friend, shares.
 * - Vd: vouched for by F2, no friends in common. Shares.
 * - P: friend of F1 and F2, shares, same month, neighborhood and budget.
 * - Q: friend of F1, shares, nothing in common.
 * - Vx: vouched for by F1 only, but Vx blocked F1 afterwards. Shares.
 * - Priv: friend of F1, answers but doesn't share.
 * - Bc: friend of F1, shares, blocked V.
 * - K: friend of Bk only. Shares.
 * - O: no connection to V. Shares.
 */
function world(over: Partial<Record<string, Row[]>> = {}) {
  const people = ["V", "F1", "F2", "Bk", "A", "Vd", "P", "Q", "Vx", "Priv", "Bc", "K", "O"];
  return {
    users: people.map(user),
    friendships: [
      ...friends("V", "F1"),
      ...friends("V", "F2"),
      ...friends("V", "Bk"),
      ...friends("V", "A"),
      ...friends("P", "F1"),
      ...friends("P", "F2"),
      ...friends("Q", "F1"),
      ...friends("Priv", "F1"),
      ...friends("Bc", "F1"),
      ...friends("K", "Bk"),
      ...friends("O", "Z"),
    ],
    vouches: [vouch("F2", "Vd"), vouch("F1", "Vx"), vouch("F1", "V"), vouch("O", "A")],
    blocks: [block("V", "Bk"), block("Vx", "F1"), block("Bc", "V")],
    roommateLifestyles: [
      ...["V", "A", "Vd", "P", "Q", "Vx", "Bc", "K", "O"].map((u) => lifestyle(u)),
      lifestyle("Priv", false),
    ],
    cityProfiles: [],
    cityProfileFacts: [
      ...plans("V", "2027-03", ["mission", "bernal-heights"], { min: 1800, max: 2400 }),
      ...plans("P", "2027-03", ["noe-valley", "mission"], { min: 2000, max: 2600 }),
      ...plans("Q", "2027-05", ["inner-sunset"], { min: 3000, max: 3600 }),
      fact("A", "moveIn", { month: "2027-03" }, "inferred"),
    ],
    ...over,
  } as Record<string, Row[]>;
}

const usernames = (list: RoommateCandidate[] | undefined) => list?.map((c) => c.user._id);

describe("roommateCandidates", () => {
  test("opted-in people from the network, closest first", async () => {
    const r = await roommateCandidates(fakeCtx(world()), id("V"));
    expect(usernames(r?.candidates)).toEqual(["A", "Vd", "P", "Q"]);
    expect(r?.total).toBe(4);
    expect(r?.partial).toBe(false);
    expect(r?.candidates.map((c) => c.closeness)).toEqual([
      "friend",
      "vouched",
      "friend_of_friend",
      "friend_of_friend",
    ]);
  });

  test("nobody is listed while the viewer doesn't share", async () => {
    const w = world();
    w.roommateLifestyles = w.roommateLifestyles.map((r) =>
      r.userId === "V" ? { ...r, shared: false } : r,
    );
    expect(await roommateCandidates(fakeCtx(w), id("V"))).toBeNull();
  });

  test("names only the viewer's friends who connect them", async () => {
    const r = await roommateCandidates(fakeCtx(world()), id("V"));
    const p = r?.candidates.find((c) => c.user._id === "P");
    expect(p?.mutualFriends.map((u) => u._id)).toEqual(["F1", "F2"]);
    expect(p?.mutualFriendCount).toBe(2);
    const vd = r?.candidates.find((c) => c.user._id === "Vd");
    expect(vd?.vouchedBy.map((u) => u._id)).toEqual(["F2"]);
    expect(vd?.mutualFriends).toEqual([]);
    // O's vouch for A isn't from V's network, so it isn't counted.
    expect(r?.candidates.find((c) => c.user._id === "A")?.vouchCount).toBe(0);
  });

  test("a blocked friend never links anyone, and a voided vouch doesn't count", async () => {
    const r = await roommateCandidates(fakeCtx(world()), id("V"));
    const all = JSON.stringify(r);
    for (const hidden of ["K", "Bk", "Vx", "Bc", "Priv", "O"])
      expect(usernames(r?.candidates)).not.toContain(hidden);
    expect(all).not.toContain('"Bk"');
  });

  test("blocks either way hide the candidate", async () => {
    const r = await roommateCandidates(
      fakeCtx(world({ blocks: [block("V", "P"), block("Q", "V")] })),
      id("V"),
    );
    expect(usernames(r?.candidates)).not.toContain("P");
    expect(usernames(r?.candidates)).not.toContain("Q");
  });

  test("overlap keeps only shared stated values and never amounts or answers", async () => {
    const r = await roommateCandidates(fakeCtx(world()), id("V"));
    const by = (u: string) => r?.candidates.find((c) => c.user._id === u)?.overlap;
    expect(by("P")).toEqual({ moveInMonth: "2027-03", neighborhoods: ["mission"], budget: true });
    expect(by("Q")).toEqual({ moveInMonth: null, neighborhoods: [], budget: false });
    // A's move-in month is inferred, so it never counts.
    expect(by("A")?.moveInMonth).toBeNull();
    const all = JSON.stringify(r);
    for (const leak of ["1800", "2400", "2600", "3000", "noe-valley", "inner-sunset", "answers"])
      expect(all).not.toContain(leak);
  });

  test("reads stay bounded on a large network", async () => {
    const w = world();
    const many = 3 * REACH_FRIENDS_MAX;
    for (let i = 0; i < many; i++) {
      w.friendships.push(...friends("V", `G${i}`));
      for (let j = 0; j < 30; j++) w.friendships.push(...friends(`G${i}`, `H${i}_${j}`));
      w.roommateLifestyles.push(lifestyle(`G${i}`));
      w.users.push(user(`G${i}`));
    }
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const r = await roommateCandidates(fakeCtx(w, stats), id("V"));
    expect(r?.partial).toBe(true);
    expect(r?.candidates.length).toBe(CANDIDATES_SHOWN);
    expect(r?.total).toBeLessThanOrEqual(COMPARE_MAX);
    expect(stats.ranges).toBeLessThan(2500);
    expect(stats.docs).toBeLessThan(16_000);
  });
});

describe("networkReach", () => {
  test("lists friends, people friends vouch for and friends of friends, never the viewer", async () => {
    const { people } = await networkReach(fakeCtx(world()), id("V"));
    const ids = people.map((p) => p.userId);
    expect(ids).not.toContain("V");
    expect(ids).not.toContain("Bk");
    expect(ids).not.toContain("K");
    expect(ids).not.toContain("O");
    expect(ids.slice(0, 3).sort()).toEqual(["A", "F1", "F2"]);
  });
});

describe("ranking", () => {
  const overlap = (o: Partial<Overlap>): Overlap => ({
    moveInMonth: null,
    neighborhoods: [],
    budget: false,
    ...o,
  });
  const c = (
    name: string,
    closeness: RoommateCandidate["closeness"],
    o: Partial<Overlap> = {},
    mutualFriendCount = 1,
  ) =>
    ({
      user: { name },
      closeness,
      overlap: overlap(o),
      mutualFriendCount,
      vouchCount: 0,
    }) as RoommateCandidate;

  test("closeness, then overlap, then connections, then name", () => {
    const list = [
      c("Zed", "friend_of_friend", { budget: true, moveInMonth: "2027-03" }),
      c("Amy", "friend_of_friend", { budget: true }, 4),
      c("Bea", "friend_of_friend", { budget: true }, 1),
      c("Cal", "vouched"),
      c("Dee", "friend"),
    ].sort(byCandidateRank);
    expect(list.map((x) => x.user.name)).toEqual(["Dee", "Cal", "Zed", "Amy", "Bea"]);
  });

  test("overlapOf needs both sides", () => {
    const empty = { budget: null, moveInMonth: null, neighborhoods: [] };
    expect(overlapOf(empty, empty)).toEqual(overlap({}));
    expect(
      overlapOf(
        { budget: { max: 2000 }, moveInMonth: "2027-03", neighborhoods: ["mission"] },
        { budget: null, moveInMonth: "2027-04", neighborhoods: [] },
      ),
    ).toEqual(overlap({}));
  });
});

describe("copy", () => {
  test("names: two shown, the rest counted", () => {
    expect(namesShown(["Jordan", "Priya"], 2)).toEqual({ shown: ["Jordan", "Priya"], others: 0 });
    expect(namesShown(["Jordan", "Priya", "Dev"], 7)).toEqual({
      shown: ["Jordan", "Priya"],
      others: 5,
    });
  });

  test("overlap reads naturally", () => {
    expect(overlapLine({ moveInMonth: "2027-03", neighborhoods: ["mission"], budget: true })).toBe(
      "Also moving in March 2027 · Mission · Budgets overlap",
    );
    expect(
      overlapLine({
        moveInMonth: null,
        neighborhoods: ["mission", "bernal-heights"],
        budget: false,
      }),
    ).toBe("Also looking at Mission and Bernal Heights");
    expect(overlapLine({ moveInMonth: null, neighborhoods: [], budget: false })).toBeNull();
  });

  test("the drafted message names only plans both stated, never a budget", () => {
    expect(
      askMessage("Leo", { moveInMonth: "2027-03", neighborhoods: ["mission"], budget: true }),
    ).toBe(
      "Hi Leo! I saw you on Landing's roommate matching. I'm also moving in March 2027, and we both have Mission on our list. Want to chat about finding a place together?",
    );
    expect(askMessage("Leo", { moveInMonth: null, neighborhoods: [], budget: true })).toBe(
      "Hi Leo! I saw you on Landing's roommate matching. Want to chat about finding a place together?",
    );
  });
});
