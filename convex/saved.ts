import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { canView, loadAudience, isSaved as savedState } from "./lib/posts";
import { getSummary } from "./lib/users";

const kind = v.union(v.literal("post"), v.literal("listing"), v.literal("event"));

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
};

/** Everything the viewer saved, newest first, resolved for the Saved page. */
export const list = viewerQuery({
  args: { kind: v.optional(kind) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("saved")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    const items: SavedItem[] = [];
    for (const row of rows) {
      if (args.kind && row.kind !== args.kind) continue;
      const base = { _id: row._id, kind: row.kind, refId: row.refId, savedAt: row.createdAt };
      if (row.kind === "post") {
        const post = await ctx.db.get(row.refId as Id<"posts">);
        if (!post || !(await canView(ctx, post, a))) continue;
        const author = await getSummary(ctx, post.authorId);
        if (!author) continue;
        const link = post.attachments.find((x) => x.kind === "link");
        items.push({
          ...base,
          title: post.text?.split("\n")[0]?.slice(0, 120) || link?.title || `${author.name}'s post`,
          typeLabel: post.media.some((m) => m.kind === "video") ? "Video" : "Post",
          thumbnail:
            post.media.find((m) => m.kind === "image")?.url ?? link?.image ?? author.avatar,
          fromName: author.name,
          fromAvatar: author.avatar,
          link: {
            to: "/$username/posts/$postId",
            params: { username: author.username, postId: post._id },
          },
        });
      } else if (row.kind === "listing") {
        const l = await ctx.db.get(row.refId as Id<"listings">);
        if (!l) continue;
        const seller = await getSummary(ctx, l.sellerId);
        items.push({
          ...base,
          title: l.title,
          typeLabel: "Marketplace listing",
          thumbnail: l.photos[0] ?? null,
          fromName: seller?.name ?? null,
          fromAvatar: seller?.avatar ?? null,
          link: { to: "/marketplace/item/$listingId", params: { listingId: l._id } },
        });
      } else {
        const e = await ctx.db.get(row.refId as Id<"events">);
        if (!e) continue;
        const host = await getSummary(ctx, e.hostId);
        items.push({
          ...base,
          title: e.title,
          typeLabel: "Event",
          thumbnail: e.cover,
          fromName: host?.name ?? null,
          fromAvatar: host?.avatar ?? null,
          link: { to: "/events/$eventId", params: { eventId: e._id } },
        });
      }
    }
    return items;
  },
});
