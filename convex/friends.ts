import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { blockedSet, isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { settingsRow, visibleDetails, visibleFriendIds } from "./lib/settings";
import { areFriends, friendIds, type UserSummary, userSummary } from "./lib/users";

/** How the viewer relates to another user; drives every friend button. */
export type Relation = "self" | "friend" | "outgoing" | "incoming" | "none";

export async function relationTo(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  userId: Id<"users">,
): Promise<Relation> {
  if (viewerId === userId) return "self";
  if (await areFriends(ctx, viewerId, userId)) return "friend";
  const [out, inc] = await Promise.all([
    pendingRequest(ctx, viewerId, userId),
    pendingRequest(ctx, userId, viewerId),
  ]);
  if (out) return "outgoing";
  if (inc) return "incoming";
  return "none";
}

function pendingRequest(ctx: QueryCtx, fromId: Id<"users">, toId: Id<"users">) {
  return ctx.db
    .query("friendRequests")
    .withIndex("by_pair", (q) => q.eq("fromId", fromId).eq("toId", toId))
    .first();
}

/** A person tile/row: the user chip plus mutual friends with the viewer. */
export type PersonCard = UserSummary & {
  mutualCount: number;
  /** Up to two mutual friends, for the little avatar stack. */
  mutuals: UserSummary[];
};

/** Builds person cards, computing mutual friends against the viewer's friend set. */
export async function personCards(
  ctx: QueryCtx,
  viewerFriends: Set<Id<"users">>,
  users: Doc<"users">[],
): Promise<PersonCard[]> {
  const mutualIds = await Promise.all(
    users.map(async (u) => (await friendIds(ctx, u._id)).filter((id) => viewerFriends.has(id))),
  );
  const sampleIds = [...new Set(mutualIds.flatMap((ids) => ids.slice(0, 2)))];
  const samples = new Map<Id<"users">, UserSummary>();
  for (const d of await Promise.all(sampleIds.map((id) => ctx.db.get(id))))
    if (d) samples.set(d._id, userSummary(d));
  return users.map((u, i) => ({
    ...userSummary(u),
    mutualCount: mutualIds[i].length,
    mutuals: mutualIds[i]
      .slice(0, 2)
      .map((id) => samples.get(id))
      .filter((s): s is UserSummary => !!s),
  }));
}

/** Settings → "Who can send you friend requests?" is "Friends of friends". */
async function requestsLimited(ctx: QueryCtx, userId: Id<"users">) {
  return (await settingsRow(ctx, userId))?.friendRequests === "friends_of_friends";
}

async function docs(ctx: QueryCtx, ids: Id<"users">[]) {
  const out = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return out.filter((u): u is Doc<"users"> => u !== null);
}

/* ---------------- Queries ---------------- */

export const relation = viewerQuery({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => relationTo(ctx, ctx.viewer._id, userId),
});

/** Live counts for badges and rail rows. */
export const counts = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const [incoming, friends] = await Promise.all([
      ctx.db
        .query("friendRequests")
        .withIndex("by_to", (q) => q.eq("toId", ctx.viewer._id))
        .collect(),
      friendIds(ctx, ctx.viewer._id),
    ]);
    return { requests: incoming.length, friends: friends.length };
  },
});

/** Incoming friend requests, newest first. */
export const requests = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", (q) => q.eq("toId", ctx.viewer._id))
      .order("desc")
      .collect();
    const friends = new Set(await friendIds(ctx, ctx.viewer._id));
    const cards = await personCards(
      ctx,
      friends,
      await docs(
        ctx,
        rows.map((r) => r.fromId),
      ),
    );
    const at = new Map(rows.map((r) => [r.fromId, r.createdAt]));
    return cards.map((c) => ({ ...c, requestedAt: at.get(c._id) ?? 0 }));
  },
});

/** Requests the viewer sent that are still pending. */
export const sentRequests = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", (q) => q.eq("fromId", ctx.viewer._id))
      .order("desc")
      .collect();
    const friends = new Set(await friendIds(ctx, ctx.viewer._id));
    const cards = await personCards(
      ctx,
      friends,
      await docs(
        ctx,
        rows.map((r) => r.toId),
      ),
    );
    const at = new Map(rows.map((r) => [r.toId, r.createdAt]));
    return cards.map((c) => ({ ...c, requestedAt: at.get(c._id) ?? 0 }));
  },
});

/**
 * People you may know: everyone who isn't already a friend or in a pending
 * request, ranked by mutual friends.
 */
export const suggestions = viewerQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewerId = ctx.viewer._id;
    const [friends, incoming, outgoing, everyone, blocked] = await Promise.all([
      friendIds(ctx, viewerId),
      ctx.db
        .query("friendRequests")
        .withIndex("by_to", (q) => q.eq("toId", viewerId))
        .collect(),
      ctx.db
        .query("friendRequests")
        .withIndex("by_from", (q) => q.eq("fromId", viewerId))
        .collect(),
      ctx.db.query("users").collect(),
      blockedSet(ctx, viewerId),
    ]);
    const friendSet = new Set(friends);
    const exclude = new Set<Id<"users">>([
      viewerId,
      ...blocked,
      ...friends,
      ...incoming.map((r) => r.fromId),
      ...outgoing.map((r) => r.toId),
    ]);
    const candidates = everyone.filter(
      (u) => (u.kind ?? "person") === "person" && !exclude.has(u._id),
    );
    const cards = await personCards(ctx, friendSet, candidates);
    cards.sort((a, b) => b.mutualCount - a.mutualCount || a.name.localeCompare(b.name));
    // Skip people who only take requests from friends of friends when there's no mutual friend.
    const out: PersonCard[] = [];
    for (const c of cards) {
      if (out.length >= (limit ?? 40)) break;
      if (c.mutualCount === 0 && (await requestsLimited(ctx, c._id))) continue;
      out.push(c);
    }
    return out;
  },
});

/**
 * A user's friends as the viewer sees them: mutual counts, how each relates
 * to the viewer, and the fields the profile Friends tab filters on.
 */
export const list = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const viewerFriends = new Set(await friendIds(ctx, viewerId));
    const users = await docs(
      ctx,
      await visibleFriendIds(
        ctx,
        userId,
        viewerId,
        rows.map((r) => r.friendId),
        viewerFriends,
        await blockedSet(ctx, viewerId),
      ),
    );
    const cards = await personCards(ctx, viewerFriends, users);
    const since = new Map(rows.map((r) => [r.friendId, r.createdAt]));
    const byId = new Map(users.map((u) => [u._id, u]));
    const [incoming, outgoing] = await Promise.all([
      ctx.db
        .query("friendRequests")
        .withIndex("by_to", (q) => q.eq("toId", viewerId))
        .collect(),
      ctx.db
        .query("friendRequests")
        .withIndex("by_from", (q) => q.eq("fromId", viewerId))
        .collect(),
    ]);
    const inc = new Set(incoming.map((r) => r.fromId));
    const out = new Set(outgoing.map((r) => r.toId));
    return Promise.all(
      cards.map(async (c) => {
        const u = byId.get(c._id);
        // City, hometown, birthday, work and school each follow that person's audience.
        const d = u ? await visibleDetails(ctx, u, viewerId, viewerFriends.has(c._id)) : null;
        const relation: Relation =
          c._id === viewerId
            ? "self"
            : viewerFriends.has(c._id)
              ? "friend"
              : out.has(c._id)
                ? "outgoing"
                : inc.has(c._id)
                  ? "incoming"
                  : "none";
        return {
          ...c,
          relation,
          friendsSince: since.get(c._id) ?? 0,
          city: d?.city ?? null,
          hometown: d?.hometown ?? null,
          birthday: d?.birthday ?? null,
          work: d?.work[0] ?? null,
          school: d?.education[0]?.school ?? null,
        };
      }),
    );
  },
});

/* ---------------- Mutations ---------------- */

async function deleteRequestNotification(ctx: MutationCtx, toId: Id<"users">, fromId: Id<"users">) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", toId))
    .order("desc")
    .take(200);
  for (const n of rows)
    if (n.kind === "friend_request" && n.actorId === fromId) await ctx.db.delete(n._id);
}

async function befriend(ctx: MutationCtx, a: Id<"users">, b: Id<"users">) {
  if (await areFriends(ctx, a, b)) return;
  const now = Date.now();
  await ctx.db.insert("friendships", { userId: a, friendId: b, createdAt: now });
  await ctx.db.insert("friendships", { userId: b, friendId: a, createdAt: now });
}

async function targetPerson(ctx: MutationCtx, userId: Id<"users">, viewerId: Id<"users">) {
  if (userId === viewerId) throw new ConvexError("You can't friend yourself");
  const u = await ctx.db.get(userId);
  if (!u) throw new ConvexError("This person isn't available");
  if (u.kind === "page") throw new ConvexError("Pages can't be added as friends");
  return u;
}

/** Add friend. If they already asked the viewer, this confirms instead. */
export const sendRequest = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const target = await targetPerson(ctx, userId, viewerId);
    if (await isBlockedEitherWay(ctx, viewerId, userId))
      throw new ConvexError("This person isn't available right now.");
    if (await areFriends(ctx, viewerId, userId)) return "friend" as const;
    if (await pendingRequest(ctx, viewerId, userId)) return "outgoing" as const;
    const incoming = await pendingRequest(ctx, userId, viewerId);
    if (incoming) {
      await ctx.db.delete(incoming._id);
      await deleteRequestNotification(ctx, viewerId, userId);
      await befriend(ctx, viewerId, userId);
      await notify(ctx, {
        userId,
        actorId: viewerId,
        kind: "friend_accept",
        text: "accepted your friend request.",
      });
      return "friend" as const;
    }
    if (await requestsLimited(ctx, userId)) {
      const theirs = await friendIds(ctx, userId);
      const mine = new Set(await friendIds(ctx, viewerId));
      if (!theirs.some((id) => mine.has(id)))
        throw new ConvexError(
          `${target.firstName} only accepts friend requests from friends of friends.`,
        );
    }
    await ctx.db.insert("friendRequests", {
      fromId: viewerId,
      toId: userId,
      createdAt: Date.now(),
    });
    await notify(ctx, {
      userId,
      actorId: viewerId,
      kind: "friend_request",
      text: "sent you a friend request.",
    });
    return "outgoing" as const;
  },
});

/** Cancel request: withdraws the viewer's pending request and its notification. */
export const cancelRequest = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const req = await pendingRequest(ctx, viewerId, userId);
    if (!req) return;
    await ctx.db.delete(req._id);
    await deleteRequestNotification(ctx, userId, viewerId);
  },
});

/** Confirm an incoming request. */
export const acceptRequest = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const req = await pendingRequest(ctx, userId, viewerId);
    if (!req) return;
    await ctx.db.delete(req._id);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(200);
    for (const n of rows)
      if (n.kind === "friend_request" && n.actorId === userId)
        await ctx.db.patch(n._id, { read: true, seen: true });
    await befriend(ctx, viewerId, userId);
    await notify(ctx, {
      userId,
      actorId: viewerId,
      kind: "friend_accept",
      text: "accepted your friend request.",
    });
  },
});

/** Delete an incoming request. The sender isn't told, as on Facebook. */
export const declineRequest = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const req = await pendingRequest(ctx, userId, viewerId);
    if (!req) return;
    await ctx.db.delete(req._id);
    await deleteRequestNotification(ctx, viewerId, userId);
  },
});

/** Unfriend removes both directions of the friendship. */
export const unfriend = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    for (const [a, b] of [
      [viewerId, userId],
      [userId, viewerId],
    ] as const) {
      const row = await ctx.db
        .query("friendships")
        .withIndex("by_pair", (q) => q.eq("userId", a).eq("friendId", b))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
  },
});
