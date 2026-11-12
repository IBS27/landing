import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Citations, Source } from "../validators";
import { type Audience, canSeeEvent, canView, type GroupChip, groupChip } from "./posts";
import { getSummary, type UserSummary } from "./users";

/**
 * Citations: every score, recommendation and proposal says where it came from.
 *
 * - Store `citations` (from `convex/validators.ts`), built with `cite()` or
 *   `tryCite()`. It can't be empty.
 * - Before storing, call `assertSourcesExist()`. Results cached once and shown
 *   to every viewer must pass `{ publicOnly: true }`, so they can't carry
 *   anything from a private Group or a friends-only post.
 * - When showing, call `resolveCitations()` with the viewer's `loadAudience()`.
 *   It drops deleted sources and anything the viewer can't see, and reads
 *   snippets, counts and ages from the records. Send only its result to the
 *   client, never the raw source ids. Render it with `SourcesChip`
 *   (`src/ui/Citations.tsx`).
 */

export type NonEmpty<T> = readonly [T, ...T[]];

/** Snippets are cut to this many characters, on a word boundary. */
export const SNIPPET_MAX = 160;

/** Stable identity of a source: "post:<id>". For dedupe and for checking model output. */
export function sourceKey(s: Source): string {
  switch (s.kind) {
    case "post":
      return `post:${s.postId}`;
    case "comment":
      return `comment:${s.commentId}`;
    case "event":
      return `event:${s.eventId}`;
    case "listing":
      return `listing:${s.listingId}`;
    case "group":
      return `group:${s.groupId}`;
    case "external":
      return `external:${s.externalSourceId}`;
  }
}

function dedupe<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Citations from at least one source. Duplicates are dropped; order is kept. */
export function cite(sources: NonEmpty<Source>): Citations {
  const [first, ...rest] = dedupe(sources, sourceKey);
  return { first, rest };
}

/** Citations, or null when there are no sources (then don't store the score). */
export function tryCite(sources: readonly Source[]): Citations | null {
  const [first, ...rest] = sources;
  return first ? cite([first, ...rest]) : null;
}

export function sourcesOf(c: Citations): NonEmpty<Source> {
  return [c.first, ...c.rest];
}

/** Collapse whitespace and cut to `max` characters on a word boundary. */
export function snippet(text: string, max = SNIPPET_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** What a post says, for posts with no text: its link, media or share. */
function postText(p: Doc<"posts">) {
  if (p.text?.trim()) return p.text;
  const link = p.attachments.find((a) => a.kind === "link");
  if (link?.kind === "link") return link.title;
  if (p.media.some((m) => m.kind === "video")) return "Video";
  if (p.media.length > 0) return p.media.length === 1 ? "Photo" : `${p.media.length} photos`;
  if (p.sharedPostId) return "Shared a post";
  return "Post";
}

/* ---------- Resolved sources (what the client renders) ---------- */

type Base = { key: string; snippet: string };

export type CitedSource =
  | (Base & {
      kind: "post";
      postId: Id<"posts">;
      author: UserSummary;
      /** Set for Group threads. */
      group: GroupChip | null;
      createdAt: number;
      commentCount: number;
      reactionCount: number;
    })
  | (Base & {
      kind: "comment";
      commentId: Id<"comments">;
      postId: Id<"posts">;
      /** The post author's username, for the permalink. */
      postAuthorUsername: string;
      author: UserSummary;
      group: GroupChip | null;
      createdAt: number;
      replyCount: number;
      reactionCount: number;
    })
  | (Base & {
      kind: "event";
      eventId: Id<"events">;
      title: string;
      image: string;
      startAt: number;
      venue: string | null;
      goingCount: number;
    })
  | (Base & {
      kind: "listing";
      listingId: Id<"listings">;
      title: string;
      image: string | null;
      price: number;
      status: Doc<"listings">["status"];
      neighborhood: string | null;
      createdAt: number;
    })
  | (Base & {
      kind: "group";
      groupId: Id<"groups">;
      slug: string;
      name: string;
      image: string;
      privacy: Doc<"groups">["privacy"];
      memberCount: number;
      lastActivityAt: number;
    })
  | (Base & {
      kind: "external";
      url: string;
      title: string;
      publisher: string;
      fetchedAt: number;
    });

async function goingCount(ctx: QueryCtx, e: Doc<"events">) {
  const going = await ctx.db
    .query("eventResponses")
    .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
    .collect();
  return e.externalGoingCount + going.length;
}

/** One source as the viewer may see it, or null when it's gone or hidden from them. */
async function resolveSource(ctx: QueryCtx, s: Source, a: Audience): Promise<CitedSource | null> {
  const key = sourceKey(s);
  switch (s.kind) {
    case "post": {
      const p = await ctx.db.get(s.postId);
      if (!p || !(await canView(ctx, p, a))) return null;
      const [author, group] = await Promise.all([
        getSummary(ctx, p.authorId),
        p.groupId ? groupChip(ctx, p.groupId) : null,
      ]);
      if (!author) return null;
      return {
        kind: "post",
        key,
        snippet: snippet(postText(p)),
        postId: p._id,
        author,
        group,
        createdAt: p.createdAt,
        commentCount: p.commentCount,
        reactionCount: p.reactionCount,
      };
    }
    case "comment": {
      const c = await ctx.db.get(s.commentId);
      if (!c || a.blocked.has(c.authorId)) return null;
      const p = await ctx.db.get(c.postId);
      if (!p || !(await canView(ctx, p, a))) return null;
      const [author, postAuthor, group] = await Promise.all([
        getSummary(ctx, c.authorId),
        getSummary(ctx, p.authorId),
        p.groupId ? groupChip(ctx, p.groupId) : null,
      ]);
      if (!author || !postAuthor) return null;
      return {
        kind: "comment",
        key,
        snippet: snippet(c.text.trim() || (c.media ? "Photo" : "Comment")),
        commentId: c._id,
        postId: p._id,
        postAuthorUsername: postAuthor.username,
        author,
        group,
        createdAt: c.createdAt,
        replyCount: c.replyCount,
        reactionCount: c.reactionCount,
      };
    }
    case "event": {
      const e = await ctx.db.get(s.eventId);
      if (!e || a.blocked.has(e.hostId) || !(await canSeeEvent(ctx, e, a))) return null;
      return {
        kind: "event",
        key,
        snippet: snippet(e.description),
        eventId: e._id,
        title: e.title,
        image: e.cover,
        startAt: e.startAt,
        venue: e.online ? "Online" : (e.venue ?? null),
        goingCount: await goingCount(ctx, e),
      };
    }
    case "listing": {
      const l = await ctx.db.get(s.listingId);
      if (!l || a.blocked.has(l.sellerId)) return null;
      return {
        kind: "listing",
        key,
        snippet: snippet(l.description),
        listingId: l._id,
        title: l.title,
        image: l.photos[0] ?? null,
        price: l.price,
        status: l.status,
        neighborhood: l.location.neighborhood ?? null,
        createdAt: l.createdAt,
      };
    }
    case "group": {
      const g = await ctx.db.get(s.groupId);
      // Hidden Groups don't exist for non-members. Only the name, description
      // and counts are shown, which visible Groups show everyone anyway.
      if (!g || (!g.visible && !a.groups.has(g._id))) return null;
      return {
        kind: "group",
        key,
        snippet: snippet(g.description),
        groupId: g._id,
        slug: g.slug,
        name: g.name,
        image: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount,
        lastActivityAt: g.lastActivityAt,
      };
    }
    case "external": {
      const x = await ctx.db.get(s.externalSourceId);
      if (!x) return null;
      return {
        kind: "external",
        key,
        snippet: snippet(x.snippet),
        url: x.url,
        title: x.title,
        publisher: x.publisher,
        fetchedAt: x.fetchedAt,
      };
    }
  }
}

/** The sources the viewer can see, in order, without duplicates. */
export async function resolveSources(
  ctx: QueryCtx,
  sources: readonly Source[],
  a: Audience,
): Promise<CitedSource[]> {
  const out = await Promise.all(dedupe(sources, sourceKey).map((s) => resolveSource(ctx, s, a)));
  return out.filter((s): s is CitedSource => s !== null);
}

/**
 * Citations as the viewer may see them, or null when none of the sources are
 * visible to them. Then hide the score or recommendation instead of showing it
 * unsourced.
 */
export async function resolveCitations(
  ctx: QueryCtx,
  c: Citations,
  a: Audience,
): Promise<NonEmpty<CitedSource> | null> {
  const [first, ...rest] = await resolveSources(ctx, sourcesOf(c), a);
  return first ? [first, ...rest] : null;
}

/* ---------- Checks for writers ---------- */

/**
 * True when anyone can see the source, so a result built from it can be cached
 * once and shown to every viewer. Wall posts on someone else's timeline count
 * as restricted, because the timeline owner's settings decide who sees them.
 */
export async function isPublicSource(ctx: QueryCtx, s: Source): Promise<boolean> {
  switch (s.kind) {
    case "post":
      return isPublicPost(ctx, await ctx.db.get(s.postId));
    case "comment": {
      const c = await ctx.db.get(s.commentId);
      return c !== null && isPublicPost(ctx, await ctx.db.get(c.postId));
    }
    case "event": {
      const e = await ctx.db.get(s.eventId);
      return e?.privacy === "public";
    }
    case "listing":
      return (await ctx.db.get(s.listingId)) !== null;
    case "group": {
      const g = await ctx.db.get(s.groupId);
      return g?.visible === true;
    }
    case "external":
      return (await ctx.db.get(s.externalSourceId)) !== null;
  }
}

async function isPublicPost(ctx: QueryCtx, p: Doc<"posts"> | null) {
  if (p?.privacy !== "public") return false;
  if (p.timelineUserId && p.timelineUserId !== p.authorId) return false;
  if (p.groupId) {
    const g = await ctx.db.get(p.groupId);
    if (g?.privacy !== "public") return false;
  }
  if (p.eventId) {
    const e = await ctx.db.get(p.eventId);
    if (e?.privacy !== "public") return false;
  }
  return true;
}

async function sourceExists(ctx: QueryCtx, s: Source) {
  switch (s.kind) {
    case "post":
      return (await ctx.db.get(s.postId)) !== null;
    case "comment":
      return (await ctx.db.get(s.commentId)) !== null;
    case "event":
      return (await ctx.db.get(s.eventId)) !== null;
    case "listing":
      return (await ctx.db.get(s.listingId)) !== null;
    case "group":
      return (await ctx.db.get(s.groupId)) !== null;
    case "external":
      return (await ctx.db.get(s.externalSourceId)) !== null;
  }
}

/**
 * Throws unless every source exists (and, with `publicOnly`, is public). Call
 * it in the mutation that stores a score, recommendation or proposal.
 */
export async function assertSourcesExist(
  ctx: QueryCtx,
  c: Citations,
  opts: { publicOnly?: boolean } = {},
): Promise<void> {
  for (const s of sourcesOf(c)) {
    const ok = opts.publicOnly ? await isPublicSource(ctx, s) : await sourceExists(ctx, s);
    if (!ok)
      throw new ConvexError(
        `Citation source ${sourceKey(s)} ${opts.publicOnly ? "isn't public" : "doesn't exist"}`,
      );
  }
}
