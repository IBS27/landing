import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Citations, ProposalPayload } from "../validators";
import { assertCitable } from "./citations";
import { notify } from "./notify";
import { loadAudience } from "./posts";
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
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ProposeArgs = {
  ownerId: Id<"users">;
  payload: ProposalPayload;
  /** One line on why Muse suggests this ("You both climb and start in June"). */
  rationale: string;
  /** Required for recommendations; optional for plain replies. */
  citations?: Citations;
  origin: Doc<"proposals">["origin"];
  /** Defaults to OFFER_TTL_MS for offers and DEFAULT_TTL_MS for the rest. */
  ttlMs?: number;
};

export async function propose(ctx: MutationCtx, a: ProposeArgs): Promise<Id<"proposals">> {
  const rationale = a.rationale.trim();
  if (!rationale) throw new ConvexError("A proposal needs a rationale");
  await assertPayload(ctx, a.ownerId, a.payload);
  if (a.citations) await assertCitable(ctx, a.citations, await loadAudience(ctx, a.ownerId));

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
  });
  await logEvent(ctx, proposalId, a.ownerId, "created", "agent", now);
  await ctx.scheduler.runAt(now + ttl, internal.proposals.expire, { proposalId });
  return proposalId;
}

/** Checks the owner may do what the payload says, before it's stored or sent. */
export async function assertPayload(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  p: ProposalPayload,
): Promise<void> {
  switch (p.kind) {
    case "message":
    case "offer": {
      if (!p.text.trim()) throw new ConvexError("The message is empty");
      const member = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", p.conversationId).eq("userId", ownerId),
        )
        .unique();
      if (!member) throw new ConvexError("Not in this conversation");
      if (p.kind === "offer") {
        if (!Number.isInteger(p.amount) || p.amount < 0)
          throw new ConvexError("Offers are whole dollars");
        const listing = await ctx.db.get(p.listingId);
        if (!listing || listing.status === "sold") throw new ConvexError("Listing not available");
      }
      return;
    }
    case "event": {
      if (!p.title.trim()) throw new ConvexError("Name the event");
      if (p.startAt < Date.now()) throw new ConvexError("The event is in the past");
      return assertFriends(ctx, ownerId, p.inviteIds);
    }
    case "group": {
      const name = p.name.trim();
      if (!name) throw new ConvexError("Name the group");
      if (name.length > 75) throw new ConvexError("Group names can be up to 75 characters");
      return assertFriends(ctx, ownerId, p.inviteIds);
    }
  }
}

async function assertFriends(ctx: MutationCtx, ownerId: Id<"users">, ids: Id<"users">[]) {
  const friends = new Set(await friendIds(ctx, ownerId));
  if (ids.some((id) => !friends.has(id))) throw new ConvexError("Muse can only invite friends");
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
}

/** Offer drafts carry the listing as an attachment so the chat shows what it's for. */
function draftFields(p: ProposalPayload) {
  if (p.kind === "message") return { text: p.text.trim(), attachments: [] };
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
  await assertPayload(ctx, ownerId, p);
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
        privacy: p.groupId ? "group" : "friends",
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
        visible: true,
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
