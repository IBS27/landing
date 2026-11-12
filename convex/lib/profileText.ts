import {
  type FactEntry,
  factLabel,
  factSlot,
  type GoalId,
  type NeighborhoodSlug,
  TRANSPORT_MODES,
  type TransportMode,
  type WorkHours,
  type Workplace,
} from "./cityProfileFacts";
import { INTERESTS, type InterestId, normalize } from "./interests";

/**
 * Turns the optional "Tell us about you" text into proposed City Profile
 * facts, each with the words it came from. Nothing is saved here: the person
 * ticks what's right and the brief saves it.
 *
 * This is the rules-based path: it works with AI off and is the fallback when
 * the model is unavailable. #8's `runAgent` slots in front of it, validated
 * against the same `factEntry` validator.
 */

export type ProposedFact = {
  entry: FactEntry;
  quote: string;
  label: string;
  /** Transport only: they said they have no car (otherwise car is simply not mentioned). */
  carFree?: boolean;
};

export const MAX_TEXT_LENGTH = 1000;

/** Sentences and clauses, with their original wording. */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(s: string, max = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** The first clause matching `re`, as the quote for a proposal. */
function quoteFor(parts: string[], re: RegExp): string | null {
  const hit = parts.find((p) => re.test(p));
  return hit ? clip(hit) : null;
}

function wordRe(phrase: string, flags = "i"): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, flags);
}

/* ---------------- Neighborhoods ---------------- */

/**
 * Everyday names → Analysis Neighborhood. Ambiguous words ("Mission",
 * "Sunset", "Marina") must be capitalized or follow "the".
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

const AMOUNT =
  /\$\s?(\d{1,2}(?:[.,]\d{1,3})?)\s?(k)?\b|\b(\d{1,2}(?:[.,]\d{3})|\d{1,2}(?:\.\d)?k)\s?(?:\/\s?mo(?:nth)?|a month|per month|monthly)?/gi;

function parseAmount(raw: string, k: boolean): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const v = k || n < 30 ? n * 1000 : n;
  return v >= 300 && v <= 20000 ? Math.round(v / 50) * 50 : null;
}

function budgetFrom(parts: string[]): ProposedFact | null {
  for (const p of parts) {
    if (!/\$|budget|rent|\/\s?mo|a month|per month|\bk\b/i.test(p)) continue;
    const amounts: number[] = [];
    for (const m of p.matchAll(AMOUNT)) {
      if (m[1]) {
        const a = parseAmount(m[1], Boolean(m[2]));
        if (a) amounts.push(a);
      } else if (m[3]) {
        const raw = m[3].toLowerCase();
        const a = parseAmount(raw.replace("k", ""), raw.endsWith("k"));
        if (a && /\$|budget|rent|mo|month/i.test(p)) amounts.push(a);
      }
    }
    if (amounts.length === 0) continue;
    const max = Math.max(...amounts);
    const min = amounts.length > 1 ? Math.min(...amounts) : undefined;
    const entry: FactEntry = {
      key: "budget",
      value: min !== undefined && min < max ? { min, max } : { max },
    };
    return { entry, quote: clip(p), label: factLabel(entry) };
  }
  return null;
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

function moveInFrom(parts: string[], now: number): ProposedFact | null {
  for (const p of parts) {
    if (!/\b(mov|land|arriv|start|relocat|get(ting)? to|coming)/i.test(p)) continue;
    const m = p.match(MONTH_RE);
    // "may" alone is too often the verb.
    if (!m || (m[1].toLowerCase() === "may" && !m[3] && !/\bin may\b/i.test(p))) continue;
    const month = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    const today = new Date(now);
    let year = m[3] ? Number(m[3]) : today.getUTCFullYear();
    if (!m[3] && month < today.getUTCMonth()) year += 1;
    const mm = String(month + 1).padStart(2, "0");
    const day = m[2] ? Number(m[2]) : undefined;
    const value =
      day && day <= 31
        ? { month: `${year}-${mm}`, date: `${year}-${mm}-${String(day).padStart(2, "0")}` }
        : { month: `${year}-${mm}` };
    const entry: FactEntry = { key: "moveIn", value };
    return { entry, quote: clip(p), label: factLabel(entry) };
  }
  return null;
}

/* ---------------- Schedule and work ---------------- */

function scheduleFrom(parts: string[]): ProposedFact | null {
  const all = parts.join(" ");
  let workHours: WorkHours | null = null;
  if (/\b(night shifts?|nights|overnight|graveyard)\b/i.test(all)) workHours = "night";
  else if (/\b(evening shifts?|work evenings|closing shifts?)\b/i.test(all)) workHours = "evening";
  else if (/\b(9\s?(-|to)\s?5|nine to five|day job|office job|work days)\b/i.test(all))
    workHours = "day";
  else if (/\b(shifts? vary|irregular hours|freelanc)/i.test(all)) workHours = "varies";
  let workplace: Workplace | undefined;
  if (/\b(remote|work from home|wfh)\b/i.test(all)) workplace = "remote";
  else if (/\bhybrid\b/i.test(all)) workplace = "hybrid";
  else if (/\b(in the office|in-office|in office|commut)/i.test(all)) workplace = "office";
  if (!workHours && workplace) workHours = "day";
  if (!workHours) return null;
  const weekendsFree = !/\bwork(s|ing)?\b[^.!?]{0,20}\bweekends?\b|\bweekend shifts?\b/i.test(all);
  const quoteRe =
    /night|overnight|graveyard|evening|9\s?(-|to)\s?5|nine to five|day job|office|remote|home|wfh|hybrid|commut|shift|weekend|freelanc/i;
  const entry: FactEntry = {
    key: "schedule",
    value: workplace ? { workHours, workplace, weekendsFree } : { workHours, weekendsFree },
  };
  return { entry, quote: quoteFor(parts, quoteRe) ?? clip(all), label: factLabel(entry) };
}

const EMPLOYER_RE =
  /\b(?:work(?:ing)? (?:at|for)|job at|joining|starting at|engineer at|designer at|nurse at|intern(?:ing)? at)\s+((?:[A-Z][\w&'.-]*)(?:\s+[A-Z][\w&'.-]*){0,3})/;

function employerFrom(parts: string[]): ProposedFact | null {
  for (const p of parts) {
    const m = p.match(EMPLOYER_RE);
    if (!m) continue;
    const name = m[1].replace(/[.,]$/, "").trim();
    if (name.length < 2 || name.length > 60) continue;
    const entry: FactEntry = { key: "employer", value: { name } };
    return { entry, quote: clip(p), label: factLabel(entry) };
  }
  return null;
}

/* ---------------- Entry point ---------------- */

/** Proposed facts found in `text`, one per slot, in reading order of kind. */
export function extractFacts(text: string, now: number): ProposedFact[] {
  const parts = clauses(text.slice(0, MAX_TEXT_LENGTH));
  if (parts.length === 0) return [];
  const out: ProposedFact[] = [];
  const add = (p: ProposedFact | null) => {
    if (p && !out.some((o) => factSlot(o.entry) === factSlot(p.entry))) out.push(p);
  };

  add(budgetFrom(parts));
  add(moveInFrom(parts, now));

  for (const { re, slug } of NEIGHBORHOOD_PATTERNS) {
    const q = quoteFor(parts, re);
    if (q) {
      const entry: FactEntry = { key: "neighborhood", value: { slug } };
      add({ entry, quote: q, label: factLabel(entry) });
    }
  }

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
    const labels: string[] = TRANSPORT_MODES.filter((m) => modes.has(m.id)).map((m) => m.label);
    if (noCar) labels.push("no car");
    add({
      entry,
      quote: [...new Set(transportQuotes)].join(" … "),
      label: labels.join(", ").replace(/^n/, "N"),
      carFree: Boolean(noCar),
    });
  }

  add(scheduleFrom(parts));
  add(employerFrom(parts));

  // Interests: alias phrases as whole words, in list order.
  const seen = new Set<InterestId>();
  for (const interest of INTERESTS) {
    for (const alias of interest.aliases) {
      if (seen.has(interest.id)) break;
      const re = wordRe(normalize(alias));
      const hit = parts.find((p) => re.test(` ${normalize(p)} `));
      if (hit) {
        seen.add(interest.id);
        const entry: FactEntry = { key: "interest", value: { id: interest.id } };
        add({ entry, quote: clip(hit), label: factLabel(entry) });
      }
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
