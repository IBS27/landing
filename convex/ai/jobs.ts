import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { viewerQuery } from "../lib/functions";
import { aiJobStatus } from "../validators";

/**
 * Long AI work runs on the Convex scheduler and reports progress through an
 * `aiJobs` row the UI subscribes to (`api.ai.jobs.get`). Results land in the
 * feature's own tables or as proposals, never on the job row.
 *
 *   // mutation
 *   const jobId = await startJob(ctx, {
 *     kind: "weekendRoute", key: neighborhoodId,
 *     action: internal.weekendRoutes.generate, args: { neighborhoodId },
 *   });
 *
 *   // internal action
 *   export const generate = internalAction({
 *     args: { jobId: v.id("aiJobs"), neighborhoodId: v.id("neighborhoods") },
 *     handler: (ctx, { jobId, neighborhoodId }) =>
 *       runJob(ctx, jobId, async (progress) => {
 *         await progress("Reading Group threads", 1, 2);
 *         const route = await runAgent(ctx, weekendRoute, { input, sources, jobId });
 *         await ctx.runMutation(internal.weekendRoutes.save, { ... });
 *       }),
 *   });
 */

/**
 * A job still queued or running this long after it was created has died
 * (actions stop at 10 minutes, and scheduled actions aren't retried). It is
 * marked failed so the UI stops waiting, and a new `startJob` replaces it.
 */
const STALE_MS = 15 * 60_000;

/**
 * Schedules `action` with `{ ...args, jobId }`, unless a live job with the same
 * kind, key and owner already exists, in which case that job's id is returned.
 */
export async function startJob<A extends { jobId: Id<"aiJobs"> }>(
  ctx: MutationCtx,
  opts: {
    kind: string;
    key: string;
    userId?: Id<"users">;
    action: FunctionReference<"action", "internal", A>;
    args: Omit<A, "jobId">;
  },
): Promise<Id<"aiJobs">> {
  const now = Date.now();
  const live = await ctx.db
    .query("aiJobs")
    .withIndex("by_kind_key", (q) =>
      q
        .eq("kind", opts.kind)
        .eq("key", opts.key)
        .gte("createdAt", now - STALE_MS),
    )
    .order("desc")
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), opts.userId),
        q.or(q.eq(q.field("status"), "queued"), q.eq(q.field("status"), "running")),
      ),
    )
    .first();
  if (live) return live._id;

  const jobId = await ctx.db.insert("aiJobs", {
    kind: opts.kind,
    key: opts.key,
    userId: opts.userId,
    status: "queued",
    createdAt: now,
  });
  // The args are type-checked against the action at the call site; the generic can't be here.
  const action = opts.action as FunctionReference<"action", "internal">;
  await ctx.scheduler.runAfter(0, action, { ...opts.args, jobId });
  await ctx.scheduler.runAfter(STALE_MS, internal.ai.jobs.expire, { jobId });
  return jobId;
}

export type Progress = (label: string, done: number, total: number) => Promise<void>;

/** Runs a job's work, marking it running, then succeeded or failed. */
export async function runJob(
  ctx: ActionCtx,
  jobId: Id<"aiJobs">,
  work: (progress: Progress) => Promise<void>,
) {
  await ctx.runMutation(internal.ai.jobs.update, { jobId, status: "running" });
  try {
    await work(async (label, done, total) => {
      await ctx.runMutation(internal.ai.jobs.update, { jobId, progress: { label, done, total } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.ai.jobs.update, { jobId, status: "failed", error: message });
    throw error;
  }
  await ctx.runMutation(internal.ai.jobs.update, { jobId, status: "succeeded" });
}

export const update = internalMutation({
  args: {
    jobId: v.id("aiJobs"),
    status: v.optional(aiJobStatus),
    progress: v.optional(v.object({ label: v.string(), done: v.number(), total: v.number() })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, status, progress, error }) => {
    const now = Date.now();
    await ctx.db.patch(jobId, {
      ...(status && { status }),
      ...(status === "running" && { startedAt: now }),
      ...((status === "succeeded" || status === "failed") && { finishedAt: now }),
      ...(progress && { progress }),
      ...(error !== undefined && { error }),
    });
  },
});

/** Marks a job failed if it never finished (its action crashed or timed out). */
export const expire = internalMutation({
  args: { jobId: v.id("aiJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (job && (job.status === "queued" || job.status === "running"))
      await ctx.db.patch(jobId, { status: "failed", error: "Timed out", finishedAt: Date.now() });
  },
});

/** A job's status and progress, for the UI. Jobs with an owner are visible only to that owner. */
export const get = viewerQuery({
  args: { jobId: v.id("aiJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || (job.userId && job.userId !== ctx.viewer._id)) return null;
    return {
      _id: job._id,
      kind: job.kind,
      status: job.status,
      progress: job.progress ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt ?? null,
    };
  },
});
