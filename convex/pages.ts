import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { userSummary } from "./lib/users";

/** Pages directory (Discover / Followed / Your Pages) and Page follows. */

async function allPages(ctx: QueryCtx) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_persona", (q) => q.eq("isPersona", false))
    .collect();
  return users.filter((u) => u.kind === "page");
}

async function followerTotal(ctx: QueryCtx, page: Doc<"users">) {
  const rows = await ctx.db
    .query("follows")
    .withIndex("by_target", (q) => q.eq("targetId", page._id))
    .collect();
  return (page.followerCount ?? 0) + rows.length;
}

function pageCard(page: Doc<"users">, followers: number, following: boolean) {
  return {
    ...userSummary(page),
    category: page.pageCategory ?? "Page",
    bio: page.bio ?? null,
    cover: page.cover ?? null,
    followers,
    following,
    ownerId: page.pageOwnerId ?? null,
  };
}
export type PageCard = ReturnType<typeof pageCard>;

export const directory = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const [pages, mine] = await Promise.all([
      allPages(ctx),
      ctx.db
        .query("follows")
        .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
        .collect(),
    ]);
    const followed = new Set<Id<"users">>(mine.map((f) => f.targetId));
    const cards = await Promise.all(
      pages.map(async (p) => pageCard(p, await followerTotal(ctx, p), followed.has(p._id))),
    );
    cards.sort((a, b) => b.followers - a.followers);
    return {
      yours: cards.filter((c) => c.ownerId === ctx.viewer._id),
      discover: cards.filter((c) => c.ownerId !== ctx.viewer._id),
      followed: cards.filter((c) => c.following),
    };
  },
});

export const toggleFollow = viewerMutation({
  args: { pageId: v.id("users") },
  handler: async (ctx, { pageId }) => {
    if (pageId === ctx.viewer._id) throw new ConvexError("You can't follow yourself");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("userId", ctx.viewer._id).eq("targetId", pageId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("follows", {
      userId: ctx.viewer._id,
      targetId: pageId,
      createdAt: Date.now(),
    });
    return true;
  },
});

const PAGE_COLORS = ["#1877F2", "#F02849", "#45BD62", "#F7B928", "#9360F7", "#FB724B"];

/** A simple letter mark for Pages created without a photo. */
function letterAvatar(name: string) {
  const color = PAGE_COLORS[name.length % PAGE_COLORS.length];
  const letter = (name.trim()[0] ?? "P").toUpperCase().replace(/[<>&"']/g, "P");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${color}"/><text x="80" y="104" font-family="Helvetica,Arial,sans-serif" font-size="80" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) || "page"
  );
}

export const create = viewerMutation({
  args: { name: v.string(), category: v.string(), bio: v.optional(v.string()) },
  handler: async (ctx, { name, category, bio }) => {
    const clean = name.trim();
    if (clean.length < 2) throw new ConvexError("Page name is too short");
    const base = slugify(clean);
    let username = base;
    for (
      let i = 2;
      await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      i++
    )
      username = `${base}${i}`;
    const now = Date.now();
    const id = await ctx.db.insert("users", {
      name: clean,
      firstName: clean,
      username,
      avatar: letterAvatar(clean),
      bio: bio?.trim() || undefined,
      verified: false,
      joinedAt: now,
      lastActiveAt: now,
      isPersona: false,
      kind: "page",
      pageCategory: category.trim() || "Page",
      followerCount: 0,
      pageOwnerId: ctx.viewer._id,
    });
    return { id, username };
  },
});

/** Everyone (Pages or people) the viewer follows, for Follow buttons outside the directory. */
export const followingIds = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    return rows.map((r) => r.targetId);
  },
});
