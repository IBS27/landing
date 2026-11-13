import {
  type ChatNeighborhood,
  type ChatView,
  findNeighborhoods,
  furnishAsk,
  leadingNeighborhoods,
  numbersIn,
  words,
} from "./chatText";
import { isCalendarDate, isMonth } from "./cityProfileFacts";

/**
 * The move plan a person states in Landing Home's chat (#150): their rent
 * budget, move-in and the neighborhoods they want to live in. `planIn` reads
 * it from one message with keyword rules (the fallback when Muse can't
 * answer), and `planProblems` holds a plan Muse reports to what that message
 * says. Deliberately conservative: a search ("rooms under $2k", "events in the
 * Mission") states no plan, and a furniture budget is never the rent budget.
 * Pure, so the client and the server share it.
 */

export type MovePlan = {
  /** The top of their monthly rent budget, in whole dollars. */
  budgetMax: number | null;
  /** "YYYY-MM", or "YYYY-MM-DD" when they gave the day. */
  moveIn: string | null;
  /** Slugs of the neighborhoods they said they want to live in. */
  neighborhoods: string[];
};

export const NO_PLAN: MovePlan = { budgetMax: null, moveIn: null, neighborhoods: [] };

/** Whether a plan says anything. */
export function statesPlan(plan: MovePlan): boolean {
  return plan.budgetMax !== null || plan.moveIn !== null || plan.neighborhoods.length > 0;
}

/** The brief's budget range (`cityProfile.saveBrief`). */
export const PLAN_BUDGET_MIN = 300;
export const PLAN_BUDGET_MAX = 20_000;
/** How far ahead a move-in may be, in months. */
export const PLAN_MONTHS_AHEAD = 24;
/** Most neighborhoods one message adds. */
export const PLAN_NEIGHBORHOODS_MAX = 5;

export type PlanContext = {
  /** Today in San Francisco, "YYYY-MM-DD" (`todayInSF`). */
  today: string;
  neighborhoods: ChatNeighborhood[];
  /** The tab that's showing: on the Apartment tab a bare budget is for furniture. */
  view?: ChatView;
};

export function validPlanBudget(n: number): boolean {
  return Number.isInteger(n) && n >= PLAN_BUDGET_MIN && n <= PLAN_BUDGET_MAX;
}

/* ── Move-in ── */

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Why a move-in can't be recorded, or null when it's fine: a real month or
 * date, not in the past, and at most `PLAN_MONTHS_AHEAD` months away.
 */
export function moveInDateProblem(value: string, today: string): string | null {
  if (!(value.length === 7 ? isMonth(value) : isCalendarDate(value)))
    return 'use "YYYY-MM" or "YYYY-MM-DD"';
  if (value.slice(0, 7) < today.slice(0, 7) || (value.length === 10 && value < today))
    return "it's in the past";
  if (monthIndex(value) - monthIndex(today) > PLAN_MONTHS_AHEAD)
    return `it's more than ${PLAN_MONTHS_AHEAD} months away`;
  return null;
}

const MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const MONTH_STARTS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const monthOf = (name: string) => MONTH_STARTS.indexOf(name.slice(0, 3)) + 1;
const COUNTS = ["a", "one", "two", "three", "four", "five", "six"];
/** "May" and "March" are also plain words: they need "in", "by", "next"… in front. */
const BEFORE_A_MONTH =
  /\b(?:in|by|for|from|until|till|during|this|next|early|mid|late|starting|around|of|before|after|since)\s+$/;

/** A month with no year is its next occurrence on or after today; so is a day with no year. */
function resolve(today: string, month: number, day: number | null, year: number | null): string {
  const thisYear = Number(today.slice(0, 4));
  if (day === null) {
    const y = year ?? (`${thisYear}-${pad(month)}` >= today.slice(0, 7) ? thisYear : thisYear + 1);
    return `${y}-${pad(month)}`;
  }
  const md = `${pad(month)}-${pad(day)}`;
  return `${year ?? (`${thisYear}-${md}` >= today ? thisYear : thisYear + 1)}-${md}`;
}

function monthsFrom(today: string, n: number): string {
  const i = monthIndex(today) - 1 + n;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

type DateRule = [RegExp, (m: RegExpExecArray, today: string, before: string) => string | null];

/** Most specific first: each match is blanked, so "January 15, 2027" isn't read again as "January". */
const DATE_RULES: DateRule[] = [
  [/\b(20\d\d)-(\d\d)-(\d\d)\b/g, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  [
    new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d\\d)\\b)?`, "g"),
    (m, today) => resolve(today, monthOf(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null),
  ],
  [
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b\\.?(?:,?\\s+(20\\d\\d)\\b)?`,
      "g",
    ),
    (m, today) => resolve(today, monthOf(m[2]), Number(m[1]), m[3] ? Number(m[3]) : null),
  ],
  [/\b(20\d\d)-(\d\d)\b(?!-)/g, (m) => `${m[1]}-${m[2]}`],
  [
    new RegExp(`\\b${MONTH}\\.?,?\\s+(?:of\\s+)?(20\\d\\d)\\b`, "g"),
    (m, today) => resolve(today, monthOf(m[1]), null, Number(m[2])),
  ],
  [/\b(this|next) month\b/g, (m, today) => monthsFrom(today, m[1] === "next" ? 1 : 0)],
  [
    /\bin (a|one|two|three|four|five|six|\d{1,2}) months?\b/g,
    (m, today) => {
      const n = COUNTS.includes(m[1]) ? Math.max(1, COUNTS.indexOf(m[1])) : Number(m[1]);
      return monthsFrom(today, n);
    },
  ],
  [
    new RegExp(`\\b${MONTH}\\b`, "g"),
    (m, today, before) =>
      /^(may|mar|march)$/.test(m[1]) && !BEFORE_A_MONTH.test(before)
        ? null
        : resolve(today, monthOf(m[1]), null, null),
  ],
];

/** The dates a text writes that could be a move-in, and the text without them. */
function scanDates(message: string, today: string): { dates: string[]; rest: string } {
  let rest = message.toLowerCase();
  const dates: string[] = [];
  for (const [re, read] of DATE_RULES) {
    for (const m of rest.matchAll(re)) {
      const value = read(m, today, rest.slice(0, m.index));
      if (value && moveInDateProblem(value, today) === null && !dates.includes(value))
        dates.push(value);
    }
    rest = rest.replace(re, (m) => " ".repeat(m.length));
  }
  return { dates, rest };
}

/**
 * Every month or date a message writes that could be a move-in, most specific
 * first: "2027-01-15", "January 15, 2027", "Jan 15", "in March 2027",
 * "January", "next month". Past ones and ones too far off are left out.
 */
export function datesIn(message: string, today: string): string[] {
  return scanDates(message, today).dates;
}

const MOVING =
  /\b(?:mov(?:e|ing)|move-in|arriv(?:e|ing)|relocat(?:e|ing)|lease (?:starts?|begins?)|need (?:a place|a room|an apartment|somewhere) (?:by|from|for|starting))\b/i;
/** Moving out, subletting or selling: the dates and prices are about leaving. */
const LEAVING =
  /\b(?:mov(?:e|ing|ed) out|move-?out|leaving|(?:sublet(?:ting)?|subleas(?:e|ing)|sell(?:ing)?) (?:my|our))\b/i;

/** A date given as the whole answer ("January 15", "probably next month"), as after "when are you moving?". */
const DATE_FILLER =
  /^(?:in|on|by|around|about|probably|maybe|likely|early|late|mid|the|of|start|end|beginning|sometime|i|think|it|is|its|will|be)$/;
function bareDate(message: string, today: string): boolean {
  const { dates, rest } = scanDates(message, today);
  return (
    dates.length > 0 &&
    words(rest)
      .trim()
      .split(" ")
      .every((w) => !w || DATE_FILLER.test(w))
  );
}

/** Whether a message states when the person moves in, rather than naming a date for something else. */
function statesMoveIn(message: string, today: string): boolean {
  return !LEAVING.test(message) && (MOVING.test(message) || bareDate(message, today));
}

/* ── Rent budget ── */

/** A search ("show rentals under $2,000/mo") names a price to look at, not the person's budget. */
const SEARCHING =
  /\b(?:show|find|search|list|see|browse|any|are there|is there|what(?:'s| is| are)|which)\b[^.?!]*\b(?:rooms?|rentals?|apartments?|apts?|places|listings?|studios?|sublets?|homes?|housing)\b/i;
const OWN_BUDGET = /\b(?:budget|afford)\b/i;
function searchOnly(message: string): boolean {
  return SEARCHING.test(message) && !OWN_BUDGET.test(message);
}

const AMOUNT = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b`;
const ABOUT = String.raw`(?:(?:is|of|at|around|about|under|below|up to|at most|max|maximum|less than|no more than|roughly)\s+)`;
const BUDGET_RULES = [
  // "my budget is $2,400", "budget: 2400", "budget of up to 2.5k"
  new RegExp(String.raw`\bbudget(?:\s+for\s+rent)?[\s:=-]*${ABOUT}*${AMOUNT}`, "i"),
  // "a $2,400 budget", "2400 max budget"
  new RegExp(
    String.raw`${AMOUNT}\s+(?:(?:monthly|max|rent|rental|housing|total)\s+)?budget\b`,
    "i",
  ),
  // "up to 2.5k a month", "$2,400/mo"
  new RegExp(
    String.raw`${AMOUNT}\s*(?:(?:a|per|each|every)\s+(?:month|mo)\b|\/\s*(?:month|mo)\b|monthly\b)`,
    "i",
  ),
  // "rent under $3000", "rent: $2,400" (never "rent 2 rooms")
  new RegExp(String.raw`\brent\s+${ABOUT}+${AMOUNT}`, "i"),
  /\brent[\s:=-]*\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i,
  // "can afford 2400"
  new RegExp(String.raw`\bafford\s+${ABOUT}*${AMOUNT}`, "i"),
];

function rentBudgetIn(message: string, ctx: PlanContext): number | null {
  if (LEAVING.test(message) || furnishAsk(message, ctx) || searchOnly(message)) return null;
  // On the Apartment tab "my budget is $800" is for furniture unless it says rent.
  if (ctx.view === "apartment" && !/\b(?:rent|month|monthly|mo)\b/i.test(message)) return null;
  // Years are not dollars: read amounts from the text without its dates.
  const { rest } = scanDates(message, ctx.today);
  for (const re of BUDGET_RULES) {
    const m = re.exec(rest);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1);
    // "2.5" with no k reads as thousands.
    const dollars = Math.round(!m[2] && n < 10 && m[1].includes(".") ? n * 1000 : n);
    if (validPlanBudget(dollars)) return dollars;
  }
  return null;
}

/* ── Neighborhoods ── */

/** Saying they want to live somewhere. Asking about a place ("events in the Mission") isn't. */
const WANTS =
  / (?:(?:want|wanna|hoping|hope|plan|planning|prefer|like|love|need|looking|trying|aiming) to (?:live|be|stay|rent|move|settle)(?: somewhere)? (?:in|near|around|to|into)|looking (?:in|around)|looking for (?:a|an|my) (?:place|room|apartment|apt|studio|spot|home|sublet) (?:in|near|around)|(?:im|i am|were|we are|ill be|i will be|well be) moving (?:to|into)|interested in living in|(?:i|id|we|wed)(?: would)? prefer|my (?:top|first|preferred|favorite) (?:pick|choice|neighborhoods?) (?:is|are))(?= )/g;
const NOT_BEFORE = / (?:not|dont|never|wont|wouldnt|cant|cannot|avoid|didnt)(?: \w+){0,2} $/;

function wantedNeighborhoods(message: string, neighborhoods: ChatNeighborhood[]): string[] {
  const t = words(message);
  const found: string[] = [];
  for (const m of t.matchAll(WANTS)) {
    if (NOT_BEFORE.test(t.slice(0, m.index + 1))) continue;
    for (const slug of leadingNeighborhoods(t.slice(m.index + m[0].length), neighborhoods))
      if (!found.includes(slug)) found.push(slug);
  }
  return found.slice(0, PLAN_NEIGHBORHOODS_MAX);
}

/** A looser cue than `WANTS`, for holding Muse's reading to the message ("I'd love the Mission"). */
const PREFERS =
  /\b(?:love|like|prefer|want|interested|looking|moving|live|living|stay|settle|ideally|hoping)\b/i;
/** Asking what's in a neighborhood: naming it there isn't wanting to live there. */
const ASKS_ABOUT =
  /\b(?:events?|groups?|things to do|happening|weekend|route|compare|vs|versus|marketplace|crew|tell me about|show me|what(?:'s| is| are)\b.*\blike)\b/i;

/** The neighborhoods a message says the person wants to live in, read as generously as Muse may. */
function statedNeighborhoods(message: string, neighborhoods: ChatNeighborhood[]): Set<string> {
  const strict = wantedNeighborhoods(message, neighborhoods);
  if (!PREFERS.test(message) || ASKS_ABOUT.test(message)) return new Set(strict);
  return new Set([...strict, ...findNeighborhoods(message, neighborhoods)]);
}

/* ── The plan ── */

/**
 * What one message states about the person's own move, by keyword rules:
 * - a rent budget only when it's said as one ("my budget is $2,400", "up to
 *   2.5k a month", "rent under $3000"), never from a furnish request;
 * - a move-in only when the message is about moving in ("moving in January",
 *   "arriving Jan 15", "move-in 2027-01-15", "moving next month");
 * - neighborhoods only when they say they want to live there ("I want to live
 *   in the Mission", "looking in Noe Valley or Bernal").
 */
export function planIn(message: string, ctx: PlanContext): MovePlan {
  return {
    budgetMax: rentBudgetIn(message, ctx),
    moveIn:
      MOVING.test(message) && !LEAVING.test(message)
        ? (datesIn(message, ctx.today)[0] ?? null)
        : null,
    neighborhoods: wantedNeighborhoods(message, ctx.neighborhoods),
  };
}

/**
 * What's wrong with a plan Muse reports for `message`: an amount, a date or a
 * neighborhood the message doesn't say, a value out of range, or a furniture
 * budget passed off as rent. Empty when fine.
 */
export function planProblems(plan: MovePlan, message: string, ctx: PlanContext): string[] {
  const problems: string[] = [];
  const { budgetMax, moveIn } = plan;
  if (budgetMax !== null) {
    if (!validPlanBudget(budgetMax))
      problems.push(
        `plan.budgetMax: a monthly rent in whole dollars, ${PLAN_BUDGET_MIN} to ${PLAN_BUDGET_MAX}, or null`,
      );
    else if (!numbersIn(message).includes(budgetMax))
      problems.push("plan.budgetMax: only an amount the person wrote in this message, or null");
    else if (furnishAsk(message, ctx))
      problems.push("plan.budgetMax: a furniture budget is not the rent budget; use null");
    else if (searchOnly(message))
      problems.push("plan.budgetMax: a price to search under is not their budget; use null");
  }
  if (moveIn !== null) {
    const why = moveInDateProblem(moveIn, ctx.today);
    if (why) problems.push(`plan.moveIn: ${why}; use null`);
    else if (
      !datesIn(message, ctx.today).some(
        (d) => d === moveIn || (moveIn.length === 7 && d.startsWith(moveIn)),
      )
    )
      problems.push("plan.moveIn: only a month or date the person wrote in this message, or null");
    else if (!statesMoveIn(message, ctx.today))
      problems.push("plan.moveIn: only when the message says when they move in; use null");
  }
  const known = new Set(ctx.neighborhoods.map((n) => n.slug));
  const named = statedNeighborhoods(message, ctx.neighborhoods);
  if (
    plan.neighborhoods.length > PLAN_NEIGHBORHOODS_MAX ||
    new Set(plan.neighborhoods).size !== plan.neighborhoods.length
  )
    problems.push(
      `plan.neighborhoods: at most ${PLAN_NEIGHBORHOODS_MAX} different neighborhood slugs`,
    );
  const strange = plan.neighborhoods.filter((s) => !known.has(s) || !named.has(s));
  if (strange.length)
    problems.push(
      `plan.neighborhoods: ${strange.join(", ")} is not a slug from input.neighborhoods the person says they want to live in`,
    );
  return problems;
}
