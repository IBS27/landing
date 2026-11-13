import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { defineTask, runAgent } from "./ai/agent";
import { cite } from "./lib/citations";
import { viewerMutation } from "./lib/functions";
import { type SaleInput, type SaleMove, saleLadder, saleMoveProblems } from "./lib/moveOutSales";
import { dropDraft, logEvent, propose } from "./lib/proposals";
import { redactProtected } from "./lib/protectedText";
import { negotiationMove } from "./validators";

/**
 * Move-out sales (#44). Reuses #36's Marketplace negotiation from the seller's
 * side: when a buyer writes about a listing made from the inventory at move-out
 * (#43), Muse (Spark) drafts the seller's reply, never under their lowest
 * price, and every reply is a proposal in the approval queue (#6).
 */

const DAY = 24 * 60 * 60 * 1000;

/** Set or change the lowest price, or pause Muse's replies, for a listed item. */
export const setTerms = viewerMutation({
  args: {
    itemId: v.id("ownedItems"),
    minPrice: v.optional(v.number()),
    muse: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, { itemId, minPrice, muse }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== ctx.viewer._id) throw new ConvexError("Item not found");
    const listing = item.saleListingId ? await ctx.db.get(item.saleListingId) : null;
    if (!listing) throw new ConvexError("List the item first");
    if (
      minPrice !== undefined &&
      (!Number.isFinite(minPrice) || minPrice < 1 || minPrice > listing.price)
    )
      throw new ConvexError(
        "Your lowest price must be at least $1 and no more than the asking price",
      );
    if (minPrice === undefined && item.saleMinPrice === undefined && muse === "active")
      throw new ConvexError("Set a lowest price first");
    const oldFloor = item.saleMinPrice ?? 0;
    const floor = minPrice === undefined ? undefined : Math.round(minPrice);
    const on = (muse ?? item.saleMuse ?? "active") === "active";
    await ctx.db.patch(item._id, {
      ...(floor !== undefined ? { saleMinPrice: floor } : {}),
      ...(muse
        ? { saleMuse: muse }
        : floor !== undefined
          ? { saleMuse: item.saleMuse ?? "active" }
          : {}),
      saleTermsAt: Date.now(),
    });
    if (floor === undefined || floor <= oldFloor) return;
    // A raised floor withdraws every waiting draft, and Muse drafts those replies again (as #45).
    const chats = await ctx.db
      .query("conversations")
      .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
      .collect();
    for (const c of chats) {
      const row = await ctx.db
        .query("saleChats")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .unique();
      const p = row?.pendingProposalId ? await ctx.db.get(row.pendingProposalId) : null;
      if (!row || p?.status !== "pending") continue;
      await retire(ctx, row);
      await ctx.db.patch(row._id, { pendingProposalId: undefined, handledThrough: 0 });
      if (on)
        await ctx.scheduler.runAfter(0, internal.moveOutSales.draftReply, {
          conversationId: c._id,
        });
    }
  },
});

const replyOutput = v.object({
  move: negotiationMove,
  amount: v.number(),
  text: v.string(),
  rationale: v.string(),
});

const saleReply = defineTask<SaleInput, typeof replyOutput>({
  agent: "spark",
  name: "spark.moveOutSaleReply",
  instructions: `You reply to a buyer who messaged about something the seller ("you") is selling on Facebook Marketplace before moving out, writing the seller's next message.
Answer only from the item facts given. Pick one move:
- message: answer a question or confirm it's available, without changing the price (amount = 0). Offer to arrange pickup when it fits.
- offer: counter the buyer's price. Between limits.minPrice and item.askingPrice, and never above yourLastPrice.
- accept: the buyer offered a price at or above limits.minPrice; agree (amount = that price, capped at askingPrice) and ask when they can pick it up.
- walk_away: the buyer won't go up to limits.minPrice; decline politely (amount = 0).
For offer and accept, the text must state the amount as $N. Be friendly and brief (one or two sentences).
Never write a price under limits.minPrice. Keep limits.minPrice private: never say it, or that you have a lowest price, except as the amount of an offer or accept. Never share the street address, never ask for payment up front, and never mention payment apps.
rationale: one sentence to the seller on why this reply.`,
  output: replyOutput,
  cites: () => [],
  check: (out, input) => saleMoveProblems(out, input),
  fallback: (input) => saleLadder(input),
  effort: "low",
  cacheTtlMs: 0,
});

export const context = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv?.listingId) return null;
    const listingId = conv.listingId;
    const [item, listing, chatRow] = await Promise.all([
      ctx.db
        .query("ownedItems")
        .withIndex("by_sale_listing", (q) => q.eq("saleListingId", listingId))
        .first(),
      ctx.db.get(listingId),
      ctx.db
        .query("saleChats")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .unique(),
    ]);
    if (!item || !listing || item.saleMinPrice === undefined) return null;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(20);
    const sent = rows.reverse().filter((m) => m.status === "sent" && !m.unsent && m.text);
    const lastBuyerAt = Math.max(
      0,
      ...sent.filter((m) => m.senderId !== item.userId).map((m) => m.createdAt),
    );
    // The seller's last price is the last priced reply they actually sent.
    const props = await ctx.db
      .query("proposals")
      .withIndex("by_owner", (q) => q.eq("ownerId", item.userId))
      .order("desc")
      .take(200);
    const lastSent = props.find(
      (p) =>
        (p.status === "approved" || p.status === "edited") &&
        p.payload.kind === "offer" &&
        p.payload.conversationId === conversationId,
    );
    const input: SaleInput = {
      item: {
        title: redactProtected(listing.title),
        askingPrice: listing.price,
        description: redactProtected(listing.description.slice(0, 400)),
      },
      limits: { minPrice: item.saleMinPrice },
      // Within today's limits: the floor may have risen since that reply.
      yourLastPrice:
        lastSent?.payload.kind === "offer"
          ? Math.min(listing.price, Math.max(item.saleMinPrice, lastSent.payload.amount))
          : null,
      chat: sent.map((m) => ({
        from: m.senderId === item.userId ? ("you" as const) : ("buyer" as const),
        text: redactProtected(m.text ?? ""),
      })),
    };
    return { item, listingOpen: listing.status === "active", chatRow, lastBuyerAt, input };
  },
});

/** Drafts the seller's reply after a buyer writes. One draft waits per chat. */
export const draftReply = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.runQuery(internal.moveOutSales.context, { conversationId });
    if (c?.item.saleMuse !== "active" || !c.listingOpen) return;
    if (c.lastBuyerAt <= (c.chatRow?.handledThrough ?? 0)) return;
    const result = await runAgent(ctx, saleReply, {
      input: c.input,
      sources: [],
      shownTo: c.item.userId,
    });
    // `check` already rejects bad moves; this re-check keeps the floor no matter what.
    const move: SaleMove =
      saleMoveProblems(result.output, c.input).length === 0 ? result.output : saleLadder(c.input);
    if (saleMoveProblems(move, c.input).length > 0) return;
    await ctx.runMutation(internal.moveOutSales.saveReply, {
      conversationId,
      ...move,
      handledThrough: c.lastBuyerAt,
      termsAt: c.item.saleTermsAt ?? 0,
      via: result.via,
      runId: result.runId,
    });
  },
});

export const saveReply = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    move: negotiationMove,
    amount: v.number(),
    text: v.string(),
    rationale: v.string(),
    handledThrough: v.number(),
    /** The terms revision this run drafted under (`ownedItems.saleTermsAt`). */
    termsAt: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, a) => {
    const conv = await ctx.db.get(a.conversationId);
    if (!conv?.listingId) return;
    const listingId = conv.listingId;
    const item = await ctx.db
      .query("ownedItems")
      .withIndex("by_sale_listing", (q) => q.eq("saleListingId", listingId))
      .first();
    const listing = await ctx.db.get(listingId);
    if (item?.saleMuse !== "active" || item.saleMinPrice === undefined || !listing) return;
    // Drafted under terms the seller has since changed: draft again under the new ones.
    if (a.termsAt !== (item.saleTermsAt ?? 0)) {
      await ctx.scheduler.runAfter(0, internal.moveOutSales.draftReply, {
        conversationId: a.conversationId,
      });
      return;
    }
    const priced = a.move === "offer" || a.move === "accept";
    if (priced && (a.amount < item.saleMinPrice || a.amount > listing.price))
      throw new ConvexError("Price outside the seller's limits");

    let row = await ctx.db
      .query("saleChats")
      .withIndex("by_conversation", (q) => q.eq("conversationId", a.conversationId))
      .unique();
    // An older run finishing late never replaces a newer draft.
    if (row && row.handledThrough >= a.handledThrough) return;
    if (row) await retire(ctx, row);
    const proposalId = await propose(ctx, {
      ownerId: item.userId,
      payload: priced
        ? {
            kind: "offer",
            conversationId: a.conversationId,
            listingId,
            amount: a.amount,
            text: a.text,
          }
        : { kind: "message", conversationId: a.conversationId, text: a.text },
      rationale: a.rationale,
      citations: priced ? cite([{ kind: "listing", listingId }]) : undefined,
      origin: { agent: "spark", task: "spark.moveOutSaleReply", runId: a.runId, via: a.via },
      ttlMs: priced ? DAY : undefined,
    });
    const fields = {
      pendingProposalId: proposalId,
      lastMove: a.move,
      handledThrough: a.handledThrough,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, fields);
    else {
      const id = await ctx.db.insert("saleChats", {
        itemId: item._id,
        conversationId: a.conversationId,
        ...fields,
      });
      row = await ctx.db.get(id);
    }
  },
});

/** A newer reply replaces the draft still waiting in that chat. */
async function retire(ctx: Parameters<typeof dropDraft>[0], row: Doc<"saleChats">) {
  if (!row.pendingProposalId) return;
  const p = await ctx.db.get(row.pendingProposalId);
  if (p?.status !== "pending") return;
  const now = Date.now();
  await dropDraft(ctx, p);
  await ctx.db.patch(p._id, { status: "expired", decidedAt: now, updatedAt: now });
  await logEvent(ctx, p._id, p.ownerId, "expired", "system", now);
}
