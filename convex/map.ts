import { v } from "convex/values";
import { viewerQuery } from "./lib/functions";
import { pinsInBounds } from "./lib/mapPins";

/**
 * The Landing map's free-browse view (#56): privacy-filtered pins inside the
 * visible area. Features with their own data (Weekend Routes, neighborhood
 * pages) pass layers to `<LandingMap>` straight from their own queries.
 */
export const inBounds = viewerQuery({
  args: {
    bounds: v.object({ west: v.number(), south: v.number(), east: v.number(), north: v.number() }),
    kinds: v.array(
      v.union(v.literal("homes"), v.literal("items"), v.literal("events"), v.literal("groups")),
    ),
  },
  handler: (ctx, { bounds, kinds }) => pinsInBounds(ctx, ctx.viewer._id, bounds, kinds),
});
