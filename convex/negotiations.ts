import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { defineTask, runAgent } from "./ai/agent";
import { isBlockedEitherWay } from "./lib/blocks";
import { cite } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  ladderMove,
  type MoveOutput,
  moveProblems,
  type NegotiationInput,
  sellerFlags,
} from "./lib/negotiations";
import { dropDraft, logEvent, propose } from "./lib/proposals";
import { getSummary } from "./lib/users";
import { negotiationMove } from "./validators";

/**
 * Marketplace negotiation via Muse (#36). The buyer sets limits; Muse (Spark)
 * drafts each move, and every move is a proposal in the approval queue (#6).
 * Code enforces the max price on every offer, whatever the model says.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Similar listings read for price context and cited with priced moves. */
const COMPS_MAX = 5;

/* ── The buyer ────────────────────────────────────────────────────────── */

function wholeDollars(n: number, what: string) {
  if (!Number.isInteger(n) || n <= 0)
    throw new ConvexError(`${what} must be a whole dollar amount`);
}

/** Starts (or updates the limits of) a negotiation and drafts Muse's first move. */
export const start = viewerMutation({
  args: {
    listingId: v.id("listings"),
    maxPrice: v.number(),
    targetPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { listingId, maxPrice, targetPrice, notes }) => {
    const buyerId = ctx.viewer._id;
    const listing = await ctx.db.get(listingId);
    if (listing?.status !== "active") throw new ConvexError("This listing isn't available");
    if (listing.sellerId === buyerId)
      throw new ConvexError("You can't negotiate on your own listing");
    if (await isBlockedEitherWay(ctx, buyerId, listing.sellerId))
      throw new ConvexError("This person isn't available right now.");
    wholeDollars(maxPrice, "Your max");
    if (targetPrice !== undefined) {
      wholeDollars(targetPrice, "Your ideal price");
      if (targetPrice > maxPrice) throw new ConvexError("Your ideal price can't be over your max");
    }

    // The buyer's chat about this listing, or a new one (no message is sent).
    const now = Date.now();
    const convs = await ctx.db
      .query("conversations")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
    let conv = convs.find((c) => c.memberIds.includes(buyerId)) ?? null;
    if (!conv) {
      const id = await ctx.db.insert("conversations", {
        kind: "marketplace",
        listingId,
        memberIds: [buyerId, listing.sellerId],
        createdAt: now,
        lastMessageAt: now,
      });
      for (const userId of [buyerId, listing.sellerId])
        await ctx.db.insert("conversationMembers", {
          conversationId: id,
          userId,
          lastReadAt: now,
          lastMessageAt: now,
        });
      conv = await ctx.db.get(id);
    }
    if (!conv) throw new ConvexError("Couldn't start the conversation");

    const existing = await ctx.db
      .query("negotiations")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .first();
    const limits = { maxPrice, targetPrice, notes: notes?.trim() || undefined };
    let negotiationId: Id<"negotiations">;
    if (existing) {
      // A waiting draft was written for the old limits; don't leave it approvable.
      await retirePending(ctx, existing, "expired", "system");
      await ctx.db.patch(existing._id, { ...limits, status: "active", updatedAt: now });
      negotiationId = existing._id;
    } else {
      negotiationId = await ctx.db.insert("negotiations", {
        buyerId,
        listingId,
        conversationId: conv._id,
        ...limits,
        status: "active",
        handledThrough: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.scheduler.runAfter(0, internal.negotiations.draftNext, {
      negotiationId,
      force: true,
    });
    return negotiationId;
  },
});

/** Pause, resume or stop. Stopping discards a draft that's still waiting. */
export const setStatus = viewerMutation({
  args: {
    negotiationId: v.id("negotiations"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("stopped")),
  },
  handler: async (ctx, { negotiationId, status }) => {
    const n = await ctx.db.get(negotiationId);
    if (!n || n.buyerId !== ctx.viewer._id) throw new ConvexError("Negotiation not found");
    const now = Date.now();
    if (status === "stopped") await retirePending(ctx, n, "rejected", "owner");
    await ctx.db.patch(n._id, { status, updatedAt: now });
    if (status === "active")
      await ctx.scheduler.runAfter(0, internal.negotiations.draftNext, { negotiationId });
  },
});

/** The viewer's Marketplace chats as a buyer (non-rentals), with any negotiation on each. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(100);
    const out = [];
    for (const r of rows) {
      const conv = await ctx.db.get(r.conversationId);
      if (conv?.kind !== "marketplace" || !conv.listingId) continue;
      const listing = await ctx.db.get(conv.listingId);
      // Only things the viewer can still buy: active, not theirs, not rentals.
      if (
        listing?.status !== "active" ||
        listing.sellerId === viewerId ||
        listing.category === "propertyrentals"
      )
        continue;
      const n = await ctx.db
        .query("negotiations")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .first();
      const pending = n?.pendingProposalId ? await ctx.db.get(n.pendingProposalId) : null;
      const seller = await getSummary(ctx, listing.sellerId);
      out.push({
        conversationId: conv._id,
        listing: {
          _id: listing._id,
          title: listing.title,
          price: listing.price,
          photo: listing.photos[0] ?? null,
          status: listing.status,
        },
        seller,
        negotiation: n
          ? {
              _id: n._id,
              status: n.status,
              maxPrice: n.maxPrice,
              targetPrice: n.targetPrice ?? null,
              notes: n.notes ?? null,
              lastMove: n.lastMove ?? null,
              lastOffer: n.lastOffer ?? null,
              /** The draft's state: waiting for the buyer, or what happened to it. */
              draft: pending ? { status: pending.status, kind: pending.payload.kind } : null,
            }
          : null,
      });
    }
    return out;
  },
});

/* ── Muse's move ──────────────────────────────────────────────────────── */

const moveOutput = v.object({
  move: negotiationMove,
  amount: v.number(),
  text: v.string(),
  rationale: v.string(),
});

const negotiate = defineTask<NegotiationInput, typeof moveOutput>({
  agent: "spark",
  name: "spark.negotiate",
  instructions: `You negotiate a Facebook Marketplace purchase for the buyer ("you"), writing the buyer's next chat message to the seller.
Pick one move:
- offer: propose a price below asking. Never above limits.maxPrice, and never below yourLastOffer. Aim for limits.targetPrice when given.
- accept: the seller named a price at or under limits.maxPrice; agree to it (amount = that price) and ask about pickup.
- message: a short follow-up or answer that doesn't change the price (amount = 0).
- walk_away: the seller won't go within the max; thank them politely (amount = 0).
comparables are similar listings (also in <sources>); use them to judge a fair price.
For offer and accept, the text must state the amount as $N.
Be friendly, brief (one to three sentences) and honest. Use the buyer's notes (like pickup timing). Use whole dollars.
Never share an address, phone number or payment details, and never agree to pay before seeing the item.
thingsToCheck lists warning signs in the seller's messages: never go along with them; keep the deal to paying in person at pickup.
rationale: one sentence to the buyer on why this move.`,
  output: moveOutput,
  cites: () => [],
  check: (out, input) => moveProblems(out, input),
  fallback: (input) => ladderMove(input),
  effort: "low",
  cacheTtlMs: 0,
});

/**
 * Up to COMPS_MAX other listings in the same category whose titles match, not
 * pending and not from someone blocked either way with the buyer.
 */
async function comparableListings(ctx: QueryCtx, listing: Doc<"listings">, buyerId: Id<"users">) {
  const hits = await ctx.db
    .query("listings")
    .withSearchIndex("search_title", (q) =>
      q.search("title", listing.title).eq("category", listing.category),
    )
    .take(20);
  const comps: Doc<"listings">[] = [];
  for (const l of hits) {
    if (comps.length === COMPS_MAX) break;
    if (l._id === listing._id || l.price <= 0 || l.status === "pending") continue;
    if (await isBlockedEitherWay(ctx, buyerId, l.sellerId)) continue;
    comps.push(l);
  }
  return comps;
}

export const context = internalQuery({
  args: { negotiationId: v.id("negotiations") },
  handler: async (ctx, { negotiationId }) => {
    const n = await ctx.db.get(negotiationId);
    if (!n) return null;
    const [listing, conv, pending] = await Promise.all([
      ctx.db.get(n.listingId),
      ctx.db.get(n.conversationId),
      n.pendingProposalId ? ctx.db.get(n.pendingProposalId) : null,
    ]);
    if (!listing || !conv) return null;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", n.conversationId))
      .order("desc")
      .take(20);
    const sent = rows.reverse().filter((m) => m.status === "sent" && !m.unsent && m.text);
    const chat = sent.map((m) => ({
      from: m.senderId === n.buyerId ? ("you" as const) : ("seller" as const),
      text: m.text ?? "",
    }));
    const lastSellerAt = Math.max(
      0,
      ...sent.filter((m) => m.senderId !== n.buyerId).map((m) => m.createdAt),
    );
    // The buyer's last offer is the last one they actually sent (approved, maybe edited).
    const offers = await ctx.db
      .query("proposals")
      .withIndex("by_owner", (q) => q.eq("ownerId", n.buyerId))
      .order("desc")
      .take(200);
    const lastSent = offers.find(
      (p) =>
        (p.status === "approved" || p.status === "edited") &&
        p.payload.kind === "offer" &&
        p.payload.conversationId === n.conversationId,
    );
    const yourLastOffer = lastSent?.payload.kind === "offer" ? lastSent.payload.amount : null;
    const comps = await comparableListings(ctx, listing, n.buyerId);
    const input: NegotiationInput = {
      listing: {
        title: listing.title,
        askingPrice: listing.price,
        condition: listing.condition ?? null,
        daysListed: Math.max(0, Math.floor((Date.now() - listing.createdAt) / DAY)),
        description: listing.description.slice(0, 600),
      },
      comparables: comps.map((l) => ({ title: l.title, price: l.price, status: l.status })),
      limits: { maxPrice: n.maxPrice, targetPrice: n.targetPrice ?? null, notes: n.notes ?? null },
      yourLastOffer,
      chat,
      thingsToCheck: sellerFlags(chat),
    };
    return {
      negotiation: n,
      input,
      compIds: comps.map((l) => l._id),
      listingOpen: listing.status === "active",
      lastSellerAt,
      draftWaiting: pending?.status === "pending",
      /** The buyer sent Muse's acceptance: the price is settled. */
      agreed:
        n.lastMove === "accept" && (pending?.status === "approved" || pending?.status === "edited"),
    };
  },
});

/**
 * Drafts the buyer's next move. Runs when the negotiation starts or resumes and
 * when the seller replies. Skips when a draft is already waiting and nothing new
 * came in, so the buyer sees one draft at a time.
 */
export const draftNext = internalAction({
  args: { negotiationId: v.id("negotiations"), force: v.optional(v.boolean()) },
  handler: async (ctx, { negotiationId, force }) => {
    const c = await ctx.runQuery(internal.negotiations.context, { negotiationId });
    if (c?.negotiation.status !== "active" || !c.listingOpen) return;
    // After an accepted price, pickup chat is the buyer's own; new limits restart it.
    if (c.agreed && !force) return;
    const somethingNew = c.lastSellerAt > c.negotiation.handledThrough;
    if (!force && !somethingNew && c.draftWaiting) return;
    if (!force && !somethingNew && c.negotiation.lastMove) return;

    const result = await runAgent(ctx, negotiate, {
      input: c.input,
      sources: [c.negotiation.listingId, ...c.compIds].map((listingId) => ({
        kind: "listing" as const,
        listingId,
      })),
      shownTo: c.negotiation.buyerId,
    });
    // `check` already rejects bad moves; this re-check guards the max no matter what.
    const move: MoveOutput =
      moveProblems(result.output, c.input).length === 0 ? result.output : ladderMove(c.input);
    // Warning signs are stated by code, so the buyer sees them with AI on or off.
    const flags = c.input.thingsToCheck;
    await ctx.runMutation(internal.negotiations.saveMove, {
      negotiationId,
      move: move.move,
      amount: move.amount,
      text: move.text,
      rationale: flags.length
        ? `${move.rationale} Things to check: ${flags.join(" ")}`
        : move.rationale,
      compIds: c.compIds,
      handledThrough: Math.max(c.lastSellerAt, c.negotiation.handledThrough),
      force,
      via: result.via,
      runId: result.runId,
    });
  },
});

/** Replaces any waiting draft with the new move, as a proposal in the queue. */
export const saveMove = internalMutation({
  args: {
    negotiationId: v.id("negotiations"),
    move: negotiationMove,
    amount: v.number(),
    text: v.string(),
    rationale: v.string(),
    /** Comparable listings behind a priced move, cited with the listing itself. */
    compIds: v.array(v.id("listings")),
    handledThrough: v.number(),
    /** New limits from the buyer: drafts even after an agreed price. */
    force: v.optional(v.boolean()),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, a) => {
    const n = await ctx.db.get(a.negotiationId);
    if (n?.status !== "active") return;
    // A run that started before a newer one already answered later seller messages.
    if (a.handledThrough < n.handledThrough) return;
    // Re-checked here: the buyer may have sent an acceptance while this run drafted.
    const pending = n.pendingProposalId ? await ctx.db.get(n.pendingProposalId) : null;
    const agreed =
      n.lastMove === "accept" && (pending?.status === "approved" || pending?.status === "edited");
    if (agreed && !a.force) return;
    const priced = a.move === "offer" || a.move === "accept";
    if (priced && a.amount > n.maxPrice) throw new ConvexError("Offer over the buyer's max");
    await retirePending(ctx, n, "expired", "system");
    const origin = { agent: "spark" as const, task: "spark.negotiate", runId: a.runId, via: a.via };
    const proposalId = await propose(ctx, {
      ownerId: n.buyerId,
      payload: priced
        ? {
            kind: "offer",
            conversationId: n.conversationId,
            listingId: n.listingId,
            amount: a.amount,
            text: a.text,
          }
        : { kind: "message", conversationId: n.conversationId, text: a.text },
      rationale: a.rationale,
      citations: priced
        ? cite([
            { kind: "listing", listingId: n.listingId },
            ...a.compIds.map((listingId) => ({ kind: "listing" as const, listingId })),
          ])
        : undefined,
      origin,
    });
    await ctx.db.patch(n._id, {
      pendingProposalId: proposalId,
      lastMove: a.move,
      ...(priced ? { lastOffer: a.amount } : {}),
      handledThrough: a.handledThrough,
      updatedAt: Date.now(),
    });
  },
});

/** Takes a waiting draft out of the queue: replaced by a newer move, or the buyer stopped. */
async function retirePending(
  ctx: Parameters<typeof dropDraft>[0],
  n: Doc<"negotiations">,
  status: "expired" | "rejected",
  actor: "system" | "owner",
) {
  if (!n.pendingProposalId) return;
  const p = await ctx.db.get(n.pendingProposalId);
  if (p?.status !== "pending") return;
  const now = Date.now();
  await dropDraft(ctx, p);
  await ctx.db.patch(p._id, { status, decidedAt: now, updatedAt: now });
  await logEvent(ctx, p._id, p.ownerId, status, actor, now);
}
