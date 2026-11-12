/**
 * Deterministic seed world. `bun run seed` (= `convex run seed:reset`) wipes
 * every table and rebuilds the fictional San Francisco world from `./seed/world`.
 * `convex run seed:stats` reports counts and checks invariants.
 *
 * Convex caps the work a single mutation can do, so `reset` is an action that
 * orchestrates many small internal mutations: batched deletes per table, then
 * inserts in dependency order, swapping natural keys for ids as it goes.
 */
import type { WithoutSystemFields } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import schema from "./schema";
import { buildPlan } from "./seed/plan";
import { reactionType } from "./validators";

const T = schema.tables;
const TABLES = Object.keys(T) as TableNames[];
const tableName = v.union(...TABLES.map((t) => v.literal(t)));

async function insertAll<N extends TableNames>(
  ctx: MutationCtx,
  table: N,
  rows: WithoutSystemFields<Doc<N>>[],
): Promise<Id<N>[]> {
  const ids: Id<N>[] = [];
  for (const row of rows) ids.push(await ctx.db.insert(table, row));
  return ids;
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Deletes up to one batch of a table; returns how many were deleted. */
export const clearTable = internalMutation({
  args: { table: tableName },
  handler: async (ctx, { table }) => {
    const docs = await ctx.db.query(table).take(1000);
    for (const d of docs) await ctx.db.delete(d._id);
    return docs.length;
  },
});

export const insertUsers = internalMutation({
  args: { rows: v.array(T.users.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "users", rows),
});
export const insertFriendships = internalMutation({
  args: { rows: v.array(T.friendships.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "friendships", rows),
});
/** Pages Maya follows: her old café, her gym, her campus, the local paper, the ramen spot. */
const MAIN_PERSONA_PAGES = new Set([
  "moonrisecoffee",
  "sutroboulders",
  "sathergatecampuslife",
  "fogcityledger",
  "kumoramen",
]);

export const insertFollows = internalMutation({
  args: {
    rows: v.array(
      v.object({ userId: v.id("users"), targetId: v.id("users"), createdAt: v.number() }),
    ),
  },
  handler: (ctx, { rows }) => insertAll(ctx, "follows", rows),
});
export const insertFriendRequests = internalMutation({
  args: { rows: v.array(T.friendRequests.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "friendRequests", rows),
});
export const insertVouches = internalMutation({
  args: { rows: v.array(T.vouches.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "vouches", rows),
});
export const insertGroups = internalMutation({
  args: { rows: v.array(T.groups.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "groups", rows),
});
export const insertGroupMembers = internalMutation({
  args: { rows: v.array(T.groupMembers.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "groupMembers", rows),
});
export const insertListings = internalMutation({
  args: { rows: v.array(T.listings.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "listings", rows),
});
export const insertEvents = internalMutation({
  args: { rows: v.array(T.events.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "events", rows),
});
export const insertEventResponses = internalMutation({
  args: { rows: v.array(T.eventResponses.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "eventResponses", rows),
});
export const insertStories = internalMutation({
  args: { rows: v.array(T.stories.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "stories", rows),
});
/** Saved items, filed into named collections (created per user; "For later" by default). */
export const insertSaved = internalMutation({
  args: {
    rows: v.array(
      v.object({
        userId: v.id("users"),
        kind: T.saved.validator.fields.kind,
        refId: v.string(),
        collection: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const ids = new Map<string, Id<"savedCollections">>();
    // Each user's "For later" dates from their first save, so it lists first.
    const firstSave = new Map<string, number>();
    for (const r of rows)
      firstSave.set(r.userId, Math.min(firstSave.get(r.userId) ?? r.createdAt, r.createdAt));
    for (const { collection, ...row } of rows) {
      const name = collection ?? "For later";
      const key = `${row.userId}|${name}`;
      let collectionId = ids.get(key);
      if (!collectionId) {
        const created = rows
          .filter((r) => r.userId === row.userId && r.collection === collection)
          .reduce((m, r) => Math.min(m, r.createdAt), row.createdAt);
        collectionId = await ctx.db.insert("savedCollections", {
          userId: row.userId,
          name,
          createdAt: collection ? created : (firstSave.get(row.userId) ?? created) - 1,
        });
        ids.set(key, collectionId);
      }
      await ctx.db.insert("saved", { ...row, collectionId });
    }
  },
});
export const insertNotifications = internalMutation({
  args: { rows: v.array(T.notifications.validator) },
  handler: (ctx, { rows }) => insertAll(ctx, "notifications", rows),
});

const reactionIn = v.object({ userId: v.id("users"), type: reactionType, createdAt: v.number() });

/** Posts with their comments (parents before replies) and reactions. */
export const insertPosts = internalMutation({
  args: {
    posts: v.array(
      v.object({
        key: v.string(),
        row: T.posts.validator,
        reactions: v.array(reactionIn),
        comments: v.array(
          v.object({
            key: v.string(),
            parentKey: v.optional(v.string()),
            row: T.comments.validator.omit("postId", "parentId"),
            reactions: v.array(reactionIn),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { posts }) => {
    const postIds: [string, Id<"posts">][] = [];
    const commentIds: [string, Id<"comments">][] = [];
    for (const p of posts) {
      const postId = await ctx.db.insert("posts", p.row);
      postIds.push([p.key, postId]);
      for (const r of p.reactions) {
        await ctx.db.insert("reactions", { targetType: "post", targetId: postId, ...r });
      }
      const local = new Map<string, Id<"comments">>();
      for (const c of p.comments) {
        const parentId = c.parentKey ? local.get(c.parentKey) : undefined;
        if (c.parentKey && !parentId) throw new Error(`reply ${c.key} before its parent`);
        const id = await ctx.db.insert("comments", { ...c.row, postId, parentId });
        local.set(c.key, id);
        commentIds.push([c.key, id]);
        for (const r of c.reactions) {
          await ctx.db.insert("reactions", { targetType: "comment", targetId: id, ...r });
        }
      }
    }
    return { postIds, commentIds };
  },
});

/** Conversations with members, messages (replies resolved in order) and message reactions. */
export const insertConversations = internalMutation({
  args: {
    conversations: v.array(
      v.object({
        key: v.string(),
        row: T.conversations.validator.omit("lastMessageId"),
        members: v.array(T.conversationMembers.validator.omit("conversationId")),
        messages: v.array(
          v.object({
            row: T.messages.validator.omit("conversationId", "replyToId"),
            replyTo: v.optional(v.number()),
            reactions: v.array(reactionIn),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { conversations }) => {
    const out: [string, Id<"conversations">][] = [];
    for (const c of conversations) {
      const conversationId = await ctx.db.insert("conversations", c.row);
      for (const m of c.members)
        await ctx.db.insert("conversationMembers", { ...m, conversationId });
      const ids: Id<"messages">[] = [];
      for (const m of c.messages) {
        const replyToId = m.replyTo === undefined ? undefined : ids[m.replyTo];
        const id = await ctx.db.insert("messages", { ...m.row, conversationId, replyToId });
        ids.push(id);
        for (const r of m.reactions) {
          await ctx.db.insert("reactions", { targetType: "message", targetId: id, ...r });
        }
      }
      await ctx.db.patch(conversationId, { lastMessageId: ids[ids.length - 1] });
      out.push([c.key, conversationId]);
    }
    return out;
  },
});

// ── Orchestration ────────────────────────────────────────────────────────────

function chunks<X>(items: X[], size: number): X[][] {
  const out: X[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Splits items into chunks whose summed weight stays under `budget` documents. */
function weightedChunks<X>(items: X[], weight: (x: X) => number, budget: number): X[][] {
  const out: X[][] = [];
  let cur: X[] = [];
  let w = 0;
  for (const x of items) {
    const xw = weight(x);
    if (cur.length && w + xw > budget) {
      out.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(x);
    w += xw;
  }
  if (cur.length) out.push(cur);
  return out;
}

function lookup<K, V>(map: Map<K, V>, key: K, what: string): V {
  const val = map.get(key);
  if (val === undefined) throw new Error(`[seed] unresolved ${what} "${String(key)}"`);
  return val;
}

type ResetSummary = { ms: number; counts: Record<string, number> };

/**
 * The dev deployment caps write throughput, and the seed writes thousands of
 * rows in parallel batches. Retry a batch with backoff when it is rate limited.
 */
function withWriteRetry<C extends { runMutation: (...a: never[]) => Promise<unknown> }>(ctx: C): C {
  const run = ctx.runMutation.bind(ctx) as (...a: unknown[]) => Promise<unknown>;
  const runMutation = async (...args: unknown[]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await run(...args);
      } catch (e) {
        const limited = e instanceof Error && e.message.includes("Too many writes");
        if (!limited || attempt >= 6) throw e;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  };
  return { ...ctx, runMutation } as C;
}

export const reset = internalAction({
  args: {},
  handler: async (rawCtx): Promise<ResetSummary> => {
    const ctx = withWriteRetry(rawCtx);
    const started = Date.now();

    // 1. Wipe every table.
    await Promise.all(
      TABLES.map(async (table) => {
        for (;;) {
          const n: number = await ctx.runMutation(internal.seed.clearTable, { table });
          if (n === 0) break;
        }
      }),
    );

    // 2. Plan the whole world in memory (validates every cross reference).
    const plan = buildPlan(Date.now());

    // 3. Users. Maya goes in alone first: the client defaults to personas[0].
    const U = new Map<string, Id<"users">>();
    const [first, ...rest] = plan.users;
    const firstIds: Id<"users">[] = await ctx.runMutation(internal.seed.insertUsers, {
      rows: [first.row],
    });
    const restIds: Id<"users">[] = await ctx.runMutation(internal.seed.insertUsers, {
      rows: rest.map((u) => u.row),
    });
    U.set(first.handle, firstIds[0]);
    for (const [i, u] of rest.entries()) U.set(u.handle, restIds[i]);
    const uid = (h: string) => lookup(U, h, "user");

    // 4. Social graph and groups.
    const G = new Map<string, Id<"groups">>();
    await Promise.all([
      ctx.runMutation(internal.seed.insertFriendships, {
        rows: plan.friendships.flatMap((f) => [
          { userId: uid(f.a), friendId: uid(f.b), createdAt: f.createdAt },
          { userId: uid(f.b), friendId: uid(f.a), createdAt: f.createdAt },
        ]),
      }),
      // Page follows: the main persona follows the Pages in her life (5 of 8, so Discover still
      // has Follow buttons; Fogline reaches her through ads only); others follow a stable ~70%.
      ctx.runMutation(internal.seed.insertFollows, {
        rows: plan.users
          .filter((u) => u.row.kind !== "page")
          .flatMap((person, i) =>
            plan.users
              .filter((u) => u.row.kind === "page")
              .filter((page, j) =>
                i === 0 ? MAIN_PERSONA_PAGES.has(page.handle) : (i * 7 + j * 3) % 10 >= 3,
              )
              .map((page) => ({
                userId: uid(person.handle),
                targetId: uid(page.handle),
                createdAt: person.row.joinedAt,
              })),
          ),
      }),
      ctx.runMutation(internal.seed.insertFriendRequests, {
        rows: plan.friendRequests.map((q) => ({
          fromId: uid(q.from),
          toId: uid(q.to),
          createdAt: q.createdAt,
        })),
      }),
      ctx.runMutation(internal.seed.insertVouches, {
        rows: plan.vouches.map((x) => ({
          voucherId: uid(x.voucher),
          subjectId: uid(x.subject),
          relationship: x.relationship,
          note: x.note,
          createdAt: x.createdAt,
          updatedAt: x.createdAt,
        })),
      }),
      (async () => {
        const ids: Id<"groups">[] = await ctx.runMutation(internal.seed.insertGroups, {
          rows: plan.groups.map((g) => ({ ...g.row, createdBy: uid(g.createdBy) })),
        });
        for (const [i, g] of plan.groups.entries()) G.set(g.slug, ids[i]);
      })(),
    ]);
    const gid = (s: string) => lookup(G, s, "group");

    // 5. Group members, listings, events (independent of each other).
    const L = new Map<string, Id<"listings">>();
    const E = new Map<string, Id<"events">>();
    await Promise.all([
      ctx.runMutation(internal.seed.insertGroupMembers, {
        rows: plan.groupMembers.map((m) => ({
          groupId: gid(m.slug),
          userId: uid(m.user),
          role: m.role,
          joinedAt: m.joinedAt,
          lastVisitedAt: m.lastVisitedAt,
        })),
      }),
      (async () => {
        const ids: Id<"listings">[] = await ctx.runMutation(internal.seed.insertListings, {
          rows: plan.listings.map((l) => ({
            ...l.row,
            sellerId: uid(l.seller),
            groupIds: l.groups.length ? l.groups.map(gid) : undefined,
          })),
        });
        for (const [i, l] of plan.listings.entries()) L.set(l.key, ids[i]);
      })(),
      (async () => {
        const ids: Id<"events">[] = await ctx.runMutation(internal.seed.insertEvents, {
          rows: plan.events.map((e) => ({
            ...e.row,
            hostId: uid(e.host),
            groupId: e.group ? gid(e.group) : undefined,
          })),
        });
        for (const [i, e] of plan.events.entries()) E.set(e.key, ids[i]);
      })(),
    ]);
    const lid = (k: string) => lookup(L, k, "listing");
    const eid = (k: string) => lookup(E, k, "event");
    await ctx.runMutation(internal.seed.insertEventResponses, {
      rows: plan.eventResponses.map((r) => ({
        eventId: eid(r.event),
        userId: uid(r.user),
        status: r.status,
        createdAt: r.createdAt,
      })),
    });

    // 6. Posts with comments and reactions; originals first, then shares.
    const P = new Map<string, Id<"posts">>();
    const C = new Map<string, Id<"comments">>();
    const toPostArg = (p: (typeof plan.posts)[number]) => {
      const attachments: Doc<"posts">["attachments"] = [];
      if (p.listing) attachments.push({ kind: "listing", listingId: lid(p.listing) });
      if (p.event) attachments.push({ kind: "event", eventId: eid(p.event) });
      if (p.link) attachments.push({ kind: "link", ...p.link });
      const reactionsFor = (key: string) =>
        p.commentReactions
          .filter((r) => r.comment === key)
          .map((r) => ({ userId: uid(r.user), type: r.type, createdAt: r.createdAt }));
      return {
        key: p.key,
        row: {
          ...p.row,
          authorId: uid(p.author),
          groupId: p.group ? gid(p.group) : undefined,
          timelineUserId: p.timeline ? uid(p.timeline) : undefined,
          sharedPostId: p.share ? lookup(P, p.share, "shared post") : undefined,
          attachments,
          taggedIds: p.tagged.length ? p.tagged.map(uid) : undefined,
        },
        reactions: p.reactions.map((r) => ({
          userId: uid(r.user),
          type: r.type,
          createdAt: r.createdAt,
        })),
        comments: p.comments.map((c) => ({
          key: c.key,
          parentKey: c.parent,
          row: { ...c.row, authorId: uid(c.author) },
          reactions: reactionsFor(c.key),
        })),
      };
    };
    const postWeight = (p: (typeof plan.posts)[number]) =>
      1 + p.reactions.length + p.comments.length + p.commentReactions.length;
    for (const phase of [plan.posts.filter((p) => !p.share), plan.posts.filter((p) => p.share)]) {
      await Promise.all(
        weightedChunks(phase, postWeight, 600).map(async (batch) => {
          const res: { postIds: [string, Id<"posts">][]; commentIds: [string, Id<"comments">][] } =
            await ctx.runMutation(internal.seed.insertPosts, { posts: batch.map(toPostArg) });
          for (const [k, id] of res.postIds) P.set(k, id);
          for (const [k, id] of res.commentIds) C.set(k, id);
        }),
      );
    }
    const pid = (k: string) => lookup(P, k, "post");

    // 7. Stories and conversations.
    const CV = new Map<string, Id<"conversations">>();
    await Promise.all([
      ctx.runMutation(internal.seed.insertStories, {
        rows: plan.stories.map((s) => ({ ...s.row, authorId: uid(s.author) })),
      }),
      ...chunks(plan.conversations, 6).map(async (batch) => {
        const res: [string, Id<"conversations">][] = await ctx.runMutation(
          internal.seed.insertConversations,
          {
            conversations: batch.map((c) => ({
              key: c.key,
              row: {
                kind: c.kind,
                title: c.title,
                photo: c.photo,
                listingId: c.listing ? lid(c.listing) : undefined,
                memberIds: c.members.map(uid),
                createdAt: c.createdAt,
                lastMessageAt: c.lastMessageAt,
              },
              members: c.memberState.map((m) => ({
                userId: uid(m.user),
                lastReadAt: m.lastReadAt,
                lastMessageAt: c.lastMessageAt,
                muted: m.muted,
              })),
              messages: c.messages.map((m) => ({
                row: {
                  senderId: uid(m.sender),
                  author: { kind: "human" as const },
                  status: "sent" as const,
                  text: m.text,
                  attachments: m.attachments.map((a) =>
                    a.kind === "listing"
                      ? { kind: "listing" as const, listingId: lid(a.listing) }
                      : a.kind === "post"
                        ? { kind: "post" as const, postId: pid(a.post) }
                        : a,
                  ),
                  createdAt: m.createdAt,
                },
                replyTo: m.replyTo,
                reactions: m.reactions.map((r) => ({
                  userId: uid(r.user),
                  type: r.type,
                  createdAt: r.createdAt,
                })),
              })),
            })),
          },
        );
        for (const [k, id] of res) CV.set(k, id);
      }),
    ]);

    // 8. Saved items and notifications.
    const refId = (kind: "post" | "listing" | "event", key: string): string =>
      kind === "post" ? pid(key) : kind === "listing" ? lid(key) : eid(key);
    await Promise.all([
      ctx.runMutation(internal.seed.insertSaved, {
        rows: plan.saved.map((s) => ({
          userId: uid(s.user),
          kind: s.kind,
          refId: refId(s.kind, s.ref),
          collection: s.collection,
          createdAt: s.createdAt,
        })),
      }),
      ctx.runMutation(internal.seed.insertNotifications, {
        rows: plan.notifications.map((n) => ({
          userId: uid(n.user),
          actorId: n.actor ? uid(n.actor) : undefined,
          kind: n.kind,
          text: n.text,
          postId: n.post ? pid(n.post) : undefined,
          commentId: n.comment ? lookup(C, n.comment, "comment") : undefined,
          groupId: n.group ? gid(n.group) : undefined,
          eventId: n.event ? eid(n.event) : undefined,
          listingId: n.listing ? lid(n.listing) : undefined,
          conversationId: n.conversation ? lookup(CV, n.conversation, "conversation") : undefined,
          read: n.read,
          seen: n.seen,
          createdAt: n.createdAt,
        })),
      }),
    ]);

    // Demo rentals for "Things to check" (#11).
    await ctx.runMutation(internal.trust.seedDemo, {});

    const reactionRows =
      plan.posts.reduce((s, p) => s + p.reactions.length + p.commentReactions.length, 0) +
      plan.conversations.reduce(
        (s, c) => s + c.messages.reduce((t, m) => t + m.reactions.length, 0),
        0,
      );
    return {
      ms: Date.now() - started,
      counts: {
        users: plan.users.length,
        friendships: plan.friendships.length * 2,
        friendRequests: plan.friendRequests.length,
        vouches: plan.vouches.length,
        groups: plan.groups.length,
        groupMembers: plan.groupMembers.length,
        listings: plan.listings.length,
        events: plan.events.length,
        eventResponses: plan.eventResponses.length,
        posts: plan.posts.length,
        comments: plan.posts.reduce((s, p) => s + p.comments.length, 0),
        reactions: reactionRows,
        stories: plan.stories.length,
        conversations: plan.conversations.length,
        messages: plan.conversations.reduce((s, c) => s + c.messages.length, 0),
        saved: plan.saved.length,
        notifications: plan.notifications.length,
      },
    };
  },
});

// ── Stats & invariants ───────────────────────────────────────────────────────

/** Counts per table plus consistency checks. `convex run seed:stats`. */
export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = async <N extends TableNames>(t: N) => (await ctx.db.query(t).collect()) as Doc<N>[];
    const [
      users,
      friendships,
      friendRequests,
      groups,
      groupMembers,
      posts,
      comments,
      reactions,
      stories,
      saved,
      listings,
      conversations,
      conversationMembers,
      messages,
      events,
      eventResponses,
      notifications,
    ] = await Promise.all([
      all("users"),
      all("friendships"),
      all("friendRequests"),
      all("groups"),
      all("groupMembers"),
      all("posts"),
      all("comments"),
      all("reactions"),
      all("stories"),
      all("saved"),
      all("listings"),
      all("conversations"),
      all("conversationMembers"),
      all("messages"),
      all("events"),
      all("eventResponses"),
      all("notifications"),
    ]);
    const problems: string[] = [];
    const ids = (docs: { _id: string }[]) => new Set<string>(docs.map((d) => d._id));
    const has = {
      users: ids(users),
      groups: ids(groups),
      posts: ids(posts),
      comments: ids(comments),
      listings: ids(listings),
      conversations: ids(conversations),
      messages: ids(messages),
      events: ids(events),
    };
    const ref = (set: keyof typeof has, id: string | undefined, where: string) => {
      if (id !== undefined && !has[set].has(id)) problems.push(`dangling ${set} id in ${where}`);
    };
    const tally = (keys: string[]) => {
      const m = new Map<string, number>();
      for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    };

    const reactionsBy = tally(reactions.map((r) => `${r.targetType}:${r.targetId}`));
    const commentsByPost = tally(comments.map((c) => c.postId));
    const repliesBy = tally(comments.flatMap((c) => (c.parentId ? [c.parentId] : [])));
    const sharesBy = tally(posts.flatMap((p) => (p.sharedPostId ? [p.sharedPostId] : [])));
    for (const p of posts) {
      const w = `post ${p._id}`;
      if (p.reactionCount !== (reactionsBy.get(`post:${p._id}`) ?? 0))
        problems.push(`${w} reactionCount`);
      if (p.commentCount !== (commentsByPost.get(p._id) ?? 0)) problems.push(`${w} commentCount`);
      if (p.shareCount !== (sharesBy.get(p._id) ?? 0)) problems.push(`${w} shareCount`);
      ref("users", p.authorId, w);
      ref("groups", p.groupId, w);
      ref("users", p.timelineUserId, w);
      ref("posts", p.sharedPostId, w);
      for (const t of p.taggedIds ?? []) ref("users", t, w);
      for (const a of p.attachments) {
        if (a.kind === "listing") ref("listings", a.listingId, w);
        if (a.kind === "event") ref("events", a.eventId, w);
      }
    }
    for (const c of comments) {
      const w = `comment ${c._id}`;
      if (c.reactionCount !== (reactionsBy.get(`comment:${c._id}`) ?? 0))
        problems.push(`${w} reactionCount`);
      if (c.replyCount !== (repliesBy.get(c._id) ?? 0)) problems.push(`${w} replyCount`);
      ref("posts", c.postId, w);
      ref("users", c.authorId, w);
      ref("comments", c.parentId, w);
    }
    const seenReaction = new Set<string>();
    for (const r of reactions) {
      const k = `${r.targetType}:${r.targetId}:${r.userId}`;
      if (seenReaction.has(k)) problems.push(`duplicate reaction ${k}`);
      seenReaction.add(k);
      ref("users", r.userId, "reaction");
      ref(
        r.targetType === "post" ? "posts" : r.targetType === "comment" ? "comments" : "messages",
        r.targetId,
        "reaction",
      );
    }
    const pairs = new Set(friendships.map((f) => `${f.userId}|${f.friendId}`));
    for (const f of friendships) {
      if (!pairs.has(`${f.friendId}|${f.userId}`)) problems.push(`one-way friendship ${f._id}`);
      ref("users", f.userId, "friendship");
      ref("users", f.friendId, "friendship");
    }
    for (const q of friendRequests) {
      ref("users", q.fromId, "friendRequest");
      ref("users", q.toId, "friendRequest");
      if (pairs.has(`${q.fromId}|${q.toId}`)) problems.push(`request between friends ${q._id}`);
    }
    const membersByGroup = tally(groupMembers.map((m) => m.groupId));
    for (const g of groups) {
      ref("users", g.createdBy, `group ${g.slug}`);
      if (g.memberCount !== g.externalMemberCount + (membersByGroup.get(g._id) ?? 0)) {
        problems.push(`group ${g.slug} memberCount`);
      }
    }
    for (const m of groupMembers) {
      ref("groups", m.groupId, "groupMember");
      ref("users", m.userId, "groupMember");
    }
    for (const l of listings) {
      ref("users", l.sellerId, `listing ${l._id}`);
      for (const g of l.groupIds ?? []) ref("groups", g, `listing ${l._id}`);
    }
    for (const e of events) {
      ref("users", e.hostId, `event ${e._id}`);
      ref("groups", e.groupId, `event ${e._id}`);
    }
    for (const r of eventResponses) {
      ref("events", r.eventId, "eventResponse");
      ref("users", r.userId, "eventResponse");
    }
    for (const s of stories) ref("users", s.authorId, "story");
    for (const s of saved) {
      ref("users", s.userId, "saved");
      ref(
        s.kind === "post" ? "posts" : s.kind === "listing" ? "listings" : "events",
        s.refId,
        "saved",
      );
    }
    const messagesByConv = new Map<string, Doc<"messages">[]>();
    for (const m of messages) {
      const w = `message ${m._id}`;
      ref("conversations", m.conversationId, w);
      ref("users", m.senderId, w);
      ref("messages", m.replyToId, w);
      for (const a of m.attachments) {
        if (a.kind === "listing") ref("listings", a.listingId, w);
        if (a.kind === "post") ref("posts", a.postId, w);
      }
      messagesByConv.set(m.conversationId, [...(messagesByConv.get(m.conversationId) ?? []), m]);
    }
    const membersByConv = new Map<string, Doc<"conversationMembers">[]>();
    for (const m of conversationMembers) {
      ref("conversations", m.conversationId, "conversationMember");
      ref("users", m.userId, "conversationMember");
      membersByConv.set(m.conversationId, [...(membersByConv.get(m.conversationId) ?? []), m]);
    }
    for (const c of conversations) {
      const w = `conversation ${c._id}`;
      ref("listings", c.listingId, w);
      for (const u of c.memberIds) ref("users", u, w);
      const ms = (messagesByConv.get(c._id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
      const last = ms[ms.length - 1];
      if (!last || c.lastMessageId !== last._id || c.lastMessageAt !== last.createdAt) {
        problems.push(`${w} lastMessage mismatch`);
      }
      const cm = membersByConv.get(c._id) ?? [];
      if (cm.length !== c.memberIds.length) problems.push(`${w} member rows`);
      for (const m of cm)
        if (m.lastMessageAt !== c.lastMessageAt) problems.push(`${w} member lastMessageAt`);
      for (const m of ms)
        if (!c.memberIds.includes(m.senderId)) problems.push(`${w} sender not a member`);
    }
    for (const n of notifications) {
      const w = `notification ${n._id}`;
      ref("users", n.userId, w);
      ref("users", n.actorId, w);
      ref("posts", n.postId, w);
      ref("comments", n.commentId, w);
      ref("groups", n.groupId, w);
      ref("events", n.eventId, w);
      ref("listings", n.listingId, w);
      ref("conversations", n.conversationId, w);
    }

    // Main-persona overview.
    const personas = users
      .filter((u) => u.isPersona)
      .sort((a, b) => a._creationTime - b._creationTime);
    const main = personas[0];
    const mainFriends = new Set(
      friendships.filter((f) => f.userId === main?._id).map((f) => f.friendId),
    );
    const fof = new Set(
      friendships
        .filter(
          (f) =>
            mainFriends.has(f.userId) && f.friendId !== main?._id && !mainFriends.has(f.friendId),
        )
        .map((f) => f.friendId),
    );
    const mainMemberships = conversationMembers.filter((m) => m.userId === main?._id);
    const mainNotes = notifications.filter((n) => n.userId === main?._id);
    const now = Date.now();
    return {
      counts: {
        users: users.length,
        people: users.filter((u) => u.kind !== "page").length,
        pages: users.filter((u) => u.kind === "page").length,
        friendships: friendships.length,
        friendRequests: friendRequests.length,
        groups: groups.length,
        groupMembers: groupMembers.length,
        posts: posts.length,
        comments: comments.length,
        replies: comments.filter((c) => c.parentId).length,
        reactions: reactions.length,
        stories: stories.length,
        activeStories: stories.filter((s) => s.expiresAt > now).length,
        saved: saved.length,
        listings: listings.length,
        rentals: listings.filter((l) => l.rental).length,
        conversations: conversations.length,
        conversationMembers: conversationMembers.length,
        messages: messages.length,
        events: events.length,
        upcomingEvents: events.filter((e) => e.startAt > now).length,
        eventResponses: eventResponses.length,
        notifications: notifications.length,
      },
      personas: personas.map((p) => `${p.name} (@${p.username})`),
      main: main && {
        name: main.name,
        friends: mainFriends.size,
        incomingRequests: friendRequests.filter((q) => q.toId === main._id).length,
        outgoingRequests: friendRequests.filter((q) => q.fromId === main._id).length,
        peopleYouMayKnow: fof.size,
        groups: groupMembers.filter((m) => m.userId === main._id).length,
        conversations: mainMemberships.length,
        unreadConversations: mainMemberships.filter((m) => m.lastReadAt < m.lastMessageAt).length,
        notifications: mainNotes.length,
        unreadNotifications: mainNotes.filter((n) => !n.read).length,
        notificationKinds: [...new Set(mainNotes.map((n) => n.kind))].sort(),
        listings: listings
          .filter((l) => l.sellerId === main._id)
          .map((l) => `${l.title} [${l.status}]`),
        saved: saved.filter((s) => s.userId === main._id).length,
        birthdaysToday: users
          .filter((u) => mainFriends.has(u._id) && u.birthday === monthDayLocal(now))
          .map((u) => u.name),
      },
      problemCount: problems.length,
      problems: problems.slice(0, 40),
    };
  },
});

function monthDayLocal(t: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(t));
  return `${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}
