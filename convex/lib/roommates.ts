import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBlockedEitherWay } from "./blocks";
import { type CityProfile, getProfile } from "./cityProfile";
import type { NeighborhoodSlug } from "./cityProfileFacts";
import { type Compatibility, compatibility } from "./compatibility";
import {
  answeredCount,
  type BudgetRange,
  compareBudget,
  type LifestyleAnswers,
  normalizeAnswers,
  type RoommateInputs,
  WORKDAYS,
  type Workday,
} from "./lifestyle";
import { getSummaries, type UserSummary } from "./users";
import { networkReach } from "./vouches";

/**
 * Roommate lifestyle answers (#21): storage and access rules. Vocabulary and
 * comparisons are in `./lifestyle.ts`.
 *
 * - Private by default: a row starts with `shared: false`, and only its owner
 *   reads it (`getOwnLifestyle`).
 * - Only the owner writes it, through the questionnaire. Nothing infers answers.
 * - Reciprocal: another person's answers are readable only through
 *   `comparableLifestyles`, which needs both people to share and neither to
 *   have blocked the other. Callers (#22, #23) compare live and must not store
 *   another person's answers, so turning sharing off or deleting takes effect
 *   everywhere at once.
 */

type UserId = Id<"users">;

/** Candidates checked per `comparableLifestyles` call (two block lookups and a profile read each). */
export const COMPARE_MAX = 100;

export type ProfileInputs = {
  budget: BudgetRange | null;
  workday: Workday | null;
  /** "YYYY-MM". Candidates (#22) show it only when both people move the same month. */
  moveInMonth: string | null;
  /** Target neighborhoods. Candidates (#22) show only the ones both people picked. */
  neighborhoods: NeighborhoodSlug[];
};

/**
 * The City Profile values roommate matching may use: the budget, workday,
 * move-in month and target neighborhoods the person stated themselves.
 * Inferred facts never count, and "not working" is never compared (see the
 * review in `./lifestyle.ts`).
 */
export function matchProfileInputs(profile: CityProfile): ProfileInputs {
  const budget = profile.budget?.source === "stated" ? profile.budget.value : null;
  const workplace =
    profile.schedule?.source === "stated" ? profile.schedule.value.workplace : undefined;
  const workday = (WORKDAYS as readonly string[]).includes(workplace ?? "")
    ? (workplace as Workday)
    : null;
  const moveInMonth = profile.moveIn?.source === "stated" ? profile.moveIn.value.month : null;
  const neighborhoods = profile.neighborhoods
    .filter((f) => f.source === "stated")
    .map((f) => f.value.slug);
  return { budget, workday, moveInMonth, neighborhoods };
}

/** One side of a comparison: answers for `compareLifestyles`, plus stated profile values. */
export type MatchInputs = RoommateInputs & {
  moveInMonth: string | null;
  neighborhoods: NeighborhoodSlug[];
};

async function inputsFor(
  ctx: QueryCtx,
  userId: UserId,
  answers: LifestyleAnswers,
): Promise<MatchInputs> {
  const { budget, workday, moveInMonth, neighborhoods } = matchProfileInputs(
    await getProfile(ctx, userId),
  );
  return {
    answers: normalizeAnswers(answers),
    budget,
    workplace: workday,
    moveInMonth,
    neighborhoods,
  };
}

export async function getOwnLifestyle(
  ctx: QueryCtx,
  userId: UserId,
): Promise<Doc<"roommateLifestyles"> | null> {
  return ctx.db
    .query("roommateLifestyles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Replaces the person's answers. The first save creates the row, private.
 * Clearing every answer also stops sharing: there's nothing left to match on.
 */
export async function saveLifestyleAnswers(
  ctx: MutationCtx,
  userId: UserId,
  answers: LifestyleAnswers,
  now: number,
) {
  const clean = normalizeAnswers(answers);
  const empty = answeredCount(clean) === 0;
  const row = await getOwnLifestyle(ctx, userId);
  if (!row) {
    if (empty) return null;
    return ctx.db.insert("roommateLifestyles", {
      userId,
      answers: clean,
      shared: false,
      updatedAt: now,
    });
  }
  await ctx.db.patch(row._id, {
    answers: clean,
    updatedAt: now,
    ...(empty && { shared: false, sharedAt: undefined }),
  });
  return row._id;
}

/** Turns roommate matching on or off. Sharing needs at least one answer. */
export async function setLifestyleSharing(
  ctx: MutationCtx,
  userId: UserId,
  shared: boolean,
  now: number,
) {
  const row = await getOwnLifestyle(ctx, userId);
  if (!row) {
    if (!shared) return;
    throw new ConvexError("Answer at least one question before sharing.");
  }
  if (shared && answeredCount(row.answers) === 0)
    throw new ConvexError("Answer at least one question before sharing.");
  if (row.shared === shared) return;
  await ctx.db.patch(row._id, { shared, sharedAt: shared ? now : undefined, updatedAt: now });
}

/** Deletes every answer and the sharing choice. */
export async function deleteLifestyle(ctx: MutationCtx, userId: UserId) {
  const row = await getOwnLifestyle(ctx, userId);
  if (row) await ctx.db.delete(row._id);
}

/**
 * The only way to read other people's answers (#22, #23). Returns null unless
 * the viewer shares their own answers. Otherwise `others` holds the candidates
 * who also share and aren't blocked either way with the viewer, in the order
 * given, each ready for `compareLifestyles` (answers plus stated budget and
 * workday). Candidates past `COMPARE_MAX` are ignored, so pass the best first.
 * Network rules (who counts as a candidate) are the caller's.
 */
export async function comparableLifestyles(
  ctx: QueryCtx,
  viewerId: UserId,
  candidateIds: readonly UserId[],
): Promise<{ mine: MatchInputs; others: Map<UserId, MatchInputs> } | null> {
  const mine = await getOwnLifestyle(ctx, viewerId);
  if (!mine?.shared || answeredCount(mine.answers) === 0) return null;
  const ids = [...new Set(candidateIds)].filter((id) => id !== viewerId).slice(0, COMPARE_MAX);
  const found = await Promise.all(
    ids.map(async (id) => {
      const row = await ctx.db
        .query("roommateLifestyles")
        .withIndex("by_shared", (q) => q.eq("shared", true).eq("userId", id))
        .unique();
      if (!row || answeredCount(row.answers) === 0) return null;
      if (await isBlockedEitherWay(ctx, viewerId, id)) return null;
      return [id, await inputsFor(ctx, id, row.answers)] as const;
    }),
  );
  return {
    mine: await inputsFor(ctx, viewerId, mine.answers),
    others: new Map(found.filter((x) => x !== null)),
  };
}

/* ---------- Candidates (#22) ---------- */

/** People in the network checked for sharing per query, closest first (one lookup each). */
export const SHARING_CHECK_MAX = 400;
/** A candidate's vouches checked for a block between voucher and candidate; unchecked ones don't count. */
export const VOUCHERS_CHECKED = 5;
/** Candidates returned; the rest are counted in `total`. */
export const CANDIDATES_SHOWN = 30;
/** Mutual friends and vouchers named per candidate; the rest are counted. */
export const NAMES_SHOWN = 3;
const LOOKUP_BATCH = 100;

/** How close a candidate is to the viewer, closest first. */
export const CLOSENESS = ["friend", "vouched", "friend_of_friend"] as const;
export type Closeness = (typeof CLOSENESS)[number];

/**
 * What two people's stated plans have in common. Only values both stated are
 * kept, so it never tells the viewer anything about the candidate's plans
 * beyond "same as yours". Budgets give only whether they overlap.
 */
export type Overlap = {
  /** "YYYY-MM" when both move in the same month. */
  moveInMonth: string | null;
  /** Target neighborhoods both picked, in the viewer's order. */
  neighborhoods: NeighborhoodSlug[];
  /** Both stated a budget and the ranges overlap. */
  budget: boolean;
};

type PlanSide = Pick<MatchInputs, "budget" | "moveInMonth" | "neighborhoods">;

export function overlapOf(mine: PlanSide, theirs: PlanSide): Overlap {
  const theirHoods = new Set(theirs.neighborhoods);
  return {
    moveInMonth:
      mine.moveInMonth !== null && mine.moveInMonth === theirs.moveInMonth
        ? mine.moveInMonth
        : null,
    neighborhoods: [...new Set(mine.neighborhoods)].filter((s) => theirHoods.has(s)),
    budget:
      !!mine.budget &&
      !!theirs.budget &&
      compareBudget(mine.budget, theirs.budget).outcome === "same",
  };
}

export function overlapCount(o: Overlap): number {
  return Number(o.moveInMonth !== null) + Number(o.neighborhoods.length > 0) + Number(o.budget);
}

/**
 * A roommate candidate as the viewer may see them. Lifestyle answers appear
 * only inside `compatibility`, and only for fields both people answered.
 */
export type RoommateCandidate = {
  user: UserSummary;
  closeness: Closeness;
  /** The viewer's friends who are friends with the candidate, at most NAMES_SHOWN. */
  mutualFriends: UserSummary[];
  mutualFriendCount: number;
  /** The viewer's friends who vouch for the candidate, at most NAMES_SHOWN. */
  vouchedBy: UserSummary[];
  vouchCount: number;
  overlap: Overlap;
  /** The compatibility score (#23), with the shared traits and answers it's based on. */
  compatibility: Compatibility;
};

export type CandidateList = {
  /** Best first, at most CANDIDATES_SHOWN. */
  candidates: RoommateCandidate[];
  /** Every candidate found, including ones past CANDIDATES_SHOWN. */
  total: number;
  /** Part of the network wasn't read, so someone may be missing. */
  partial: boolean;
};

/**
 * Network closeness first (friend, vouched for by a friend, friend of
 * friends), then no dealbreaker before a dealbreaker, then compatibility score
 * (no score last), then how many plans overlap (move-in month, a neighborhood,
 * budget), then how many of the viewer's friends connect them (`links`:
 * distinct mutual friends and vouchers), then name.
 */
export function byCandidateRank(
  a: { candidate: RoommateCandidate; links: number },
  b: { candidate: RoommateCandidate; links: number },
): number {
  return (
    CLOSENESS.indexOf(a.candidate.closeness) - CLOSENESS.indexOf(b.candidate.closeness) ||
    Number(a.candidate.compatibility.dealbreakers.length > 0) -
      Number(b.candidate.compatibility.dealbreakers.length > 0) ||
    (b.candidate.compatibility.score ?? -1) - (a.candidate.compatibility.score ?? -1) ||
    overlapCount(b.candidate.overlap) - overlapCount(a.candidate.overlap) ||
    b.links - a.links ||
    a.candidate.user.name.localeCompare(b.candidate.user.name)
  );
}

async function inBatches<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += LOOKUP_BATCH)
    out.push(...(await Promise.all(items.slice(i, i + LOOKUP_BATCH).map(fn))));
  return out;
}

async function isSharing(ctx: QueryCtx, userId: UserId) {
  const row = await ctx.db
    .query("roommateLifestyles")
    .withIndex("by_shared", (q) => q.eq("shared", true).eq("userId", userId))
    .unique();
  return row !== null;
}

/**
 * Roommate candidates from the viewer's network (`networkReach`): friends,
 * people a friend vouches for and friends of friends who share their answers.
 * Null unless the viewer shares too. Answers are read only through
 * `comparableLifestyles`, which also drops anyone blocked either way, and a
 * vouch from someone blocked either way with the candidate doesn't count.
 *
 * Reads stay bounded: `networkReach`'s caps, sharing checked for the closest
 * SHARING_CHECK_MAX people, COMPARE_MAX compared, and VOUCHERS_CHECKED
 * vouches checked per candidate.
 */
export async function roommateCandidates(
  ctx: QueryCtx,
  viewerId: UserId,
): Promise<CandidateList | null> {
  const mine = await getOwnLifestyle(ctx, viewerId);
  if (!mine?.shared || answeredCount(mine.answers) === 0) return null;

  const reach = await networkReach(ctx, viewerId);
  const checked = reach.people.slice(0, SHARING_CHECK_MAX);
  const sharingFlags = await inBatches(checked, (r) => isSharing(ctx, r.userId));
  const sharing = checked.filter((_, i) => sharingFlags[i]);
  let partial =
    reach.partial || reach.people.length > checked.length || sharing.length > COMPARE_MAX;
  const comparable = await comparableLifestyles(
    ctx,
    viewerId,
    sharing.map((r) => r.userId),
  );
  if (!comparable) return null;
  const found = sharing.filter((r) => comparable.others.has(r.userId));

  if (found.some((r) => r.voucherIds.length > VOUCHERS_CHECKED)) partial = true;
  const pairs = found.flatMap((r) =>
    r.voucherIds
      .slice(0, VOUCHERS_CHECKED)
      .map((voucherId) => ({ voucherId, subjectId: r.userId })),
  );
  const pairBlocked = await inBatches(pairs, (p) =>
    isBlockedEitherWay(ctx, p.voucherId, p.subjectId),
  );
  const voidedVouch = new Set(
    pairs.filter((_, i) => pairBlocked[i]).map((p) => `${p.voucherId}|${p.subjectId}`),
  );

  const users = await getSummaries(
    ctx,
    found.map((r) => r.userId),
  );
  const ranked = found.flatMap((r) => {
    const user = users.get(r.userId);
    const theirs = comparable.others.get(r.userId);
    if (!user || !theirs) return [];
    const voucherIds = r.voucherIds
      .slice(0, VOUCHERS_CHECKED)
      .filter((v) => !voidedVouch.has(`${v}|${r.userId}`));
    const closeness: Closeness | null = r.isFriend
      ? "friend"
      : voucherIds.length > 0
        ? "vouched"
        : r.mutualIds.length > 0
          ? "friend_of_friend"
          : null;
    if (!closeness) return [];
    return [
      {
        reach: { ...r, voucherIds },
        links: new Set([...r.mutualIds, ...voucherIds]).size,
        candidate: {
          user,
          closeness,
          overlap: overlapOf(comparable.mine, theirs),
          compatibility: compatibility(comparable.mine, theirs),
          mutualFriends: [],
          mutualFriendCount: r.mutualIds.length,
          vouchedBy: [],
          vouchCount: voucherIds.length,
        } satisfies RoommateCandidate,
      },
    ];
  });
  ranked.sort(byCandidateRank);
  const shown = ranked.slice(0, CANDIDATES_SHOWN);

  const names = await getSummaries(
    ctx,
    shown.flatMap(({ reach: r }) => [
      ...r.mutualIds.slice(0, NAMES_SHOWN),
      ...r.voucherIds.slice(0, NAMES_SHOWN),
    ]),
  );
  const summaries = (ids: readonly UserId[]) =>
    ids.slice(0, NAMES_SHOWN).flatMap((id) => {
      const s = names.get(id);
      return s ? [s] : [];
    });
  return {
    candidates: shown.map(({ reach: r, candidate }) => ({
      ...candidate,
      mutualFriends: summaries(r.mutualIds),
      vouchedBy: summaries(r.voucherIds),
    })),
    total: ranked.length,
    partial,
  };
}
