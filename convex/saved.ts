import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { type Audience, canView, loadAudience, isSaved as savedState } from "./lib/posts";
import { getSummary } from "./lib/users";

const kind = v.union(v.literal("post"), v.literal("listing"), v.literal("event"));

/** Facebook files new saves under "For later" until you pick another collection. */
export const DEFAULT_COLLECTION = "For later";

async function forLater(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("savedCollections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const hit = rows.find((c) => c.name === DEFAULT_COLLECTION);
  if (hit) return hit._id;
  return ctx.db.insert("savedCollections", {
    userId,
    name: DEFAULT_COLLECTION,
    createdAt: Date.now(),
  });
}

async function ownCollection(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  collectionId: Id<"savedCollections">,
) {
  const c = await ctx.db.get(collectionId);
  if (!c || c.userId !== viewerId) throw new ConvexError("Collection not found");
  return c;
}

async function ownItem(ctx: QueryCtx, viewerId: Id<"users">, itemId: Id<"saved">) {
  const row = await ctx.db.get(itemId);
  if (!row || row.userId !== viewerId) throw new ConvexError("Saved item not found");
  return row;
}

function cleanName(name: string) {
  const n = name.trim().slice(0, 100);
  if (!n) throw new ConvexError("Give your collection a name");
  return n;
}

/** Save or unsave a post, listing or event. Returns the new saved state. */
export const toggle = viewerMutation({
  args: { kind, refId: v.string() },
  handler: async (ctx, { kind, refId }) => {
    const existing = await ctx.db
      .query("saved")
      .withIndex("by_user_ref", (q) =>
        q.eq("userId", ctx.viewer._id).eq("kind", kind).eq("refId", refId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("saved", {
      userId: ctx.viewer._id,
      kind,
      refId,
      collectionId: await forLater(ctx, ctx.viewer._id),
      createdAt: Date.now(),
    });
    return true;
  },
});

export const isSaved = viewerQuery({
  args: { kind, refId: v.string() },
  handler: async (ctx, { kind, refId }) => savedState(ctx, ctx.viewer._id, kind, refId),
});

export type SavedItem = {
  _id: Id<"saved">;
  kind: "post" | "listing" | "event";
  refId: string;
  savedAt: number;
  title: string;
  /** "Post", "Marketplace listing" or "Event", shown under the title. */
  typeLabel: string;
  thumbnail: string | null;
  /** "Saved from <name>'s post" style attribution. */
  fromName: string | null;
  fromAvatar: string | null;
  link: { to: string; params: Record<string, string> };
  /** Path for "Copy link". */
  href: string;
  collection: { _id: Id<"savedCollections">; name: string } | null;
};

type Resolved = Omit<SavedItem, "collection">;

/** A saved row resolved for display, or null when its target is gone or hidden. */
async function resolve(ctx: QueryCtx, row: Doc<"saved">, a: Audience): Promise<Resolved | null> {
  const base = { _id: row._id, kind: row.kind, refId: row.refId, savedAt: row.createdAt };
  if (row.kind === "post") {
    const post = await ctx.db.get(row.refId as Id<"posts">);
    if (!post || !(await canView(ctx, post, a))) return null;
    const author = await getSummary(ctx, post.authorId);
    if (!author) return null;
    const link = post.attachments.find((x) => x.kind === "link");
    return {
      ...base,
      title: post.text?.split("\n")[0]?.slice(0, 300) || link?.title || `${author.name}'s post`,
      typeLabel: post.media.some((m) => m.kind === "video") ? "Video" : "Post",
      thumbnail: post.media.find((m) => m.kind === "image")?.url ?? link?.image ?? author.avatar,
      fromName: author.name,
      fromAvatar: author.avatar,
      link: {
        to: "/$username/posts/$postId",
        params: { username: author.username, postId: post._id },
      },
      href: `/${author.username}/posts/${post._id}`,
    };
  }
  if (row.kind === "listing") {
    const l = await ctx.db.get(row.refId as Id<"listings">);
    if (!l) return null;
    const seller = await getSummary(ctx, l.sellerId);
    return {
      ...base,
      title: l.title,
      typeLabel: "Marketplace listing",
      thumbnail: l.photos[0] ?? null,
      fromName: seller?.name ?? null,
      fromAvatar: seller?.avatar ?? null,
      link: { to: "/marketplace/item/$listingId", params: { listingId: l._id } },
      href: `/marketplace/item/${l._id}`,
    };
  }
  const e = await ctx.db.get(row.refId as Id<"events">);
  if (!e) return null;
  const host = await getSummary(ctx, e.hostId);
  return {
    ...base,
    title: e.title,
    typeLabel: "Event",
    thumbnail: e.cover,
    fromName: host?.name ?? null,
    fromAvatar: host?.avatar ?? null,
    link: { to: "/events/$eventId", params: { eventId: e._id } },
    href: `/events/${e._id}`,
  };
}

/** Everything the viewer saved (optionally one collection), newest first. */
export const list = viewerQuery({
  args: { kind: v.optional(kind), collectionId: v.optional(v.id("savedCollections")) },
  handler: async (ctx, args) => {
    const { collectionId } = args;
    if (collectionId) await ownCollection(ctx, ctx.viewer._id, collectionId);
    const rows = collectionId
      ? await ctx.db
          .query("saved")
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .order("desc")
          .collect()
      : await ctx.db
          .query("saved")
          .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
          .order("desc")
          .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    const names = new Map<Id<"savedCollections">, string>();
    const items: SavedItem[] = [];
    for (const row of rows) {
      if (args.kind && row.kind !== args.kind) continue;
      const item = await resolve(ctx, row, a);
      if (!item) continue;
      let collection: SavedItem["collection"] = null;
      if (row.collectionId) {
        let name = names.get(row.collectionId);
        if (name === undefined) {
          name = (await ctx.db.get(row.collectionId))?.name ?? "";
          names.set(row.collectionId, name);
        }
        if (name) collection = { _id: row.collectionId, name };
      }
      items.push({ ...item, collection });
    }
    return items;
  },
});

export type SavedCollection = {
  _id: Id<"savedCollections">;
  name: string;
  /** The newest item's picture, as Facebook uses for the collection tile. */
  cover: string | null;
  count: number;
};

/** The viewer's collections (Saved → My collections), oldest first. */
export const collections = viewerQuery({
  args: {},
  handler: async (ctx): Promise<SavedCollection[]> => {
    const rows = await ctx.db
      .query("savedCollections")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    return Promise.all(
      rows.map(async (c) => {
        const items = await ctx.db
          .query("saved")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .order("desc")
          .collect();
        let cover: string | null = null;
        let count = 0;
        for (const row of items) {
          const item = await resolve(ctx, row, a);
          if (!item) continue;
          count++;
          cover ??= item.thumbnail;
        }
        return { _id: c._id, name: c.name, cover, count };
      }),
    );
  },
});

/** "Create new collection"; optionally files `itemId` straight into it. */
export const createCollection = viewerMutation({
  args: { name: v.string(), itemId: v.optional(v.id("saved")) },
  handler: async (ctx, { name, itemId }) => {
    const id = await ctx.db.insert("savedCollections", {
      userId: ctx.viewer._id,
      name: cleanName(name),
      createdAt: Date.now(),
    });
    if (itemId) {
      await ownItem(ctx, ctx.viewer._id, itemId);
      await ctx.db.patch(itemId, { collectionId: id });
    }
    return id;
  },
});

export const renameCollection = viewerMutation({
  args: { collectionId: v.id("savedCollections"), name: v.string() },
  handler: async (ctx, { collectionId, name }) => {
    await ownCollection(ctx, ctx.viewer._id, collectionId);
    await ctx.db.patch(collectionId, { name: cleanName(name) });
  },
});

/**
 * Deletes the collection. Its items stay saved and move to "For later"
 * (or to no collection when "For later" itself is deleted).
 */
export const deleteCollection = viewerMutation({
  args: { collectionId: v.id("savedCollections") },
  handler: async (ctx, { collectionId }) => {
    const c = await ownCollection(ctx, ctx.viewer._id, collectionId);
    const items = await ctx.db
      .query("saved")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    const fallback =
      c.name === DEFAULT_COLLECTION || items.length === 0
        ? undefined
        : await forLater(ctx, ctx.viewer._id);
    for (const row of items) await ctx.db.patch(row._id, { collectionId: fallback });
    await ctx.db.delete(collectionId);
  },
});

/** "Add to collection": an item lives in one collection at a time. */
export const moveToCollection = viewerMutation({
  args: { itemId: v.id("saved"), collectionId: v.id("savedCollections") },
  handler: async (ctx, { itemId, collectionId }) => {
    await ownItem(ctx, ctx.viewer._id, itemId);
    await ownCollection(ctx, ctx.viewer._id, collectionId);
    await ctx.db.patch(itemId, { collectionId });
  },
});
