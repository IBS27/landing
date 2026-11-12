import { v } from "convex/values";
import type { TableNames } from "../_generated/dataModel";
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

/** The ids that aren't ids of the given table (a model can copy an id into the wrong field). */
export const wrongTableIds = internalQuery({
  args: { ids: v.array(v.object({ id: v.string(), table: v.string() })) },
  handler: (ctx, { ids }) =>
    ids
      .filter(({ id, table }) => ctx.db.normalizeId(table as TableNames, id) === null)
      .map(({ id }) => id),
});
