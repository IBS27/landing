import type { Id } from "../../../convex/_generated/dataModel";
import { NeighborhoodScores } from "./NeighborhoodScores";
import { WeekendRoute } from "./WeekendRoute";

/**
 * Slots on the neighborhood page for features built in their own issues. Each
 * renders nothing until its feature lands; the owner swaps in their component
 * here and the page needs no other change.
 */

type SlotProps = { neighborhoodId: Id<"neighborhoods">; slug: string };

/** #17: cited scores for things to do, food, transit and fit, and "Getting around at night". */
export function ScoresSlot({ neighborhoodId }: SlotProps) {
  return (
    <div className="mb-4">
      <NeighborhoodScores neighborhoodId={neighborhoodId} />
    </div>
  );
}

/** #18: the cited Weekend Route on a map. */
export function WeekendRouteSlot({ neighborhoodId }: SlotProps) {
  // `id`: listings link straight to the route (`WeekendRoutePeek`).
  return (
    <div id="weekend-route" className="scroll-mt-[72px]">
      <WeekendRoute neighborhoodId={neighborhoodId} />
    </div>
  );
}
