import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mergedStream, type QueryStream, stream } from "convex-helpers/server/stream";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerQuery } from "./lib/functions";
import { type Audience, canView, enrichPosts, groupChip, loadAudience } from "./lib/posts";
import { getSummaries, type UserSummary, userSummary } from "./lib/users";
import schema from "./schema";

type Source = { authors: Id<"users">[]; groups: Id<"groups">[]; ownWall: boolean };

/**
 * Merge per-author and per-group index streams into one newest-first stream.
 * Group posts only come from group streams so nothing appears twice. Ads are
 * not organic posts: Home places them itself (`ads`).
 */
function feedStream(ctx: QueryCtx, a: Audience, src: Source) {
  const s = stream(ctx.db, schema);
  const streams: QueryStream<Doc<"posts">>[] = [];
  for (const authorId of src.authors)
    streams.push(
      s
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .order("desc")
        .filterWith(
          async (p) => !p.groupId && !p.eventId && !p.sponsored && (await canView(ctx, p, a)),
        ),
    );
  for (const groupId of src.groups)
    streams.push(
      s
        .query("posts")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .order("desc")
        .filterWith(async (p) => !p.sponsored),
    );
  if (src.ownWall)
    streams.push(
      s
        .query("posts")
        .withIndex("by_timeline", (q) => q.eq("timelineUserId", a.viewerId))
        .order("desc")
        .filterWith(
          async (p) => p.authorId !== a.viewerId && !a.friends.has(p.authorId) && !p.sponsored,
        ),
    );
  return mergedStream(streams, ["createdAt"]);
}

const emptyPage = { page: [], isDone: true, continueCursor: "" };

/** Pages the viewer follows (Follow / Like on a Page). */
async function followedPages(ctx: QueryCtx, a: Audience) {
  const rows = await ctx.db
    .query("follows")
    .withIndex("by_user", (q) => q.eq("userId", a.viewerId))
    .collect();
  return rows.map((r) => r.targetId).filter((id) => !a.friends.has(id));
}

/** Home News Feed: friends, followed Pages, joined groups and the viewer, newest first. */
export const home = viewerQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const result = await feedStream(ctx, a, {
      authors: [a.viewerId, ...a.friends, ...(await followedPages(ctx, a))],
      groups: [...a.groups],
      ownWall: true,
    }).paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/** Sponsored Page posts for the Home feed, newest first. Home slots one in every few posts. */
export const ads = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const ads = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(async (p) => p.sponsored === true && (await canView(ctx, p, a)))
      .take(12);
    return enrichPosts(ctx, ads, a);
  },
});

/**
 * The Home "Reels" shelf: the newest public photo posts (the seed world has
 * no video files, so photos stand in for reels, as on /reel). Each tile opens
 * `/reel/<postId>`. Plays are not tracked, so the view count is derived from
 * the post's engagement.
 */
export const reelsShelf = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const posts = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filterWith(
        async (p) =>
          !p.groupId &&
          !p.eventId &&
          !p.sponsored &&
          p.media.some((m) => m.kind === "image") &&
          (await canView(ctx, p, a)),
      )
      .take(16);
    const seen = new Set<string>();
    return posts
      .flatMap((p) => {
        const photo = p.media.find((m) => m.kind === "image");
        if (!photo || seen.has(photo.url)) return [];
        seen.add(photo.url);
        return [
          {
            _id: p._id,
            image: photo.url,
            alt: photo.alt ?? null,
            views: 180 + p.reactionCount * 43 + p.commentCount * 97 + p.shareCount * 211,
          },
        ];
      })
      .slice(0, 8);
  },
});

export const feedFilter = v.union(
  v.literal("all"),
  v.literal("favorites"),
  v.literal("friends"),
  v.literal("groups"),
  v.literal("pages"),
);

/** The Feeds page: most recent posts, optionally narrowed to one source. */
export const recent = viewerQuery({
  args: { filter: feedFilter, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { filter, paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    // Favorites are chosen by the person; this clone has no favorites list yet.
    if (filter === "favorites") return emptyPage;
    const friendDocs = await getSummaries(ctx, [...a.friends]);
    const people = [...friendDocs.values()].filter((u) => u.kind === "person").map((u) => u._id);
    const pages = [
      ...[...friendDocs.values()].filter((u) => u.kind === "page").map((u) => u._id),
      ...(await followedPages(ctx, a)),
    ];
    const src: Source =
      filter === "friends"
        ? { authors: people, groups: [], ownWall: false }
        : filter === "pages"
          ? { authors: pages, groups: [], ownWall: false }
          : filter === "groups"
            ? { authors: [], groups: [...a.groups], ownWall: false }
            : { authors: [a.viewerId, ...people, ...pages], groups: [...a.groups], ownWall: true };
    if (src.authors.length === 0 && src.groups.length === 0) return emptyPage;
    const result = await feedStream(ctx, a, src).paginate(paginationOpts);
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/** Data for the Home rails: shortcuts (groups), birthdays, contacts, group chats, sponsored. */
export const rails = viewerQuery({
  args: { today: v.string() /* "MM-DD" in the viewer's timezone */ },
  handler: async (ctx, { today }) => {
    const viewerId = ctx.viewer._id;
    const [friendRows, memberRows, convRows] = await Promise.all([
      ctx.db
        .query("friendships")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
      ctx.db
        .query("conversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .order("desc")
        .take(50),
    ]);

    const friendDocs = (await Promise.all(friendRows.map((r) => ctx.db.get(r.friendId)))).filter(
      (u): u is Doc<"users"> => u !== null,
    );
    const people = friendDocs.filter((u) => (u.kind ?? "person") === "person");
    const contacts = people
      .map(userSummary)
      .sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
    const birthdays = people.filter((u) => u.birthday === today).map(userSummary);

    const groups = (
      await Promise.all(
        [...memberRows]
          .sort((x, y) => (y.lastVisitedAt ?? y.joinedAt) - (x.lastVisitedAt ?? x.joinedAt))
          .map((m) => groupChip(ctx, m.groupId)),
      )
    ).filter((g) => g !== null);

    const groupChats: {
      _id: Id<"conversations">;
      title: string;
      photo: string | null;
      members: UserSummary[];
    }[] = [];
    for (const row of convRows) {
      const c = await ctx.db.get(row.conversationId);
      if (c?.kind !== "group") continue;
      const others = c.memberIds.filter((id) => id !== viewerId);
      const members = [...(await getSummaries(ctx, others.slice(0, 2))).values()];
      groupChats.push({
        _id: c._id,
        title: c.title ?? members.map((m) => m.firstName).join(", "),
        photo: c.photo ?? null,
        members,
      });
    }

    return { contacts, birthdays, groups, groupChats, sponsored: await sponsored(ctx, viewerId) };
  },
});

/** Two Page posts with media stand in for ads in the Sponsored slot (feed ads excluded). */
async function sponsored(ctx: QueryCtx, viewerId: Id<"users">) {
  const recent = await ctx.db.query("posts").withIndex("by_created").order("desc").take(300);
  const out: {
    postId: Id<"posts">;
    image: string;
    title: string;
    domain: string;
    page: UserSummary;
  }[] = [];
  const seen = new Set<Id<"users">>();
  for (const p of recent) {
    if (out.length === 2) break;
    if (p.groupId || p.sponsored || p.authorId === viewerId || seen.has(p.authorId)) continue;
    const link = p.attachments.find((x) => x.kind === "link");
    const image = link?.image ?? p.media.find((m) => m.kind === "image")?.url;
    if (!image) continue;
    const author = await ctx.db.get(p.authorId);
    if (author?.kind !== "page") continue;
    seen.add(author._id);
    out.push({
      postId: p._id,
      image,
      title: link?.title ?? author.name,
      domain: link?.domain ?? `facebook.com/${author.username}`,
      page: userSummary(author),
    });
  }
  return out;
}
