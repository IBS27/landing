import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import {
  assertCitable,
  type CitedSource,
  isPublicSource,
  type NonEmpty,
  resolveCitations,
  sourceKey,
  tryCite,
} from "./lib/citations";
import { getProfile, interestWeights } from "./lib/cityProfile";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getInterest } from "./lib/interests";
import { placesIn } from "./lib/places";
import { loadAudience } from "./lib/posts";
import {
  type Agreed,
  type AgreementInput,
  buildRoute,
  emberMentions,
  mostDiscussed,
  type RouteEvent,
  sparkAgreement,
  stopInterests,
  toCandidates,
  weekendWindow,
} from "./lib/weekendRoute";
import { type Source, type WeekendStop, weekendStop } from "./validators";

/**
 * Weekend Routes (#18): one shared, cited route per neighborhood, built in the
 * background by Ember and Spark from public Group threads (see
 * `convex/lib/weekendRoute.ts`) and rebuilt weekly by `convex/crons.ts`.
 * Mount the UI with `<WeekendRoute neighborhoodId>` from
 * `src/landing/neighborhoods/WeekendRoute.tsx`.
 */

const KIND = "weekendRoute";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** How far back threads are read. */
const THREAD_WINDOW_MS = 90 * DAY;
/** Most-engaged posts read per neighborhood, and sources (posts and comments) in all. */
const MAX_POSTS = 40;
const MAX_SOURCES = 150;
/** A route is rebuilt once it's this old... */
export const STALE_MS = 7 * DAY;
/** ...or once its Groups have this many posts newer than it. */
const NEW_POSTS_REBUILD = 10;
/** A failed build isn't retried from the UI for this long. */
const RETRY_MS = 15 * MINUTE;
/** Gap between neighborhoods when the cron rebuilds many. */
const STAGGER_MS = 20_000;
/** Event stops without an end time drop off this long after they start. */
const EVENT_LENGTH_MS = 3 * 60 * MINUTE;
const AI_BUDGET_MS = 8 * MINUTE;

/* ---------- Gather ---------- */

async function publicGroups(ctx: QueryCtx, neighborhoodId: Id<"neighborhoods">) {
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
    .collect();
  return groups.filter((g) => g.privacy === "public" && g.visible);
}

const engagement = (p: Doc<"posts">) => p.reactionCount + 2 * p.commentCount;

/**
 * The neighborhood's public Group threads from the last 90 days, most-engaged
 * first (each post followed by its comments), with an anonymous label per
 * author, plus its public, in-person Events this weekend.
 */
export const gather = internalQuery({
  args: { neighborhoodId: v.id("neighborhoods"), now: v.number() },
  handler: async (ctx, { neighborhoodId, now }) => {
    const n = await ctx.db.get(neighborhoodId);
    if (!n) return null;

    const posts: Doc<"posts">[] = [];
    for (const g of await publicGroups(ctx, neighborhoodId)) {
      const rows = await ctx.db
        .query("posts")
        .withIndex("by_group", (q) =>
          q.eq("groupId", g._id).gte("createdAt", now - THREAD_WINDOW_MS),
        )
        .collect();
      posts.push(...rows);
    }
    const isPublic = await Promise.all(
      posts.map((p) => isPublicSource(ctx, { kind: "post", postId: p._id })),
    );
    const threads = posts
      .filter((p, i) => isPublic[i] && p.text?.trim())
      .sort((a, b) => engagement(b) - engagement(a) || b.createdAt - a.createdAt)
      .slice(0, MAX_POSTS);

    const labels = new Map<Id<"users">, string>();
    const local = (id: Id<"users">) => {
      if (!labels.has(id)) labels.set(id, `local-${labels.size + 1}`);
      return labels.get(id) as string;
    };
    const sources: { source: Source; text: string; author: string }[] = [];
    for (const p of threads) {
      if (sources.length >= MAX_SOURCES) break;
      sources.push({
        source: { kind: "post", postId: p._id },
        text: p.text?.trim() ?? "",
        author: local(p.authorId),
      });
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect();
      for (const c of comments) {
        if (sources.length >= MAX_SOURCES) break;
        if (!c.text.trim() || !(await ctx.db.get(c.authorId))) continue;
        sources.push({
          source: { kind: "comment", commentId: c._id },
          text: c.text.trim(),
          author: local(c.authorId),
        });
      }
    }

    const { start, end } = weekendWindow(now);
    const eventRows = await ctx.db
      .query("events")
      .withIndex("by_neighborhood", (q) =>
        q.eq("neighborhoodId", neighborhoodId).gte("startAt", start).lt("startAt", end),
      )
      .collect();
    const events: RouteEvent[] = [];
    for (const e of eventRows) {
      if (e.online || e.privacy !== "public" || !(await ctx.db.get(e.hostId))) continue;
      const going = await ctx.db
        .query("eventResponses")
        .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
        .collect();
      events.push({
        eventId: e._id,
        title: e.title,
        category: e.category,
        description: e.description,
        startAt: e.startAt,
        ...(e.endAt !== undefined && { endAt: e.endAt }),
        ...(e.point && { point: e.point }),
        going: e.externalGoingCount + going.length,
        sourceKey: sourceKey({ kind: "event", eventId: e._id }),
      });
    }

    return {
      slug: n.slug,
      label: n.shortName ?? n.name,
      sources,
      postCount: threads.length,
      events,
    };
  },
});

/* ---------- Build ---------- */

export const generate = internalAction({
  args: { jobId: v.id("aiJobs"), neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { jobId, neighborhoodId }) => {
    await runJob(ctx, jobId, async (progress) => {
      const now = Date.now();
      const deadline = now + AI_BUDGET_MS;
      const g = await ctx.runQuery(internal.weekendRoutes.gather, { neighborhoodId, now });
      if (!g) throw new Error("Neighborhood not found");

      const places = placesIn(g.slug);
      const placeInput = places.map((p) => ({
        key: p.key,
        name: p.name,
        kind: p.kind,
        aliases: [...p.aliases],
      }));
      const byKey = new Map<string, Source>(g.sources.map((s) => [sourceKey(s.source), s.source]));
      for (const e of g.events) byKey.set(e.sourceKey, { kind: "event", eventId: e.eventId });
      const texts = new Map(g.sources.map((s) => [sourceKey(s.source), s.text]));
      const authors: Record<string, string> = Object.fromEntries(
        g.sources.map((s) => [sourceKey(s.source), s.author]),
      );

      const runIds: Id<"aiRuns">[] = [];
      let via: "model" | "fallback" = "fallback";
      let agreed: Agreed[] = [];
      if (g.sources.length) {
        await progress("Ember is reading local Group threads", 0, 3);
        const ember = await runAgent(ctx, emberMentions, {
          input: { neighborhood: g.label, places: placeInput },
          sources: g.sources.map((s) => s.source),
          shownTo: "everyone",
          jobId,
          deadline,
        });
        runIds.push(ember.runId);

        const cited = new Set(ember.output.mentions.flatMap((m) => m.sources));
        const input: AgreementInput = {
          neighborhood: g.label,
          places: placeInput,
          mentions: ember.output.mentions,
          authors: Object.fromEntries(Object.entries(authors).filter(([k]) => cited.has(k))),
        };
        await progress("Spark is finding what locals agree on", 1, 3);
        if (ember.via === "fallback" || !cited.size) {
          // No model mentions to weigh: count names in the threads instead.
          agreed = mostDiscussed(input);
        } else {
          const spark = await runAgent(ctx, sparkAgreement, {
            input,
            sources: g.sources.filter((s) => cited.has(sourceKey(s.source))).map((s) => s.source),
            shownTo: "everyone",
            jobId,
            deadline,
          });
          runIds.push(spark.runId);
          agreed = spark.output.places;
          if (spark.via !== "fallback") via = "model";
        }
      }

      await progress("Planning the route", 2, 3);
      const built = buildRoute(toCandidates(agreed, places, texts, authors), g.events);
      const citeKeys = (keys: readonly string[]) =>
        tryCite(keys.flatMap((k) => byKey.get(k) ?? []));
      const stops: WeekendStop[] = built.flatMap(({ sources, disagreement, ...stop }) => {
        const citations = citeKeys(sources);
        if (!citations) return [];
        const against = disagreement && citeKeys(disagreement.sources);
        return [
          {
            ...stop,
            ...(disagreement &&
              against && { disagreement: { note: disagreement.note, citations: against } }),
            citations,
          },
        ];
      });

      await ctx.runMutation(internal.weekendRoutes.save, {
        neighborhoodId,
        stops,
        via,
        runIds,
        postCount: g.postCount,
        generatedAt: now,
      });
      await progress("Done", 3, 3);
    });
  },
});

/** Stores a neighborhood's route. Only the job writes here, and only from public sources. */
export const save = internalMutation({
  args: {
    neighborhoodId: v.id("neighborhoods"),
    stops: v.array(weekendStop),
    via: v.union(v.literal("model"), v.literal("fallback")),
    runIds: v.array(v.id("aiRuns")),
    postCount: v.number(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const s of args.stops) {
      await assertCitable(ctx, s.citations, "everyone");
      if (s.disagreement) await assertCitable(ctx, s.disagreement.citations, "everyone");
    }
    const row = await routeOf(ctx, args.neighborhoodId);
    // A slower, older build never replaces a newer one.
    if (row && row.generatedAt > args.generatedAt) return;
    if (row) await ctx.db.patch(row._id, args);
    else await ctx.db.insert("weekendRoutes", args);
  },
});

/* ---------- Jobs and freshness ---------- */

function routeOf(ctx: QueryCtx, neighborhoodId: Id<"neighborhoods">) {
  return ctx.db
    .query("weekendRoutes")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", neighborhoodId))
    .unique();
}

function latestJob(ctx: QueryCtx, neighborhoodId: Id<"neighborhoods">) {
  return ctx.db
    .query("aiJobs")
    .withIndex("by_kind_key", (q) => q.eq("kind", KIND).eq("key", neighborhoodId))
    .order("desc")
    .first();
}

const isLive = (job: Doc<"aiJobs"> | null, now: number) =>
  job !== null &&
  (job.status === "queued" || job.status === "running") &&
  job.createdAt > now - RETRY_MS;

function start(ctx: MutationCtx, neighborhoodId: Id<"neighborhoods">) {
  return startJob(ctx, {
    kind: KIND,
    key: neighborhoodId,
    action: internal.weekendRoutes.generate,
    args: { neighborhoodId },
  });
}

/**
 * Builds the neighborhood's route if it has none or it's over a week old. The
 * route is shared, so any viewer starts it for everyone; a build that just
 * failed isn't retried for 15 minutes.
 */
export const request = viewerMutation({
  args: { neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { neighborhoodId }) => {
    if (!(await ctx.db.get(neighborhoodId))) throw new ConvexError("Neighborhood not found");
    const now = Date.now();
    const route = await routeOf(ctx, neighborhoodId);
    if (route && route.generatedAt > now - STALE_MS) return { status: "current" as const };
    const job = await latestJob(ctx, neighborhoodId);
    if (isLive(job, now)) return { status: "building" as const };
    if (job?.status === "failed" && job.createdAt > now - RETRY_MS)
      return { status: "failed" as const };
    await start(ctx, neighborhoodId);
    return { status: "building" as const };
  },
});

/** Group posts newer than `since`, up to `NEW_POSTS_REBUILD`. */
async function newPosts(ctx: QueryCtx, neighborhoodId: Id<"neighborhoods">, since: number) {
  let count = 0;
  for (const g of await publicGroups(ctx, neighborhoodId)) {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id).gt("createdAt", since))
      .take(NEW_POSTS_REBUILD - count);
    count += rows.length;
    if (count >= NEW_POSTS_REBUILD) break;
  }
  return count;
}

/**
 * Cron: rebuilds the route of every neighborhood with a public Group when it's
 * missing, over a week old, or its Groups have 10+ new posts (`force` rebuilds
 * all of them, for the weekly run before the weekend). Staggered so builds
 * don't all hit the model at once.
 */
export const refreshAll = internalMutation({
  args: { force: v.boolean() },
  handler: async (ctx, { force }) => {
    const now = Date.now();
    let i = 0;
    for (const n of await ctx.db.query("neighborhoods").collect()) {
      if (!(await publicGroups(ctx, n._id)).length) continue;
      const route = await routeOf(ctx, n._id);
      const due =
        force ||
        !route ||
        route.generatedAt <= now - STALE_MS ||
        (await newPosts(ctx, n._id, route.generatedAt)) >= NEW_POSTS_REBUILD;
      if (!due || isLive(await latestJob(ctx, n._id), now)) continue;
      await ctx.scheduler.runAfter(i++ * STAGGER_MS, internal.weekendRoutes.refresh, {
        neighborhoodId: n._id,
      });
    }
  },
});

export const refresh = internalMutation({
  args: { neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { neighborhoodId }) => {
    await start(ctx, neighborhoodId);
  },
});

/* ---------- Read ---------- */

export type WeekendStopView = Omit<WeekendStop, "citations" | "disagreement"> & {
  key: string;
  sources: NonEmpty<CitedSource>;
  disagreement: { note: string; sources: NonEmpty<CitedSource> } | null;
  /** The viewer's City Profile interests this stop fits ("Coffee"). */
  matches: string[];
};

/**
 * A neighborhood's Weekend Route for the viewer: each stop's sources resolved
 * for them (a stop whose sources they can't see is left out), Event stops that
 * are over dropped, and stops that fit their interests marked. `building` is
 * set while a build runs.
 */
export const get = viewerQuery({
  args: { neighborhoodId: v.id("neighborhoods") },
  handler: async (ctx, { neighborhoodId }) => {
    const now = Date.now();
    const [row, job] = await Promise.all([
      routeOf(ctx, neighborhoodId),
      latestJob(ctx, neighborhoodId),
    ]);
    const building = isLive(job, now)
      ? {
          label: job?.progress?.label ?? "Getting started",
          done: job?.progress?.done ?? 0,
          total: job?.progress?.total ?? 3,
        }
      : null;
    const failed =
      !building && job?.status === "failed" && (!row || job.createdAt > row.generatedAt);
    if (!row) return { route: null, building, failed };

    const audience = await loadAudience(ctx, ctx.viewer._id);
    const weights = interestWeights(await getProfile(ctx, ctx.viewer));
    const stops: WeekendStopView[] = [];
    for (const [i, { citations, disagreement, ...stop }] of row.stops.entries()) {
      if (stop.startAt !== undefined && (stop.endAt ?? stop.startAt + EVENT_LENGTH_MS) < now)
        continue;
      const sources = await resolveCitations(ctx, citations, audience);
      if (!sources) continue;
      const against =
        disagreement && (await resolveCitations(ctx, disagreement.citations, audience));
      const event = stop.eventId ? await ctx.db.get(stop.eventId) : null;
      stops.push({
        ...stop,
        key: stop.placeKey ?? stop.eventId ?? `${i}:${stop.name}`,
        sources,
        disagreement:
          disagreement && against ? { note: disagreement.note, sources: against } : null,
        matches: stopInterests(stop, event)
          .filter((id) => weights.has(id))
          .map((id) => getInterest(id).label),
      });
    }
    return {
      route: { generatedAt: row.generatedAt, via: row.via, stops },
      building,
      failed,
    };
  },
});
