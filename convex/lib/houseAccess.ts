import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Who may see and change a house (#38). A house is a Facebook Group marked by
 * a `houses` row; the people who live there are its `groupMembers`, read live
 * so leaving the Group ends access at once. House Groups are invite-only: the
 * hooks here keep `groups.join`, `groups.invite` and `groups.get` honest.
 */

export async function houseOfGroup(
  ctx: QueryCtx,
  groupId: Id<"groups">,
): Promise<Doc<"houses"> | null> {
  return ctx.db
    .query("houses")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .unique();
}

export async function isHouseMember(ctx: QueryCtx, house: Doc<"houses">, userId: Id<"users">) {
  const row = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", house.groupId).eq("userId", userId))
    .unique();
  return row !== null;
}

/** The house and its Group, if `userId` lives there; otherwise "House not found". */
export async function requireHouseMember(
  ctx: QueryCtx,
  houseId: Id<"houses">,
  userId: Id<"users">,
): Promise<{ house: Doc<"houses">; group: Doc<"groups"> }> {
  const house = await ctx.db.get(houseId);
  const group = house && (await ctx.db.get(house.groupId));
  if (!house || !group || !(await isHouseMember(ctx, house, userId)))
    throw new ConvexError("House not found");
  return { house, group };
}

/** The people who live in a house, in the order they joined. */
export async function houseMemberIds(ctx: QueryCtx, house: Doc<"houses">): Promise<Id<"users">[]> {
  const rows = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", house.groupId))
    .collect();
  return rows.map((r) => r.userId);
}

/** Everyone who shares a house with `userId` (not them). For #39 and #40. */
export async function houseMateIds(ctx: QueryCtx, userId: Id<"users">): Promise<Id<"users">[]> {
  const mine = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const out = new Set<Id<"users">>();
  for (const m of mine) {
    const house = await houseOfGroup(ctx, m.groupId);
    if (!house) continue;
    for (const id of await houseMemberIds(ctx, house)) if (id !== userId) out.add(id);
  }
  return [...out];
}

export async function inviteFor(ctx: QueryCtx, houseId: Id<"houses">, userId: Id<"users">) {
  return ctx.db
    .query("houseInvites")
    .withIndex("by_house_user", (q) => q.eq("houseId", houseId).eq("userId", userId))
    .first();
}

/**
 * For `groups.join`: a House Group admits only people with an invite, and
 * joining uses the invite up. Other Groups are untouched.
 */
export async function admitToHouse(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">) {
  const house = await houseOfGroup(ctx, groupId);
  if (!house) return;
  const invites = await ctx.db
    .query("houseInvites")
    .withIndex("by_house_user", (q) => q.eq("houseId", house._id).eq("userId", userId))
    .collect();
  if (invites.length === 0)
    throw new ConvexError(
      "This House Group is invite-only. Ask someone who lives there to invite you.",
    );
  for (const i of invites) await ctx.db.delete(i._id);
}

/** For `groups.invite`: inviting someone to a House Group records the house invite too. */
export async function recordHouseInvite(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
  invitedBy: Id<"users">,
) {
  const house = await houseOfGroup(ctx, groupId);
  if (!house || (await inviteFor(ctx, house._id, userId))) return;
  await ctx.db.insert("houseInvites", {
    houseId: house._id,
    userId,
    invitedBy,
    createdAt: Date.now(),
  });
}

/**
 * For `groups.get`: a House Group is shown only to the people who live there
 * and the people invited. Other Groups are untouched.
 */
export async function canSeeGroupAsHouse(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
): Promise<boolean> {
  const house = await houseOfGroup(ctx, groupId);
  if (!house) return true;
  return (
    (await isHouseMember(ctx, house, userId)) || (await inviteFor(ctx, house._id, userId)) !== null
  );
}
