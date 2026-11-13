import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBlockedEitherWay } from "./blocks";
import { clockLabel, remindAt, sfDate, sfTime } from "./chatPlans";

/**
 * Landing's reminders (#134): the wording and timing, and the ledger that
 * keeps each reminder to one send. Functions are in convex/reminders.ts.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* ---------- Timing ---------- */

/** When an Event's day-of reminder goes out: 8am SF that day, or 2 hours before an earlier start. */
export const dayOfReminderAt = remindAt;

/** The end of `now`'s day in San Francisco (midnight), across daylight-saving changes. */
export function endOfSfDay(now: number): number {
  const tomorrow = sfDate(sfTime(sfDate(now), 12) + DAY);
  return sfTime(tomorrow, 0);
}

/**
 * The latest start whose reminder can be due at `now`: Events later today
 * (once it's 8am), or within 2 hours, whichever reaches further.
 */
export function dueWindowEnd(now: number): number {
  return Math.max(endOfSfDay(now), now + 2 * HOUR);
}

/* ---------- Wording ---------- */

/** "A", "A and B", "A, B and C". */
function list(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type EventForText = Pick<Doc<"events">, "title" | "startAt" | "venue" | "address" | "online">;

/** "Reminder: Run Club is today at 8 AM at Golden Gate Park." */
export function dayOfText(e: EventForText, now: number): string {
  const day = sfDate(e.startAt) === sfDate(now) ? "today" : "tomorrow";
  const place = e.online ? ", online" : e.venue || e.address ? ` at ${e.venue || e.address}` : "";
  return `Reminder: ${e.title} is ${day} at ${clockLabel(e.startAt)}${place}.`;
}

/**
 * "3 weeks in: 2 events, 1 Group and 2 new friends. Your check-in is ready."
 * Only what they did is counted, so a quiet week never reads as a shortfall.
 */
export function checkInText(
  days: number,
  done: { events: number; groups: number; friends: number },
): string {
  const weeks = Math.floor(days / 7);
  const parts = [
    done.events > 0 && count(done.events, "event", "events"),
    done.groups > 0 && count(done.groups, "Group", "Groups"),
    done.friends > 0 && count(done.friends, "new friend", "new friends"),
  ].filter((p): p is string => !!p);
  const head = weeks >= 1 ? `${count(weeks, "week", "weeks")} in` : "Your first week";
  if (parts.length) return `${head}: ${list(parts)}. Your check-in is ready.`;
  return weeks >= 1 ? `${head}: your check-in is ready.` : "Your first check-in is ready.";
}

/** "Muse has 2 drafts for you to review." */
export function draftsText(n: number): string {
  return n === 1
    ? "Muse has a draft for you to review."
    : `Muse has ${n} drafts for you to review.`;
}

/* ---------- The ledger ---------- */

export const eventReminderKey = (eventId: Id<"events">) => `event:${eventId}`;
export const checkInReminderKey = (weekOf: string) => `checkin:${weekOf}`;

export async function sentReminder(ctx: QueryCtx, userId: Id<"users">, key: string) {
  return ctx.db
    .query("reminders")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .first();
}

export async function recordReminder(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
  now: number,
  eventId?: Id<"events">,
) {
  await ctx.db.insert("reminders", { userId, key, sentAt: now, ...(eventId && { eventId }) });
}

/**
 * Whether an Event came from a chat plan (#34). Those are reminded in their
 * chat (a day-of message the owner approves), so they get no second reminder.
 * Chat-plan Events are private and hosted by the plan's owner; their plan was
 * touched recently, so the owner's newest plans are enough to check.
 */
export async function fromChatPlan(ctx: QueryCtx, e: Doc<"events">): Promise<boolean> {
  if (e.privacy !== "private") return false;
  const plans = await ctx.db
    .query("chatPlans")
    .withIndex("by_owner", (q) => q.eq("ownerId", e.hostId))
    .order("desc")
    .take(50);
  for (const plan of plans) {
    const p = plan.eventProposalId ? await ctx.db.get(plan.eventProposalId) : null;
    if (p?.result?.kind === "event" && p.result.eventId === e._id) return true;
  }
  return false;
}

/* ---------- Coming up (Reminders, Home timeline) ---------- */

/** Going RSVPs read for `upcomingReminders`, newest first. */
const UPCOMING_SCAN = 200;

export type UpcomingReminder = {
  event: {
    _id: Id<"events">;
    title: string;
    startAt: number;
    venue: string | null;
    online: boolean;
    cover: string;
  };
  /** When the day-of reminder goes out. */
  remindAt: number;
  /** "chat": a chat-plan Event, reminded in its chat instead. */
  via: "notification" | "chat";
  sentAt: number | null;
};

/**
 * A person's Events in the next 7 days that they're going to, soonest first
 * (at most `max`), with when each one's reminder goes out and whether it has.
 * Hosts blocked either way drop out. Call it only with the viewer's own id.
 */
export async function upcomingReminders(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
  max = Number.POSITIVE_INFINITY,
): Promise<UpcomingReminder[]> {
  const going = await ctx.db
    .query("eventResponses")
    .withIndex("by_user", (q) => q.eq("userId", userId).eq("status", "going"))
    .order("desc")
    .take(UPCOMING_SCAN);
  const soon: Doc<"events">[] = [];
  for (const r of going) {
    const e = await ctx.db.get(r.eventId);
    if (!e || e.startAt <= now || e.startAt > now + 7 * DAY) continue;
    if (await isBlockedEitherWay(ctx, userId, e.hostId)) continue;
    soon.push(e);
  }
  soon.sort((a, b) => a.startAt - b.startAt);
  return Promise.all(
    soon.slice(0, max).map(async (e) => ({
      event: {
        _id: e._id,
        title: e.title,
        startAt: e.startAt,
        venue: e.venue ?? null,
        online: e.online,
        cover: e.cover,
      },
      remindAt: dayOfReminderAt(e.startAt),
      via: (await fromChatPlan(ctx, e)) ? ("chat" as const) : ("notification" as const),
      sentAt: (await sentReminder(ctx, userId, eventReminderKey(e._id)))?.sentAt ?? null,
    })),
  );
}
