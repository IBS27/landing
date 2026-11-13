import type { Id } from "../_generated/dataModel";
import { type FactValue, isCalendarDate, moveInLabel } from "./cityProfileFacts";
import type { PlaceStatus } from "./placeRules";

/**
 * Landing Home's move timeline (#142): where the person is in their move and
 * what to do next. Plain rules over data the server has already read, with no
 * AI, so Home is the same with AI off. Client-safe (no server imports). The
 * query is `api.home.timeline` (convex/home.ts).
 *
 * Every step says why it's shown, from the person's own data ("Move-in is in
 * 12 days and you haven't asked movers for quotes"). That reason is its source.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Days after move-in that count as settling in; after that, settled. */
export const SETTLING_DAYS = 60;
/** A place still marked "moving in" this many days after its move-in date still reads as moving in. */
export const MOVE_IN_GRACE_DAYS = 30;
/** Mover quotes lead once move-in is this close. */
export const MOVERS_LEAD_DAYS = 30;
/** Secondary steps shown under the next one. */
export const ALSO_MAX = 3;

/* ---------- Stage ---------- */

export const STAGES = [
  { id: "not_started", label: "Get started" },
  { id: "searching", label: "Searching" },
  { id: "moving_in", label: "Moving in" },
  { id: "settling_in", label: "Settling in" },
  { id: "settled", label: "Settled" },
  { id: "moving_out", label: "Moving out" },
] as const;
export type Stage = (typeof STAGES)[number]["id"];

export type Hood = { slug: string; name: string };

export type PlaceFacts = {
  status: PlaceStatus;
  /** "YYYY-MM-DD", like every date here. */
  moveIn: string;
  moveOut: string | null;
  neighborhood: Hood | null;
  /** The listing's public title, while the person can still see it. */
  listingTitle: string | null;
};

/** What the stage is read from. */
export type StageInput = {
  /** Today in San Francisco (`todayInSF`). */
  today: string;
  briefDone: boolean;
  place: PlaceFacts | null;
};

/** Whole calendar days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** Days since move-in; 0 when the date can't be read, so a bad date never skips a stage. */
function daysSinceMoveIn(p: PlaceFacts, today: string): number {
  return isCalendarDate(p.moveIn) && isCalendarDate(today) ? daysBetween(p.moveIn, today) : 0;
}

/**
 * The person's stage:
 * - no current place: not started without a City Profile brief, searching with one;
 * - moving in: their place says so, and move-in is ahead or under
 *   `MOVE_IN_GRACE_DAYS` past (further past, they're living there and the
 *   next step asks them to say so);
 * - living there: settling in for the first `SETTLING_DAYS`, then settled;
 * - moving out: their place says so.
 */
export function stageOf({ today, briefDone, place: p }: StageInput): Stage {
  if (!p || p.status === "moved_out") return briefDone ? "searching" : "not_started";
  if (p.status === "moving_out") return "moving_out";
  const since = daysSinceMoveIn(p, today);
  if (p.status === "moving_in" && since <= MOVE_IN_GRACE_DAYS) return "moving_in";
  return since < SETTLING_DAYS ? "settling_in" : "settled";
}

/* ---------- Dates ---------- */

export type MoveDate = {
  /** "YYYY-MM-DD", or null when only the month is known. */
  date: string | null;
  /** "YYYY-MM". */
  month: string;
  /** Days from today: positive ahead, negative past, null when only the month is known. */
  days: number | null;
  /** The person's place, or the move-in they planned in their City Profile. */
  from: "place" | "profile";
};

function dated(date: string, today: string, from: MoveDate["from"]): MoveDate {
  return {
    date,
    month: date.slice(0, 7),
    days: isCalendarDate(date) ? daysBetween(today, date) : null,
    from,
  };
}

/** The move-in to show: the place's, or else the one planned in the brief. */
export function moveInOf(
  i: StageInput & { plannedMoveIn: FactValue<"moveIn"> | null },
): MoveDate | null {
  if (i.place) return dated(i.place.moveIn, i.today, "place");
  const m = i.plannedMoveIn;
  if (!m) return null;
  return m.date
    ? dated(m.date, i.today, "profile")
    : { date: null, month: m.month, days: null, from: "profile" };
}

/** The planned move-out while moving out. */
export function moveOutOf(i: StageInput): MoveDate | null {
  const out = i.place?.status === "moving_out" ? i.place.moveOut : null;
  return out ? dated(out, i.today, "place") : null;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

/** "Dec 1", from "2026-12-01". */
export function shortDate(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(t) ? date : SHORT_DATE.format(t);
}

/** "today", "tomorrow", "in 12 days", "yesterday", "16 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/* ---------- Steps ---------- */

/** Where a step goes. The client turns each into a `src/landing/links.ts` helper. */
export type StepLink =
  | { to: "welcome" }
  | { to: "find" }
  | { to: "neighborhoods" }
  | { to: "neighborhood"; slug: string }
  | { to: "compare"; a: string; b: string }
  | { to: "rental"; listingId: Id<"listings"> }
  | { to: "place" }
  | { to: "unit" }
  | { to: "crew" }
  | { to: "journeys" }
  | { to: "moveOut" };

export type StepId =
  | "setUpProfile"
  | "findRentals"
  | "exploreNeighborhoods"
  | "compareNeighborhoods"
  | "takePlace"
  | "joinCrew"
  | "markMovedIn"
  | "moverQuotes"
  | "planUnit"
  | "addRoom"
  | "checkIn"
  | "trackItems"
  | "exploreHome"
  | "markMovedOut"
  | "sublet"
  | "sellItems";

export type Step = {
  id: StepId;
  title: string;
  /** Why it's shown, from the person's own data: the step's citation. */
  reason: string;
  /** The button label. */
  action: string;
  link: StepLink;
};

/**
 * What the steps are picked from. Each optional fact is read only for the
 * stages whose rules use it (`NEEDS`); a step whose fact wasn't read is skipped.
 */
export type StepInput = StageInput & {
  plannedMoveIn: FactValue<"moveIn"> | null;
  /** City Profile neighborhoods, stated first. */
  neighborhoods: Hood[];
  saved?: { count: number; newest: { listingId: Id<"listings">; title: string } | null };
  crew?: { optedIn: boolean; canJoin: boolean };
  rooms?: number;
  /** Whether the person has a 3D unit of their place. */
  unit?: boolean;
  /** Mover quotes (#28): null when this deployment doesn't have them. */
  movers?: { requested: boolean } | null;
  /** This week's check-in, once written. */
  checkIn?: { text: string; week: number } | null;
  items?: { total: number; unlisted: number };
  /** Whether they have a live sublet listing. */
  sublet?: boolean;
};

export type Need = "saved" | "crew" | "rooms" | "unit" | "movers" | "items" | "sublet";

/** The facts each stage's rules read, so the query loads nothing else. */
export const NEEDS: Record<Stage, readonly Need[]> = {
  not_started: ["saved"],
  searching: ["saved", "crew"],
  moving_in: ["crew", "unit", "rooms", "movers"],
  settling_in: ["crew", "items", "unit"],
  settled: ["items", "unit"],
  moving_out: ["items", "sublet"],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Rule = (i: StepInput) => Step | null;

const setUpProfile: Rule = (i) =>
  i.briefDone
    ? null
    : {
        id: "setUpProfile",
        title: "Set up your City Profile",
        reason:
          "You haven't set up your City Profile yet. Search, neighborhoods and Move-in Crews are tuned to it.",
        action: "Get started",
        link: { to: "welcome" },
      };

const findRentals: Rule = (i) =>
  i.saved && i.saved.count === 0
    ? {
        id: "findRentals",
        title: "Find apartments",
        reason: i.briefDone
          ? "You haven't saved any rentals yet. Search is tuned to your City Profile."
          : "You haven't saved any rentals yet.",
        action: "Search apartments",
        link: { to: "find" },
      }
    : null;

const exploreNeighborhoods: Rule = (i) =>
  i.neighborhoods.length < 2
    ? {
        id: "exploreNeighborhoods",
        title: "Explore neighborhoods",
        reason:
          i.neighborhoods.length === 1
            ? `${i.neighborhoods[0]?.name} is the only neighborhood in your City Profile. See how others compare.`
            : "Your City Profile doesn't list any neighborhoods yet.",
        action: "See neighborhoods",
        link: { to: "neighborhoods" },
      }
    : null;

const compareNeighborhoods: Rule = (i) => {
  const [a, b] = i.neighborhoods;
  return a && b
    ? {
        id: "compareNeighborhoods",
        title: `Compare ${a.name} and ${b.name}`,
        reason: `${a.name} and ${b.name} are both in your City Profile. See a Saturday in each, side by side.`,
        action: "Compare",
        link: { to: "compare", a: a.slug, b: b.slug },
      }
    : null;
};

const takePlace: Rule = (i) => {
  const s = i.saved?.newest;
  return s
    ? {
        id: "takePlace",
        title: "Chosen a place?",
        reason: `You saved “${s.title}”. When you sign, mark it as your place and Landing plans your move from it.`,
        action: "I'm taking this place",
        link: { to: "rental", listingId: s.listingId },
      }
    : null;
};

/** "to the Mission in 12 days", "in March 2027", "" — whatever is known. */
function arrival(i: StepInput): string {
  const where = i.place?.neighborhood ? ` to ${i.place.neighborhood.name}` : "";
  const m = moveInOf(i);
  if (!m) return where;
  if (m.days === null) return `${where} in ${moveInLabel({ month: m.month })}`;
  return `${where} ${relativeDays(m.days)}`;
}

const joinCrew: Rule = (i) => {
  if (!i.crew || i.crew.optedIn || !i.crew.canJoin) return null;
  const days = moveInOf(i)?.days;
  const moved = days != null && days < 0 ? "You moved" : "You're moving";
  const when = arrival(i);
  return {
    id: "joinCrew",
    title: "Join a Move-in Crew",
    reason: when
      ? `${moved}${when} and haven't joined a Move-in Crew. Meet people arriving when you do.`
      : "You haven't joined a Move-in Crew. Meet people arriving when you do.",
    action: "See your crew",
    link: { to: "crew" },
  };
};

const markMovedIn: Rule = (i) => {
  const p = i.place;
  if (p?.status !== "moving_in" || daysSinceMoveIn(p, i.today) <= 0) return null;
  return {
    id: "markMovedIn",
    title: "Moved in yet?",
    reason: `Your move-in date was ${shortDate(p.moveIn)}, and My Place still says you're moving in.`,
    action: "Update My Place",
    link: { to: "place" },
  };
};

/** Mover quotes before move-in. `soon`: only within `MOVERS_LEAD_DAYS`; otherwise only further out. */
const moverQuotes =
  (soon: boolean): Rule =>
  (i) => {
    const days = i.place ? moveInOf(i)?.days : null;
    if (!i.movers || i.movers.requested || days == null || days < 0) return null;
    if (soon !== days <= MOVERS_LEAD_DAYS) return null;
    return {
      id: "moverQuotes",
      title: "Get mover quotes",
      reason: `Move-in is ${relativeDays(days)} and you haven't asked movers for quotes.`,
      action: "Get quotes",
      link: { to: "place" },
    };
  };

const planUnit: Rule = (i) =>
  i.unit === false && i.place
    ? {
        id: "planUnit",
        title: "Plan your room in 3D",
        reason: `You haven't laid out ${i.place.listingTitle ? `“${i.place.listingTitle}”` : "your place"} in 3D yet.`,
        action: "Start in 3D",
        link: { to: "unit" },
      }
    : null;

const addRoom: Rule = (i) =>
  i.rooms === 0
    ? {
        id: "addRoom",
        title: "Scan your room",
        reason:
          "You haven't added a room yet. Its photos and vibe find matching furniture on Marketplace.",
        action: "Add a room",
        link: { to: "place" },
      }
    : null;

const checkIn: Rule = (i) =>
  i.checkIn
    ? {
        id: "checkIn",
        title: `Week ${i.checkIn.week} check-in`,
        reason: i.checkIn.text,
        action: "See check-in",
        link: { to: "journeys" },
      }
    : null;

const trackItems: Rule = (i) =>
  i.items?.total === 0
    ? {
        id: "trackItems",
        title: "Track what you own",
        reason:
          i.place?.status === "moving_out"
            ? "You haven't tracked anything you own, so there's nothing ready to sell yet."
            : "You haven't added anything you own. Tracked items are ready to sell when you move out.",
        action: "Add items",
        link: { to: "place" },
      }
    : null;

const exploreHome: Rule = (i) => {
  const n = i.place?.neighborhood;
  if (!n || !i.place) return null;
  const since = daysSinceMoveIn(i.place, i.today);
  return {
    id: "exploreHome",
    title: `What's on in ${n.name}`,
    reason: `You've lived in ${n.name} for ${plural(since, "day", "days")}. See its Groups, Events and Weekend Route.`,
    action: `See ${n.name}`,
    link: { to: "neighborhood", slug: n.slug },
  };
};

const markMovedOut: Rule = (i) => {
  const out = moveOutOf(i);
  if (!out?.date || out.days === null || out.days >= 0) return null;
  return {
    id: "markMovedOut",
    title: "Moved out yet?",
    reason: `Your move-out date was ${shortDate(out.date)}, and My Place still says you're moving out.`,
    action: "Update My Place",
    link: { to: "place" },
  };
};

const sublet: Rule = (i) => {
  if (i.sublet !== false) return null;
  const out = moveOutOf(i);
  const when = out?.days != null ? ` ${relativeDays(out.days)}` : "";
  return {
    id: "sublet",
    title: "Sublet your place",
    reason: `You're moving out${when} and haven't listed a sublet.`,
    action: "List a sublet",
    link: { to: "moveOut" },
  };
};

const sellItems: Rule = (i) => {
  const n = i.items?.unlisted ?? 0;
  return n > 0
    ? {
        id: "sellItems",
        title: `Sell ${plural(n, "thing", "things")} you own`,
        reason: `${plural(n, "item you track isn't", "items you track aren't")} listed for sale yet.`,
        action: "Pick what to sell",
        link: { to: "moveOut" },
      }
    : null;
};

/** Each stage's rules, most useful first. The first that applies is the next step. */
const RULES: Record<Stage, readonly Rule[]> = {
  not_started: [setUpProfile, findRentals, exploreNeighborhoods],
  searching: [findRentals, takePlace, compareNeighborhoods, joinCrew, exploreNeighborhoods],
  moving_in: [
    markMovedIn,
    moverQuotes(true),
    checkIn,
    joinCrew,
    planUnit,
    addRoom,
    moverQuotes(false),
    setUpProfile,
  ],
  settling_in: [markMovedIn, checkIn, joinCrew, trackItems, planUnit, setUpProfile],
  settled: [markMovedIn, checkIn, trackItems, exploreHome, planUnit, setUpProfile],
  moving_out: [markMovedOut, sublet, sellItems, trackItems, setUpProfile],
};

/** The next step and up to `ALSO_MAX` more for the stage. */
export function pickSteps(
  stage: Stage,
  i: StepInput,
): { nextStep: Step | null; alsoSteps: Step[] } {
  const steps = RULES[stage].map((rule) => rule(i)).filter((s): s is Step => s !== null);
  return { nextStep: steps[0] ?? null, alsoSteps: steps.slice(1, 1 + ALSO_MAX) };
}
