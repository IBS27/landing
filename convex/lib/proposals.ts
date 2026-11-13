import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Citations, Poll, ProposalPayload } from "../validators";
import { blockedSet, dmBlockNotice } from "./blocks";
import { assertCitable, resolveCitations } from "./citations";
import { CREW_TASKS, crewMateIds } from "./crewMembers";
import { afterChatMessage } from "./negotiations";
import { notify } from "./notify";
import { type Audience, loadAudience } from "./posts";
import { friendIds } from "./users";

/**
 * Muse proposals: the only path from anything Muse writes to anything that is
 * sent or created on someone's behalf.
 *
 * - Agent code calls `propose()` (or `internal.proposals.propose` from an
 *   action). It stores the proposal and, for messages and offers, a
 *   `pending_approval` draft only the owner can see. Nothing is sent.
 * - The owner approves, edits or discards it (convex/proposals.ts). Only
 *   `approve` calls `executeProposal()`, which performs the real action.
 * - Offers expire after a day, everything else after a week.
 */

export const OFFER_TTL_MS = 24 * 60 * 60 * 1000;
export const POLL_MAX_OPTIONS = 6;
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A Muse draft waits this long for more before the Inbox notification goes out… */
export const DRAFTS_DEBOUNCE_MS = 10 * 60 * 1000;
/** …but never longer than this after the oldest one it counts. */
export const DRAFTS_MAX_WAIT_MS = 60 * 60 * 1000;

export type ProposeArgs = {
  ownerId: Id<"users">;
  payload: ProposalPayload;
  /** One line on why Muse suggests this ("You both climb and start in June"). */
  rationale: string;
  /** Required for recommendations (offers, Events, Groups); optional for plain replies. */
  citations?: Citations;
  origin: Doc<"proposals">["origin"];
  /** Defaults to OFFER_TTL_MS for offers and DEFAULT_TTL_MS for the rest. */
  ttlMs?: number;
  /**
   * The owner asked for this draft just now ("Plan it", "Ask to connect"), so
   * it isn't announced. Muse's own drafts get a batched Inbox notification.
   */
  byOwner?: boolean;
};

export async function propose(ctx: MutationCtx, a: ProposeArgs): Promise<Id<"proposals">> {
  const rationale = a.rationale.trim();
  if (!rationale) throw new ConvexError("A proposal needs a rationale");
  await assertPayload(ctx, a.ownerId, a.payload, a.origin);
  if (a.citations) await assertCitable(ctx, a.citations, await loadAudience(ctx, a.ownerId));
  else if (a.payload.kind !== "message")
    throw new ConvexError("Recommendations need citations; only plain replies may skip them");

  const now = Date.now();
  const ttl = a.ttlMs ?? (a.payload.kind === "offer" ? OFFER_TTL_MS : DEFAULT_TTL_MS);
  const draftMessageId = await insertDraft(ctx, a.ownerId, a.payload, a.origin.agent, now);
  const proposalId = await ctx.db.insert("proposals", {
    ownerId: a.ownerId,
    payload: a.payload,
    rationale,
    citations: a.citations,
    origin: a.origin,
    status: "pending",
    expiresAt: now + ttl,
    draftMessageId,
    createdAt: now,
    updatedAt: now,
    ...(a.byOwner && { byOwner: true }),
  });
  await logEvent(ctx, proposalId, a.ownerId, "created", "agent", now);
  await ctx.scheduler.runAt(now + ttl, internal.proposals.expire, { proposalId });
  // Debounced: each draft pushes the check back, so a burst becomes one notification.
  if (!a.byOwner)
    await ctx.scheduler.runAfter(DRAFTS_DEBOUNCE_MS, internal.reminders.draftsReady, {
      ownerId: a.ownerId,
    });
  return proposalId;
}

/**
 * The owner's pending proposals that are still live and actionable: not
 * expired, every cited source still visible to them, and its chat or Group
 * still theirs. The inbox, its badge, the chat drafts and the Inbox
 * notification all use this set.
 */
export async function waitingProposals(ctx: QueryCtx, ownerId: Id<"users">, now: number) {
  const rows = await ctx.db
    .query("proposals")
    .withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId).eq("status", "pending"))
    .collect();
  const a = await loadAudience(ctx, ownerId);
  const ok = await Promise.all(
    rows.map(
      async (p) =>
        !isExpired(p, now) &&
        (await citationsVisible(ctx, p, a)) &&
        (await targetReachable(ctx, p)),
    ),
  );
  return { rows: rows.filter((_, i) => ok[i]), audience: a };
}

/** Checks the owner may do what the payload says, before it's stored or sent. */
export async function assertPayload(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  p: ProposalPayload,
  origin: Doc<"proposals">["origin"],
): Promise<void> {
  const crewOnly = origin.task !== undefined && CREW_TASKS.has(origin.task);
  switch (p.kind) {
    case "message":
    case "offer": {
      if (!p.text.trim()) throw new ConvexError("The message is empty");
      const conv = await ctx.db.get(p.conversationId);
      if (!conv || !(await inConversation(ctx, p.conversationId, ownerId)))
        throw new ConvexError("Not in this conversation");
      // Same rule as `messenger.send`: nothing goes across a block.
      const blocked = await dmBlockNotice(ctx, conv, ownerId);
      if (blocked) throw new ConvexError(blocked);
      if (p.kind === "message" && p.poll) assertPoll(p.poll);
      if (p.kind === "offer") {
        if (!Number.isInteger(p.amount) || p.amount < 0)
          throw new ConvexError("Offers are whole dollars");
        if (conv.kind !== "marketplace" || conv.listingId !== p.listingId)
          throw new ConvexError("Offers go in the listing's own chat");
        const listing = await ctx.db.get(p.listingId);
        if (!listing || listing.status === "sold") throw new ConvexError("Listing not available");
        // The sent message carries the amount only in its text, so they must agree.
        if (!statesAmount(p.text, p.amount))
          throw new ConvexError(`The message should say the offer amount, $${p.amount}`);
      }
      return;
    }
    case "event": {
      if (!p.title.trim()) throw new ConvexError("Name the event");
      if (p.startAt < Date.now()) throw new ConvexError("The event is in the past");
      if (p.groupId && !(await inGroup(ctx, p.groupId, ownerId)))
        throw new ConvexError("You're not in this group");
      if (p.conversationId && !(await inConversation(ctx, p.conversationId, ownerId)))
        throw new ConvexError("Not in this conversation");
      return assertInvitable(ctx, ownerId, p.inviteIds, crewOnly, p.conversationId);
    }
    case "group": {
      const name = p.name.trim();
      if (!name) throw new ConvexError("Name the group");
      if (name.length > 75) throw new ConvexError("Group names can be up to 75 characters");
      return assertInvitable(ctx, ownerId, p.inviteIds, crewOnly);
    }
  }
}

export async function inConversation(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
  return row !== null;
}

export async function inGroup(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
  return row !== null;
}

/**
 * Whether the owner can still reach where a proposal goes: they're still in its
 * chat, or in the Group its Event is for. If not, it can't be approved, and the
 * chat's or Group's details are no longer theirs to see.
 */
export async function targetReachable(ctx: QueryCtx, p: Doc<"proposals">): Promise<boolean> {
  const pay = p.payload;
  if (pay.kind === "message" || pay.kind === "offer")
    return inConversation(ctx, pay.conversationId, p.ownerId);
  if (pay.kind === "event" && pay.groupId) return inGroup(ctx, pay.groupId, p.ownerId);
  if (pay.kind === "event" && pay.conversationId)
    return inConversation(ctx, pay.conversationId, p.ownerId);
  return true;
}

/** The ways offer text may write `amount` in whole dollars ("$1200" or "$1,200"). */
export function amountSpellings(amount: number): string[] {
  return [...new Set([`$${amount}`, `$${amount.toLocaleString("en-US")}`])];
}

/** Whether `text` names `amount` in whole dollars ("$80", but not the start of "$800" or "$80.50"). */
export function statesAmount(text: string, amount: number): boolean {
  return amountSpellings(amount).some((d) =>
    new RegExp(`${d.replace(/[$,]/g, "\\$&")}(?!\\d|[.,]\\d)`).test(text),
  );
}

/** A poll has a question and 2–6 distinct, short options. */
function assertPoll(poll: Poll) {
  const q = poll.question.trim();
  if (!q || q.length > 140) throw new ConvexError("A poll needs a question (up to 140 characters)");
  if (poll.options.length < 2 || poll.options.length > POLL_MAX_OPTIONS)
    throw new ConvexError(`A poll has 2 to ${POLL_MAX_OPTIONS} options`);
  const ids = new Set(poll.options.map((o) => o.id));
  if (ids.size !== poll.options.length || ids.has(""))
    throw new ConvexError("Poll options need distinct ids");
  if (poll.options.some((o) => !o.label.trim() || o.label.length > 60))
    throw new ConvexError("Poll options are 1 to 60 characters");
}

/**
 * Muse invites only the owner's friends, or people in their Move-in Crew (#30,
 * #31): crew members opted in to being matched, but aren't friends yet. A crew
 * Group or meetup (`crewOnly`) invites only the current crew, friends or not.
 * An Event planned in a group chat (#34) invites only that chat's members, so
 * what it says about the chat stays with them.
 * Checked again on approval, so someone who left the crew or chat, or is
 * blocked, can't be invited.
 */
async function assertInvitable(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  ids: Id<"users">[],
  crewOnly: boolean,
  conversationId?: Id<"conversations">,
) {
  if (conversationId && !crewOnly) {
    const [members, blocked] = await Promise.all([
      ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .collect(),
      blockedSet(ctx, ownerId),
    ]);
    const inChat = new Set(members.map((r) => r.userId));
    if (ids.some((id) => !inChat.has(id) || blocked.has(id)))
      throw new ConvexError("Muse can only invite people in this chat");
    return;
  }
  const friends = crewOnly ? new Set<Id<"users">>() : new Set(await friendIds(ctx, ownerId));
  const others = ids.filter((id) => !friends.has(id));
  if (others.length === 0) return;
  const crew = await crewMateIds(ctx, ownerId);
  if (others.some((id) => !crew.has(id)))
    throw new ConvexError(
      crewOnly
        ? "Someone here isn't in your Move-in Crew anymore"
        : "Muse can only invite your friends or your Move-in Crew",
    );
}

/**
 * An edit may change the wording, amount, time or invitees, but not the kind
 * or where it goes (the chat or listing).
 */
export function assertSameTarget(before: ProposalPayload, after: ProposalPayload) {
  if (before.kind !== after.kind)
    throw new ConvexError("Can't change what kind of proposal this is");
  if (
    (before.kind === "message" || before.kind === "offer") &&
    (after.kind === "message" || after.kind === "offer") &&
    before.conversationId !== after.conversationId
  )
    throw new ConvexError("Can't move a draft to another chat");
  if (before.kind === "offer" && after.kind === "offer" && before.listingId !== after.listingId)
    throw new ConvexError("Can't move an offer to another listing");
  if (before.kind === "event" && after.kind === "event" && before.groupId !== after.groupId)
    throw new ConvexError("Can't move an event to another group");
  if (
    before.kind === "event" &&
    after.kind === "event" &&
    before.conversationId !== after.conversationId
  )
    throw new ConvexError("Can't move an event to another chat");
  if (
    before.kind === "message" &&
    after.kind === "message" &&
    JSON.stringify(before.poll ?? null) !== JSON.stringify(after.poll ?? null)
  )
    throw new ConvexError("Can't change a poll's options");
}

/**
 * Offer drafts carry the listing as an attachment so the chat shows what it's
 * for, and a message with a poll carries the poll (#34).
 */
function draftFields(p: ProposalPayload) {
  if (p.kind === "message")
    return {
      text: p.text.trim(),
      attachments: p.poll ? [{ kind: "poll" as const, ...p.poll }] : [],
    };
  if (p.kind === "offer")
    return {
      text: p.text.trim(),
      attachments: [{ kind: "listing" as const, listingId: p.listingId }],
    };
  return null;
}

async function insertDraft(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  p: ProposalPayload,
  agent: string,
  now: number,
): Promise<Id<"messages"> | undefined> {
  const fields = draftFields(p);
  if (!fields || (p.kind !== "message" && p.kind !== "offer")) return undefined;
  // Not `insertMessage`: a draft must not bump the thread or reach anyone else.
  return ctx.db.insert("messages", {
    conversationId: p.conversationId,
    senderId: ownerId,
    author: { kind: "agent", agent },
    status: "pending_approval",
    ...fields,
    createdAt: now,
  });
}

/** Keeps a pending draft's text in step with an edited proposal. */
export async function syncDraft(ctx: MutationCtx, proposal: Doc<"proposals">) {
  const fields = draftFields(proposal.payload);
  if (proposal.draftMessageId && fields) await ctx.db.patch(proposal.draftMessageId, fields);
}

/** Removes a draft that will never be sent (discarded or expired). */
export async function dropDraft(ctx: MutationCtx, proposal: Doc<"proposals">) {
  if (!proposal.draftMessageId) return;
  const m = await ctx.db.get(proposal.draftMessageId);
  if (m && m.status !== "sent") await ctx.db.delete(m._id);
}

export async function logEvent(
  ctx: MutationCtx,
  proposalId: Id<"proposals">,
  ownerId: Id<"users">,
  action: Doc<"proposalEvents">["action"],
  actor: Doc<"proposalEvents">["actor"],
  at = Date.now(),
) {
  await ctx.db.insert("proposalEvents", { proposalId, ownerId, action, actor, at });
}

/**
 * Whether the proposal may still be shown or acted on: its citations, if any,
 * still resolve for the owner. Once a source is hidden from them, the rationale
 * and draft may carry what it said, so `resolveCitations`'s contract is to hide it.
 */
export async function citationsVisible(
  ctx: QueryCtx,
  p: Doc<"proposals">,
  a: Audience,
): Promise<boolean> {
  return !p.citations || (await resolveCitations(ctx, p.citations, a)) !== null;
}

export function isExpired(p: Doc<"proposals">, now = Date.now()) {
  return p.status === "expired" || (p.status === "pending" && !!p.expiresAt && p.expiresAt <= now);
}

/**
 * Performs an approved proposal. Called only from `proposals.approve`, after the
 * owner's decision is recorded, so nothing Muse writes can skip approval.
 */
export async function executeProposal(
  ctx: MutationCtx,
  proposal: Doc<"proposals">,
): Promise<NonNullable<Doc<"proposals">["result"]>> {
  const ownerId = proposal.ownerId;
  const p = proposal.payload;
  await assertPayload(ctx, ownerId, p, proposal.origin);
  if (!(await citationsVisible(ctx, proposal, await loadAudience(ctx, ownerId))))
    throw new ConvexError("Muse's sources for this are no longer available to you");
  const now = Date.now();
  switch (p.kind) {
    case "message":
    case "offer": {
      const fields = draftFields(p);
      if (!fields) throw new ConvexError("Nothing to send");
      let messageId = proposal.draftMessageId;
      const draft = messageId ? await ctx.db.get(messageId) : null;
      if (draft && draft.status !== "sent") {
        await ctx.db.patch(draft._id, { ...fields, status: "sent", createdAt: now });
      } else {
        messageId = await ctx.db.insert("messages", {
          conversationId: p.conversationId,
          senderId: ownerId,
          author: { kind: "agent", agent: proposal.origin.agent },
          status: "sent",
          ...fields,
          createdAt: now,
        });
      }
      if (!messageId) throw new ConvexError("Nothing to send");
      await bumpConversation(ctx, p.conversationId, ownerId, messageId, now);
      // Like a typed message: the other side's Muse drafts its reply (#36, #44, #45).
      await afterChatMessage(ctx, p.conversationId, ownerId);
      if (p.kind === "offer") {
        const listing = await ctx.db.get(p.listingId);
        if (listing && listing.sellerId !== ownerId)
          await notify(ctx, {
            userId: listing.sellerId,
            actorId: ownerId,
            kind: "listing_message",
            text: `sent you an offer of $${p.amount} for ${listing.title}.`,
            listingId: listing._id,
            conversationId: p.conversationId,
          });
      }
      return { kind: "message", messageId };
    }
    case "event": {
      const owner = await ctx.db.get(ownerId);
      const eventId = await ctx.db.insert("events", {
        hostId: ownerId,
        groupId: p.groupId,
        title: p.title.trim(),
        cover: "/event-cover-default.svg",
        description: p.description.trim(),
        category: "Social",
        startAt: p.startAt,
        online: false,
        venue: p.venue?.trim() || undefined,
        city: owner?.city ?? "San Francisco, CA",
        // An Event planned in a chat (#34) is for the people invited from it.
        privacy: p.groupId ? "group" : p.conversationId ? "private" : "friends",
        externalGoingCount: 0,
        externalInterestedCount: 0,
        createdAt: now,
      });
      await ctx.db.insert("eventResponses", {
        eventId,
        userId: ownerId,
        status: "going",
        createdAt: now,
      });
      for (const userId of new Set(p.inviteIds)) {
        await ctx.db.insert("eventResponses", {
          eventId,
          userId,
          status: "invited",
          createdAt: now,
        });
        await notify(ctx, {
          userId,
          actorId: ownerId,
          kind: "event_invite",
          text: `invited you to ${p.title.trim()}.`,
          eventId,
        });
      }
      return { kind: "event", eventId };
    }
    case "group": {
      const owner = await ctx.db.get(ownerId);
      const name = p.name.trim();
      const base = slugify(name);
      let slug = base;
      for (
        let i = 2;
        await ctx.db
          .query("groups")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
        i++
      )
        slug = `${base}-${i}`;
      const groupId = await ctx.db.insert("groups", {
        name,
        slug,
        cover: "/seed/covers/sf-01.jpg",
        privacy: p.privacy,
        // A private Group Muse starts (a crew's, #31) names its members and what they
        // share, so it stays out of search: only members and invitees can find it.
        visible: p.privacy === "public",
        description: p.description.trim(),
        category: "Social",
        location: owner?.city,
        rules: [],
        tags: [],
        createdBy: ownerId,
        createdAt: now,
        externalMemberCount: 0,
        memberCount: 1,
        lastActivityAt: now,
      });
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: ownerId,
        role: "admin",
        joinedAt: now,
        lastVisitedAt: now,
      });
      for (const userId of new Set(p.inviteIds))
        await notify(ctx, {
          userId,
          actorId: ownerId,
          kind: "group_invite",
          text: `invited you to join ${name}.`,
          groupId,
        });
      return { kind: "group", groupId };
    }
  }
}

/** Same bookkeeping as `insertMessage` in convex/messenger.ts, for a draft that just went out. */
async function bumpConversation(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  senderId: Id<"users">,
  messageId: Id<"messages">,
  now: number,
) {
  await ctx.db.patch(conversationId, { lastMessageAt: now, lastMessageId: messageId });
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  for (const r of rows)
    await ctx.db.patch(r._id, {
      lastMessageAt: now,
      archived: undefined,
      ...(r.userId === senderId ? { lastReadAt: now } : {}),
    });
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "group"
  );
}
