import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  assertCitable,
  type CitedSource,
  isPublicSource,
  type NonEmpty,
  resolveCitations,
  resolveSources,
  sourceKey,
  sourcesOf,
  tryCite,
} from "./lib/citations";
import { getProfile, interestWeights } from "./lib/cityProfile";
import { viewerQuery } from "./lib/functions";
import { getInterest } from "./lib/interests";
import {
  breakdown,
  clockTime,
  type FitItem,
  HOW_CALCULATED,
  interestFit,
  interestsForLocalEvent,
  interestsForLocalGroup,
  interestsForPlace,
  MAX_SOURCES,
  type PlaceMention,
  percentiles,
  pickNightQuotes,
  rawScore,
  type ScoreInputs,
  scoreLabel,
  scoreSources,
} from "./lib/neighborhoodScores";
import { mentions, placesIn } from "./lib/places";
import { type Audience, loadAudience } from "./lib/posts";
import {
  type NeighborhoodScoreKind,
  neighborhoodScoreKind,
  type Source,
  source,
} from "./validators";

/**
 * Neighborhood scores (#17). `recompute` stores the three shared scores (things
 * to do, food, transit) with public citations; `get` shows them to a viewer
 * with interest fit (personal, never stored) and the "Getting around at night"
 * facts. Scoring itself is in `convex/lib/neighborhoodScores.ts`.
 */

const DAY = 86_400_000;
const KINDS: NeighborhoodScoreKind[] = ["things_to_do", "food", "transit"];
/** Group threads older than this don't count toward places locals recommend. */
const THREAD_WINDOW = 365 * DAY;
/** Caps that keep every read bounded: Groups, newest posts per Group, comments per post, all texts, and Events. */
const MAX_GROUPS = 50;
const POSTS_PER_GROUP = 50;
const COMMENTS_PER_POST = 30;
const MAX_TEXTS = 400;
const MAX_EVENTS = 100;

type ThreadText = { source: Source; text: string; reactions: number; createdAt: number };

/**
 * The neighborhood's Groups, and the text of the newest public posts in its public Groups with
 * their comments. Only public text: it may back a score everyone sees.
 */
async function neighborhoodThreads(
  ctx: QueryCtx,
  neighborhoodId: Id<"neighborhoods">,
  now: number,
) {
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
    .take(MAX_GROUPS);
  const texts: ThreadText[] = [];
  for (const g of groups.filter((x) => x.privacy === "public" && x.visible)) {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id).gte("createdAt", now - THREAD_WINDOW))
      .order("desc")
      .take(POSTS_PER_GROUP);
    for (const p of posts) {
      if (texts.length >= MAX_TEXTS) break;
      // A post in a public Group can still be restricted (its own audience, a wall post).
      if (!(await isPublicSource(ctx, { kind: "post", postId: p._id }))) continue;
      texts.push({
        source: { kind: "post", postId: p._id },
        text: p.text ?? "",
        reactions: p.reactionCount,
        createdAt: p.createdAt,
      });
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .take(COMMENTS_PER_POST);
      for (const c of comments) {
        if (texts.length >= MAX_TEXTS) break;
        // A comment on a public post is public while its author exists (`isPublicSource`).
        if (!(await ctx.db.get(c.authorId))) continue;
        texts.push({
          source: { kind: "comment", commentId: c._id },
          text: c.text,
          reactions: c.reactionCount,
          createdAt: c.createdAt,
        });
      }
    }
  }
  return { groups, texts };
}

/**
 * #15 places of this neighborhood that its threads name, with where they're named: by name or
 * alias, as whole words (#18's matching), so "Union St" doesn't match inside "Union stay".
 */
function placeMentions(slug: string, texts: readonly ThreadText[]): PlaceMention[] {
  return placesIn(slug)
    .map((p) => ({
      key: p.key,
      name: p.name,
      kind: p.kind,
      mentions: texts
        .filter((t) => mentions(t.text, p))
        .map((t) => ({ source: t.source, reactions: t.reactions })),
    }))
    .filter((p) => p.mentions.length > 0);
}

/** Everything the shared scores count for one neighborhood, from public data only. */
async function gather(ctx: QueryCtx, n: Doc<"neighborhoods">, now: number): Promise<ScoreInputs> {
  const events: ScoreInputs["events"] = [];
  const upcoming = await ctx.db
    .query("events")
    .withIndex("by_neighborhood", (q) =>
      q
        .eq("neighborhoodId", n._id)
        .gte("startAt", now)
        .lt("startAt", now + 30 * DAY),
    )
    .take(MAX_EVENTS);
  for (const e of upcoming) {
    if (e.online || !(await isPublicSource(ctx, { kind: "event", eventId: e._id }))) continue;
    events.push({ id: e._id, startAt: e.startAt, category: e.category, title: e.title });
  }
  const { groups, texts } = await neighborhoodThreads(ctx, n._id, now);
  const facts = await ctx.db
    .query("neighborhoodFacts")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", n._id))
    .collect();
  const service = facts.find((f) => f.kind === "transit_service");
  return {
    events,
    activeGroups: groups
      .filter((g) => g.privacy === "public" && g.visible && g.lastActivityAt >= now - 30 * DAY)
      .map((g) => ({ id: g._id, name: g.name, lastActivityAt: g.lastActivityAt })),
    places: placeMentions(n.slug, texts),
    corridors: facts.flatMap((f) =>
      f.kind === "nightlife_corridor" ? [{ name: f.name, source: f.citations.first }] : [],
    ),
    stations: facts.flatMap((f) =>
      f.kind === "transit_station"
        ? [{ name: f.name, system: f.system, source: f.citations.first }]
        : [],
    ),
    metroLines: facts.flatMap((f) =>
      f.kind === "transit_line" ? [{ name: f.name, source: f.citations.first }] : [],
    ),
    service:
      service?.kind === "transit_service"
        ? {
            tripsPerHour: service.tripsPerHour,
            routes: service.routes.length,
            allNight: service.routes.filter((r) => r.allNight).map((r) => r.name),
            sources: [...sourcesOf(service.citations)],
          }
        : null,
  };
}

/** Every neighborhood (SF has 41). */
export const neighborhoodIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"neighborhoods">[]> =>
    (await ctx.db.query("neighborhoods").take(200)).map((n) => n._id),
});

/** What one neighborhood's shared scores count, read in its own transaction. */
export const inputsFor = internalQuery({
  args: { neighborhoodId: v.id("neighborhoods"), now: v.number() },
  handler: async (ctx, { neighborhoodId, now }): Promise<ScoreInputs | null> => {
    const n = await ctx.db.get(neighborhoodId);
    return n ? gather(ctx, n, now) : null;
  },
});

/**
 * Replaces one neighborhood's shared scores. A score with no public source isn't stored (the
 * UI says there isn't enough to go on).
 */
export const store = internalMutation({
  args: {
    neighborhoodId: v.id("neighborhoods"),
    now: v.number(),
    scores: v.array(
      v.object({
        kind: neighborhoodScoreKind,
        score: v.number(),
        raw: v.number(),
        breakdown: v.string(),
        /** Candidates, most telling first; the public ones are cited. */
        sources: v.array(source),
      }),
    ),
  },
  handler: async (ctx, { neighborhoodId, now, scores }) => {
    let stored = 0;
    for (const s of scores) {
      const old = await ctx.db
        .query("neighborhoodScores")
        .withIndex("by_neighborhood", (q) =>
          q.eq("neighborhoodId", neighborhoodId).eq("kind", s.kind),
        )
        .collect();
      for (const o of old) await ctx.db.delete(o._id);
      const sources: Source[] = [];
      for (const c of s.sources) {
        if (sources.length === MAX_SOURCES) break;
        if (await isPublicSource(ctx, c)) sources.push(c);
      }
      const citations = s.raw > 0 ? tryCite(sources) : null;
      if (!citations) continue;
      // Shown to everyone, so every source must be public (#7).
      await assertCitable(ctx, citations, "everyone");
      await ctx.db.insert("neighborhoodScores", {
        neighborhoodId,
        kind: s.kind,
        score: s.score,
        raw: Math.round(s.raw * 100) / 100,
        label: scoreLabel(s.kind, s.score),
        breakdown: s.breakdown,
        citations,
        computedAt: now,
      });
      stored++;
    }
    return { stored, withoutSources: scores.length - stored };
  },
});

/**
 * Rewrites every neighborhood's shared scores: each neighborhood is read and written in its own
 * transaction, and only the ranking spans them. Runs at the end of `seed:reset` and daily
 * (`convex/crons.ts`).
 */
export const recompute = internalAction({
  args: {},
  handler: async (ctx): Promise<{ stored: number; withoutSources: number }> => {
    const now = Date.now();
    const inputs = new Map<Id<"neighborhoods">, ScoreInputs>();
    for (const id of await ctx.runQuery(internal.neighborhoodScores.neighborhoodIds, {})) {
      const i = await ctx.runQuery(internal.neighborhoodScores.inputsFor, {
        neighborhoodId: id,
        now,
      });
      if (i) inputs.set(id, i);
    }
    const ranked = KINDS.map((kind) => {
      // Rounded, and 0 without enough data (so it isn't ranked or stored).
      const raws = new Map([...inputs].map(([id, i]) => [id, rawScore(kind, i)]));
      return { kind, raws, scores: percentiles(raws) };
    });
    let stored = 0;
    let withoutSources = 0;
    for (const [id, i] of inputs) {
      const r = await ctx.runMutation(internal.neighborhoodScores.store, {
        neighborhoodId: id,
        now,
        scores: ranked.map(({ kind, raws, scores }) => ({
          kind,
          score: scores.get(id) ?? 0,
          raw: raws.get(id) ?? 0,
          breakdown: breakdown(kind, i),
          // Enough candidates to find the public ones, without unbounded checks.
          sources: scoreSources(kind, i).slice(0, 4 * MAX_SOURCES),
        })),
      });
      stored += r.stored;
      withoutSources += r.withoutSources;
    }
    return { stored, withoutSources };
  },
});

export type SharedScore =
  | {
      kind: NeighborhoodScoreKind;
      state: "ok";
      score: number;
      label: string;
      breakdown: string;
      sources: NonEmpty<CitedSource>;
    }
  /** Not enough public data to score this neighborhood. */
  | { kind: NeighborhoodScoreKind; state: "no_data" };

/**
 * A neighborhood's scores as this viewer may see them, plus interest fit and the
 * "Getting around at night" facts. A stored score whose sources the viewer
 * can't all see (a block, or a source that went private or was deleted) is left
 * out. Null for an unknown neighborhood.
 */
export const get = viewerQuery({
  args: { neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { neighborhoodId }) => {
    const n = await ctx.db.get(neighborhoodId);
    if (!n) return null;
    const now = Date.now();
    const audience = await loadAudience(ctx, ctx.viewer._id);

    const { scores, computedAt } = await sharedScores(ctx, neighborhoodId, audience);

    // Interest fit: personal, from what this viewer can see here.
    const { groups, texts } = await neighborhoodThreads(ctx, neighborhoodId, now);
    const weights = interestWeights(await getProfile(ctx, ctx.viewer));
    let fit:
      | { state: "no_profile" }
      | {
          state: "ok";
          score: number;
          matched: string[];
          missing: string[];
          sources: CitedSource[];
        };
    if (weights.size === 0) {
      fit = { state: "no_profile" };
    } else {
      const events = await ctx.db
        .query("events")
        .withIndex("by_neighborhood", (q) =>
          q
            .eq("neighborhoodId", neighborhoodId)
            .gte("startAt", now)
            .lt("startAt", now + 30 * DAY),
        )
        .take(MAX_EVENTS);
      const candidates: FitItem[] = [
        ...groups.map((g) => ({
          interests: interestsForLocalGroup({ category: g.category, tags: g.tags, name: g.name }),
          source: { kind: "group", groupId: g._id } as Source,
        })),
        ...events.map((e) => ({
          interests: interestsForLocalEvent({ category: e.category, title: e.title }),
          source: { kind: "event", eventId: e._id } as Source,
        })),
        ...placeMentions(n.slug, texts).map((p) => ({
          interests: interestsForPlace(p),
          source: [...p.mentions].sort((a, b) => b.reactions - a.reactions)[0].source,
        })),
      ].filter((c) => c.interests.length > 0);
      // Count only what this viewer can see (private Groups they're in count; others don't).
      const visible = await resolveSources(
        ctx,
        candidates.map((c) => c.source),
        audience,
      );
      const seen = new Map(visible.map((s) => [s.key, s]));
      const items = candidates.filter((c) => seen.has(sourceKey(c.source)));
      const result = interestFit(weights, items);
      const matched = new Set(result?.matched.map((m) => m.interest) ?? []);
      fit = {
        state: "ok",
        score: result?.score ?? 0,
        matched: [...matched].map((id) => getInterest(id).label),
        missing: [...weights.keys()]
          .filter((id) => !matched.has(id))
          .map((id) => getInterest(id).label),
        sources: (result?.sources ?? [])
          .flatMap((s) => seen.get(sourceKey(s)) ?? [])
          .slice(0, MAX_SOURCES),
      };
    }

    // Getting around at night: cited facts and locals' words, no score.
    const facts = await ctx.db
      .query("neighborhoodFacts")
      .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
      .collect();
    const service = facts.find((f) => f.kind === "transit_service");
    const lights = facts.find((f) => f.kind === "streetlight_requests");
    const serviceSources =
      service?.kind === "transit_service"
        ? await resolveCitations(ctx, service.citations, audience)
        : null;
    const lightSources =
      lights?.kind === "streetlight_requests"
        ? await resolveCitations(ctx, lights.citations, audience)
        : null;
    // Locals' words: the matching sentence, with the post or comment it's from (visible to this viewer).
    const picked = pickNightQuotes(texts, 8);
    const cited = await resolveSources(
      ctx,
      picked.map((t) => t.source),
      audience,
    );
    const byKey = new Map(cited.map((c) => [c.key, c]));
    const quotes = picked
      .flatMap((t) => {
        const source = byKey.get(sourceKey(t.source));
        return source ? [{ quote: t.quote, source }] : [];
      })
      .slice(0, 4);

    return {
      neighborhood: { _id: n._id, slug: n.slug, name: n.name, label: n.shortName ?? n.name },
      scores,
      interestFit: fit,
      night: {
        transit:
          service?.kind === "transit_service" && serviceSources
            ? {
                allNight: service.routes.filter((r) => r.allNight).map((r) => r.name),
                lastTrains: service.lastTrains.map((t) => ({
                  system: t.system,
                  station: t.station,
                  toward: t.toward ?? null,
                  weekday: t.weekday === undefined ? null : clockTime(t.weekday),
                  saturday: t.saturday === undefined ? null : clockTime(t.saturday),
                  sunday: t.sunday === undefined ? null : clockTime(t.sunday),
                })),
                sources: serviceSources,
              }
            : null,
        streetlights:
          lights?.kind === "streetlight_requests" && lightSources
            ? { count: lights.count, since: lights.since, sources: lightSources }
            : null,
        quotes,
      },
      howCalculated: HOW_CALCULATED,
      computedAt,
    };
  },
});

/**
 * The three stored shared scores as this viewer may see them: a score whose
 * sources they can't all see is left out, and a kind with no stored score is
 * `no_data`. Reads only the score rows and their citations.
 */
export async function sharedScores(
  ctx: QueryCtx,
  neighborhoodId: Id<"neighborhoods">,
  audience: Audience,
) {
  const rows = await ctx.db
    .query("neighborhoodScores")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
    .collect();
  const scores: SharedScore[] = [];
  for (const kind of KINDS) {
    const r = rows.find((x) => x.kind === kind);
    if (!r) {
      scores.push({ kind, state: "no_data" });
      continue;
    }
    const sources = await resolveCitations(ctx, r.citations, audience);
    if (!sources) continue;
    scores.push({
      kind,
      state: "ok",
      score: r.score,
      label: r.label,
      breakdown: r.breakdown,
      sources,
    });
  }
  return { scores, computedAt: rows.reduce((t, r) => Math.max(t, r.computedAt), 0) || null };
}

/**
 * Just the shared scores, for pages that link on to the neighborhood (a
 * listing): no interest fit or night facts, so no Group threads are read.
 * Null for an unknown neighborhood.
 */
export const shared = viewerQuery({
  args: { neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { neighborhoodId }) => {
    const n = await ctx.db.get(neighborhoodId);
    if (!n) return null;
    const audience = await loadAudience(ctx, ctx.viewer._id);
    return {
      neighborhood: { _id: n._id, slug: n.slug, label: n.shortName ?? n.name },
      ...(await sharedScores(ctx, neighborhoodId, audience)),
    };
  },
});
