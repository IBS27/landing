import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import {
  type FactEntry,
  factSlot,
  type GoalId,
  moveInProblem,
  type NeighborhoodSlug,
  type TransportMode,
  valueKey,
  type WorkHours,
  type Workplace,
} from "../../../convex/lib/cityProfileFacts";
import type { InterestId } from "../../../convex/lib/interests";
import { EMPLOYER_PERSONAL, hasProtected } from "../../../convex/lib/protectedText";

export type CityProfile = FunctionReturnType<typeof api.cityProfile.get>;
export type Suggestions = FunctionReturnType<typeof api.cityProfile.suggestFromText>;
export type Proposal = Suggestions["proposals"][number];
type SaveArgs = Omit<FunctionArgs<typeof api.cityProfile.saveBrief>, "viewerId">;

/** The onboarding form's state. Strings for inputs; converted on save. */
export type BriefForm = {
  budgetMin: string;
  budgetMax: string;
  /** "YYYY-MM" */
  moveInMonth: string;
  /** "YYYY-MM-DD" or "" */
  moveInDate: string;
  neighborhoods: NeighborhoodSlug[];
  transport: TransportMode[];
  workHours: WorkHours;
  workplace: Workplace | "";
  weekendsFree: boolean;
  employer: string;
  workArea: string;
  interests: InterestId[];
  goals: GoalId[];
  /**
   * Facts the person confirmed from their own words: fact slot → the quote and
   * the value it supported (`valueKey`). Once the value changes, the quote no
   * longer backs it and is dropped.
   */
  quotes: Record<string, { quote: string; value: string }>;
};

export const EMPTY_BRIEF: BriefForm = {
  budgetMin: "",
  budgetMax: "",
  moveInMonth: "",
  moveInDate: "",
  neighborhoods: [],
  transport: [],
  workHours: "day",
  workplace: "",
  weekendsFree: true,
  employer: "",
  workArea: "",
  interests: [],
  goals: [],
  quotes: {},
};

/** Pre-fills the form from what the person stated before (inferred facts stay suggestions). */
export function briefFromProfile(p: CityProfile): BriefForm {
  const stated = <T extends { source: string }>(f: T | null) => (f?.source === "stated" ? f : null);
  const budget = stated(p.budget);
  const moveIn = stated(p.moveIn);
  const transport = stated(p.transport);
  const schedule = stated(p.schedule);
  const employer = stated(p.employer);
  const quotes: BriefForm["quotes"] = {};
  for (const f of p.facts) {
    if (f.source === "stated" && f.evidence.kind === "free_text" && f.evidence.quote) {
      quotes[factSlot(f)] = { quote: f.evidence.quote, value: valueKey(f.value) };
    }
  }
  return {
    budgetMin: budget?.value.min ? String(budget.value.min) : "",
    budgetMax: budget ? String(budget.value.max) : "",
    moveInMonth: moveIn?.value.month ?? "",
    moveInDate: moveIn?.value.date ?? "",
    neighborhoods: p.neighborhoods.filter((f) => f.source === "stated").map((f) => f.value.slug),
    transport: transport?.value.modes ?? [],
    workHours: schedule?.value.workHours ?? "day",
    workplace: schedule?.value.workplace ?? "",
    weekendsFree: schedule?.value.weekendsFree ?? true,
    employer: employer?.value.name ?? "",
    workArea: employer?.value.workArea ?? "",
    interests: p.interests.filter((f) => f.source === "stated").map((f) => f.value.id),
    goals: p.goals.filter((f) => f.source === "stated").map((f) => f.value.id),
    quotes,
  };
}

function money(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * What's still missing before the brief can be saved, in form order. `today`
 * is "YYYY-MM-DD" in San Francisco; `savedMoveIn` is the move-in already on
 * the profile, which stays valid after it passes (`moveInProblem`).
 */
export function briefProblems(
  f: BriefForm,
  today: string,
  savedMoveIn?: CityProfile["moveIn"],
): string[] {
  const out: string[] = [];
  const max = money(f.budgetMax);
  const min = money(f.budgetMin);
  if (max === null || max < 300 || max > 20000)
    out.push("Add a monthly budget between $300 and $20,000");
  else if (min !== null && min > max) out.push("The low end of your budget is above the high end");
  const moveIn = moveInProblem(moveInOf(f), today, savedMoveIn?.value);
  if (moveIn) out.push(moveIn);
  if (f.transport.length === 0) out.push("Pick at least one way you'll get around");
  if (f.interests.length === 0) out.push("Pick a few interests");
  if (hasProtected(f.employer) || hasProtected(f.workArea)) out.push(EMPLOYER_PERSONAL);
  return out;
}

type Brief = SaveArgs["brief"];

function moveInOf(f: BriefForm): Brief["moveIn"] {
  return f.moveInDate ? { month: f.moveInMonth, date: f.moveInDate } : { month: f.moveInMonth };
}

function budgetOf(f: BriefForm): Brief["budget"] {
  const max = money(f.budgetMax) ?? 0;
  const min = money(f.budgetMin);
  return min !== null && min > 0 ? { min, max } : { max };
}

function scheduleOf(f: BriefForm): Brief["schedule"] {
  return f.workplace
    ? { workHours: f.workHours, workplace: f.workplace, weekendsFree: f.weekendsFree }
    : { workHours: f.workHours, weekendsFree: f.weekendsFree };
}

function employerOf(f: BriefForm): Brief["employer"] {
  const name = f.employer.trim();
  const workArea = f.workArea.trim();
  if (!name) return undefined;
  return workArea ? { name, workArea } : { name };
}

/** The facts the form currently states, as `saveBrief` will store them. */
function briefEntries(f: BriefForm): FactEntry[] {
  const employer = employerOf(f);
  return [
    { key: "budget", value: budgetOf(f) },
    { key: "moveIn", value: moveInOf(f) },
    { key: "transport", value: { modes: f.transport } },
    { key: "schedule", value: scheduleOf(f) },
    ...(employer ? [{ key: "employer" as const, value: employer }] : []),
    ...f.neighborhoods.map((slug) => ({ key: "neighborhood" as const, value: { slug } })),
    ...f.interests.map((id) => ({ key: "interest" as const, value: { id } })),
    ...f.goals.map((id) => ({ key: "goal" as const, value: { id } })),
  ];
}

/**
 * The quote behind `slot`, while the form still states the value it came
 * from. Change the budget from $2,400 to $3,000 and the "$2,400" quote no
 * longer backs it, so the fact saves as a plain brief answer.
 */
export function liveQuote(f: BriefForm, slot: string): string | null {
  const q = f.quotes[slot];
  if (!q) return null;
  const entry = briefEntries(f).find((e) => factSlot(e) === slot);
  return entry && valueKey(entry.value) === q.value ? q.quote : null;
}

/** Form → `saveBrief` args. Call only when `briefProblems` is empty. */
export function toSaveArgs(f: BriefForm): SaveArgs {
  const args: SaveArgs = {
    brief: {
      budget: budgetOf(f),
      moveIn: moveInOf(f),
      neighborhoods: f.neighborhoods,
      transport: { modes: f.transport },
      schedule: scheduleOf(f),
      employer: employerOf(f),
      interests: f.interests,
      goals: f.goals,
    },
  };
  const fromText = Object.keys(f.quotes).flatMap((slot) => {
    const quote = liveQuote(f, slot);
    return quote ? [{ slot, quote }] : [];
  });
  return fromText.length > 0 ? { ...args, fromText } : args;
}

function add<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list : [...list, item];
}

/**
 * Merges confirmed "Tell us about you" proposals into the form, remembering
 * each quote with the value it now backs.
 */
export function applyProposals(f: BriefForm, picked: Proposal[]): BriefForm {
  let next: BriefForm = { ...f, quotes: { ...f.quotes } };
  for (const p of picked) {
    const e = p.entry;
    switch (e.key) {
      case "budget":
        next = {
          ...next,
          budgetMax: String(e.value.max),
          budgetMin: e.value.min ? String(e.value.min) : "",
        };
        break;
      case "moveIn":
        next = { ...next, moveInMonth: e.value.month, moveInDate: e.value.date ?? "" };
        break;
      case "neighborhood":
        next = { ...next, neighborhoods: add(next.neighborhoods, e.value.slug) };
        break;
      case "transport": {
        let modes = [...new Set([...next.transport, ...e.value.modes])];
        if (p.carFree) modes = modes.filter((m) => m !== "car");
        next = { ...next, transport: modes };
        break;
      }
      case "schedule":
        next = {
          ...next,
          workHours: e.value.workHours,
          workplace: e.value.workplace ?? next.workplace,
          weekendsFree: e.value.weekendsFree,
        };
        break;
      case "employer":
        // A new employer's work area is whatever the proposal says, not the old one's.
        next = { ...next, employer: e.value.name, workArea: e.value.workArea ?? "" };
        break;
      case "interest":
        next = { ...next, interests: add(next.interests, e.value.id) };
        break;
      case "goal":
        next = { ...next, goals: add(next.goals, e.value.id) };
        break;
    }
    // The quote backs the proposed value only. If merging made the form's value
    // something else (modes added to ones already ticked), it backs nothing.
    const slot = factSlot(e);
    const merged = briefEntries(next).find((x) => factSlot(x) === slot)?.value;
    if (merged !== undefined && valueKey(merged) === valueKey(proposedValue(e, p.carFree)))
      next.quotes[slot] = { quote: p.quote, value: valueKey(merged) };
    else delete next.quotes[slot];
  }
  return next;
}

/** A proposal's value as the form stores it (a car-free proposal never has a car). */
function proposedValue(e: FactEntry, carFree?: boolean): unknown {
  if (e.key === "transport" && carFree) return { modes: e.value.modes.filter((m) => m !== "car") };
  return e.value;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
