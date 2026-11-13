import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  dropInferredFact,
  getProfile,
  learnsFromActivity,
  recordInferredFact,
} from "./cityProfile";
import { factSlot, type NeighborhoodSlug } from "./cityProfileFacts";
import {
  type InterestId,
  interestsForCategory,
  interestsForEvent,
  interestsForGroup,
} from "./interests";
import { isNeighborhoodSlug } from "./neighborhoods";
import {
  activitySummary,
  type Inference,
  inferFromSignals,
  MAX_AGE_MS,
  MAX_EVIDENCE,
  msUntilRecheck,
  neighborhoodIn,
  type SignalKind,
  type SignalTargetKind,
  type Subject,
} from "./profileSignals";
import { hasProtected } from "./protectedText";

/**
 * Learn from activity (#4): the hooks the RSVP, join, reaction, save and skip
 * mutations call, and the recompute they schedule. The rules are in
 * `./profileSignals.ts`; inferred facts are written only through #3's
 * `recordInferredFact` and `dropInferredFact`.
 */

/** The recompute waits this long, so a burst of actions is counted once. */
export const RECOMPUTE_DEBOUNCE_MS = 5_000;

type Signal = Doc<"profileSignals">;
export type TargetInfo = { interestIds: InterestId[]; neighborhoodSlug?: NeighborhoodSlug };

/**
 * A target's neighborhood: the `neighborhoods` row its `neighborhoodId` (#15) points at,
 * or, only when that's unset (Events from Facebook's composer), a name in its place text.
 * Parks never count.
 */
async function neighborhoodOf(
  ctx: QueryCtx,
  neighborhoodId: Id<"neighborhoods"> | undefined,
  place: string | undefined,
): Promise<NeighborhoodSlug | undefined> {
  if (!neighborhoodId) return neighborhoodIn(place);
  const n = await ctx.db.get(neighborhoodId);
  return n && !n.park && isNeighborhoodSlug(n.slug) ? n.slug : undefined;
}

/**
 * The interests and neighborhood a target maps to, through #3's lookups only.
 * A post maps through its Group or Event. Null when the target is gone or maps
 * to no interest, which includes #3's excluded categories: those are never recorded.
 */
export async function describeTarget(
  ctx: QueryCtx,
  targetKind: SignalTargetKind,
  targetId: string,
): Promise<TargetInfo | null> {
  let info: TargetInfo | null = null;
  if (targetKind === "event") {
    const id = ctx.db.normalizeId("events", targetId);
    const e = id && (await ctx.db.get(id));
    info = e
      ? {
          interestIds: interestsForEvent({ category: e.category, title: e.title }),
          neighborhoodSlug: e.online
            ? undefined
            : await neighborhoodOf(ctx, e.neighborhoodId, e.address),
        }
      : null;
  } else if (targetKind === "group") {
    const id = ctx.db.normalizeId("groups", targetId);
    const g = id && (await ctx.db.get(id));
    info = g
      ? {
          interestIds: interestsForGroup({ category: g.category, tags: g.tags, name: g.name }),
          neighborhoodSlug: await neighborhoodOf(ctx, g.neighborhoodId, g.location),
        }
      : null;
  } else if (targetKind === "post") {
    const id = ctx.db.normalizeId("posts", targetId);
    const p = id && (await ctx.db.get(id));
    if (p?.groupId) info = await describeTarget(ctx, "group", p.groupId);
    else if (p?.eventId) info = await describeTarget(ctx, "event", p.eventId);
  } else {
    const id = ctx.db.normalizeId("listings", targetId);
    const l = id && (await ctx.db.get(id));
    info = l
      ? {
          interestIds: interestsForCategory(l.category),
          neighborhoodSlug: await neighborhoodOf(ctx, l.neighborhoodId, l.location.neighborhood),
        }
      : null;
  }
  return info && info.interestIds.length > 0 ? info : null;
}

/** Writes one signal row (one per person, kind and target), live as of `at`. */
export async function upsertSignal(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: SignalKind,
  targetKind: SignalTargetKind,
  targetId: string,
  info: TargetInfo,
  at: number,
) {
  const row = await ctx.db
    .query("profileSignals")
    .withIndex("by_user_target", (q) =>
      q.eq("userId", userId).eq("targetId", targetId).eq("kind", kind),
    )
    .first();
  const fields = { ...info, at, updatedAt: Date.now(), undoneAt: undefined };
  if (row) await ctx.db.patch(row._id, fields);
  else await ctx.db.insert("profileSignals", { userId, kind, targetKind, targetId, ...fields });
}

async function scheduleRecompute(
  ctx: MutationCtx,
  userId: Id<"users">,
  delay = RECOMPUTE_DEBOUNCE_MS,
) {
  await ctx.scheduler.runAfter(delay, internal.profileSignals.recompute, {
    userId,
    after: Date.now(),
  });
}

/**
 * Records that `userId` did `kind` to a target, then schedules a recompute.
 * Does nothing when they turned learning off or the target maps to no interest.
 */
export async function recordSignal(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: SignalKind,
  targetKind: SignalTargetKind,
  targetId: string,
) {
  if (!(await learnsFromActivity(ctx, userId))) return;
  const info = await describeTarget(ctx, targetKind, targetId);
  if (!info) return;
  await upsertSignal(ctx, userId, kind, targetKind, targetId, info, Date.now());
  await scheduleRecompute(ctx, userId);
}

/** Marks `userId`'s live signals of `kinds` on a target undone (un-RSVP, leave, unreact, unsave). */
export async function undoSignal(
  ctx: MutationCtx,
  userId: Id<"users">,
  kinds: readonly SignalKind[],
  targetId: string,
) {
  let changed = false;
  for (const kind of kinds) {
    const row = await ctx.db
      .query("profileSignals")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", userId).eq("targetId", targetId).eq("kind", kind),
      )
      .first();
    if (!row || row.undoneAt !== undefined) continue;
    const now = Date.now();
    await ctx.db.patch(row._id, { undoneAt: now, updatedAt: now });
    changed = true;
  }
  if (changed) await scheduleRecompute(ctx, userId);
}

/** Event titles and Group names that may appear in a reason; protected-sounding ones are counted instead. */
async function targetNames(ctx: QueryCtx, signals: Signal[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const s of signals) {
    if (names.has(s.targetId)) continue;
    let name: string | undefined;
    if (s.kind === "going") {
      const id = ctx.db.normalizeId("events", s.targetId);
      name = id ? (await ctx.db.get(id))?.title : undefined;
    } else if (s.kind === "join") {
      const id = ctx.db.normalizeId("groups", s.targetId);
      name = id ? (await ctx.db.get(id))?.name : undefined;
    }
    if (name && !hasProtected(name)) names.set(s.targetId, name);
  }
  return names;
}

/**
 * Re-derives someone's inferred interests and neighborhoods from their live
 * signals. New and stronger ones are written through `recordInferredFact`
 * (which never overrides a stated fact or brings back a removed one); inferred
 * ones that fell below the threshold are dropped.
 */
export async function recomputeInferred(ctx: MutationCtx, userId: Id<"users">) {
  if (!(await learnsFromActivity(ctx, userId))) return;
  const now = Date.now();
  const signals = (
    await ctx.db
      .query("profileSignals")
      .withIndex("by_user", (q) => q.eq("userId", userId).gte("at", now - MAX_AGE_MS))
      .collect()
  ).filter((s) => s.undoneAt === undefined);
  const { interests, neighborhoods } = inferFromSignals(signals, now);
  const inferred: [Subject, Inference<Signal>][] = [
    ...[...interests].map(([id, inf]): [Subject, Inference<Signal>] => [
      { key: "interest", value: { id } },
      inf,
    ]),
    ...[...neighborhoods].map(([slug, inf]): [Subject, Inference<Signal>] => [
      { key: "neighborhood", value: { slug } },
      inf,
    ]),
  ];
  const names = await targetNames(
    ctx,
    inferred.flatMap(([, inf]) => inf.signals),
  );
  for (const [subject, inf] of inferred) {
    await recordInferredFact(ctx, userId, subject, {
      confidence: inf.confidence,
      evidence: {
        kind: "activity",
        summary: activitySummary(subject, inf.signals, names),
        signalIds: inf.signals.slice(0, MAX_EVIDENCE).map((s) => s._id),
      },
    });
  }
  // Come back when the first one may stop holding, so inferred
  // facts fade without new activity. A newer signal's recompute supersedes this.
  if (inferred.length > 0)
    await scheduleRecompute(
      ctx,
      userId,
      Math.max(0, Math.min(...inferred.map(([, inf]) => msUntilRecheck(inf, now)))) + 60_000,
    );
  const keep = new Set(inferred.map(([subject]) => factSlot(subject)));
  const profile = await getProfile(ctx, userId);
  for (const f of [...profile.interests, ...profile.neighborhoods]) {
    if (f.source !== "inferred" || f.evidence.kind !== "activity") continue;
    if (!keep.has(factSlot(f))) await dropInferredFact(ctx, userId, f);
  }
}
