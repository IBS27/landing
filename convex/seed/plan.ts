/**
 * Turns the hand-authored world (./world) into a fully resolved, internally
 * consistent plan of rows. Cross-references are still natural keys here; the
 * seeding action swaps them for ids as it inserts. Every counter
 * (reactionCount, commentCount, replyCount, shareCount, memberCount, ...) is
 * computed from the planned rows, so the database is consistent by
 * construction. Deterministic for a given `now`.
 */
import type { Doc } from "../_generated/dataModel";
import type { ReactionType } from "../validators";
import { backgrounds } from "./lib/backgrounds";
import { ImagePicker, type Picked } from "./lib/images";
import { neighborhoods } from "./lib/places";
import { type Rng, rng } from "./lib/prng";
import { Clock, DAY, HOUR, MINUTE } from "./lib/time";
import type {
  CommentSeed,
  GroupSlug,
  Handle,
  ListingSeed,
  Mood,
  PostSeed,
  ReplySeed,
  TimeSpec,
  Username,
} from "./types";
import { events as eventSeeds } from "./world/events";
import { groupInvites, mayaSaved } from "./world/extras";
import {
  circles,
  extraFriendships,
  mayaFriends,
  mayaRecentFriends,
  friendRequests as requestSeeds,
} from "./world/friends";
import { groups as groupSeeds } from "./world/groups";
import { listings as goodsSeeds } from "./world/listings";
import { conversations as conversationSeeds } from "./world/messages";
import { pages } from "./world/pages";
import { MAIN, people } from "./world/people";
import { friendPosts } from "./world/posts/friends";
import { groupPosts } from "./world/posts/groups";
import { pagePosts } from "./world/posts/pages";
import { rentals as rentalSeeds } from "./world/rentals";
import { stories as storySeeds } from "./world/stories";

type Row<T extends keyof TableRows> = TableRows[T];
type TableRows = {
  [K in "users" | "groups" | "listings" | "events" | "posts" | "comments" | "stories"]: Omit<
    Doc<K>,
    "_id" | "_creationTime"
  >;
};

export type NotificationKind = Doc<"notifications">["kind"];

export type Plan = ReturnType<typeof buildPlan>;

class SeedError extends Error {}
function fail(msg: string): never {
  throw new SeedError(`[seed] ${msg}`);
}

const MIXES: Record<Mood, Partial<Record<ReactionType, number>>> = {
  default: { like: 70, love: 19, haha: 5, care: 3, wow: 3 },
  love: { like: 42, love: 46, care: 8, wow: 4 },
  haha: { like: 40, haha: 50, love: 10 },
  sad: { like: 20, sad: 50, care: 28, angry: 2 },
  wow: { like: 50, wow: 35, love: 15 },
  care: { like: 30, care: 45, love: 20, sad: 5 },
};
/**
 * Authored reaction counts read as relative popularity. With only ~57 seeded
 * people to react, they're scaled down so totals stay near ~3k rows.
 */
const REACTION_SCALE = 0.45;
function scaleReactions(n: number): number {
  return n <= 0 ? 0 : Math.max(1, Math.round(n * REACTION_SCALE));
}

/** Words that steer listing photo picks when the topic itself has no exact match. */
const CATEGORY_HINTS: Partial<Record<ListingSeed["category"], string>> = {
  furniture: "couch dresser bookshelf office chair lamp",
  electronics: "laptop monitor iphone game console",
  vehicles: "car scooter",
  sporting: "bicycle sneakers",
  apparel: "jacket sneakers",
  household: "lamp mini fridge plant",
  garden: "plant",
  musical: "guitar",
  propertyrentals: "living room bedroom kitchen",
};

const COMMENT_MIX: Partial<Record<ReactionType, number>> = { like: 78, love: 12, haha: 9, care: 1 };

function snippet(text: string | undefined, n = 60): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

export function buildPlan(now: number) {
  const clock = new Clock(now);
  /** Out-of-order references (sharing something before it exists); reported together. */
  const lateRefs: string[] = [];
  const late = (msg: string) => lateRefs.push(msg);
  const pics = new ImagePicker();
  const latest = now - MINUTE;

  // ── Users ───────────────────────────────────────────────────────────────
  const personByName = new Map<string, Username>();
  const isPerson = new Set<string>(people.map((p) => p.username));
  const isPage = new Set<string>(pages.map((p) => p.username));
  const nameOf = new Map<string, string>();
  const genderIndex = { m: 0, w: 0 };
  const coverTopics = ["mountains", "city skyline", "forest", "ocean", "sunset", "lake"];

  const users: { handle: Handle; row: Row<"users"> }[] = [];
  for (const p of people) {
    const r = rng(`user:${p.username}`);
    const birthday =
      p.birthday === "today"
        ? clock.monthDay(0)
        : typeof p.birthday === "object"
          ? clock.monthDay(p.birthday.inDays)
          : p.birthday;
    const alwaysOnline = "alwaysOnline" in p && p.alwaysOnline === true;
    nameOf.set(p.username, p.name);
    personByName.set(p.name, p.username);
    users.push({
      handle: p.username,
      row: {
        name: p.name,
        firstName: p.name.split(" ")[0],
        username: p.username,
        avatar: pics.avatar(p.gender, genderIndex[p.gender]++),
        cover: pics.pick(
          ("cover" in p && p.cover) || r.pick(coverTopics),
          "covers",
          `cover:${p.username}`,
        ).url,
        bio: "bio" in p ? p.bio : undefined,
        pronouns: "pronouns" in p ? p.pronouns : undefined,
        city: p.city,
        hometown: "hometown" in p ? p.hometown : undefined,
        work: "work" in p ? p.work.map((w) => ({ ...w })) : undefined,
        education:
          "education" in p
            ? p.education.map((e) => ({
                school: e.school,
                detail: "detail" in e ? e.detail : undefined,
              }))
            : undefined,
        relationship: "relationship" in p ? p.relationship : undefined,
        birthday,
        verified: "verified" in p && p.verified === true,
        joinedAt: Date.UTC(p.joined, r.int(0, 11), r.int(1, 28), r.int(0, 23)),
        lastActiveAt: alwaysOnline ? now : now - r.int(12, 60 * 30) * MINUTE,
        isPersona: "persona" in p && p.persona === true,
        alwaysOnline: alwaysOnline || undefined,
        kind: "person",
      },
    });
  }
  for (const pg of pages) {
    const r = rng(`page:${pg.username}`);
    nameOf.set(pg.username, pg.name);
    users.push({
      handle: pg.username,
      row: {
        name: pg.name,
        firstName: pg.name,
        username: pg.username,
        avatar: pics.pick(pg.avatar, "pages", `avatar:${pg.username}`, `${pg.category} ${pg.name}`)
          .url,
        cover: pics.pick(pg.cover, "covers", `cover:${pg.username}`, pg.category).url,
        bio: pg.bio,
        city: pg.city,
        verified: "verified" in pg && pg.verified === true,
        joinedAt: Date.UTC(pg.joined, r.int(0, 11), r.int(1, 28)),
        lastActiveAt: now - r.int(30, 60 * 48) * MINUTE,
        isPersona: false,
        kind: "page",
        pageCategory: pg.category,
        followerCount: pg.followers,
      },
    });
  }
  const handles = new Set<string>(users.map((u) => u.handle));
  const checkHandle = (h: string, where: string) => {
    if (!handles.has(h)) fail(`unknown user "${h}" in ${where}`);
  };
  const personas = people
    .filter((p) => "persona" in p && p.persona)
    .map((p) => p.username as Username);

  // ── Friendships & requests ─────────────────────────────────────────────
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const pending = new Set(requestSeeds.map((q) => pairKey(q.from, q.to)));
  const friendPairs = new Map<string, { a: Username; b: Username; createdAt: number }>();
  const addFriends = (a: Username, b: Username, createdAt?: number) => {
    if (a === b) return;
    const k = pairKey(a, b);
    if (pending.has(k) || friendPairs.has(k)) return;
    const r = rng(`friendsince:${k}`);
    friendPairs.set(k, {
      a,
      b,
      createdAt: createdAt ?? now - r.int(40, 1900) * DAY - r.int(0, 86_000) * 1000,
    });
  };
  for (const f of mayaFriends) {
    const recent = (mayaRecentFriends as Partial<Record<string, Parameters<Clock["at"]>[0]>>)[f];
    addFriends(MAIN, f, recent ? clock.at(recent) : undefined);
  }
  for (const c of circles) {
    const ms = c.members as readonly Username[];
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        if (ms[i] === MAIN || ms[j] === MAIN) continue;
        if (rng(`circle:${c.name}:${pairKey(ms[i], ms[j])}`).chance(c.density))
          addFriends(ms[i], ms[j]);
      }
    }
  }
  for (const [a, b] of extraFriendships) addFriends(a, b);

  const friendsOf = new Map<string, Set<string>>();
  for (const { a, b } of friendPairs.values()) {
    if (!friendsOf.has(a)) friendsOf.set(a, new Set());
    if (!friendsOf.has(b)) friendsOf.set(b, new Set());
    friendsOf.get(a)?.add(b);
    friendsOf.get(b)?.add(a);
  }
  const areFriends = (a: string, b: string) => friendsOf.get(a)?.has(b) ?? false;
  for (const p of people) {
    if (!friendsOf.get(p.username)?.size) fail(`${p.username} has no friends`);
  }
  const friendRequests = requestSeeds.map((q) => {
    if (areFriends(q.from, q.to)) fail(`friend request between friends ${q.from} → ${q.to}`);
    return { from: q.from as Username, to: q.to as Username, createdAt: clock.at(q.at) };
  });

  // ── Groups ─────────────────────────────────────────────────────────────
  const groupMembersOf = new Map<GroupSlug, Set<Username>>();
  const groupName = new Map<string, string>();
  const groups: { slug: GroupSlug; createdBy: Username; row: Omit<Row<"groups">, "createdBy"> }[] =
    [];
  const groupMembers: {
    slug: GroupSlug;
    user: Username;
    role: "admin" | "moderator" | "member";
    joinedAt: number;
    lastVisitedAt?: number;
  }[] = [];
  for (const g of groupSeeds) {
    const r = rng(`group:${g.slug}`);
    const createdAt = now - g.createdYearsAgo * 365 * DAY - r.int(0, 200) * DAY;
    const roles = new Map<Username, "admin" | "moderator" | "member">();
    for (const u of g.admins) roles.set(u, "admin");
    for (const u of "moderators" in g ? g.moderators : [])
      if (!roles.has(u)) roles.set(u, "moderator");
    for (const u of g.members) if (!roles.has(u)) roles.set(u, "member");
    groupMembersOf.set(g.slug, new Set(roles.keys()));
    groupName.set(g.slug, g.name);
    let i = 0;
    for (const [user, role] of roles) {
      const mr = rng(`member:${g.slug}:${user}`);
      const span = Math.max(DAY, now - 3 * DAY - createdAt);
      const joinedAt =
        role === "admin" && i === 0 ? createdAt : createdAt + Math.floor(mr.next() * span);
      groupMembers.push({
        slug: g.slug,
        user,
        role,
        joinedAt,
        lastVisitedAt: mr.chance(0.7) ? now - mr.int(5, 60 * 24 * 6) * MINUTE : undefined,
      });
      i++;
    }
    groups.push({
      slug: g.slug,
      createdBy: g.admins[0],
      row: {
        name: g.name,
        slug: g.slug,
        cover: pics.pick(g.cover, "covers", `group:${g.slug}`).url,
        privacy: g.privacy,
        visible: true,
        description: g.description,
        category: g.category,
        location: "location" in g ? g.location : undefined,
        rules: g.rules.map((x) => ({ ...x })),
        tags: [...g.tags],
        createdAt,
        externalMemberCount: g.externalMembers,
        memberCount: g.externalMembers + roles.size,
        lastActivityAt: createdAt,
      },
    });
  }
  const groupSlugs = new Set<string>(groups.map((g) => g.slug));
  const checkGroup = (s: string, where: string) => {
    if (!groupSlugs.has(s)) fail(`unknown group "${s}" in ${where}`);
  };

  // ── Listings ───────────────────────────────────────────────────────────
  const listingTitle = new Map<string, string>();
  const listingSeller = new Map<string, Username>();
  const listingCreated = new Map<string, number>();
  const listingPhoto = new Map<string, string>();
  const listings: {
    key: string;
    seller: Username;
    groups: GroupSlug[];
    row: Omit<Row<"listings">, "sellerId" | "groupIds">;
  }[] = [];
  const allListings: readonly ListingSeed[] = [...goodsSeeds, ...rentalSeeds];
  for (const l of allListings) {
    if (listingTitle.has(l.key)) fail(`duplicate listing key ${l.key}`);
    checkHandle(l.seller, `listing ${l.key}`);
    for (const g of l.groups ?? []) checkGroup(g, `listing ${l.key}`);
    const r = rng(`listing:${l.key}`);
    const hood = neighborhoods[l.hood];
    const createdAt = Math.min(clock.at(l.listed), latest);
    // The library has only a few photos per item type: show as many on-topic photos as exist
    // (up to the authored count) rather than padding with unrelated items.
    const folder = l.rental ? "rooms" : "listings";
    const photos = pics.pickMany(
      l.photos,
      folder,
      `listing:${l.key}`,
      Math.max(1, Math.min(l.photoCount, pics.matchCount(l.photos, folder))),
      `${l.title} ${CATEGORY_HINTS[l.category] ?? ""}`,
    );
    const status = l.status ?? "active";
    const ageDays = (now - createdAt) / DAY;
    listingTitle.set(l.key, l.title);
    listingCreated.set(l.key, createdAt);
    listingSeller.set(l.key, l.seller);
    listingPhoto.set(l.key, photos[0].url);
    listings.push({
      key: l.key,
      seller: l.seller,
      groups: [...(l.groups ?? [])],
      row: {
        title: l.title,
        price: l.price,
        category: l.category,
        condition: l.condition,
        brand: l.brand,
        description: l.description,
        photos: photos.map((p) => p.url),
        location: {
          city: hood.city,
          neighborhood: l.hood,
          lat: Math.round((hood.lat + (r.next() - 0.5) * 0.012) * 1e5) / 1e5,
          lng: Math.round((hood.lng + (r.next() - 0.5) * 0.016) * 1e5) / 1e5,
        },
        status,
        rental: l.rental
          ? {
              propertyType: l.rental.propertyType,
              listingType: l.rental.listingType,
              bedrooms: l.rental.bedrooms,
              bathrooms: l.rental.bathrooms,
              sqft: l.rental.sqft,
              availableFrom: l.rental.availableFrom ? clock.at(l.rental.availableFrom) : undefined,
              availableTo: l.rental.availableTo ? clock.at(l.rental.availableTo) : undefined,
              furnished: l.rental.furnished,
              petsAllowed: l.rental.petsAllowed,
              laundry: l.rental.laundry,
              parking: l.rental.parking,
              address: l.rental.address,
            }
          : undefined,
        badges: [],
        createdAt,
        updatedAt:
          status === "active" ? createdAt : Math.min(latest, createdAt + r.int(6, 72) * HOUR),
        viewCount: l.views ?? Math.round(r.int(8, 60) * (1 + Math.sqrt(ageDays))),
      },
    });
  }
  const checkListing = (k: string, where: string) => {
    if (!listingTitle.has(k)) fail(`unknown listing "${k}" in ${where}`);
  };

  // ── Events ─────────────────────────────────────────────────────────────
  const eventTitle = new Map<string, string>();
  const eventHost = new Map<string, Handle>();
  const eventStart = new Map<string, number>();
  const eventCreated = new Map<string, number>();
  const events: {
    key: string;
    host: Handle;
    group?: GroupSlug;
    row: Omit<Row<"events">, "hostId" | "groupId">;
  }[] = [];
  const eventResponses: {
    event: string;
    user: Username;
    status: "going" | "interested" | "invited";
    createdAt: number;
  }[] = [];
  // Events must exist before any post shares them; their creation time isn't authored, so clamp it.
  const firstEventRef = new Map<string, number>();
  for (const p of [...pagePosts, ...friendPosts, ...groupPosts]) {
    if (!p.event) continue;
    const t = clock.at(p.at);
    firstEventRef.set(p.event, Math.min(firstEventRef.get(p.event) ?? t, t));
  }
  for (const e of eventSeeds) {
    if (eventTitle.has(e.key)) fail(`duplicate event key ${e.key}`);
    checkHandle(e.host, `event ${e.key}`);
    if (e.in) checkGroup(e.in, `event ${e.key}`);
    const r = rng(`event:${e.key}`);
    const startAt = clock.at(e.start);
    const createdAt = Math.min(
      e.created ? clock.at(e.created) : startAt - r.int(9, 24) * DAY,
      latest - r.int(1, 48) * HOUR,
      (firstEventRef.get(e.key) ?? now) - r.int(2, 30) * HOUR,
    );
    eventTitle.set(e.key, e.title);
    eventHost.set(e.key, e.host);
    eventStart.set(e.key, startAt);
    eventCreated.set(e.key, createdAt);
    events.push({
      key: e.key,
      host: e.host,
      group: e.in,
      row: {
        title: e.title,
        cover: pics.pick(e.cover, "events", `event:${e.key}`, `${e.title} ${e.category}`).url,
        description: e.description,
        category: e.category,
        startAt,
        endAt: e.hours ? startAt + e.hours * HOUR : undefined,
        online: e.online ?? false,
        venue: e.venue,
        address: e.address,
        city: e.city ?? "Seattle, WA",
        privacy: e.privacy,
        externalGoingCount: e.externalGoing,
        externalInterestedCount: e.externalInterested,
        createdAt,
      },
    });
    const seen = new Set<string>();
    const respond = (user: Username, status: "going" | "interested" | "invited") => {
      checkHandle(user, `event ${e.key} responses`);
      if (seen.has(user)) return;
      seen.add(user);
      const rr = rng(`response:${e.key}:${user}`);
      const resp = Math.min(
        latest,
        createdAt + Math.floor(rr.next() * Math.max(HOUR, latest - createdAt)),
      );
      eventResponses.push({ event: e.key, user, status, createdAt: resp });
    };
    if (isPerson.has(e.host)) respond(e.host as Username, "going");
    for (const u of e.going ?? []) respond(u, "going");
    for (const u of e.interested ?? []) respond(u, "interested");
    for (const u of e.invited ?? []) respond(u, "invited");
  }
  const checkEvent = (k: string, where: string) => {
    if (!eventTitle.has(k)) fail(`unknown event "${k}" in ${where}`);
  };

  // ── Posts, comments, reactions ─────────────────────────────────────────
  type PostKind = "page" | "group" | "friend";
  type PlannedComment = {
    key: string;
    post: string;
    parent?: string;
    author: Handle;
    row: Omit<Row<"comments">, "postId" | "authorId" | "parentId">;
  };
  type PlannedPost = {
    key: string;
    author: Handle;
    group?: GroupSlug;
    timeline?: Handle;
    share?: string;
    listing?: string;
    event?: string;
    tagged: Username[];
    link?: { url: string; title: string; domain: string; description?: string; image?: string };
    row: Omit<
      Row<"posts">,
      "authorId" | "groupId" | "timelineUserId" | "sharedPostId" | "attachments" | "taggedIds"
    >;
    comments: PlannedComment[];
    reactions: { user: Username; type: ReactionType; createdAt: number }[];
    commentReactions: { comment: string; user: Username; type: ReactionType; createdAt: number }[];
  };
  const allPostSeeds: { seed: PostSeed; kind: PostKind }[] = [
    ...pagePosts.map((seed) => ({ seed, kind: "page" as const })),
    ...friendPosts.map((seed) => ({ seed, kind: "friend" as const })),
    ...groupPosts.map((seed) => ({ seed, kind: "group" as const })),
  ];
  const persons = people.map((p) => p.username as Username);
  const posts: PlannedPost[] = [];
  const postByKey = new Map<string, PlannedPost>();
  const mentionNotes: {
    user: Username;
    actor: Handle;
    post: string;
    comment?: string;
    text: string;
    createdAt: number;
  }[] = [];

  /** Who plausibly reacts to / sees a post, closest first. */
  const audience = (author: Handle, group: GroupSlug | undefined, r: Rng): Username[] => {
    const close: string[] = group
      ? [...(groupMembersOf.get(group) ?? [])]
      : isPage.has(author)
        ? []
        : [...(friendsOf.get(author) ?? [])];
    const closeSet = new Set(close);
    const rest = persons.filter((p) => !closeSet.has(p) && p !== author);
    return [...r.shuffle(close.filter((p) => p !== author)), ...r.shuffle(rest)] as Username[];
  };

  allPostSeeds.forEach(({ seed: s, kind }, idx) => {
    const key = s.key ?? `post-${idx}`;
    if (postByKey.has(key)) fail(`duplicate post key ${key}`);
    const where = `post ${key}`;
    checkHandle(s.by, where);
    if (s.in) checkGroup(s.in, where);
    if (s.on) checkHandle(s.on, where);
    if (s.listing) checkListing(s.listing, where);
    if (s.event) checkEvent(s.event, where);
    for (const t of s.tagged ?? []) checkHandle(t, where);
    if (kind === "group" && !s.in) fail(`group post ${key} has no group`);
    if (s.in && !groupMembersOf.get(s.in)?.has(s.by as Username)) {
      fail(`${s.by} posts in ${s.in} but is not a member (${key})`);
    }
    const r = rng(`post:${key}`);
    const createdAt = Math.min(clock.at(s.at), latest - r.int(1, 20) * MINUTE);
    if (s.listing && (listingCreated.get(s.listing) ?? 0) > createdAt) {
      late(`${where} attaches listing ${s.listing} before it was listed`);
    }
    // Photos within a post stay distinct; a slot whose matching images are all used up by the
    // post's earlier photos is dropped rather than filled with an unrelated picture.
    const inPost = new Set<string>();
    const media: Row<"posts">["media"] = [];
    (s.photos ?? []).forEach((slot, i) => {
      const p: Picked = pics.pick(slot, "posts", `post:${key}:${i}`, s.text, inPost);
      if (inPost.size > 0 && !p.strong && pics.matchCount(slot, "posts") > 0) return;
      inPost.add(p.url);
      media.push({ url: p.url, kind: "image", width: p.width, height: p.height, alt: p.alt });
    });
    const privacy =
      s.privacy ??
      (kind === "friend"
        ? r.chance(0.55)
          ? ("friends" as const)
          : ("public" as const)
        : "public");

    // Comments: desired offsets, then squeeze into [post, now) if needed.
    const flat: {
      seed: ReplySeed;
      parentIdx?: number;
      offset: number;
      key: string;
    }[] = [];
    let cursor = 0;
    (s.comments ?? []).forEach((c: CommentSeed, ci) => {
      cursor = c.after ?? cursor + r.int(2, 40) * (1 + ci * 0.6);
      const ck = c.key ?? `${key}:c${ci}`;
      const parentIdx = flat.length;
      flat.push({ seed: c, offset: cursor, key: ck });
      let rc = cursor;
      (c.replies ?? []).forEach((rep, ri) => {
        rc += rep.after ?? r.int(1, 25) * (1 + ri * 0.4);
        flat.push({ seed: rep, parentIdx, offset: rc, key: rep.key ?? `${ck}:r${ri}` });
      });
    });
    const maxOffset = Math.max(0, ...flat.map((f) => f.offset)) * MINUTE;
    const window = latest - createdAt - MINUTE;
    const scale = maxOffset > window && maxOffset > 0 ? Math.max(0, window) / maxOffset : 1;
    const comments: PlannedComment[] = flat.map((f) => {
      checkHandle(f.seed.by, `${where} comments`);
      if (f.seed.photo === "") fail(`${where}: empty comment photo`);
      const photo = f.seed.photo ? pics.pick(f.seed.photo, "posts", `comment:${f.key}`) : undefined;
      return {
        key: f.key,
        post: key,
        parent: f.parentIdx === undefined ? undefined : flat[f.parentIdx].key,
        author: f.seed.by,
        row: {
          text: f.seed.text,
          media: photo
            ? { url: photo.url, kind: "image", width: photo.width, height: photo.height }
            : undefined,
          createdAt: createdAt + MINUTE + Math.floor(f.offset * MINUTE * scale),
          reactionCount: 0,
          replyCount: 0,
        },
      };
    });
    // Replies must not precede their parents after rounding.
    for (const c of comments) {
      if (c.parent) {
        const parent = comments.find((x) => x.key === c.parent);
        if (parent) {
          c.row.createdAt = Math.max(c.row.createdAt, parent.row.createdAt + 1000);
          parent.row.replyCount++;
        }
      }
    }

    // Post reactions.
    const pool = audience(s.by, s.in, r);
    const defaultCount =
      kind === "page"
        ? r.int(12, 42)
        : kind === "group"
          ? r.weighted({ 0: 2, 2: 3, 5: 3, 9: 2, 14: 1 })
          : r.int(4, 26);
    const wanted = scaleReactions(s.reactions ?? Number(defaultCount));
    const reactors: Username[] = [];
    for (const h of s.likedBy ?? []) {
      checkHandle(h, `${where} likedBy`);
      if (h !== s.by && isPerson.has(h) && !reactors.includes(h as Username))
        reactors.push(h as Username);
    }
    for (const u of pool) {
      if (reactors.length >= wanted) break;
      if (!reactors.includes(u)) reactors.push(u);
    }
    const mix = MIXES[s.mood ?? "default"];
    const span = Math.max(MINUTE, Math.min(2 * DAY, latest - createdAt));
    const reactions = reactors.map((user, i) => ({
      user,
      type: i === 0 && s.mood && s.mood !== "default" ? s.mood : r.weighted(mix),
      createdAt: createdAt + Math.floor(r.next() ** 2 * span),
    }));

    // Comment reactions.
    const commentReactions: PlannedPost["commentReactions"] = [];
    for (const c of comments) {
      const seedLikes = flat.find((f) => f.key === c.key)?.seed.likes;
      const n =
        seedLikes !== undefined
          ? scaleReactions(seedLikes)
          : Number(r.weighted({ 0: 60, 1: 24, 2: 9, 3: 5, 5: 2 }));
      const cpool = pool.filter((u) => u !== c.author);
      const cspan = Math.max(MINUTE, Math.min(DAY, latest - c.row.createdAt));
      for (const user of cpool.slice(0, n)) {
        commentReactions.push({
          comment: c.key,
          user,
          type: r.weighted(COMMENT_MIX),
          createdAt: c.row.createdAt + Math.floor(r.next() ** 2 * cspan),
        });
      }
      c.row.reactionCount = Math.min(n, cpool.length);
      // Mentions: a person's full name in comment text notifies them.
      for (const [name, user] of personByName) {
        if (user !== c.author && c.row.text.includes(name)) {
          mentionNotes.push({
            user,
            actor: c.author,
            post: key,
            comment: c.key,
            text: `mentioned you in a comment: "${snippet(c.row.text)}"`,
            createdAt: c.row.createdAt,
          });
        }
      }
    }

    const planned: PlannedPost = {
      key,
      author: s.by,
      group: s.in,
      timeline: s.in ? undefined : (s.on ?? s.by),
      share: s.share,
      listing: s.listing,
      event: s.event,
      tagged: [...(s.tagged ?? [])],
      link: s.link
        ? {
            url: s.link.url,
            title: s.link.title,
            domain: s.link.domain,
            description: s.link.description,
            image: s.link.image
              ? pics.pick(s.link.image, "posts", `link:${key}`, s.link.title).url
              : undefined,
          }
        : undefined,
      row: {
        text: s.text,
        background: s.bg ? backgrounds[s.bg] : undefined,
        media,
        feeling: s.feeling,
        place: s.place,
        privacy,
        createdAt,
        sponsored: s.sponsored || undefined,
        reactionCount: reactions.length,
        commentCount: comments.length,
        shareCount: 0,
      },
      comments,
      reactions,
      commentReactions,
    };
    posts.push(planned);
    postByKey.set(key, planned);
  });
  for (const p of posts) {
    if (!p.share) continue;
    const original = postByKey.get(p.share);
    if (!original) fail(`post ${p.key} shares unknown post "${p.share}"`);
    if (original.share) fail(`post ${p.key} shares a share (${p.share})`);
    original.row.shareCount++;
    if (original.row.createdAt > p.row.createdAt)
      late(`post ${p.key} shares ${p.share} before it exists`);
  }
  for (const g of groups) {
    for (const p of posts) {
      if (p.group === g.slug)
        g.row.lastActivityAt = Math.max(g.row.lastActivityAt, p.row.createdAt);
    }
  }
  const checkPost = (k: string, where: string) => {
    if (!postByKey.has(k)) fail(`unknown post "${k}" in ${where}`);
  };

  // ── Stories ─────────────────────────────────────────────────────────────
  const stories = storySeeds.map((s, i) => {
    checkHandle(s.by, `story ${i}`);
    const createdAt = Math.max(now - 23 * HOUR, Math.min(clock.at(s.at), latest));
    const p = pics.pick(s.photo, "posts", `story:${s.by}:${i}`, s.text);
    return {
      author: s.by,
      row: {
        media: { url: p.url, kind: "image" as const, width: p.width, height: p.height, alt: p.alt },
        text: s.text,
        createdAt,
        expiresAt: createdAt + DAY,
      },
    };
  });

  // ── Conversations ──────────────────────────────────────────────────────
  type PlannedAttachment =
    | { kind: "image"; url: string; width?: number; height?: number }
    | { kind: "sticker"; emoji: string }
    | { kind: "listing"; listing: string }
    | { kind: "post"; post: string };
  const conversations = conversationSeeds.map((c) => {
    const where = `conversation ${c.key}`;
    const members = new Set<string>(c.members);
    for (const m of c.members) checkHandle(m, where);
    if (c.kind === "marketplace") {
      if (!c.listing) fail(`${where}: marketplace thread without listing`);
      checkListing(c.listing, where);
      const seller = listingSeller.get(c.listing);
      if (seller && !members.has(seller)) fail(`${where}: seller ${seller} not a member`);
    }
    if (c.messages.length === 0) fail(`${where}: no messages`);
    const r = rng(`conv:${c.key}`);
    const last = Math.min(clock.at(c.last), latest);
    // Lay messages out backwards from `last`.
    const times: number[] = new Array(c.messages.length);
    times[c.messages.length - 1] = last;
    for (let i = c.messages.length - 1; i > 0; i--) {
      const gap = c.messages[i].gap ?? r.int(1, 4);
      times[i - 1] = times[i] - gap * MINUTE - r.int(0, 50) * 1000;
    }
    const messages = c.messages.map((m, i) => {
      if (!members.has(m.by)) fail(`${where}: message ${i} by non-member ${m.by}`);
      if (m.replyTo !== undefined && (m.replyTo < 0 || m.replyTo >= i)) {
        fail(`${where}: message ${i} replies to ${m.replyTo}`);
      }
      const attachments: PlannedAttachment[] = [];
      if (m.photo) {
        const p = pics.pick(m.photo, "posts", `msg:${c.key}:${i}`, m.text);
        attachments.push({ kind: "image", url: p.url, width: p.width, height: p.height });
      }
      if (m.sticker) attachments.push({ kind: "sticker", emoji: m.sticker });
      if (m.listing) {
        checkListing(m.listing, where);
        if ((listingCreated.get(m.listing) ?? 0) > times[i]) {
          late(`${where}: message ${i} shares listing ${m.listing} before it was listed`);
        }
        attachments.push({ kind: "listing", listing: m.listing });
      }
      if (m.post) {
        checkPost(m.post, where);
        if ((postByKey.get(m.post)?.row.createdAt ?? 0) > times[i]) {
          late(`${where}: message ${i} shares post ${m.post} before it was posted`);
        }
        attachments.push({ kind: "post", post: m.post });
      }
      if (!m.text && attachments.length === 0) fail(`${where}: empty message ${i}`);
      const reactions = (m.reactions ?? []).map(([user, type]) => {
        if (!members.has(user)) fail(`${where}: reaction by non-member ${user}`);
        return {
          user,
          type,
          createdAt: Math.min(latest, times[i] + r.int(1, 40) * MINUTE),
        };
      });
      return {
        sender: m.by,
        text: m.text,
        attachments,
        replyTo: m.replyTo,
        createdAt: times[i],
        reactions,
      };
    });
    if (c.listing && (listingCreated.get(c.listing) ?? 0) > messages[0].createdAt) {
      late(`${where}: thread starts before listing ${c.listing} was listed`);
    }
    const unreadFor = new Set<string>(c.unreadFor ?? []);
    const unreadCount = c.unreadCount ?? 1;
    const memberState = c.members.map((user) => {
      let lastReadAt = last;
      if (unreadFor.has(user)) {
        const tail = messages.slice(-unreadCount);
        if (tail.some((m) => m.sender === user))
          fail(`${where}: ${user} unread but sent a trailing message`);
        lastReadAt =
          messages.length > unreadCount
            ? messages[messages.length - unreadCount - 1].createdAt
            : messages[0].createdAt - MINUTE;
      }
      return { user, lastReadAt, muted: c.mutedFor?.includes(user) || undefined };
    });
    return {
      key: c.key,
      kind: c.kind,
      title: c.title,
      photo: c.photo ? pics.pick(c.photo, "posts", `convphoto:${c.key}`).url : undefined,
      listing: c.listing,
      members: [...c.members],
      createdAt: messages[0].createdAt,
      lastMessageAt: last,
      memberState,
      messages,
    };
  });

  // ── Saved ───────────────────────────────────────────────────────────────
  const saved: {
    user: Username;
    kind: "post" | "listing" | "event";
    ref: string;
    collection?: string;
    createdAt: number;
  }[] = [];
  /** Authored save times, nudged to after the saved thing exists. */
  const savedAt = (at: TimeSpec, targetCreated = 0) =>
    Math.min(latest, Math.max(clock.at(at), targetCreated + 2 * HOUR));
  for (const s of mayaSaved.posts) {
    checkPost(s.key, "saved");
    saved.push({
      user: MAIN,
      kind: "post",
      ref: s.key,
      collection: "collection" in s ? s.collection : undefined,
      createdAt: savedAt(s.at, postByKey.get(s.key)?.row.createdAt),
    });
  }
  for (const s of mayaSaved.listings) {
    checkListing(s.key, "saved");
    saved.push({
      user: MAIN,
      kind: "listing",
      ref: s.key,
      collection: "collection" in s ? s.collection : undefined,
      createdAt: savedAt(s.at, listingCreated.get(s.key)),
    });
  }
  for (const s of mayaSaved.events) {
    checkEvent(s.key, "saved");
    saved.push({
      user: MAIN,
      kind: "event",
      ref: s.key,
      createdAt: savedAt(s.at, eventCreated.get(s.key)),
    });
  }
  // Other people saving personas' active listings (drives "saved your listing").
  const listingSaves: { user: Username; listing: string; createdAt: number }[] = [];
  for (const l of listings) {
    if (!personas.includes(l.seller) || l.row.status !== "active") continue;
    const r = rng(`saves:${l.key}`);
    const savers = r.sample(
      persons.filter((p) => p !== l.seller && p !== MAIN),
      r.int(0, 3),
    );
    for (const user of savers) {
      const createdAt =
        l.row.createdAt + Math.floor(r.next() * Math.max(HOUR, latest - l.row.createdAt));
      listingSaves.push({ user, listing: l.key, createdAt });
      saved.push({ user, kind: "listing", ref: l.key, createdAt });
    }
  }

  // ── Notifications (derived) ────────────────────────────────────────────
  type Note = {
    user: Username;
    actor?: Handle;
    kind: NotificationKind;
    text: string;
    post?: string;
    comment?: string;
    group?: GroupSlug;
    event?: string;
    listing?: string;
    conversation?: string;
    createdAt: number;
  };
  const notes: Note[] = [];
  const personaSet = new Set<string>(personas);
  for (const p of posts) {
    if (!personaSet.has(p.author)) continue;
    const owner = p.author as Username;
    const others = p.reactions
      .filter((x) => x.user !== owner)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (others.length > 0) {
      const lastR = others[others.length - 1];
      const n = others.length - 1;
      const what = p.row.text
        ? `your post: "${snippet(p.row.text)}"`
        : p.row.media.length
          ? "your photo."
          : "your post.";
      notes.push({
        user: owner,
        actor: lastR.user,
        kind: "reaction",
        text:
          n > 0
            ? `and ${n} ${n === 1 ? "other" : "others"} reacted to ${what}`
            : `reacted to ${what}`,
        post: p.key,
        group: p.group,
        createdAt: lastR.createdAt,
      });
    }
    for (const c of p.comments) {
      if (c.author === owner || c.parent) continue;
      notes.push({
        user: owner,
        actor: c.author,
        kind: "comment",
        text: `commented on your post: "${snippet(c.row.text)}"`,
        post: p.key,
        comment: c.key,
        group: p.group,
        createdAt: c.row.createdAt,
      });
    }
  }
  for (const p of posts) {
    for (const c of p.comments) {
      if (!c.parent) continue;
      const parent = p.comments.find((x) => x.key === c.parent);
      if (!parent || parent.author === c.author || !personaSet.has(parent.author)) continue;
      notes.push({
        user: parent.author as Username,
        actor: c.author,
        kind: "reply",
        text: `replied to your comment: "${snippet(c.row.text)}"`,
        post: p.key,
        comment: c.key,
        group: p.group,
        createdAt: c.row.createdAt,
      });
    }
    for (const t of p.tagged) {
      if (personaSet.has(t) && t !== p.author) {
        notes.push({
          user: t,
          actor: p.author,
          kind: "mention",
          text: p.row.place ? `tagged you in a post at ${p.row.place}.` : "tagged you in a post.",
          post: p.key,
          createdAt: p.row.createdAt + MINUTE,
        });
      }
    }
    if (p.group) {
      for (const member of groupMembersOf.get(p.group) ?? []) {
        if (!personaSet.has(member) || member === p.author) continue;
        if (!rng(`gpnote:${p.key}:${member}`).chance(0.35)) continue;
        notes.push({
          user: member,
          actor: p.author,
          kind: "group_post",
          text: `posted in ${groupName.get(p.group)}${p.row.text ? `: "${snippet(p.row.text)}"` : "."}`,
          post: p.key,
          group: p.group,
          createdAt: p.row.createdAt + 2 * MINUTE,
        });
      }
    }
  }
  for (const m of mentionNotes) {
    if (personaSet.has(m.user)) notes.push({ ...m, kind: "mention" });
  }
  for (const q of friendRequests) {
    if (personaSet.has(q.to)) {
      notes.push({
        user: q.to,
        actor: q.from,
        kind: "friend_request",
        text: "sent you a friend request.",
        createdAt: q.createdAt,
      });
    }
  }
  for (const { a, b, createdAt } of friendPairs.values()) {
    if (now - createdAt > 21 * DAY) continue;
    // The persona (or `a`) sent the request; the other side accepted it.
    const [sender, accepter] = personaSet.has(a) ? [a, b] : [b, a];
    if (personaSet.has(sender)) {
      notes.push({
        user: sender,
        actor: accepter,
        kind: "friend_accept",
        text: "accepted your friend request.",
        createdAt,
      });
    }
  }
  for (const gi of groupInvites) {
    checkGroup(gi.group, "group invite");
    if (!groupMembersOf.get(gi.group)?.has(gi.from))
      fail(`group invite from non-member ${gi.from}`);
    if (groupMembersOf.get(gi.group)?.has(gi.to)) fail(`group invite to member ${gi.to}`);
    notes.push({
      user: gi.to,
      actor: gi.from,
      kind: "group_invite",
      text: `invited you to join ${groupName.get(gi.group)}.`,
      group: gi.group,
      createdAt: clock.at(gi.at),
    });
  }
  for (const er of eventResponses) {
    if (!personaSet.has(er.user)) continue;
    const host = eventHost.get(er.event);
    const start = eventStart.get(er.event) ?? 0;
    const title = eventTitle.get(er.event) ?? "";
    if (er.status === "invited" && host && host !== er.user) {
      notes.push({
        user: er.user,
        actor: host,
        kind: "event_invite",
        text: `invited you to ${title}.`,
        event: er.event,
        createdAt: er.createdAt,
      });
    }
    if (er.status === "going" && start > now && start - now < 4 * DAY) {
      notes.push({
        user: er.user,
        kind: "event_reminder",
        text: `You have an upcoming event: ${title}.`,
        event: er.event,
        createdAt: Math.max(
          er.createdAt + MINUTE,
          latest - rng(`rem:${er.event}`).int(30, 300) * MINUTE,
        ),
      });
    }
  }
  for (const c of conversations) {
    if (c.kind !== "marketplace" || !c.listing) continue;
    const seller = listingSeller.get(c.listing);
    const first = c.messages.find((m) => m.sender !== seller);
    if (!seller || !first || !personaSet.has(seller)) continue;
    notes.push({
      user: seller,
      actor: first.sender,
      kind: "listing_message",
      text: `sent you a message about ${listingTitle.get(c.listing)}.`,
      listing: c.listing,
      conversation: c.key,
      createdAt: first.createdAt,
    });
  }
  for (const s of listingSaves) {
    const seller = listingSeller.get(s.listing);
    if (!seller) continue;
    notes.push({
      user: seller,
      actor: s.user,
      kind: "listing_saved",
      text: `saved your listing: ${listingTitle.get(s.listing)}.`,
      listing: s.listing,
      createdAt: s.createdAt,
    });
  }
  const todayMorning = clock.at({ kind: "clock", days: 0, hm: "08:00" });
  for (const u of users) {
    if (u.row.kind !== "person" || u.row.birthday !== clock.monthDay(0)) continue;
    for (const friend of friendsOf.get(u.handle) ?? []) {
      if (!personaSet.has(friend)) continue;
      notes.push({
        user: friend as Username,
        actor: u.handle,
        kind: "birthday",
        text: "has a birthday today. Help them have a great day!",
        createdAt: todayMorning,
      });
    }
  }
  const memories = posts.filter(
    (p) => personaSet.has(p.author) && now - p.row.createdAt > 300 * DAY,
  );
  for (const m of memories) {
    notes.push({
      user: m.author as Username,
      kind: "memory",
      text: `You have a memory from ${Math.round((now - m.row.createdAt) / (365 * DAY))} years ago. Look back on it today.`,
      post: m.key,
      createdAt: clock.at({ kind: "clock", days: 0, hm: "07:00" }),
    });
  }

  const notifications: (Note & { read: boolean; seen: boolean })[] = [];
  for (const persona of personas) {
    const isMain = persona === MAIN;
    const mine = notes
      .filter((n) => n.user === persona && n.createdAt <= latest && now - n.createdAt <= 14 * DAY)
      .sort((a, b) => b.createdAt - a.createdAt);
    const cap = isMain ? 45 : 10;
    const chosen = new Set<Note>();
    if (isMain) {
      // Make sure every kind appears at least once (the newest of each).
      for (const n of mine) if (![...chosen].some((c) => c.kind === n.kind)) chosen.add(n);
    }
    for (const n of mine) {
      if (chosen.size >= cap) break;
      chosen.add(n);
    }
    const ordered = [...chosen].sort((a, b) => b.createdAt - a.createdAt);
    const unread = isMain ? 12 : 3;
    ordered.forEach((n, i) => {
      notifications.push({ ...n, read: i >= unread, seen: i >= unread });
    });
  }
  for (const n of notifications) {
    if (n.post) checkPost(n.post, "notification");
  }

  if (lateRefs.length) fail(`references before their target exists:\n  ${lateRefs.join("\n  ")}`);

  return {
    now,
    users,
    friendships: [...friendPairs.values()],
    friendRequests,
    groups,
    groupMembers,
    listings,
    events,
    eventResponses,
    posts,
    stories,
    conversations,
    saved,
    notifications,
    personas,
  };
}
