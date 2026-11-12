import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { friendIds, getSummaries, type UserSummary } from "./lib/users";

const DAY = 24 * 60 * 60 * 1000;

export type StoryItem = {
  _id: Id<"stories">;
  media: Doc<"stories">["media"];
  text: string | null;
  background: string | null;
  createdAt: number;
};
export type StoryBucket = { author: UserSummary; stories: StoryItem[]; latestAt: number };

/**
 * The Home stories tray: the viewer's own active stories first, then friends'
 * (most recent first). Each bucket holds one person's stories, oldest first.
 */
export const tray = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const viewerId = ctx.viewer._id;
    const authors = [viewerId, ...(await friendIds(ctx, viewerId))];
    const perAuthor = await Promise.all(
      authors.map((id) =>
        ctx.db
          .query("stories")
          .withIndex("by_author", (q) => q.eq("authorId", id).gt("createdAt", now - DAY))
          .collect(),
      ),
    );
    const users = await getSummaries(ctx, authors);
    const buckets: StoryBucket[] = [];
    perAuthor.forEach((rows, i) => {
      const live = rows.filter((s) => s.expiresAt > now);
      const author = users.get(authors[i]);
      if (live.length === 0 || !author) return;
      buckets.push({
        author,
        latestAt: live[live.length - 1].createdAt,
        stories: live.map((s) => ({
          _id: s._id,
          media: s.media,
          text: s.text ?? null,
          background: s.background ?? null,
          createdAt: s.createdAt,
        })),
      });
    });
    const [mine, others] = [
      buckets.filter((b) => b.author._id === viewerId),
      buckets.filter((b) => b.author._id !== viewerId).sort((a, b) => b.latestAt - a.latestAt),
    ];
    return [...mine, ...others];
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
    if (s && s.authorId === ctx.viewer._id) await ctx.db.delete(storyId);
  },
});
