import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { VouchRelationship } from "../validators";
import { blockedSet, isBlockedEitherWay } from "./blocks";
import { notify } from "./notify";
import { getSummaries, type UserSummary } from "./users";

/**
 * Network vouching: how the viewer is connected to a lister, and who in the
 * viewer's network vouches for them.
 *
 * - Only vouches from the viewer's network count: their own, their friends' and
 *   friends of friends'. Vouches from anyone else are never shown or counted to
 *   that viewer, so made-up accounts can't make a lister look trusted. The
 *   subject sees every vouch for themselves.
 * - The only friendships revealed are mutual friends, which every profile
 *   already shows. Anyone blocked either way with the viewer is left out.
 * - No score, so nothing to cite: each signal names the people behind it.
 *
 * Read vouches through `listerNetwork`, and write them through
 * `saveVouch` and `removeVouch`, never the table directly.
 */

export const VOUCH_NOTE_MAX = 280;
/*
 * Read limits for `listerNetwork`, chosen so one query stays well inside
 * Convex's per-transaction limits (documents read, index ranges, concurrency).
 */
/** A subject's newest vouches read in one range. */
export const VOUCH_SCAN_MAX = 1000;
/** Past VOUCH_SCAN_MAX, friends' vouches are looked up one by one only up to this many friends. */
export const FRIEND_LOOKUP_MAX = 200;
/** Friends-of-friends vouches placed per read, newest first (one friend-list read each). */
export const FOF_SCAN_MAX = 100;
/** Friendship rows read to place those vouchers. */
export const FRIEND_READ_BUDGET = 4000;
/** Friend-list rows read for the viewer and the subject. */
export const FRIENDS_READ_MAX = 5000;
/** Vouches returned; the rest are counted in `vouchTotal`. */
export const VOUCHES_SHOWN = 50;
/** People listed per group (mutual friends, a vouch's bridges); the rest are counted. */
export const MUTUALS_SHOWN = 10;
export const BRIDGES_SHOWN = 3;

/** The viewer's connection to the subject. */
export type Relation = "you" | "friend" | "friend_of_friend" | "none";
/** The voucher's connection to the viewer. `other` is only shown to the subject. */
export type Via = "you" | "friend" | "friend_of_friend" | "other";

type UserId = Id<"users">;

/* ---------- Pure graph logic ---------- */

/** Who in `ids` is also in `set`, skipping anyone blocked. Keeps the order of `ids`. */
export function intersect(
  ids: readonly UserId[],
  set: ReadonlySet<UserId>,
  blocked: ReadonlySet<UserId>,
): UserId[] {
  return [...new Set(ids)].filter((id) => set.has(id) && !blocked.has(id));
}

export function relationTo(
  viewerId: UserId,
  subjectId: UserId,
  viewerFriends: ReadonlySet<UserId>,
  mutualCount: number,
): Relation {
  if (viewerId === subjectId) return "you";
  if (viewerFriends.has(subjectId)) return "friend";
  return mutualCount > 0 ? "friend_of_friend" : "none";
}

/**
 * The voucher's connection to the viewer. `bridges` are the viewer's friends
 * who are friends with the voucher (already without blocked people).
 */
export function voucherVia(
  viewerId: UserId,
  voucherId: UserId,
  viewerFriends: ReadonlySet<UserId>,
  bridges: readonly UserId[],
): Via {
  if (voucherId === viewerId) return "you";
  if (viewerFriends.has(voucherId)) return "friend";
  return bridges.length > 0 ? "friend_of_friend" : "other";
}

const VIA_ORDER: Record<Via, number> = { you: 0, friend: 1, friend_of_friend: 2, other: 3 };

/** Closest first (you, friends, friends of friends, others), then most recent. */
export function byCloseness(
  a: { via: Via; updatedAt: number },
  b: { via: Via; updatedAt: number },
) {
  return VIA_ORDER[a.via] - VIA_ORDER[b.via] || b.updatedAt - a.updatedAt;
}

/** Trimmed note with whitespace collapsed, or undefined when empty. Throws when too long. */
export function cleanNote(note: string | undefined): string | undefined {
  const text = note?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.length > VOUCH_NOTE_MAX)
    throw new ConvexError(`Keep your note under ${VOUCH_NOTE_MAX} characters`);
  return text;
}

/* ---------- Reads ---------- */

export type NetworkVouch = {
  voucher: UserSummary;
  relationship: VouchRelationship;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  via: Via;
  /** The viewer's friends who connect them to a friend-of-friends voucher. */
  bridges: UserSummary[];
  bridgeCount: number;
};

export type ListerNetwork = {
  relation: Relation;
  /** Friends the viewer and subject share (none when the viewer is the subject). */
  mutualFriends: UserSummary[];
  mutualFriendCount: number;
  /** Vouches the viewer may see, closest first, at most VOUCHES_SHOWN. */
  vouches: NetworkVouch[];
  /** All vouches found that the viewer may see, including ones past VOUCHES_SHOWN. */
  vouchTotal: number;
  /** Older vouches from friends of friends (or, for the subject, anyone) weren't checked. */
  partial: boolean;
};

/** Friend ids, at most `max` (Facebook caps friend lists at 5,000). */
async function friendsOf(ctx: QueryCtx, userId: UserId, max = FRIENDS_READ_MAX) {
  const rows = await ctx.db
    .query("friendships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(max);
  return rows.map((r) => r.friendId);
}

type Placed = { row: Doc<"vouches">; via: Via; bridges: UserId[] };

/**
 * The subject's connection to the viewer's network, as the viewer may see it.
 * Null when they're blocked either way.
 *
 * Reads are bounded so the query stays inside Convex's limits whatever the
 * graph looks like:
 * - The subject's newest VOUCH_SCAN_MAX vouches are read in one range. The
 *   viewer's own vouch and their friends' among them are placed in memory.
 * - If the subject has more vouches than that, the viewer's own vouch is looked
 *   up directly, and so are their friends' when they have at most
 *   FRIEND_LOOKUP_MAX friends, so outsider vouches can't hide them.
 * - Friends of friends' vouches (and, for the subject, everyone else's) are
 *   placed newest first, at most FOF_SCAN_MAX of them within
 *   FRIEND_READ_BUDGET friendship rows.
 * `partial` says when some vouches weren't checked.
 */
export async function listerNetwork(
  ctx: QueryCtx,
  viewerId: UserId,
  subjectId: UserId,
): Promise<ListerNetwork | null> {
  const isSubject = viewerId === subjectId;
  const [blocked, viewerFriendList, subjectFriends, subjectBlocked, recent] = await Promise.all([
    blockedSet(ctx, viewerId),
    friendsOf(ctx, viewerId),
    isSubject ? [] : friendsOf(ctx, subjectId),
    isSubject ? null : blockedSet(ctx, subjectId),
    ctx.db
      .query("vouches")
      .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
      .order("desc")
      .take(VOUCH_SCAN_MAX + 1),
  ]);
  if (blocked.has(subjectId)) return null;
  const viewerFriends = new Set(viewerFriendList);
  const mutual = intersect(subjectFriends, viewerFriends, blocked);
  // A block between voucher and subject after vouching voids the vouch.
  const voided = (voucherId: UserId) =>
    blocked.has(voucherId) || (subjectBlocked ?? blocked).has(voucherId);
  const isDirect = (id: UserId) => id === viewerId || viewerFriends.has(id);

  const complete = recent.length <= VOUCH_SCAN_MAX;
  const scanned = recent.slice(0, VOUCH_SCAN_MAX);
  // Past the scan, older friends-of-friends vouches go unchecked.
  let partial = !complete;

  // 1. The viewer's own vouch and their friends'.
  const direct = scanned.filter((row) => isDirect(row.voucherId));
  if (!complete) {
    const seen = new Set(direct.map((row) => row.voucherId));
    const lookFor =
      viewerFriends.size <= FRIEND_LOOKUP_MAX ? [viewerId, ...viewerFriends] : [viewerId];
    const found = await Promise.all(
      lookFor.filter((id) => !seen.has(id)).map((id) => vouchBy(ctx, id, subjectId)),
    );
    for (const row of found) if (row) direct.push(row);
  }
  const placed: Placed[] = direct
    .filter((row) => !voided(row.voucherId))
    .map((row) => ({ row, via: row.voucherId === viewerId ? "you" : "friend", bridges: [] }));

  // 2. Everyone else, newest first, within the scan and read budgets.
  const others = scanned.filter((row) => !isDirect(row.voucherId) && !voided(row.voucherId));
  if (others.length > FOF_SCAN_MAX) partial = true;
  let budget = FRIEND_READ_BUDGET;
  for (const row of others.slice(0, FOF_SCAN_MAX)) {
    const friendRows = await friendsOf(ctx, row.voucherId, budget + 1);
    if (friendRows.length > budget) {
      partial = true;
      break;
    }
    budget -= friendRows.length;
    const bridges = intersect(friendRows, viewerFriends, blocked);
    const via = voucherVia(viewerId, row.voucherId, viewerFriends, bridges);
    if (via !== "other" || isSubject) placed.push({ row, via, bridges });
  }
  placed.sort((a, b) =>
    byCloseness(
      { via: a.via, updatedAt: a.row.updatedAt },
      { via: b.via, updatedAt: b.row.updatedAt },
    ),
  );
  const shown = placed.slice(0, VOUCHES_SHOWN);

  const people = await getSummaries(ctx, [
    ...mutual.slice(0, MUTUALS_SHOWN),
    ...shown.flatMap((p) => [p.row.voucherId, ...p.bridges.slice(0, BRIDGES_SHOWN)]),
  ]);
  const summaries = (ids: readonly UserId[]) =>
    ids.flatMap((id) => {
      const s = people.get(id);
      return s ? [s] : [];
    });

  const vouches = shown.flatMap(({ row, via, bridges }): NetworkVouch[] => {
    const voucher = people.get(row.voucherId);
    if (!voucher) return [];
    return [
      {
        voucher,
        relationship: row.relationship,
        note: row.note ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        via,
        bridges: summaries(bridges.slice(0, BRIDGES_SHOWN)),
        bridgeCount: bridges.length,
      },
    ];
  });

  return {
    relation: relationTo(viewerId, subjectId, viewerFriends, mutual.length),
    mutualFriends: summaries(mutual.slice(0, MUTUALS_SHOWN)),
    mutualFriendCount: mutual.length,
    vouches,
    vouchTotal: placed.length,
    partial,
  };
}

export function vouchBy(ctx: QueryCtx, voucherId: UserId, subjectId: UserId) {
  return ctx.db
    .query("vouches")
    .withIndex("by_pair", (q) => q.eq("voucherId", voucherId).eq("subjectId", subjectId))
    .unique();
}

/* ---------- Writes ---------- */

/** Vouch for `subjectId` (notifying them), or update the voucher's existing vouch. */
export async function saveVouch(
  ctx: MutationCtx,
  voucher: Doc<"users">,
  subjectId: UserId,
  input: { relationship: VouchRelationship; note?: string },
): Promise<Id<"vouches">> {
  if (subjectId === voucher._id) throw new ConvexError("You can't vouch for yourself");
  const subject = await ctx.db.get(subjectId);
  if (!subject || (await isBlockedEitherWay(ctx, voucher._id, subjectId)))
    throw new ConvexError("This person isn't available");
  const note = cleanNote(input.note);
  const now = Date.now();
  const existing = await vouchBy(ctx, voucher._id, subjectId);
  if (existing) {
    await ctx.db.patch(existing._id, { relationship: input.relationship, note, updatedAt: now });
    return existing._id;
  }
  const vouchId = await ctx.db.insert("vouches", {
    voucherId: voucher._id,
    subjectId,
    relationship: input.relationship,
    note,
    createdAt: now,
    updatedAt: now,
  });
  // Only a new vouch notifies; editing one doesn't. Opens the voucher's profile.
  await notify(ctx, {
    userId: subjectId,
    actorId: voucher._id,
    kind: "vouch",
    text: "vouched for you.",
  });
  return vouchId;
}

/** Withdraw the voucher's vouch for `subjectId`, if any. */
export async function removeVouch(ctx: MutationCtx, voucherId: UserId, subjectId: UserId) {
  const existing = await vouchBy(ctx, voucherId, subjectId);
  if (existing) await ctx.db.delete(existing._id);
}
