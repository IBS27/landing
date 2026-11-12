import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mergedStream, stream } from "convex-helpers/server/stream";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { relationTo } from "./friends";
import { blockedSet, isBlockedEitherWay } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { type Audience, canView, enrichPosts, loadAudience } from "./lib/posts";
import { detailAudiences, visibleDetails, visibleFriendIds } from "./lib/settings";
import { friendIds, getSummaries, type UserSummary, userSummary } from "./lib/users";
import { isReelPost } from "./media";
import schema from "./schema";

/* ---------------- Helpers ---------------- */

/**
 * The profile's timeline posts that the viewer may see, newest first: the
 * person's own non-group posts plus what others wrote on their wall.
 */
function timelineStream(
  ctx: QueryCtx,
  a: Audience,
  userId: Id<"users">,
  postedBy: "anyone" | "owner" | "others" = "anyone",
  year?: number,
) {
  const lo = year ? new Date(year, 0, 1).getTime() : 0;
  const hi = year ? new Date(year + 1, 0, 1).getTime() : Number.MAX_SAFE_INTEGER;
  const s = stream(ctx.db, schema);
  const streams = [];
  if (postedBy !== "others")
    streams.push(
      s
        .query("posts")
        .withIndex("by_author", (q) =>
          q.eq("authorId", userId).gte("createdAt", lo).lt("createdAt", hi),
        )
        .order("desc")
        .filterWith(
          async (p) =>
            !p.groupId &&
            !p.eventId &&
            !p.sponsored &&
            (!p.timelineUserId || p.timelineUserId === userId) &&
            (await canView(ctx, p, a)),
        ),
    );
  if (postedBy !== "owner")
    streams.push(
      s
        .query("posts")
        .withIndex("by_timeline", (q) =>
          q.eq("timelineUserId", userId).gte("createdAt", lo).lt("createdAt", hi),
        )
        .order("desc")
        .filterWith(async (p) => p.authorId !== userId && (await canView(ctx, p, a))),
    );
  return mergedStream(streams, ["createdAt"]);
}

/** Every visible timeline post for media/check-in roll-ups (small world: fine to collect). */
async function visibleTimelinePosts(ctx: QueryCtx, a: Audience, userId: Id<"users">) {
  const own = await ctx.db
    .query("posts")
    .withIndex("by_author", (q) => q.eq("authorId", userId))
    .order("desc")
    .collect();
  const out: Doc<"posts">[] = [];
  for (const p of own)
    if (
      !p.groupId &&
      !p.eventId &&
      !p.sponsored &&
      (!p.timelineUserId || p.timelineUserId === userId) &&
      (await canView(ctx, p, a))
    )
      out.push(p);
  return out;
}

type MediaItem = {
  postId: Id<"posts">;
  index: number;
  url: string;
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  /** Alt text plus the post's text, for "Filter photos". */
  searchText: string;
  createdAt: number;
};
/** A photo in a grid; `postId` is null for the profile picture / cover photo. */
export type PhotoItem = Omit<MediaItem, "postId"> & { postId: Id<"posts"> | null };

function mediaOf(posts: Doc<"posts">[], kind?: "image" | "video"): MediaItem[] {
  const out: MediaItem[] = [];
  for (const p of posts)
    p.media.forEach((m, index) => {
      if (kind && m.kind !== kind) return;
      out.push({
        postId: p._id,
        index,
        url: m.url,
        kind: m.kind,
        width: m.width ?? null,
        height: m.height ?? null,
        searchText: [m.alt, p.text].filter(Boolean).join(" "),
        createdAt: p.createdAt,
      });
    });
  return out;
}

/**
 * The current profile picture and cover photo. Facebook keeps these public,
 * so they show in Photos for everyone, friend or not. Skips URLs already
 * present in `seen` (a profile picture that was also posted).
 */
function profilePhotos(u: Doc<"users">, seen: PhotoItem[]): PhotoItem[] {
  const urls = new Set(seen.map((p) => p.url));
  const out: PhotoItem[] = [];
  for (const url of [u.avatar, u.cover])
    if (url && !urls.has(url) && !url.startsWith("data:")) {
      urls.add(url);
      out.push({
        postId: null,
        index: out.length,
        url,
        kind: "image",
        width: null,
        height: null,
        searchText: url === u.avatar ? "Profile picture" : "Cover photo",
        createdAt: u.joinedAt,
      });
    }
  return out;
}

/** A note is visible for 24 hours after it was shared. */
const NOTE_TTL = 24 * 60 * 60 * 1000;
export const NOTE_MAX = 60;

async function followerTotal(ctx: QueryCtx, u: Doc<"users">) {
  const rows = await ctx.db
    .query("follows")
    .withIndex("by_target", (q) => q.eq("targetId", u._id))
    .collect();
  return (u.followerCount ?? 0) + rows.length;
}

/* ---------------- Queries ---------------- */

/** Profile header: the person (or Page), friend counts, facepile and the viewer's relation. */
export const get = viewerQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!u) return null;
    const viewerId = ctx.viewer._id;
    const isSelf = u._id === viewerId;
    // Blocked either way: the profile isn't available, like Facebook.
    if (await isBlockedEitherWay(ctx, viewerId, u._id)) return null;
    const [relation, allFriends, viewerFriends] = await Promise.all([
      relationTo(ctx, viewerId, u._id),
      friendIds(ctx, u._id),
      isSelf ? Promise.resolve([] as Id<"users">[]) : friendIds(ctx, viewerId),
    ]);
    const viewerSet = new Set(viewerFriends);
    const theirFriends = await visibleFriendIds(
      ctx,
      u._id,
      viewerId,
      allFriends,
      viewerSet,
      await blockedSet(ctx, viewerId),
    );
    const mutual = theirFriends.filter((id) => viewerSet.has(id));
    // Facepile: mutual friends first on someone else's profile, most recent on your own.
    const pileIds = [...mutual, ...theirFriends.filter((id) => !viewerSet.has(id))].slice(0, 8);
    const pileMap = await getSummaries(ctx, pileIds);
    const isPage = u.kind === "page";
    const follow = isPage
      ? await ctx.db
          .query("follows")
          .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", u._id))
          .first()
      : null;
    // Each About detail follows its own audience; the owner also gets the audiences to edit.
    const [details, audiences] = await Promise.all([
      visibleDetails(ctx, u, viewerId, relation === "friend"),
      isSelf ? detailAudiences(ctx, u._id) : null,
    ]);
    // Notes are shared with friends (Facebook's default audience).
    const note =
      u.note && Date.now() - u.note.createdAt < NOTE_TTL && (isSelf || relation === "friend")
        ? u.note
        : null;
    return {
      user: {
        ...userSummary(u),
        cover: u.cover ?? null,
        bio: u.bio ?? null,
        pronouns: u.pronouns ?? null,
        ...details,
        joinedAt: u.joinedAt,
        pageCategory: u.pageCategory ?? null,
        links: u.links ?? [],
        note,
      },
      isSelf,
      isPage,
      relation,
      audiences,
      friendCount: theirFriends.length,
      mutualCount: isSelf ? 0 : mutual.length,
      facepile: pileIds.map((id) => pileMap.get(id)).filter((s): s is UserSummary => !!s),
      followerCount: isPage ? await followerTotal(ctx, u) : 0,
      viewerFollows: !!follow,
    };
  },
});

/** Left column of the All tab: photo and friend previews. */
export const overview = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const [u, posts, theirFriends] = await Promise.all([
      ctx.db.get(userId),
      visibleTimelinePosts(ctx, a, userId),
      ctx.db
        .query("friendships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);
    const timelinePhotos: PhotoItem[] = mediaOf(posts, "image");
    const photos = u ? [...timelinePhotos, ...profilePhotos(u, timelinePhotos)] : timelinePhotos;
    // Facebook leads with mutual friends, then everyone else.
    const ids = await visibleFriendIds(
      ctx,
      userId,
      a.viewerId,
      theirFriends.map((r) => r.friendId),
      a.friends,
      a.blocked,
    );
    const ordered = [
      ...ids.filter((id) => a.friends.has(id)),
      ...ids.filter((id) => !a.friends.has(id)),
    ].slice(0, 9);
    const map = await getSummaries(ctx, ordered);
    const checkins = new Map<
      string,
      { place: string; region: string; createdAt: number; postId: Id<"posts"> }
    >();
    for (const p of posts)
      if (p.place && !checkins.has(p.place))
        checkins.set(p.place, {
          place: p.place,
          region: placeRegion(p.place),
          createdAt: p.createdAt,
          postId: p._id,
        });
    // Highlights the viewer can still see (a deleted or hidden post drops out).
    const byUrl = new Map(photos.map((p) => [p.url, p]));
    const highlights = (u?.highlights ?? [])
      .map((url) => byUrl.get(url))
      .filter((p): p is PhotoItem => !!p);
    return {
      photos: photos.slice(0, 9),
      highlights,
      photoCount: photos.length,
      friends: ordered.map((id) => map.get(id)).filter((s): s is UserSummary => !!s),
      friendCount: ids.length,
      mutualCount: userId === a.viewerId ? 0 : ids.filter((id) => a.friends.has(id)).length,
      checkins: [...checkins.values()],
    };
  },
});

/** Places outside Seattle proper that posts check in to, by name. */
const PLACE_REGIONS: Record<string, string> = {
  "Mount Si": "North Bend, Washington",
  "Twin Falls Trail": "North Bend, Washington",
  "Rattlesnake Ledge": "North Bend, Washington",
  "Index Town Walls": "Index, Washington",
};

/**
 * The region line under a check-in, like Facebook's place pages: "City, State"
 * places show their state; named venues show their city (the seed is set in Seattle).
 */
function placeRegion(place: string) {
  const known = PLACE_REGIONS[place];
  if (known) return known;
  const parts = place.split(",").map((s) => s.trim());
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    return last === "Seattle" ? "Seattle, Washington" : last;
  }
  return "Seattle, Washington";
}

/** Photos tab: the person's photos, photos they're tagged in, and derived albums. */
export const photos = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const u = await ctx.db.get(userId);
    if (!u) return null;
    const posts = await visibleTimelinePosts(ctx, a, userId);
    // Tagged photos: recent posts that tag this person (small world, bounded scan).
    const recent = await ctx.db.query("posts").withIndex("by_created").order("desc").take(1500);
    const tagged: Doc<"posts">[] = [];
    for (const p of recent)
      if (
        p.authorId !== userId &&
        p.taggedIds?.includes(userId) &&
        p.media.length > 0 &&
        (await canView(ctx, p, a))
      )
        tagged.push(p);
    const timelinePhotos = mediaOf(posts, "image");
    const yours = [...timelinePhotos, ...profilePhotos(u, timelinePhotos)];
    const albums: { key: string; name: string; cover: string | null; count: number }[] = [
      { key: "profile", name: "Profile pictures", cover: u.avatar, count: 1 },
    ];
    if (u.cover) albums.push({ key: "cover", name: "Cover photos", cover: u.cover, count: 1 });
    if (timelinePhotos.length)
      albums.push({
        key: "timeline",
        name: "Timeline photos",
        cover: timelinePhotos[0].url,
        count: timelinePhotos.length,
      });
    return {
      yours,
      ofYou: mediaOf(tagged, "image"),
      albums,
      avatar: u.avatar,
      cover: u.cover ?? null,
    };
  },
});

/** Reels the person posted (vertical video posts). */
export const videos = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const posts = await visibleTimelinePosts(ctx, a, userId);
    return mediaOf(posts.filter(isReelPost), "video");
  },
});

/** Groups a person belongs to (public groups only unless the viewer is a member too). */
export const groups = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const rows = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const out = [];
    for (const r of rows) {
      const g = await ctx.db.get(r.groupId);
      if (!g) continue;
      if (g.privacy === "private" && !a.groups.has(g._id) && userId !== a.viewerId) continue;
      out.push({
        _id: g._id,
        name: g.name,
        slug: g.slug,
        cover: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount + g.externalMemberCount,
      });
    }
    return out;
  },
});

/** Pages the person follows (Likes / Following in the More menu). */
export const following = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const out = [];
    for (const r of rows) {
      const p = await ctx.db.get(r.targetId);
      if (p) out.push({ ...userSummary(p), category: p.pageCategory ?? null });
    }
    return out;
  },
});

/** People who follow a Page (its Followers tab). */
export const followers = viewerQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_target", (q) => q.eq("targetId", userId))
      .order("desc")
      .take(200);
    const map = await getSummaries(
      ctx,
      rows.map((r) => r.userId),
    );
    return rows.map((r) => map.get(r.userId)).filter((s): s is UserSummary => !!s);
  },
});

export const postedBy = v.union(v.literal("anyone"), v.literal("owner"), v.literal("others"));

/** The profile timeline with Facebook's post filters (year, posted by). */
export const timeline = viewerQuery({
  args: {
    userId: v.id("users"),
    postedBy: v.optional(postedBy),
    year: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId, postedBy: by, year, paginationOpts }) => {
    const a = await loadAudience(ctx, ctx.viewer._id);
    const result = await timelineStream(ctx, a, userId, by ?? "anyone", year).paginate(
      paginationOpts,
    );
    return { ...result, page: await enrichPosts(ctx, result.page, a) };
  },
});

/** "Search" on a profile: the person's timeline posts matching the text, best match first. */
export const search = viewerQuery({
  args: { userId: v.id("users"), q: v.string() },
  handler: async (ctx, { userId, q }) => {
    const text = q.trim();
    if (!text) return [];
    const a = await loadAudience(ctx, ctx.viewer._id);
    const hits = await ctx.db
      .query("posts")
      .withSearchIndex("search_text", (s) => s.search("text", text))
      .take(256);
    const out: Doc<"posts">[] = [];
    for (const p of hits) {
      if (out.length >= 20) break;
      const onTimeline =
        p.timelineUserId === userId || (p.authorId === userId && !p.timelineUserId);
      if (onTimeline && !p.groupId && !p.eventId && !p.sponsored && (await canView(ctx, p, a)))
        out.push(p);
    }
    return enrichPosts(ctx, out, a);
  },
});

/* ---------------- Mutations ---------------- */

const text = v.optional(v.string());
/** "YYYY-MM" month, or empty to clear. */
const month = v.optional(v.string());
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
function cleanMonth(m: string | undefined) {
  const t = m?.trim();
  if (!t) return undefined;
  if (!MONTH.test(t)) throw new ConvexError("Dates must be a month and year");
  return t;
}
function cleanRange<T extends { start?: string; end?: string }>(x: T) {
  const start = cleanMonth(x.start);
  const end = cleanMonth(x.end);
  if (start && end && end < start) throw new ConvexError("End date can't be before the start date");
  return { start, end };
}
export const HIGHLIGHTS_MAX = 9;

/** Edit intro / About details. Empty strings clear a field. Only your own profile. */
export const update = viewerMutation({
  args: {
    bio: text,
    pronouns: text,
    city: text,
    hometown: text,
    relationship: text,
    work: v.optional(
      v.array(v.object({ title: v.string(), company: v.string(), start: month, end: month })),
    ),
    education: v.optional(
      v.array(
        v.object({ school: v.string(), detail: v.optional(v.string()), start: month, end: month }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"users">> = {};
    for (const key of ["bio", "pronouns", "city", "hometown", "relationship"] as const) {
      const val = args[key];
      if (val !== undefined) patch[key] = val.trim() || undefined;
    }
    if (args.bio && args.bio.length > 101) throw new ConvexError("Bio can be up to 101 characters");
    if (args.work)
      patch.work = args.work
        .map((w) => ({ title: w.title.trim(), company: w.company.trim(), ...cleanRange(w) }))
        .filter((w) => w.company);
    if (args.education)
      patch.education = args.education
        .map((e) => ({
          school: e.school.trim(),
          detail: e.detail?.trim() || undefined,
          ...cleanRange(e),
        }))
        .filter((e) => e.school);
    await ctx.db.patch(ctx.viewer._id, patch);
  },
});

/**
 * Set the profile picture or cover photo from an upload or one of the
 * viewer's existing photos; neither clears the cover ("Remove").
 */
export const setPhoto = viewerMutation({
  args: {
    kind: v.union(v.literal("avatar"), v.literal("cover")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
  },
  handler: async (ctx, { kind, storageId, url: picked }) => {
    const url = storageId ? await ctx.storage.getUrl(storageId) : (picked ?? null);
    if (kind === "avatar") {
      if (!url) throw new ConvexError("Choose a photo");
      await ctx.db.patch(ctx.viewer._id, { avatar: url });
    } else {
      await ctx.db.patch(ctx.viewer._id, { cover: url ?? undefined });
    }
  },
});

/**
 * Replace the Highlights (featured photos) on your profile. Only photos that
 * already appear in your Photos can be featured.
 */
export const setHighlights = viewerMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const unique = [...new Set(urls)];
    if (unique.length > HIGHLIGHTS_MAX)
      throw new ConvexError(`You can feature up to ${HIGHLIGHTS_MAX} photos`);
    if (unique.length) {
      const me = ctx.viewer;
      const a = await loadAudience(ctx, me._id);
      const posts = await visibleTimelinePosts(ctx, a, me._id);
      const timeline = mediaOf(posts, "image");
      const allowed = new Set([...timeline, ...profilePhotos(me, timeline)].map((p) => p.url));
      if (unique.some((u) => !allowed.has(u))) throw new ConvexError("Choose from your photos");
    }
    await ctx.db.patch(ctx.viewer._id, { highlights: unique.length ? unique : undefined });
  },
});

/** Follow / unfollow a Page. */
export const setFollow = viewerMutation({
  args: { targetId: v.id("users"), follow: v.boolean() },
  handler: async (ctx, { targetId, follow }) => {
    const viewerId = ctx.viewer._id;
    const target = await ctx.db.get(targetId);
    if (target?.kind !== "page") throw new ConvexError("Only Pages can be followed");
    const row = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", targetId))
      .first();
    if (follow && !row)
      await ctx.db.insert("follows", { userId: viewerId, targetId, createdAt: Date.now() });
    if (!follow && row) await ctx.db.delete(row._id);
  },
});

/** Share, replace or clear (empty text) your profile note. */
export const setNote = viewerMutation({
  args: { text: v.string() },
  handler: async (ctx, { text: raw }) => {
    const text = raw.trim();
    if (text.length > NOTE_MAX) throw new ConvexError(`Notes can be up to ${NOTE_MAX} characters`);
    await ctx.db.patch(ctx.viewer._id, {
      note: text ? { text, createdAt: Date.now() } : undefined,
    });
  },
});
