import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";
import { plural } from "@/lib/format";
import type { api } from "../../../convex/_generated/api";

export type ProfileData = NonNullable<FunctionReturnType<typeof api.profiles.get>>;
export type ProfileUser = ProfileData["user"];

type Ctx = {
  profile: ProfileData;
  /** Rendered inside the Friends page preview pane (tabs link to the full profile). */
  embedded: boolean;
};

export const ProfileContext = createContext<Ctx | null>(null);

/** Horizontal gutter for the 1186px content column (always padded inside the preview pane). */
export function columnPad(embedded: boolean) {
  return embedded ? "px-4" : "px-4 min-[1218px]:px-0";
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside a profile");
  return ctx;
}

/** "Seattle, Washington" → "Seattle, WA"-style short form is not used by FB; keep the full city. */
export function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

export function joinedLabel(ts: number) {
  return `Joined ${monthFmt.format(new Date(ts))}`;
}

/** "04-18" → "April 18". */
export function birthdayLabel(mmdd: string) {
  const [m, d] = mmdd.split("-").map(Number);
  return dayFmt.format(new Date(2000, m - 1, d));
}

/* ---------------- Work / education dates ("YYYY-MM") ---------------- */

const shortMonthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function monthDate(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** "2 years, 3 months" between two months (end inclusive of the current month). */
export function durationLabel(start: string, end?: string) {
  const s = monthDate(start);
  const e = end ? monthDate(end) : new Date();
  const total = Math.max(
    1,
    (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() + (end ? 1 : 0),
  );
  const years = Math.floor(total / 12);
  const months = total % 12;
  return [years && plural(years, "year"), months && plural(months, "month")]
    .filter(Boolean)
    .join(", ");
}

/** Work: "Aug 2024 - Present · 2 years, 3 months". Null without a start month. */
export function workDates(w: { start?: string; end?: string }) {
  if (!w.start) return null;
  const range = `${shortMonthFmt.format(monthDate(w.start))} - ${
    w.end ? shortMonthFmt.format(monthDate(w.end)) : "Present"
  }`;
  return `${range} · ${durationLabel(w.start, w.end)}`;
}

/** Education: "September 2023 - June 2027". Null without a start month. */
export function schoolDates(e: { start?: string; end?: string }) {
  if (!e.start) return null;
  return `${monthFmt.format(monthDate(e.start))} - ${
    e.end ? monthFmt.format(monthDate(e.end)) : "Present"
  }`;
}
