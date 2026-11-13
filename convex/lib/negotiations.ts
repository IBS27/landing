import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { statesAmount } from "./proposals";
import { MIN_COMPS, median, phraseFlags } from "./trust";

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
  /** Similar listings (same category, matching title), also passed as cited sources. */
  comparables: { title: string; price: number; status: string }[];
  limits: { maxPrice: number; targetPrice: number | null; notes: string | null };
  yourLastOffer: number | null;
  chat: { from: "you" | "seller"; text: string }[];
  /** Warning signs in the seller's messages, from #73's chat rules. */
  thingsToCheck: string[];
};

export type MoveOutput = { move: Move; amount: number; text: string; rationale: string };

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const AMOUNT =
  /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d+)(?![\d,]|\s?(?:am|pm|min|mins|minutes|hours|days|%|ft|in)\b)/gi;

/**
 * The last dollar amount the seller named since the buyer's last message ("I
 * could do 120", "$95 firm"). Only amounts from a fifth of asking up to asking
 * count, so "I have 2 of these" or "I paid 400" isn't read as a price.
 */
export function sellerPrice(chat: NegotiationInput["chat"], askingPrice: number): number | null {
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (m.from === "you") return null; // only a reply after our last message counts
    const amounts = [...m.text.matchAll(AMOUNT)]
      .map((a) => Number(a[1].replace(/,/g, "")))
      .filter((n) => n >= askingPrice / 5 && n <= askingPrice);
    if (amounts.length) return amounts[amounts.length - 1];
  }
  return null;
}

/** The median price of the comparable listings, or null with fewer than MIN_COMPS. */
export function comparableMedian(input: NegotiationInput): number | null {
  return input.comparables.length >= MIN_COMPS
    ? median(input.comparables.map((c) => c.price))
    : null;
}

/** #73's chat rules that apply to buying goods (the others are about viewing a rental). */
const GOODS_FLAGS = new Set(["untraceable_payment", "pressure", "off_platform"]);

/** Why the seller's messages are worth a second look, deduplicated. */
export function sellerFlags(chat: NegotiationInput["chat"]): string[] {
  const reasons = chat
    .filter((m) => m.from === "seller")
    .flatMap((m) => phraseFlags(m.text))
    .filter((f) => GOODS_FLAGS.has(f.category))
    .map((f) => f.reason);
  return [...new Set(reasons)];
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
    // The sent message carries the amount only in its text (see `assertPayload`).
    if (!statesAmount(out.text, out.amount)) p.push(`text must say the amount as $${out.amount}`);
  }
  if (out.move === "offer") {
    if (out.amount >= input.listing.askingPrice)
      p.push("an offer must be below the asking price (use accept to agree)");
    if (input.yourLastOffer !== null && out.amount < input.yourLastOffer)
      p.push(`an offer can't go below your last offer of ${input.yourLastOffer}`);
  }
  // Any move, priced or not, must not name a price over the max (asking aside).
  const named = [...out.text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)/g)].map((m) =>
    Number(m[1].replace(/,/g, "")),
  );
  if (named.some((n) => n > maxPrice && n !== input.listing.askingPrice))
    p.push(`text must not name a price over the buyer's max of ${maxPrice}`);
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
  const theirs = sellerPrice(input.chat, ask);
  const item = input.listing.title.split(",")[0];
  const med = comparableMedian(input);

  if (last === null) {
    // Anchor on similar listings when they go for less than this one asks.
    const anchor = med !== null ? Math.min(ask, med) : ask;
    const open = Math.min(maxPrice, ask - 5, targetPrice ?? round5(anchor * 0.75));
    const basis = targetPrice
      ? "your ideal price"
      : med !== null && med < ask
        ? `about 75% of the $${med} median for ${input.comparables.length} similar listings`
        : "about 75% of asking";
    return {
      move: "offer",
      amount: open,
      text: `Hi! I'm interested in the ${item}. Would you take $${open}? I can pick up soon.`,
      rationale: `Opening at ${basis} ($${open} vs $${ask} asking), under your $${maxPrice} max.`,
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
  // The buyer lowered their max below an offer already sent: don't repeat it.
  if (last > maxPrice)
    return {
      move: "walk_away",
      amount: 0,
      text: "Thanks for getting back to me! My budget changed, so I'll have to pass for now.",
      rationale: `Your max is now $${maxPrice}, under the $${last} you offered, so Muse won't repeat that offer.`,
    };
  // Only a counter-price moves the ladder; "Yes, that works" or "No" doesn't.
  const followUp: MoveOutput = {
    move: "message",
    amount: 0,
    text: `Just to confirm, would $${last} work for the ${item}?`,
    rationale: "The seller didn't name a new price, so Muse checks on your last offer.",
  };
  if (theirs === null) return followUp;
  if (last >= maxPrice) {
    return {
      move: "walk_away",
      amount: 0,
      text: `Thanks for getting back to me! $${last} is the most I can do, so no worries if that doesn't work.`,
      rationale: `You're already at your $${maxPrice} max, so Muse won't go higher.`,
    };
  }
  const counter = Math.min(maxPrice, round5((last + theirs) / 2));
  if (counter <= last) return followUp;
  return {
    move: "offer",
    amount: counter,
    text: `Could you meet me at $${counter}? I can pick up whenever works for you.`,
    rationale: `Meeting the seller's $${theirs} about halfway, still under your $${maxPrice} max.`,
  };
}

/**
 * Called after any chat message is stored. When the seller replies in a chat
 * with an active negotiation, Muse drafts the buyer's next move. When a renter
 * writes about a sublet with Muse replies on, Muse drafts the lister's reply (#45).
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
  if (n?.status === "active" && n.buyerId !== senderId)
    await ctx.scheduler.runAfter(0, internal.negotiations.draftNext, { negotiationId: n._id });

  // A mover replying to a quote request prompts Muse's counter or acceptance (#28).
  const outreach = await ctx.db
    .query("moverOutreach")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .first();
  if (outreach && outreach.pageId === senderId)
    await ctx.scheduler.runAfter(0, internal.moverQuotes.draftCounter, { conversationId });

  const conv = await ctx.db.get(conversationId);
  if (!conv?.listingId) return;
  const listingId = conv.listingId;
  const sublet = await ctx.db
    .query("sublets")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .unique();
  if (sublet?.museReplies === "active" && sublet.ownerId !== senderId)
    await ctx.scheduler.runAfter(0, internal.subleases.draftReply, { conversationId });

  // A buyer writing about a move-out listing prompts Muse's reply for the seller (#44).
  const item = await ctx.db
    .query("ownedItems")
    .withIndex("by_sale_listing", (q) => q.eq("saleListingId", listingId))
    .first();
  if (item?.saleMuse === "active" && item.userId !== senderId)
    await ctx.scheduler.runAfter(0, internal.moveOutSales.draftReply, { conversationId });
}
