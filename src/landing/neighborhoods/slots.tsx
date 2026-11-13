import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Slots on the neighborhood page for features built in their own issues. Each
 * renders nothing until its feature lands; the owner swaps in their component
 * here and the page needs no other change.
 */

type SlotProps = { neighborhoodId: Id<"neighborhoods">; slug: string };

/** #17: cited scores for things to do, food, transit and fit. Replace with `<NeighborhoodScores … />`. */
export function ScoresSlot(_: SlotProps) {
  return null;
}

/** #18: the cited Weekend Route on a map. Replace with `<WeekendRoute neighborhoodId={…} />`. */
export function WeekendRouteSlot(_: SlotProps) {
  return null;
}
