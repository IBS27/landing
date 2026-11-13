import {
  type BriefFactEntry,
  type FactEntry,
  factLabel,
  factSlot,
  type GoalId,
  type NeighborhoodSlug,
  TRANSPORT_MODES,
  type TransportMode,
  upcomingMoveInProblem,
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
  entry: BriefFactEntry;
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

function phraseSpan({ part, start, end }: Hit): { from: number; to: number } {
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
  return { from, to };
}

/** The phrase a hit sits in, for deciding what an amount, a month or a place is about. */
function phraseOf(hit: Hit): string {
  const { from, to } = phraseSpan(hit);
  return hit.part.text.slice(from, to).trim();
}

/** Something they used to do, have or already did ("I used to work nights", "I moved in March"). */
const PAST =
  /\b(?:used to|formerly|previously|no longer|anymore|last (?:job|year)|old job|was working|worked|had|already|bought|moved (?:here|to|in)|arrived|landed)\b/i;
/** Someone else's facts ("my roommate works nights", "she likes climbing"). */
const OTHERS =
  /\b(?:(?:my|our|his|her|their)\s+(?:roommates?|friends?|coworkers?|colleagues?|boss|partner|sister|brother|neighbou?rs?)|he|she|they)\b/i;

/**
 * Where a statement's subject or time can change: a contrast, punctuation, or
 * "and"/"," before a new subject ("…, now I work remote"). Coordinated items
 * keep theirs: "I used to love climbing and live music" is all past, "my
 * roommate likes hiking and climbing" is all the roommate's.
 */
const SUBJECT_BREAK =
  /[;:()]|\b(?:but|while|because|though|although|so|whereas|now)\b|(?:,|\band\b)\s+(?=(?:i|we|now)\b)/gi;

function statementOf({ part, start }: Hit): string {
  let from = 0;
  let to = part.text.length;
  for (const m of part.text.matchAll(SUBJECT_BREAK)) {
    if (m.index + m[0].length <= start) from = m.index + m[0].length;
    else if (m.index > start) {
      to = m.index;
      break;
    }
  }
  return part.text.slice(from, to);
}

/** Whether a mention isn't about the person now: in the past, or about someone else. */
function isPast(hit: Hit): boolean {
  const statement = statementOf(hit);
  return PAST.test(statement) || OTHERS.test(statement);
}

/** The first current, un-negated match: not something they used to do or have. */
function firstNow(parts: Part[], re: RegExp): Hit | null {
  return hits(parts, re).find((h) => !isPast(h)) ?? null;
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

/**
 * Words that say someone does or likes an activity, versus ones that say they
 * have or need something. "I love hiking" is an interest; "I have a food
 * allergy" or "an emotional support dog" isn't, even though "food" and "dog"
 * are aliases.
 */
const LIKES =
  /\b(?:love[sd]?|loving|like[sd]?|enjoy\w*|into|fan of|do|does|doing|play\w*|go|goes|going|went|practi[cs]e\w*|hobb(?:y|ies)|interests?|passion\w*|obsessed|try(?:ing)?|learn\w*|join\w*|miss)\b/gi;
const HAS = /\b(?:have|has|had|got|own\w*|with|need\w*|use[sd]?|using|take[sn]?|taking)\b/gi;
const CONDITION =
  /\b(?:allerg\w*|intoleran\w*|sensitiv\w*|support|service|therapy|therapeutic|assistance|medical|phobia|afraid|fear|scared)\b/i;

function lastIndex(re: RegExp, text: string): number {
  let at = -1;
  for (const m of text.matchAll(re)) at = m.index;
  return at;
}

/**
 * Whether an interest alias at `h` is said as an activity: not part of a
 * condition ("food allergy", "support dog"), and the nearest cue before it in
 * its clause is a liking ("love", "into", "play"), or there's no cue at all
 * ("Hiking, climbing and coffee."), rather than having or needing.
 */
function isActivity(h: Hit): boolean {
  // "I work at a coffee shop" is a job, not an interest.
  if (
    CONDITION.test(phraseOf(h)) ||
    isPast(h) ||
    /\bwork(?:s|ing|ed)?\s+(?:at|in|for)\b/i.test(phraseOf(h))
  )
    return false;
  // "North Beach" is a place, not a beach day.
  if (placesIn([h.part], false).some((p) => p.hit.start < h.end && h.start < p.hit.end))
    return false;
  const before = h.part.text.slice(0, h.start);
  return lastIndex(HAS, before) <= lastIndex(LIKES, before);
}

/** The first place `parts` name `id` as something they do or like. */
function interestHit(parts: Part[], id: InterestId, negatable = true): Hit | null {
  const all = (INTEREST_RES.get(id) ?? [])
    .flatMap((re) => hits(parts, re, negatable))
    .filter(isActivity);
  all.sort((a, b) => parts.indexOf(a.part) - parts.indexOf(b.part) || a.start - b.start);
  return all[0] ?? null;
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
  { re: /\bWest of Twin Peaks\b/i, slug: "west-of-twin-peaks" },
  { re: /\bVisitacion Valley\b/i, slug: "visitacion-valley" },
  { re: /\bPortola\b/i, slug: "portola" },
  { re: /\b(Oceanview|Ingleside|Merced Heights)\b/i, slug: "oceanview-merced-ingleside" },
  { re: /\b(Lakeshore|Lake Merced)\b/i, slug: "lakeshore" },
  { re: /\bSea ?cliff\b/i, slug: "seacliff" },
  { re: /\b(the )?Presidio(?! Heights)\b/i, slug: "presidio" },
  { re: /\bTreasure Island\b/i, slug: "treasure-island" },
  { re: /\b(Lone Mountain|USF)\b/i, slug: "lone-mountain-usf" },
  { re: /\bPresidio Heights\b/i, slug: "presidio-heights" },
];

/** Breaks between "I work in X" and "and want to live in Y". */
const PLACE_BREAK =
  /[;:()]|\b(?:but|while|because|though|although|so|whereas)\b|(?:,|\band\b|\bor\b)\s+(?=(?:i|we|want\w*|would|hope\w*|plan\w*|looking|live|living|move|moving|prefer\w*|ideally|into|to|work\w*|commut\w*|stud\w*)\b)/gi;
/** A place they used to live in or only visit. */
const PAST_PLACE = /\b(?:used to|lived|grew up|visit\w*)\b/i;
/** Cues that the next place named is where they're coming from... */
const ORIGIN_CUE = /\b(?:from|out of|leaving|away from)\b/gi;
/** ...and cues that switch to where they're going ("from the Mission to SoMa", "leaving Oakland for the Sunset"). */
const DESTINATION_CUE = /\b(?:to|into|towards?|for)\b/gi;
const WORK_PLACE =
  /\b(?:work\w*|office|job|commut\w*|based|campus|school|stud(?:y|ying|ent)|class(?:es)?)\b/i;
const HOME_PLACE = /\b(?:live|living|move|moving|apartment|place|rent|stay|neighborhood)\b/i;

function placeSpan(part: Part, at: number): { from: number; to: number } {
  let from = 0;
  let to = part.text.length;
  for (const m of part.text.matchAll(PLACE_BREAK)) {
    if (m.index + m[0].length <= at) from = m.index + m[0].length;
    else if (m.index > at) {
      to = m.index;
      break;
    }
  }
  return { from, to };
}

function placePhrase(part: Part, at: number): string {
  const { from, to } = placeSpan(part, at);
  return part.text.slice(from, to);
}

/**
 * Whether the place at `at` is where they're coming from: the latest cue
 * before it in its phrase is "from", "out of", "leaving" or "away from", with
 * no "to"/"into" after it. In "moving from the Mission to SoMa" the Mission is
 * the origin and SoMa isn't.
 */
function isOrigin(part: Part, at: number): boolean {
  const before = part.text.slice(placeSpan(part, at).from, at);
  const origin = lastIndex(ORIGIN_CUE, before);
  return origin !== -1 && lastIndex(DESTINATION_CUE, before) < origin;
}

const WORK_CUE = new RegExp(WORK_PLACE.source, "gi");
const HOME_CUE = new RegExp(HOME_PLACE.source, "gi");
/** "near my office in SoMa": the work cue says where they'd like to live. */
const NEAR =
  /\b(?:near|close to|next to|by|walk(?:ing|able)? (?:distance )?(?:to|of|from))\s+(?:(?:my|our|the|a|an|new)\s+)*$/i;

/**
 * Whether the place at `at` belongs to their work: the nearest cue before it
 * in its phrase is about work, not home. "Moving to SF for a new job in SoMa"
 * names where the job is; "I want to live near my office in SoMa" doesn't.
 */
function isWorkPlace(part: Part, at: number): boolean {
  const before = part.text.slice(placeSpan(part, at).from, at);
  const work = lastIndex(WORK_CUE, before);
  return work !== -1 && work > lastIndex(HOME_CUE, before) && !NEAR.test(before.slice(0, work));
}

/**
 * Whether a place named at `at` is somewhere they'd consider living: not
 * where they work, study, do an activity, are coming from or used to live ("I
 * work at Google in SoMa", "I climb in the Mission", "moving out of the
 * Mission", "moving for a job in SoMa"), unless the same phrase is about
 * living there. In "moving from the Mission to SoMa" only SoMa counts.
 */
function isHomePlace(part: Part, at: number): boolean {
  const phrase = placePhrase(part, at);
  // "My sister lives in the Mission" is her place, not one they'd consider.
  if (PAST_PLACE.test(phrase) || OTHERS.test(phrase) || isOrigin(part, at)) return false;
  if (isWorkPlace(part, at)) return false;
  if (HOME_PLACE.test(phrase)) return true;
  if (WORK_PLACE.test(phrase)) return false;
  // "I climb in the Mission": an activity's location.
  return ![...INTEREST_RES.values()].some((res) =>
    res.some((re) =>
      hits([part], re, false).some((h) => phrase.includes(h.part.text.slice(h.start, h.end))),
    ),
  );
}

/** The neighborhoods named in a clause, whole names only: the longest wins and none overlap. */
function placesIn(parts: Part[], negatable: boolean): { hit: Hit; slug: NeighborhoodSlug }[] {
  const found = NEIGHBORHOOD_PATTERNS.flatMap(({ re, slug }) =>
    hits(parts, re, negatable).map((hit) => ({ hit, slug })),
  ).sort((a, b) => b.hit.end - b.hit.start - (a.hit.end - a.hit.start));
  const kept: typeof found = [];
  for (const f of found) {
    const overlaps = kept.some(
      (k) => k.hit.part === f.hit.part && k.hit.start < f.hit.end && f.hit.start < k.hit.end,
    );
    if (!overlaps) kept.push(f);
  }
  return kept.sort(
    (a, b) => parts.indexOf(a.hit.part) - parts.indexOf(b.hit.part) || a.hit.start - b.hit.start,
  );
}

function neighborhoodsFrom(parts: Part[]): ProposedFact[] {
  return placesIn(parts, true)
    .filter(({ hit }) => isHomePlace(hit.part, hit.start))
    .map(({ hit, slug }) => {
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
/** How sure an amount is the rent: said to be rent (2), a budget or what they can afford (1). */
const RENT_WORDS =
  /\b(?:rent|a month|per month|monthly|apartment|studio|1br|one[\s-]bed\w*|room)\b|\/\s?mo/i;
const BUDGET_WORDS = /\b(?:budget|afford|spend|up to|max(?:imum)?)\b/i;
/** Money that isn't the rent they're looking for: pay, savings, deposits, other spending, rent now. */
const NOT_RENT = new RegExp(
  [
    "\\b(?:salary|income|take[\\s-]home|make|makes|making|earn\\w*|paid|paycheck|savings|saved|deposit|bonus|stipend|loans?|debt)\\b",
    // Another period, or a floor rather than a ceiling: not a monthly rent budget.
    "\\b(?:annual\\w*|yearly|weekly|a year|per year|a week|per week|at least|or more|minimum)\\b",
    "\\b(?:on|for|towards?)\\s+(?:(?:a|an|my|the|new|some)\\s+)*(?:furniture|couch|sofa|bed|groceries|food|utilities|internet|gym|travel|moving|movers|car|parking|tuition|deposit)\\b",
    // "my utilities budget", "an entertainment budget": a budget for something else.
    "\\b(?!(?:rent|rental|housing|my|our|the|a|an|total|monthly|apartment|max\\w*|overall|new|current|whole|realistic|ideal|budget|is|of)\\b)[a-z]+\\s+budget\\b",
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
    // "between $1,800 and $2,400" keeps "between", so the quote still reads as a range.
    const between = isRange && sep === "and" ? before.search(/\bbetween\s*$/i) : -1;
    out.push({
      value,
      hit: { part, start: between === -1 ? m.index : between, end },
      counts,
      perMonth,
    });
  }
  return out;
}

function rentScore(phrase: string, amount: Amount): number {
  if (RENT_WORDS.test(phrase) || amount.perMonth) return 2;
  return BUDGET_WORDS.test(phrase) ? 1 : 0;
}

/** Any dollar amount, even one too small or large to be rent ("$200 for utilities"). */
const MONEY = new RegExp(NUM, "gi");

/**
 * An amount's own words: its phrase, cut where the dollar amounts before and
 * after it end and start. In "budget is $2,500 including $200 for utilities"
 * the $200 is for utilities, the $2,500 isn't.
 */
function ownPhrase(amount: Amount): string {
  const { part, start, end } = amount.hit;
  let { from, to } = phraseSpan(amount.hit);
  for (const m of part.text.matchAll(MONEY)) {
    if (!m[1] && !m[3]) continue;
    const s = m.index;
    const e = s + m[0].length;
    if (e <= start) from = Math.max(from, e);
    else if (s >= end) to = Math.min(to, s);
  }
  return part.text.slice(from, to).trim();
}

/** Whether an amount reads as rent they'd pay, not pay, savings or another expense. */
function isRentAmount(amount: Amount): boolean {
  return !NOT_RENT.test(ownPhrase(amount));
}

/** The monthly rent they're looking for: a stated rent budget first, else the first amount that reads as rent. */
function budgetFrom(parts: Part[]): ProposedFact | null {
  const found: { amount: Amount; rent: number }[] = [];
  for (const part of parts) {
    for (const amount of amountsIn(part)) {
      if (!amount.counts || isNegated(part, amount.hit.start)) continue;
      // Decided by the amount's own phrase: "my salary is $6000 and rent is $2000".
      const phrase = phraseOf(amount.hit);
      if (!isRentAmount(amount)) continue;
      found.push({ amount, rent: rentScore(phrase, amount) });
    }
  }
  const best = found.find((f) => f.rent === 2) ?? found.find((f) => f.rent === 1) ?? found[0];
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

/** "3/15/2027", "3/15/27", "03/01": US month/day order, as the app is for San Francisco. */
const US_DATE = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\/(\d{4}|\d{2}))?\b(?!\/)/g;
/** "2027-03-15", or "2027-03" for a month. */
const ISO_DATE = /\b(20\d\d)-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?\b(?!-)/g;

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
  for (const hit of hits(parts, US_DATE, negatable)) {
    const m = hit.part.text.slice(hit.start, hit.end).match(new RegExp(US_DATE.source));
    if (!m) continue;
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    out.push({ month: Number(m[1]), day: Number(m[2]), year, hit });
  }
  for (const hit of hits(parts, ISO_DATE, negatable)) {
    const m = hit.part.text.slice(hit.start, hit.end).match(new RegExp(ISO_DATE.source));
    if (!m) continue;
    out.push({
      month: Number(m[2]),
      day: m[3] ? Number(m[3]) : undefined,
      year: Number(m[1]),
      hit,
    });
  }
  // Reading order, so "the first month they mention" stays the first.
  return out.sort(
    (a, b) => parts.indexOf(a.hit.part) - parts.indexOf(b.hit.part) || a.hit.start - b.hit.start,
  );
}

/**
 * The move-in month (and day, when given). A month in a phrase about moving
 * ("but move in April") beats one in a clause that only mentions starting
 * ("I start work in March"). Without a year it's the next such month. Uses the
 * same rules as Muse's checks (`upcomingMoveInProblem`): an impossible
 * or past date drops the day, and a past month proposes nothing.
 */
function moveInFrom(parts: Part[], today: string): ProposedFact | null {
  const found: { value: { month: string; date?: string }; hit: Hit; score: number }[] = [];
  for (const m of monthsIn(parts, true)) {
    if (isPast(m.hit)) continue;
    const score = MOVING.test(phraseOf(m.hit)) ? 2 : MOVE_RELATED.test(m.hit.part.text) ? 1 : 0;
    if (score === 0) continue;
    let year = m.year ?? Number(today.slice(0, 4));
    if (!m.year && m.month < Number(today.slice(5, 7))) year += 1;
    const mm = `${year}-${String(m.month).padStart(2, "0")}`;
    const candidates: { month: string; date?: string }[] = m.day
      ? [{ month: mm, date: `${mm}-${String(m.day).padStart(2, "0")}` }, { month: mm }]
      : [{ month: mm }];
    const value = candidates.find((c) => upcomingMoveInProblem(c, today) === null);
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
  {
    re: /\b(not working|between jobs|no job|unemployed|on a career break|taking (a )?(break|time off))\b/i,
    place: "none",
  },
];
/** "Work weekends", "work most Saturdays", "weekend shifts", "on call every weekend": the work is on the weekend. */
const WORKS_WEEKENDS =
  /\b(?:work(?:s|ing)?|on call)\s+(?:(?:on|most|some|every|the|all|many|alternate|alternating|other)\s+){0,2}(?:weekends?|saturdays?|sundays?)\b(?!\s+off)|\bweekend shifts?\b/i;

/**
 * Where they say they work weekends ("work most Saturdays"). The pattern
 * allows only a few fixed words between "work" and the day, so nothing else
 * they wrote becomes evidence. Not when it's negated ("not weekends") or past.
 */
function weekendWork(parts: Part[], negatable: boolean): Hit | null {
  for (const h of hits(parts, WORKS_WEEKENDS, false)) {
    const at = h.start + h.part.text.slice(h.start, h.end).search(/weekend|saturday|sunday/i);
    if (!negatable || (!isNegated(h.part, h.start) && !isNegated(h.part, at) && !isPast(h)))
      return h;
  }
  return null;
}

function scheduleFrom(parts: Part[]): ProposedFact | null {
  const hours = WORK_HOURS_PATTERNS.map((p) => ({ ...p, hit: firstNow(parts, p.re) })).find(
    (p) => p.hit,
  );
  const place = WORKPLACE_PATTERNS.map((p) => ({ ...p, hit: firstNow(parts, p.re) })).find(
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
  /\b(?:work(?:s|ing)? (?:at|for)|job at|joining|starting at|engineer at|designer at|nurse at|intern(?:ing)? at)\s+((?:[A-Z][\w&'.-]*)(?:\s+(?:(?:of|for|the|and|de|&)\s+)?[A-Z][\w&'.-]*){0,4})/;

function employerFrom(parts: Part[]): ProposedFact | null {
  for (const hit of hits(parts, EMPLOYER_RE)) {
    if (isPast(hit)) continue;
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

/* ---------------- What the model may read ---------------- */

/** Words about the move itself, which give a month or a place its meaning. */
const MOVE_WORDS =
  /\b(?:mov\w*|land\w*|arriv\w*|relocat\w*|rent\w*|budget|afford|apartment|studio|room|place|neighbou?rhood|live|living)\b/i;

/** Whether a sentence holds anything a profile fact could come from. */
function hasProfileWords(part: Part): boolean {
  const one = [part];
  const t = part.text;
  return (
    MOVE_WORDS.test(t) ||
    amountsIn(part).some((a) => a.counts) ||
    monthsIn(one, false).length > 0 ||
    placesIn(one, false).length > 0 ||
    NO_CAR.test(t) ||
    TRANSPORT_PATTERNS.some((p) => p.re.test(t)) ||
    WORK_HOURS_PATTERNS.some((p) => p.re.test(t)) ||
    WORKPLACE_PATTERNS.some((p) => p.re.test(t)) ||
    new RegExp(WORKS_WEEKENDS.source, "i").test(t) ||
    EMPLOYER_RE.test(t) ||
    GOAL_PATTERNS.some((p) => p.re.test(t)) ||
    [...INTEREST_RES.values()].some((res) => res.some((re) => hits(one, re, false).length > 0))
  );
}

/**
 * The only sentences of what someone wrote that Muse reads: those with words
 * a profile fact could come from (an amount, a month, a place, how they get
 * around, work, an activity, a goal, or the move itself), one per line, after
 * `redactProtected`. A sentence with none of these, including anything about
 * who someone is that the deny list missed, never reaches the model. Muse's
 * check already requires each quote to contain its fact's own words, so
 * nothing it could use is lost.
 */
export function profileSentences(text: string): string {
  return clauses(redactProtected(text.slice(0, MAX_TEXT_LENGTH)))
    .filter(hasProfileWords)
    .map((p) => p.text)
    .join("\n");
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
  const noCar = firstNow(parts, NO_CAR);
  if (noCar) spans.push(noCar);
  for (const { re, mode } of TRANSPORT_PATTERNS) {
    const hit = firstNow(parts, re);
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
    const hit = interestHit(parts, interest.id);
    if (hit) {
      const entry: FactEntry = { key: "interest", value: { id: interest.id } };
      add({ entry, quote: spanQuote([hit]), label: factLabel(entry) });
    }
  }

  for (const { re, id } of GOAL_PATTERNS) {
    const hit = firstNow(parts, re);
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
    case "home":
      // Where they live comes from their place, never from what they wrote.
      return null;
    case "interest":
      return one(firstOf(parts, INTEREST_RES.get(entry.value.id) ?? [], false));
    case "neighborhood":
      // Whole names only: "Mission" inside "Outer Mission" isn't the Mission.
      return one(placesIn(parts, false).find((p) => p.slug === entry.value.slug)?.hit ?? null);
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

/** Lowercase with straight quotes and dashes, character for character, so offsets still line up. */
function same(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
}

/**
 * Why `quote` doesn't support `entry` in `text`, or null. The quote must be
 * in the text as written and contain the fact's own words (`factSpans`), and
 * each of them must appear somewhere in the text in the sense the fact needs:
 * not negated ("not $3000", "I can't bike") or in the past ("I used to work
 * nights"); an amount that reads as rent, not pay or another expense; a month
 * they move in, not one something else starts in while they move in another;
 * a neighborhood they'd live in, as a whole name, not where they work or are
 * leaving. Limits ("no more than $2,400") and negations that are the fact
 * ("I don't have a car") count. A schedule saying weekends are free is
 * rejected when the text says they work weekends.
 */
export function quoteProblem(
  text: string,
  entry: FactEntry,
  quote: string,
  carFree?: boolean,
  today?: string,
): string | null {
  const q = quote.trim();
  const spans = factSpans(entry, clauses(q), carFree);
  if (!spans)
    return `the quote "${q}" doesn't contain the words for this fact (the ${entry.key} itself)`;
  const textParts = clauses(redactProtected(text));
  const lq = same(q);
  const occurrences = textParts.flatMap((part) => {
    const out: { part: Part; at: number }[] = [];
    const t = same(part.text);
    for (let i = t.indexOf(lq); i !== -1; i = t.indexOf(lq, i + 1)) out.push({ part, at: i });
    return out;
  });
  if (occurrences.length === 0) return `copy the quote "${q}" exactly as it's written in the text`;

  for (const span of spans) {
    const offset = Math.max(0, q.indexOf(span.part.text)) + span.start;
    const words = span.part.text.slice(span.start, span.end);
    const spots: Hit[] = occurrences.map(({ part, at }) => ({
      part,
      start: at + offset,
      end: at + offset + words.length,
    }));
    const live = spots.filter((h) => !isNegated(h.part, h.start));
    if (live.length === 0) return `the text says the opposite ("${words}" is negated there)`;
    const fits = live.filter((h) => fitsFact(entry, h, textParts, today));
    if (fits.length === 0) return `"${words}" doesn't mean this ${entry.key} in the text`;
  }
  if (entry.key === "schedule" && entry.value.weekendsFree && weekendWork(textParts, true))
    return "the text says they work weekends";
  return null;
}

/** Whether the fact's words at `h` mean the fact in context (see `quoteProblem`). */
function fitsFact(entry: FactEntry, h: Hit, textParts: Part[], today?: string): boolean {
  switch (entry.key) {
    case "budget": {
      const amount = amountsIn(h.part).find((a) => a.hit.start === h.start);
      return amount ? isRentAmount(amount) : !NOT_RENT.test(phraseOf(h));
    }
    case "moveIn": {
      if (isPast(h)) return false;
      // No year in the text: it's the next such month, not one Muse picks.
      const said = monthsIn([h.part], false).find((m) => m.hit.start === h.start);
      if (said && said.year === undefined && today) {
        const year = Number(today.slice(0, 4)) + (said.month < Number(today.slice(5, 7)) ? 1 : 0);
        if (entry.value.month.slice(0, 4) !== String(year)) return false;
      }
      if (MOVING.test(phraseOf(h))) return true;
      // "I start work in March, but move in April": March isn't the move.
      return !monthsIn(textParts, true).some((m) => MOVING.test(phraseOf(m.hit)));
    }
    case "neighborhood": {
      const place = placesIn([h.part], false).find(
        (p) => p.hit.start <= h.start && h.start < p.hit.end,
      );
      return place?.slug === entry.value.slug && isHomePlace(h.part, h.start);
    }
    case "interest":
      return isActivity(h);
    case "employer":
    case "schedule":
    case "transport":
    case "goal":
      return !isPast(h);
    default:
      return true;
  }
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

/**
 * Why an employer doesn't fit `text`, or null: the name must be what they say
 * they work at or are joining ("I work at Figma"), not any mention ("hiking
 * near Google"), now and for themselves; a work area must be a place named in
 * that same clause ("I work at Figma in SoMa").
 */
export function employerProblem(
  text: string,
  value: { name: string; workArea?: string },
): string | null {
  const name = same(value.name.trim());
  for (const hit of hits(clauses(redactProtected(text)), EMPLOYER_RE)) {
    if (isPast(hit)) continue;
    const m = hit.part.text.slice(hit.start).match(EMPLOYER_RE);
    if (!m || !same(m[1]).startsWith(name)) continue;
    if (value.workArea === undefined) return null;
    // The area must describe the workplace: "at Figma in SoMa", not "… and want to live in Noe Valley".
    const area = value.workArea.trim();
    const after = hit.part.text.slice(hit.start + m[0].length);
    const where = new RegExp(
      `^\\s*,?\\s*(?:in|at|near|by|on|out of|based in|downtown)\\s+(?:the\\s+)?${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (/^[A-Z0-9]/.test(area) && where.test(after)) return null;
    return `work area "${value.workArea}" isn't where they say ${value.name} is`;
  }
  return `"${value.name}" isn't named in the text as where they work or are joining`;
}
