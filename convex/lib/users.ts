import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** `users.heartbeat` writes `lastActiveAt` at most this often. */
export const ACTIVE_WRITE_MS = 10 * 60 * 1000;
/** Online: active within this window, longer than the heartbeat's write interval. */
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

/** The public shape of a user that every surface renders (avatar + name chips). */
export function userSummary(u: Doc<"users">) {
  return {
    _id: u._id,
    name: u.name,
    firstName: u.firstName,
    username: u.username,
    avatar: u.avatar,
    verified: u.verified,
    kind: u.kind ?? "person",
    online: isOnline(u),
    lastActiveAt: u.lastActiveAt,
  };
}
export type UserSummary = ReturnType<typeof userSummary>;

/** Online now; never for someone who turned off active status. */
export function isOnline(u: Doc<"users">) {
  if (u.activeStatusOff) return false;
  return Boolean(u.alwaysOnline) || Date.now() - u.lastActiveAt < ONLINE_WINDOW_MS;
}

/**
 * Guests (`demo.start` makes one per browser, `users.isDemo`) are private to
 * themselves: other viewers never see them listed among a Group's members, an
 * Event's guests or a neighborhood's people. Seeded personas never set
 * `isDemo`, so they stay visible.
 */
export function hiddenFrom(u: Doc<"users">, viewerId: Id<"users">) {
  return u.isDemo === true && u._id !== viewerId;
}

const LISTABLE_BATCH = 100;

/**
 * The users among `ids` the viewer may see listed (`hiddenFrom`), in order,
 * missing ones dropped. Stops reading once `limit` are found, so guests ahead
 * in the order don't use up a caller's budget.
 */
export async function listable(
  ctx: QueryCtx,
  ids: readonly Id<"users">[],
  viewerId: Id<"users">,
  limit = Number.POSITIVE_INFINITY,
): Promise<Doc<"users">[]> {
  const unique = [...new Set(ids)];
  const out: Doc<"users">[] = [];
  for (let i = 0; i < unique.length && out.length < limit; i += LISTABLE_BATCH) {
    const docs = await Promise.all(unique.slice(i, i + LISTABLE_BATCH).map((id) => ctx.db.get(id)));
    for (const d of docs) if (d && !hiddenFrom(d, viewerId) && out.length < limit) out.push(d);
  }
  return out;
}

export async function getSummaries(ctx: QueryCtx, ids: Id<"users">[]) {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"users">, UserSummary>();
  for (const d of docs) if (d) map.set(d._id, userSummary(d));
  return map;
}

export async function getSummary(ctx: QueryCtx, id: Id<"users">) {
  const u = await ctx.db.get(id);
  return u ? userSummary(u) : null;
}

export async function friendIds(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("friendships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.map((r) => r.friendId);
}

export async function areFriends(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const row = await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("userId", a).eq("friendId", b))
    .unique();
  return row !== null;
}

export async function mutualFriendIds(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const [fa, fb] = await Promise.all([friendIds(ctx, a), friendIds(ctx, b)]);
  const setB = new Set(fb);
  return fa.filter((id) => setB.has(id));
}
