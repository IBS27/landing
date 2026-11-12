import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { VouchRelationship } from "../validators";
import { isBlockedEitherWay } from "./blocks";
import { notify } from "./notify";
import { areFriends, getSummaries, type UserSummary } from "./users";

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
/** Block rows read per user, each way; past that, `BlockCheck` checks pairs. */
export const BLOCK_READ_MAX = 1000;
/** Pair checks (two lookups each) per query when block lists are too long to read. */
export const PAIR_CHECK_MAX = 300;
const PAIR_CHECK_BATCH = 100;
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

/** Who in `ids` is also in `set`, without duplicates. Keeps the order of `ids`. */
export function intersect(ids: readonly UserId[], set: ReadonlySet<UserId>): UserId[] {
  return [...new Set(ids)].filter((id) => set.has(id));
}

export function relationTo(isSubject: boolean, isFriend: boolean, mutualCount: number): Relation {
  if (isSubject) return "you";
  if (isFriend) return "friend";
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

/** Up to `max` friend ids, and whether that's all of them. */
async function friendsOf(ctx: QueryCtx, userId: UserId, max: number) {
  const rows = await ctx.db
    .query("friendships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(max + 1);
  return { ids: rows.slice(0, max).map((r) => r.friendId), complete: rows.length <= max };
}

/**
 * Blocks between one user and others, without unbounded reads. The user's
 * block lists are read up to BLOCK_READ_MAX each way. When either is longer,
 * people are checked pair by pair from a budget shared across the query, and
 * anyone left unchecked counts as blocked (fail closed), setting `missed`.
 */
class BlockCheck {
  private readonly known = new Map<UserId, boolean>();
  missed = false;

  private constructor(
    private readonly ctx: QueryCtx,
    private readonly userId: UserId,
    private readonly listed: ReadonlySet<UserId>,
    private readonly complete: boolean,
    private readonly budget: { left: number },
  ) {}

  static async load(ctx: QueryCtx, userId: UserId, budget: { left: number }) {
    const [mine, theirs] = await Promise.all([
      ctx.db
        .query("blocks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(BLOCK_READ_MAX + 1),
      ctx.db
        .query("blocks")
        .withIndex("by_blocked", (q) => q.eq("blockedId", userId))
        .take(BLOCK_READ_MAX + 1),
    ]);
    const listed = new Set([...mine.map((r) => r.blockedId), ...theirs.map((r) => r.userId)]);
    const complete = mine.length <= BLOCK_READ_MAX && theirs.length <= BLOCK_READ_MAX;
    return new BlockCheck(ctx, userId, listed, complete, budget);
  }

  /** Pair-check the `ids` the lists can't settle, in order, while the budget lasts. */
  async check(ids: readonly UserId[]) {
    if (this.complete) return;
    const todo = [...new Set(ids)]
      .filter((id) => id !== this.userId && !this.listed.has(id) && !this.known.has(id))
      .slice(0, this.budget.left);
    this.budget.left -= todo.length;
    for (let i = 0; i < todo.length; i += PAIR_CHECK_BATCH) {
      const batch = todo.slice(i, i + PAIR_CHECK_BATCH);
      const hits = await Promise.all(
        batch.map((id) => isBlockedEitherWay(this.ctx, this.userId, id)),
      );
      for (const [j, id] of batch.entries()) this.known.set(id, hits[j] ?? true);
    }
  }

  /** Known to be blocked either way. */
  surely(id: UserId) {
    return this.listed.has(id) || this.known.get(id) === true;
  }

  /** Blocked, or not checked: leave them out. */
  hides(id: UserId) {
    if (id === this.userId || this.complete || this.known.has(id)) return this.surely(id);
    if (this.listed.has(id)) return true;
    this.missed = true;
    return true;
  }
}

type Placed = { row: Doc<"vouches">; via: Via; bridges: UserId[] };

/**
 * The subject's connection to the viewer's network, as the viewer may see it.
 * Null when they're blocked either way.
 *
 * Every read is bounded, so the query stays inside Convex's limits (documents
 * read, index ranges, concurrency) whatever the graph looks like, and
 * `partial` says when something wasn't checked:
 * - Friend lists are read up to FRIENDS_READ_MAX. Past that, the viewer's
 *   friendship with the subject and with friends-of-friends vouchers is checked
 *   directly.
 * - The subject's newest VOUCH_SCAN_MAX vouches are read in one range. The
 *   viewer's own vouch and their friends' among them are placed in memory. Past
 *   the scan, the viewer's own vouch is looked up directly, and so are their
 *   friends' when they have at most FRIEND_LOOKUP_MAX friends.
 * - Friends of friends' vouches (and, for the subject, everyone else's) are
 *   placed newest first, at most FOF_SCAN_MAX of them within
 *   FRIEND_READ_BUDGET friendship rows.
 * - Blocks go through `BlockCheck`, which fails closed.
 */
export async function listerNetwork(
  ctx: QueryCtx,
  viewerId: UserId,
  subjectId: UserId,
): Promise<ListerNetwork | null> {
  const isSubject = viewerId === subjectId;
  const budget = { left: PAIR_CHECK_MAX };
  const [viewerBlocks, otherSubjectBlocks, viewerFriendRead, subjectFriendRead, recent] =
    await Promise.all([
      BlockCheck.load(ctx, viewerId, budget),
      isSubject ? null : BlockCheck.load(ctx, subjectId, budget),
      friendsOf(ctx, viewerId, FRIENDS_READ_MAX),
      isSubject ? null : friendsOf(ctx, subjectId, FRIENDS_READ_MAX),
      ctx.db
        .query("vouches")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
        .order("desc")
        .take(VOUCH_SCAN_MAX + 1),
    ]);
  await viewerBlocks.check([subjectId]);
  if (viewerBlocks.hides(subjectId)) return null;
  const subjectBlocks = otherSubjectBlocks ?? viewerBlocks;

  const viewerFriends = new Set(viewerFriendRead.ids);
  const friendsComplete = viewerFriendRead.complete;
  /** A friend past the read cap is still a friend. */
  const isFriend = async (id: UserId) =>
    viewerFriends.has(id) || (!friendsComplete && (await areFriends(ctx, viewerId, id)));
  let partial = !friendsComplete || subjectFriendRead?.complete === false;
  const subjectIsFriend = !isSubject && (await isFriend(subjectId));
  const mutualCandidates = intersect(subjectFriendRead?.ids ?? [], viewerFriends);

  // 1. The viewer's own vouch and their friends'.
  const isDirect = (id: UserId) => id === viewerId || viewerFriends.has(id);
  const complete = recent.length <= VOUCH_SCAN_MAX;
  const scanned = recent.slice(0, VOUCH_SCAN_MAX);
  // Past the scan, older friends-of-friends vouches go unchecked.
  if (!complete) partial = true;
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
  const candidates: Placed[] = direct.map((row) => ({
    row,
    via: row.voucherId === viewerId ? "you" : "friend",
    bridges: [],
  }));

  // 2. Everyone else, newest first, within the scan and read budgets.
  const knownVoid = (id: UserId) => viewerBlocks.surely(id) || subjectBlocks.surely(id);
  const others = scanned.filter((row) => !isDirect(row.voucherId) && !knownVoid(row.voucherId));
  if (others.length > FOF_SCAN_MAX) partial = true;
  let friendBudget = FRIEND_READ_BUDGET;
  for (const row of others.slice(0, FOF_SCAN_MAX)) {
    if (await isFriend(row.voucherId)) {
      candidates.push({ row, via: "friend", bridges: [] });
      continue;
    }
    const theirs = await friendsOf(ctx, row.voucherId, friendBudget);
    if (!theirs.complete) {
      partial = true;
      break;
    }
    friendBudget -= theirs.ids.length;
    const bridges = intersect(theirs.ids, viewerFriends);
    candidates.push({
      row,
      via: voucherVia(viewerId, row.voucherId, viewerFriends, bridges),
      bridges,
    });
  }

  // 3. Blocks, closest first: a block either way with the viewer hides a person,
  // and one between voucher and subject voids the vouch.
  const closest = (list: Placed[]) =>
    list.sort((a, b) =>
      byCloseness(
        { via: a.via, updatedAt: a.row.updatedAt },
        { via: b.via, updatedAt: b.row.updatedAt },
      ),
    );
  closest(candidates);
  const voucherIds = candidates.map((c) => c.row.voucherId);
  await viewerBlocks.check(voucherIds);
  await subjectBlocks.check(voucherIds);
  const valid = candidates.filter(
    (c) => !viewerBlocks.hides(c.row.voucherId) && !subjectBlocks.hides(c.row.voucherId),
  );
  await viewerBlocks.check([...valid.flatMap((c) => c.bridges), ...mutualCandidates]);
  const placed = closest(
    valid.flatMap((c): Placed[] => {
      if (c.via !== "friend_of_friend") return [c];
      const bridges = c.bridges.filter((id) => !viewerBlocks.hides(id));
      // Connected only through people hidden from the viewer: not in their network.
      const via = bridges.length ? c.via : "other";
      return via === "other" && !isSubject ? [] : [{ ...c, via, bridges }];
    }),
  ).filter((c) => c.via !== "other" || isSubject);
  const mutual = mutualCandidates.filter((id) => !viewerBlocks.hides(id));
  if (viewerBlocks.missed || subjectBlocks.missed) partial = true;
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
    relation: relationTo(isSubject, subjectIsFriend, mutual.length),
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
