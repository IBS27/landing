import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { areFriends, getSummaries, type UserSummary } from "./lib/users";
import type { ReactionType } from "./validators";

/**
 * Where clicking a notification goes. The client turns this into a route
 * (or opens the conversation in the chat dock).
 */
export type NotificationTarget =
  | { kind: "post"; username: string; postId: Id<"posts">; commentId: Id<"comments"> | null }
  | { kind: "profile"; username: string }
  | { kind: "group"; slug: string }
  | { kind: "event"; eventId: Id<"events"> }
  | { kind: "listing"; listingId: Id<"listings"> }
  | { kind: "conversation"; conversationId: Id<"conversations"> }
  /** A Landing page: Landing Inbox, or Crew & Journeys for the check-in. */
  | { kind: "landing"; to: "/landing/inbox" | "/landing/crew/journeys" }
  | { kind: "none" };

export type NotificationView = {
  _id: Id<"notifications">;
  kind: Doc<"notifications">["kind"];
  text: string;
  createdAt: number;
  read: boolean;
  actor: UserSummary | null;
  /** Image shown when there is no actor (event cover, the viewer for memories). */
  image: string | null;
  /** Names rendered in bold inside `text` (group, event or listing title). */
  emphasis: string[];
  /** The actor's reaction, for the reaction badge. */
  reaction: ReactionType | null;
  /** Friend request state for inline Confirm / Delete. */
  request: "pending" | "accepted" | "removed" | null;
  target: NotificationTarget;
};

const DEFAULT_LIMIT = 30;

/** Notifications about the viewer themselves, shown with their own photo. */
const LANDING_OR_MEMORY = new Set<Doc<"notifications">["kind"]>([
  "memory",
  "landing_check_in",
  "landing_drafts",
]);

async function enrich(
  ctx: QueryCtx,
  viewer: Doc<"users">,
  rows: Doc<"notifications">[],
): Promise<NotificationView[]> {
  const actors = await getSummaries(
    ctx,
    rows.flatMap((n) => (n.actorId ? [n.actorId] : [])),
  );
  return Promise.all(
    rows.map(async (n): Promise<NotificationView> => {
      const actor = n.actorId ? (actors.get(n.actorId) ?? null) : null;
      const [post, group, event, listing] = await Promise.all([
        n.postId ? ctx.db.get(n.postId) : null,
        n.groupId ? ctx.db.get(n.groupId) : null,
        n.eventId ? ctx.db.get(n.eventId) : null,
        n.listingId ? ctx.db.get(n.listingId) : null,
      ]);
      const postAuthor = post ? await ctx.db.get(post.authorId) : null;

      let reaction: ReactionType | null = null;
      if (n.kind === "reaction" && n.actorId) {
        const [targetType, targetId] = n.commentId
          ? (["comment", n.commentId] as const)
          : (["post", n.postId ?? ""] as const);
        const actorId = n.actorId;
        const r = await ctx.db
          .query("reactions")
          .withIndex("by_target_user", (q) =>
            q.eq("targetType", targetType).eq("targetId", targetId).eq("userId", actorId),
          )
          .first();
        reaction = r?.type ?? "like";
      }

      let request: NotificationView["request"] = null;
      if (n.kind === "friend_request" && n.actorId) {
        const actorId = n.actorId;
        const pending = await ctx.db
          .query("friendRequests")
          .withIndex("by_pair", (q) => q.eq("fromId", actorId).eq("toId", viewer._id))
          .first();
        request = pending
          ? "pending"
          : (await areFriends(ctx, viewer._id, actorId))
            ? "accepted"
            : "removed";
      }

      let target: NotificationTarget = { kind: "none" };
      if (n.kind === "landing_drafts") target = { kind: "landing", to: "/landing/inbox" };
      else if (n.kind === "landing_check_in")
        target = { kind: "landing", to: "/landing/crew/journeys" };
      else if (n.kind === "listing_message" && n.conversationId)
        target = { kind: "conversation", conversationId: n.conversationId };
      else if (post && postAuthor)
        target = {
          kind: "post",
          username: postAuthor.username,
          postId: post._id,
          commentId: n.commentId ?? null,
        };
      else if (event) target = { kind: "event", eventId: event._id };
      else if (listing) target = { kind: "listing", listingId: listing._id };
      else if (group) target = { kind: "group", slug: group.slug };
      else if (actor) target = { kind: "profile", username: actor.username };

      const emphasis = [group?.name, event?.title, listing?.title].filter(
        (s): s is string => !!s && n.text.includes(s),
      );
      return {
        _id: n._id,
        kind: n.kind,
        text: n.text,
        createdAt: n.createdAt,
        read: n.read,
        actor,
        image: actor
          ? null
          : (event?.cover ?? (LANDING_OR_MEMORY.has(n.kind) ? viewer.avatar : null)),
        emphasis,
        reaction,
        request,
        target,
      };
    }),
  );
}

/**
 * When the viewer last opened Notifications. Before the first open, the newest
 * notification already flagged `seen` (seed data) stands in for it.
 */
async function seenAt(ctx: QueryCtx, viewer: Doc<"users">): Promise<number> {
  if (viewer.notificationsSeenAt !== undefined) return viewer.notificationsSeenAt;
  const lastSeen = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", viewer._id))
    .order("desc")
    .filter((f) => f.eq(f.field("seen"), true))
    .first();
  return lastSeen?.createdAt ?? 0;
}

/**
 * Newest notifications for the bell dropdown and the Notifications page.
 * `seenAt` is when the panel was last opened: newer items go under "New".
 */
export const list = viewerQuery({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { unreadOnly, limit }) => {
    const n = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), 200);
    const q = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc");
    const rows = unreadOnly
      ? await q.filter((f) => f.eq(f.field("read"), false)).take(n + 1)
      : await q.take(n + 1);
    return {
      items: await enrich(ctx, ctx.viewer, rows.slice(0, n)),
      hasMore: rows.length > n,
      seenAt: await seenAt(ctx, ctx.viewer),
    };
  },
});

/** The red badge on the bell: notifications that arrived since Notifications was last opened. */
export const unseenCount = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const since = await seenAt(ctx, ctx.viewer);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id).gt("createdAt", since))
      .take(100);
    return rows.length;
  },
});

/** Opening the dropdown or page clears the badge (but leaves items unread). */
export const markAllSeen = viewerMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.viewer._id, { notificationsSeenAt: Date.now() });
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_unseen", (q) => q.eq("userId", ctx.viewer._id).eq("seen", false))
      .collect();
    for (const r of rows) await ctx.db.patch(r._id, { seen: true });
  },
});

export const markAllRead = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .filter((f) => f.eq(f.field("read"), false))
      .collect();
    for (const r of rows) await ctx.db.patch(r._id, { read: true, seen: true });
  },
});

async function own(ctx: MutationCtx, viewerId: Id<"users">, id: Id<"notifications">) {
  const n = await ctx.db.get(id);
  if (!n || n.userId !== viewerId) throw new ConvexError("Notification not found");
  return n;
}

export const setRead = viewerMutation({
  args: { id: v.id("notifications"), read: v.boolean() },
  handler: async (ctx, { id, read }) => {
    await own(ctx, ctx.viewer._id, id);
    await ctx.db.patch(id, { read, seen: true });
  },
});

export const remove = viewerMutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await own(ctx, ctx.viewer._id, id);
    await ctx.db.delete(id);
  },
});
