import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import {
  type FactEntry,
  factSlot,
  type GoalId,
  type NeighborhoodSlug,
  type TransportMode,
  type WorkHours,
  type Workplace,
} from "../../../convex/lib/cityProfileFacts";
import type { InterestId } from "../../../convex/lib/interests";

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
  /** Facts the person confirmed from their own words: fact slot → quote. */
  quotes: Record<string, string>;
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
  const quotes: Record<string, string> = {};
  for (const f of p.facts) {
    if (f.source === "stated" && f.evidence.kind === "free_text" && f.evidence.quote) {
      quotes[factSlot(f)] = f.evidence.quote;
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

/** What's still missing before the brief can be saved, in form order. */
export function briefProblems(f: BriefForm): string[] {
  const out: string[] = [];
  const max = money(f.budgetMax);
  const min = money(f.budgetMin);
  if (max === null || max < 300 || max > 20000)
    out.push("Add a monthly budget between $300 and $20,000");
  else if (min !== null && min > max) out.push("The low end of your budget is above the high end");
  if (!/^\d{4}-\d{2}$/.test(f.moveInMonth)) out.push("Pick the month you're moving");
  else if (f.moveInDate && !f.moveInDate.startsWith(f.moveInMonth))
    out.push("Your move-in date isn't in that month");
  if (f.transport.length === 0) out.push("Pick at least one way you'll get around");
  if (f.interests.length === 0) out.push("Pick a few interests");
  return out;
}

/** Form → `saveBrief` args. Call only when `briefProblems` is empty. */
export function toSaveArgs(f: BriefForm): SaveArgs {
  const max = money(f.budgetMax) ?? 0;
  const min = money(f.budgetMin);
  const employer = f.employer.trim();
  const workArea = f.workArea.trim();
  const args: SaveArgs = {
    brief: {
      budget: min !== null && min > 0 ? { min, max } : { max },
      moveIn: f.moveInDate
        ? { month: f.moveInMonth, date: f.moveInDate }
        : { month: f.moveInMonth },
      neighborhoods: f.neighborhoods,
      transport: { modes: f.transport },
      schedule: f.workplace
        ? { workHours: f.workHours, workplace: f.workplace, weekendsFree: f.weekendsFree }
        : { workHours: f.workHours, weekendsFree: f.weekendsFree },
      employer: employer
        ? workArea
          ? { name: employer, workArea }
          : { name: employer }
        : undefined,
      interests: f.interests,
      goals: f.goals,
    },
  };
  // Keep a quote only while the fact it backs is still in the brief.
  const live = new Set(briefEntries(f).map(factSlot));
  const fromText = Object.entries(f.quotes)
    .filter(([slot]) => live.has(slot))
    .map(([slot, quote]) => ({ slot, quote }));
  return fromText.length > 0 ? { ...args, fromText } : args;
}

/** The facts the form currently states, for matching quotes to them. */
function briefEntries(f: BriefForm): FactEntry[] {
  return [
    { key: "budget", value: { max: 0 } },
    { key: "moveIn", value: { month: "" } },
    { key: "transport", value: { modes: [] } },
    { key: "schedule", value: { workHours: "day", weekendsFree: true } },
    ...(f.employer.trim() ? [{ key: "employer" as const, value: { name: "" } }] : []),
    ...f.neighborhoods.map((slug) => ({ key: "neighborhood" as const, value: { slug } })),
    ...f.interests.map((id) => ({ key: "interest" as const, value: { id } })),
    ...f.goals.map((id) => ({ key: "goal" as const, value: { id } })),
  ];
}

function add<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list : [...list, item];
}

/** Merges confirmed "Tell us about you" proposals into the form, remembering each quote. */
export function applyProposals(f: BriefForm, picked: Proposal[]): BriefForm {
  let next: BriefForm = { ...f, quotes: { ...f.quotes } };
  for (const p of picked) {
    const e = p.entry;
    next.quotes[factSlot(e)] = p.quote;
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
        next = { ...next, employer: e.value.name, workArea: e.value.workArea ?? next.workArea };
        break;
      case "interest":
        next = { ...next, interests: add(next.interests, e.value.id) };
        break;
      case "goal":
        next = { ...next, goals: add(next.goals, e.value.id) };
        break;
    }
  }
  return next;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
