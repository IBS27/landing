import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import * as groups from "../convex/groups";
import * as house from "../convex/house";
import {
  addMonth,
  amountProblem,
  cleanTitle,
  isOverdue,
  mondayOf,
  money,
  parseDollars,
  periodOf,
} from "../convex/lib/house";
import { canSeeGroupAsHouse, houseMateIds, listableGroupIds } from "../convex/lib/houseAccess";
import * as listings from "../convex/listings";
import { fakeCtx, type Row } from "./fakeDb";

/* ───────────── Pure helpers ───────────── */

describe("money", () => {
  test("parses what people type into whole cents", () => {
    expect(parseDollars("142.37")).toBe(14_237);
    expect(parseDollars("$1,250")).toBe(125_000);
    expect(parseDollars(" 65.5 ")).toBe(6_550);
    expect(parseDollars("$3,750.00")).toBe(375_000);
    expect(parseDollars("0.07")).toBe(7);
    for (const bad of ["", "abc", "1.234", "12,34", "-5", "1e3", "$"])
      expect(parseDollars(bad)).toBeNull();
  });
  test("formats with cents only when there are some", () => {
    expect(money(375_000)).toBe("$3,750");
    expect(money(14_237)).toBe("$142.37");
    expect(money(6_550)).toBe("$65.50");
  });
  test("amounts must be positive whole cents", () => {
    expect(amountProblem(14_237)).toBeNull();
    expect(amountProblem(0)).not.toBeNull();
    expect(amountProblem(-100)).not.toBeNull();
    expect(amountProblem(10.5)).not.toBeNull();
    expect(amountProblem(Number.NaN)).not.toBeNull();
    expect(amountProblem(10_000_001)).not.toBeNull();
  });
});

describe("San Francisco periods", () => {
  afterEach(() => setSystemTime());
  test("weeks start on Monday; months on the 1st; one-offs are 'once'", () => {
    expect(mondayOf("2026-11-12")).toBe("2026-11-09"); // Thursday
    expect(mondayOf("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(mondayOf("2026-11-15")).toBe("2026-11-09"); // Sunday
    // 11pm Sunday in San Francisco is already Monday in UTC: still last week.
    const sundayNight = Date.parse("2026-11-16T07:00:00Z");
    expect(periodOf("weekly", sundayNight)).toBe("2026-11-09");
    expect(periodOf("monthly", sundayNight)).toBe("2026-11-01");
    expect(periodOf("once", sundayNight)).toBe("once");
  });
  test("next month keeps the day, or the month's last day", () => {
    // A bill due on the 31st stays on its day after a short month.
    expect(addMonth("2027-02-28", 31)).toBe("2027-03-31");
    expect(addMonth("2027-03-31", 31)).toBe("2027-04-30");
    expect(addMonth("2026-11-01")).toBe("2026-12-01");
    expect(addMonth("2026-12-15")).toBe("2027-01-15");
    expect(addMonth("2027-01-31")).toBe("2027-02-28");
    expect(addMonth("2028-01-31")).toBe("2028-02-29");
  });
  test("overdue is past the due date, unpaid", () => {
    const now = Date.parse("2026-11-12T20:00:00Z");
    expect(isOverdue({ dueDate: "2026-11-11" }, now)).toBe(true);
    expect(isOverdue({ dueDate: "2026-11-12" }, now)).toBe(false);
    expect(isOverdue({ dueDate: "2026-11-11", paidAt: 1 }, now)).toBe(false);
    expect(isOverdue({}, now)).toBe(false);
  });
  test("titles are trimmed and limited", () => {
    expect(cleanTitle("  Take   the bins  out ")).toEqual({ ok: true, text: "Take the bins out" });
    expect(cleanTitle("   ").ok).toBe(false);
    expect(cleanTitle("x".repeat(81)).ok).toBe(false);
  });
});

/* ───────────── Through the Convex functions ───────────── */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, viewer: string, args: Record<string, unknown> = {}) =>
  (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args });

const CROWD = Array.from({ length: 22 }, (_, i) => `f${i}`);
const PEOPLE = ["maya", "ana", "hannah", "zed", "blocky", ...CROWD];

/** Maya is friends with Ana, Hannah and Blocky; Zed is a stranger; Blocky blocked Maya. */
function world(extraGroups: Row[] = []) {
  let n = 0;
  const friend = (a: string, b: string): Row[] => [
    { _id: `friendships:${++n}`, userId: `users:${a}`, friendId: `users:${b}`, createdAt: 1 },
    { _id: `friendships:${++n}`, userId: `users:${b}`, friendId: `users:${a}`, createdAt: 1 },
  ];
  const tables: Record<string, Row[]> = {
    users: PEOPLE.map((p) => ({
      _id: `users:${p}`,
      name: `${p[0].toUpperCase()}${p.slice(1)} Lee`,
      firstName: p,
      username: p,
      avatar: "",
      verified: false,
    })),
    friendships: [
      ...friend("maya", "ana"),
      ...friend("maya", "hannah"),
      ...friend("ana", "hannah"),
      ...friend("maya", "blocky"),
      ...CROWD.flatMap((f) => friend("maya", f)),
    ],
    blocks: [{ _id: "blocks:1", userId: "users:blocky", blockedId: "users:maya", createdAt: 1 }],
    groups: [...extraGroups],
    groupMembers: [],
    houses: [],
    houseInvites: [],
    houseChores: [],
    choreCompletions: [],
    houseBills: [],
    groceryItems: [],
    notifications: [],
    userSettings: [],
    cityProfiles: [],
    profileSignals: [],
    listings: [],
    events: [],
  };
  const ctx = fakeCtx(tables);
  // `groups.join` records a learn-from-activity signal and schedules a recompute.
  Object.assign(ctx, { scheduler: { runAfter: async () => null } });
  Object.assign(ctx.db, {
    normalizeId: (table: string, id: string) => (id.startsWith(`${table}:`) ? id : null),
  });
  return { ctx, tables };
}

async function startHouse(invite = ["ana", "hannah"]) {
  const w = world();
  const { houseId, slug } = (await call(house.create, w.ctx, "maya", {
    name: "  Dwight Way house ",
    invite: invite.map((p) => `users:${p}`),
  })) as { houseId: string; slug: string };
  const groupId = w.tables.houses[0].groupId as string;
  return { ...w, houseId, slug, groupId };
}

type Page = {
  state: "member" | "invited";
  house: { name: string };
  members: { username: string }[];
  invited: { username: string }[];
  chores: { _id: string; title: string; assignee: { username: string } | null; done: unknown }[];
  bills: {
    open: { _id: string; title: string; amountCents: number; dueDate: string | null }[];
    paid: { _id: string; title: string }[];
  };
  groceries: { _id: string; text: string; checked: unknown }[];
} | null;

describe("starting a house", () => {
  test("a private, hidden, unlocated Group with the creator as admin and invites recorded", async () => {
    const { tables, groupId, slug } = await startHouse();
    const g = tables.groups[0];
    expect(g).toMatchObject({ name: "Dwight Way house", privacy: "private", visible: false });
    expect(g.point).toBeUndefined();
    expect(g.neighborhoodId).toBeUndefined();
    expect(slug).toBe("dwight-way-house");
    expect(tables.groupMembers).toEqual([
      expect.objectContaining({ groupId, userId: "users:maya", role: "admin" }),
    ]);
    expect(tables.houseInvites.map((i) => i.userId).sort()).toEqual(["users:ana", "users:hannah"]);
    expect(tables.notifications.map((n) => [n.userId, n.kind, n.groupId])).toEqual([
      ["users:ana", "group_invite", groupId],
      ["users:hannah", "group_invite", groupId],
    ]);
  });

  test("invites go to friends only, and not across a block", async () => {
    const w = world();
    await expect(
      call(house.create, w.ctx, "maya", { name: "House", invite: ["users:zed"] }),
    ).rejects.toThrow("You can invite your friends");
    await expect(
      call(house.create, w.ctx, "maya", { name: "House", invite: ["users:blocky"] }),
    ).rejects.toThrow("You can invite your friends");
    await expect(call(house.create, w.ctx, "maya", { name: "  ", invite: [] })).rejects.toThrow(
      "Add a name for your house",
    );
    expect(w.tables.groups).toHaveLength(0);
  });

  test("a second house with the same name gets its own slug", async () => {
    const { ctx } = await startHouse();
    const again = (await call(house.create, ctx, "maya", {
      name: "Dwight Way house",
      invite: [],
    })) as {
      slug: string;
    };
    expect(again.slug).toBe("dwight-way-house-2");
  });
});

describe("House Groups are invite-only", () => {
  test("someone without an invite can't join, see the Group or read the house", async () => {
    const { ctx, tables, groupId, slug } = await startHouse();
    await expect(call(groups.join, ctx, "zed", { groupId })).rejects.toThrow("invite-only");
    expect(tables.groupMembers).toHaveLength(1);
    expect(await call(groups.get, ctx, "zed", { idOrSlug: slug })).toBeNull();
    expect(await call(house.page, ctx, "zed", { slug })).toBeNull();
    expect(await canSeeGroupAsHouse(ctx, groupId as never, "users:zed" as never)).toBe(false);
  });

  test("an invitee sees the invite, joins with it, and the invite is used up", async () => {
    const { ctx, tables, houseId, groupId, slug } = await startHouse();
    expect(await canSeeGroupAsHouse(ctx, groupId as never, "users:ana" as never)).toBe(true);
    const invited = (await call(house.page, ctx, "ana", { slug })) as { state: string };
    expect(invited.state).toBe("invited");
    const mine = (await call(house.mine, ctx, "ana")) as { invites: { _id: string }[] };
    expect(mine.invites.map((i) => i._id)).toEqual([houseId]);

    await call(groups.join, ctx, "ana", { groupId });
    expect(tables.houseInvites.map((i) => i.userId)).toEqual(["users:hannah"]);
    expect(tables.groups[0].memberCount).toBe(2);
    const page = (await call(house.page, ctx, "ana")) as Page;
    expect(page?.state).toBe("member");
    expect(page?.members.map((m) => m.username)).toEqual(["maya", "ana"]);
    expect(page?.invited.map((m) => m.username)).toEqual(["hannah"]);
    expect(await houseMateIds(ctx, "users:ana" as never)).toEqual(["users:maya"]);
  });

  test("inviting from the Group page records the house invite too", async () => {
    const { ctx, tables, groupId } = await startHouse([]);
    await call(groups.invite, ctx, "maya", { groupId, userIds: ["users:ana"] });
    expect(tables.houseInvites.map((i) => i.userId)).toEqual(["users:ana"]);
    await call(groups.join, ctx, "ana", { groupId });
    expect(tables.groupMembers.map((m) => m.userId)).toEqual(["users:maya", "users:ana"]);
  });

  test("an invite still counts when the invitee turned off Group notifications", async () => {
    const w = world();
    w.tables.userSettings.push({
      _id: "userSettings:1",
      userId: "users:ana",
      notificationsOff: ["groups"],
    });
    await call(house.create, w.ctx, "maya", { name: "House", invite: ["users:ana"] });
    expect(w.tables.notifications).toHaveLength(0);
    const groupId = w.tables.houses[0].groupId;
    await call(groups.join, w.ctx, "ana", { groupId });
    expect(w.tables.groupMembers).toHaveLength(2);
  });

  test("declining removes the invite and its notification", async () => {
    const { ctx, tables, houseId, groupId } = await startHouse(["ana"]);
    await call(house.declineInvite, ctx, "ana", { houseId });
    expect(tables.houseInvites).toHaveLength(0);
    expect(tables.notifications).toHaveLength(0);
    await expect(call(groups.join, ctx, "ana", { groupId })).rejects.toThrow("invite-only");
  });

  test("other Groups join as before", async () => {
    const w = world([
      {
        _id: "groups:open",
        name: "Run club",
        slug: "run-club",
        privacy: "public",
        visible: true,
        memberCount: 0,
        externalMemberCount: 0,
        category: "Sports",
        tags: [],
      },
    ]);
    await call(groups.join, w.ctx, "zed", { groupId: "groups:open" });
    expect(w.tables.groupMembers).toHaveLength(1);
  });
});

describe("chores, bills and groceries", () => {
  afterEach(() => setSystemTime());

  async function moved() {
    const w = await startHouse();
    await call(groups.join, w.ctx, "ana", { groupId: w.groupId });
    return w;
  }

  test("only people who live there can read or change anything", async () => {
    const { ctx, houseId } = await moved();
    await expect(
      call(house.addChore, ctx, "zed", { houseId, title: "Dishes", cadence: "weekly" }),
    ).rejects.toThrow("House not found");
    // Invited isn't the same as living there.
    await expect(call(house.addGrocery, ctx, "hannah", { houseId, text: "Eggs" })).rejects.toThrow(
      "House not found",
    );
    const itemId = await call(house.addGrocery, ctx, "ana", { houseId, text: "Eggs" });
    await expect(
      call(house.setGroceryChecked, ctx, "zed", { itemId, checked: true }),
    ).rejects.toThrow("House not found");
    await expect(call(house.removeGrocery, ctx, "zed", { itemId })).rejects.toThrow(
      "House not found",
    );
  });

  test("a chore's assignee must live there; done is per week, with who did it", async () => {
    setSystemTime(new Date("2026-11-12T20:00:00Z")); // Thursday
    const { ctx, tables, houseId } = await moved();
    await expect(
      call(house.addChore, ctx, "maya", {
        houseId,
        title: "Bins",
        cadence: "weekly",
        assigneeId: "users:hannah", // invited, not moved in
      }),
    ).rejects.toThrow("Pick someone who lives in the house");
    const choreId = await call(house.addChore, ctx, "maya", {
      houseId,
      title: "Bins",
      cadence: "weekly",
      assigneeId: "users:ana",
    });
    await call(house.setChoreDone, ctx, "ana", { choreId, done: true });
    await call(house.setChoreDone, ctx, "maya", { choreId, done: true }); // already done
    expect(tables.choreCompletions).toEqual([
      expect.objectContaining({ choreId, period: "2026-11-09", userId: "users:ana" }),
    ]);
    let page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.chores[0]).toMatchObject({ assignee: { username: "ana" } });
    expect(page?.chores[0].done).not.toBeNull();

    // Next Monday the chore is due again; last week's completion stays as history.
    setSystemTime(new Date("2026-11-16T20:00:00Z"));
    page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.chores[0].done).toBeNull();
    expect(tables.choreCompletions).toHaveLength(1);

    await call(house.assignChore, ctx, "maya", { choreId, assigneeId: null });
    page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.chores[0].assignee).toBeNull();
    await call(house.removeChore, ctx, "maya", { choreId });
    expect(tables.houseChores).toHaveLength(0);
    expect(tables.choreCompletions).toHaveLength(0);
  });

  test("someone who moves out isn't shown as on a chore", async () => {
    const { ctx, houseId, groupId } = await moved();
    await call(house.addChore, ctx, "maya", {
      houseId,
      title: "Bins",
      cadence: "weekly",
      assigneeId: "users:ana",
    });
    await call(groups.leave, ctx, "ana", { groupId });
    const page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.chores[0].assignee).toBeNull();
    await expect(call(house.page, ctx, "ana", {})).resolves.toBeNull();
  });

  test("bills: whole cents, real dates; paying a monthly bill adds next month's, undo removes it", async () => {
    setSystemTime(new Date("2026-11-12T20:00:00Z"));
    const { ctx, tables, houseId } = await moved();
    for (const [bad, message] of [
      [{ amountCents: 0 }, "Add an amount above $0"],
      [{ amountCents: 12.5 }, "Amounts are in whole cents"],
      [{ dueDate: "2026-02-30" }, "Pick a real due date"],
      [{ cadence: "monthly", dueDate: undefined }, "Monthly bills need a due date"],
    ] as const)
      await expect(
        call(house.addBill, ctx, "maya", {
          houseId,
          title: "Rent",
          amountCents: 375_000,
          dueDate: "2026-12-01",
          cadence: "once",
          ...bad,
        }),
      ).rejects.toThrow(message);

    const rent = await call(house.addBill, ctx, "maya", {
      houseId,
      title: "Rent",
      amountCents: 375_000,
      dueDate: "2027-01-31",
      cadence: "monthly",
    });
    await call(house.setBillPaid, ctx, "ana", { billId: rent, paid: true });
    expect(tables.houseBills).toHaveLength(2);
    expect(tables.houseBills[0]).toMatchObject({ paidBy: "users:ana" });
    expect(tables.houseBills[1]).toMatchObject({
      dueDate: "2027-02-28",
      fromBillId: rent,
      amountCents: 375_000,
    });
    expect(tables.houseBills[1].paidAt).toBeUndefined();
    // Paying twice doesn't add a third.
    await call(house.setBillPaid, ctx, "ana", { billId: rent, paid: true });
    expect(tables.houseBills).toHaveLength(2);

    let page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.bills.open.map((b) => b.dueDate)).toEqual(["2027-02-28"]);
    expect(page?.bills.paid.map((b) => b._id)).toEqual([rent]);

    await call(house.setBillPaid, ctx, "maya", { billId: rent, paid: false });
    expect(tables.houseBills).toHaveLength(1);
    expect(tables.houseBills[0].paidAt).toBeUndefined();
    page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.bills.open.map((b) => b._id)).toEqual([rent]);
  });

  test("open bills come by due date, undated last", async () => {
    const { ctx, houseId } = await moved();
    const add = (title: string, dueDate?: string) =>
      call(house.addBill, ctx, "maya", {
        houseId,
        title,
        amountCents: 100,
        dueDate,
        cadence: "once",
      });
    await add("Internet");
    await add("PG&E", "2026-12-05");
    await add("Water", "2026-11-20");
    const page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.bills.open.map((b) => b.title)).toEqual(["Water", "PG&E", "Internet"]);
  });

  test("groceries: check off with who, clear checked, unchecked first", async () => {
    const { ctx, tables, houseId } = await moved();
    const eggs = await call(house.addGrocery, ctx, "maya", { houseId, text: " Eggs " });
    await call(house.addGrocery, ctx, "ana", { houseId, text: "Oat milk" });
    await call(house.setGroceryChecked, ctx, "ana", { itemId: eggs, checked: true });
    expect(tables.groceryItems[0]).toMatchObject({ text: "Eggs", checkedBy: "users:ana" });
    const page = (await call(house.page, ctx, "maya")) as Page;
    expect(page?.groceries.map((g) => g.text)).toEqual(["Oat milk", "Eggs"]);
    await call(house.clearChecked, ctx, "maya", { houseId });
    expect(tables.groceryItems.map((g) => g.text)).toEqual(["Oat milk"]);
  });
});

/* ───────────── Review fixes ───────────── */

describe("invites stand only while they should", () => {
  test("a block voids the invite: no Group page, no joining", async () => {
    const { ctx, tables, groupId, slug } = await startHouse(["ana"]);
    tables.blocks.push({
      _id: "blocks:2",
      userId: "users:maya",
      blockedId: "users:ana",
      createdAt: 1,
    });
    expect(await call(groups.get, ctx, "ana", { idOrSlug: slug })).toBeNull();
    expect(await call(house.page, ctx, "ana", { slug })).toBeNull();
    await expect(call(groups.join, ctx, "ana", { groupId })).rejects.toThrow("invite-only");
  });

  test("an invite from someone who moved out doesn't stand; a housemate can invite again", async () => {
    const { ctx, tables, groupId } = await startHouse(["hannah", "ana"]);
    await call(groups.join, ctx, "hannah", { groupId });
    await call(groups.leave, ctx, "maya", { groupId });
    await expect(call(groups.join, ctx, "ana", { groupId })).rejects.toThrow("invite-only");
    const houseId = tables.houses[0]._id;
    expect(await call(house.invite, ctx, "hannah", { houseId, userIds: ["users:ana"] })).toBe(1);
    expect(tables.houseInvites.map((i) => [i.userId, i.invitedBy])).toEqual([
      ["users:ana", "users:hannah"],
    ]);
    await call(groups.join, ctx, "ana", { groupId });
    expect(tables.groupMembers.map((m) => m.userId)).toEqual(["users:hannah", "users:ana"]);
  });

  test("anyone in the house can withdraw an invite", async () => {
    const { ctx, tables, houseId, groupId } = await startHouse(["ana"]);
    await expect(
      call(house.cancelInvite, ctx, "zed", { houseId, userId: "users:ana" }),
    ).rejects.toThrow("House not found");
    await call(house.cancelInvite, ctx, "maya", { houseId, userId: "users:ana" });
    expect(tables.houseInvites).toHaveLength(0);
    expect(tables.notifications).toHaveLength(0);
    await expect(call(groups.join, ctx, "ana", { groupId })).rejects.toThrow("invite-only");
  });

  test("declining on the Group page withdraws the house invite", async () => {
    const { ctx, tables, groupId } = await startHouse(["ana"]);
    await call(groups.declineInvite, ctx, "ana", { groupId });
    expect(tables.houseInvites).toHaveLength(0);
    await expect(call(groups.join, ctx, "ana", { groupId })).rejects.toThrow("invite-only");
  });

  test("the Group page's invite follows the house's rules: friends only, at most 20 open", async () => {
    const { ctx, tables, groupId } = await startHouse([]);
    await call(groups.invite, ctx, "maya", { groupId, userIds: ["users:zed", "users:blocky"] });
    expect(tables.houseInvites).toHaveLength(0);
    expect(tables.notifications).toHaveLength(0);
    await call(groups.invite, ctx, "maya", { groupId, userIds: CROWD.map((f) => `users:${f}`) });
    expect(tables.houseInvites).toHaveLength(20);
    expect(tables.notifications).toHaveLength(20);
    const houseId = tables.houses[0]._id;
    await expect(
      call(house.invite, ctx, "maya", { houseId, userIds: ["users:ana"] }),
    ).rejects.toThrow("up to 20 open invites");
  });

  test("joining by invite respects the five-house limit", async () => {
    const { ctx, tables } = await startHouse([]);
    for (let i = 0; i < 4; i++)
      await call(house.create, ctx, "ana", { name: `Ana ${i}`, invite: [] });
    await call(house.create, ctx, "ana", { name: "Ana 4", invite: [] });
    const maya = tables.houses[0];
    await call(house.invite, ctx, "maya", { houseId: maya._id, userIds: ["users:ana"] });
    await expect(call(groups.join, ctx, "ana", { groupId: maya.groupId })).rejects.toThrow(
      "up to 5 houses",
    );
  });
});

describe("a house stays out of sight elsewhere in the clone", () => {
  test("outsiders get nothing from members, events or invite candidates", async () => {
    const { ctx, groupId } = await startHouse(["ana"]);
    await expect(call(groups.members, ctx, "zed", { groupId })).rejects.toThrow("Group not found");
    expect(await call(groups.events, ctx, "zed", { groupId })).toEqual({ upcoming: [], past: [] });
    expect(await call(groups.inviteCandidates, ctx, "zed", { groupId })).toEqual([]);
    // An invitee isn't a housemate either.
    expect(await call(groups.inviteCandidates, ctx, "ana", { groupId })).toEqual([]);
  });

  test("Marketplace never offers or shows a House Group", async () => {
    const { ctx, tables, groupId } = await startHouse([]);
    const targets = (await call(listings.listingTargets, ctx, "maya")) as { _id: string }[];
    expect(targets.map((t) => t._id)).not.toContain(groupId);
    expect(await listableGroupIds(ctx, [groupId as never])).toBeUndefined();
    // Even a listing already in a hidden Group isn't shown to outsiders.
    tables.listings.push({ _id: "listings:1", groupIds: [groupId], createdAt: 1 } as never);
    expect(await call(listings.buySellGroups, ctx, "zed")).toEqual([]);
  });

  test("a house's slug never shadows a /groups/ page", async () => {
    const w = world();
    const r = (await call(house.create, w.ctx, "maya", { name: "Feed", invite: [] })) as {
      slug: string;
    };
    expect(r.slug).toBe("feed-house");
  });
});

describe("bills and removals hold up", () => {
  afterEach(() => setSystemTime());

  test("a monthly bill due on the 31st stays on the 31st after February", async () => {
    setSystemTime(new Date("2027-01-10T20:00:00Z"));
    const { ctx, tables, houseId } = await startHouse([]);
    let billId = await call(house.addBill, ctx, "maya", {
      houseId,
      title: "Rent",
      amountCents: 100,
      dueDate: "2027-01-31",
      cadence: "monthly",
    });
    const dues: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      await call(house.setBillPaid, ctx, "maya", { billId, paid: true });
      const next = tables.houseBills.find((b) => b.fromBillId === billId);
      dues.push(next?.dueDate);
      billId = next?._id;
    }
    expect(dues).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  test("only unpaid bills count toward the cap", async () => {
    const { ctx, tables, houseId } = await startHouse([]);
    for (let i = 0; i < 100; i++)
      tables.houseBills.push({
        _id: `houseBills:old${i}`,
        houseId,
        title: "Old",
        amountCents: 100,
        cadence: "once",
        paidBy: "users:maya",
        paidAt: 1 + i,
        createdBy: "users:maya",
        createdAt: 1,
      });
    await call(house.addBill, ctx, "maya", {
      houseId,
      title: "Water",
      amountCents: 100,
      cadence: "once",
    });
    const page = (await call(house.page, ctx, "maya")) as {
      bills: { open: unknown[]; paid: unknown[]; morePaid: boolean };
    };
    expect(page.bills.open).toHaveLength(1);
    expect(page.bills.paid).toHaveLength(12);
    expect(page.bills.morePaid).toBe(true);
  });

  test("removing something twice (a double tap) is quiet", async () => {
    const { ctx, houseId } = await startHouse([]);
    const itemId = await call(house.addGrocery, ctx, "maya", { houseId, text: "Eggs" });
    await call(house.removeGrocery, ctx, "maya", { itemId });
    await expect(call(house.removeGrocery, ctx, "maya", { itemId })).resolves.toBeUndefined();
    const choreId = await call(house.addChore, ctx, "maya", {
      houseId,
      title: "Bins",
      cadence: "weekly",
    });
    await call(house.removeChore, ctx, "maya", { choreId });
    await expect(call(house.removeChore, ctx, "maya", { choreId })).resolves.toBeUndefined();
  });
});
