import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { dmBlockNotice } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  canCommentOn,
  canPostOnProfile,
  getSettings,
  LANGUAGES,
  PREFS,
  settingsRow,
  visibleDetails,
} from "./lib/settings";
import { friendIds, userSummary } from "./lib/users";
import {
  friendRequestAudience,
  friendsListAudience,
  notificationCategory,
  privacy,
} from "./validators";

/* ---------------- Settings ---------------- */

/** The viewer's Settings & privacy choices, defaults filled in. */
export const get = viewerQuery({
  args: {},
  handler: (ctx) => getSettings(ctx, ctx.viewer._id),
});

type SettingsPatch = Partial<Omit<Doc<"userSettings">, "_id" | "_creationTime" | "userId">>;

async function save(ctx: MutationCtx, userId: Id<"users">, patch: SettingsPatch) {
  const row = await settingsRow(ctx, userId);
  const updatedAt = Date.now();
  if (row) await ctx.db.patch(row._id, { ...patch, updatedAt });
  else await ctx.db.insert("userSettings", { userId, ...patch, updatedAt });
}

/** Typed settings that change how the app behaves. */
export const update = viewerMutation({
  args: {
    defaultAudience: v.optional(privacy),
    friendRequests: v.optional(friendRequestAudience),
    friendsList: v.optional(friendsListAudience),
    hideReactionCountsOthers: v.optional(v.boolean()),
    hideReactionCountsOwn: v.optional(v.boolean()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, patch) => {
    if (patch.language !== undefined && !(LANGUAGES as readonly string[]).includes(patch.language))
      throw new ConvexError("Choose a language from the list");
    await save(ctx, ctx.viewer._id, patch);
  },
});

/** "Allow notifications on Facebook" for one notification category. */
export const setNotification = viewerMutation({
  args: { category: notificationCategory, on: v.boolean() },
  handler: async (ctx, { category, on }) => {
    const current = (await settingsRow(ctx, ctx.viewer._id))?.notificationsOff ?? [];
    const rest = current.filter((c) => c !== category);
    await save(ctx, ctx.viewer._id, { notificationsOff: on ? rest : [...rest, category] });
  },
});

/** A display-only preference (see `PREFS`). */
export const setPref = viewerMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const p = PREFS[key];
    if (!p?.options.includes(value)) throw new ConvexError("Unknown setting");
    const prefs = (await settingsRow(ctx, ctx.viewer._id))?.prefs ?? {};
    await save(ctx, ctx.viewer._id, { prefs: { ...prefs, [key]: value } });
  },
});

/* ---------------- Enforced privacy ---------------- */

/** Whether the viewer may write on `userId`'s profile ("Who can post on your profile?"). */
export const canPostOnTimeline = viewerQuery({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => canPostOnProfile(ctx, userId, ctx.viewer._id),
});

/**
 * The author's name when they limited who can comment on this post and the
 * viewer isn't included ("Who can comment on your public posts?"); else null.
 */
export const commentRestriction = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || (await canCommentOn(ctx, post, ctx.viewer._id))) return null;
    return (await ctx.db.get(post.authorId))?.name ?? null;
  },
});

/* ---------------- Blocking ---------------- */

/** The viewer's blocked list, most recent first. */
export const blocked = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("blocks")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.blockedId);
      if (u) out.push({ ...userSummary(u), blockedAt: r.createdAt });
    }
    return out;
  },
});

/** "Block profiles" search: people and Pages by name, with whether each is already blocked. */
export const blockSearch = viewerQuery({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const term = q.trim();
    if (!term) return [];
    const viewerId = ctx.viewer._id;
    const [users, mine, friends] = await Promise.all([
      ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) => s.search("name", term))
        .take(20),
      ctx.db
        .query("blocks")
        .withIndex("by_user", (x) => x.eq("userId", viewerId))
        .collect(),
      friendIds(ctx, viewerId),
    ]);
    const blockedIds = new Set(mine.map((r) => r.blockedId));
    const friendSet = new Set(friends);
    return Promise.all(
      users
        .filter((u) => u._id !== viewerId)
        .map(async (u) => ({
          ...userSummary(u),
          // Respect the person's City audience, like every other profile surface.
          city: (await visibleDetails(ctx, u, viewerId, friendSet.has(u._id))).city,
          isFriend: friendSet.has(u._id),
          blocked: blockedIds.has(u._id),
        })),
    );
  },
});

/**
 * Block: also unfriends, withdraws friend requests and unfollows in both
 * directions, like Facebook.
 */
export const block = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    if (userId === viewerId) throw new ConvexError("You can't block yourself");
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("This person isn't available");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("blockedId", userId))
      .first();
    if (existing) return;
    await ctx.db.insert("blocks", { userId: viewerId, blockedId: userId, createdAt: Date.now() });

    for (const [a, b] of [
      [viewerId, userId],
      [userId, viewerId],
    ] as const) {
      const rows = await Promise.all([
        ctx.db
          .query("friendships")
          .withIndex("by_pair", (q) => q.eq("userId", a).eq("friendId", b))
          .collect(),
        ctx.db
          .query("follows")
          .withIndex("by_pair", (q) => q.eq("userId", a).eq("targetId", b))
          .collect(),
        ctx.db
          .query("friendRequests")
          .withIndex("by_pair", (q) => q.eq("fromId", a).eq("toId", b))
          .collect(),
      ]);
      for (const r of rows.flat()) await ctx.db.delete(r._id);
    }
  },
});

export const unblock = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("userId", ctx.viewer._id).eq("blockedId", userId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

/** The notice a 1:1 Messenger thread shows instead of sending, when blocked either way. */
export const threadBlock = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv?.memberIds.includes(ctx.viewer._id)) return null;
    return dmBlockNotice(ctx, conv, ctx.viewer._id);
  },
});
