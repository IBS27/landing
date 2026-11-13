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
