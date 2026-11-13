import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { isBlockedEitherWay } from "./lib/blocks";
import { viewerQuery } from "./lib/functions";
import { notify } from "./lib/notify";
import { DRAFTS_DEBOUNCE_MS, DRAFTS_MAX_WAIT_MS, waitingProposals } from "./lib/proposals";
import {
  dayOfReminderAt,
  dayOfText,
  draftsText,
  dueWindowEnd,
  eventReminderKey,
  fromChatPlan,
  recordReminder,
  sentReminder,
} from "./lib/reminders";

/**
 * Landing's reminders (#134), all plain code:
 * - Day-of Event reminders: the morning of an Event you're going to (`tick`,
 *   hourly, then `remindEvent` per Event).
 * - "Muse has 2 drafts for you to review" (`draftsReady`, debounced after
 *   each Muse proposal).
 * - The weekly check-in notification is sent by `checkIns.writeCheckIns`.
 * The `reminders` table records each send, so retries never repeat one.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Events read per `tick` mutation. */
const EVENTS_PAGE = 50;
/** Going RSVPs read per `remindEvent` mutation. */
const GOING_PAGE = 100;

/* ---------- Day-of Event reminders ---------- */

/**
 * Hourly (convex/crons.ts): finds Events whose reminder time has come and
 * that haven't started, and hands each to `remindEvent`. Pages through the
 * Events starting before the end of today (SF), one mutation per page.
 * `now` is for tests.
 */
export const tick = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const page = await ctx.db
      .query("events")
      .withIndex("by_start", (q) => q.gt("startAt", now).lte("startAt", dueWindowEnd(now)))
      .paginate({ cursor: args.cursor ?? null, numItems: EVENTS_PAGE });
    let due = 0;
    for (const e of page.page) {
      if (dayOfReminderAt(e.startAt) > now) continue;
      await ctx.scheduler.runAfter(0, internal.reminders.remindEvent, {
        eventId: e._id,
        now,
        cursor: null,
      });
      due++;
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.reminders.tick, {
        now,
        cursor: page.continueCursor,
      });
    return due;
  },
});

/** Reminds one page of an Event's Going RSVPs, then schedules the next page. */
export const remindEvent = internalMutation({
  args: {
    eventId: v.id("events"),
    now: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { eventId, now, cursor }) => {
    const e = await ctx.db.get(eventId);
    if (!e || e.startAt <= now || dayOfReminderAt(e.startAt) > now) return 0;
    if (await fromChatPlan(ctx, e)) return 0;
    const page = await ctx.db
      .query("eventResponses")
      .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
      .paginate({ cursor, numItems: GOING_PAGE });
    let sent = 0;
    for (const r of page.page) if (await remindOne(ctx, e, r, now)) sent++;
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.reminders.remindEvent, {
        eventId,
        now,
        cursor: page.continueCursor,
      });
    return sent;
  },
});

/**
 * One person's day-of reminder, at most once per Event. Skipped when they
 * RSVP'd after the reminder time (they just decided), either of them blocked
 * the other, or they turned Events notifications off.
 */
async function remindOne(
  ctx: MutationCtx,
  e: Doc<"events">,
  r: Doc<"eventResponses">,
  now: number,
): Promise<boolean> {
  if (r.createdAt > dayOfReminderAt(e.startAt)) return false;
  const key = eventReminderKey(e._id);
  if (await sentReminder(ctx, r.userId, key)) return false;
  if (await isBlockedEitherWay(ctx, r.userId, e.hostId)) return false;
  const id = await notify(ctx, {
    userId: r.userId,
    kind: "event_reminder",
    text: dayOfText(e, now),
    eventId: e._id,
  });
  if (!id) return false;
  await recordReminder(ctx, r.userId, key, now, e._id);
  return true;
}

/* ---------- Muse drafts waiting in Landing Inbox ---------- */

/**
 * Scheduled `DRAFTS_DEBOUNCE_MS` after each Muse proposal. Once no new draft
 * has arrived for that long (or the oldest unannounced one has waited
 * `DRAFTS_MAX_WAIT_MS`), one notification counts everything Muse has waiting
 * and replaces any unread earlier one. Drafts the owner asked for are left
 * out, and each draft is announced once.
 */
export const draftsReady = internalMutation({
  args: { ownerId: v.id("users"), now: v.optional(v.number()) },
  handler: async (ctx, { ownerId, now: at }) => {
    const now = at ?? Date.now();
    const { rows } = await waitingProposals(ctx, ownerId, now);
    const muse = rows.filter((p) => !p.byOwner);
    const fresh = muse.filter((p) => p.notifiedAt === undefined);
    if (fresh.length === 0) return false;
    const newest = Math.max(...fresh.map((p) => p.createdAt));
    const oldest = Math.min(...fresh.map((p) => p.createdAt));
    // A later run, scheduled by the newest draft, sends it.
    if (now < newest + DRAFTS_DEBOUNCE_MS && now < oldest + DRAFTS_MAX_WAIT_MS) return false;

    const earlier = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ownerId).gt("createdAt", now - 7 * DAY))
      .order("desc")
      .take(200);
    for (const n of earlier) if (n.kind === "landing_drafts" && !n.read) await ctx.db.delete(n._id);
    for (const p of fresh) await ctx.db.patch(p._id, { notifiedAt: now });
    const id = await notify(ctx, {
      userId: ownerId,
      kind: "landing_drafts",
      text: draftsText(muse.length),
    });
    return id !== null;
  },
});

/* ---------- For the Home timeline ---------- */

/** Going RSVPs read for `upcoming`, newest first. */
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
 * The viewer's Events in the next 7 days that they're going to, soonest
 * first, with when each one's reminder goes out and whether it has.
 */
export const upcoming = viewerQuery({
  args: {},
  handler: async (ctx): Promise<UpcomingReminder[]> => {
    const now = Date.now();
    const viewerId = ctx.viewer._id;
    const going = await ctx.db
      .query("eventResponses")
      .withIndex("by_user", (q) => q.eq("userId", viewerId).eq("status", "going"))
      .order("desc")
      .take(UPCOMING_SCAN);
    const out: UpcomingReminder[] = [];
    for (const r of going) {
      const e = await ctx.db.get(r.eventId);
      if (!e || e.startAt <= now || e.startAt > now + 7 * DAY) continue;
      if (await isBlockedEitherWay(ctx, viewerId, e.hostId)) continue;
      const sent = await sentReminder(ctx, viewerId, eventReminderKey(e._id));
      out.push({
        event: {
          _id: e._id,
          title: e.title,
          startAt: e.startAt,
          venue: e.venue ?? null,
          online: e.online,
          cover: e.cover,
        },
        remindAt: dayOfReminderAt(e.startAt),
        via: (await fromChatPlan(ctx, e)) ? "chat" : "notification",
        sentAt: sent?.sentAt ?? null,
      });
    }
    return out.sort((a, b) => a.event.startAt - b.event.startAt);
  },
});
