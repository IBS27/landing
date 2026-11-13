import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { activityLabel, externalPostsPerDay } from "./lib/groupActivity";
import { notify } from "./lib/notify";
import { canView, enrichPosts, eventVisible, loadAudience } from "./lib/posts";
import { visibleDetails } from "./lib/settings";
import { friendIds, getSummaries, type UserSummary, userSummary } from "./lib/users";

/**
 * Groups: discovery, membership, the group page (header, About, People,
 * Media, Events) and creation. Group posts live in `posts` (see posts.byGroup).
 */

const DAY = 24 * 60 * 60 * 1000;
type Role = Doc<"groupMembers">["role"];

/* ---------------- Helpers ---------------- */

/** Groups are addressed by slug in URLs; ids work too. */
async function resolveGroup(ctx: QueryCtx, idOrSlug: string) {
  const bySlug = await ctx.db
    .query("groups")
    .withIndex("by_slug", (q) => q.eq("slug", idOrSlug))
    .unique();
  if (bySlug) return bySlug;
  const id = ctx.db.normalizeId("groups", idOrSlug);
  return id ? ctx.db.get(id) : null;
}

async function membership(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users">) {
  return ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

async function requireGroup(ctx: QueryCtx, groupId: Id<"groups">) {
  const g = await ctx.db.get(groupId);
  if (!g) throw new ConvexError("Group not found");
  return g;
}

async function postStats(ctx: QueryCtx, g: Doc<"groups">) {
  const now = Date.now();
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const month = await ctx.db
    .query("posts")
    .withIndex("by_group", (q) => q.eq("groupId", g._id).gte("createdAt", now - 30 * DAY))
    .collect();
  const today = month.filter((p) => p.createdAt >= startOfDay).length;
  const ext = externalPostsPerDay(g);
  const latest = await ctx.db
    .query("posts")
    .withIndex("by_group", (q) => q.eq("groupId", g._id))
    .order("desc")
    .first();
  return {
    postsToday: today + Math.round(ext),
    postsLastMonth: month.length + Math.round(ext * 30),
    perDay: month.length / 30 + ext,
    lastActiveAt: Math.max(g.lastActivityAt, latest?.createdAt ?? 0, g.createdAt),
  };
}

async function groupMembers(ctx: QueryCtx, groupId: Id<"groups">) {
  return ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
}

/** Discover / joined card shape. */
async function groupCard(
  ctx: QueryCtx,
  g: Doc<"groups">,
  friends: Set<Id<"users">>,
  viewerId: Id<"users">,
) {
  const [members, stats] = await Promise.all([groupMembers(ctx, g._id), postStats(ctx, g)]);
  const friendRows = members.filter((m) => friends.has(m.userId));
  const sample = await getSummaries(
    ctx,
    friendRows.slice(0, 3).map((m) => m.userId),
  );
  return {
    _id: g._id,
    name: g.name,
    slug: g.slug,
    cover: g.cover,
    privacy: g.privacy,
    category: g.category,
    location: g.location ?? null,
    memberCount: g.memberCount,
    activity: activityLabel(stats.perDay),
    lastActiveAt: stats.lastActiveAt,
    friends: [...sample.values()],
    friendCount: friendRows.length,
    viewerJoined: members.some((m) => m.userId === viewerId),
  };
}
export type GroupCard = Awaited<ReturnType<typeof groupCard>>;

/** Pending invites to this group for the viewer (newest first). */
async function pendingInvites(ctx: QueryCtx, viewerId: Id<"users">, groupId?: Id<"groups">) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", viewerId))
    .order("desc")
    .take(300);
  return rows.filter((n) => n.kind === "group_invite" && (!groupId || n.groupId === groupId));
}

/** Friend status for member rows' "Add friend" buttons. */
async function relation(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  friends: Set<Id<"users">>,
  userId: Id<"users">,
): Promise<"self" | "friend" | "sent" | "received" | "none"> {
  if (userId === viewerId) return "self";
  if (friends.has(userId)) return "friend";
  const sent = await ctx.db
    .query("friendRequests")
    .withIndex("by_pair", (q) => q.eq("fromId", viewerId).eq("toId", userId))
    .first();
  if (sent) return "sent";
  const received = await ctx.db
    .query("friendRequests")
    .withIndex("by_pair", (q) => q.eq("fromId", userId).eq("toId", viewerId))
    .first();
  return received ? "received" : "none";
}

/** Groups this size and up show a "Top voices" section on the People tab. */
const TOP_VOICES_MIN_MEMBERS = 1000;

/**
 * Top voices: the group's most active members by posts and comments in the
 * group (at least 2 contributions, at most 10 people), keyed to their
 * contribution count.
 */
async function topVoices(ctx: QueryCtx, g: Doc<"groups">, memberIds: Id<"users">[]) {
  const out = new Map<Id<"users">, number>();
  if (g.memberCount < TOP_VOICES_MIN_MEMBERS) return out;
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_group", (q) => q.eq("groupId", g._id))
    .collect();
  const counts = new Map<Id<"users">, number>();
  const bump = (id: Id<"users">) => counts.set(id, (counts.get(id) ?? 0) + 1);
  const comments = await Promise.all(
    posts.map((p) =>
      ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect(),
    ),
  );
  for (const p of posts) bump(p.authorId);
  for (const list of comments) for (const c of list) bump(c.authorId);
  const ranked = memberIds
    .map((id) => [id, counts.get(id) ?? 0] as const)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  // Groups this size (1K+) list their ~10 most active contributors.
  const limit = 10;
  for (const [id, n] of ranked.slice(0, limit)) out.set(id, n);
  return out;
}

/* ---------------- Queries ---------------- */

/** Left rail + "Your groups": every group the viewer joined, most recently active first. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const out = await Promise.all(
      rows.map(async (m) => {
        const g = await ctx.db.get(m.groupId);
        if (!g) return null;
        const stats = await postStats(ctx, g);
        return {
          _id: g._id,
          name: g.name,
          slug: g.slug,
          cover: g.cover,
          privacy: g.privacy,
          role: m.role,
          joinedAt: m.joinedAt,
          lastVisitedAt: m.lastVisitedAt ?? null,
          lastActiveAt: stats.lastActiveAt,
        };
      }),
    );
    return out.filter((g) => g !== null).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  },
});

/**
 * Groups > Discover. Groups the viewer joined before `since` (page load) are
 * left out, so a card joined from this page stays put and shows "View group".
 */
export const discover = viewerQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const viewerId = ctx.viewer._id;
    const [all, myRows, friendList] = await Promise.all([
      ctx.db.query("groups").collect(),
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
      friendIds(ctx, viewerId),
    ]);
    const friends = new Set(friendList);
    const joinedBefore = new Set(myRows.filter((m) => m.joinedAt < since).map((m) => m.groupId));
    const candidates = all.filter((g) => g.visible && !joinedBefore.has(g._id));
    const cards = await Promise.all(candidates.map((g) => groupCard(ctx, g, friends, viewerId)));

    // Suggestions lean on topics the viewer already follows (then friends who
    // are members). The sections don't repeat each other's groups, as on Facebook.
    const myTags = new Set<string>();
    for (const m of myRows) {
      const g = all.find((x) => x._id === m.groupId);
      if (g) for (const t of [g.category, ...g.tags]) myTags.add(t.toLowerCase());
    }
    const topical = (id: Id<"groups">) => {
      const g = all.find((x) => x._id === id);
      return g ? [g.category, ...g.tags].filter((t) => myTags.has(t.toLowerCase())).length : 0;
    };
    const byMembers = [...cards].sort((a, b) => b.memberCount - a.memberCount);
    const suggested = [...cards]
      .sort(
        (a, b) =>
          topical(b._id) - topical(a._id) ||
          b.friendCount - a.friendCount ||
          b.lastActiveAt - a.lastActiveAt,
      )
      .slice(0, 4);
    const shown = new Set(suggested.map((c) => c._id));
    const city = ctx.viewer.city?.split(",")[0] ?? "San Francisco";
    const popular = byMembers
      .filter((c) => c.location?.includes(city) && !shown.has(c._id))
      .slice(0, 4);
    // The grid keeps going through every other candidate, skipping only the
    // cards the carousels open with (their off-screen cards repeat here, as on Facebook).
    const opening = new Set([...suggested.slice(0, 3), ...popular.slice(0, 3)].map((c) => c._id));
    const more = byMembers.filter((c) => !opening.has(c._id));
    return { suggested, popular, more, city };
  },
});

/** Rail search ("Search groups"). */
export const search = viewerQuery({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const term = q.trim();
    if (!term) return [];
    const rows = await ctx.db
      .query("groups")
      .withSearchIndex("search_name", (s) => s.search("name", term))
      .take(8);
    const mine = new Set(
      (
        await ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q2) => q2.eq("userId", ctx.viewer._id))
          .collect()
      ).map((m) => m.groupId),
    );
    return rows
      .filter((g) => g.visible || mine.has(g._id))
      .map((g) => ({
        _id: g._id,
        name: g.name,
        slug: g.slug,
        cover: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount,
        joined: mine.has(g._id),
      }));
  },
});

/** Everything the group header, Discussion sidebar and About tab need. */
export const get = viewerQuery({
  args: { idOrSlug: v.string() },
  handler: async (ctx, { idOrSlug }) => {
    const g = await resolveGroup(ctx, idOrSlug);
    if (!g) return null;
    const viewerId = ctx.viewer._id;
    const [members, friendList, stats, creator, invites] = await Promise.all([
      groupMembers(ctx, g._id),
      friendIds(ctx, viewerId),
      postStats(ctx, g),
      ctx.db.get(g.createdBy),
      pendingInvites(ctx, viewerId, g._id),
    ]);
    const friends = new Set(friendList);
    const me = members.find((m) => m.userId === viewerId) ?? null;
    const canSeePosts = g.privacy === "public" || me !== null;

    const staff = members
      .filter((m) => m.role !== "member")
      .sort((a, b) => (a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "admin" ? -1 : 1));
    const friendMembers = members.filter((m) => friends.has(m.userId));
    // Avatar stack: friends first, then the most recently joined members.
    const preview = [
      ...friendMembers,
      ...members.filter((m) => !friends.has(m.userId)).sort((a, b) => b.joinedAt - a.joinedAt),
    ].slice(0, 12);
    const summaries = await getSummaries(ctx, [
      ...preview.map((m) => m.userId),
      ...staff.map((m) => m.userId),
      ...friendMembers.slice(0, 3).map((m) => m.userId),
      ...invites.flatMap((n) => (n.actorId ? [n.actorId] : [])),
    ]);
    const weekAgo = Date.now() - 7 * DAY;
    const invite = invites[0];
    const inviter = invite?.actorId ? (summaries.get(invite.actorId) ?? null) : null;

    return {
      _id: g._id,
      name: g.name,
      slug: g.slug,
      cover: g.cover,
      privacy: g.privacy,
      visible: g.visible,
      description: g.description,
      category: g.category,
      location: g.location ?? null,
      rules: g.rules,
      tags: g.tags,
      createdAt: g.createdAt,
      memberCount: g.memberCount,
      creator: creator ? userSummary(creator) : null,
      viewerRole: (me?.role ?? null) as Role | null,
      canSeePosts,
      memberPreview: preview.flatMap((m) => summaries.get(m.userId) ?? []),
      friendCount: friendMembers.length,
      friendNames: friendMembers
        .slice(0, 3)
        .flatMap((m) => summaries.get(m.userId)?.firstName ?? []),
      staff: staff.flatMap((m) => {
        const u = summaries.get(m.userId);
        return u ? [{ ...u, role: m.role }] : [];
      }),
      invite: invite && inviter && !me ? { from: inviter, at: invite.createdAt } : null,
      stats: {
        postsToday: stats.postsToday,
        postsLastMonth: stats.postsLastMonth,
        newMembersWeek: members.filter((m) => m.joinedAt >= weekAgo).length,
        activity: activityLabel(stats.perDay),
        lastActiveAt: stats.lastActiveAt,
      },
    };
  },
});

/** Photos and videos from group posts (Media tab, "Recent media"). */
export const media = viewerQuery({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    const g = await requireGroup(ctx, groupId);
    if (g.privacy === "private" && !(await membership(ctx, groupId, ctx.viewer._id))) return [];
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(200);
    const a = await loadAudience(ctx, ctx.viewer._id);
    const visible = await Promise.all(posts.map((p) => canView(ctx, p, a)));
    const shown = posts.filter((_, i) => visible[i]);
    const authors = await getSummaries(
      ctx,
      shown.map((p) => p.authorId),
    );
    const out: {
      key: string;
      postId: Id<"posts">;
      index: number;
      url: string;
      kind: "image" | "video";
      poster?: string;
      username: string;
    }[] = [];
    for (const p of shown)
      p.media.forEach((m, index) => {
        out.push({
          key: `${p._id}:${index}`,
          postId: p._id,
          index,
          url: m.url,
          kind: m.kind,
          poster: m.poster,
          username: authors.get(p.authorId)?.username ?? "",
        });
      });
    return limit ? out.slice(0, limit) : out;
  },
});

/** Featured: the group's most-reacted recent posts. */
export const featured = viewerQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const g = await requireGroup(ctx, groupId);
    if (g.privacy === "private" && !(await membership(ctx, groupId, ctx.viewer._id))) return [];
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(100);
    const top = posts
      .filter((p) => p.reactionCount >= 10)
      .sort((a, b) => b.reactionCount - a.reactionCount)
      .slice(0, 5);
    return enrichPosts(ctx, top, await loadAudience(ctx, ctx.viewer._id));
  },
});

/** People tab: staff, friends, newest members and everyone (optionally filtered by name). */
export const members = viewerQuery({
  args: { groupId: v.id("groups"), q: v.optional(v.string()) },
  handler: async (ctx, { groupId, q }) => {
    const g = await requireGroup(ctx, groupId);
    const viewerId = ctx.viewer._id;
    const rows = await groupMembers(ctx, groupId);
    const isMember = rows.some((m) => m.userId === viewerId);
    const friends = new Set(await friendIds(ctx, viewerId));
    const summaries = await getSummaries(
      ctx,
      rows.map((m) => m.userId),
    );
    const docs = new Map(
      (await Promise.all(rows.map((m) => ctx.db.get(m.userId))))
        .filter((u): u is Doc<"users"> => u !== null)
        .map((u) => [u._id, u]),
    );
    const term = q?.trim().toLowerCase() ?? "";
    const voices = await topVoices(
      ctx,
      g,
      rows.map((m) => m.userId),
    );
    const view = await Promise.all(
      rows.map(async (m) => {
        const u = summaries.get(m.userId);
        const doc = docs.get(m.userId);
        if (!u || !doc) return null;
        const follows =
          doc.kind === "page"
            ? await ctx.db
                .query("follows")
                .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", m.userId))
                .first()
            : null;
        // City and work follow the member's About audiences.
        const d = await visibleDetails(ctx, doc, viewerId, friends.has(m.userId));
        return {
          ...u,
          role: m.role,
          joinedAt: m.joinedAt,
          relation: await relation(ctx, viewerId, friends, m.userId),
          city: d.city,
          work: d.work[0] ?? null,
          pageCategory: doc.pageCategory ?? null,
          followerCount: doc.followerCount ?? null,
          viewerFollows: follows !== null,
          topVoice: voices.has(m.userId),
        };
      }),
    );
    const all = view
      .filter((m) => m !== null)
      .filter((m) => !term || m.name.toLowerCase().includes(term));
    const staff = all
      .filter((m) => m.role !== "member")
      .sort((a, b) => (a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "admin" ? -1 : 1));
    // Private groups only show who's in the group to members (admins stay visible).
    if (g.privacy === "private" && !isMember)
      return {
        total: g.memberCount,
        canSee: false,
        staff,
        topVoices: [],
        friends: [],
        nearby: [],
        newest: [],
        everyone: [],
      };
    const weekAgo = Date.now() - 7 * DAY;
    const viewerCity = ctx.viewer.city;
    return {
      total: g.memberCount,
      canSee: true,
      staff,
      // You aren't listed among your group's Top voices (your badge still shows elsewhere).
      topVoices: all
        .filter((m) => m.topVoice && m.relation !== "self")
        .sort((a, b) => (voices.get(b._id) ?? 0) - (voices.get(a._id) ?? 0)),
      friends: all.filter((m) => m.relation === "friend"),
      nearby: all.filter(
        (m) =>
          m.relation !== "self" && m.relation !== "friend" && viewerCity && m.city === viewerCity,
      ),
      newest: [...all]
        .filter((m) => m.role === "member")
        .sort((a, b) => b.joinedAt - a.joinedAt)
        .filter((m, i) => i < 5 || m.joinedAt >= weekAgo),
      everyone: [...all].sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

/** Events tab: upcoming and past events hosted in the group. */
export const events = viewerQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireGroup(ctx, groupId);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    const now = Date.now();
    const all = await Promise.all(
      rows.map(async (e) => {
        const responses = await ctx.db
          .query("eventResponses")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .collect();
        const mine = responses.find((r) => r.userId === ctx.viewer._id);
        if (!eventVisible(e, a, mine !== undefined)) return null;
        return {
          _id: e._id,
          title: e.title,
          cover: e.cover,
          startAt: e.startAt,
          endAt: e.endAt ?? null,
          online: e.online,
          venue: e.venue ?? null,
          city: e.city,
          going: e.externalGoingCount + responses.filter((r) => r.status === "going").length,
          interested:
            e.externalInterestedCount + responses.filter((r) => r.status === "interested").length,
          viewerStatus: mine?.status ?? null,
        };
      }),
    );
    const view = all.filter((e) => e !== null);
    return {
      upcoming: view
        .filter((e) => (e.endAt ?? e.startAt) >= now)
        .sort((a, b) => a.startAt - b.startAt),
      past: view.filter((e) => (e.endAt ?? e.startAt) < now).sort((a, b) => b.startAt - a.startAt),
    };
  },
});

/** Invite dialog: the viewer's friends with their membership / invite state. */
export const inviteCandidates = viewerQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const ids = await friendIds(ctx, ctx.viewer._id);
    const summaries = await getSummaries(ctx, ids);
    const rows = await Promise.all(
      ids.map(async (id) => {
        const u = summaries.get(id);
        if (u?.kind !== "person") return null;
        const [member, invited] = await Promise.all([
          membership(ctx, groupId, id),
          alreadyInvited(ctx, groupId, id),
        ]);
        return { ...u, state: member ? "member" : invited ? "invited" : "none" } as UserSummary & {
          state: "member" | "invited" | "none";
        };
      }),
    );
    return rows.filter((r) => r !== null).sort((a, b) => a.name.localeCompare(b.name));
  },
});

async function alreadyInvited(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users">) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(200);
  return rows.some((n) => n.kind === "group_invite" && n.groupId === groupId);
}

/**
 * The Discussion feed. "new" is newest first; "relevant" ranks the latest 200
 * posts by engagement with a recency decay. `limit` grows as the reader scrolls.
 */
export const feed = viewerQuery({
  args: {
    groupId: v.id("groups"),
    sort: v.union(v.literal("relevant"), v.literal("new")),
    limit: v.number(),
  },
  handler: async (ctx, { groupId, sort, limit }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const g = await ctx.db.get(groupId);
    if (!g || (g.privacy === "private" && !a.groups.has(groupId)))
      return { posts: [], hasMore: false };
    const q = ctx.db
      .query("posts")
      .withIndex("by_group", (x) => x.eq("groupId", groupId))
      .order("desc");
    let rows: Doc<"posts">[];
    let hasMore: boolean;
    if (sort === "new") {
      rows = await q.take(limit + 1);
      hasMore = rows.length > limit;
      rows = rows.slice(0, limit);
    } else {
      const now = Date.now();
      const score = (p: Doc<"posts">) =>
        (p.reactionCount + 2 * p.commentCount + 3 * p.shareCount + 2) /
        ((now - p.createdAt) / 3_600_000 + 2) ** 1.4;
      const recent = await q.take(200);
      rows = recent.sort((x, y) => score(y) - score(x)).slice(0, limit);
      hasMore = recent.length > limit;
    }
    return { posts: await enrichPosts(ctx, rows, a), hasMore };
  },
});

/** "Search this group": post text matches inside the group. */
export const searchPosts = viewerQuery({
  args: { groupId: v.id("groups"), q: v.string() },
  handler: async (ctx, { groupId, q }) => {
    const term = q.trim();
    if (!term) return [];
    const a = await loadAudience(ctx, ctx.viewer._id);
    const g = await ctx.db.get(groupId);
    if (!g || (g.privacy === "private" && !a.groups.has(groupId))) return [];
    const rows = await ctx.db
      .query("posts")
      .withSearchIndex("search_text", (s) => s.search("text", term).eq("groupId", groupId))
      .take(20);
    return enrichPosts(ctx, rows, a);
  },
});

/* ---------------- Mutations ---------------- */

async function clearInvites(ctx: MutationCtx, viewerId: Id<"users">, groupId: Id<"groups">) {
  for (const n of await pendingInvites(ctx, viewerId, groupId)) await ctx.db.delete(n._id);
}

export const join = viewerMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const g = await requireGroup(ctx, groupId);
    const viewerId = ctx.viewer._id;
    if (await membership(ctx, groupId, viewerId)) return;
    const now = Date.now();
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: viewerId,
      role: "member",
      joinedAt: now,
    });
    await ctx.db.patch(groupId, { memberCount: g.memberCount + 1 });
    await clearInvites(ctx, viewerId, groupId);
  },
});

export const leave = viewerMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const g = await requireGroup(ctx, groupId);
    const row = await membership(ctx, groupId, ctx.viewer._id);
    if (!row) return;
    await ctx.db.delete(row._id);
    await ctx.db.patch(groupId, { memberCount: Math.max(0, g.memberCount - 1) });
  },
});

/** Decline an invitation (removes the invite notifications). */
export const declineInvite = viewerMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => clearInvites(ctx, ctx.viewer._id, groupId),
});

/** Stamp the viewer's last visit ("You last visited …"). Throttled to once a minute. */
export const visit = viewerMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const row = await membership(ctx, groupId, ctx.viewer._id);
    const now = Date.now();
    if (row && now - (row.lastVisitedAt ?? 0) > 60_000)
      await ctx.db.patch(row._id, { lastVisitedAt: now });
  },
});

export const invite = viewerMutation({
  args: { groupId: v.id("groups"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { groupId, userIds }) => {
    const g = await requireGroup(ctx, groupId);
    const viewerId = ctx.viewer._id;
    if (!(await membership(ctx, groupId, viewerId)))
      throw new ConvexError("Join the group to invite friends");
    for (const userId of new Set(userIds)) {
      if (await membership(ctx, groupId, userId)) continue;
      if (await alreadyInvited(ctx, groupId, userId)) continue;
      await notify(ctx, {
        userId,
        actorId: viewerId,
        kind: "group_invite",
        text: `invited you to join ${g.name}.`,
        groupId,
      });
    }
  },
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "group"
  );
}

const DEFAULT_COVERS = ["/seed/covers/sf-01.jpg", "/seed/covers/mountains-02.jpg"];

export const create = viewerMutation({
  args: {
    name: v.string(),
    privacy: v.union(v.literal("public"), v.literal("private")),
    visible: v.optional(v.boolean()),
    invite: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name your group");
    if (name.length > 75) throw new ConvexError("Group names can be up to 75 characters");
    const viewerId = ctx.viewer._id;
    const base = slugify(name);
    let slug = base;
    for (
      let i = 2;
      await ctx.db
        .query("groups")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      i++
    )
      slug = `${base}-${i}`;
    const now = Date.now();
    const groupId = await ctx.db.insert("groups", {
      name,
      slug,
      cover: DEFAULT_COVERS[name.length % DEFAULT_COVERS.length],
      privacy: args.privacy,
      visible: args.privacy === "public" ? true : (args.visible ?? true),
      description: "",
      category: "General",
      location: ctx.viewer.city,
      rules: [],
      tags: [],
      createdBy: viewerId,
      createdAt: now,
      externalMemberCount: 0,
      memberCount: 1,
      lastActivityAt: now,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: viewerId,
      role: "admin",
      joinedAt: now,
      lastVisitedAt: now,
    });
    for (const userId of new Set(args.invite ?? []))
      await notify(ctx, {
        userId,
        actorId: viewerId,
        kind: "group_invite",
        text: `invited you to join ${name}.`,
        groupId,
      });
    return { groupId, slug };
  },
});

/** Admins can edit the description shown in About. */
export const updateAbout = viewerMutation({
  args: { groupId: v.id("groups"), description: v.string() },
  handler: async (ctx, { groupId, description }) => {
    const row = await membership(ctx, groupId, ctx.viewer._id);
    if (row?.role !== "admin") throw new ConvexError("Only admins can edit the group");
    await ctx.db.patch(groupId, { description: description.trim() });
  },
});

/** Create group: the viewer's friends (people only) for "Invite friends". */
export const friendsToInvite = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const ids = await friendIds(ctx, ctx.viewer._id);
    const map = await getSummaries(ctx, ids);
    return [...map.values()]
      .filter((u) => u.kind === "person")
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
