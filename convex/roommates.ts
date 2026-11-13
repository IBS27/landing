import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProfile } from "./lib/cityProfile";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { lifestyleAnswers } from "./lib/lifestyle";
import { assertPayload, logEvent, propose, syncDraft } from "./lib/proposals";
import {
  deleteLifestyle as deleteRow,
  getOwnLifestyle,
  matchProfileInputs,
  roommateCandidates,
  saveLifestyleAnswers,
  setLifestyleSharing as setSharing,
} from "./lib/roommates";
import { dmThread } from "./messenger";

/**
 * Roommate matching (#21–#23): the viewer's own lifestyle answers (each
 * function reads or writes only the viewer's row) and their candidates.
 */

/**
 * The viewer's own answers and sharing choice, or null if they haven't started.
 * `fromProfile` is what matching would also compare from their City Profile.
 */
export const myLifestyle = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const [row, profile] = await Promise.all([
      getOwnLifestyle(ctx, ctx.viewer._id),
      getProfile(ctx, ctx.viewer._id),
    ]);
    if (!row) return null;
    return {
      answers: row.answers,
      shared: row.shared,
      sharedAt: row.sharedAt ?? null,
      updatedAt: row.updatedAt,
      fromProfile: matchProfileInputs(profile),
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

/**
 * Roommate candidates from the viewer's network who share their answers,
 * best first, each with why they appear. Null while the viewer doesn't share.
 */
export const candidates = viewerQuery({
  args: {},
  handler: (ctx) => roommateCandidates(ctx, ctx.viewer._id),
});

/** The proposal task for a roommate first message (#134). */
export const ASK_TO_CONNECT_TASK = "roommates.askToConnect";

/**
 * "Ask to connect": saves the viewer's first message to a roommate candidate
 * as a draft in Landing Inbox (#6). Nothing is sent until they approve it
 * there. The text is the template from `askMessage` unless they edited it.
 * Asking again while a draft waits updates that draft.
 */
export const askToConnect = viewerMutation({
  args: { userId: v.id("users"), text: v.string() },
  handler: async (ctx, { userId, text }): Promise<Id<"proposals">> => {
    const viewerId = ctx.viewer._id;
    const list = await roommateCandidates(ctx, viewerId);
    const candidate = list?.candidates.find((c) => c.user._id === userId);
    if (!candidate) throw new ConvexError("This person isn't one of your roommate matches anymore");
    if (!text.trim()) throw new ConvexError("The message is empty");
    const conversationId = await dmThread(ctx, viewerId, userId);
    const payload = { kind: "message" as const, conversationId, text: text.trim() };
    const origin = { agent: "muse" as const, task: ASK_TO_CONNECT_TASK, via: "fallback" as const };

    const pending = await ctx.db
      .query("proposals")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", viewerId).eq("status", "pending"))
      .collect();
    const waiting = pending.find(
      (p) =>
        p.origin.task === ASK_TO_CONNECT_TASK &&
        p.payload.kind === "message" &&
        p.payload.conversationId === conversationId &&
        (!p.expiresAt || p.expiresAt > Date.now()),
    );
    if (waiting) {
      await assertPayload(ctx, viewerId, payload, origin);
      const now = Date.now();
      await ctx.db.patch(waiting._id, {
        payload,
        original: waiting.original ?? waiting.payload,
        updatedAt: now,
      });
      await syncDraft(ctx, { ...waiting, payload });
      await logEvent(ctx, waiting._id, viewerId, "edited", "owner", now);
      return waiting._id;
    }
    return propose(ctx, {
      ownerId: viewerId,
      payload,
      rationale: `You asked to connect with ${candidate.user.firstName} from roommate matching. It's sent once you approve it.`,
      origin,
      byOwner: true,
    });
  },
});
