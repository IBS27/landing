import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { confirmFact as confirm, removeFact as remove } from "./lib/cityProfile";
import { undismiss, undismissAll } from "./lib/dismissals";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  activitySummary,
  clearActivityBatch as clearBatch,
  DELETE_BATCH,
  deleteRunsBatch as deleteBatch,
  hiddenCards,
  knownFacts,
  runsSummary,
  undoRemoval,
} from "./lib/museKnows";

/**
 * "What Muse knows about you" (#5). Everything here is the viewer's own: each
 * function reads or changes only `ctx.viewer`'s rows, and a fact id that isn't
 * theirs is refused. Roommate answers, the Move-in Crew and room vibes are
 * shown and cleared through their own features' functions.
 */

const NOT_YOURS = "That isn't on your City Profile.";

/** Every City Profile fact with where it came from (and the links behind inferred ones), plus removed facts. */
export const facts = viewerQuery({
  args: {},
  handler: (ctx) => knownFacts(ctx, ctx.viewer._id),
});

/** What's recorded from the viewer's activity, by kind. */
export const activity = viewerQuery({
  args: {},
  handler: (ctx) => activitySummary(ctx, ctx.viewer._id),
});

/** Muse runs made for the viewer, by task. */
export const runs = viewerQuery({
  args: {},
  handler: (ctx) => runsSummary(ctx, ctx.viewer._id),
});

/** Cards the viewer marked "Not for me", newest first, as they may see them now. */
export const hidden = viewerQuery({
  args: {},
  handler: (ctx) => hiddenCards(ctx, ctx.viewer._id),
});

/**
 * "Show again": the card can come back in the viewer's recommendations. Only
 * the dismissal goes; the skip signal and anything learned from it stay
 * (that's "Clear my activity" or removing the interest).
 */
export const showCard = viewerMutation({
  args: { targetId: v.string() },
  handler: (ctx, { targetId }) => undismiss(ctx, ctx.viewer._id, targetId),
});

/** "Show all again": every card the viewer hid until now. */
export const showAllCards = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const before = Date.now();
    if (await undismissAll(ctx, ctx.viewer._id, before, DELETE_BATCH))
      await ctx.scheduler.runAfter(0, internal.museKnows.showAllCardsBatch, {
        userId: ctx.viewer._id,
        before,
      });
  },
});

/** "Keep": an inferred fact becomes a stated one. */
export const confirmFact = viewerMutation({
  args: { factId: v.id("cityProfileFacts") },
  handler: async (ctx, { factId }) => {
    if (!(await confirm(ctx, ctx.viewer._id, factId))) throw new ConvexError(NOT_YOURS);
  },
});

/** Removes a fact; it's never inferred again until the viewer undoes it. */
export const removeFact = viewerMutation({
  args: { factId: v.id("cityProfileFacts") },
  handler: async (ctx, { factId }) => {
    if (!(await remove(ctx, ctx.viewer._id, factId))) throw new ConvexError(NOT_YOURS);
  },
});

/** Undoes a removal. */
export const restoreFact = viewerMutation({
  args: { factId: v.id("cityProfileFacts") },
  handler: async (ctx, { factId }) => {
    if (!(await undoRemoval(ctx, ctx.viewer._id, factId))) throw new ConvexError(NOT_YOURS);
  },
});

/** Deletes everything recorded from the viewer's activity and the facts inferred from it. */
export const clearActivity = viewerMutation({
  args: {},
  handler: async (ctx) => {
    if (await clearBatch(ctx, ctx.viewer._id))
      await ctx.scheduler.runAfter(0, internal.museKnows.clearActivityBatch, {
        userId: ctx.viewer._id,
      });
  },
});

/** Deletes the viewer's Muse runs. */
export const deleteRuns = viewerMutation({
  args: {},
  handler: async (ctx) => {
    if (await deleteBatch(ctx, ctx.viewer._id))
      await ctx.scheduler.runAfter(0, internal.museKnows.deleteRunsBatch, {
        userId: ctx.viewer._id,
      });
  },
});

/** Continues `clearActivity` past one batch. */
export const clearActivityBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (await clearBatch(ctx, userId))
      await ctx.scheduler.runAfter(0, internal.museKnows.clearActivityBatch, { userId });
  },
});

/** Continues `deleteRuns` past one batch. */
export const deleteRunsBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (await deleteBatch(ctx, userId))
      await ctx.scheduler.runAfter(0, internal.museKnows.deleteRunsBatch, { userId });
  },
});

/** Continues `showAllCards` past one batch. */
export const showAllCardsBatch = internalMutation({
  args: { userId: v.id("users"), before: v.number() },
  handler: async (ctx, { userId, before }) => {
    if (await undismissAll(ctx, userId, before, DELETE_BATCH))
      await ctx.scheduler.runAfter(0, internal.museKnows.showAllCardsBatch, { userId, before });
  },
});
