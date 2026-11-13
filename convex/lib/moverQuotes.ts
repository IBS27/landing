/**
 * Mover quotes (#28): rate cards read from movers' Facebook Page posts, and the
 * estimate code computes for a move. The model reads rates and drafts the
 * outreach; code does all the math. Pure and unit-tested.
 */

export type MoveSize = "studio" | "1br" | "2br" | "3br";

export const MOVE_SIZES: readonly { id: MoveSize; label: string; hours: number }[] = [
  { id: "studio", label: "Studio", hours: 3 },
  { id: "1br", label: "1 bedroom", hours: 4 },
  { id: "2br", label: "2 bedrooms", hours: 6 },
  { id: "3br", label: "3 bedrooms", hours: 8 },
];

export type DiscountWhen = "weekday" | "student" | "always";

export type RateCard = {
  /** Dollars per hour for the whole crew. */
  hourly: number;
  crew: number;
  minHours: number;
  /** Flat truck or travel fee, dollars. */
  truckFee: number;
  discounts: { label: string; percent: number; when: DiscountWhen }[];
};

export type Move = {
  size: MoveSize;
  /** "YYYY-MM-DD" */
  date: string;
  /** Stairs at either end add an hour. */
  stairs: boolean;
};

export type Estimate = {
  hours: number;
  labor: number;
  truckFee: number;
  /** Discounts that apply to this move (weekday date, always-on), best one only. */
  applied: { label: string; percent: number; amount: number } | null;
  /** Discounts that might apply (student), shown but not taken off. */
  ifEligible: { label: string; percent: number }[];
  total: number;
};

/** Monday–Thursday counts as a weekday move, as movers usually price it. */
export function isWeekdayMove(date: string): boolean {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d >= 1 && d <= 4;
}

export function estimate(card: RateCard, move: Move): Estimate {
  const base = MOVE_SIZES.find((s) => s.id === move.size)?.hours ?? 4;
  const hours = Math.max(card.minHours, base + (move.stairs ? 1 : 0));
  const labor = Math.round(hours * card.hourly);
  const subtotal = labor + card.truckFee;
  const usable = card.discounts.filter(
    (d) => d.when === "always" || (d.when === "weekday" && isWeekdayMove(move.date)),
  );
  // Movers rarely stack deals: take the single best one.
  const best = usable.sort((a, b) => b.percent - a.percent)[0];
  const applied = best
    ? { label: best.label, percent: best.percent, amount: Math.round((labor * best.percent) / 100) }
    : null;
  return {
    hours,
    labor,
    truckFee: card.truckFee,
    applied,
    ifEligible: card.discounts
      .filter((d) => d.when === "student")
      .map(({ label, percent }) => ({ label, percent })),
    total: subtotal - (applied?.amount ?? 0),
  };
}

/** Problems with a rate card read from posts, from the model or the fallback. */
export function rateProblems(card: RateCard): string[] {
  const p: string[] = [];
  if (!(card.hourly >= 50 && card.hourly <= 600))
    p.push("hourly must be the crew's rate, 50 to 600 dollars");
  if (!(Number.isInteger(card.crew) && card.crew >= 1 && card.crew <= 6))
    p.push("crew must be 1 to 6 movers");
  if (!(card.minHours >= 1 && card.minHours <= 8)) p.push("minHours must be 1 to 8");
  if (!(card.truckFee >= 0 && card.truckFee <= 500)) p.push("truckFee must be 0 to 500 dollars");
  for (const d of card.discounts) {
    if (!(d.percent > 0 && d.percent <= 50))
      p.push(`discount "${d.label}" must be 1 to 50 percent`);
    if (!d.label.trim()) p.push("every discount needs a label");
  }
  return p;
}

const num = (s: string | undefined) => (s === undefined ? undefined : Number(s.replace(/,/g, "")));

/** The non-AI reader: rates and deals from a mover's post texts, by pattern. */
export function rateFromText(texts: readonly string[]): RateCard | null {
  const all = texts.join("\n");
  const hourly = num(all.match(/\$(\d{2,3})\s*(?:\/|per\s*)(?:hr|hour)/i)?.[1]);
  if (hourly === undefined) return null;
  const crew = num(all.match(/(\d)\s*(?:-|\s)?(?:person|mover|man)s?\b/i)?.[1]) ?? 2;
  const minHours = num(all.match(/(\d)\s*(?:-|\s)?hour\s*min/i)?.[1]) ?? 2;
  const truckFee = num(all.match(/\$(\d{2,3})\s*(?:truck|travel|trip)\s*fee/i)?.[1]) ?? 0;
  const discounts: RateCard["discounts"] = [];
  for (const m of all.matchAll(/(\d{1,2})%\s*off\s*([^.!\n]*)/gi)) {
    const percent = Number(m[1]);
    const rest = m[2].toLowerCase();
    const when: DiscountWhen = /student/.test(rest)
      ? "student"
      : /week ?day|mid-?week|mon|tue|wed|thu/.test(rest)
        ? "weekday"
        : "always";
    discounts.push({ label: `${percent}% off ${m[2].trim()}`.trim(), percent, when });
  }
  return { hourly, crew, minHours, truckFee, discounts };
}

/* ── Negotiating a quote ───────────────────────────────────────────────── */

export type CounterInput = {
  mover: string;
  /** The price this mover just quoted. */
  theirQuote: number;
  /** The lowest other price the user has: another mover's quote, or an estimate from posted rates. */
  bestOther: { mover: string; price: number; kind: "quote" | "estimate" } | null;
  /** This mover's own posted deals that fit the move. */
  dealsToAsk: { label: string; percent: number }[];
  move: { size: string; date: string };
};

export type CounterMove = { move: "counter" | "accept"; text: string; rationale: string };

const DOLLARS = /\$\s?(\d{1,2},\d{3}|\d{2,5})(?![\d,])/g;

/** Muse may only cite prices and percents that are really in the input. */
export function counterProblems(out: CounterMove, input: CounterInput): string[] {
  const p: string[] = [];
  if (!out.text.trim() || out.text.length > 450) p.push("text must be 1 to 450 characters");
  if (!out.rationale.trim()) p.push("rationale is empty");
  const allowed = new Set([input.theirQuote, ...(input.bestOther ? [input.bestOther.price] : [])]);
  for (const m of out.text.matchAll(DOLLARS)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!allowed.has(n)) p.push(`text names $${n}, which isn't a quote or estimate the user has`);
  }
  for (const m of out.text.matchAll(/(\d{1,2})\s?%/g))
    if (!input.dealsToAsk.some((d) => d.percent === Number(m[1])))
      p.push(`text names ${m[1]}%, which isn't one of this mover's posted deals`);
  const lower = input.bestOther && input.bestOther.price < input.theirQuote;
  if (out.move === "counter" && !lower && input.dealsToAsk.length === 0)
    p.push("nothing to counter with: no lower price and no posted deal to ask for");
  if (out.move === "accept" && lower)
    p.push("don't accept: the user has a lower price to ask this mover to match");
  if (
    out.move === "counter" &&
    lower &&
    input.bestOther?.kind === "quote" &&
    !out.text.includes(input.bestOther.mover)
  )
    p.push("when citing another mover's quote, name that mover");
  return p;
}

/**
 * The non-AI negotiator: ask this mover to match a lower price the user has,
 * or to apply their own posted deal; if they're already the best, accept.
 */
export function counterLadder(input: CounterInput): CounterMove {
  const lower =
    input.bestOther && input.bestOther.price < input.theirQuote ? input.bestOther : null;
  const deal = input.dealsToAsk[0];
  if (lower) {
    const ask =
      lower.kind === "quote"
        ? `${lower.mover} quoted $${lower.price} for the same move`
        : `${lower.mover}'s posted rates come to about $${lower.price} for the same move`;
    return {
      move: "counter",
      text: `Thanks for the quote! ${ask}. Could you match or beat that?${deal ? ` Your ${deal.label} would help too.` : ""}`,
      rationale: `Asks ${input.mover} to match the lowest price you have, $${lower.price} from ${lower.mover}.`,
    };
  }
  if (deal)
    return {
      move: "counter",
      text: `Thanks for the quote! Does that include your ${deal.label}? My move is on ${input.move.date}.`,
      rationale: `${input.mover} posted this deal and your move qualifies, so Muse asks them to apply it.`,
    };
  return {
    move: "accept",
    text: `Thanks, $${input.theirQuote} works for me. Can we lock in ${input.move.date}?`,
    rationale: `$${input.theirQuote} is the best price you have, so Muse suggests booking.`,
  };
}
