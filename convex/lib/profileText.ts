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
 * so no proposal or quote can carry one, and negated mentions ("I don't like
 * climbing") propose nothing.
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

/* ---------------- Clauses, negation and quotes ---------------- */

/** One sentence or clause, with the spans a negation covers ("don't like climbing or coffee"). */
type Part = { text: string; negated: [number, number][] };

type Hit = { part: Part; start: number; end: number };

const NEGATION =
  /\b(?:don['’]?t|do not|doesn['’]?t|does not|didn['’]?t|did not|never|not|no longer|no|nor|neither|hate[sd]?|dislike[sd]?|can(?:not|['’]?t) stand|avoid(?:s|ing)?|isn['’]?t|aren['’]?t|wasn['’]?t|won['’]?t|wouldn['’]?t|without|quit|stopped|gave up)\b/gi;
/**
 * Words after "no"/"not" that make it a limit rather than a negation ("no more
 * than $2,400", "not moving until March").
 */
const BOUND =
  /^\s+(?:(?:more|less|later|earlier|sooner|higher|lower|over|above|below|under|exceeding|beyond)\b|(?:\w+\s+)?(?:until|till)\b)/i;
/** Where a negation stops: a contrast, a new clause about the person, or punctuation. */
const NEGATION_END =
  /\b(?:but|though|although|however|except|yet|whereas|while|instead|so|because)\b|[;:—–]|(?:,|\band)\s+(?=(?:i|we)\b)/i;

/**
 * The spans of `text` a negation covers, from the end of the negating word to
 * the end of its clause. A match that starts inside one is negated; one that
 * starts with the negating word itself ("don't know anyone", "no car") isn't.
 */
export function negatedSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of text.matchAll(NEGATION)) {
    const from = m.index + m[0].length;
    // "no more than $2,400", "not until March": a limit, not a negation.
    if (BOUND.test(text.slice(from))) continue;
    const rest = text.slice(from);
    const stop = rest.search(NEGATION_END);
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
  const g = global(re);
  for (const part of parts) {
    for (const m of part.text.matchAll(g)) {
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

const QUOTE_MAX = 120;
const LEADING_FILLER = /^(?:[\s,.;:–—-]|\b(?:and|or|but|who|that|which|also|so)\b)+/i;
/** Where one phrase ends and the next starts: a redaction, punctuation or a joining word. */
const PHRASE_BREAK = new RegExp(
  `${REDACTED.replace(/[[\]]/g, "\\$&")}|[,;:()]|\\b(?:and|but|or|so|who|which|while|because|though|although|plus)\\b`,
  "gi",
);

/**
 * The words around a match, as the quote for a proposal: just the phrase that
 * contains it ("love hiking", not the rest of the sentence), so a quote never
 * carries anything else the person said, at most about `QUOTE_MAX`
 * characters, copied exactly.
 */
function quoteOf({ part, start, end }: Hit): string {
  const t = part.text;
  let from = 0;
  let to = t.length;
  for (const m of t.matchAll(PHRASE_BREAK)) {
    const mEnd = m.index + m[0].length;
    if (mEnd <= start) from = mEnd;
    else if (m.index >= end) {
      to = m.index;
      break;
    }
  }
  if (to - from > QUOTE_MAX) {
    // A window around the match, widened to whole words.
    from = Math.max(from, start - 50);
    to = Math.min(to, end + 50);
    while (from > 0 && /\w/.test(t[from - 1])) from--;
    while (to < t.length && /\w/.test(t[to])) to++;
  }
  const raw = t.slice(from, to);
  const lead = Math.min(raw.match(LEADING_FILLER)?.[0].length ?? 0, start - from);
  return raw.slice(lead).trim();
}

function quoteFor(parts: Part[], re: RegExp): string | null {
  const hit = firstHit(parts, re);
  return hit ? quoteOf(hit) : null;
}

/** A phrase as a whole-word pattern; spaces match any separator ("board-games", "farmer's market"). */
function wordRe(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi");
}

const INTEREST_RES = new Map<InterestId, RegExp[]>(
  INTERESTS.map((i) => [i.id as InterestId, i.aliases.map(wordRe)]),
);

/** The first place `parts` say they do or like `id` (one of its aliases, not negated). */
function interestHit(parts: Part[], id: InterestId): Hit | null {
  const all = (INTEREST_RES.get(id) ?? []).flatMap((re) => hits(parts, re));
  all.sort((a, b) => parts.indexOf(a.part) - parts.indexOf(b.part) || a.start - b.start);
  return all[0] ?? null;
}

/**
 * Whether `text` names the activity `id` without negating it. Muse's checks
 * use it so an interest is backed by the activity itself, never by who
 * someone is ("I am Hindu" doesn't make yoga).
 */
export function mentionsInterest(text: string, id: InterestId): boolean {
  return interestHit(clauses(text), id) !== null;
}

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

const WORKPLACE_BEFORE =
  /\b(?:work(?:s|ing|ed)?|office(?: is)?|job(?: is)?|commut\w*|study(?:ing)?|school(?: is)?|visit\w*)\s+(?:in|at|near|to|by|out of|around)\s+(?:the\s+)?$/i;

function neighborhoodsFrom(parts: Part[]): ProposedFact[] {
  const found = NEIGHBORHOOD_PATTERNS.flatMap(({ re, slug }) =>
    hits(parts, re).map((hit) => ({ hit, slug })),
  )
    // "I work in the Mission" names a workplace, not somewhere to live.
    .filter(({ hit }) => !WORKPLACE_BEFORE.test(hit.part.text.slice(0, hit.start)))
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
    return { entry, quote: quoteOf(hit), label: factLabel(entry) };
  });
}

/* ---------------- Transport ---------------- */

const NO_CAR =
  /\b(no car|don'?t (have|own) a car|without a car|car[- ]free|carless|don'?t drive|can'?t drive)\b/i;
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
  { re: /\broommates?\b/i, id: "find_roommates" },
  {
    re: /\b(find(ing)? a (place|apartment|studio|room)|looking for a (place|apartment|studio|room)|apartment hunting|need a place)\b/i,
    id: "find_place",
  },
  { re: /\b(explore|exploring|discover)\b/i, id: "explore_city" },
  { re: /\b(furnish|furniture|decorate|decorating)\b/i, id: "furnish_place" },
  { re: /\b(a regular|routine|my spot|local spot)\b/i, id: "build_routine" },
];

/* ---------------- Budget and dates ---------------- */

const NUM = String.raw`(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?k\b)?`;
/** One amount or a range: "$2,400", "$2.4k", "1800–2400", "$1,800 to $2,400". */
const AMOUNT = new RegExp(`${NUM}(?:\\s*(-|–|—|to|and)\\s*${NUM})?`, "gi");
const PER_MONTH = /^\s*(?:\/\s*mo(?:nth)?\b|(?:a|per|each|every)\s+month\b|monthly\b)/i;
const BUDGET_LEAD =
  /\b(?:budget|rent|spend|afford|up to|under|below|max(?:imum)?|around|about|between|range)\b[^.\d$]{0,15}$/i;

const RENT_CONTEXT =
  /\b(?:budget|rent|a month|per month|monthly|apartment|studio|1br|one[\s-]bed\w*|room)\b|\/\s?mo/i;
/** Money that isn't rent: "my salary is $6000", "I make $120k", "a $2,400 deposit". */
const NOT_RENT =
  /\b(?:salary|income|make|makes|making|earn\w*|paid|paycheck|pay is|savings|saved|deposit|bonus|stipend|loans?|debt)\b/i;
const OTHER_EXPENSE =
  /^\s*(?:on|for|towards?)\s+(?!rent\b|(?:a|an|my|the)\s+(?:place|room|studio|apartment|1br)\b|housing\b)/i;

/** Whole dollars; thousands only with an explicit "k" ("$2.4k"), so "$20" is twenty dollars. */
function dollarsOf(raw: string, k: boolean): number {
  return Math.round(Number(raw.replace(/,/g, "")) * (k ? 1000 : 1));
}

const inRange = (n: number) => n >= 300 && n <= 20000;

/**
 * Monthly rent from the first clause that states one. A number counts when it
 * has a "$" or "k", is followed by "a month", or follows "budget", "rent",
 * "up to" and the like, so "March 2027" or "9 to 5" aren't amounts.
 */
function budgetFrom(parts: Part[]): ProposedFact | null {
  const found: { fact: ProposedFact; rent: boolean }[] = [];
  for (const part of parts) {
    const p = part.text;
    for (const m of p.matchAll(AMOUNT)) {
      const [, dollarA, a, kA, sep, dollarB, b, kB] = m;
      if (isNegated(part, m.index)) continue;
      const before = p.slice(0, m.index);
      const after = p.slice(m.index + m[0].length);
      const isRange = b !== undefined && (sep !== "and" || /\bbetween\s*$/i.test(before));
      const counts =
        dollarA ||
        kA ||
        (isRange && (dollarB || kB)) ||
        PER_MONTH.test(after) ||
        BUDGET_LEAD.test(before);
      // "$2,400 on furniture" is an expense, not rent.
      if (!counts || OTHER_EXPENSE.test(after)) continue;
      // "1.8–2.4k": the "k" covers both ends.
      const low = dollarsOf(a, Boolean(kA) || (isRange && Boolean(kB) && Number(a) < 100));
      const high = isRange ? dollarsOf(b, Boolean(kB)) : null;
      let value: { min?: number; max: number } | null = null;
      if (high !== null && inRange(high))
        value = inRange(low) && low < high ? { min: low, max: high } : { max: high };
      else if (inRange(low)) value = { max: low };
      if (!value) continue;
      const entry: FactEntry = { key: "budget", value };
      const hit = { part, start: m.index, end: m.index + m[0].length };
      // Rent or not is decided by the amount's own phrase, not the whole sentence.
      const phrase = quoteOf(hit);
      if (NOT_RENT.test(phrase)) continue;
      found.push({
        fact: { entry, quote: phrase, label: factLabel(entry) },
        rent: RENT_CONTEXT.test(phrase) || PER_MONTH.test(after),
      });
    }
  }
  // An amount said to be rent beats any other dollar amount.
  return (found.find((f) => f.rent) ?? found[0])?.fact ?? null;
}

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
  "i",
);

const MOVE_WORDS = /\b(mov|land|arriv|start|relocat|get(ting)? to|coming)/i;

/**
 * The move-in month (and day, when given) from the first clause about moving.
 * Without a year it's the next such month. Uses the same rules as Muse's
 * checks and `saveBrief` (`moveInProblem`): an impossible or past date drops
 * the day, and a past month proposes nothing.
 */
function moveInFrom(parts: Part[], today: string): ProposedFact | null {
  for (const part of parts) {
    const p = part.text;
    if (!MOVE_WORDS.test(p)) continue;
    const m = MONTH_RE.exec(p);
    // "may" alone is too often the verb; "don't want to move in March" isn't a plan.
    if (!m || (m[1].toLowerCase() === "may" && !m[3] && !/\bin may\b/i.test(p))) continue;
    if (isNegated(part, m.index)) continue;
    const month = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    if (!m[3] && month + 1 < Number(today.slice(5, 7))) year += 1;
    const mm = `${year}-${String(month + 1).padStart(2, "0")}`;
    const candidates: { month: string; date?: string }[] = m[2]
      ? [{ month: mm, date: `${mm}-${m[2].padStart(2, "0")}` }]
      : [];
    candidates.push({ month: mm });
    const value = candidates.find((c) => moveInProblem(c, today) === null);
    if (!value) continue;
    const entry: FactEntry = { key: "moveIn", value };
    const hit = { part, start: m.index, end: m.index + m[0].length };
    return { entry, quote: quoteOf(hit), label: factLabel(entry) };
  }
  return null;
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
const WORKS_WEEKENDS = /\bwork(s|ing)?\b[^.!?]{0,20}\bweekends?\b|\bweekend shifts?\b/i;

function scheduleFrom(parts: Part[]): ProposedFact | null {
  const hours = WORK_HOURS_PATTERNS.map((p) => ({ ...p, hit: firstHit(parts, p.re) })).find(
    (p) => p.hit,
  );
  const place = WORKPLACE_PATTERNS.map((p) => ({ ...p, hit: firstHit(parts, p.re) })).find(
    (p) => p.hit,
  );
  const hit = hours?.hit ?? place?.hit;
  if (!hit) return null;
  const workHours = hours?.hours ?? "day";
  // "Work remote, not weekends": the weekend word itself mustn't be negated either.
  const weekendsFree = !hits(parts, WORKS_WEEKENDS).some(
    (h) => !isNegated(h.part, h.start + h.part.text.slice(h.start, h.end).search(/weekend/i)),
  );
  const entry: FactEntry = {
    key: "schedule",
    value: place
      ? { workHours, workplace: place.place, weekendsFree }
      : { workHours, weekendsFree },
  };
  return { entry, quote: quoteOf(hit), label: factLabel(entry) };
}

const EMPLOYER_RE =
  /\b(?:work(?:ing)? (?:at|for)|job at|joining|starting at|engineer at|designer at|nurse at|intern(?:ing)? at)\s+((?:[A-Z][\w&'.-]*)(?:\s+[A-Z][\w&'.-]*){0,3})/;

function employerFrom(parts: Part[]): ProposedFact | null {
  for (const hit of hits(parts, EMPLOYER_RE)) {
    const m = hit.part.text.slice(hit.start).match(EMPLOYER_RE);
    if (!m) continue;
    const name = m[1].replace(/[.,]$/, "").trim();
    if (name.length < 2 || name.length > 60) continue;
    const entry: FactEntry = { key: "employer", value: { name } };
    return { entry, quote: quoteOf(hit), label: factLabel(entry) };
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

  const modes = new Set<TransportMode>();
  const transportQuotes: string[] = [];
  for (const { re, mode } of TRANSPORT_PATTERNS) {
    const q = quoteFor(parts, re);
    if (q) {
      modes.add(mode);
      transportQuotes.push(q);
    }
  }
  const noCar = quoteFor(parts, NO_CAR);
  if (noCar) {
    modes.delete("car");
    transportQuotes.unshift(noCar);
  }
  if (modes.size > 0 || noCar) {
    const entry: FactEntry = { key: "transport", value: { modes: [...modes] } };
    add({
      entry,
      quote: [...new Set(transportQuotes)].join(" … "),
      label: proposalLabel(entry, Boolean(noCar)),
      carFree: Boolean(noCar),
    });
  }

  add(scheduleFrom(parts));
  add(employerFrom(parts));

  // Interests: alias phrases as whole words, in list order.
  for (const interest of INTERESTS) {
    const hit = interestHit(parts, interest.id);
    if (hit) {
      const entry: FactEntry = { key: "interest", value: { id: interest.id } };
      add({ entry, quote: quoteOf(hit), label: factLabel(entry) });
    }
  }

  for (const { re, id } of GOAL_PATTERNS) {
    const q = quoteFor(parts, re);
    if (q) {
      const entry: FactEntry = { key: "goal", value: { id } };
      add({ entry, quote: q, label: factLabel(entry) });
    }
  }
  return out;
}

/* ---------------- Checks on Muse's proposals ---------------- */

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The words in `parts` that name `entry` ("hiking", "$2,400", "March", "the Mission"), negated or not. */
function factHit(entry: FactEntry, parts: Part[]): Hit | null {
  const firstOf = (res: RegExp[]) =>
    res.map((re) => firstHit(parts, re, false)).find((h) => h !== null) ?? null;
  switch (entry.key) {
    case "interest":
      return firstOf(INTEREST_RES.get(entry.value.id) ?? []);
    case "neighborhood":
      return firstOf(
        NEIGHBORHOOD_PATTERNS.filter((n) => n.slug === entry.value.slug).map((n) => n.re),
      );
    case "goal":
      return firstOf(GOAL_PATTERNS.filter((g) => g.id === entry.value.id).map((g) => g.re));
    case "budget":
      return firstOf([AMOUNT]);
    case "moveIn":
      return firstOf([MONTH_RE]);
    case "employer":
      return firstOf([new RegExp(escapeRe(entry.value.name.trim()), "i")]);
    default:
      return null;
  }
}

/**
 * Why `quote` doesn't support `entry` where it sits in `text`, or null. It
 * looks at the fact's own words inside each place the quote appears: if every
 * one is negated ("not $3000", "I do not want to move in March"), or, for a
 * neighborhood, every one names a workplace ("I work in the Mission"), the
 * quote backs nothing. Limits ("no more than $2,400") and negations that are
 * the fact ("I don't have a car") still count. Null when the quote isn't
 * found as-is; the copy check reports that.
 */
export function quoteProblem(text: string, entry: FactEntry, quote: string): string | null {
  const q = quote.trim();
  if (!q) return null;
  const hit = factHit(entry, clauses(q));
  const offset = hit ? Math.max(0, q.indexOf(hit.part.text)) + hit.start : 0;
  const spots: { part: Part; at: number }[] = [];
  for (const part of clauses(redactProtected(text))) {
    const t = part.text.toLowerCase();
    const lq = q.toLowerCase();
    for (let i = t.indexOf(lq); i !== -1; i = t.indexOf(lq, i + 1))
      spots.push({ part, at: i + offset });
  }
  if (spots.length === 0) return null;
  const negated = (s: { part: Part; at: number }) => isNegated(s.part, s.at);
  if (spots.every(negated)) return `the text says the opposite ("${q}" is negated there)`;
  const workplace = (s: { part: Part; at: number }) =>
    WORKPLACE_BEFORE.test(s.part.text.slice(0, s.at));
  if (entry.key === "neighborhood" && spots.every((s) => negated(s) || workplace(s)))
    return `"${q}" is where they work, not somewhere they'd live`;
  return null;
}

/**
 * The quote cut down to the phrase that names the fact ("love hiking" from
 * "I've got … and love hiking"), the way the rules quote, so a longer quote
 * can't carry anything else into the saved evidence. Transport and schedule
 * quotes, and quotes where the fact's words can't be found, are returned as-is.
 */
export function narrowQuote(entry: FactEntry, quote: string): string {
  const hit = factHit(entry, clauses(quote));
  return hit ? quoteOf(hit) : quote.trim();
}
