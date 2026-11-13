import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";
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
import { getInterest, interestsForEvent, interestsForGroup } from "./lib/interests";
import {
  breakdown,
  clockTime,
  type FitItem,
  HOW_CALCULATED,
  interestFit,
  interestsForPlace,
  MAX_SOURCES,
  type PlaceMention,
  percentiles,
  pickNightQuotes,
  RAW,
  type ScoreInputs,
  scoreLabel,
  scoreSources,
} from "./lib/neighborhoodScores";
import { loadAudience } from "./lib/posts";
import { NEIGHBORHOOD_PLACES } from "./seed/world/neighborhoods/places";
import type { NeighborhoodScoreKind, Source } from "./validators";

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

type ThreadText = { source: Source; text: string; reactions: number; createdAt: number };

/** The neighborhood's Groups and the text of their recent posts and comments. */
async function neighborhoodThreads(
  ctx: QueryCtx,
  neighborhoodId: Id<"neighborhoods">,
  now: number,
) {
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
    .collect();
  const texts: ThreadText[] = [];
  // Only public, visible Groups: anything here may back a score everyone sees.
  for (const g of groups.filter((x) => x.privacy === "public" && x.visible)) {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id).gte("createdAt", now - THREAD_WINDOW))
      .collect();
    for (const p of posts) {
      texts.push({
        source: { kind: "post", postId: p._id },
        text: p.text ?? "",
        reactions: p.reactionCount,
        createdAt: p.createdAt,
      });
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect();
      for (const c of comments) {
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

/** #15 places of this neighborhood that its threads name, with where they're named. */
function placeMentions(slug: string, texts: readonly ThreadText[]): PlaceMention[] {
  const lower = texts.map((t) => ({ ...t, lc: t.text.toLowerCase() }));
  return NEIGHBORHOOD_PLACES.filter((p) => p.neighborhood === slug)
    .map((p) => {
      const name = p.name.toLowerCase();
      return {
        key: p.key,
        name: p.name,
        kind: p.kind,
        mentions: lower
          .filter((t) => t.lc.includes(name))
          .map((t) => ({ source: t.source, reactions: t.reactions })),
      };
    })
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
    .collect();
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

/**
 * Rewrites every neighborhood's shared scores. A score with no public source
 * isn't stored (the UI says there isn't enough to go on). Runs at the end of
 * `seed:reset` and daily (`convex/crons.ts`).
 */
export const recompute = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const neighborhoods = await ctx.db.query("neighborhoods").collect();
    const inputs = new Map<Id<"neighborhoods">, ScoreInputs>();
    for (const n of neighborhoods) inputs.set(n._id, await gather(ctx, n, now));
    let stored = 0;
    let withoutSources = 0;
    for (const kind of KINDS) {
      const raws = new Map([...inputs].map(([id, i]) => [id, RAW[kind](i)]));
      const scores = percentiles(raws);
      for (const [id, i] of inputs) {
        const old = await ctx.db
          .query("neighborhoodScores")
          .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", id).eq("kind", kind))
          .collect();
        for (const o of old) await ctx.db.delete(o._id);
        const raw = raws.get(id) ?? 0;
        const sources: Source[] = [];
        for (const s of scoreSources(kind, i)) {
          if (sources.length === MAX_SOURCES) break;
          if (await isPublicSource(ctx, s)) sources.push(s);
        }
        const citations = raw > 0 ? tryCite(sources) : null;
        if (!citations) {
          withoutSources++;
          continue;
        }
        // Shown to everyone, so every source must be public (#7).
        await assertCitable(ctx, citations, "everyone");
        const score = scores.get(id) ?? 0;
        await ctx.db.insert("neighborhoodScores", {
          neighborhoodId: id,
          kind,
          score,
          raw: Math.round(raw * 100) / 100,
          label: scoreLabel(kind, score),
          breakdown: breakdown(kind, i),
          citations,
          computedAt: now,
        });
        stored++;
      }
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

    // Shared scores.
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
        .collect();
      const candidates: FitItem[] = [
        ...groups.map((g) => ({
          interests: interestsForGroup({ category: g.category, tags: g.tags, name: g.name }),
          source: { kind: "group", groupId: g._id } as Source,
        })),
        ...events.map((e) => ({
          interests: interestsForEvent({ category: e.category, title: e.title }),
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
    const quotes = await resolveSources(
      ctx,
      pickNightQuotes(texts, 8).map((t) => t.source),
      audience,
    );

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
        quotes: quotes.slice(0, 4),
      },
      howCalculated: HOW_CALCULATED,
      computedAt: rows.reduce((t, r) => Math.max(t, r.computedAt), 0) || null,
    };
  },
});
