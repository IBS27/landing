import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { type SkipTargetKind, skipTargetKind } from "./profileSignals";

/**
 * "Not for me" dismissals (#100): which Event, Group and listing cards someone
 * hid. Kept whether or not they learn from activity and whether or not the card
 * maps to an interest; the interest signal is #4's, in `./activity.ts`. Private:
 * read only with the viewer's own id.
 */

/** One `dismissals` row. */
export const dismissal = v.object({
  userId: v.id("users"),
  targetKind: skipTargetKind,
  /** The Event, Group or listing id. */
  targetId: v.string(),
  at: v.number(),
});

async function find(ctx: QueryCtx, userId: Id<"users">, targetId: string) {
  return ctx.db
    .query("dismissals")
    .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("targetId", targetId))
    .first();
}

/** Whether `userId` said "Not for me" to the target. */
export async function isDismissed(ctx: QueryCtx, userId: Id<"users">, targetId: string) {
  return (await find(ctx, userId, targetId)) !== null;
}

/** Records the dismissal (once per person and target). */
export async function dismiss(
  ctx: MutationCtx,
  userId: Id<"users">,
  targetKind: SkipTargetKind,
  targetId: string,
) {
  if (!(await find(ctx, userId, targetId)))
    await ctx.db.insert("dismissals", { userId, targetKind, targetId, at: Date.now() });
}

/** Undo: removes the dismissal. */
export async function undismiss(ctx: MutationCtx, userId: Id<"users">, targetId: string) {
  const row = await find(ctx, userId, targetId);
  if (row) await ctx.db.delete(row._id);
}

/** Rows read per list; the count says "500+" past this. */
export const DISMISSALS_SCAN = 500;

/**
 * The owner's dismissals, newest first, and whether there are more than
 * `DISMISSALS_SCAN` (then only that many are read, in index order).
 */
export async function listDismissals(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("dismissals")
    .withIndex("by_user_target", (q) => q.eq("userId", userId))
    .take(DISMISSALS_SCAN + 1);
  const more = rows.length > DISMISSALS_SCAN;
  const shown = rows.slice(0, DISMISSALS_SCAN).sort((a, b) => b.at - a.at);
  return { rows: shown, more };
}

/**
 * One batch of "Show all again": deletes up to `batch` of the owner's
 * dismissals made at or before `before`, so a card hidden after the person
 * asked stays hidden. Returns whether rows remain.
 */
export async function undismissAll(
  ctx: MutationCtx,
  userId: Id<"users">,
  before: number,
  batch: number,
) {
  const ids: Id<"dismissals">[] = [];
  for await (const row of ctx.db
    .query("dismissals")
    .withIndex("by_user_target", (q) => q.eq("userId", userId))) {
    if (row.at <= before) ids.push(row._id);
    if (ids.length === batch) break;
  }
  for (const id of ids) await ctx.db.delete(id);
  return ids.length === batch;
}
