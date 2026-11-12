import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import {
  type CitedSource,
  isPublicSource,
  resolveSources,
  snippet,
  sourceKey,
} from "../lib/citations";
import { type Audience, loadAudience } from "../lib/posts";
import { type Source, source } from "../validators";

/**
 * What an agent reads: #7's resolved source (its `key` is `sourceKey()`, such
 * as `post:<id>`), plus the record's full text. `snippet` is cut short for the
 * sources chip, which is too little to read a thread from.
 */
export type AgentSource = CitedSource & { text: string };

/** Who will see a result: everyone (cached once for every viewer) or one user. */
export type ShownTo = "everyone" | Id<"users">;
export const shownTo = v.union(v.literal("everyone"), v.id("users"));

/** Longest text the model reads from one source. */
const TEXT_MAX = 2_000;

/**
 * Resolves no one: only public sources reach it (see `agentSources`), and it
 * has no friends, Groups or blocks, so it grants nothing beyond them.
 */
const NOBODY: Audience = {
  viewerId: "" as Id<"users">,
  friends: new Set(),
  groups: new Set(),
  adminGroups: new Set(),
  blocked: new Set(),
  hideReactionCounts: { others: false, own: false },
  wallAccess: new Map(),
};

/**
 * The sources an agent may read for a result shown to `shownTo`, in order and
 * without duplicates. For `"everyone"`, only sources that pass
 * `isPublicSource`, so a cached result can't carry anything from a private
 * Group even if it doesn't cite it. For one user, only what that user can see.
 */
export async function agentSources(
  ctx: QueryCtx,
  sources: readonly Source[],
  shownTo: ShownTo,
): Promise<AgentSource[]> {
  let cited: CitedSource[];
  if (shownTo === "everyone") {
    const isPublic = await Promise.all(sources.map((s) => isPublicSource(ctx, s)));
    cited = await resolveSources(
      ctx,
      sources.filter((_, i) => isPublic[i]),
      NOBODY,
    );
  } else {
    cited = await resolveSources(ctx, sources, await loadAudience(ctx, shownTo));
  }
  const byKey = new Map(sources.map((s) => [sourceKey(s), s]));
  return Promise.all(
    cited.map(async (c) => {
      const s = byKey.get(c.key);
      const text = (s && (await fullText(ctx, s))) || c.snippet;
      return { ...c, text: snippet(text, TEXT_MAX) };
    }),
  );
}

/** The record's own text, untruncated; empty when it has none (a photo post). */
async function fullText(ctx: QueryCtx, s: Source): Promise<string | undefined> {
  switch (s.kind) {
    case "post":
      return (await ctx.db.get(s.postId))?.text?.trim();
    case "comment":
      return (await ctx.db.get(s.commentId))?.text.trim();
    case "event":
      return (await ctx.db.get(s.eventId))?.description.trim();
    case "listing":
      return (await ctx.db.get(s.listingId))?.description.trim();
    case "group":
      return (await ctx.db.get(s.groupId))?.description.trim();
    case "external":
      return (await ctx.db.get(s.externalSourceId))?.snippet.trim();
  }
}

/** `agentSources` for `runAgent`, which runs in an action. */
export const resolve = internalQuery({
  args: { sources: v.array(source), shownTo },
  handler: (ctx, { sources, shownTo }) => agentSources(ctx, sources, shownTo),
});

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * How a source is shown to the model, and what the cache key covers: what it
 * says, not live counts, so a new reaction doesn't invalidate cached results.
 */
export function describeSource(s: AgentSource) {
  const base = { key: s.key, kind: s.kind, text: s.text };
  switch (s.kind) {
    case "post":
    case "comment":
      return { ...base, date: day(s.createdAt), group: s.group?.name ?? null };
    case "event":
      return {
        ...base,
        title: s.title,
        startsAt: new Date(s.startAt).toISOString(),
        venue: s.venue,
      };
    case "listing":
      return {
        ...base,
        title: s.title,
        price: s.price,
        status: s.status,
        neighborhood: s.neighborhood,
        date: day(s.createdAt),
      };
    case "group":
      return { ...base, name: s.name, privacy: s.privacy };
    case "external":
      return { ...base, title: s.title, publisher: s.publisher, date: day(s.fetchedAt) };
  }
}
