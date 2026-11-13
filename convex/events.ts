import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { recordSignal, undoSignal } from "./lib/activity";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { checkPoint, neighborhoodIdAt } from "./lib/neighborhoods";
import { notify } from "./lib/notify";
import { canSeeEvent, enrichPosts, eventVisible, isSaved, loadAudience } from "./lib/posts";
import { detailAudiences } from "./lib/settings";
import { friendIds, getSummaries, getSummary, type UserSummary, userSummary } from "./lib/users";
import { latLng } from "./validators";

/* ---------------- Categories ---------------- */

/** Facebook's event categories, in the Events rail order. */
export const EVENT_CATEGORIES = [
  "Classics",
  "Comedy",
  "Crafts",
  "Dance",
  "Drinks",
  "Fitness & Workouts",
  "Foods",
  "Games",
  "Gardening",
  "Health & Medical",
  "Healthy Living & Self-Care",
  "Home & Garden",
  "Music & Audio",
  "Parties",
  "Professional Networking",
  "Religions",
  "Shopping",
  "Social Issues",
  "Sports",
  "Theater",
  "TV & Movies",
  "Visual Arts",
] as const;

/** Seeded events use short labels; show them under Facebook's category names. */
const CATEGORY_ALIASES: Record<string, string> = {
  Fitness: "Fitness & Workouts",
  Party: "Parties",
  Tech: "Professional Networking",
  Education: "Professional Networking",
  Music: "Music & Audio",
  "Food & Drink": "Foods",
  Arts: "Visual Arts",
  Outdoors: "Sports",
  Community: "Social Issues",
};
export function fbCategory(c: string) {
  return CATEGORY_ALIASES[c] ?? c;
}

/* ---------------- Shared helpers ---------------- */

type Status = "going" | "interested" | "invited";
const HOUR = 3_600_000;

function endOf(e: Doc<"events">) {
  return e.endAt ?? e.startAt + 3 * HOUR;
}
function isUpcoming(e: Doc<"events">, now: number) {
  return endOf(e) > now;
}

type Ctx = {
  viewerId: Id<"users">;
  friends: Set<Id<"users">>;
  groups: Set<Id<"groups">>;
  /** The viewer's response per event. */
  mine: Map<Id<"events">, Doc<"eventResponses">>;
};

async function loadCtx(ctx: QueryCtx, viewerId: Id<"users">): Promise<Ctx> {
  const [a, rows] = await Promise.all([
    loadAudience(ctx, viewerId),
    ctx.db
      .query("eventResponses")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect(),
  ]);
  return {
    viewerId,
    friends: a.friends,
    groups: a.groups,
    mine: new Map(rows.map((r) => [r.eventId, r])),
  };
}

/** Facebook audience rules for events. */
function canSee(e: Doc<"events">, c: Ctx) {
  return eventVisible(e, c, c.mine.has(e._id));
}

async function responses(ctx: QueryCtx, eventId: Id<"events">, status: Status) {
  return ctx.db
    .query("eventResponses")
    .withIndex("by_event", (q) => q.eq("eventId", eventId).eq("status", status))
    .collect();
}

function locationLine(e: Doc<"events">) {
  if (e.online) return "Online";
  return e.venue ?? e.address ?? e.city;
}

export type EventCardView = {
  _id: Id<"events">;
  title: string;
  cover: string;
  startAt: number;
  endAt: number | null;
  online: boolean;
  location: string;
  city: string;
  category: string;
  goingCount: number;
  interestedCount: number;
  viewerStatus: Status | null;
  isHost: boolean;
  host: UserSummary | null;
  friendsGoing: UserSummary[];
  friendsInterested: number;
};

async function card(ctx: QueryCtx, e: Doc<"events">, c: Ctx): Promise<EventCardView> {
  const [going, interested, host] = await Promise.all([
    responses(ctx, e._id, "going"),
    responses(ctx, e._id, "interested"),
    getSummary(ctx, e.hostId),
  ]);
  const friendGoingIds = going.filter((r) => c.friends.has(r.userId)).map((r) => r.userId);
  const friendsGoing = [...(await getSummaries(ctx, friendGoingIds.slice(0, 3))).values()];
  return {
    _id: e._id,
    title: e.title,
    cover: e.cover,
    startAt: e.startAt,
    endAt: e.endAt ?? null,
    online: e.online,
    location: locationLine(e),
    city: e.city,
    category: fbCategory(e.category),
    goingCount: e.externalGoingCount + going.length,
    interestedCount: e.externalInterestedCount + interested.length,
    viewerStatus: c.mine.get(e._id)?.status ?? null,
    isHost: e.hostId === c.viewerId,
    host,
    friendsGoing,
    friendsInterested: interested.filter((r) => c.friends.has(r.userId)).length,
  };
}

async function cards(ctx: QueryCtx, evs: Doc<"events">[], c: Ctx) {
  return Promise.all(evs.map((e) => card(ctx, e, c)));
}

async function upcomingVisible(ctx: QueryCtx, c: Ctx) {
  const now = Date.now();
  const all = await ctx.db
    .query("events")
    .withIndex("by_start", (q) => q.gt("startAt", now - 2 * 24 * HOUR))
    .collect();
  return all.filter((e) => isUpcoming(e, now) && canSee(e, c));
}

const popularity = (x: EventCardView) =>
  x.goingCount * 2 + x.interestedCount + (x.friendsGoing.length + x.friendsInterested) * 400;

/* ---------------- Queries ---------------- */

export const discoverFilter = v.union(
  v.literal("top"),
  v.literal("local"),
  v.literal("online"),
  v.literal("following"),
  v.literal("friends"),
);

/** Events home "Discover events" grid. `from`/`to` come from the viewer's local calendar. */
export const discover = viewerQuery({
  args: {
    filter: discoverFilter,
    location: v.optional(v.union(v.literal("local"), v.literal("online"))),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, { filter, location, from, to }) => {
    const c = await loadCtx(ctx, ctx.viewer._id);
    let evs = await upcomingVisible(ctx, c);
    if (from !== undefined) evs = evs.filter((e) => endOf(e) >= from);
    if (to !== undefined) evs = evs.filter((e) => e.startAt < to);
    if (location === "online" || filter === "online") evs = evs.filter((e) => e.online);
    if (location === "local" || filter === "local") evs = evs.filter((e) => !e.online);
    if (filter === "following") {
      const hosts = await getSummaries(
        ctx,
        evs.map((e) => e.hostId),
      );
      evs = evs.filter((e) => hosts.get(e.hostId)?.kind === "page");
    }
    let out = await cards(ctx, evs, c);
    if (filter === "friends")
      out = out.filter((x) => x.friendsGoing.length > 0 || x.friendsInterested > 0);
    if (filter === "top") out.sort((a, b) => popularity(b) - popularity(a));
    else out.sort((a, b) => a.startAt - b.startAt);
    return out;
  },
});

/** Category / text search ("Search Results" list). */
export const search = viewerQuery({
  args: {
    q: v.optional(v.string()),
    place: v.optional(v.string()),
    category: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    popularWithFriends: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const c = await loadCtx(ctx, ctx.viewer._id);
    let evs = await upcomingVisible(ctx, c);
    const q = args.q?.trim().toLowerCase();
    if (args.category) evs = evs.filter((e) => fbCategory(e.category) === args.category);
    if (q && q !== args.category?.toLowerCase())
      evs = evs.filter((e) =>
        [e.title, e.venue ?? "", e.city, e.description, fbCategory(e.category)].some((s) =>
          s.toLowerCase().includes(q),
        ),
      );
    const place = args.place?.trim().toLowerCase();
    if (place)
      evs = evs.filter((e) =>
        (e.online ? "online" : [e.venue, e.address, e.city].join(" "))
          .toLowerCase()
          .includes(place),
      );
    if (args.from !== undefined) {
      const from = args.from;
      evs = evs.filter((e) => endOf(e) >= from);
    }
    if (args.to !== undefined) {
      const to = args.to;
      evs = evs.filter((e) => e.startAt < to);
    }
    let out = await cards(ctx, evs, c);
    if (args.popularWithFriends)
      out = out.filter((x) => x.friendsGoing.length > 0 || x.friendsInterested > 0);
    return out.sort((a, b) => a.startAt - b.startAt);
  },
});

export const yoursTab = v.union(
  v.literal("going"),
  v.literal("interested"),
  v.literal("invitations"),
  v.literal("hosting"),
  v.literal("past"),
);

/** "Your events" tabs. */
export const yours = viewerQuery({
  args: { tab: yoursTab },
  handler: async (ctx, { tab }) => {
    const c = await loadCtx(ctx, ctx.viewer._id);
    const now = Date.now();
    const hosted = await ctx.db
      .query("events")
      .withIndex("by_host", (q) => q.eq("hostId", c.viewerId))
      .collect();
    const responded = (
      await Promise.all([...c.mine.values()].map((r) => ctx.db.get(r.eventId)))
    ).filter((e): e is Doc<"events"> => e !== null);
    let evs: Doc<"events">[];
    if (tab === "hosting") evs = hosted.filter((e) => isUpcoming(e, now));
    else if (tab === "past") {
      const byId = new Map<Id<"events">, Doc<"events">>();
      for (const e of [...hosted, ...responded])
        if (
          !isUpcoming(e, now) &&
          (e.hostId === c.viewerId || c.mine.get(e._id)?.status !== "invited")
        )
          byId.set(e._id, e);
      evs = [...byId.values()].sort((a, b) => b.startAt - a.startAt);
      return cards(ctx, evs, c);
    } else {
      const want: Status = tab === "invitations" ? "invited" : tab;
      evs = responded.filter((e) => isUpcoming(e, now) && c.mine.get(e._id)?.status === want);
    }
    evs.sort((a, b) => a.startAt - b.startAt);
    return cards(ctx, evs, c);
  },
});

/** Counts for the "Your events" rail sub-items. */
export const yourCounts = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("eventResponses")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id).eq("status", "invited"))
      .collect();
    const now = Date.now();
    const evs = await Promise.all(rows.map((r) => ctx.db.get(r.eventId)));
    return { invitations: evs.filter((e) => e && isUpcoming(e, now)).length };
  },
});

/** Event permalink. Null when missing or hidden from the viewer. */
export const get = viewerQuery({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const eventId = ctx.db.normalizeId("events", args.eventId);
    if (!eventId) return null;
    const e = await ctx.db.get(eventId);
    if (!e) return null;
    const c = await loadCtx(ctx, ctx.viewer._id);
    if (!canSee(e, c)) return null;
    const [going, interested, invited, hostDoc, saved, group] = await Promise.all([
      responses(ctx, e._id, "going"),
      responses(ctx, e._id, "interested"),
      responses(ctx, e._id, "invited"),
      ctx.db.get(e.hostId),
      isSaved(ctx, c.viewerId, "event", e._id),
      e.groupId ? ctx.db.get(e.groupId) : null,
    ]);
    if (!hostDoc) return null;
    const hostEvents = await ctx.db
      .query("events")
      .withIndex("by_host", (q) => q.eq("hostId", e.hostId))
      .collect();
    const now = Date.now();
    const friendsOf = (rows: Doc<"eventResponses">[]) =>
      rows.filter((r) => c.friends.has(r.userId)).map((r) => r.userId);
    const fGoing = friendsOf(going);
    const fInterested = friendsOf(interested);
    const people = await getSummaries(ctx, [...fGoing, ...fInterested].slice(0, 12));
    const pick = (ids: Id<"users">[]) =>
      ids.map((id) => people.get(id)).filter((u): u is UserSummary => !!u);
    const host = userSummary(hostDoc);
    return {
      _id: e._id,
      title: e.title,
      cover: e.cover,
      description: e.description,
      category: fbCategory(e.category),
      startAt: e.startAt,
      endAt: e.endAt ?? null,
      online: e.online,
      venue: e.venue ?? null,
      address: e.address ?? null,
      city: e.city,
      privacy: e.privacy,
      tickets: e.ticketUrl
        ? {
            url: e.ticketUrl,
            provider: e.ticketProvider ?? new URL(e.ticketUrl).hostname.replace(/^www\./, ""),
            price: e.ticketPrice ?? null,
          }
        : null,
      group: group ? { _id: group._id, name: group.name, slug: group.slug } : null,
      host,
      hostInfo: {
        bio: hostDoc.bio ?? null,
        pageCategory: hostDoc.pageCategory ?? null,
        followerCount: hostDoc.followerCount ?? null,
        pastEvents: hostEvents.filter((x) => !isUpcoming(x, now)).length,
        isFriend: c.friends.has(hostDoc._id),
      },
      goingCount: e.externalGoingCount + going.length,
      interestedCount: e.externalInterestedCount + interested.length,
      invitedCount: invited.length,
      viewerStatus: c.mine.get(e._id)?.status ?? null,
      isHost: e.hostId === c.viewerId,
      isPast: !isUpcoming(e, now),
      saved,
      friendsGoing: pick(fGoing),
      friendsInterested: pick(fInterested),
      friendsGoingCount: fGoing.length,
      friendsInterestedCount: fInterested.length,
    };
  },
});

/** Guest list dialog: friends first, then everyone else, by response time. */
export const guests = viewerQuery({
  args: {
    eventId: v.id("events"),
    status: v.union(v.literal("going"), v.literal("interested"), v.literal("invited")),
  },
  handler: async (ctx, { eventId, status }) => {
    const e = await ctx.db.get(eventId);
    if (!e) return [];
    const c = await loadCtx(ctx, ctx.viewer._id);
    if (!canSee(e, c)) return [];
    if (status === "invited" && e.hostId !== c.viewerId) return [];
    const rows = await responses(ctx, eventId, status);
    const users = await getSummaries(
      ctx,
      rows.map((r) => r.userId),
    );
    return rows
      .map((r) => ({ user: users.get(r.userId), friend: c.friends.has(r.userId) }))
      .filter((x): x is { user: UserSummary; friend: boolean } => !!x.user)
      .sort(
        (a, b) => Number(b.friend) - Number(a.friend) || a.user.name.localeCompare(b.user.name),
      );
  },
});

/** Friends the viewer could invite, with their current response. */
export const inviteCandidates = viewerQuery({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const ids = await friendIds(ctx, ctx.viewer._id);
    const [users, rows] = await Promise.all([
      getSummaries(ctx, ids),
      ctx.db
        .query("eventResponses")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);
    const status = new Map(rows.map((r) => [r.userId, r.status]));
    const e = await ctx.db.get(eventId);
    return [...users.values()]
      .filter((u) => u.kind === "person" && u._id !== e?.hostId)
      .map((u) => ({ user: u, status: status.get(u._id) ?? null }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  },
});

/** "Recommended events" (rail) / "Suggested events" (event page). */
export const recommended = viewerQuery({
  args: { excludeId: v.optional(v.id("events")), limit: v.optional(v.number()) },
  handler: async (ctx, { excludeId, limit = 3 }) => {
    const c = await loadCtx(ctx, ctx.viewer._id);
    const evs = (await upcomingVisible(ctx, c)).filter(
      (e) => e._id !== excludeId && e.hostId !== c.viewerId && !c.mine.has(e._id),
    );
    const out = await cards(ctx, evs, c);
    return out.sort((a, b) => popularity(b) - popularity(a)).slice(0, limit);
  },
});

/** Discussion tab: posts written in the event, newest first. */
export const discussion = viewerQuery({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const e = await ctx.db.get(eventId);
    if (!e) return [];
    const c = await loadCtx(ctx, ctx.viewer._id);
    if (!canSee(e, c)) return [];
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("desc")
      .take(50);
    return enrichPosts(ctx, posts, await loadAudience(ctx, c.viewerId));
  },
});

/** Event notifications (rail "Notifications"). */
export const notifications = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .take(300);
    const evRows = rows.filter((n) => n.eventId);
    const actors = await getSummaries(
      ctx,
      evRows.flatMap((n) => (n.actorId ? [n.actorId] : [])),
    );
    const out = [];
    for (const n of evRows) {
      const e = n.eventId ? await ctx.db.get(n.eventId) : null;
      if (!e) continue;
      out.push({
        _id: n._id,
        kind: n.kind,
        text: n.text,
        read: n.read,
        createdAt: n.createdAt,
        actor: n.actorId ? (actors.get(n.actorId) ?? null) : null,
        event: { _id: e._id, title: e.title, cover: e.cover, startAt: e.startAt },
      });
    }
    return out;
  },
});

/** Friends' birthdays (the client groups them by its local calendar). */
export const birthdays = viewerQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const ids = await friendIds(ctx, ctx.viewer._id);
    const docs = (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter(
      (u): u is Doc<"users"> => !!u && (u.kind ?? "person") === "person" && !!u.birthday,
    );
    // A birthday set to "Only me" stays off friends' calendars.
    const hidden = await Promise.all(
      docs.map(async (u) => (await detailAudiences(ctx, u._id)).birthday === "Only me"),
    );
    return Promise.all(
      docs
        .filter((_, i) => !hidden[i])
        .map(async (u) => {
          const wall = await ctx.db
            .query("posts")
            .withIndex("by_timeline", (q) => q.eq("timelineUserId", u._id).gte("createdAt", since))
            .collect();
          return {
            user: userSummary(u),
            birthday: u.birthday as string,
            wroteToday: wall.some((p) => p.authorId === ctx.viewer._id),
          };
        }),
    );
  },
});

/* ---------------- Mutations ---------------- */

/** Going / Interested / Can't go. `none` removes the response. */
export const respond = viewerMutation({
  args: {
    eventId: v.id("events"),
    status: v.union(v.literal("going"), v.literal("interested"), v.literal("none")),
  },
  handler: async (ctx, { eventId, status }) => {
    const e = await ctx.db.get(eventId);
    if (!e || !(await canSeeEvent(ctx, e, await loadAudience(ctx, ctx.viewer._id))))
      throw new ConvexError("Event not found");
    const viewerId = ctx.viewer._id;
    const row = await ctx.db
      .query("eventResponses")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", viewerId))
      .unique();
    if (status === "none") {
      if (row) await ctx.db.delete(row._id);
      await undoSignal(ctx, viewerId, ["going", "interested"], eventId);
      return;
    }
    if (row?.status === status) return;
    if (row) await ctx.db.patch(row._id, { status, createdAt: Date.now() });
    else
      await ctx.db.insert("eventResponses", {
        eventId,
        userId: viewerId,
        status,
        createdAt: Date.now(),
      });
    await undoSignal(ctx, viewerId, [status === "going" ? "interested" : "going"], eventId);
    await recordSignal(ctx, viewerId, status, "event", eventId);
    await notify(ctx, {
      userId: e.hostId,
      actorId: viewerId,
      kind: "event_reminder",
      text:
        status === "going"
          ? `is going to your event ${e.title}.`
          : `is interested in your event ${e.title}.`,
      eventId,
    });
  },
});

/** Invite friends; people who already responded are skipped. */
export const invite = viewerMutation({
  args: { eventId: v.id("events"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { eventId, userIds }) => {
    const e = await ctx.db.get(eventId);
    if (!e || !(await canSeeEvent(ctx, e, await loadAudience(ctx, ctx.viewer._id))))
      throw new ConvexError("Event not found");
    const viewerId = ctx.viewer._id;
    const friends = new Set(await friendIds(ctx, viewerId));
    let sent = 0;
    for (const userId of new Set(userIds)) {
      if (!friends.has(userId) || userId === e.hostId) continue;
      const row = await ctx.db
        .query("eventResponses")
        .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
        .unique();
      if (row) continue;
      await ctx.db.insert("eventResponses", {
        eventId,
        userId,
        status: "invited",
        createdAt: Date.now(),
      });
      await notify(ctx, {
        userId,
        actorId: viewerId,
        kind: "event_invite",
        text: `invited you to ${e.title}.`,
        eventId,
      });
      sent++;
    }
    return sent;
  },
});

const eventFields = {
  title: v.string(),
  description: v.string(),
  category: v.string(),
  startAt: v.number(),
  endAt: v.optional(v.number()),
  online: v.boolean(),
  venue: v.optional(v.string()),
  address: v.optional(v.string()),
  city: v.optional(v.string()),
  privacy: v.union(v.literal("public"), v.literal("friends"), v.literal("private")),
  coverStorageId: v.optional(v.id("_storage")),
  /**
   * The venue's coordinates, when the caller knows them (Landing flows do; Facebook's composer
   * has no map picker). Sets the event's neighborhood. On update, omit to keep the current point
   * (it's cleared if the venue or address text changes), or pass null to clear it.
   */
  point: v.optional(v.union(latLng, v.null())),
};

export const DEFAULT_COVER = "/event-cover-default.svg";

function validate(a: { title: string; startAt: number; endAt?: number }) {
  if (!a.title.trim()) throw new ConvexError("Event name is required");
  if (a.endAt !== undefined && a.endAt <= a.startAt)
    throw new ConvexError("End time must be after the start time");
}

export const create = viewerMutation({
  args: eventFields,
  handler: async (ctx, { coverStorageId, point: pointArg, ...a }) => {
    validate(a);
    const cover = coverStorageId ? await ctx.storage.getUrl(coverStorageId) : null;
    const now = Date.now();
    const point = a.online || !pointArg ? undefined : checkPoint(pointArg);
    const eventId = await ctx.db.insert("events", {
      hostId: ctx.viewer._id,
      title: a.title.trim(),
      cover: cover ?? DEFAULT_COVER,
      description: a.description.trim(),
      category: a.category,
      startAt: a.startAt,
      endAt: a.endAt,
      online: a.online,
      venue: a.online ? undefined : a.venue?.trim() || undefined,
      address: a.online ? undefined : a.address?.trim() || undefined,
      city: a.city?.trim() || ctx.viewer.city || "San Francisco, CA",
      privacy: a.privacy,
      externalGoingCount: 0,
      externalInterestedCount: 0,
      createdAt: now,
      point,
      neighborhoodId: await neighborhoodIdAt(ctx, point),
    });
    await ctx.db.insert("eventResponses", {
      eventId,
      userId: ctx.viewer._id,
      status: "going",
      createdAt: now,
    });
    return eventId;
  },
});

export const update = viewerMutation({
  args: { eventId: v.id("events"), ...eventFields },
  handler: async (ctx, { eventId, coverStorageId, point: pointArg, ...a }) => {
    const e = await ctx.db.get(eventId);
    if (!e || e.hostId !== ctx.viewer._id) throw new ConvexError("Only the host can edit");
    validate(a);
    const cover = coverStorageId ? await ctx.storage.getUrl(coverStorageId) : null;
    const venue = a.online ? undefined : a.venue?.trim() || undefined;
    const address = a.online ? undefined : a.address?.trim() || undefined;
    // Keep the point unless the event went online, the venue moved, or the caller set a new one.
    const moved = venue !== e.venue || address !== e.address;
    const point = a.online
      ? undefined
      : pointArg === undefined
        ? moved
          ? undefined
          : e.point
        : pointArg && checkPoint(pointArg);
    await ctx.db.patch(eventId, {
      title: a.title.trim(),
      description: a.description.trim(),
      category: a.category,
      startAt: a.startAt,
      endAt: a.endAt,
      online: a.online,
      venue,
      address,
      city: a.city?.trim() || e.city,
      privacy: a.privacy,
      point: point ?? undefined,
      neighborhoodId: await neighborhoodIdAt(ctx, point),
      ...(cover ? { cover } : {}),
    });
  },
});

/** Write a post in the event's Discussion tab. */
export const post = viewerMutation({
  args: { eventId: v.id("events"), text: v.string() },
  handler: async (ctx, { eventId, text }) => {
    const e = await ctx.db.get(eventId);
    if (!e || !(await canSeeEvent(ctx, e, await loadAudience(ctx, ctx.viewer._id))))
      throw new ConvexError("Event not found");
    const body = text.trim();
    if (!body) throw new ConvexError("A post needs some content");
    const postId = await ctx.db.insert("posts", {
      authorId: ctx.viewer._id,
      eventId,
      text: body,
      media: [],
      attachments: [],
      privacy: e.privacy === "public" ? "public" : "friends",
      createdAt: Date.now(),
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
    });
    await notify(ctx, {
      userId: e.hostId,
      actorId: ctx.viewer._id,
      kind: "event_reminder",
      text: `posted in ${e.title}.`,
      eventId,
      postId,
    });
    return postId;
  },
});
