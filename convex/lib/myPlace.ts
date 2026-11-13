import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveSources } from "./citations";
import { isCalendarDate } from "./cityProfileFacts";
import { loadAudience } from "./posts";

/**
 * My place: the apartment a person chose (`places` table, convex/myPlace.ts).
 * Private to its owner: read it only with the owner's own id, never to show
 * someone else, never on maps, crews or Journeys, and never to notify the lister.
 * Shared by the server and the client.
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

/**
 * The person's current place, or null. The helper every feature uses to
 * know where someone lives (move-out, Home timeline). Call it only with the
 * viewer's own id.
 */
export async function currentPlace(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"places"> | null> {
  return ctx.db
    .query("places")
    .withIndex("by_user_current", (q) => q.eq("userId", userId).eq("endedAt", undefined))
    .first();
}

/** Whether the owner may still see a listing (not deleted, hidden or blocked). */
export async function canSeeListing(
  ctx: QueryCtx,
  userId: Id<"users">,
  listingId: Id<"listings">,
): Promise<boolean> {
  const seen = await resolveSources(
    ctx,
    [{ kind: "listing", listingId }],
    await loadAudience(ctx, userId),
  );
  return seen.length > 0;
}

/**
 * The rental new rooms and 3D units start from: the current place's listing,
 * while the owner can still see it.
 */
export async function placeListingId(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Id<"listings"> | undefined> {
  const listingId = (await currentPlace(ctx, userId))?.listingId;
  return listingId && (await canSeeListing(ctx, userId, listingId)) ? listingId : undefined;
}
