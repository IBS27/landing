import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";
import { isCalendarDate } from "./cityProfileFacts";

/**
 * My place's statuses and date rules (#132), shared by the server and the
 * client (no server imports). Server helpers, `currentPlace` among them, are
 * in `./myPlace.ts`.
 */

export const PLACE_STATUSES = [
  { id: "moving_in", label: "Moving in" },
  { id: "living", label: "Living here" },
  { id: "moving_out", label: "Moving out" },
  { id: "moved_out", label: "Moved out" },
] as const;
export const placeStatus = literals(...PLACE_STATUSES.map((s) => s.id));
export type PlaceStatus = Infer<typeof placeStatus>;

export function placeStatusLabel(status: PlaceStatus): string {
  return PLACE_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** A move-in this many years out is a typo. */
const MAX_YEARS_AHEAD = 2;

/**
 * Why a place's dates and status don't fit together, or null when they do.
 * Dates are "YYYY-MM-DD"; `today` is San Francisco's (`todayInSF`).
 */
export function placeProblem(
  p: { status: PlaceStatus; moveIn: string; moveOut?: string },
  today: string,
): string | null {
  if (!isCalendarDate(p.moveIn)) return "Pick your move-in date";
  const latest = `${Number(today.slice(0, 4)) + MAX_YEARS_AHEAD}${today.slice(4)}`;
  if (p.moveIn > latest) return "Your move-in date is more than two years away";
  if (p.moveOut !== undefined) {
    if (!isCalendarDate(p.moveOut)) return "Pick your move-out date";
    if (p.moveOut < p.moveIn) return "Your move-out date is before your move-in date";
  }
  if (p.status !== "moving_in" && p.moveIn > today)
    return "Your move-in date is still ahead, so you're moving in";
  if (p.status === "moved_out") {
    if (p.moveOut === undefined) return "Add the day you moved out";
    if (p.moveOut > today) return "Your move-out date is still ahead, so you're moving out";
  }
  return null;
}
