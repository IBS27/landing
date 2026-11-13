/**
 * Sublease negotiation (#45): the lister's side of the #36 engine. The lister
 * sets the lowest rent they'd accept; Muse drafts each reply to an interested
 * renter, and code keeps every price between that floor and the asking rent.
 */

import type { Move } from "./negotiations";
import { statesAmount } from "./proposals";
import { phraseFlags } from "./trust";

export type SubletInput = {
  listing: {
    title: string;
    askingRent: number;
    neighborhood: string | null;
    bedrooms: number;
    bathrooms: number;
    furnished: boolean | null;
    /** "Jun 1" style dates. */
    availableFrom: string | null;
    availableTo: string | null;
    description: string;
  };
  limits: { minRent: number; notes: string | null };
  yourLastPrice: number | null;
  chat: { from: "you" | "renter"; text: string }[];
};

export type SubletMove = { move: Move; amount: number; text: string; rationale: string };

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Rents in chat text, "$1,450" or "1450", as whole numbers: "1200 sqft" is not $120. */
const RENT =
  /(?<![\d,.])\$?\s?(\d{1,2},\d{3}|\d{3,5})(?:\.\d{1,2})?(?![\d,]|\.\d|\s?(?:am|pm|sq|ft|square|%))/gi;
const rents = (text: string) => [...text.matchAll(RENT)].map((m) => Number(m[1].replace(/,/g, "")));

/** The last rent the renter named after your last message ("could you do 1,600?"). */
export function renterPrice(chat: SubletInput["chat"]): number | null {
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (m.from === "you") return null;
    const [first] = rents(m.text);
    if (first !== undefined) return first;
  }
  return null;
}

/** Code checks on any move, from the model or the fallback. */
export function subletMoveProblems(out: SubletMove, input: SubletInput): string[] {
  const p: string[] = [];
  const { minRent } = input.limits;
  const ask = input.listing.askingRent;
  if (!out.text.trim()) p.push("text is empty");
  if (out.text.length > 500) p.push("text is longer than 500 characters");
  if (!out.rationale.trim()) p.push("rationale is empty");
  if (out.move === "offer" || out.move === "accept") {
    if (!Number.isInteger(out.amount) || out.amount <= 0)
      p.push("amount must be a whole number of dollars above 0");
    if (out.amount < minRent)
      p.push(`amount ${out.amount} is under the lister's lowest rent of ${minRent}`);
    if (out.amount > ask) p.push(`amount ${out.amount} is over the asking rent of ${ask}`);
    // The sent message carries the rent only in its text (#6's offer rule).
    if (!statesAmount(out.text, out.amount)) p.push(`text must state the rent as $${out.amount}`);
  }
  if (out.move === "offer" && input.yourLastPrice !== null && out.amount > input.yourLastPrice)
    p.push(`a counter can't go above your last price of ${input.yourLastPrice}`);
  // Whatever the move, the text never names a rent under the floor.
  for (const r of rents(out.text))
    if (r < minRent) p.push(`text names ${r}, under the lister's lowest rent of ${minRent}`);
  // The lister's messages never read like #73's scam signals, and never ask for
  // a deposit or bank details before the viewing and sublease.
  for (const f of phraseFlags(out.text)) p.push(`text trips a scam signal: ${f.reason}`);
  if (/\b(deposit|bank)\b/i.test(out.text))
    p.push("text must not ask for money or payment details before a viewing and lease");
  if (/\b\d{2,5}\s+\w+\s+(st|street|ave|avenue|blvd|rd|road)\b/i.test(out.text))
    p.push("text must not share the street address");
  return p;
}

/**
 * The non-AI replier. Answers a first message with the basics and a tour
 * invite, accepts a rent at or above the floor, meets the renter halfway down
 * to the floor, and declines politely once at the floor.
 */
export function subletLadder(input: SubletInput): SubletMove {
  const { minRent } = input.limits;
  const ask = input.listing.askingRent;
  const last = input.yourLastPrice ?? ask;
  const theirs = renterPrice(input.chat);
  const l = input.listing;

  if (theirs === null) {
    const dates = l.availableFrom
      ? ` from ${l.availableFrom}${l.availableTo ? ` to ${l.availableTo}` : ""}`
      : "";
    return {
      move: "message",
      amount: 0,
      text: `Hi! Yes, it's still available${dates}. Rent is $${last}/month${l.furnished ? ", furnished" : ""}. Want to set up a time to see it?`,
      rationale:
        "Answers with the listing's dates and rent and offers a tour, with no address until you agree to a viewing.",
    };
  }
  if (theirs >= minRent) {
    const amount = Math.min(theirs, ask);
    return {
      move: "accept",
      amount,
      text: `$${amount}/month works for me. Want to see the place first? I can do a tour this week.`,
      rationale: `The renter offered $${theirs}, which is at or above your lowest rent of $${minRent}.`,
    };
  }
  if (last <= minRent)
    return {
      move: "walk_away",
      amount: 0,
      text: `Thanks for the offer! $${minRent}/month is the lowest I can do, so no worries if that doesn't work for you.`,
      rationale: `The renter's $${theirs} is under your lowest rent, and you're already at $${minRent}.`,
    };
  const counter = Math.max(minRent, Math.min(last - 5, round5((last + theirs) / 2)));
  return {
    move: "offer",
    amount: counter,
    text: `That's a bit low for me, but I could do $${counter}/month. Would that work?`,
    rationale: `Meeting the renter's $${theirs} partway, staying at or above your lowest rent of $${minRent}.`,
  };
}
