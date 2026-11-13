import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  describeTarget,
  recomputeInferred,
  recordSignal,
  type TargetInfo,
  undoSignal,
  upsertSignal,
} from "./lib/activity";
import { learnsFromActivity, setLearnFromActivity } from "./lib/cityProfile";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { canSeeEvent, loadAudience } from "./lib/posts";
import {
  isPositiveReaction,
  type SignalKind,
  type SignalTargetKind,
  skipTargetKind,
} from "./lib/profileSignals";

/**
 * Learn from activity (#4). The RSVP, join, reaction and save mutations record
 * signals through `./lib/activity`; this module adds the "Not for me" skip, the
 * on/off switch, the debounced recompute and the seed backfill. Signals are
 * private: no query here returns another person's.
 */

/** Whether the viewer's City Profile learns from their activity. */
export const learning = viewerQuery({
  args: {},
  handler: (ctx) => learnsFromActivity(ctx, ctx.viewer._id),
});

/** The "Learn from your activity" switch. Turning it back on recomputes right away. */
export const setLearning = viewerMutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    await setLearnFromActivity(ctx, ctx.viewer._id, on);
    if (on) await recomputeInferred(ctx, ctx.viewer._id);
  },
});

/** Throws unless the viewer may see the card's target. */
async function requireVisible(
  ctx: MutationCtx,
  viewerId: Id<"users">,
  targetKind: SignalTargetKind,
  targetId: string,
) {
  let ok = false;
  if (targetKind === "event") {
    const id = ctx.db.normalizeId("events", targetId);
    const e = id && (await ctx.db.get(id));
    ok = !!e && (await canSeeEvent(ctx, e, await loadAudience(ctx, viewerId)));
  } else if (targetKind === "group") {
    const id = ctx.db.normalizeId("groups", targetId);
    const g = id && (await ctx.db.get(id));
    ok =
      !!g &&
      (g.visible ||
        (await ctx.db
          .query("groupMembers")
          .withIndex("by_group_user", (q) => q.eq("groupId", g._id).eq("userId", viewerId))
          .first()) !== null);
  } else if (targetKind === "listing") {
    const id = ctx.db.normalizeId("listings", targetId);
    ok = !!id && (await ctx.db.get(id)) !== null;
  }
  if (!ok) throw new ConvexError("This isn't available.");
}

/** "Not for me" on a Landing Event, Group or listing card. */
export const skip = viewerMutation({
  args: { targetKind: skipTargetKind, targetId: v.string() },
  handler: async (ctx, { targetKind, targetId }) => {
    await requireVisible(ctx, ctx.viewer._id, targetKind, targetId);
    await recordSignal(ctx, ctx.viewer._id, "skip", targetKind, targetId);
  },
});

/** Undo "Not for me". */
export const unskip = viewerMutation({
  args: { targetKind: skipTargetKind, targetId: v.string() },
  handler: (ctx, { targetId }) => undoSignal(ctx, ctx.viewer._id, ["skip"], targetId),
});

/**
 * Scheduled after each signal. `after` is when that signal changed: a newer
 * change scheduled its own run, so this one stops (a trailing debounce).
 */
export const recompute = internalMutation({
  args: { userId: v.id("users"), after: v.optional(v.number()) },
  handler: async (ctx, { userId, after }) => {
    if (after !== undefined) {
      const newest = await ctx.db
        .query("profileSignals")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
      if (newest && newest.updatedAt > after) return;
    }
    await recomputeInferred(ctx, userId);
  },
});

/**
 * One-time seed step: replays the seeded RSVPs, joins, post reactions and
 * saves as signals at their original times. Returns who has signals; the seed
 * then runs `recompute` for each.
 */
export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const infos = new Map<string, TargetInfo | null>();
    const learns = new Map<Id<"users">, boolean>();
    const users = new Set<Id<"users">>();
    const add = async (
      userId: Id<"users">,
      kind: SignalKind,
      targetKind: SignalTargetKind,
      targetId: string,
      at: number,
    ) => {
      if (!learns.has(userId)) learns.set(userId, await learnsFromActivity(ctx, userId));
      if (!learns.get(userId)) return;
      const key = `${targetKind}:${targetId}`;
      if (!infos.has(key)) infos.set(key, await describeTarget(ctx, targetKind, targetId));
      const info = infos.get(key);
      if (!info) return;
      await upsertSignal(ctx, userId, kind, targetKind, targetId, info, at);
      users.add(userId);
    };

    for await (const r of ctx.db.query("eventResponses"))
      if (r.status !== "invited") await add(r.userId, r.status, "event", r.eventId, r.createdAt);
    for await (const m of ctx.db.query("groupMembers"))
      await add(m.userId, "join", "group", m.groupId, m.joinedAt);
    for await (const r of ctx.db.query("reactions"))
      if (r.targetType === "post" && isPositiveReaction(r.type))
        await add(r.userId, "like", "post", r.targetId, r.createdAt);
    for await (const s of ctx.db.query("saved"))
      await add(s.userId, "save", s.kind, s.refId, s.createdAt);
    return [...users];
  },
});
