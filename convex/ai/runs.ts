import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { aiRun } from "../validators";

/** The newest model result for this input, if it's no older than `since`. */
export const cached = internalQuery({
  args: { inputHash: v.string(), since: v.number() },
  handler: (ctx, { inputHash, since }) =>
    ctx.db
      .query("aiRuns")
      .withIndex("by_hash", (q) =>
        q.eq("inputHash", inputHash).eq("outcome", "model").gte("createdAt", since),
      )
      .order("desc")
      .first(),
});

/** The only write `runAgent` makes. */
export const log = internalMutation({
  args: aiRun.fields,
  handler: (ctx, run) => ctx.db.insert("aiRuns", run),
});
