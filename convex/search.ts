import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerQuery } from "./lib/functions";
import { type Audience, canView, enrichPosts, loadAudience } from "./lib/posts";
import { friendIds } from "./lib/users";

/* ---------------- Shapes ---------------- */

export type FriendState = "self" | "friends" | "outgoing" | "incoming" | "none";

export type PersonResult = {
  _id: Id<"users">;
  name: string;
  username: string;
  avatar: string;
  verified: boolean;
  city: string | null;
  work: string | null;
  school: string | null;
  mutualCount: number;
  friendState: FriendState;
};

export type PageResult = {
  _id: Id<"users">;
  name: string;
  username: string;
  avatar: string;
  verified: boolean;
  category: string | null;
  followerCount: number;
  following: boolean;
};

export type GroupResult = {
  _id: Id<"groups">;
  name: string;
  slug: string;
  cover: string;
  privacy: "public" | "private";
  memberCount: number;
  /** Posts in the last 30 days, for "10+ posts a day". */
  recentPosts: number;
  joined: boolean;
};

export type EventResult = {
  _id: Id<"events">;
  title: string;
  cover: string;
  startAt: number;
  online: boolean;
  venue: string | null;
  city: string;
  goingCount: number;
  interestedCount: number;
  viewerStatus: "going" | "interested" | "invited" | null;
};

export type ListingResult = {
  _id: Id<"listings">;
  title: string;
  price: number;
  photo: string | null;
  location: string;
  status: "active" | "pending" | "sold";
};

export type PlaceResult = { name: string; postCount: number; eventCount: number };

/** `key` is what the route needs: a username, a group slug or an event id. */
export type TypeaheadItem = {
  kind: "person" | "page" | "group" | "event";
  id: string;
  key: string;
  title: string;
  image: string;
  sub: string;
  verified: boolean;
};

/* ---------------- Helpers ---------------- */

const DAY = 24 * 60 * 60 * 1000;

function clean(q: string) {
  return q.trim().slice(0, 100);
}

async function friendState(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  friends: Set<Id<"users">>,
  userId: Id<"users">,
): Promise<FriendState> {
  if (userId === viewerId) return "self";
  if (friends.has(userId)) return "friends";
  const out = await ctx.db
    .query("friendRequests")
    .withIndex("by_pair", (q) => q.eq("fromId", viewerId).eq("toId", userId))
    .first();
  if (out) return "outgoing";
  const inc = await ctx.db
    .query("friendRequests")
    .withIndex("by_pair", (q) => q.eq("fromId", userId).eq("toId", viewerId))
    .first();
  return inc ? "incoming" : "none";
}

async function personResult(ctx: QueryCtx, a: Audience, u: Doc<"users">): Promise<PersonResult> {
  const theirs = await friendIds(ctx, u._id);
  const mutualCount = u._id === a.viewerId ? 0 : theirs.filter((id) => a.friends.has(id)).length;
  const work = u.work?.[0];
  return {
    _id: u._id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    verified: u.verified,
    city: u.city ?? null,
    work: work ? `${work.title} at ${work.company}` : null,
    school: u.education?.[0]?.school ?? null,
    mutualCount,
    friendState: await friendState(ctx, a.viewerId, a.friends, u._id),
  };
}

async function pageResult(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  u: Doc<"users">,
): Promise<PageResult> {
  const [followers, mine] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_target", (q) => q.eq("targetId", u._id))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", u._id))
      .first(),
  ]);
  return {
    _id: u._id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    verified: u.verified,
    category: u.pageCategory ?? null,
    followerCount: (u.followerCount ?? 0) + followers.length,
    following: mine !== null,
  };
}

async function groupResult(ctx: QueryCtx, a: Audience, g: Doc<"groups">): Promise<GroupResult> {
  const since = Date.now() - 30 * DAY;
  const recent = await ctx.db
    .query("posts")
    .withIndex("by_group", (q) => q.eq("groupId", g._id).gt("createdAt", since))
    .take(400);
  return {
    _id: g._id,
    name: g.name,
    slug: g.slug,
    cover: g.cover,
    privacy: g.privacy,
    memberCount: g.memberCount,
    recentPosts: recent.length,
    joined: a.groups.has(g._id),
  };
}

async function eventResult(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  e: Doc<"events">,
): Promise<EventResult> {
  const [going, interested, mine] = await Promise.all([
    ctx.db
      .query("eventResponses")
      .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
      .collect(),
    ctx.db
      .query("eventResponses")
      .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "interested"))
      .collect(),
    ctx.db
      .query("eventResponses")
      .withIndex("by_event_user", (q) => q.eq("eventId", e._id).eq("userId", viewerId))
      .first(),
  ]);
  return {
    _id: e._id,
    title: e.title,
    cover: e.cover,
    startAt: e.startAt,
    online: e.online,
    venue: e.venue ?? null,
    city: e.city,
    goingCount: e.externalGoingCount + going.length,
    interestedCount: e.externalInterestedCount + interested.length,
    viewerStatus: mine?.status ?? null,
  };
}

function listingResult(l: Doc<"listings">): ListingResult {
  return {
    _id: l._id,
    title: l.title,
    price: l.price,
    photo: l.photos[0] ?? null,
    location: l.location.neighborhood
      ? `${l.location.neighborhood}, ${l.location.city}`
      : l.location.city,
    status: l.status,
  };
}

function canSeeEvent(e: Doc<"events">, a: Audience) {
  if (e.hostId === a.viewerId) return true;
  if (e.privacy === "public") return true;
  if (e.privacy === "friends") return a.friends.has(e.hostId);
  if (e.privacy === "group") return !!e.groupId && a.groups.has(e.groupId);
  return false;
}

function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/* ---------------- Typeahead ---------------- */

/** The header search dropdown: people and Pages first, then groups and events. */
export const typeahead = viewerQuery({
  args: { q: v.string() },
  handler: async (ctx, args): Promise<TypeaheadItem[]> => {
    const q = clean(args.q);
    if (!q) return [];
    const a = await loadAudience(ctx, ctx.viewer._id);
    const [users, groups, events] = await Promise.all([
      ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) => s.search("name", q))
        .take(12),
      ctx.db
        .query("groups")
        .withSearchIndex("search_name", (s) => s.search("name", q))
        .take(6),
      ctx.db
        .query("events")
        .withSearchIndex("search_title", (s) => s.search("title", q))
        .take(6),
    ]);
    const people: TypeaheadItem[] = [];
    // Friends float to the top, like Facebook; blocked people never show.
    const ranked = users
      .filter((u) => !a.blocked.has(u._id))
      .sort((x, y) => Number(a.friends.has(y._id)) - Number(a.friends.has(x._id)));
    for (const u of ranked) {
      if (u.kind === "page") {
        people.push({
          kind: "page",
          id: u._id,
          title: u.name,
          image: u.avatar,
          sub: [u.pageCategory, u.followerCount ? `${compact(u.followerCount)} followers` : null]
            .filter(Boolean)
            .join(" · "),
          key: u.username,
          verified: u.verified,
        });
        continue;
      }
      let sub = "";
      if (u._id === a.viewerId) sub = "You";
      else if (a.friends.has(u._id)) sub = "Friend";
      else {
        const theirs = await friendIds(ctx, u._id);
        const mutual = theirs.filter((id) => a.friends.has(id)).length;
        sub = mutual
          ? `${mutual} mutual friend${mutual === 1 ? "" : "s"}`
          : u.city
            ? `Lives in ${u.city}`
            : "";
      }
      people.push({
        kind: "person",
        id: u._id,
        title: u.name,
        image: u.avatar,
        sub,
        key: u.username,
        verified: u.verified,
      });
    }
    const groupItems: TypeaheadItem[] = groups
      .filter((g) => g.visible || a.groups.has(g._id))
      .slice(0, 3)
      .map((g) => ({
        kind: "group",
        id: g._id,
        title: g.name,
        image: g.cover,
        sub: a.groups.has(g._id)
          ? "Group · Joined"
          : `${g.privacy === "public" ? "Public" : "Private"} group · ${compact(g.memberCount)} members`,
        key: g.slug,
        verified: false,
      }));
    const eventItems: TypeaheadItem[] = events
      .filter((e) => canSeeEvent(e, a))
      .slice(0, 2)
      .map((e) => ({
        kind: "event",
        id: e._id,
        title: e.title,
        image: e.cover,
        sub: `Event · ${e.online ? "Online" : (e.venue ?? e.city)}`,
        key: e._id,
        verified: false,
      }));
    return [...people.slice(0, 6), ...groupItems, ...eventItems].slice(0, 9);
  },
});

/* ---------------- Results page ---------------- */

const DATE_WINDOWS = {
  today: [0, 1],
  tomorrow: [1, 2],
  week: [0, 7],
  month: [0, 31],
} as const;

/**
 * Entity results for the search page. The All tab asks for a few of each
 * type; a type's own tab asks for more.
 */
export const results = viewerQuery({
  args: {
    q: v.string(),
    limit: v.optional(v.number()),
    types: v.array(
      v.union(
        v.literal("people"),
        v.literal("pages"),
        v.literal("groups"),
        v.literal("events"),
        v.literal("listings"),
        v.literal("places"),
      ),
    ),
    filters: v.optional(
      v.object({
        friendsOfFriends: v.optional(v.boolean()),
        city: v.optional(v.string()),
        publicGroups: v.optional(v.boolean()),
        myGroups: v.optional(v.boolean()),
        onlineEvents: v.optional(v.boolean()),
        eventDate: v.optional(
          v.union(v.literal("today"), v.literal("tomorrow"), v.literal("week"), v.literal("month")),
        ),
        maxPrice: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const q = clean(args.q);
    const limit = Math.min(args.limit ?? 5, 50);
    const f = args.filters ?? {};
    const want = new Set(args.types);
    const empty = {
      people: [] as PersonResult[],
      pages: [] as PageResult[],
      groups: [] as GroupResult[],
      events: [] as EventResult[],
      listings: [] as ListingResult[],
      places: [] as PlaceResult[],
    };
    if (!q) return empty;
    const a = await loadAudience(ctx, ctx.viewer._id);
    const out = { ...empty };

    if (want.has("people") || want.has("pages")) {
      const users = (
        await ctx.db
          .query("users")
          .withSearchIndex("search_name", (s) => s.search("name", q))
          .take(100)
      ).filter((u) => !a.blocked.has(u._id));
      if (want.has("people")) {
        let people = await Promise.all(
          users.filter((u) => u.kind !== "page").map((u) => personResult(ctx, a, u)),
        );
        if (f.friendsOfFriends)
          people = people.filter((p) => p.friendState === "friends" || p.mutualCount > 0);
        if (f.city) people = people.filter((p) => p.city === f.city);
        out.people = people.slice(0, limit);
      }
      if (want.has("pages"))
        out.pages = await Promise.all(
          users
            .filter((u) => u.kind === "page")
            .slice(0, limit)
            .map((u) => pageResult(ctx, a.viewerId, u)),
        );
    }

    if (want.has("groups")) {
      let groups = (
        await ctx.db
          .query("groups")
          .withSearchIndex("search_name", (s) => s.search("name", q))
          .take(60)
      ).filter((g) => g.visible || a.groups.has(g._id));
      if (f.publicGroups) groups = groups.filter((g) => g.privacy === "public");
      if (f.myGroups) groups = groups.filter((g) => a.groups.has(g._id));
      out.groups = await Promise.all(groups.slice(0, limit).map((g) => groupResult(ctx, a, g)));
    }

    if (want.has("events")) {
      const now = Date.now();
      let events = (
        await ctx.db
          .query("events")
          .withSearchIndex("search_title", (s) => s.search("title", q))
          .take(60)
      ).filter((e) => canSeeEvent(e, a));
      if (f.onlineEvents) events = events.filter((e) => e.online);
      if (f.eventDate) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const [from, to] = DATE_WINDOWS[f.eventDate];
        const lo = start.getTime() + from * DAY;
        const hi = start.getTime() + to * DAY;
        events = events.filter((e) => e.startAt >= lo && e.startAt < hi);
      }
      // Upcoming first (soonest), then past events (most recent).
      events.sort((x, y) => {
        const ux = x.startAt >= now;
        const uy = y.startAt >= now;
        if (ux !== uy) return ux ? -1 : 1;
        return ux ? x.startAt - y.startAt : y.startAt - x.startAt;
      });
      out.events = await Promise.all(
        events.slice(0, limit).map((e) => eventResult(ctx, a.viewerId, e)),
      );
    }

    if (want.has("listings")) {
      let listings = await ctx.db
        .query("listings")
        .withSearchIndex("search_title", (s) => s.search("title", q).eq("status", "active"))
        .take(60);
      if (f.maxPrice !== undefined) {
        const max = f.maxPrice;
        listings = listings.filter((l) => l.price <= max);
      }
      out.listings = listings.slice(0, limit).map(listingResult);
    }

    if (want.has("places")) {
      const needle = q.toLowerCase();
      const counts = new Map<string, PlaceResult>();
      const bump = (name: string, key: "postCount" | "eventCount") => {
        const row = counts.get(name) ?? { name, postCount: 0, eventCount: 0 };
        row[key] += 1;
        counts.set(name, row);
      };
      const [posts, events] = await Promise.all([
        ctx.db.query("posts").withIndex("by_created").order("desc").take(1500),
        ctx.db.query("events").withIndex("by_start").order("desc").take(500),
      ]);
      for (const p of posts)
        if (p.place?.toLowerCase().includes(needle) && (await canView(ctx, p, a)))
          bump(p.place, "postCount");
      for (const e of events)
        if (e.venue?.toLowerCase().includes(needle) && canSeeEvent(e, a))
          bump(e.venue, "eventCount");
      out.places = [...counts.values()]
        .sort((x, y) => y.postCount + y.eventCount - (x.postCount + x.eventCount))
        .slice(0, limit);
    }

    return out;
  },
});

/** Distinct cities among people matching the query (for the People "City" filter). */
export const peopleCities = viewerQuery({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const q = clean(args.q);
    if (!q) return [];
    const users = await ctx.db
      .query("users")
      .withSearchIndex("search_name", (s) => s.search("name", q))
      .take(100);
    return [...new Set(users.flatMap((u) => (u.kind !== "page" && u.city ? [u.city] : [])))].sort();
  },
});

/** Case-insensitive "does this post mention the location" (check-in or text). */
function atPlace(p: Doc<"posts">, place: string) {
  const needle = place.toLowerCase().trim();
  // "Leavenworth, Washington" also matches posts that just say "Leavenworth".
  const short = needle.split(",")[0].trim();
  const tagged = p.place?.toLowerCase();
  return (
    (!!tagged && (tagged.includes(needle) || needle.includes(tagged))) ||
    !!p.text?.toLowerCase().includes(short)
  );
}

/**
 * Locations for the "Tagged location" filter: check-in places on posts the
 * viewer can see, most used first, narrowed by what they type.
 */
export const taggedPlaces = viewerQuery({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const needle = clean(args.q ?? "").toLowerCase();
    const a = await loadAudience(ctx, ctx.viewer._id);
    const recent = await ctx.db.query("posts").withIndex("by_created").order("desc").take(1500);
    const counts = new Map<string, number>();
    for (const p of recent) {
      if (!p.place || (needle && !p.place.toLowerCase().includes(needle))) continue;
      if (!(await canView(ctx, p, a))) continue;
      counts.set(p.place, (counts.get(p.place) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 8)
      .map(([name]) => name);
  },
});

/**
 * Post results (also Reels: posts with a video). Full-text matches on post
 * text, filtered to what the viewer may see, with Facebook's post filters.
 */
export const posts = viewerQuery({
  args: {
    q: v.string(),
    limit: v.optional(v.number()),
    media: v.optional(v.union(v.literal("photo"), v.literal("video"))),
    recent: v.optional(v.boolean()),
    seen: v.optional(v.boolean()),
    year: v.optional(v.number()),
    from: v.optional(
      v.union(v.literal("you"), v.literal("friends"), v.literal("groups"), v.literal("public")),
    ),
    /** Tagged location: check-in place or a mention in the text. */
    place: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const q = clean(args.q);
    const limit = Math.min(args.limit ?? 10, 100);
    if (!q) return { posts: [], hasMore: false };
    const a = await loadAudience(ctx, ctx.viewer._id);
    const hits = await ctx.db
      .query("posts")
      .withSearchIndex("search_text", (s) => s.search("text", q))
      .take(256);
    const keep: Doc<"posts">[] = [];
    for (const p of hits) {
      if (!(await canView(ctx, p, a))) continue;
      if (args.media === "photo" && !p.media.some((m) => m.kind === "image")) continue;
      if (args.media === "video" && !p.media.some((m) => m.kind === "video")) continue;
      if (args.year && new Date(p.createdAt).getFullYear() !== args.year) continue;
      if (args.place && !atPlace(p, args.place)) continue;
      if (args.from === "you" && p.authorId !== a.viewerId) continue;
      if (args.from === "friends" && !a.friends.has(p.authorId)) continue;
      if (args.from === "groups" && !p.groupId) continue;
      if (args.from === "public" && (p.privacy !== "public" || p.groupId)) continue;
      if (args.seen) {
        const r = await ctx.db
          .query("reactions")
          .withIndex("by_target_user", (x) =>
            x.eq("targetType", "post").eq("targetId", p._id).eq("userId", a.viewerId),
          )
          .first();
        if (!r && p.authorId !== a.viewerId) continue;
      }
      keep.push(p);
    }
    if (args.recent) keep.sort((x, y) => y.createdAt - x.createdAt);
    return {
      posts: await enrichPosts(ctx, keep.slice(0, limit), a),
      hasMore: keep.length > limit,
    };
  },
});
