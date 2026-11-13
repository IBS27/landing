import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { lifestyleAnswers } from "./lib/lifestyle";
import {
  deleteLifestyle as deleteRow,
  getOwnLifestyle,
  saveLifestyleAnswers,
  setLifestyleSharing as setSharing,
} from "./lib/roommates";

/**
 * Roommate matching (#21–#23). This file: the viewer's own lifestyle answers.
 * Each function reads or writes only the viewer's row.
 */

/** The viewer's own answers and sharing choice, or null if they haven't started. */
export const myLifestyle = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const row = await getOwnLifestyle(ctx, ctx.viewer._id);
    if (!row) return null;
    return {
      answers: row.answers,
      shared: row.shared,
      sharedAt: row.sharedAt ?? null,
      updatedAt: row.updatedAt,
    };
  },
});

/** Replaces the viewer's answers. The first save creates them, private. */
export const saveLifestyle = viewerMutation({
  args: { answers: lifestyleAnswers },
  handler: async (ctx, { answers }) => {
    await saveLifestyleAnswers(ctx, ctx.viewer._id, answers, Date.now());
  },
});

/** Turns sharing for roommate matching on or off. */
export const setLifestyleSharing = viewerMutation({
  args: { shared: v.boolean() },
  handler: (ctx, { shared }) => setSharing(ctx, ctx.viewer._id, shared, Date.now()),
});

/** Deletes all of the viewer's answers. */
export const deleteLifestyle = viewerMutation({
  args: {},
  handler: (ctx) => deleteRow(ctx, ctx.viewer._id),
});
