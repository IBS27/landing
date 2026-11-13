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
import { viewerCrew } from "./crews";
import { blockedSet } from "./lib/blocks";
import {
  assertCitable,
  type CitedSource,
  type NonEmpty,
  resolveCitations,
  sourceKey,
  sourcesOf,
  tryCite,
} from "./lib/citations";
import { getProfile, interestWeights } from "./lib/cityProfile";
import { crewProfile } from "./lib/crews";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getInterest } from "./lib/interests";
import {
  eventFit,
  JOIN_TASK,
  type JoinInput,
  type JourneyWeek,
  joinTemplate,
  journeyPhase,
  journeyWeek,
  moveInStart,
  museJoin,
  nameList,
  planJourney,
  planScore,
  planWhen,
  routeCandidates,
  stillCrew,
} from "./lib/journeys";
import { type Audience, canSeeEvent, loadAudience } from "./lib/posts";
import { isExpired, propose } from "./lib/proposals";
import { getSummaries, type UserSummary } from "./lib/users";
import { type BuiltStop, type RouteEvent, stopInterests } from "./lib/weekendRoute";
import { createConversation } from "./messenger";
import { citations, type Source, type WeekendStop } from "./validators";

/**
 * Journeys (#32): each week of someone's first 90 days, a Weekend Route built
 * from real Events and Group plans (plus #18's Weekend Route places), and the
 * Move-in Crew members who are going. Planning lives in `./lib/journeys.ts`.
 *
 * - Written only by the daily job (`refreshAll` → `build`), one row per person
 *   per weekend. No model call, so it's the same with AI off.
 * - `thisWeek` reads one row and checks crew overlap live: only people still
 *   opted in and matched, never anyone blocked, and only who's going, never
 *   anything from their City Profile.
 * - "Mind if I join you?" (`draftJoin`) is drafted by Muse and goes to the
 *   Landing Inbox through `propose()`. Nothing is sent until it's approved.
 *
 * Journeys read Group plans through Group membership, so #31's crew Group and
 * its first meetup show up here once they exist; Journeys never create them.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** City Profile neighborhoods whose Events are read. */
const MAX_NEIGHBORHOODS = 3;
/** Groups (most recently joined) whose plans are read. */
const MAX_GROUPS = 50;
const EVENTS_PER_NEIGHBORHOOD = 50;
const EVENTS_PER_GROUP = 10;
/** Plans scored in full (crew and attendance lookups), best by interest fit first. */
const MAX_PLANS = 30;
const GOING_SCAN = 500;
/** cityProfiles read per `refreshAll` page. */
const PROFILE_PAGE = 100;
const STAGGER_MS = 500;
/** When a neighborhood has no Weekend Route yet, the Journey is built again this much later. */
const ROUTE_WAIT_MS = 10 * MINUTE;
const PAST_WEEKS = 12;
/** Events without an end time count as over this long after they start. */
const EVENT_LENGTH_MS = 3 * HOUR;
/** The viewer's recent pending proposals scanned for join drafts. */
const DRAFT_SCAN = 50;
/** The owner's most recent threads searched for an existing chat with the same people. */
const THREAD_SCAN = 200;
const JOB_KIND = "journeyJoin";

function rowFor(ctx: QueryCtx, userId: Id<"users">, weekOf: string) {
  return ctx.db
    .query("journeys")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekOf", weekOf))
    .unique();
}

const isOver = (e: { startAt: number; endAt?: number }, now: number) =>
  (e.endAt ?? e.startAt + EVENT_LENGTH_MS) < now;

/* ---------- Gather ---------- */

type Plan = { event: Doc<"events">; groupPlan: boolean };

/**
 * The weekend's in-person plans someone can see: public Events in their
 * neighborhoods, and Group plans (Events in Groups they belong to, at any
 * privacy they can see). Hosts who are gone or blocked drop out.
 */
async function weekendPlans(
  ctx: QueryCtx,
  a: Audience,
  neighborhoodIds: readonly Id<"neighborhoods">[],
  w: Pick<JourneyWeek, "start" | "end">,
): Promise<Plan[]> {
  const found = new Map<Id<"events">, Plan>();
  for (const neighborhoodId of neighborhoodIds) {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_neighborhood", (q) =>
        q.eq("neighborhoodId", neighborhoodId).gte("startAt", w.start).lt("startAt", w.end),
      )
      .take(EVENTS_PER_NEIGHBORHOOD);
    for (const event of rows)
      if (!event.online && event.privacy === "public")
        found.set(event._id, { event, groupPlan: false });
  }
  for (const groupId of [...a.groups].slice(-MAX_GROUPS)) {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_group", (q) =>
        q.eq("groupId", groupId).gte("startAt", w.start).lt("startAt", w.end),
      )
      .take(EVENTS_PER_GROUP);
    for (const event of rows)
      if (!event.online && (await canSeeEvent(ctx, event, a)))
        found.set(event._id, { event, groupPlan: true });
  }
  const out: Plan[] = [];
  for (const p of found.values())
    if (!a.blocked.has(p.event.hostId) && (await ctx.db.get(p.event.hostId))) out.push(p);
  return out;
}

/** Which of `userIds` RSVP'd "Going" to the Event. */
async function goingAmong(
  ctx: QueryCtx,
  eventId: Id<"events">,
  userIds: readonly Id<"users">[],
): Promise<Id<"users">[]> {
  const out: Id<"users">[] = [];
  for (const userId of userIds) {
    const row = await ctx.db
      .query("eventResponses")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
      .first();
    if (row?.status === "going") out.push(userId);
  }
  return out;
}

/* ---------- Build (scheduled only) ---------- */

/**
 * Builds (or, with `force`, rebuilds) someone's Journey for this weekend.
 * Returns its id, or null when they aren't in their first 90 days. Called only
 * from the scheduled `build`, and from the seed.
 */
export async function buildJourney(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  opts: { force: boolean; waitedForRoute?: boolean },
): Promise<Id<"journeys"> | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const profile = await getProfile(ctx, user);
  if (profile.briefCompletedAt === null || !profile.moveIn) return null;
  const w = journeyWeek(profile.moveIn.value, now);
  if (!w) return null;
  const existing = await rowFor(ctx, userId, w.weekOf);
  if (existing && !opts.force) return existing._id;

  const a = await loadAudience(ctx, userId);
  const weights = interestWeights(profile);
  const hoods: Doc<"neighborhoods">[] = [];
  for (const f of profile.neighborhoods.slice(0, MAX_NEIGHBORHOODS)) {
    const n = await ctx.db
      .query("neighborhoods")
      .withIndex("by_slug", (q) => q.eq("slug", f.value.slug))
      .unique();
    if (n) hoods.push(n);
  }
  const crewIds = ((await viewerCrew(ctx, user)) ?? []).map((m) => m.user._id);

  // Score the plans that fit best first, so a busy weekend stays bounded.
  const plans = (
    await weekendPlans(
      ctx,
      a,
      hoods.map((n) => n._id),
      w,
    )
  )
    .map((p) => ({ ...p, fit: eventFit(p.event, weights) }))
    .sort((x, y) => y.fit + Number(y.groupPlan) - (x.fit + Number(x.groupPlan)))
    .slice(0, MAX_PLANS);
  const events: (RouteEvent & { neighborhoodId?: Id<"neighborhoods"> })[] = [];
  for (const { event: e, groupPlan, fit } of plans) {
    const responses = await ctx.db
      .query("eventResponses")
      .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
      .take(GOING_SCAN);
    const going = e.externalGoingCount + responses.length;
    const crewGoing = (await goingAmong(ctx, e._id, crewIds)).length;
    events.push({
      eventId: e._id,
      title: e.title,
      category: e.category,
      description: e.description,
      startAt: e.startAt,
      ...(e.endAt !== undefined && { endAt: e.endAt }),
      ...(e.point && { point: e.point }),
      going,
      score: planScore({ fit, crewGoing, groupPlan, going }),
      sourceKey: sourceKey({ kind: "event", eventId: e._id }),
      ...(e.neighborhoodId && { neighborhoodId: e.neighborhoodId }),
    });
  }

  // #18's Weekend Route fills the rest of the day: the top plan's neighborhood if
  // it's one of theirs, else their first. Only places whose sources they can see.
  const top = [...events].sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];
  const routeHood = hoods.find((n) => n._id === top?.neighborhoodId) ?? hoods[0];
  const route = routeHood
    ? await ctx.db
        .query("weekendRoutes")
        .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", routeHood._id))
        .unique()
    : null;
  if (routeHood && !route && !opts.waitedForRoute) {
    // No route yet: start one, and build again once it's had time to finish.
    await ctx.scheduler.runAfter(0, internal.weekendRoutes.refresh, {
      neighborhoodId: routeHood._id,
    });
    await ctx.scheduler.runAfter(ROUTE_WAIT_MS, internal.journeys.build, {
      userId,
      force: true,
      waitedForRoute: true,
    });
  }
  const placeStops: WeekendStop[] = [];
  for (const s of route?.stops ?? []) {
    if (s.kind === "event" || !(await resolveCitations(ctx, s.citations, a))) continue;
    if (s.disagreement && !(await resolveCitations(ctx, s.disagreement.citations, a))) continue;
    placeStops.push(s);
  }
  const { candidates, sources } = routeCandidates(placeStops);
  for (const e of events) sources.set(e.sourceKey, { kind: "event", eventId: e.eventId });

  const planned = planJourney(candidates, events);
  const cite = (keys: readonly string[]) => tryCite(keys.flatMap((k) => sources.get(k) ?? []));
  const store = ({ sources: keys, disagreement, ...stop }: BuiltStop): WeekendStop[] => {
    const c = cite(keys);
    if (!c) return [];
    const against = disagreement && cite(disagreement.sources);
    return [
      {
        ...stop,
        ...(disagreement &&
          against && { disagreement: { note: disagreement.note, citations: against } }),
        citations: c,
      },
    ];
  };
  const stops = planned.stops.flatMap(store);
  const more = planned.more.flatMap(store);
  for (const s of [...stops, ...more]) {
    await assertCitable(ctx, s.citations, a);
    if (s.disagreement) await assertCitable(ctx, s.disagreement.citations, a);
  }

  const doc = {
    userId,
    weekOf: w.weekOf,
    week: w.week,
    startsAt: w.start,
    endsAt: w.end,
    neighborhoodIds: hoods.map((n) => n._id),
    stops,
    more,
    crewIds,
    generatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return existing._id;
  }
  return ctx.db.insert("journeys", doc);
}

export const build = internalMutation({
  args: { userId: v.id("users"), force: v.boolean(), waitedForRoute: v.optional(v.boolean()) },
  handler: async (ctx, { userId, force, waitedForRoute }) => {
    await buildJourney(ctx, userId, Date.now(), { force, waitedForRoute });
  },
});

/**
 * Cron: pages through City Profiles and schedules a build for everyone whose
 * weekend falls in their first 90 days. `force` rebuilds Journeys that exist
 * (the daily run, so new Events, RSVPs and Weekend Routes show up); without it
 * only missing ones are built.
 */
export const refreshAll = internalMutation({
  args: { force: v.boolean(), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { force, cursor }) => {
    const now = Date.now();
    const page = await ctx.db
      .query("cityProfiles")
      .paginate({ cursor: cursor ?? null, numItems: PROFILE_PAGE });
    let i = 0;
    for (const row of page.page) {
      if (row.briefCompletedAt === undefined) continue;
      const profile = await getProfile(ctx, row.userId);
      const w = profile.moveIn && journeyWeek(profile.moveIn.value, now);
      if (!w || (!force && (await rowFor(ctx, row.userId, w.weekOf)))) continue;
      await ctx.scheduler.runAfter(i++ * STAGGER_MS, internal.journeys.build, {
        userId: row.userId,
        force,
      });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(i * STAGGER_MS, internal.journeys.refreshAll, {
        force,
        cursor: page.continueCursor,
      });
  },
});

/* ---------- Crew overlap (live) ---------- */

async function optInOf(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("crewOptIns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * The stored crew, re-checked now: the viewer is still opted in, and each
 * person still is, still matches by #30's rules and isn't blocked either way.
 * At most `CREW_MAX` people, so this stays cheap.
 */
export async function liveCrew(
  ctx: QueryCtx,
  viewer: Doc<"users">,
  crewIds: readonly Id<"users">[],
): Promise<Id<"users">[]> {
  const mine = await optInOf(ctx, viewer._id);
  if (!mine || !crewIds.length) return [];
  const [blocked, profile] = await Promise.all([
    blockedSet(ctx, viewer._id),
    getProfile(ctx, viewer),
  ]);
  const me = crewProfile(profile, mine.matchBy);
  const out: Id<"users">[] = [];
  for (const id of crewIds) {
    if (id === viewer._id || blocked.has(id)) continue;
    const row = await optInOf(ctx, id);
    if (!row) continue;
    if (stillCrew(me, crewProfile(await getProfile(ctx, id), row.matchBy))) out.push(id);
  }
  return out;
}

/** The viewer's pending "join" drafts, by Event. */
async function pendingDrafts(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<Map<Id<"events">, Id<"proposals">>> {
  const rows = await ctx.db
    .query("proposals")
    .withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId).eq("status", "pending"))
    .order("desc")
    .take(DRAFT_SCAN);
  const out = new Map<Id<"events">, Id<"proposals">>();
  for (const p of rows) {
    if (p.origin.task !== JOIN_TASK || !p.citations || isExpired(p)) continue;
    const event = sourcesOf(p.citations).find((s) => s.kind === "event");
    if (event?.kind === "event" && !out.has(event.eventId)) out.set(event.eventId, p._id);
  }
  return out;
}

/* ---------- Read ---------- */

export type JourneyStopView = Omit<WeekendStop, "citations" | "disagreement"> & {
  key: string;
  sources: NonEmpty<CitedSource>;
  disagreement: { note: string; sources: NonEmpty<CitedSource> } | null;
  /** The viewer's City Profile interests this stop fits ("Hiking"). */
  matches: string[];
  /** The Group whose plan this is, when the viewer may see it. */
  group: { name: string; slug: string } | null;
  /** Event stops that already ended. */
  over: boolean;
  viewerGoing: boolean;
  /** Crew members going, and (for a Group plan) crew in that Group who aren't. */
  crew: { going: UserSummary[]; inGroup: UserSummary[] };
  /** The viewer's pending "join" draft for this Event, waiting in Landing Inbox. */
  draftId: Id<"proposals"> | null;
};

type ViewCtx = {
  a: Audience;
  weights: ReturnType<typeof interestWeights>;
  crew: Id<"users">[];
  people: Map<Id<"users">, UserSummary>;
  drafts: Map<Id<"events">, Id<"proposals">>;
  now: number;
};

async function viewStop(
  ctx: QueryCtx,
  { citations: c, disagreement, ...stop }: WeekendStop,
  i: number,
  v: ViewCtx,
): Promise<JourneyStopView | null> {
  const sources = await resolveCitations(ctx, c, v.a);
  if (!sources) return null;
  const against = disagreement && (await resolveCitations(ctx, disagreement.citations, v.a));
  const event = stop.eventId ? await ctx.db.get(stop.eventId) : null;
  if (stop.eventId && (!event || !(await canSeeEvent(ctx, event, v.a)))) return null;
  const summaries = (ids: Id<"users">[]) => ids.flatMap((id) => v.people.get(id) ?? []);

  let group: JourneyStopView["group"] = null;
  let going: Id<"users">[] = [];
  const inGroup: Id<"users">[] = [];
  let viewerGoing = false;
  if (event) {
    going = await goingAmong(ctx, event._id, v.crew);
    viewerGoing = (await goingAmong(ctx, event._id, [v.a.viewerId])).length > 0;
    const g = event.groupId ? await ctx.db.get(event.groupId) : null;
    // A private Group's members are visible only to its members, as on Facebook.
    if (g && (g.privacy === "public" || v.a.groups.has(g._id))) {
      group = { name: g.name, slug: g.slug };
      for (const id of v.crew) {
        if (going.includes(id)) continue;
        const member = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_user", (q) => q.eq("groupId", g._id).eq("userId", id))
          .unique();
        if (member) inGroup.push(id);
      }
    }
  }
  return {
    ...stop,
    key: stop.eventId ?? stop.placeKey ?? `${i}:${stop.name}`,
    sources,
    disagreement: disagreement && against ? { note: disagreement.note, sources: against } : null,
    matches: stopInterests(stop, event)
      .filter((id) => v.weights.has(id))
      .map((id) => getInterest(id).label),
    group,
    over: event ? isOver(event, v.now) : false,
    viewerGoing,
    crew: { going: summaries(going), inGroup: summaries(inGroup) },
    draftId: (event && v.drafts.get(event._id)) ?? null,
  };
}

/**
 * The viewer's Journey for this weekend: one stored row, its sources resolved
 * for them (stops they can't see drop out) and crew overlap checked live.
 * `status` drives the empty states: no City Profile or move-in yet, before
 * move-in, after the first 90 days, or during (with `journey` null until the
 * job has built this week's).
 */
export const thisWeek = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const viewer = ctx.viewer;
    const profile = await getProfile(ctx, viewer);
    const moveIn = profile.moveIn?.value ?? null;
    const base = {
      moveInAt: moveIn ? moveInStart(moveIn) : null,
      week: null as JourneyWeek | null,
      journey: null as null | {
        _id: Id<"journeys">;
        generatedAt: number;
        stops: JourneyStopView[];
        more: JourneyStopView[];
        neighborhoods: string[];
        crewOptedIn: boolean;
      },
    };
    if (profile.briefCompletedAt === null) return { ...base, status: "noProfile" as const };
    if (!moveIn) return { ...base, status: "noMoveIn" as const };
    const status = journeyPhase(moveIn, now);
    const w = journeyWeek(moveIn, now);
    const row = w && (await rowFor(ctx, viewer._id, w.weekOf));
    if (!w || !row) return { ...base, status, week: w };

    const [a, crew, drafts, optIn] = await Promise.all([
      loadAudience(ctx, viewer._id),
      liveCrew(ctx, viewer, row.crewIds),
      pendingDrafts(ctx, viewer._id),
      optInOf(ctx, viewer._id),
    ]);
    const vc: ViewCtx = {
      a,
      weights: interestWeights(profile),
      crew,
      people: await getSummaries(ctx, crew),
      drafts,
      now,
    };
    const view = async (stops: WeekendStop[]) =>
      (await Promise.all(stops.map((s, i) => viewStop(ctx, s, i, vc)))).filter(
        (s): s is JourneyStopView => s !== null,
      );
    const hoods = await Promise.all(row.neighborhoodIds.map((id) => ctx.db.get(id)));
    return {
      ...base,
      status,
      week: w,
      journey: {
        _id: row._id,
        generatedAt: row.generatedAt,
        stops: await view(row.stops),
        more: await view(row.more),
        neighborhoods: hoods.flatMap((n) => (n ? [n.shortName ?? n.name] : [])),
        crewOptedIn: optIn !== null,
      },
    };
  },
});

/** Earlier weeks, newest first: each week's stops the viewer can still see. */
export const pastWeeks = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("journeys")
      .withIndex("by_user_week", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .take(PAST_WEEKS + 1);
    const a = await loadAudience(ctx, ctx.viewer._id);
    const out = [];
    for (const r of rows) {
      if (r.endsAt > now) continue;
      const stops = [];
      for (const s of r.stops) {
        if (!(await resolveCitations(ctx, s.citations, a))) continue;
        stops.push({
          key: s.eventId ?? s.placeKey ?? s.name,
          name: s.name,
          kind: s.kind,
          eventId: s.eventId ?? null,
        });
      }
      out.push({ _id: r._id, week: r.week, weekOf: r.weekOf, startsAt: r.startsAt, stops });
    }
    return out.slice(0, PAST_WEEKS);
  },
});

/* ---------- "Mind if I join you?" ---------- */

type Joinable =
  | { ok: true; event: Doc<"events">; members: Doc<"users">[] }
  | { ok: false; error: string };

/**
 * Whether the viewer can ask to join the crew at this Event now: it's on this
 * week's Journey, they can see it, it hasn't ended, and crew members (checked
 * live) are going.
 */
async function joinable(
  ctx: QueryCtx,
  viewer: Doc<"users">,
  eventId: Id<"events">,
  now: number,
): Promise<Joinable> {
  const profile = await getProfile(ctx, viewer);
  const w = profile.moveIn && journeyWeek(profile.moveIn.value, now);
  const row = w && (await rowFor(ctx, viewer._id, w.weekOf));
  if (!row || ![...row.stops, ...row.more].some((s) => s.eventId === eventId))
    return { ok: false, error: "This plan isn't on this week's Journey" };
  const event = await ctx.db.get(eventId);
  if (!event || !(await canSeeEvent(ctx, event, await loadAudience(ctx, viewer._id))))
    return { ok: false, error: "Event not found" };
  if (isOver(event, now)) return { ok: false, error: "This event is over" };
  const going = await goingAmong(ctx, eventId, await liveCrew(ctx, viewer, row.crewIds));
  const members = (await Promise.all(going.map((id) => ctx.db.get(id)))).filter(
    (u): u is Doc<"users"> => u !== null,
  );
  if (!members.length) return { ok: false, error: "None of your crew are going to this now" };
  return { ok: true, event, members };
}

/** Asks Muse to draft a message to the crew members going. The draft waits in Landing Inbox. */
export const draftJoin = viewerMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }): Promise<Id<"aiJobs">> => {
    const viewerId = ctx.viewer._id;
    const j = await joinable(ctx, ctx.viewer, eventId, Date.now());
    if (!j.ok) throw new ConvexError(j.error);
    if ((await pendingDrafts(ctx, viewerId)).has(eventId))
      throw new ConvexError("Muse's draft is already waiting in your Inbox");
    return startJob(ctx, {
      kind: JOB_KIND,
      key: `${viewerId}:${eventId}`,
      userId: viewerId,
      action: internal.journeys.writeJoin,
      args: { userId: viewerId, eventId },
    });
  },
});

function joinInput(owner: Doc<"users">, event: Doc<"events">, members: Doc<"users">[]): JoinInput {
  return {
    you: owner.firstName,
    people: members.map((m) => m.firstName),
    plan: { title: event.title, when: planWhen(event.startAt), venue: event.venue ?? null },
  };
}

/** What Muse may know for the draft: first names and the Event. No City Profile facts. */
export const joinContext = internalQuery({
  args: { userId: v.id("users"), eventId: v.id("events") },
  handler: async (
    ctx,
    { userId, eventId },
  ): Promise<{ input: JoinInput; memberIds: Id<"users">[] } | null> => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    const j = await joinable(ctx, owner, eventId, Date.now());
    if (!j.ok) throw new Error(j.error);
    return { input: joinInput(owner, j.event, j.members), memberIds: j.members.map((m) => m._id) };
  },
});

export const writeJoin = internalAction({
  args: { jobId: v.id("aiJobs"), userId: v.id("users"), eventId: v.id("events") },
  handler: async (ctx, { jobId, userId, eventId }): Promise<void> => {
    await runJob(ctx, jobId, async (progress) => {
      await progress("Muse is drafting your message", 0, 2);
      const c = await ctx.runQuery(internal.journeys.joinContext, { userId, eventId });
      if (!c) throw new Error("Person not found");
      const source: Source = { kind: "event", eventId };
      const r = await runAgent(ctx, museJoin, {
        input: c.input,
        sources: [source],
        shownTo: userId,
        jobId,
      });
      await ctx.runMutation(internal.journeys.proposeJoin, {
        userId,
        eventId,
        memberIds: c.memberIds,
        text: r.output.text,
        ...(r.cited && { citations: r.cited }),
        runId: r.runId,
        via: r.via,
      });
      await progress("Waiting in your Inbox", 2, 2);
    });
  },
});

/**
 * The viewer's chat with exactly these people (a DM for one, a group chat for
 * more), or a new empty one. Empty threads stay out of everyone's inbox, so
 * nobody sees anything until the owner approves a message.
 */
async function threadWith(ctx: MutationCtx, ownerId: Id<"users">, others: Id<"users">[]) {
  const want = new Set([ownerId, ...others]);
  const kind = others.length === 1 ? "dm" : "group";
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", ownerId))
    .order("desc")
    .take(THREAD_SCAN);
  for (const row of rows) {
    const c = await ctx.db.get(row.conversationId);
    if (
      c?.kind === kind &&
      c.memberIds.length === want.size &&
      c.memberIds.every((id) => want.has(id))
    )
      return c._id;
  }
  return createConversation(ctx, kind, [...want]);
}

/**
 * Stores Muse's draft as a proposal (#6). The crew is checked again first:
 * if anyone left or stopped going, the template is used for who's still going.
 */
export const proposeJoin = internalMutation({
  args: {
    userId: v.id("users"),
    eventId: v.id("events"),
    memberIds: v.array(v.id("users")),
    text: v.string(),
    citations: v.optional(citations),
    runId: v.id("aiRuns"),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
  },
  handler: async (ctx, args): Promise<Id<"proposals"> | null> => {
    const owner = await ctx.db.get(args.userId);
    if (!owner) throw new ConvexError("Person not found");
    const j = await joinable(ctx, owner, args.eventId, Date.now());
    if (!j.ok) throw new ConvexError(j.error);
    if ((await pendingDrafts(ctx, owner._id)).has(args.eventId)) return null;
    const ids = j.members.map((m) => m._id);
    const same =
      ids.length === args.memberIds.length && args.memberIds.every((id) => ids.includes(id));
    const input = joinInput(owner, j.event, j.members);
    const text = same ? args.text : joinTemplate(input);
    const names = nameList(input.people);
    return propose(ctx, {
      ownerId: owner._id,
      payload: { kind: "message", conversationId: await threadWith(ctx, owner._id, ids), text },
      rationale: `${names} from your Move-in Crew ${ids.length === 1 ? "is" : "are"} going to ${j.event.title} ${input.plan.when}.`,
      ...(args.citations && { citations: args.citations }),
      origin: {
        agent: "muse",
        task: JOIN_TASK,
        runId: args.runId,
        via: same ? args.via : "fallback",
      },
    });
  },
});

/* ---------- Seed ---------- */

/** Seed (#32): Maya's Journey for this weekend, built by the same code as the job. */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const maya = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "maya.chen"))
      .unique();
    if (maya) await buildJourney(ctx, maya._id, Date.now(), { force: true });
  },
});
