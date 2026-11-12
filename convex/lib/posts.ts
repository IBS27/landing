import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { reactionSummary } from "../reactions";
import { blockedSet } from "./blocks";
import { canSeeWallPosts, settingsRow } from "./settings";
import { getSummaries, getSummary, type UserSummary } from "./users";

/**
 * The single enriched post shape every surface renders (feed, timeline,
 * group, permalink, dialog, saved). Built by `enrichPost`.
 */

export type GroupChip = {
  _id: Id<"groups">;
  name: string;
  slug: string;
  cover: string;
  privacy: "public" | "private";
};

export type ResolvedAttachment =
  | {
      kind: "listing";
      listingId: Id<"listings">;
      title: string;
      price: number;
      photo: string | null;
      location: string;
      status: "active" | "pending" | "sold";
    }
  | {
      kind: "event";
      eventId: Id<"events">;
      title: string;
      cover: string;
      startAt: number;
      venue: string | null;
      city: string;
      online: boolean;
    }
  | {
      kind: "link";
      url: string;
      title: string;
      domain: string;
      description: string | null;
      image: string | null;
    };

export type ReactionInfo = Awaited<ReturnType<typeof reactionSummary>> & {
  /** Display name for "You and N others" / "Name and N others". */
  sampleName: string | null;
  /** Settings → Reaction preferences: show the reactions but not how many. */
  countHidden: boolean;
};

export type PostView = {
  _id: Id<"posts">;
  createdAt: number;
  editedAt: number | null;
  text: string | null;
  background: string | null;
  media: Doc<"posts">["media"];
  feeling: string | null;
  place: string | null;
  privacy: Doc<"posts">["privacy"];
  author: UserSummary;
  group: GroupChip | null;
  /** Set when the post was written on someone else's timeline. */
  timelineUser: UserSummary | null;
  tagged: UserSummary[];
  attachments: ResolvedAttachment[];
  /** The post this one shares. `"unavailable"` when it was deleted or is hidden from the viewer. */
  shared: PostView | "unavailable" | null;
  reactions: ReactionInfo;
  commentCount: number;
  shareCount: number;
  /** Video posts: seeded baseline plus distinct recorded (≥3s) views; null without a video. */
  viewCount: number | null;
  /** A Page ad: the header reads "Ad" and the link strip gets a call-to-action button. */
  sponsored: boolean;
  /** A live video broadcast: live while `endedAt` is null. */
  live: { title: string | null; startedAt: number; endedAt: number | null } | null;
  viewerSaved: boolean;
  /** "Turn on notifications for this post" is on for the viewer. */
  viewerSubscribed: boolean;
  /** The viewer follows (is friends with) the author; drives the "· Follow" link. */
  viewerFollowsAuthor: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type Audience = {
  viewerId: Id<"users">;
  friends: Set<Id<"users">>;
  groups: Set<Id<"groups">>;
  adminGroups: Set<Id<"groups">>;
  /** People blocked by or blocking the viewer; their posts never show. */
  blocked: Set<Id<"users">>;
  /** Settings → Reaction preferences (on others' posts / on the viewer's own). */
  hideReactionCounts: { others: boolean; own: boolean };
  /** Per-owner "Who can see what others post on your profile?" results, filled lazily. */
  wallAccess: Map<Id<"users">, Promise<boolean>>;
};

/** Everything needed to decide visibility and permissions for many posts at once. */
export async function loadAudience(ctx: QueryCtx, viewerId: Id<"users">): Promise<Audience> {
  const [friendRows, memberRows, blocked, settings] = await Promise.all([
    ctx.db
      .query("friendships")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect(),
    ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect(),
    blockedSet(ctx, viewerId),
    settingsRow(ctx, viewerId),
  ]);
  return {
    viewerId,
    friends: new Set(friendRows.map((r) => r.friendId)),
    groups: new Set(memberRows.map((r) => r.groupId)),
    adminGroups: new Set(memberRows.filter((r) => r.role !== "member").map((r) => r.groupId)),
    blocked,
    hideReactionCounts: {
      others: settings?.hideReactionCountsOthers ?? false,
      own: settings?.hideReactionCountsOwn ?? false,
    },
    wallAccess: new Map(),
  };
}

/** Facebook audience rules: only-me, friends, public; private groups need membership. */
export async function canView(ctx: QueryCtx, post: Doc<"posts">, a: Audience) {
  if (post.authorId === a.viewerId) return true;
  if (a.blocked.has(post.authorId)) return false;
  if (post.timelineUserId && a.blocked.has(post.timelineUserId)) return false;
  if (post.privacy === "only_me") return false;
  if (post.groupId) {
    if (a.groups.has(post.groupId)) return true;
    const g = await ctx.db.get(post.groupId);
    return g?.privacy === "public";
  }
  if (
    post.privacy === "friends" &&
    !a.friends.has(post.authorId) &&
    post.timelineUserId !== a.viewerId
  )
    return false;
  // A wall post also follows the timeline owner's "Who can see what others post on your profile?".
  const owner = post.timelineUserId;
  if (owner && owner !== post.authorId && owner !== a.viewerId) {
    let access = a.wallAccess.get(owner);
    if (!access) {
      access = canSeeWallPosts(ctx, owner, a.viewerId);
      a.wallAccess.set(owner, access);
    }
    return access;
  }
  return true;
}

async function resolveAttachment(
  ctx: QueryCtx,
  att: Doc<"posts">["attachments"][number],
): Promise<ResolvedAttachment | null> {
  if (att.kind === "listing") {
    const l = await ctx.db.get(att.listingId);
    if (!l) return null;
    return {
      kind: "listing",
      listingId: l._id,
      title: l.title,
      price: l.price,
      photo: l.photos[0] ?? null,
      location: l.location.neighborhood
        ? `${l.location.neighborhood}, ${l.location.city}`
        : l.location.city,
      status: l.status,
    };
  }
  if (att.kind === "event") {
    const e = await ctx.db.get(att.eventId);
    if (!e) return null;
    return {
      kind: "event",
      eventId: e._id,
      title: e.title,
      cover: e.cover,
      startAt: e.startAt,
      venue: e.venue ?? null,
      city: e.city,
      online: e.online,
    };
  }
  return {
    kind: "link",
    url: att.url,
    title: att.title,
    domain: att.domain,
    description: att.description ?? null,
    image: att.image ?? null,
  };
}

export async function groupChip(ctx: QueryCtx, id: Id<"groups">): Promise<GroupChip | null> {
  const g = await ctx.db.get(id);
  return g ? { _id: g._id, name: g.name, slug: g.slug, cover: g.cover, privacy: g.privacy } : null;
}

export async function isSaved(
  ctx: QueryCtx,
  userId: Id<"users">,
  kind: "post" | "listing" | "event",
  refId: string,
) {
  const row = await ctx.db
    .query("saved")
    .withIndex("by_user_ref", (q) => q.eq("userId", userId).eq("kind", kind).eq("refId", refId))
    .first();
  return row !== null;
}

/** A video's view count: its seeded baseline plus distinct recorded (≥3s) views. */
export function viewCountOf(post: Doc<"posts">) {
  return (post.viewBaseline ?? 0) + (post.recordedViews ?? 0);
}

/** Enrich a post for the viewer. Shared posts are enriched one level deep. */
export async function enrichPost(
  ctx: QueryCtx,
  post: Doc<"posts">,
  a: Audience,
  depth = 0,
): Promise<PostView | null> {
  if (a.blocked.has(post.authorId)) return null;
  const author = await getSummary(ctx, post.authorId);
  if (!author) return null;
  const [group, timelineUser, taggedMap, attachments, reactions, viewerSaved, sub, shared] =
    await Promise.all([
      post.groupId ? groupChip(ctx, post.groupId) : null,
      post.timelineUserId && post.timelineUserId !== post.authorId
        ? getSummary(ctx, post.timelineUserId)
        : null,
      getSummaries(ctx, post.taggedIds ?? []),
      Promise.all(post.attachments.map((att) => resolveAttachment(ctx, att))),
      reactionSummary(ctx, "post", post._id, a.viewerId),
      isSaved(ctx, a.viewerId, "post", post._id),
      ctx.db
        .query("postSubscriptions")
        .withIndex("by_user_post", (q) => q.eq("userId", a.viewerId).eq("postId", post._id))
        .first(),
      resolveShared(ctx, post, a, depth),
    ]);
  const sample = reactions.sampleUserId ? await getSummary(ctx, reactions.sampleUserId) : null;
  const isAuthor = post.authorId === a.viewerId;
  return {
    _id: post._id,
    createdAt: post.createdAt,
    editedAt: post.editedAt ?? null,
    text: post.text ?? null,
    background: post.background ?? null,
    media: post.media,
    feeling: post.feeling ?? null,
    place: post.place ?? null,
    privacy: post.privacy,
    author,
    group,
    timelineUser,
    tagged: (post.taggedIds ?? [])
      .map((id) => taggedMap.get(id))
      .filter((u): u is UserSummary => !!u),
    attachments: attachments.filter((x): x is ResolvedAttachment => x !== null),
    shared,
    reactions: {
      ...reactions,
      sampleName: sample?.name ?? null,
      countHidden: isAuthor ? a.hideReactionCounts.own : a.hideReactionCounts.others,
    },
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    viewCount: post.media.some((m) => m.kind === "video") ? viewCountOf(post) : null,
    sponsored: post.sponsored === true,
    live: post.live
      ? {
          title: post.live.title ?? null,
          startedAt: post.live.startedAt,
          endedAt: post.live.endedAt ?? null,
        }
      : null,
    viewerSaved,
    viewerSubscribed: sub !== null,
    viewerFollowsAuthor: isAuthor || a.friends.has(post.authorId),
    canEdit: isAuthor,
    canDelete:
      isAuthor ||
      post.timelineUserId === a.viewerId ||
      (post.groupId !== undefined && a.adminGroups.has(post.groupId)),
  };
}

async function resolveShared(
  ctx: QueryCtx,
  post: Doc<"posts">,
  a: Audience,
  depth: number,
): Promise<PostView | "unavailable" | null> {
  if (!post.sharedPostId) return null;
  if (depth > 0) return null;
  const original = await ctx.db.get(post.sharedPostId);
  if (!original || !(await canView(ctx, original, a))) return "unavailable";
  return (await enrichPost(ctx, original, a, depth + 1)) ?? "unavailable";
}

/** Enrich a list, dropping posts whose author no longer exists. */
export async function enrichPosts(ctx: QueryCtx, posts: Doc<"posts">[], a: Audience) {
  const out = await Promise.all(posts.map((p) => enrichPost(ctx, p, a)));
  return out.filter((p): p is PostView => p !== null);
}

export type { UserSummary };
