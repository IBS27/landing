import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Marketplace negotiation (#36): shared rules for Muse's moves.
 *
 * The model proposes a move; code checks it. No offer or acceptance may go over
 * the buyer's max, and every move becomes a proposal the buyer approves (#6).
 */

export type Move = "offer" | "accept" | "message" | "walk_away";

export type NegotiationInput = {
  listing: {
    title: string;
    askingPrice: number;
    condition: string | null;
    daysListed: number;
    description: string;
  };
  limits: { maxPrice: number; targetPrice: number | null; notes: string | null };
  yourLastOffer: number | null;
  chat: { from: "you" | "seller"; text: string }[];
};

export type MoveOutput = { move: Move; amount: number; text: string; rationale: string };

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** The last dollar amount the seller named, if any ("I could do 120", "$95 firm"). */
export function sellerPrice(chat: NegotiationInput["chat"]): number | null {
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (m.from === "you") return null; // only a reply after our last message counts
    const match = m.text.match(
      /\$?\s?(\d{1,3}(?:,\d{3})*|\d+)(?!\s?(?:am|pm|min|mins|minutes|hours|days|%|ft|in))/i,
    );
    if (match) {
      const n = Number(match[1].replace(/,/g, ""));
      if (n > 0) return n;
    }
  }
  return null;
}

/** Problems with a move, checked in code whether the model or the fallback made it. */
export function moveProblems(out: MoveOutput, input: NegotiationInput): string[] {
  const p: string[] = [];
  const { maxPrice } = input.limits;
  if (!out.text.trim()) p.push("text is empty");
  if (out.text.length > 400) p.push("text is longer than 400 characters");
  if (!out.rationale.trim()) p.push("rationale is empty");
  if (out.move === "offer" || out.move === "accept") {
    if (!Number.isInteger(out.amount) || out.amount <= 0)
      p.push("amount must be a whole number of dollars above 0");
    if (out.amount > maxPrice)
      p.push(`amount ${out.amount} is over the buyer's max of ${maxPrice}`);
  }
  if (out.move === "offer") {
    if (out.amount >= input.listing.askingPrice)
      p.push("an offer must be below the asking price (use accept to agree)");
    if (input.yourLastOffer !== null && out.amount < input.yourLastOffer)
      p.push(`an offer can't go below your last offer of ${input.yourLastOffer}`);
  }
  if (/\b(address|zelle|venmo|cash ?app|card number|bank)\b/i.test(out.text))
    p.push("text must not share an address or payment details");
  return p;
}

/**
 * The non-AI negotiator: a simple price ladder that never goes over the max.
 * Opens at the target (or 75% of asking), meets the seller halfway, accepts a
 * price within the max, and walks away politely once the max is reached.
 */
export function ladderMove(input: NegotiationInput): MoveOutput {
  const { maxPrice, targetPrice } = input.limits;
  const ask = input.listing.askingPrice;
  const last = input.yourLastOffer;
  const theirs = sellerPrice(input.chat);
  const item = input.listing.title.split(",")[0];

  if (last === null) {
    const open = Math.min(maxPrice, ask - 5, targetPrice ?? round5(ask * 0.75));
    return {
      move: "offer",
      amount: open,
      text: `Hi! I'm interested in the ${item}. Would you take $${open}? I can pick up soon.`,
      rationale: `Opening at ${targetPrice ? "your target" : "about 75% of asking"} ($${open} vs $${ask} asking), well under your $${maxPrice} max.`,
    };
  }
  if (theirs !== null && theirs <= maxPrice) {
    return {
      move: "accept",
      amount: theirs,
      text: `$${theirs} works for me. When's a good time to pick it up?`,
      rationale: `The seller came down to $${theirs}, which is within your $${maxPrice} max.`,
    };
  }
  if (last >= maxPrice) {
    return {
      move: "walk_away",
      amount: 0,
      text: `Thanks for getting back to me! $${last} is the most I can do, so no worries if that doesn't work.`,
      rationale: `You're already at your $${maxPrice} max, so Muse won't go higher.`,
    };
  }
  const counter = Math.min(
    maxPrice,
    round5(theirs !== null ? (last + theirs) / 2 : last + (maxPrice - last) / 2),
  );
  if (counter <= last)
    return {
      move: "message",
      amount: 0,
      text: `Just checking in: would $${last} work for the ${item}?`,
      rationale: "No new price from the seller, so Muse follows up on your last offer.",
    };
  return {
    move: "offer",
    amount: counter,
    text: `Could you meet me at $${counter}? I can pick up whenever works for you.`,
    rationale:
      theirs !== null
        ? `Meeting the seller's $${theirs} about halfway, still under your $${maxPrice} max.`
        : `Raising a little from $${last}, still under your $${maxPrice} max.`,
  };
}

/**
 * Called after any chat message is stored. When the seller replies in a chat
 * with an active negotiation, Muse drafts the buyer's next move.
 */
export async function afterChatMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  senderId: Id<"users">,
) {
  const n = await ctx.db
    .query("negotiations")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .first();
  if (n?.status !== "active" || n.buyerId === senderId) return;
  await ctx.scheduler.runAfter(0, internal.negotiations.draftNext, { negotiationId: n._id });
}
