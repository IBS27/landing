import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { isCalendarDate, todayInSF } from "./cityProfileFacts";

/**
 * House Groups (#38): the pure, client-safe part (no server imports) — the
 * row validators, limits, money in whole cents, and San Francisco dates for
 * chore periods and bill due dates. `convex/house.ts` holds the functions and
 * `./houseAccess.ts` the membership checks.
 *
 * Bills are stored in whole cents (`amountCents`), unlike the whole dollars
 * used for listings and offers elsewhere: a house splits real bills like
 * $142.37, and #39 splits them exactly, in code.
 */

/* ---------------- Validators ---------------- */

export const CHORE_CADENCES = [
  { id: "once", label: "Once" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
] as const;
export type ChoreCadence = (typeof CHORE_CADENCES)[number]["id"];
export const choreCadence = literals(...CHORE_CADENCES.map((c) => c.id));

export const BILL_CADENCES = [
  { id: "once", label: "Once" },
  { id: "monthly", label: "Every month" },
] as const;
export type BillCadence = (typeof BILL_CADENCES)[number]["id"];
export const billCadence = literals(...BILL_CADENCES.map((c) => c.id));

/** A San Francisco calendar date, "2026-11-12". Checked with `isCalendarDate`. */
export const sfDate = v.string();

/* ---------------- Limits ---------------- */

/** The clone's Group name limit (`groups.create`). */
export const NAME_MAX = 75;
export const TITLE_MAX = 80;
export const MAX_HOUSES_PER_PERSON = 5;
/** Open invites per house at a time. */
export const MAX_PENDING_INVITES = 20;
export const MAX_CHORES = 50;
/** Bills kept per house, paid ones included. */
export const MAX_BILLS = 500;
/** Unchecked grocery items per house. */
export const MAX_GROCERIES = 100;
/** $100,000. */
export const MAX_AMOUNT_CENTS = 10_000_000;
/** Paid bills shown under the open ones. */
export const PAID_SHOWN = 12;

/* ---------------- Text ---------------- */

/** A trimmed name or title, or why it can't be saved. */
export function cleanTitle(
  text: string,
  max = TITLE_MAX,
  what = "a name",
): { ok: true; text: string } | { ok: false; error: string } {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return { ok: false, error: `Add ${what}` };
  if (t.length > max) return { ok: false, error: `Keep it to ${max} characters` };
  return { ok: true, text: t };
}

/* ---------------- Money ---------------- */

/** Why an amount in cents can't be a bill, or null. */
export function amountProblem(cents: number): string | null {
  if (!Number.isInteger(cents)) return "Amounts are in whole cents";
  if (cents <= 0) return "Add an amount above $0";
  if (cents > MAX_AMOUNT_CENTS) return "That's more than a house bill can be";
  return null;
}

/**
 * Cents from what someone typed: "142.37", "$1,250", "65.5". Null when it
 * isn't an amount of money.
 */
export function parseDollars(text: string): number | null {
  const m = /^\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const dollars = Number(m[1].replace(/,/g, ""));
  const cents = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  const total = dollars * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

const WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const EXACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** "$1,250", "$142.37": cents only when there are some. */
export function money(cents: number): string {
  return cents % 100 === 0 ? WHOLE.format(cents / 100) : EXACT.format(cents / 100);
}

/* ---------------- San Francisco dates ---------------- */

export { isCalendarDate, todayInSF };

/** "2026-11-12" plus `days` (negative to go back). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The same day next month, or its last day when it has fewer: Jan 31 → Feb 28. */
export function addMonth(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The Monday of the Monday–Sunday week holding `date`. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

/**
 * The period a chore is done for at `now`, San Francisco time: the week's
 * Monday ("2026-11-09"), the month's first day ("2026-11-01"), or "once".
 * A weekly chore done on Sunday counts for that week; Monday starts a new one.
 */
export function periodOf(cadence: ChoreCadence, now = Date.now()): string {
  if (cadence === "once") return "once";
  const today = todayInSF(now);
  return cadence === "weekly" ? mondayOf(today) : `${today.slice(0, 8)}01`;
}

/** "this week", "this month", or nothing for a one-off chore. */
export function periodLabel(cadence: ChoreCadence): string | null {
  return cadence === "weekly" ? "this week" : cadence === "monthly" ? "this month" : null;
}

/** Whether an unpaid bill is past its due date, San Francisco time. */
export function isOverdue(
  bill: { dueDate?: string | null; paidAt?: number | null },
  now = Date.now(),
) {
  return !bill.paidAt && !!bill.dueDate && bill.dueDate < todayInSF(now);
}
