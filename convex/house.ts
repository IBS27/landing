import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  addDays,
  addMonth,
  amountProblem,
  billCadence,
  type ChoreCadence,
  choreCadence,
  cleanTitle,
  isCalendarDate,
  isOverdue,
  MAX_CHORES,
  MAX_GROCERIES,
  MAX_HOUSES_PER_PERSON,
  MAX_OPEN_BILLS,
  NAME_MAX,
  PAID_SHOWN,
  periodOf,
  todayInSF,
} from "./lib/house";
import {
  assertCanInvite,
  houseCount,
  houseMemberIds,
  houseOfGroup,
  invitedIds,
  inviteToHouse,
  isHouseMember,
  requireHouseMember,
  standingInvite,
  withdrawInvites,
} from "./lib/houseAccess";
import { friendIds, getSummaries, type UserSummary } from "./lib/users";

/**
 * House Groups (#38): roommates share a Facebook Group marked as a house, with
 * chores, bills and a grocery list only they can see. Everything here is
 * entered and checked by people; #39 adds Muse's chore rotations and bill
 * splits on top. See `./lib/house.ts` and `./lib/houseAccess.ts`.
 */

const COVER = "/seed/covers/sf-01.jpg";

function fail(check: { ok: true; text: string } | { ok: false; error: string }): string {
  if (!check.ok) throw new ConvexError(check.error);
  return check.text;
}

/* ───────────── Reading ───────────── */

type HouseRef = { _id: Id<"houses">; groupId: Id<"groups">; slug: string; name: string };

function ref(house: Doc<"houses">, group: Doc<"groups">): HouseRef {
  return { _id: house._id, groupId: group._id, slug: group.slug, name: group.name };
}

/** The houses the viewer lives in (most recently joined first) and invites to others. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .collect();
    const houses: (HouseRef & { memberCount: number })[] = [];
    for (const m of memberships) {
      const house = await houseOfGroup(ctx, m.groupId);
      const group = house && (await ctx.db.get(m.groupId));
      if (house && group) houses.push({ ...ref(house, group), memberCount: group.memberCount });
    }
    return { houses, invites: await pendingInvites(ctx, viewerId) };
  },
});

/** Invites that still stand (see `standingInvite`), newest first, one per house. */
async function pendingInvites(ctx: QueryCtx, viewerId: Id<"users">) {
  const rows = await ctx.db
    .query("houseInvites")
    .withIndex("by_user", (q) => q.eq("userId", viewerId))
    .order("desc")
    .collect();
  const out: (HouseRef & { invitedBy: UserSummary; createdAt: number })[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.houseId)) continue;
    seen.add(r.houseId);
    const house = await ctx.db.get(r.houseId);
    const group = house && (await ctx.db.get(house.groupId));
    if (!house || !group || (await isHouseMember(ctx, house, viewerId))) continue;
    const invite = await standingInvite(ctx, house, viewerId);
    const by = invite && (await getSummaries(ctx, [invite.invitedBy])).get(invite.invitedBy);
    if (invite && by)
      out.push({ ...ref(house, group), invitedBy: by, createdAt: invite.createdAt });
  }
  return out;
}

/**
 * One house for the viewer: by its Group's slug, or the one they joined most
 * recently. `invited` when they've been invited but haven't joined; null when
 * there's no such house for them.
 */
export const page = viewerQuery({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, { slug }) => {
    const viewerId = ctx.viewer._id;
    let house: Doc<"houses"> | null = null;
    let group: Doc<"groups"> | null = null;
    if (slug !== undefined) {
      group = await ctx.db
        .query("groups")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      house = group && (await houseOfGroup(ctx, group._id));
    } else {
      const memberships = await ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .order("desc")
        .collect();
      for (const m of memberships) {
        house = await houseOfGroup(ctx, m.groupId);
        if (house) {
          group = await ctx.db.get(m.groupId);
          break;
        }
      }
    }
    if (!house || !group) return null;
    if (!(await isHouseMember(ctx, house, viewerId))) {
      const invite = await standingInvite(ctx, house, viewerId);
      if (!invite) return null;
      const by = (await getSummaries(ctx, [invite.invitedBy])).get(invite.invitedBy);
      return by ? { state: "invited" as const, house: ref(house, group), invitedBy: by } : null;
    }
    return { state: "member" as const, ...(await houseView(ctx, house, group)) };
  },
});

export type ChoreView = {
  _id: Id<"houseChores">;
  title: string;
  cadence: ChoreCadence;
  /** Null when nobody's on it, or the person moved out. */
  assignee: UserSummary | null;
  /** Done for the current period (this week, this month, or ever for a one-off). */
  done: { by: UserSummary | null; at: number } | null;
};

export type BillView = {
  _id: Id<"houseBills">;
  title: string;
  amountCents: number;
  dueDate: string | null;
  cadence: Doc<"houseBills">["cadence"];
  overdue: boolean;
  paid: { by: UserSummary | null; at: number } | null;
  addedBy: UserSummary | null;
};

export type GroceryView = {
  _id: Id<"groceryItems">;
  text: string;
  addedBy: UserSummary | null;
  checked: { by: UserSummary | null; at: number } | null;
};

async function houseView(ctx: QueryCtx, house: Doc<"houses">, group: Doc<"groups">) {
  const now = Date.now();
  const memberIds = await houseMemberIds(ctx, house);
  const members = new Set(memberIds);
  const [invited, choreRows, openRows, paidRows, groceryRows] = await Promise.all([
    invitedIds(ctx, house),
    ctx.db
      .query("houseChores")
      .withIndex("by_house", (q) => q.eq("houseId", house._id))
      .collect(),
    // Open bills, and only the latest paid ones: paid history only grows.
    ctx.db
      .query("houseBills")
      .withIndex("by_house_paid", (q) => q.eq("houseId", house._id).eq("paidAt", undefined))
      .collect(),
    ctx.db
      .query("houseBills")
      .withIndex("by_house_paid", (q) => q.eq("houseId", house._id).gt("paidAt", 0))
      .order("desc")
      .take(PAID_SHOWN + 1),
    ctx.db
      .query("groceryItems")
      .withIndex("by_house", (q) => q.eq("houseId", house._id))
      .collect(),
  ]);
  const completions = await Promise.all(
    choreRows.map((c) =>
      ctx.db
        .query("choreCompletions")
        .withIndex("by_chore", (q) => q.eq("choreId", c._id).eq("period", periodOf(c.cadence, now)))
        .first(),
    ),
  );
  const billRows = [...openRows, ...paidRows.slice(0, PAID_SHOWN)];
  const people = await getSummaries(ctx, [
    ...memberIds,
    ...invited,
    ...choreRows.flatMap((c) => (c.assigneeId ? [c.assigneeId] : [])),
    ...completions.flatMap((c) => (c ? [c.userId] : [])),
    ...billRows.flatMap((b) => [b.createdBy, ...(b.paidBy ? [b.paidBy] : [])]),
    ...groceryRows.flatMap((g) => [g.addedBy, ...(g.checkedBy ? [g.checkedBy] : [])]),
  ]);
  const person = (id: Id<"users"> | undefined) => (id ? (people.get(id) ?? null) : null);

  const chores: ChoreView[] = choreRows.map((c, i) => {
    const done = completions[i];
    return {
      _id: c._id,
      title: c.title,
      cadence: c.cadence,
      assignee: c.assigneeId && members.has(c.assigneeId) ? person(c.assigneeId) : null,
      done: done ? { by: person(done.userId), at: done.doneAt } : null,
    };
  });

  const billView = (b: Doc<"houseBills">): BillView => ({
    _id: b._id,
    title: b.title,
    amountCents: b.amountCents,
    dueDate: b.dueDate ?? null,
    cadence: b.cadence,
    overdue: isOverdue(b, now),
    paid: b.paidAt ? { by: person(b.paidBy), at: b.paidAt } : null,
    addedBy: person(b.createdBy),
  });
  // Open bills by due date (undated last), then the most recently paid.
  const open = [...openRows].sort(
    (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt - b.createdAt,
  );
  const paid = paidRows.slice(0, PAID_SHOWN);

  const groceries: GroceryView[] = [
    ...groceryRows.filter((g) => !g.checkedAt),
    ...groceryRows
      .filter((g) => g.checkedAt)
      .sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)),
  ].map((g) => ({
    _id: g._id,
    text: g.text,
    addedBy: person(g.addedBy),
    checked: g.checkedAt ? { by: person(g.checkedBy), at: g.checkedAt } : null,
  }));

  return {
    house: ref(house, group),
    members: memberIds.flatMap((id) => person(id) ?? []),
    invited: invited.flatMap((id) => person(id) ?? []),
    chores,
    bills: {
      open: open.map(billView),
      paid: paid.map(billView),
      /** Older paid bills exist beyond those shown. */
      morePaid: paidRows.length > PAID_SHOWN,
    },
    groceries,
    today: todayInSF(now),
  };
}

/** For the Group page's banner: the house behind a Group, if the viewer lives there. */
export const forGroup = viewerQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const house = await houseOfGroup(ctx, groupId);
    const group = house && (await ctx.db.get(groupId));
    if (!house || !group || !(await isHouseMember(ctx, house, ctx.viewer._id))) return null;
    return ref(house, group);
  },
});

/** Friends the viewer can invite: not blocked either way, not in the house or invited already. */
export const inviteOptions = viewerQuery({
  args: { houseId: v.optional(v.id("houses")) },
  handler: async (ctx, { houseId }) => {
    const viewerId = ctx.viewer._id;
    let skip = new Set<Id<"users">>();
    if (houseId) {
      const { house } = await requireHouseMember(ctx, houseId, viewerId);
      skip = new Set([...(await houseMemberIds(ctx, house)), ...(await invitedIds(ctx, house))]);
    }
    const ids: Id<"users">[] = [];
    for (const id of await friendIds(ctx, viewerId)) {
      if (skip.has(id) || (await isBlockedEitherWay(ctx, viewerId, id))) continue;
      ids.push(id);
    }
    const people = await getSummaries(ctx, ids);
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
});

/* ───────────── The house ───────────── */

/** Static routes under /groups/ a Group's slug must not shadow. */
const RESERVED_SLUGS = new Set(["create", "discover", "feed", "joins"]);

async function slugFor(ctx: QueryCtx, name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "house";
  let slug = RESERVED_SLUGS.has(base) ? `${base}-house` : base;
  const start = slug;
  for (
    let i = 2;
    await ctx.db
      .query("groups")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    i++
  )
    slug = `${start}-${i}`;
  return slug;
}

/**
 * Start a house: a private, hidden Facebook Group with no location, the
 * viewer as its admin, and invites to the friends they live with.
 */
export const create = viewerMutation({
  args: { name: v.string(), invite: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const name = fail(cleanTitle(args.name, NAME_MAX, "a name for your house"));
    if ((await houseCount(ctx, viewerId)) >= MAX_HOUSES_PER_PERSON)
      throw new ConvexError(`You can be in up to ${MAX_HOUSES_PER_PERSON} houses`);
    await assertCanInvite(ctx, viewerId, args.invite);

    const now = Date.now();
    const slug = await slugFor(ctx, name);
    const groupId = await ctx.db.insert("groups", {
      name,
      slug,
      cover: COVER,
      privacy: "private",
      // Hidden from search, and never located: where people live stays private.
      visible: false,
      description: "Our house: chores, bills and groceries are in Landing, under My Place.",
      category: "General",
      rules: [],
      tags: [],
      createdBy: viewerId,
      createdAt: now,
      externalMemberCount: 0,
      memberCount: 1,
      lastActivityAt: now,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: viewerId,
      role: "admin",
      joinedAt: now,
      lastVisitedAt: now,
    });
    const houseId = await ctx.db.insert("houses", { groupId, createdBy: viewerId, createdAt: now });
    const house = await ctx.db.get(houseId);
    const group = await ctx.db.get(groupId);
    // Friends only, no blocks; a bad invitee undoes the whole create.
    if (house && group) await inviteToHouse(ctx, house, group, viewerId, args.invite, true);
    return { houseId, slug };
  },
});

/** Invite friends to a house you live in. */
export const invite = viewerMutation({
  args: { houseId: v.id("houses"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { houseId, userIds }) => {
    const viewerId = ctx.viewer._id;
    const { house, group } = await requireHouseMember(ctx, houseId, viewerId);
    return (await inviteToHouse(ctx, house, group, viewerId, userIds, true)).length;
  },
});

/** Withdraw someone's invite to a house you live in. */
export const cancelInvite = viewerMutation({
  args: { houseId: v.id("houses"), userId: v.id("users") },
  handler: async (ctx, { houseId, userId }) => {
    const { house } = await requireHouseMember(ctx, houseId, ctx.viewer._id);
    await withdrawInvites(ctx, house, userId);
  },
});

/** Turn down an invite: removes it and its notifications. Joining is `groups.join`. */
export const declineInvite = viewerMutation({
  args: { houseId: v.id("houses") },
  handler: async (ctx, { houseId }) => {
    const house = await ctx.db.get(houseId);
    if (house) await withdrawInvites(ctx, house, ctx.viewer._id);
  },
});

/* ───────────── Chores ───────────── */

async function assertMember(ctx: QueryCtx, house: Doc<"houses">, userId: Id<"users">) {
  if (!(await isHouseMember(ctx, house, userId)))
    throw new ConvexError("Pick someone who lives in the house");
}

async function choreForMember(ctx: QueryCtx, choreId: Id<"houseChores">, viewerId: Id<"users">) {
  const chore = await ctx.db.get(choreId);
  if (!chore) throw new ConvexError("Chore not found");
  const { house } = await requireHouseMember(ctx, chore.houseId, viewerId);
  return { chore, house };
}

export const addChore = viewerMutation({
  args: {
    houseId: v.id("houses"),
    title: v.string(),
    cadence: choreCadence,
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const { house } = await requireHouseMember(ctx, args.houseId, viewerId);
    const title = fail(cleanTitle(args.title, undefined, "a chore"));
    if (args.assigneeId) await assertMember(ctx, house, args.assigneeId);
    const chores = await ctx.db
      .query("houseChores")
      .withIndex("by_house", (q) => q.eq("houseId", house._id))
      .collect();
    if (chores.length >= MAX_CHORES)
      throw new ConvexError(`A house can have up to ${MAX_CHORES} chores`);
    return ctx.db.insert("houseChores", {
      houseId: house._id,
      title,
      cadence: args.cadence,
      assigneeId: args.assigneeId,
      createdBy: viewerId,
      createdAt: Date.now(),
    });
  },
});

/** Put someone who lives in the house on a chore, or nobody (null). */
export const assignChore = viewerMutation({
  args: { choreId: v.id("houseChores"), assigneeId: v.union(v.id("users"), v.null()) },
  handler: async (ctx, { choreId, assigneeId }) => {
    const { chore, house } = await choreForMember(ctx, choreId, ctx.viewer._id);
    if (assigneeId) await assertMember(ctx, house, assigneeId);
    await ctx.db.patch(chore._id, { assigneeId: assigneeId ?? undefined });
  },
});

/** Mark a chore done (or not) for this week, this month, or for good. */
export const setChoreDone = viewerMutation({
  args: { choreId: v.id("houseChores"), done: v.boolean() },
  handler: async (ctx, { choreId, done }) => {
    const viewerId = ctx.viewer._id;
    const { chore } = await choreForMember(ctx, choreId, viewerId);
    const period = periodOf(chore.cadence);
    const rows = await ctx.db
      .query("choreCompletions")
      .withIndex("by_chore", (q) => q.eq("choreId", chore._id).eq("period", period))
      .collect();
    if (done && rows.length === 0)
      await ctx.db.insert("choreCompletions", {
        choreId: chore._id,
        houseId: chore.houseId,
        period,
        userId: viewerId,
        doneAt: Date.now(),
      });
    if (!done) for (const r of rows) await ctx.db.delete(r._id);
  },
});

/** Remove a chore and its history. Removing one that's already gone does nothing. */
export const removeChore = viewerMutation({
  args: { choreId: v.id("houseChores") },
  handler: async (ctx, { choreId }) => {
    if (!(await ctx.db.get(choreId))) return;
    const { chore } = await choreForMember(ctx, choreId, ctx.viewer._id);
    const rows = await ctx.db
      .query("choreCompletions")
      .withIndex("by_chore", (q) => q.eq("choreId", chore._id))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.delete(chore._id);
  },
});

/* ───────────── Bills ───────────── */

async function billForMember(ctx: QueryCtx, billId: Id<"houseBills">, viewerId: Id<"users">) {
  const bill = await ctx.db.get(billId);
  if (!bill) throw new ConvexError("Bill not found");
  await requireHouseMember(ctx, bill.houseId, viewerId);
  return bill;
}

export const addBill = viewerMutation({
  args: {
    houseId: v.id("houses"),
    title: v.string(),
    amountCents: v.number(),
    dueDate: v.optional(v.string()),
    cadence: billCadence,
  },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const { house } = await requireHouseMember(ctx, args.houseId, viewerId);
    const title = fail(cleanTitle(args.title, undefined, "what the bill is for"));
    const problem = amountProblem(args.amountCents);
    if (problem) throw new ConvexError(problem);
    if (args.dueDate !== undefined && !isCalendarDate(args.dueDate))
      throw new ConvexError("Pick a real due date");
    if (args.cadence === "monthly" && args.dueDate === undefined)
      throw new ConvexError("Monthly bills need a due date");
    const open = await ctx.db
      .query("houseBills")
      .withIndex("by_house_paid", (q) => q.eq("houseId", house._id).eq("paidAt", undefined))
      .collect();
    if (open.length >= MAX_OPEN_BILLS)
      throw new ConvexError(`A house can have up to ${MAX_OPEN_BILLS} unpaid bills`);
    return ctx.db.insert("houseBills", {
      houseId: house._id,
      title,
      amountCents: args.amountCents,
      dueDate: args.dueDate,
      // A monthly bill keeps its day: due on the 31st, it's due on the 30th in
      // April and the 31st again in May.
      dueDay:
        args.cadence === "monthly" && args.dueDate ? Number(args.dueDate.slice(8)) : undefined,
      cadence: args.cadence,
      createdBy: viewerId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Mark a bill paid by the viewer, or not paid. Paying a monthly bill adds next
 * month's; un-paying removes that copy again unless someone already paid it.
 */
export const setBillPaid = viewerMutation({
  args: { billId: v.id("houseBills"), paid: v.boolean() },
  handler: async (ctx, { billId, paid }) => {
    const viewerId = ctx.viewer._id;
    const bill = await billForMember(ctx, billId, viewerId);
    const next = await ctx.db
      .query("houseBills")
      .withIndex("by_from", (q) => q.eq("fromBillId", bill._id))
      .first();
    if (paid) {
      if (bill.paidAt) return;
      await ctx.db.patch(bill._id, { paidBy: viewerId, paidAt: Date.now() });
      if (bill.cadence === "monthly" && bill.dueDate && !next)
        await ctx.db.insert("houseBills", {
          houseId: bill.houseId,
          title: bill.title,
          amountCents: bill.amountCents,
          dueDate: addMonth(bill.dueDate, bill.dueDay),
          dueDay: bill.dueDay,
          cadence: "monthly",
          fromBillId: bill._id,
          createdBy: bill.createdBy,
          createdAt: Date.now(),
        });
      return;
    }
    if (!bill.paidAt) return;
    await ctx.db.patch(bill._id, { paidBy: undefined, paidAt: undefined });
    if (next && !next.paidAt) await ctx.db.delete(next._id);
  },
});

/** Remove a bill. Removing one that's already gone (a double tap) does nothing. */
export const removeBill = viewerMutation({
  args: { billId: v.id("houseBills") },
  handler: async (ctx, { billId }) => {
    if (!(await ctx.db.get(billId))) return;
    const bill = await billForMember(ctx, billId, ctx.viewer._id);
    await ctx.db.delete(bill._id);
  },
});

/* ───────────── Groceries ───────────── */

async function groceryForMember(ctx: QueryCtx, itemId: Id<"groceryItems">, viewerId: Id<"users">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new ConvexError("Item not found");
  await requireHouseMember(ctx, item.houseId, viewerId);
  return item;
}

export const addGrocery = viewerMutation({
  args: { houseId: v.id("houses"), text: v.string() },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const { house } = await requireHouseMember(ctx, args.houseId, viewerId);
    const text = fail(cleanTitle(args.text, undefined, "an item"));
    const items = await ctx.db
      .query("groceryItems")
      .withIndex("by_house", (q) => q.eq("houseId", house._id))
      .collect();
    // Checked items count too, so the list (and every read of it) stays bounded.
    if (items.length >= MAX_GROCERIES)
      throw new ConvexError(
        `The list can hold up to ${MAX_GROCERIES} items. Clear checked items to make room.`,
      );
    return ctx.db.insert("groceryItems", {
      houseId: house._id,
      text,
      addedBy: viewerId,
      createdAt: Date.now(),
    });
  },
});

export const setGroceryChecked = viewerMutation({
  args: { itemId: v.id("groceryItems"), checked: v.boolean() },
  handler: async (ctx, { itemId, checked }) => {
    const viewerId = ctx.viewer._id;
    const item = await groceryForMember(ctx, itemId, viewerId);
    if (checked === Boolean(item.checkedAt)) return;
    await ctx.db.patch(
      item._id,
      checked
        ? { checkedBy: viewerId, checkedAt: Date.now() }
        : { checkedBy: undefined, checkedAt: undefined },
    );
  },
});

/** Remove an item. Removing one that's already gone does nothing. */
export const removeGrocery = viewerMutation({
  args: { itemId: v.id("groceryItems") },
  handler: async (ctx, { itemId }) => {
    if (!(await ctx.db.get(itemId))) return;
    const item = await groceryForMember(ctx, itemId, ctx.viewer._id);
    await ctx.db.delete(item._id);
  },
});

/** Clear the checked-off items. */
export const clearChecked = viewerMutation({
  args: { houseId: v.id("houses") },
  handler: async (ctx, { houseId }) => {
    const { house } = await requireHouseMember(ctx, houseId, ctx.viewer._id);
    const items = await ctx.db
      .query("groceryItems")
      .withIndex("by_house", (q) => q.eq("houseId", house._id))
      .collect();
    for (const i of items) if (i.checkedAt) await ctx.db.delete(i._id);
  },
});

/* ───────────── Seed ───────────── */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Maya, Ana and Hannah's place in Berkeley, from their "Roomies 🏠" chat:
 * rent ($1,250 each), the trash rotation, the wok left soaking.
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const byName = async (username: string) =>
      ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
    const [maya, ana, hannah] = await Promise.all([
      byName("maya.chen"),
      byName("ana.torres"),
      byName("hannah.lee"),
    ]);
    if (!maya || !ana || !hannah) return;
    const now = Date.now();
    const today = todayInSF(now);
    const name = "Dwight Way house";
    const groupId = await ctx.db.insert("groups", {
      name,
      slug: await slugFor(ctx, name),
      cover: COVER,
      privacy: "private",
      visible: false,
      description: "Our house: chores, bills and groceries are in Landing, under My Place.",
      category: "General",
      rules: [],
      tags: [],
      createdBy: ana._id,
      createdAt: now - 60 * DAY,
      externalMemberCount: 0,
      memberCount: 3,
      lastActivityAt: now - DAY,
    });
    for (const [i, u] of [ana, maya, hannah].entries())
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: u._id,
        role: i === 0 ? "admin" : "member",
        joinedAt: now - (60 - i) * DAY,
      });
    const houseId = await ctx.db.insert("houses", {
      groupId,
      createdBy: ana._id,
      createdAt: now - 60 * DAY,
    });

    const chore = (title: string, cadence: ChoreCadence, who: Doc<"users"> | null, ago: number) =>
      ctx.db.insert("houseChores", {
        houseId,
        title,
        cadence,
        assigneeId: who?._id,
        createdBy: ana._id,
        createdAt: now - ago * DAY,
      });
    const trash = await chore("Take the bins out (Tuesday night)", "weekly", hannah, 50);
    await chore("Dishes and wipe the counters", "weekly", maya, 50);
    await chore("Clean the bathroom", "weekly", ana, 50);
    const vacuum = await chore("Vacuum the living room", "monthly", maya, 40);
    await chore("Descale the kettle", "once", null, 3);
    // Hannah took the bins out this week; the vacuuming is done for the month.
    await ctx.db.insert("choreCompletions", {
      choreId: trash,
      houseId,
      period: periodOf("weekly", now),
      userId: hannah._id,
      doneAt: now - 2 * 60 * 60 * 1000,
    });
    await ctx.db.insert("choreCompletions", {
      choreId: vacuum,
      houseId,
      period: periodOf("monthly", now),
      userId: maya._id,
      doneAt: now - 30 * 60 * 1000,
    });

    const nextFirst = addMonth(`${today.slice(0, 8)}01`);
    const thisFirst = `${today.slice(0, 8)}01`;
    const rentPaid = await ctx.db.insert("houseBills", {
      houseId,
      title: "Rent",
      amountCents: 375_000,
      dueDate: thisFirst,
      dueDay: 1,
      cadence: "monthly",
      paidBy: ana._id,
      paidAt: now - 10 * DAY,
      createdBy: ana._id,
      createdAt: now - 45 * DAY,
    });
    await ctx.db.insert("houseBills", {
      houseId,
      title: "Rent",
      amountCents: 375_000,
      dueDate: nextFirst,
      dueDay: 1,
      cadence: "monthly",
      fromBillId: rentPaid,
      createdBy: ana._id,
      createdAt: now - 10 * DAY,
    });
    await ctx.db.insert("houseBills", {
      houseId,
      title: "PG&E",
      amountCents: 14_237,
      dueDate: `${nextFirst.slice(0, 8)}05`,
      cadence: "once",
      createdBy: maya._id,
      createdAt: now - 2 * DAY,
    });
    await ctx.db.insert("houseBills", {
      houseId,
      title: "Internet",
      amountCents: 6_500,
      dueDate: addDays(today, -2),
      cadence: "once",
      createdBy: hannah._id,
      createdAt: now - 20 * DAY,
    });

    const grocery = (text: string, who: Doc<"users">, ago: number, checkedBy?: Doc<"users">) =>
      ctx.db.insert("groceryItems", {
        houseId,
        text,
        addedBy: who._id,
        createdAt: now - ago * 60 * 60 * 1000,
        ...(checkedBy && { checkedBy: checkedBy._id, checkedAt: now - 60 * 60 * 1000 }),
      });
    await grocery("Oat milk", maya, 30);
    await grocery("Eggs (dozen)", hannah, 26);
    await grocery("Dish soap", ana, 20);
    await grocery("Trash bags", hannah, 8);
    await grocery("Jasmine rice", ana, 50, maya);
  },
});
