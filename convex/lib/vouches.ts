import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { VouchRelationship } from "../validators";
import { blockedSet, isBlockedEitherWay } from "./blocks";
import { notify } from "./notify";
import { friendIds, getSummaries, type UserSummary } from "./users";

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
/** Vouches from beyond the viewer's friends checked per read, newest first. */
export const FOF_SCAN_MAX = 100;
/** Friendship rows read to place those vouchers, so the query stays well under Convex's read limits. */
export const FRIEND_READ_BUDGET = 8000;
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
  /** Vouches the viewer may see, closest first. */
  vouches: NetworkVouch[];
  /** Older vouches from friends of friends (or, for the subject, anyone) weren't checked. */
  partial: boolean;
};

/**
 * The subject's connection to the viewer's network, as the viewer may see it.
 * Null when they're blocked either way.
 *
 * The viewer's own vouch and their friends' are found exactly, one lookup each,
 * however many other vouches the subject has. Friends of friends' vouches (and,
 * for the subject, everyone else's) are checked newest first within
 * FOF_SCAN_MAX vouches and FRIEND_READ_BUDGET friendship rows; `partial` says
 * when older ones weren't checked.
 */
export async function listerNetwork(
  ctx: QueryCtx,
  viewerId: UserId,
  subjectId: UserId,
): Promise<ListerNetwork | null> {
  const isSubject = viewerId === subjectId;
  const [blocked, viewerFriendList, subjectFriends, subjectBlocked] = await Promise.all([
    blockedSet(ctx, viewerId),
    friendIds(ctx, viewerId),
    isSubject ? [] : friendIds(ctx, subjectId),
    isSubject ? null : blockedSet(ctx, subjectId),
  ]);
  if (blocked.has(subjectId)) return null;
  const viewerFriends = new Set(viewerFriendList);
  const mutual = intersect(subjectFriends, viewerFriends, blocked);
  // A block between voucher and subject after vouching voids the vouch.
  const voided = (voucherId: UserId) =>
    blocked.has(voucherId) || (subjectBlocked ?? blocked).has(voucherId);

  // 1. The viewer's own vouch and their friends'.
  const directIds = [viewerId, ...viewerFriends].filter((id) => id !== subjectId);
  const direct = (await Promise.all(directIds.map((id) => vouchBy(ctx, id, subjectId)))).filter(
    (row): row is Doc<"vouches"> => row !== null && !voided(row.voucherId),
  );
  const placed: { row: Doc<"vouches">; via: Via; bridges: UserId[] }[] = direct.map((row) => ({
    row,
    via: row.voucherId === viewerId ? "you" : "friend",
    bridges: [],
  }));

  // 2. Everyone else, newest first, within the read budget.
  const isDirect = (id: UserId) => id === viewerId || viewerFriends.has(id);
  const recent = await ctx.db
    .query("vouches")
    .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
    .order("desc")
    .take(FOF_SCAN_MAX + direct.length + 1);
  const others = recent.filter((row) => !isDirect(row.voucherId));
  let partial = others.length > FOF_SCAN_MAX;
  let budget = FRIEND_READ_BUDGET;
  for (const row of others.slice(0, FOF_SCAN_MAX)) {
    if (voided(row.voucherId)) continue;
    const friendRows = await ctx.db
      .query("friendships")
      .withIndex("by_user", (q) => q.eq("userId", row.voucherId))
      .take(budget + 1);
    if (friendRows.length > budget) {
      partial = true;
      break;
    }
    budget -= friendRows.length;
    const bridges = intersect(
      friendRows.map((f) => f.friendId),
      viewerFriends,
      blocked,
    );
    const via = voucherVia(viewerId, row.voucherId, viewerFriends, bridges);
    if (via !== "other" || isSubject) placed.push({ row, via, bridges });
  }

  const people = await getSummaries(ctx, [
    ...mutual.slice(0, MUTUALS_SHOWN),
    ...placed.flatMap((p) => [p.row.voucherId, ...p.bridges.slice(0, BRIDGES_SHOWN)]),
  ]);
  const summaries = (ids: readonly UserId[]) =>
    ids.flatMap((id) => {
      const s = people.get(id);
      return s ? [s] : [];
    });

  const vouches = placed
    .flatMap(({ row, via, bridges }): NetworkVouch[] => {
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
    })
    .sort(byCloseness);

  return {
    relation: relationTo(viewerId, subjectId, viewerFriends, mutual.length),
    mutualFriends: summaries(mutual.slice(0, MUTUALS_SHOWN)),
    mutualFriendCount: mutual.length,
    vouches,
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
