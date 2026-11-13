import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBlockedEitherWay } from "./blocks";
import { MAX_HOUSES_PER_PERSON, MAX_PENDING_INVITES } from "./house";
import { notify } from "./notify";
import { friendIds } from "./users";

/**
 * Who may see and change a house (#38). A house is a Facebook Group marked by
 * a `houses` row; the people who live there are its `groupMembers`, read live
 * so leaving the Group ends access at once. House Groups are invite-only: the
 * hooks here keep the clone's Group functions (`groups.get`, `join`,
 * `invite`, `declineInvite`, `members`, `events`, `inviteCandidates`) and
 * Marketplace's group lists honest about them.
 *
 * An invite stands only while whoever sent it still lives there and neither
 * has blocked the other. Every check below uses that one rule.
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

async function isMemberOf(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users">) {
  const row = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
  return row !== null;
}

export async function isHouseMember(ctx: QueryCtx, house: Doc<"houses">, userId: Id<"users">) {
  return isMemberOf(ctx, house.groupId, userId);
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

/** How many houses `userId` lives in. */
export async function houseCount(ctx: QueryCtx, userId: Id<"users">) {
  const mine = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let n = 0;
  for (const m of mine) if (await houseOfGroup(ctx, m.groupId)) n++;
  return n;
}

/* ───────────── Invites ───────────── */

/** Whether an invite still stands: its sender lives there and neither blocked the other. */
async function stands(ctx: QueryCtx, house: Doc<"houses">, invite: Doc<"houseInvites">) {
  return (
    (await isHouseMember(ctx, house, invite.invitedBy)) &&
    !(await isBlockedEitherWay(ctx, invite.userId, invite.invitedBy))
  );
}

/** `userId`'s standing invite to a house, if any (the newest). */
export async function standingInvite(
  ctx: QueryCtx,
  house: Doc<"houses">,
  userId: Id<"users">,
): Promise<Doc<"houseInvites"> | null> {
  const rows = await ctx.db
    .query("houseInvites")
    .withIndex("by_house_user", (q) => q.eq("houseId", house._id).eq("userId", userId))
    .collect();
  for (const r of rows.reverse()) if (await stands(ctx, house, r)) return r;
  return null;
}

/** Everyone with a standing invite to a house, once each, who doesn't live there. */
export async function invitedIds(ctx: QueryCtx, house: Doc<"houses">): Promise<Id<"users">[]> {
  const rows = await ctx.db
    .query("houseInvites")
    .withIndex("by_house_user", (q) => q.eq("houseId", house._id))
    .collect();
  const out = new Set<Id<"users">>();
  for (const r of rows) {
    if (out.has(r.userId) || (await isHouseMember(ctx, house, r.userId))) continue;
    if (await stands(ctx, house, r)) out.add(r.userId);
  }
  return [...out];
}

async function dropInvites(ctx: MutationCtx, house: Doc<"houses">, userId: Id<"users">) {
  const rows = await ctx.db
    .query("houseInvites")
    .withIndex("by_house_user", (q) => q.eq("houseId", house._id).eq("userId", userId))
    .collect();
  for (const r of rows) await ctx.db.delete(r._id);
}

/** The invite notifications a person got for a Group. */
async function inviteNotices(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(300);
  return rows.filter((n) => n.kind === "group_invite" && n.groupId === groupId);
}

/** Withdraw `userId`'s invites to a house, notifications included. */
export async function withdrawInvites(ctx: MutationCtx, house: Doc<"houses">, userId: Id<"users">) {
  await dropInvites(ctx, house, userId);
  for (const n of await inviteNotices(ctx, house.groupId, userId)) await ctx.db.delete(n._id);
}

/** Throws unless everyone in `ids` is a friend of the inviter with no block either way. */
export async function assertCanInvite(
  ctx: QueryCtx,
  inviterId: Id<"users">,
  ids: readonly Id<"users">[],
) {
  if (ids.length === 0) return;
  const friends = new Set(await friendIds(ctx, inviterId));
  for (const id of ids)
    if (id !== inviterId && (!friends.has(id) || (await isBlockedEitherWay(ctx, inviterId, id))))
      throw new ConvexError("You can invite your friends");
}

/**
 * Invite people to a house: friends of the inviter only, no block either way,
 * at most `MAX_PENDING_INVITES` standing at once. People who live there or
 * already hold a standing invite are skipped; a stale invite (its sender
 * moved out, or a block) is replaced. Returns who was newly invited.
 *
 * `strict` throws on someone who can't be invited (Landing's own form);
 * otherwise they're skipped (the clone's Group invite dialog).
 */
export async function inviteToHouse(
  ctx: MutationCtx,
  house: Doc<"houses">,
  group: Doc<"groups">,
  inviterId: Id<"users">,
  ids: readonly Id<"users">[],
  strict: boolean,
): Promise<Id<"users">[]> {
  const friends = new Set(await friendIds(ctx, inviterId));
  const fresh: Id<"users">[] = [];
  for (const id of new Set(ids)) {
    if (id === inviterId || (await isHouseMember(ctx, house, id))) continue;
    if (!friends.has(id) || (await isBlockedEitherWay(ctx, inviterId, id))) {
      if (strict) throw new ConvexError("You can invite your friends");
      continue;
    }
    if (await standingInvite(ctx, house, id)) continue;
    fresh.push(id);
  }
  const pending = (await invitedIds(ctx, house)).length;
  if (pending + fresh.length > MAX_PENDING_INVITES) {
    if (strict) throw new ConvexError(`A house can have up to ${MAX_PENDING_INVITES} open invites`);
    fresh.splice(Math.max(0, MAX_PENDING_INVITES - pending));
  }
  const now = Date.now();
  for (const userId of fresh) {
    await dropInvites(ctx, house, userId);
    await ctx.db.insert("houseInvites", {
      houseId: house._id,
      userId,
      invitedBy: inviterId,
      createdAt: now,
    });
    await notify(ctx, {
      userId,
      actorId: inviterId,
      kind: "group_invite",
      text: `invited you to join ${group.name}.`,
      groupId: group._id,
    });
  }
  return fresh;
}

/* ───────────── Hooks for the clone's Group functions ───────────── */

/**
 * For `groups.join`: a House Group admits only someone with a standing invite
 * who isn't in too many houses already; joining uses the invite up. Other
 * Groups are untouched.
 */
export async function admitToHouse(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">) {
  const house = await houseOfGroup(ctx, groupId);
  if (!house) return;
  if (!(await standingInvite(ctx, house, userId)))
    throw new ConvexError(
      "This House Group is invite-only. Ask someone who lives there to invite you.",
    );
  if ((await houseCount(ctx, userId)) >= MAX_HOUSES_PER_PERSON)
    throw new ConvexError(`You can be in up to ${MAX_HOUSES_PER_PERSON} houses`);
  await dropInvites(ctx, house, userId);
}

/**
 * For `groups.invite`: a House Group's invites follow the house's rules
 * (`inviteToHouse`), and are sent there. True when the Group is a house, so
 * the caller sends nothing itself.
 */
export async function inviteThroughHouse(
  ctx: MutationCtx,
  group: Doc<"groups">,
  inviterId: Id<"users">,
  ids: readonly Id<"users">[],
): Promise<boolean> {
  const house = await houseOfGroup(ctx, group._id);
  if (!house) return false;
  await inviteToHouse(ctx, house, group, inviterId, ids, false);
  return true;
}

/** For `groups.declineInvite`: declining a House Group's invite withdraws the house invite too. */
export async function declineHouseInvite(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
) {
  const house = await houseOfGroup(ctx, groupId);
  if (house) await dropInvites(ctx, house, userId);
}

/**
 * For `groups.get` and the Group page's other queries: a House Group shows
 * only to the people who live there and those with a standing invite (or,
 * with `membersOnly`, only to the people who live there). Other Groups are
 * untouched.
 */
export async function canSeeGroupAsHouse(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
  membersOnly = false,
): Promise<boolean> {
  const house = await houseOfGroup(ctx, groupId);
  if (!house) return true;
  if (await isHouseMember(ctx, house, userId)) return true;
  return !membersOnly && (await standingInvite(ctx, house, userId)) !== null;
}

/** Like `canSeeGroupAsHouse`, throwing "Group not found" (as for a missing Group). */
export async function assertCanSeeGroupAsHouse(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
  membersOnly = false,
) {
  if (!(await canSeeGroupAsHouse(ctx, groupId, userId, membersOnly)))
    throw new ConvexError("Group not found");
}

/**
 * A listing's extra Groups without any House Group: a house is never a
 * Marketplace place to sell to strangers. Undefined when none are left.
 */
export async function listableGroupIds(
  ctx: QueryCtx,
  groupIds: readonly Id<"groups">[] | undefined,
): Promise<Id<"groups">[] | undefined> {
  const out: Id<"groups">[] = [];
  for (const id of groupIds ?? []) if (!(await houseOfGroup(ctx, id))) out.push(id);
  return out.length > 0 ? out : undefined;
}
