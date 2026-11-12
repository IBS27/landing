import {
  type FactEntry,
  factLabel,
  factSlot,
  type GoalId,
  moveInProblem,
  type NeighborhoodSlug,
  TRANSPORT_MODES,
  type TransportMode,
  type WorkHours,
  type Workplace,
} from "./cityProfileFacts";
import { INTERESTS, type InterestId } from "./interests";
import { REDACTED, redactProtected } from "./protectedText";

/**
 * Turns the optional "Tell us about you" text into proposed City Profile
 * facts, each with the words it came from. Nothing is saved here: the person
 * ticks what's right and the brief saves it.
 *
 * Protected traits are removed before anything is read (`redactProtected`),
 * and a proposal's quote is only the fact's own matched words ("hiking",
 * "$2,400", "March 14"), never the rest of the sentence: whatever else the
 * person wrote about themselves can't become evidence, even if the redaction
 * misses it. Negated mentions ("I don't like climbing") propose nothing.
 *
 * This is the rules-based path. Muse's model task (`./profileFromText.ts`)
 * runs first; these rules are its fallback when AI is off or the model can't
 * produce a valid answer, so the box always works.
 */

export type ProposedFact = {
  entry: FactEntry;
  quote: string;
  label: string;
  /** Transport only: they said they have no car (otherwise car is simply not mentioned). */
  carFree?: boolean;
};

export const MAX_TEXT_LENGTH = 1000;

/** How a proposal reads in the confirm list ("Bike, BART, no car"). */
export function proposalLabel(entry: FactEntry, carFree?: boolean): string {
  if (entry.key !== "transport") return factLabel(entry);
  const labels: string[] = TRANSPORT_MODES.filter((m) => entry.value.modes.includes(m.id)).map(
    (m) => m.label,
  );
  if (carFree) labels.push("no car");
  return labels.join(", ").replace(/^n/, "N");
}

/* ---------------- Clauses and negation ---------------- */

/** One sentence or clause, with the spans a negation covers ("don't like climbing or coffee"). */
type Part = { text: string; negated: [number, number][] };

/** Where some words sit in a clause. */
type Hit = { part: Part; start: number; end: number };

const NEGATION =
  /\b(?:don['’]?t|do not|doesn['’]?t|does not|didn['’]?t|did not|never|not|no longer|no|nor|neither|hate[sd]?|dislike[sd]?|can(?:not|['’]?t)(?!\s+(?:wait|believe)\b)|avoid(?:s|ing)?|isn['’]?t|aren['’]?t|wasn['’]?t|won['’]?t|wouldn['’]?t|without|quit|stopped|gave up)\b/gi;
/**
 * Words after "no"/"not" that make it a limit rather than a negation ("no more
 * than $2,400", "not moving until March").
 */
const BOUND =
  /^\s+(?:(?:more|less|later|earlier|sooner|higher|lower|over|above|below|under|exceeding|beyond)\b|(?:\w+\s+)?(?:until|till)\b)/i;
/** Where a negation stops: a contrast, a new clause about the person, or punctuation. */
const NEGATION_END =
  /\b(?:but|though|although|however|except|yet|whereas|while|instead|so|because)\b|[;:—–]|(?:,|\band)\s+(?=(?:i|we)\b)/i;

const NOUN_NEGATION_END = new RegExp(`${NEGATION_END.source}|,|\\band\\b`, "i");

/**
 * The spans of `text` a negation covers, from the end of the negating word to
 * the end of its clause. A match that starts inside one is negated; one that
 * starts with the negating word itself ("don't know anyone", "no car") isn't.
 */
export function negatedSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of text.matchAll(NEGATION)) {
    const from = m.index + m[0].length;
    if (BOUND.test(text.slice(from))) continue;
    // "No car and take BART": "no" and "without" negate their own noun, not the rest.
    const end = /^(?:no|without)$/i.test(m[0]) ? NOUN_NEGATION_END : NEGATION_END;
    const stop = text.slice(from).search(end);
    spans.push([from, stop === -1 ? text.length : from + stop]);
  }
  return spans;
}

function isNegated(part: Part, at: number): boolean {
  return part.negated.some(([s, e]) => at >= s && at < e);
}

/** Sentences and clauses, with their original wording. */
function clauses(text: string): Part[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => ({ text: t, negated: negatedSpans(t) }));
}

function global(re: RegExp): RegExp {
  return re.global ? re : new RegExp(re.source, `${re.flags}g`);
}

/** Every match of `re` across the parts, in reading order; negated ones skipped unless `negatable` is false. */
function hits(parts: Part[], re: RegExp, negatable = true): Hit[] {
  const out: Hit[] = [];
  for (const part of parts) {
    for (const m of part.text.matchAll(global(re))) {
      if (m[0].length === 0) continue;
      if (negatable && isNegated(part, m.index)) continue;
      out.push({ part, start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

function firstHit(parts: Part[], re: RegExp, negatable = true): Hit | null {
  return hits(parts, re, negatable)[0] ?? null;
}

function firstOf(parts: Part[], res: RegExp[], negatable = true): Hit | null {
  const all = res.flatMap((re) => hits(parts, re, negatable));
  all.sort((a, b) => parts.indexOf(a.part) - parts.indexOf(b.part) || a.start - b.start);
  return all[0] ?? null;
}

/** Where one phrase ends and the next starts: a redaction, punctuation or a joining word. */
const PHRASE_BREAK = new RegExp(
  `${REDACTED.replace(/[[\]]/g, "\\$&")}|[,;:()]|\\b(?:and|but|or|so|who|which|while|because|though|although|plus)\\b`,
  "gi",
);

/** The phrase a hit sits in, for deciding what an amount, a month or a place is about. */
function phraseOf({ part, start, end }: Hit): string {
  const t = part.text;
  let from = 0;
  let to = t.length;
  for (const m of t.matchAll(PHRASE_BREAK)) {
    if (m.index + m[0].length <= start) from = m.index + m[0].length;
    else if (m.index >= end) {
      to = m.index;
      break;
    }
  }
  return t.slice(from, to).trim();
}

/**
 * A proposal's quote: the fact's own matched words and nothing else
 * ("hiking", "$2,400", "March 14", "bike … BART"), copied exactly. Nothing
 * else the person wrote, about themselves or anything, becomes evidence.
 */
function spanQuote(spans: Hit[]): string {
  return [...new Set(spans.map((h) => h.part.text.slice(h.start, h.end).trim()))].join(" … ");
}

/* ---------------- Interests ---------------- */

/** A phrase as a whole-word pattern; spaces match any separator ("board-games", "farmer's market"). */
function wordRe(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi");
}

const INTEREST_RES = new Map<InterestId, RegExp[]>(
  INTERESTS.map((i) => [i.id as InterestId, i.aliases.map(wordRe)]),
);

/* ---------------- Neighborhoods ---------------- */

/**
 * Everyday names → Analysis Neighborhood. Ambiguous words ("Mission",
 * "Sunset", "Marina") must be capitalized or follow "the". Matches can't
 * overlap and longer names win, so "Outer Mission" isn't also the Mission.
 */
const NEIGHBORHOOD_PATTERNS: { re: RegExp; slug: NeighborhoodSlug }[] = [
  { re: /\bMission Bay\b/i, slug: "mission-bay" },
  { re: /\b(the mission|Mission District|Mission(?! Bay)\b)/, slug: "mission" },
  { re: /\bthe Mission\b/i, slug: "mission" },
  { re: /\b(SoMa|South of Market)\b/i, slug: "south-of-market" },
  { re: /\bInner Sunset\b/i, slug: "inner-sunset" },
  { re: /\b(Outer Sunset|the Sunset|Sunset District|Parkside)\b/i, slug: "sunset-parkside" },
  { re: /\bInner Richmond\b/i, slug: "inner-richmond" },
  { re: /\bOuter Richmond\b/i, slug: "outer-richmond" },
  { re: /\bHayes Valley\b/i, slug: "hayes-valley" },
  { re: /\b(Haight[- ]Ashbury|the Haight|Upper Haight)\b/i, slug: "haight-ashbury" },
  { re: /\b(the Castro|Castro|Duboce Triangle)\b/i, slug: "castro-upper-market" },
  { re: /\bNoe Valley\b|\bNoe\b/i, slug: "noe-valley" },
  { re: /\bBernal( Heights)?\b/i, slug: "bernal-heights" },
  { re: /\bGlen Park\b/i, slug: "glen-park" },
  { re: /\bNorth Beach\b/i, slug: "north-beach" },
  { re: /\bRussian Hill\b/i, slug: "russian-hill" },
  { re: /\bNob Hill\b/i, slug: "nob-hill" },
  { re: /\b(the Marina|Marina District|Marina\b)/, slug: "marina" },
  { re: /\b(Pac(ific)? Heights)\b/i, slug: "pacific-heights" },
  { re: /\b(Potrero( Hill)?|Dogpatch)\b/i, slug: "potrero-hill" },
  { re: /\b(FiDi|Financial District|South Beach)\b/i, slug: "financial-district-south-beach" },
  { re: /\bChinatown\b/i, slug: "chinatown" },
  { re: /\bJapantown\b/i, slug: "japantown" },
  { re: /\bTenderloin\b/i, slug: "tenderloin" },
  { re: /\b(Western Addition|NoPa|Alamo Square|Fillmore)\b/i, slug: "western-addition" },
  { re: /\bBayview\b/i, slug: "bayview-hunters-point" },
  { re: /\bExcelsior\b/i, slug: "excelsior" },
  { re: /\bOuter Mission\b/i, slug: "outer-mission" },
  { re: /\bTwin Peaks\b/i, slug: "twin-peaks" },
  { re: /\b(Lone Mountain|USF)\b/i, slug: "lone-mountain-usf" },
  { re: /\bPresidio Heights\b/i, slug: "presidio-heights" },
];

/** Breaks between "I work in X" and "and want to live in Y". */
const PLACE_BREAK =
  /[;:()]|\b(?:but|while|because|though|although|so|whereas)\b|(?:,|\band\b|\bor\b)\s+(?=(?:i|we|want\w*|would|hope\w*|plan\w*|looking|live|living|move|moving|prefer\w*|ideally)\b)/gi;
const PAST_PLACE = /\b(?:used to|lived|grew up|visit\w*)\b/i;
const WORK_PLACE =
  /\b(?:work\w*|office|job|commut\w*|based|campus|school|stud(?:y|ying|ent)|class(?:es)?)\b/i;
const HOME_PLACE = /\b(?:live|living|move|moving|apartment|place|rent|stay|neighborhood)\b/i;

/**
 * Whether a place named at `at` is somewhere they'd consider living: not
 * where they work, study or used to live ("I work at Google in SoMa", "my
 * office will be in the Mission"), unless the same phrase is about living there.
 */
function isHomePlace(part: Part, at: number): boolean {
  let from = 0;
  let to = part.text.length;
  for (const m of part.text.matchAll(PLACE_BREAK)) {
    if (m.index + m[0].length <= at) from = m.index + m[0].length;
    else if (m.index > at) {
      to = m.index;
      break;
    }
  }
  const phrase = part.text.slice(from, to);
  if (PAST_PLACE.test(phrase)) return false;
  return !WORK_PLACE.test(phrase) || HOME_PLACE.test(phrase);
}

function neighborhoodsFrom(parts: Part[]): ProposedFact[] {
  const found = NEIGHBORHOOD_PATTERNS.flatMap(({ re, slug }) =>
    hits(parts, re).map((hit) => ({ hit, slug })),
  )
    .filter(({ hit }) => isHomePlace(hit.part, hit.start))
    .sort((a, b) => b.hit.end - b.hit.start - (a.hit.end - a.hit.start));
  const kept: typeof found = [];
  for (const f of found) {
    const overlaps = kept.some(
      (k) => k.hit.part === f.hit.part && k.hit.start < f.hit.end && f.hit.start < k.hit.end,
    );
    if (!overlaps) kept.push(f);
  }
  kept.sort(
    (a, b) => parts.indexOf(a.hit.part) - parts.indexOf(b.hit.part) || a.hit.start - b.hit.start,
  );
  return kept.map(({ hit, slug }) => {
    const entry: FactEntry = { key: "neighborhood", value: { slug } };
    return { entry, quote: spanQuote([hit]), label: factLabel(entry) };
  });
}

/* ---------------- Transport ---------------- */

const NO_CAR =
  /\b(no car|don'?t (have|own) a car|do not (have|own) a car|without a car|car[- ]free|carless|don'?t drive|can'?t drive|cannot drive)\b/i;
const TRANSPORT_PATTERNS: { re: RegExp; mode: TransportMode }[] = [
  { re: /\b(walk|walking|walkable|on foot)\b/i, mode: "walk" },
  { re: /\b(bike|bikes|biking|cycle to|e-?bike)\b/i, mode: "bike" },
  { re: /\b(muni|n[- ]judah|streetcar|the bus|by bus|buses|light rail)\b/i, mode: "muni" },
  { re: /\bbart\b/i, mode: "bart" },
  { re: /\bcaltrain\b/i, mode: "caltrain" },
  { re: /\b(my car|i drive|have a car|by car|driving)\b/i, mode: "car" },
];

/* ---------------- Goals ---------------- */

const GOAL_PATTERNS: { re: RegExp; id: GoalId }[] = [
  {
    re: /\b(meet (new )?people|make (new )?friends|new friends|don'?t know anyone|know (nobody|no one)|find my people)\b/i,
    id: "meet_people",
  },
  // Looking for roommates, not "I already have roommates".
  {
    re: /\b((looking|search(ing)?|hoping|hope) for|need(ing)?|want(ing)?|find(ing)?|seeking|open to|hoping to find)\s+((a|an|some|new|good|one|two|three|\d)\s+)*roommates?\b|\broommates? (search|hunting|wanted)\b/i,
    id: "find_roommates",
  },
  {
    re: /\b(find(ing)? a (place|apartment|studio|room)|looking for a (place|apartment|studio|room)|apartment hunting|need a (new )?(place|apartment))\b/i,
    id: "find_place",
  },
  { re: /\b(explore|exploring|discover)\b/i, id: "explore_city" },
  { re: /\b(furnish|furniture|decorate|decorating)\b/i, id: "furnish_place" },
  { re: /\b(a regular|routine|my spot|local spot)\b/i, id: "build_routine" },
];

/* ---------------- Budget ---------------- */

const NUM = String.raw`(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?k\b)?`;
/** One amount or a range: "$2,400", "$2.4k", "1800–2400", "$1,800 to $2,400". */
const AMOUNT = new RegExp(`${NUM}(?:\\s*(-|–|—|to|and)\\s*${NUM})?`, "gi");
const PER_MONTH = /^\s*(?:\/\s*mo(?:nth)?\b|(?:a|per|each|every)\s+month\b|monthly\b)/i;
const BUDGET_LEAD =
  /\b(?:budget|rent|spend|afford|up to|under|below|max(?:imum)?|around|about|between|range)\b[^.\d$]{0,15}$/i;
const RENT_CONTEXT =
  /\b(?:budget|rent|afford|a month|per month|monthly|apartment|studio|1br|one[\s-]bed\w*|room)\b|\/\s?mo/i;
/** Money that isn't the rent they're looking for: pay, savings, deposits, other spending, rent now. */
const NOT_RENT = new RegExp(
  [
    "\\b(?:salary|income|make|makes|making|earn\\w*|paid|paycheck|savings|saved|deposit|bonus|stipend|loans?|debt)\\b",
    "\\b(?:on|for|towards?)\\s+(?:(?:a|an|my|the|new|some)\\s+)*(?:furniture|couch|sofa|bed|groceries|food|utilities|internet|gym|travel|moving|movers|car|parking|tuition|deposit)\\b",
    "\\b(?:furniture|grocery|groceries|food|travel|moving|tuition|car|parking|wedding)\\s+budget\\b",
    "\\b(?:current(?:ly)?|right now|at the moment)\\b",
    "(?<!\\b(?:can|could|would|will|to|i['’]ll|willing to)\\s)\\bpay(?:ing)?\\b",
  ].join("|"),
  "i",
);

/** Whole dollars; thousands only with an explicit "k" ("$2.4k"), so "$20" is twenty dollars. */
function dollarsOf(raw: string, k: boolean): number {
  return Math.round(Number(raw.replace(/,/g, "")) * (k ? 1000 : 1));
}

const inRange = (n: number) => n >= 300 && n <= 20000;

type Amount = {
  value: { min?: number; max: number };
  hit: Hit;
  counts: boolean;
  perMonth: boolean;
};

/**
 * The amounts in a clause. One counts as rent-like when it has a "$" or "k",
 * is followed by "a month", or follows "budget", "rent", "up to" and the like,
 * so "March 2027" or "9 to 5" aren't amounts.
 */
function amountsIn(part: Part): Amount[] {
  const p = part.text;
  const out: Amount[] = [];
  for (const m of p.matchAll(AMOUNT)) {
    const [, dollarA, a, kA, sep, dollarB, b, kB] = m;
    const before = p.slice(0, m.index);
    const after = p.slice(m.index + m[0].length);
    const isRange = b !== undefined && (sep !== "and" || /\bbetween\s*$/i.test(before));
    // "1.8–2.4k": the "k" covers both ends.
    const low = dollarsOf(a, Boolean(kA) || (isRange && Boolean(kB) && Number(a) < 100));
    const high = isRange ? dollarsOf(b, Boolean(kB)) : null;
    let value: Amount["value"] | null = null;
    if (high !== null && inRange(high))
      value = inRange(low) && low < high ? { min: low, max: high } : { max: high };
    else if (inRange(low)) value = { max: low };
    if (!value) continue;
    // "$2400 and $500" isn't a range: the amount ends after its own number.
    const end =
      b !== undefined && !isRange
        ? m.index + (dollarA ?? "").length + a.length + (kA ?? "").length
        : m.index + m[0].length;
    const perMonth = PER_MONTH.test(after);
    const counts = Boolean(
      dollarA || kA || (isRange && (dollarB || kB)) || perMonth || BUDGET_LEAD.test(before),
    );
    out.push({ value, hit: { part, start: m.index, end }, counts, perMonth });
  }
  return out;
}

/** The monthly rent they're looking for: a stated rent budget first, else the first amount that reads as rent. */
function budgetFrom(parts: Part[]): ProposedFact | null {
  const found: { amount: Amount; rent: boolean }[] = [];
  for (const part of parts) {
    for (const amount of amountsIn(part)) {
      if (!amount.counts || isNegated(part, amount.hit.start)) continue;
      // Decided by the amount's own phrase: "my salary is $6000 and rent is $2000".
      const phrase = phraseOf(amount.hit);
      if (NOT_RENT.test(phrase)) continue;
      found.push({ amount, rent: RENT_CONTEXT.test(phrase) || amount.perMonth });
    }
  }
  const best = found.find((f) => f.rent) ?? found[0];
  if (!best) return null;
  const entry: FactEntry = { key: "budget", value: best.amount.value };
  return { entry, quote: spanQuote([best.amount.hit]), label: factLabel(entry) };
}

/* ---------------- Move-in ---------------- */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_RE = new RegExp(
  `\\b(${MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join("|")})\\.?(?:\\s+(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s+(20\\d\\d))?\\b`,
  "gi",
);
/** Words that say the month is when they move ("moving in April"), not when something else starts. */
const MOVING = /\b(mov\w*|land\w*|arriv\w*|relocat\w*|get(ting)? to|coming|get here|in town)\b/i;
const MOVE_RELATED = /\b(mov|land|arriv|start|relocat|get(ting)? to|coming)/i;

type MonthMention = { month: number; day?: number; year?: number; hit: Hit };

function monthsIn(parts: Part[], negatable: boolean): MonthMention[] {
  const out: MonthMention[] = [];
  for (const hit of hits(parts, MONTH_RE, negatable)) {
    const m = hit.part.text.slice(hit.start, hit.end).match(new RegExp(MONTH_RE.source, "i"));
    if (!m) continue;
    // "may" alone is too often the verb.
    if (m[1].toLowerCase() === "may" && !m[3] && !/\bin may\b/i.test(hit.part.text)) continue;
    out.push({
      month: MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) + 1,
      day: m[2] ? Number(m[2]) : undefined,
      year: m[3] ? Number(m[3]) : undefined,
      hit,
    });
  }
  return out;
}

/**
 * The move-in month (and day, when given). A month in a phrase about moving
 * ("but move in April") beats one in a clause that only mentions starting
 * ("I start work in March"). Without a year it's the next such month. Uses the
 * same rules as Muse's checks and `saveBrief` (`moveInProblem`): an impossible
 * or past date drops the day, and a past month proposes nothing.
 */
function moveInFrom(parts: Part[], today: string): ProposedFact | null {
  const found: { value: { month: string; date?: string }; hit: Hit; score: number }[] = [];
  for (const m of monthsIn(parts, true)) {
    const score = MOVING.test(phraseOf(m.hit)) ? 2 : MOVE_RELATED.test(m.hit.part.text) ? 1 : 0;
    if (score === 0) continue;
    let year = m.year ?? Number(today.slice(0, 4));
    if (!m.year && m.month < Number(today.slice(5, 7))) year += 1;
    const mm = `${year}-${String(m.month).padStart(2, "0")}`;
    const candidates: { month: string; date?: string }[] = m.day
      ? [{ month: mm, date: `${mm}-${String(m.day).padStart(2, "0")}` }, { month: mm }]
      : [{ month: mm }];
    const value = candidates.find((c) => moveInProblem(c, today) === null);
    if (value) found.push({ value, hit: m.hit, score });
  }
  const best = found.find((f) => f.score === 2) ?? found[0];
  if (!best) return null;
  const entry: FactEntry = { key: "moveIn", value: best.value };
  return { entry, quote: spanQuote([best.hit]), label: factLabel(entry) };
}

/* ---------------- Schedule and work ---------------- */

const WORK_HOURS_PATTERNS: { re: RegExp; hours: WorkHours }[] = [
  // "Work nights", not "board game nights".
  {
    re: /\b(night shifts?|work(ing|s)? nights|nights? nurse|overnights?|graveyard)\b/i,
    hours: "night",
  },
  { re: /\b(evening shifts?|work evenings|closing shifts?)\b/i, hours: "evening" },
  { re: /\b(9\s?(-|to)\s?5|nine to five|day job|office job|work days)\b/i, hours: "day" },
  { re: /\b(shifts? vary|irregular hours|freelanc\w*)/i, hours: "varies" },
];
const WORKPLACE_PATTERNS: { re: RegExp; place: Workplace }[] = [
  { re: /\b(remote|work from home|wfh)\b/i, place: "remote" },
  { re: /\bhybrid\b/i, place: "hybrid" },
  { re: /\b(in the office|in-office|in office|commut\w*)/i, place: "office" },
];
const WORKS_WEEKENDS =
  /\bwork(s|ing)?\b[^.!?]{0,30}\b(weekends?|saturdays?|sundays?)\b|\bweekend shifts?\b|\bon call\b[^.!?]{0,15}\bweekends?\b/i;

/** Where they say they work weekends, with the weekend word itself not negated ("not weekends"). */
function weekendWork(parts: Part[], negatable: boolean): Hit | null {
  for (const h of hits(parts, WORKS_WEEKENDS, false)) {
    const word = h.start + h.part.text.slice(h.start, h.end).search(/weekend|saturday|sunday/i);
    if (!negatable || (!isNegated(h.part, h.start) && !isNegated(h.part, word))) return h;
  }
  return null;
}

function scheduleFrom(parts: Part[]): ProposedFact | null {
  const hours = WORK_HOURS_PATTERNS.map((p) => ({ ...p, hit: firstHit(parts, p.re) })).find(
    (p) => p.hit,
  );
  const place = WORKPLACE_PATTERNS.map((p) => ({ ...p, hit: firstHit(parts, p.re) })).find(
    (p) => p.hit,
  );
  if (!hours?.hit && !place?.hit) return null;
  const weekend = weekendWork(parts, true);
  const entry: FactEntry = {
    key: "schedule",
    value: place
      ? { workHours: hours?.hours ?? "day", workplace: place.place, weekendsFree: !weekend }
      : { workHours: hours?.hours ?? "day", weekendsFree: !weekend },
  };
  const spans = [hours?.hit, place?.hit, weekend].filter((h): h is Hit => Boolean(h));
  return { entry, quote: spanQuote(spans), label: factLabel(entry) };
}

const EMPLOYER_RE =
  /\b(?:work(?:ing)? (?:at|for)|job at|joining|starting at|engineer at|designer at|nurse at|intern(?:ing)? at)\s+((?:[A-Z][\w&'.-]*)(?:\s+[A-Z][\w&'.-]*){0,3})/;

function employerFrom(parts: Part[]): ProposedFact | null {
  for (const hit of hits(parts, EMPLOYER_RE)) {
    const m = hit.part.text.slice(hit.start).match(EMPLOYER_RE);
    if (!m) continue;
    const name = m[1].replace(/[.,]$/, "").trim();
    if (name.length < 2 || name.length > 60) continue;
    const start = hit.start + m[0].indexOf(m[1]);
    const entry: FactEntry = { key: "employer", value: { name } };
    return {
      entry,
      quote: spanQuote([{ part: hit.part, start, end: start + name.length }]),
      label: factLabel(entry),
    };
  }
  return null;
}

/* ---------------- Entry point ---------------- */

/**
 * Proposed facts found in `text`, one per slot, in reading order of kind.
 * `today` is "YYYY-MM-DD" in San Francisco.
 */
export function extractFacts(text: string, today: string): ProposedFact[] {
  const parts = clauses(redactProtected(text.slice(0, MAX_TEXT_LENGTH)));
  if (parts.length === 0) return [];
  const out: ProposedFact[] = [];
  const add = (p: ProposedFact | null) => {
    if (p && !out.some((o) => factSlot(o.entry) === factSlot(p.entry))) out.push(p);
  };

  add(budgetFrom(parts));
  add(moveInFrom(parts, today));
  for (const n of neighborhoodsFrom(parts)) add(n);

  const modes: TransportMode[] = [];
  const spans: Hit[] = [];
  const noCar = firstHit(parts, NO_CAR);
  if (noCar) spans.push(noCar);
  for (const { re, mode } of TRANSPORT_PATTERNS) {
    const hit = firstHit(parts, re);
    if (hit && !(noCar && mode === "car")) {
      modes.push(mode);
      spans.push(hit);
    }
  }
  if (spans.length > 0) {
    const entry: FactEntry = { key: "transport", value: { modes } };
    add({
      entry,
      quote: spanQuote(spans),
      label: proposalLabel(entry, Boolean(noCar)),
      carFree: Boolean(noCar),
    });
  }

  add(scheduleFrom(parts));
  add(employerFrom(parts));

  // Interests: alias phrases as whole words, in list order.
  for (const interest of INTERESTS) {
    const hit = firstOf(parts, INTEREST_RES.get(interest.id) ?? []);
    if (hit) {
      const entry: FactEntry = { key: "interest", value: { id: interest.id } };
      add({ entry, quote: spanQuote([hit]), label: factLabel(entry) });
    }
  }

  for (const { re, id } of GOAL_PATTERNS) {
    const hit = firstHit(parts, re);
    if (hit) {
      const entry: FactEntry = { key: "goal", value: { id } };
      add({ entry, quote: spanQuote([hit]), label: factLabel(entry) });
    }
  }
  return out;
}

/* ---------------- Muse's proposals: support, checks and quotes ---------------- */

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The words in `parts` that name `entry` with its value: the activity, the
 * place, the amount equal to the budget, the month (and day) of the move, each
 * transport mode, the schedule's hours, workplace and weekend work. Null when
 * any of them is missing, so the quote doesn't support the fact. Negated
 * mentions count here; `quoteProblem` judges them. `carFree`: true requires
 * the "no car" words, undefined includes them when present.
 */
function factSpans(entry: FactEntry, parts: Part[], carFree?: boolean): Hit[] | null {
  const one = (h: Hit | null) => (h ? [h] : null);
  switch (entry.key) {
    case "interest":
      return one(firstOf(parts, INTEREST_RES.get(entry.value.id) ?? [], false));
    case "neighborhood":
      return one(
        firstOf(
          parts,
          NEIGHBORHOOD_PATTERNS.filter((n) => n.slug === entry.value.slug).map((n) => n.re),
          false,
        ),
      );
    case "goal":
      return one(
        firstOf(
          parts,
          GOAL_PATTERNS.filter((g) => g.id === entry.value.id).map((g) => g.re),
          false,
        ),
      );
    case "employer":
      return one(firstHit(parts, new RegExp(escapeRe(entry.value.name.trim()), "i"), false));
    case "budget": {
      const amounts = parts.flatMap(amountsIn);
      const exact = amounts.find((a) => valueEq(a.value, entry.value));
      if (exact) return [exact.hit];
      // "$1,800 or so, up to $2,400": each end said on its own.
      const single = (n: number) =>
        amounts.find((a) => a.value.max === n && a.value.min === undefined)?.hit;
      const max = single(entry.value.max);
      if (!max) return null;
      if (entry.value.min === undefined) return [max];
      const min = single(entry.value.min);
      return min ? [min, max] : null;
    }
    case "moveIn": {
      const [year, month] = entry.value.month.split("-").map(Number);
      const day = entry.value.date ? Number(entry.value.date.slice(8)) : undefined;
      const m = monthsIn(parts, false).find(
        (x) =>
          x.month === month &&
          (x.year === undefined || x.year === year) &&
          (day === undefined || x.day === day),
      );
      return one(m?.hit ?? null);
    }
    case "transport": {
      const spans: Hit[] = [];
      const noCar = firstHit(parts, NO_CAR, false);
      if (carFree && !noCar) return null;
      if (noCar && carFree !== false) spans.push(noCar);
      for (const mode of entry.value.modes) {
        const re = TRANSPORT_PATTERNS.find((t) => t.mode === mode)?.re;
        const hit = re ? firstHit(parts, re, false) : null;
        if (!hit) return null;
        spans.push(hit);
      }
      return spans.length > 0 ? spans : null;
    }
    case "schedule": {
      const spans: Hit[] = [];
      const { workHours, workplace, weekendsFree } = entry.value;
      const hoursRe = WORK_HOURS_PATTERNS.find((p) => p.hours === workHours)?.re;
      const hoursHit = hoursRe ? firstHit(parts, hoursRe, false) : null;
      if (workHours !== "day" && !hoursHit) return null;
      if (hoursHit) spans.push(hoursHit);
      const placeRe = WORKPLACE_PATTERNS.find((p) => p.place === workplace)?.re;
      if (placeRe) {
        const placeHit = firstHit(parts, placeRe, false);
        if (!placeHit) return null;
        spans.push(placeHit);
      }
      if (!weekendsFree) {
        const weekend = weekendWork(parts, false);
        if (!weekend) return null;
        spans.push(weekend);
      }
      return spans.length > 0 ? spans : null;
    }
  }
}

function valueEq(a: { min?: number; max: number }, b: { min?: number; max: number }): boolean {
  return a.max === b.max && (a.min ?? null) === (b.min ?? null);
}

/**
 * Why `quote` doesn't support `entry` in `text`, or null. The quote must
 * contain the fact's own words (`factSpans`), and each of them must appear
 * somewhere in the text un-negated ("not $3000", "I can't bike"), and for a
 * neighborhood, as a place to live rather than work ("I work in the Mission").
 * Limits ("no more than $2,400") and negations that are the fact ("I don't
 * have a car") count. When the quote isn't in the text as-is, the copy check
 * reports that instead.
 */
export function quoteProblem(
  text: string,
  entry: FactEntry,
  quote: string,
  carFree?: boolean,
): string | null {
  const q = quote.trim();
  const spans = factSpans(entry, clauses(q), carFree);
  if (!spans)
    return `the quote "${q}" doesn't contain the words for this fact (the ${entry.key} itself)`;
  const lq = q.toLowerCase();
  const textParts = clauses(redactProtected(text));
  for (const span of spans) {
    const offset = Math.max(0, q.indexOf(span.part.text)) + span.start;
    const spots = textParts.flatMap((part) => {
      const out: number[] = [];
      const t = part.text.toLowerCase();
      for (let i = t.indexOf(lq); i !== -1; i = t.indexOf(lq, i + 1)) out.push(i + offset);
      return out.map((at) => ({ part, at }));
    });
    if (spots.length === 0) return null;
    const words = span.part.text.slice(span.start, span.end);
    if (spots.every((s) => isNegated(s.part, s.at)))
      return `the text says the opposite ("${words}" is negated there)`;
    if (
      entry.key === "neighborhood" &&
      spots.every((s) => isNegated(s.part, s.at) || !isHomePlace(s.part, s.at))
    )
      return `"${words}" is where they work or used to be, not somewhere they'd live`;
  }
  return null;
}

/**
 * The quote cut down to the fact's own words, the way the rules quote
 * ("hiking" from "I've got … and love hiking"), or "" when they can't be
 * found. Saved evidence goes through this, so it can only ever hold the
 * fact's vocabulary, never anything else the person wrote.
 */
export function narrowQuote(entry: FactEntry, quote: string, carFree?: boolean): string {
  const spans = factSpans(entry, clauses(quote), carFree);
  return spans ? spanQuote(spans) : "";
}
