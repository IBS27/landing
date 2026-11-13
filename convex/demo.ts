import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cloneTemplate } from "./lib/demoClone";

/** New demo users allowed per minute, across everyone (no login, no IPs). */
export const STARTS_PER_MINUTE = 20;

/**
 * Starts a private demo user for this browser, cloned from the starting
 * persona (`lib/demoClone.ts`). Takes no viewer; globally rate-limited.
 */
export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("users")
      .withIndex("by_demo_joined", (q) => q.eq("isDemo", true).gt("joinedAt", now - 60_000))
      .take(STARTS_PER_MINUTE);
    if (recent.length >= STARTS_PER_MINUTE)
      throw new ConvexError("Lots of people are trying Landing right now. Try again in a minute.");
    return cloneTemplate(ctx, now);
  },
});

/**
 * The stored viewer id if it still exists (a seeded persona or a demo user),
 * else null. Public: runs before a viewer exists.
 */
export const check = query({
  args: { viewerId: v.string() },
  handler: async (ctx, { viewerId }) => {
    const id = ctx.db.normalizeId("users", viewerId);
    const user = id && (await ctx.db.get(id));
    return user ? user._id : null;
  },
});
