import { ConvexError, v } from "convex/values";
import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";

/**
 * Every app-facing function runs "as" a viewer. Today the viewer is the demo
 * persona chosen in the account menu (sent as `viewerId`); swapping in real
 * auth later only changes these two builders.
 */
const viewerArgs = { viewerId: v.id("users") };

export const viewerQuery = customQuery(query, {
  args: viewerArgs,
  input: async (ctx, { viewerId }) => {
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) throw new ConvexError("Unknown viewer");
    return { ctx: { viewer }, args: {} };
  },
});

export const viewerMutation = customMutation(mutation, {
  args: viewerArgs,
  input: async (ctx, { viewerId }) => {
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) throw new ConvexError("Unknown viewer");
    return { ctx: { viewer }, args: {} };
  },
});
