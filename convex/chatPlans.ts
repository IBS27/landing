import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { blockedSet } from "./lib/blocks";
import {
  CHAT_PLAN_EVENT_TASK,
  CHAT_PLAN_REMINDER_TASK,
  CHAT_PLAN_TASK,
  CHATS_SCANNED,
  type ChatPlanOutput,
  chatLines,
  chatPlanTask,
  chatTitle,
  clockLabel,
  eventDescription,
  MESSAGES_SCANNED,
  type PlanContext,
  planContext,
  planExists,
  planRoute,
  planStage,
  planTalkActivity,
  planTemplate,
  pollClosesAt,
  remindAt,
  reminderText,
  spotTalk,
  TALK_WINDOW_MS,
} from "./lib/chatPlans";
import { sourceKey } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getInterest, type InterestId, interestId } from "./lib/interests";
import { pollClosed, pollOf, pollWinner, votesFor } from "./lib/polls";
import { executeProposal, inConversation, logEvent, propose } from "./lib/proposals";
import { getSummaries } from "./lib/users";
import { type Citations, citations, pollOption, proposalOrigin } from "./validators";

/**
 * Turn crew chat into real plans (#34): the "Plans from your chats" card, the
 * "Plan it" action, the poll's Event, and the hourly job that drafts the Event
 * when a poll closes and the day-of reminder. See ./lib/chatPlans.ts.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* ---------------- Reading a plan's state ---------------- */

async function planState(ctx: QueryCtx, plan: Doc<"chatPlans">, now: number) {
  const [pollP, eventP, reminderP] = await Promise.all([
    plan.pollProposalId ? ctx.db.get(plan.pollProposalId) : null,
    plan.eventProposalId ? ctx.db.get(plan.eventProposalId) : null,
    plan.reminderProposalId ? ctx.db.get(plan.reminderProposalId) : null,
  ]);
  const pollMsg =
    pollP?.result?.kind === "message" ? await ctx.db.get(pollP.result.messageId) : null;
  const poll = pollMsg && !pollMsg.unsent ? pollOf(pollMsg) : null;
  const votes = pollMsg && poll ? await votesFor(ctx, pollMsg._id) : [];
  const event = eventP?.result?.kind === "event" ? await ctx.db.get(eventP.result.eventId) : null;
  const stage = planStage(
    { poll: pollP, event: eventP, reminder: reminderP, eventStartAt: event?.startAt ?? null },
    now,
  );
  return { stage, pollMsg, poll, votes, event };
}

async function memberIds(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return rows.map((r) => r.userId);
}

async function titleOf(ctx: QueryCtx, conv: Doc<"conversations">, ownerId: Id<"users">) {
  if (conv.title?.trim()) return conv.title.trim();
  const others = (await memberIds(ctx, conv._id)).filter((id) => id !== ownerId);
  const people = await getSummaries(ctx, others);
  return chatTitle(
    conv,
    others.map((id) => people.get(id)?.firstName ?? "Someone"),
  );
}

/* ---------------- The card on Crew & Journeys ---------------- */

/** Plan talk in the viewer's group chats that has no plan yet, newest first. */
async function spottedTalk(ctx: QueryCtx, viewerId: Id<"users">, now: number) {
  const memberships = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", viewerId).gt("lastMessageAt", now - TALK_WINDOW_MS))
    .order("desc")
    .take(40);
  const blocked = await blockedSet(ctx, viewerId);
  const found: { conv: Doc<"conversations">; talk: ReturnType<typeof spotTalk>[number] }[] = [];
  let scanned = 0;
  for (const m of memberships) {
    if (scanned >= CHATS_SCANNED) break;
    const conv = await ctx.db.get(m.conversationId);
    if (conv?.kind !== "group") continue;
    scanned++;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conv._id).gt("createdAt", now - TALK_WINDOW_MS),
      )
      .order("desc")
      .take(MESSAGES_SCANNED);
    for (const talk of spotTalk(chatLines(rows, blocked).reverse(), now))
      if (!(await planExists(ctx, viewerId, conv._id, talk))) found.push({ conv, talk });
  }
  found.sort((a, b) => b.talk.createdAt - a.talk.createdAt);
  const shown = found.slice(0, 5);
  const people = await getSummaries(
    ctx,
    shown.flatMap((f) => [f.talk.senderId, ...f.talk.chimedIn] as Id<"users">[]),
  );
  return Promise.all(
    shown.map(async ({ conv, talk }) => {
      const interest = getInterest(talk.activity);
      const by = people.get(talk.senderId as Id<"users">);
      return {
        conversationId: conv._id,
        chat: await titleOf(ctx, conv, viewerId),
        messageId: talk.messageId as Id<"messages">,
        activity: { id: talk.activity, label: interest.label, emoji: interest.emoji },
        text: talk.text,
        at: talk.createdAt,
        by: by ? { firstName: by.firstName, avatar: by.avatar, isYou: by._id === viewerId } : null,
        chimedIn: talk.chimedIn
          .filter((id) => id !== viewerId)
          .map((id) => people.get(id as Id<"users">)?.firstName)
          .filter((n): n is string => !!n),
      };
    }),
  );
}

/** The viewer's plans that are still going, or ended this past week. */
async function planViews(ctx: QueryCtx, viewerId: Id<"users">, now: number) {
  const rows = await ctx.db
    .query("chatPlans")
    .withIndex("by_owner", (q) => q.eq("ownerId", viewerId))
    .order("desc")
    .take(20);
  const out = [];
  for (const plan of rows) {
    if (plan.dismissed || out.length >= 6) continue;
    const conv = await ctx.db.get(plan.conversationId);
    if (!conv || !(await inConversation(ctx, conv._id, viewerId))) continue;
    const s = await planState(ctx, plan, now);
    if (s.stage === "dropped") continue;
    if (s.stage === "done" && plan.updatedAt < now - 7 * DAY) continue;
    const others = (await memberIds(ctx, conv._id)).length - 1;
    const voters = s.votes.filter((x) => x.optionIds.length > 0).length;
    const leader = s.poll ? pollWinner(s.poll, s.votes, now) : null;
    out.push({
      _id: plan._id,
      title: plan.title,
      place: plan.place ?? null,
      route: plan.route,
      emoji: getInterest(plan.activity).emoji,
      conversationId: conv._id,
      chat: await titleOf(ctx, conv, viewerId),
      stage: s.stage,
      poll: s.poll
        ? {
            voters,
            members: others + 1,
            leader: leader ? { label: leader.label, votes: leader.votes } : null,
            closesAt: s.poll.closesAt ?? null,
            closed: pollClosed(s.poll, now),
          }
        : null,
      event: s.event ? { _id: s.event._id, title: s.event.title, startAt: s.event.startAt } : null,
    });
  }
  return out;
}

export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [spotted, plans] = await Promise.all([
      spottedTalk(ctx, ctx.viewer._id, now),
      planViews(ctx, ctx.viewer._id, now),
    ]);
    return { spotted, plans };
  },
});

/** "Not now": the talk leaves the card and Muse won't bring it up again. */
export const dismiss = viewerMutation({
  args: { conversationId: v.id("conversations"), messageId: v.id("messages") },
  handler: async (ctx, { conversationId, messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (
      !msg ||
      msg.conversationId !== conversationId ||
      !(await inConversation(ctx, conversationId, ctx.viewer._id))
    )
      throw new ConvexError("Chat not found");
    const activity = planTalkActivity(msg.text ?? "");
    if (!activity) throw new ConvexError("Muse doesn't see a plan in that message");
    const now = Date.now();
    await ctx.db.insert("chatPlans", {
      ownerId: ctx.viewer._id,
      conversationId,
      messageId,
      activity,
      title: "",
      route: [],
      dismissed: true,
      open: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/* ---------------- Step 1: Muse's plan and the poll ---------------- */

export const context = internalQuery({
  args: {
    ownerId: v.id("users"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  },
  handler: (ctx, a): Promise<PlanContext> =>
    planContext(ctx, a.ownerId, a.conversationId, a.messageId, Date.now()),
});

const planFields = v.object({
  title: v.string(),
  place: v.string(),
  route: v.array(v.string()),
  question: v.string(),
  text: v.string(),
  rationale: v.string(),
});

type StartArgs = {
  ownerId: Id<"users">;
  conversationId: Id<"conversations">;
  messageId: Id<"messages">;
  activity: InterestId;
  plan: Infer<typeof planFields>;
  options: Infer<typeof pollOption>[];
  citations?: Citations;
  origin: Infer<typeof proposalOrigin>;
  now: number;
  /** The owner pressed "Plan it" (not the seed). */
  byOwner?: boolean;
};

/** Stores the plan and proposes its poll message. Nothing is sent until the owner approves. */
async function startPlan(ctx: MutationCtx, a: StartArgs): Promise<Id<"proposals">> {
  const msg = await ctx.db.get(a.messageId);
  if (!msg || msg.conversationId !== a.conversationId) throw new ConvexError("Chat not found");
  const talk = { messageId: a.messageId, activity: a.activity, createdAt: msg.createdAt };
  if (await planExists(ctx, a.ownerId, a.conversationId, talk))
    throw new ConvexError("There's already a plan for this");
  if (!a.citations) throw new ConvexError("Muse couldn't find a source for this plan");
  const options = a.options.filter((o) => o.startAt === undefined || o.startAt > a.now + 12 * HOUR);
  if (options.length < 2) throw new ConvexError("Those times are too soon now. Try again");
  const closesAt = pollClosesAt(options, a.now);
  const pollProposalId = await propose(ctx, {
    ownerId: a.ownerId,
    payload: {
      kind: "message",
      conversationId: a.conversationId,
      text: a.plan.text.trim(),
      poll: { question: a.plan.question.trim(), options, closesAt },
    },
    rationale: a.plan.rationale,
    citations: a.citations,
    origin: a.origin,
    // A poll can't go out once it would already be closed.
    ttlMs: closesAt - a.now,
    byOwner: a.byOwner,
  });
  await ctx.db.insert("chatPlans", {
    ownerId: a.ownerId,
    conversationId: a.conversationId,
    messageId: a.messageId,
    activity: a.activity,
    title: a.plan.title.trim(),
    place: a.plan.place.trim() || undefined,
    route: a.plan.route.map((s) => s.trim()).filter(Boolean),
    citations: a.citations,
    pollProposalId,
    open: true,
    createdAt: a.now,
    updatedAt: a.now,
  });
  return pollProposalId;
}

export const start = internalMutation({
  args: {
    ownerId: v.id("users"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    activity: interestId,
    plan: planFields,
    options: v.array(pollOption),
    citations: v.optional(citations),
    origin: proposalOrigin,
  },
  handler: (ctx, a): Promise<Id<"proposals">> =>
    startPlan(ctx, { ...a, now: Date.now(), byOwner: true }),
});

/** The picked times as poll options, earliest first. */
function pollOptions(out: ChatPlanOutput, c: PlanContext) {
  return out.timeIds
    .map((id) => c.slots.find((s) => s.id === id))
    .filter((s) => s !== undefined)
    .sort((a, b) => a.startAt - b.startAt)
    .map((s) => ({ id: s.id, label: s.label, startAt: s.startAt }));
}

/**
 * "Plan it": Muse reads the chat, suggests a place, route and times from cited
 * sources, and drafts the poll for the owner's approval in Landing Inbox.
 */
export const plan = action({
  args: {
    viewerId: v.id("users"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, { viewerId, conversationId, messageId }): Promise<Id<"proposals">> => {
    const c = await ctx.runQuery(internal.chatPlans.context, {
      ownerId: viewerId,
      conversationId,
      messageId,
    });
    const r = await runAgent(ctx, chatPlanTask, {
      input: c.input,
      sources: c.sources,
      shownTo: viewerId,
    });
    return ctx.runMutation(internal.chatPlans.start, {
      ownerId: viewerId,
      conversationId,
      messageId,
      activity: c.activity,
      plan: {
        title: r.output.title,
        place: r.output.place,
        route: planRoute(c.input.places.find((p) => p.source === r.output.placeSource)),
        question: r.output.question,
        text: r.output.text,
        rationale: r.output.rationale,
      },
      options: pollOptions(r.output, c),
      citations: r.cited ?? undefined,
      origin: { agent: "muse", task: CHAT_PLAN_TASK, runId: r.runId, via: r.via },
    });
  },
});

/* ---------------- Step 2: the Event from the poll ---------------- */

/**
 * Proposes the Event at the poll's winning time, inviting the chat. Plain code
 * writes it from the plan. Null when nobody picked a time that's still ahead.
 */
async function proposeEventFor(
  ctx: MutationCtx,
  plan: Doc<"chatPlans">,
  now: number,
  byOwner = false,
): Promise<Id<"proposals"> | null> {
  const s = await planState(ctx, plan, now);
  if (s.stage !== "polling") throw new ConvexError("This plan isn't at the poll anymore");
  const winner = s.poll ? pollWinner(s.poll, s.votes, now + 2 * HOUR) : null;
  if (!winner || winner.startAt === undefined || !plan.citations) return null;
  const conv = await ctx.db.get(plan.conversationId);
  if (!conv) return null;
  const chat = await titleOf(ctx, conv, plan.ownerId);
  const blocked = await blockedSet(ctx, plan.ownerId);
  const invite = (await memberIds(ctx, conv._id)).filter(
    (id) => id !== plan.ownerId && !blocked.has(id),
  );
  const voters = s.votes.filter((x) => x.optionIds.length > 0).length;
  const id = await propose(ctx, {
    ownerId: plan.ownerId,
    payload: {
      kind: "event",
      title: plan.title,
      description: eventDescription(plan, chat, winner.votes),
      startAt: winner.startAt,
      venue: plan.place,
      conversationId: conv._id,
      inviteIds: invite,
    },
    rationale: `${winner.votes} of ${voters} who voted in ${chat} picked ${winner.label}.`,
    citations: plan.citations,
    origin: { agent: "muse", task: CHAT_PLAN_EVENT_TASK, via: "fallback" },
    ttlMs: Math.max(HOUR, winner.startAt - now - HOUR),
    byOwner,
  });
  await ctx.db.patch(plan._id, { eventProposalId: id, updatedAt: now });
  return id;
}

/** "Make it an Event": draft the Event now instead of waiting for the poll to close. */
export const proposeEvent = viewerMutation({
  args: { planId: v.id("chatPlans") },
  handler: async (ctx, { planId }): Promise<Id<"proposals">> => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.ownerId !== ctx.viewer._id || plan.dismissed)
      throw new ConvexError("Plan not found");
    const id = await proposeEventFor(ctx, plan, Date.now(), true);
    if (!id) throw new ConvexError("Nobody has picked a time that's still ahead yet");
    return id;
  },
});

/* ---------------- Step 3: the day-of reminder ---------------- */

async function proposeReminder(
  ctx: MutationCtx,
  plan: Doc<"chatPlans">,
  event: Doc<"events">,
  now: number,
) {
  const conv = await ctx.db.get(plan.conversationId);
  if (!conv) return;
  const going = await ctx.db
    .query("eventResponses")
    .withIndex("by_event", (q) => q.eq("eventId", event._id).eq("status", "going"))
    .take(100);
  const chat = await titleOf(ctx, conv, plan.ownerId);
  const id = await propose(ctx, {
    ownerId: plan.ownerId,
    payload: {
      kind: "message",
      conversationId: conv._id,
      text: reminderText({
        emoji: getInterest(plan.activity).emoji,
        title: event.title,
        startAt: event.startAt,
        place: event.venue ?? plan.place,
        route: plan.route,
        going: going.length,
      }),
    },
    rationale: `${event.title} is today at ${clockLabel(event.startAt)}. A reminder in ${chat} helps everyone make it.`,
    origin: { agent: "muse", task: CHAT_PLAN_REMINDER_TASK, via: "fallback" },
    ttlMs: Math.max(15 * MINUTE, event.startAt - now),
  });
  await ctx.db.patch(plan._id, { reminderProposalId: id, updatedAt: now });
}

/* ---------------- The hourly job ---------------- */

/** Moves one open plan along. True when it proposed something. */
async function advance(ctx: MutationCtx, plan: Doc<"chatPlans">, now: number): Promise<boolean> {
  const s = await planState(ctx, plan, now);
  const close = () => ctx.db.patch(plan._id, { open: false, updatedAt: now });
  switch (s.stage) {
    case "dropped":
    case "done":
      await close();
      return false;
    case "polling": {
      if (!s.poll) return false;
      if (s.poll.options.every((o) => o.startAt !== undefined && o.startAt <= now)) {
        await close();
        return false;
      }
      // Once, when the poll closes; a discarded Event waits for the owner.
      if (plan.eventProposalId || !pollClosed(s.poll, now)) return false;
      const id = await proposeEventFor(ctx, plan, now);
      if (!id) await close();
      return id !== null;
    }
    case "scheduled": {
      if (plan.reminderProposalId || !s.event) return false;
      if (now < remindAt(s.event.startAt) || now > s.event.startAt - 15 * MINUTE) return false;
      await proposeReminder(ctx, plan, s.event, now);
      return true;
    }
    default:
      return false;
  }
}

/** Open plans read per run of the hourly job; the rest go to the next page. */
const TICK_PAGE = 100;

/**
 * Hourly (convex/crons.ts): draft the Event for polls that closed and the
 * day-of reminder for today's Events, and close plans that are over. Plain
 * code, no model calls. Pages through open plans, one mutation per page.
 * `now` is for tests.
 */
export const tick = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const page = await ctx.db
      .query("chatPlans")
      .withIndex("by_open", (q) => q.eq("open", true))
      .paginate({ cursor: args.cursor ?? null, numItems: TICK_PAGE });
    let proposed = 0;
    for (const plan of page.page) {
      try {
        if (await advance(ctx, plan, now)) proposed++;
      } catch (e) {
        // One plan whose chat or sources changed shouldn't stop the rest.
        console.warn(`chatPlans.tick: ${plan._id}:`, e instanceof Error ? e.message : e);
      }
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.chatPlans.tick, {
        now,
        cursor: page.continueCursor,
      });
    return proposed;
  },
});

/* ---------------- Seed ---------------- */

/** Plans the talk about `activity` in Maya's chat `title`, with the template (AI is off in the seed). */
async function seedPlan(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  title: string,
  activity: InterestId,
  now: number,
): Promise<Id<"proposals"> | null> {
  const memberships = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", ownerId))
    .collect();
  for (const m of memberships) {
    const conv = await ctx.db.get(m.conversationId);
    if (conv?.kind !== "group" || conv.title !== title) continue;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .order("desc")
      .take(MESSAGES_SCANNED);
    const talk = spotTalk(chatLines(rows).reverse(), now).find((t) => t.activity === activity);
    if (!talk) return null;
    const messageId = talk.messageId as Id<"messages">;
    const c = await planContext(ctx, ownerId, conv._id, messageId, now);
    const out = planTemplate(c.input);
    const source = c.sources.find((s) => sourceKey(s) === out.placeSource);
    return startPlan(ctx, {
      ownerId,
      conversationId: conv._id,
      messageId,
      activity: c.activity,
      plan: { ...out, route: planRoute(c.input.places.find((p) => p.source === out.placeSource)) },
      options: pollOptions(out, c),
      citations: source ? { first: source, rest: [] } : undefined,
      origin: { agent: "muse", task: CHAT_PLAN_TASK, via: "fallback" },
      now,
    });
  }
  return null;
}

/**
 * Seed (#34), after the proposals demo. In Maya's Move-in Crew chat, the hike
 * talk already has a poll out with a few votes; in Roomies 🏠, Muse's
 * farmers market poll waits in Inbox. The karaoke talk in Cal capstone team is
 * left for a live "Plan it".
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const maya = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "maya.chen"))
      .unique();
    if (!maya) return 0;
    const now = Date.now();
    let made = 0;
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        made++;
      } catch (e) {
        console.warn("chatPlans.seedDemo skipped a plan:", e instanceof Error ? e.message : e);
      }
    };

    await safe(async () => {
      const id = await seedPlan(ctx, maya._id, "SF move-in crew 🌉", "hiking", now);
      const p = id ? await ctx.db.get(id) : null;
      if (!p) throw new Error("no hike talk to plan");
      const result = await executeProposal(ctx, p);
      await ctx.db.patch(p._id, { status: "approved", result, decidedAt: now, updatedAt: now });
      await logEvent(ctx, p._id, maya._id, "approved", "owner", now);
      if (result.kind !== "message" || p.payload.kind !== "message" || !p.payload.poll) return;
      const [first, second] = p.payload.poll.options;
      const votes: [string, (string | undefined)[]][] = [
        ["zoe.nguyen", [first?.id, second?.id]],
        ["daniel.reyes", [second?.id]],
        ["ethan.park", [second?.id]],
      ];
      for (const [username, ids] of votes) {
        const u = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique();
        const optionIds = ids.filter((x): x is string => !!x);
        if (!u || !optionIds.length) continue;
        await ctx.db.insert("pollVotes", {
          messageId: result.messageId,
          conversationId: p.payload.conversationId,
          userId: u._id,
          optionIds,
          updatedAt: now,
        });
      }
    });
    await safe(async () => {
      if (!(await seedPlan(ctx, maya._id, "Roomies 🏠", "farmers_markets", now)))
        throw new Error("no farmers market talk to plan");
    });
    return made;
  },
});
