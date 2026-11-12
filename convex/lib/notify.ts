import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type NotificationInput = Omit<
  Doc<"notifications">,
  "_id" | "_creationTime" | "read" | "seen" | "createdAt"
>;

/** Insert a notification unless the actor is notifying themselves. */
export async function notify(ctx: MutationCtx, n: NotificationInput) {
  if (n.actorId && n.actorId === n.userId) return;
  await ctx.db.insert("notifications", { ...n, read: false, seen: false, createdAt: Date.now() });
}
