import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { getInterest, type InterestId, interestId } from "./interests";

/**
 * City Profile fact model, shared by the server and the client (no server
 * imports). A profile is a list of facts; each says where it came from, so
 * learning (#4) and "What Muse knows about you" (#5) can show every value's
 * origin. Read profiles through `getProfile` in `./cityProfile.ts`.
 *
 * No protected traits: there is deliberately no key for age, gender, pronouns,
 * race or ethnicity, national origin, religion, disability or health, family
 * or marital status, or sexual orientation. Don't add one.
 */

/* ---------------- Options ---------------- */

export const TRANSPORT_MODES = [
  { id: "walk", label: "Walking" },
  { id: "bike", label: "Bike" },
  { id: "muni", label: "Muni" },
  { id: "bart", label: "BART" },
  { id: "caltrain", label: "Caltrain" },
  { id: "car", label: "Car" },
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number]["id"];
export const transportMode = literals(...TRANSPORT_MODES.map((m) => m.id));

export const WORK_HOURS = [
  { id: "day", label: "Daytime" },
  { id: "evening", label: "Evenings" },
  { id: "night", label: "Nights" },
  { id: "varies", label: "It varies" },
] as const;
export type WorkHours = (typeof WORK_HOURS)[number]["id"];

export const WORKPLACES = [
  { id: "office", label: "In an office" },
  { id: "hybrid", label: "Hybrid" },
  { id: "remote", label: "Remote" },
  { id: "none", label: "Not working" },
] as const;
export type Workplace = (typeof WORKPLACES)[number]["id"];

export const GOALS = [
  { id: "find_place", label: "Find a place", emoji: "🏠" },
  { id: "find_roommates", label: "Find roommates", emoji: "🛋️" },
  { id: "meet_people", label: "Meet people", emoji: "👋" },
  { id: "explore_city", label: "Explore the city", emoji: "🗺️" },
  { id: "furnish_place", label: "Furnish my place", emoji: "🪴" },
  { id: "build_routine", label: "Become a regular somewhere", emoji: "📍" },
] as const;
export type GoalId = (typeof GOALS)[number]["id"];
export const goalId = literals(...GOALS.map((g) => g.id));

/**
 * San Francisco's 41 Analysis Neighborhoods (DataSF). The slug is the name
 * slugified; #15's `neighborhoods.slug` uses the same slugs, so profile facts
 * join to it. Parks are listed (they're real boundaries) but not offered as
 * places to live.
 */
export const SF_NEIGHBORHOODS = [
  { slug: "bayview-hunters-point", name: "Bayview Hunters Point", short: "Bayview" },
  { slug: "bernal-heights", name: "Bernal Heights" },
  { slug: "castro-upper-market", name: "Castro/Upper Market", short: "Castro" },
  { slug: "chinatown", name: "Chinatown" },
  { slug: "excelsior", name: "Excelsior" },
  { slug: "financial-district-south-beach", name: "Financial District/South Beach", short: "FiDi" },
  { slug: "glen-park", name: "Glen Park" },
  { slug: "golden-gate-park", name: "Golden Gate Park", park: true },
  { slug: "haight-ashbury", name: "Haight Ashbury", short: "Haight" },
  { slug: "hayes-valley", name: "Hayes Valley" },
  { slug: "inner-richmond", name: "Inner Richmond" },
  { slug: "inner-sunset", name: "Inner Sunset" },
  { slug: "japantown", name: "Japantown" },
  { slug: "lakeshore", name: "Lakeshore" },
  { slug: "lincoln-park", name: "Lincoln Park", park: true },
  { slug: "lone-mountain-usf", name: "Lone Mountain/USF", short: "Lone Mountain" },
  { slug: "marina", name: "Marina" },
  { slug: "mclaren-park", name: "McLaren Park", park: true },
  { slug: "mission", name: "Mission" },
  { slug: "mission-bay", name: "Mission Bay" },
  { slug: "nob-hill", name: "Nob Hill" },
  { slug: "noe-valley", name: "Noe Valley" },
  { slug: "north-beach", name: "North Beach" },
  { slug: "oceanview-merced-ingleside", name: "Oceanview/Merced/Ingleside", short: "OMI" },
  { slug: "outer-mission", name: "Outer Mission" },
  { slug: "outer-richmond", name: "Outer Richmond" },
  { slug: "pacific-heights", name: "Pacific Heights", short: "Pac Heights" },
  { slug: "portola", name: "Portola" },
  { slug: "potrero-hill", name: "Potrero Hill" },
  { slug: "presidio", name: "Presidio" },
  { slug: "presidio-heights", name: "Presidio Heights" },
  { slug: "russian-hill", name: "Russian Hill" },
  { slug: "seacliff", name: "Seacliff" },
  { slug: "south-of-market", name: "South of Market", short: "SoMa" },
  { slug: "sunset-parkside", name: "Sunset/Parkside", short: "Outer Sunset" },
  { slug: "tenderloin", name: "Tenderloin" },
  { slug: "treasure-island", name: "Treasure Island" },
  { slug: "twin-peaks", name: "Twin Peaks" },
  { slug: "visitacion-valley", name: "Visitacion Valley", short: "Vis Valley" },
  { slug: "west-of-twin-peaks", name: "West of Twin Peaks" },
  { slug: "western-addition", name: "Western Addition" },
] as const satisfies readonly { slug: string; name: string; short?: string; park?: boolean }[];
export type NeighborhoodSlug = (typeof SF_NEIGHBORHOODS)[number]["slug"];
export const neighborhoodSlug = literals(...SF_NEIGHBORHOODS.map((n) => n.slug));

type NeighborhoodDef = { slug: NeighborhoodSlug; name: string; short?: string; park?: boolean };
const NEIGHBORHOOD_BY_SLUG = new Map<string, NeighborhoodDef>(
  (SF_NEIGHBORHOODS as readonly NeighborhoodDef[]).map((n) => [n.slug, n]),
);
export function getNeighborhood(slug: NeighborhoodSlug): NeighborhoodDef {
  return NEIGHBORHOOD_BY_SLUG.get(slug)!;
}
/** Display name: the everyday short name when there is one ("SoMa"). */
export function neighborhoodLabel(slug: NeighborhoodSlug): string {
  const n = getNeighborhood(slug);
  return n.short ?? n.name;
}

/* ---------------- Values ---------------- */

/** Monthly rent in whole dollars. */
export const budgetValue = v.object({ min: v.optional(v.number()), max: v.number() });
/** `month` is "YYYY-MM" (crews match on it); `date` is "YYYY-MM-DD" when known. */
export const moveInValue = v.object({ month: v.string(), date: v.optional(v.string()) });
export const neighborhoodValue = v.object({ slug: neighborhoodSlug });
/** How the person gets around. No "car" in `modes` means no car. */
export const transportValue = v.object({ modes: v.array(transportMode) });
export const scheduleValue = v.object({
  workHours: literals(...WORK_HOURS.map((w) => w.id)),
  workplace: v.optional(literals(...WORKPLACES.map((w) => w.id))),
  weekendsFree: v.boolean(),
});
/** Optional; used for same-employer crews (#30) and commute fit. */
export const employerValue = v.object({ name: v.string(), workArea: v.optional(v.string()) });
export const interestValue = v.object({ id: interestId });
export const goalValue = v.object({ id: goalId });

/** A fact's key and typed value, without provenance (proposals, inference input). */
export const factEntry = v.union(
  v.object({ key: v.literal("budget"), value: budgetValue }),
  v.object({ key: v.literal("moveIn"), value: moveInValue }),
  v.object({ key: v.literal("neighborhood"), value: neighborhoodValue }),
  v.object({ key: v.literal("transport"), value: transportValue }),
  v.object({ key: v.literal("schedule"), value: scheduleValue }),
  v.object({ key: v.literal("employer"), value: employerValue }),
  v.object({ key: v.literal("interest"), value: interestValue }),
  v.object({ key: v.literal("goal"), value: goalValue }),
);
export type FactEntry = Infer<typeof factEntry>;
export type FactKey = FactEntry["key"];
export type FactValue<K extends FactKey> = Extract<FactEntry, { key: K }>["value"];

/** Keys with one value per person; the rest (interest, neighborhood, goal) have one row per item. */
export const SINGLE_KEYS = ["budget", "moveIn", "transport", "schedule", "employer"] as const;
export type SingleKey = (typeof SINGLE_KEYS)[number];
export type MultiKey = Exclude<FactKey, SingleKey>;
export function isSingleKey(key: FactKey): key is SingleKey {
  return (SINGLE_KEYS as readonly string[]).includes(key);
}

/** Identity of a fact within a profile: the key, or key + item for multi-valued keys. */
export function factSlot(e: FactEntry): string {
  switch (e.key) {
    case "interest":
    case "goal":
      return `${e.key}:${e.value.id}`;
    case "neighborhood":
      return `${e.key}:${e.value.slug}`;
    default:
      return e.key;
  }
}

/* ---------------- Provenance ---------------- */

export const factSource = literals("stated", "inferred");
export type FactSource = Infer<typeof factSource>;

export const factEvidence = v.object({
  /**
   * brief: the onboarding form · free_text: the "Tell us about you" box ·
   * activity: inferred from RSVPs, joins, likes, skips and pins (#4) ·
   * edit: changed on "What Muse knows about you" (#5).
   */
  kind: literals("brief", "free_text", "activity", "edit"),
  /** Shown to the person: "You said so in your brief", "RSVP'd to 3 climbing events". */
  summary: v.string(),
  /** free_text: the person's own words this fact came from. */
  quote: v.optional(v.string()),
});
export type FactEvidence = Infer<typeof factEvidence>;

const provenance = {
  userId: v.id("users"),
  source: factSource,
  evidence: factEvidence,
  /** 0–1. Stated facts are 1. */
  confidence: v.number(),
  updatedAt: v.number(),
  /** Set when the person removed it; inference must not bring it back (#5). */
  removedAt: v.optional(v.number()),
};

/** One `cityProfileFacts` row. */
export const cityProfileFact = v.union(
  v.object({ ...provenance, key: v.literal("budget"), value: budgetValue }),
  v.object({ ...provenance, key: v.literal("moveIn"), value: moveInValue }),
  v.object({ ...provenance, key: v.literal("neighborhood"), value: neighborhoodValue }),
  v.object({ ...provenance, key: v.literal("transport"), value: transportValue }),
  v.object({ ...provenance, key: v.literal("schedule"), value: scheduleValue }),
  v.object({ ...provenance, key: v.literal("employer"), value: employerValue }),
  v.object({ ...provenance, key: v.literal("interest"), value: interestValue }),
  v.object({ ...provenance, key: v.literal("goal"), value: goalValue }),
);

/* ---------------- Labels ---------------- */

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function dollars(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** "March 2027" from "2027-03", or "March 14, 2027" from "2027-03-14". */
export function moveInLabel(value: FactValue<"moveIn">): string {
  if (value.date) {
    const d = new Date(`${value.date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return DAY_MONTH.format(d);
  }
  const m = new Date(`${value.month}-01T00:00:00Z`);
  return Number.isNaN(m.getTime()) ? value.month : MONTH_YEAR.format(m);
}

export function budgetLabel(value: FactValue<"budget">): string {
  return value.min
    ? `${dollars(value.min)}–${dollars(value.max)}/mo`
    : `Up to ${dollars(value.max)}/mo`;
}

export function transportLabel(value: FactValue<"transport">): string {
  const labels = TRANSPORT_MODES.filter((m) => value.modes.includes(m.id)).map((m) => m.label);
  const list = labels.length > 0 ? labels.join(", ") : "Not set";
  return value.modes.includes("car") ? list : `${list} · no car`;
}

export function scheduleLabel(value: FactValue<"schedule">): string {
  const hours = WORK_HOURS.find((w) => w.id === value.workHours)?.label ?? value.workHours;
  const place =
    value.workplace && value.workplace !== "none"
      ? WORKPLACES.find((w) => w.id === value.workplace)?.label.toLowerCase()
      : null;
  return [
    value.workplace === "none" ? null : `Works ${hours.toLowerCase()}`,
    place,
    value.weekendsFree ? "weekends free" : "works some weekends",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function goalLabel(id: GoalId): string {
  return GOALS.find((g) => g.id === id)?.label ?? id;
}

/** One-line, human-readable description of a fact's value. */
export function factLabel(e: FactEntry): string {
  switch (e.key) {
    case "budget":
      return budgetLabel(e.value);
    case "moveIn":
      return moveInLabel(e.value);
    case "neighborhood":
      return neighborhoodLabel(e.value.slug);
    case "transport":
      return transportLabel(e.value);
    case "schedule":
      return scheduleLabel(e.value);
    case "employer":
      return e.value.workArea ? `${e.value.name} · ${e.value.workArea}` : e.value.name;
    case "interest":
      return interestLabel(e.value.id);
    case "goal":
      return goalLabel(e.value.id);
  }
}

export function interestLabel(id: InterestId): string {
  return getInterest(id).label;
}

/** Section headings for a fact key. */
export const FACT_KEY_LABELS: Record<FactKey, string> = {
  budget: "Budget",
  moveIn: "Move-in",
  neighborhood: "Neighborhoods",
  transport: "Getting around",
  schedule: "Schedule",
  employer: "Work",
  interest: "Interests",
  goal: "Goals",
};
