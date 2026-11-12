import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isBlockedEitherWay } from "./blocks";
import { notificationCategoryOf, settingsRow } from "./settings";

type NotificationInput = Omit<
  Doc<"notifications">,
  "_id" | "_creationTime" | "read" | "seen" | "createdAt"
>;

/**
 * Insert a notification unless the actor is notifying themselves, either has
 * blocked the other, or the recipient turned that category off in Settings.
 */
export async function notify(ctx: MutationCtx, n: NotificationInput) {
  if (n.actorId && n.actorId === n.userId) return;
  if (n.actorId && (await isBlockedEitherWay(ctx, n.userId, n.actorId))) return;
  const category = notificationCategoryOf(n.kind);
  if (category && (await settingsRow(ctx, n.userId))?.notificationsOff?.includes(category)) return;
  await ctx.db.insert("notifications", { ...n, read: false, seen: false, createdAt: Date.now() });
}
