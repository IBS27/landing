import { v } from "convex/values";
import { query } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { userSummary } from "./lib/users";

/** Demo accounts shown in the account switcher. Public: needed before a viewer exists. */
export const personas = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_persona", (q) => q.eq("isPersona", true))
      .collect();
    return rows.map(userSummary);
  },
});

export const me = viewerQuery({
  args: {},
  handler: async (ctx) => ctx.viewer,
});

export const byUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    return u && { _id: u._id, name: u.name, username: u.username };
  },
});

/** Presence heartbeat; the client calls this every minute while the tab is open. */
export const heartbeat = viewerMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.viewer._id, { lastActiveAt: Date.now() });
  },
});

/** Contacts → Options → "Turn off / on active status". */
export const setActiveStatus = viewerMutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    await ctx.db.patch(ctx.viewer._id, { activeStatusOff: on ? undefined : true });
  },
});
