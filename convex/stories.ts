import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { blockedSet, isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { areFriends, friendIds, getSummaries, type UserSummary, userSummary } from "./lib/users";

const DAY = 24 * 60 * 60 * 1000;

export type StoryAudience = "public" | "friends" | "custom";

export type StoryItem = {
  _id: Id<"stories">;
  media: Doc<"stories">["media"];
  text: string | null;
  background: string | null;
  createdAt: number;
  /** The viewer has opened this story (always true for their own). */
  seen: boolean;
  /** Own stories only: how many people have seen it. */
  viewerCount: number | null;
};
export type StoryBucket = {
  author: UserSummary;
  stories: StoryItem[];
  latestAt: number;
  /** Every story in the bucket has been seen: the ring turns grey. */
  seen: boolean;
  audience: StoryAudience;
};

/** Whether `viewer` may see `author`'s stories under the author's story privacy. */
async function canSeeStories(ctx: QueryCtx, author: Doc<"users">, viewerId: Id<"users">) {
  if (author._id === viewerId) return true;
  if (await isBlockedEitherWay(ctx, author._id, viewerId)) return false;
  const audience = author.storyAudience ?? "friends";
  if (audience === "custom") return (author.storyAudienceIds ?? []).includes(viewerId);
  if (audience === "public") return true;
  return areFriends(ctx, author._id, viewerId);
}

async function seenSet(ctx: QueryCtx, storyIds: Id<"stories">[], viewerId: Id<"users">) {
  const rows = await Promise.all(
    storyIds.map((storyId) =>
      ctx.db
        .query("storyViews")
        .withIndex("by_story_viewer", (q) => q.eq("storyId", storyId).eq("viewerId", viewerId))
        .unique(),
    ),
  );
  return new Set(rows.filter((r) => r !== null).map((r) => r.storyId));
}

async function viewerCount(ctx: QueryCtx, storyId: Id<"stories">) {
  const rows = await ctx.db
    .query("storyViews")
    .withIndex("by_story", (q) => q.eq("storyId", storyId))
    .collect();
  return rows.length;
}

/** One person's stories (oldest first) as the viewer sees them. */
async function toBucket(
  ctx: QueryCtx,
  author: Doc<"users">,
  rows: Doc<"stories">[],
  viewerId: Id<"users">,
): Promise<StoryBucket> {
  const own = author._id === viewerId;
  const seen = own
    ? null
    : await seenSet(
        ctx,
        rows.map((s) => s._id),
        viewerId,
      );
  const counts = own ? await Promise.all(rows.map((s) => viewerCount(ctx, s._id))) : null;
  const stories = rows.map((s, i) => ({
    _id: s._id,
    media: s.media,
    text: s.text ?? null,
    background: s.background ?? null,
    createdAt: s.createdAt,
    seen: seen ? seen.has(s._id) : true,
    viewerCount: counts ? counts[i] : null,
  }));
  return {
    author: userSummary(author),
    stories,
    latestAt: rows[rows.length - 1].createdAt,
    seen: stories.every((s) => s.seen),
    audience: author.storyAudience ?? "friends",
  };
}

async function activeStories(ctx: QueryCtx, authorId: Id<"users">, now: number) {
  const rows = await ctx.db
    .query("stories")
    .withIndex("by_author", (q) => q.eq("authorId", authorId).gt("createdAt", now - DAY))
    .collect();
  return rows.filter((s) => s.expiresAt > now);
}

/**
 * The stories tray and viewer list: the viewer's own active stories first, then
 * friends' (most recent first), minus muted people and stories hidden by the
 * author's privacy. Each bucket holds one person's stories, oldest first.
 */
export const tray = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const viewerId = ctx.viewer._id;
    const hidden = new Set([
      ...(ctx.viewer.mutedStoryAuthorIds ?? []),
      ...(await blockedSet(ctx, viewerId)),
    ]);
    const friends = (await friendIds(ctx, viewerId)).filter((id) => !hidden.has(id));
    const buckets: StoryBucket[] = [];
    for (const id of [viewerId, ...friends]) {
      const rows = await activeStories(ctx, id, now);
      if (rows.length === 0) continue;
      const author = id === viewerId ? ctx.viewer : await ctx.db.get(id);
      if (!author || !(await canSeeStories(ctx, author, viewerId))) continue;
      buckets.push(await toBucket(ctx, author, rows, viewerId));
    }
    const [mine, others] = [
      buckets.filter((b) => b.author._id === viewerId),
      buckets.filter((b) => b.author._id !== viewerId).sort((a, b) => b.latestAt - a.latestAt),
    ];
    return [...mine, ...others];
  },
});

/**
 * A story by id for deep links: its author's bucket (active stories), or for
 * the author, their archived story. Null when it is gone or hidden.
 */
export const get = viewerQuery({
  args: { storyId: v.string() },
  handler: async (ctx, { storyId }) => {
    const id = ctx.db.normalizeId("stories", storyId);
    const story = id ? await ctx.db.get(id) : null;
    if (!story) return null;
    const viewerId = ctx.viewer._id;
    const now = Date.now();
    const author = await ctx.db.get(story.authorId);
    if (!author || !(await canSeeStories(ctx, author, viewerId))) return null;
    if (story.expiresAt <= now) {
      if (author._id !== viewerId) return null;
      return { archived: true as const, bucket: await toBucket(ctx, author, [story], viewerId) };
    }
    const rows = await activeStories(ctx, author._id, now);
    return { archived: false as const, bucket: await toBucket(ctx, author, rows, viewerId) };
  },
});

/** Text stories pass `background`; photo stories pass an uploaded `storageId`. */
export const create = viewerMutation({
  args: {
    text: v.optional(v.string()),
    background: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, { text, background, storageId, width, height }) => {
    const now = Date.now();
    const body = text?.trim() || undefined;
    let media: Doc<"stories">["media"];
    if (storageId) {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new ConvexError("Upload not found");
      media = { url, kind: "image", width, height };
    } else {
      if (!body) throw new ConvexError("Add some text to your story");
      // Text stories have no photo; the viewer renders `background` instead.
      media = { url: "", kind: "image" };
    }
    return ctx.db.insert("stories", {
      authorId: ctx.viewer._id,
      media,
      text: body,
      background: storageId ? undefined : (background ?? "blue"),
      createdAt: now,
      expiresAt: now + DAY,
    });
  },
});

export const remove = viewerMutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const s = await ctx.db.get(storyId);
    if (!s || s.authorId !== ctx.viewer._id) return;
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .collect();
    for (const r of views) await ctx.db.delete(r._id);
    await ctx.db.delete(storyId);
  },
});

/** Records that the viewer opened a story (once); the author never counts as a viewer. */
export const markSeen = viewerMutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const viewerId = ctx.viewer._id;
    const story = await ctx.db.get(storyId);
    if (!story || story.authorId === viewerId) return;
    const existing = await ctx.db
      .query("storyViews")
      .withIndex("by_story_viewer", (q) => q.eq("storyId", storyId).eq("viewerId", viewerId))
      .unique();
    if (!existing) await ctx.db.insert("storyViews", { storyId, viewerId, viewedAt: Date.now() });
  },
});

/** The author's "Story details": who viewed a story, most recent first. */
export const viewers = viewerQuery({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const story = await ctx.db.get(storyId);
    if (!story || story.authorId !== ctx.viewer._id) return [];
    const rows = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .order("desc")
      .collect();
    const users = await getSummaries(
      ctx,
      rows.map((r) => r.viewerId),
    );
    return rows.flatMap((r) => {
      const user = users.get(r.viewerId);
      return user ? [{ user, viewedAt: r.viewedAt }] : [];
    });
  },
});

/** Story archive: the viewer's expired stories, newest first. */
export const archive = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_author", (q) => q.eq("authorId", ctx.viewer._id))
      .order("desc")
      .collect();
    return rows
      .filter((s) => s.expiresAt <= now)
      .map((s) => ({
        _id: s._id,
        media: s.media,
        text: s.text ?? null,
        background: s.background ?? null,
        createdAt: s.createdAt,
      }));
  },
});

/** The viewer's 1:1 thread with `userId`, created on first use (mirrors messenger.getOrCreateDm). */
async function dmWith(ctx: MutationCtx, viewerId: Id<"users">, userId: Id<"users">) {
  const mine = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", viewerId))
    .collect();
  for (const m of mine) {
    const c = await ctx.db.get(m.conversationId);
    if (c?.kind === "dm" && c.memberIds.length === 2 && c.memberIds.includes(userId)) return c._id;
  }
  const now = Date.now();
  const memberIds = [viewerId, userId];
  const conversationId = await ctx.db.insert("conversations", {
    kind: "dm",
    memberIds,
    createdAt: now,
    lastMessageAt: now,
  });
  for (const id of memberIds)
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: id,
      lastReadAt: now,
      lastMessageAt: now,
    });
  return conversationId;
}

/**
 * "Reply…" and the quick reactions under a story: a Messenger message to the
 * author carrying a snapshot of the story.
 */
export const reply = viewerMutation({
  args: { storyId: v.id("stories"), text: v.string() },
  handler: async (ctx, { storyId, text }) => {
    const viewerId = ctx.viewer._id;
    const body = text.trim();
    if (!body) throw new ConvexError("Write a reply");
    const story = await ctx.db.get(storyId);
    if (!story || story.expiresAt <= Date.now()) throw new ConvexError("This story has expired");
    if (story.authorId === viewerId) throw new ConvexError("You can't reply to your own story");
    if (await isBlockedEitherWay(ctx, viewerId, story.authorId))
      throw new ConvexError("This person isn't available right now.");
    const author = await ctx.db.get(story.authorId);
    if (!author || !(await canSeeStories(ctx, author, viewerId)))
      throw new ConvexError("This story isn't available.");
    const conversationId = await dmWith(ctx, viewerId, story.authorId);
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId: viewerId,
      author: { kind: "human" },
      status: "sent",
      text: body,
      attachments: [
        {
          kind: "story",
          storyId,
          // The snapshot renders as an image, so a video story keeps its poster frame.
          url: (story.media.kind === "video" ? story.media.poster : story.media.url) || undefined,
          background: story.background,
          text: story.text,
        },
      ],
      createdAt: now,
    });
    await ctx.db.patch(conversationId, { lastMessageAt: now, lastMessageId: messageId });
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    for (const r of members)
      await ctx.db.patch(r._id, {
        lastMessageAt: now,
        archived: undefined,
        ...(r.userId === viewerId ? { lastReadAt: now } : {}),
      });
    return conversationId;
  },
});

/** "Mute <name>": hide someone's stories from the tray (and unmute from Settings). */
export const setMuted = viewerMutation({
  args: { authorId: v.id("users"), muted: v.boolean() },
  handler: async (ctx, { authorId, muted }) => {
    const current = (ctx.viewer.mutedStoryAuthorIds ?? []).filter((id) => id !== authorId);
    await ctx.db.patch(ctx.viewer._id, {
      mutedStoryAuthorIds: muted ? [...current, authorId] : current,
    });
  },
});

/** Story settings: the people whose stories the viewer muted. */
export const mutedAuthors = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const ids = ctx.viewer.mutedStoryAuthorIds ?? [];
    const users = await getSummaries(ctx, ids);
    return ids.flatMap((id) => users.get(id) ?? []);
  },
});

/** Story privacy: Public, Friends, or Custom (only the chosen friends). */
export const setPrivacy = viewerMutation({
  args: {
    audience: v.union(v.literal("public"), v.literal("friends"), v.literal("custom")),
    audienceIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { audience, audienceIds }) => {
    if (audience === "custom" && !audienceIds?.length)
      throw new ConvexError("Choose at least one friend");
    await ctx.db.patch(ctx.viewer._id, {
      storyAudience: audience,
      storyAudienceIds: audience === "custom" ? audienceIds : undefined,
    });
  },
});
