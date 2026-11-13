/**
 * Move-out sales (#44): the seller's side of #36's Marketplace negotiation, for
 * listings created from the inventory at move-out (#43). The seller sets a
 * lowest price; Muse drafts each reply to a buyer, and code keeps every price
 * between that floor and the asking price. Every reply is a proposal (#6).
 */

import { type Move, sellerPrice } from "./negotiations";
import { statesAmount } from "./proposals";
import { phraseFlags } from "./trust";

export type SaleInput = {
  item: { title: string; askingPrice: number; description: string };
  limits: { minPrice: number };
  /** The last price the seller actually sent in this chat, if any. */
  yourLastPrice: number | null;
  chat: { from: "you" | "buyer"; text: string }[];
};

export type SaleMove = { move: Move; amount: number; text: string; rationale: string };

const round5 = (n: number) => Math.max(1, Math.round(n / 5) * 5);

/**
 * The last price the buyer named since the seller's last message. Reuses #36's
 * parser (it reads "the other side's" price): only amounts from a fifth of
 * asking up to asking count.
 */
export function buyerPrice(input: SaleInput): number | null {
  const chat = input.chat.map((m) => ({
    from: m.from === "you" ? ("you" as const) : ("seller" as const),
    text: m.text,
  }));
  return sellerPrice(chat, input.item.askingPrice);
}

const DOLLARS = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)/g;
/** Any number, with or without "$" or cents ("my lowest is 30", "$30.00"). */
const NUMBER = /(?<![\d,.])((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?![\d,]|\.\d)/g;

/** Code checks on any move, from the model or the fallback. */
export function saleMoveProblems(out: SaleMove, input: SaleInput): string[] {
  const p: string[] = [];
  const { minPrice } = input.limits;
  const ask = input.item.askingPrice;
  if (!out.text.trim()) p.push("text is empty");
  if (out.text.length > 400) p.push("text is longer than 400 characters");
  if (!out.rationale.trim()) p.push("rationale is empty");
  if (out.move === "offer" || out.move === "accept") {
    if (!Number.isInteger(out.amount) || out.amount <= 0)
      p.push("amount must be a whole number of dollars above 0");
    if (out.amount < minPrice)
      p.push(`amount ${out.amount} is under the seller's lowest price of ${minPrice}`);
    if (out.amount > ask) p.push(`amount ${out.amount} is over the asking price of ${ask}`);
    if (!statesAmount(out.text, out.amount)) p.push(`text must state the price as $${out.amount}`);
  }
  if (out.move === "offer" && input.yourLastPrice !== null && out.amount > input.yourLastPrice)
    p.push(`a counter can't go above your last price of ${input.yourLastPrice}`);
  for (const m of out.text.matchAll(DOLLARS)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (n < minPrice) p.push(`text names $${n}, under the seller's lowest price of ${minPrice}`);
  }
  // The floor stays private: the text names it only as the price this move offers or accepts.
  const floorShown =
    ((out.move === "offer" || out.move === "accept") && out.amount === minPrice) ||
    minPrice === ask;
  const named = [...out.text.matchAll(NUMBER)].map((m) => Number(m[1].replace(/,/g, "")));
  if (!floorShown && named.includes(minPrice))
    p.push("text must not reveal the seller's lowest price");
  for (const f of phraseFlags(out.text)) p.push(`text trips a scam signal: ${f.reason}`);
  if (/\b(deposit|bank|zelle|venmo|cash ?app|wire)\b/i.test(out.text))
    p.push("text must not ask for payment details or money up front");
  if (/\b\d{2,5}\s+\w+\s+(st|street|ave|avenue|blvd|rd|road)\b/i.test(out.text))
    p.push("text must not share the street address");
  return p;
}

/**
 * The non-AI replier: confirms it's available and offers pickup, accepts a
 * price at or above the floor, meets the buyer partway, and declines politely
 * once at the floor.
 */
export function saleLadder(input: SaleInput): SaleMove {
  const { minPrice } = input.limits;
  const ask = input.item.askingPrice;
  const last = input.yourLastPrice ?? ask;
  const theirs = buyerPrice(input);
  const item = input.item.title.split(",")[0];

  if (theirs === null)
    return {
      move: "message",
      amount: 0,
      // The asking price until you've countered; a counter may sit at the private floor.
      text: `Hi! Yes, the ${item} is still available${input.yourLastPrice === null ? ` for $${ask}` : ""}. When would you like to pick it up?`,
      rationale:
        "Confirms it's available at the listed price and offers pickup, with no address until you agree on a time.",
    };
  if (theirs >= minPrice) {
    const amount = Math.min(theirs, ask);
    return {
      move: "accept",
      amount,
      text: `$${amount} works for me. When can you pick it up?`,
      rationale: `The buyer offered $${theirs}, at or above your lowest price of $${minPrice}.`,
    };
  }
  if (last <= minPrice)
    return {
      move: "walk_away",
      amount: 0,
      text: "Thanks for the offer! That's lower than I can go, so no worries if it doesn't work for you.",
      rationale: `The buyer's $${theirs} is under your lowest price, and you're already at $${minPrice}.`,
    };
  const counter = Math.max(minPrice, Math.min(last - 1, round5((last + theirs) / 2)));
  return {
    move: "offer",
    amount: counter,
    text: `That's a little low for me. Could you do $${counter}?`,
    rationale: `Meeting the buyer's $${theirs} partway, staying at or above your lowest price of $${minPrice}.`,
  };
}
