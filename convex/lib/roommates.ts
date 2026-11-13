import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBlockedEitherWay } from "./blocks";
import { type CityProfile, getProfile } from "./cityProfile";
import {
  answeredCount,
  type BudgetRange,
  type LifestyleAnswers,
  normalizeAnswers,
  type RoommateInputs,
  WORKDAYS,
  type Workday,
} from "./lifestyle";

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

/**
 * The City Profile values roommate matching may use: the budget and workday
 * the person stated themselves. Inferred facts never count, and "not working"
 * is never compared (see the review in `./lifestyle.ts`).
 */
export function matchProfileInputs(profile: CityProfile): {
  budget: BudgetRange | null;
  workday: Workday | null;
} {
  const budget = profile.budget?.source === "stated" ? profile.budget.value : null;
  const workplace =
    profile.schedule?.source === "stated" ? profile.schedule.value.workplace : undefined;
  const workday = (WORKDAYS as readonly string[]).includes(workplace ?? "")
    ? (workplace as Workday)
    : null;
  return { budget, workday };
}

async function inputsFor(
  ctx: QueryCtx,
  userId: UserId,
  answers: LifestyleAnswers,
): Promise<RoommateInputs> {
  const { budget, workday } = matchProfileInputs(await getProfile(ctx, userId));
  return { answers: normalizeAnswers(answers), budget, workplace: workday };
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
): Promise<{ mine: RoommateInputs; others: Map<UserId, RoommateInputs> } | null> {
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
