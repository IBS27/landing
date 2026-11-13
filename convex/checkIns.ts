import { v } from "convex/values";
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
import { aiEnabled } from "./ai/status";
import { crewGroupState } from "./crews";
import { blockedSet } from "./lib/blocks";
import {
  type Activity,
  activityIn,
  type CheckInInput,
  checkInWindow,
  daysSince,
  doneCount,
  lastWeekWindow,
  levelFor,
  MAX_PER_KIND,
  museCheckIn,
  type PlanOption,
  pickSuggestion,
} from "./lib/checkIns";
import {
  type CitedSource,
  type NonEmpty,
  resolveCitations,
  sourceKey,
  sourcesOf,
  tryCite,
} from "./lib/citations";
import { getProfile } from "./lib/cityProfile";
import { viewerQuery } from "./lib/functions";
import { interestsForEvent } from "./lib/interests";
import { isOver, JOURNEY_WEEKS, moveInStart, planWhen } from "./lib/journeys";
import { type Audience, canSeeEvent, loadAudience } from "./lib/posts";
import { hasProtected } from "./lib/protectedText";
import { getSummaries, type UserSummary } from "./lib/users";
import {
  type CheckInActivity,
  type CheckInSuggestion,
  citations,
  type JourneyCheckIn,
  type Source,
} from "./validators";

/**
 * Weekly check-ins and levels (#33). The rules are in `./lib/checkIns.ts`.
 *
 * - Stored on each week's `journeys` row (#32) by the Journeys job: the daily
 *   build calls `writeCheckIns`, which updates this week's check-in and
 *   finishes any earlier week last computed before it ended.
 * - Read only by their owner (`current`, and `journeys.pastWeeks`). Each
 *   Event, Group and friend is checked again when read, so an un-RSVP, a
 *   leave, an unfriend or a block takes it out at once.
 * - The suggestion is plain code. When it changes and AI is on, Muse
 *   rephrases it (`phrase`); the template stays if Muse's text fails a check.
 */

/** Newest "Going" RSVPs scanned for Events attended. */
const GOING_SCAN = 200;
/** Every week of the first 90 days, plus one. */
const ROWS = JOURNEY_WEEKS + 1;

type Journey = Doc<"journeys">;

function journeyEventIds(row: Pick<Journey, "stops" | "more">): Set<Id<"events">> {
  return new Set([...row.stops, ...row.more].flatMap((s) => s.eventId ?? []));
}

async function goingTo(ctx: QueryCtx, eventId: Id<"events">, userId: Id<"users">) {
  const r = await ctx.db
    .query("eventResponses")
    .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
    .first();
  return r?.status === "going";
}

async function canSeeGroup(ctx: QueryCtx, g: Doc<"groups">, userId: Id<"users">) {
  if (g.privacy === "public") return true;
  const m = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", g._id).eq("userId", userId))
    .unique();
  return m !== null;
}

/* ---------- Gather (scheduled only) ---------- */

/**
 * Everything someone did since `since`, newest first: in-person Events they
 * RSVP'd Going to that have ended, Groups they joined and friendships made
 * (not with anyone blocked). Bounded by `GOING_SCAN` and `MAX_PER_KIND`.
 */
async function gatherActivity(
  ctx: QueryCtx,
  userId: Id<"users">,
  since: number,
  now: number,
): Promise<{ activity: Activity; events: Doc<"events">[] }> {
  const going = await ctx.db
    .query("eventResponses")
    .withIndex("by_user", (q) => q.eq("userId", userId).eq("status", "going"))
    .order("desc")
    .take(GOING_SCAN);
  const events: Doc<"events">[] = [];
  for (const r of going) {
    const e = await ctx.db.get(r.eventId);
    if (e && !e.online && e.startAt >= since && isOver(e, now)) events.push(e);
  }
  events.sort((a, b) => b.startAt - a.startAt);

  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId).gte("joinedAt", since))
    .order("desc")
    .take(MAX_PER_KIND);
  const groups: Activity["groups"] = [];
  for (const m of members)
    if (await ctx.db.get(m.groupId)) groups.push({ id: m.groupId, at: m.joinedAt });

  const blocked = await blockedSet(ctx, userId);
  const friendRows = await ctx.db
    .query("friendships")
    .withIndex("by_user", (q) => q.eq("userId", userId).gte("createdAt", since))
    .order("desc")
    .take(MAX_PER_KIND);
  const friends: Activity["friends"] = [];
  for (const f of friendRows)
    if (!blocked.has(f.friendId) && (await ctx.db.get(f.friendId)))
      friends.push({ id: f.friendId, at: f.createdAt });

  return {
    activity: { events: events.map((e) => ({ id: e._id, at: e.startAt })), groups, friends },
    events,
  };
}

/* ---------- The suggestion (scheduled only) ---------- */

/** This weekend's Journey plans the person can still go to and isn't going to yet, in Journey order. */
async function planOptions(
  ctx: QueryCtx,
  row: Journey,
  a: Audience,
  now: number,
): Promise<PlanOption[]> {
  const out: PlanOption[] = [];
  for (const [rank, s] of [...row.stops, ...row.more].entries()) {
    if (!s.eventId) continue;
    const e = await ctx.db.get(s.eventId);
    if (!e || isOver(e, now) || a.blocked.has(e.hostId) || !(await canSeeEvent(ctx, e, a)))
      continue;
    if (await goingTo(ctx, e._id, a.viewerId)) continue;
    const g = e.groupId ? await ctx.db.get(e.groupId) : null;
    out.push({
      eventId: e._id,
      title: e.title,
      startAt: e.startAt,
      interests: interestsForEvent(e),
      group:
        g && (g.privacy === "public" || a.groups.has(g._id)) ? { _id: g._id, name: g.name } : null,
      rank,
    });
  }
  return out;
}

async function suggestionFor(
  ctx: MutationCtx,
  row: Journey,
  attended: Doc<"events">[],
  joined: ReadonlySet<Id<"groups">>,
  lastWeekDone: number | null,
  now: number,
): Promise<CheckInSuggestion | undefined> {
  const a = await loadAudience(ctx, row.userId);
  const crew = await crewGroupState(ctx, row.userId);
  const crewGroup = crew.group && a.groups.has(crew.group._id) ? crew.group : null;
  const m = crew.meetup?.event ? await ctx.db.get(crew.meetup.event._id) : null;
  const s = pickSuggestion({
    lastWeekDone,
    attended: attended.map((e) => ({
      eventId: e._id,
      title: hasProtected(e.title) ? null : e.title,
      interests: interestsForEvent(e),
    })),
    joined,
    crewGroup,
    meetup:
      m && (await canSeeEvent(ctx, m, a))
        ? {
            eventId: m._id,
            title: m.title,
            startAt: m.startAt,
            over: isOver(m, now),
            going: await goingTo(ctx, m._id, row.userId),
          }
        : null,
    plans: await planOptions(ctx, row, a, now),
  });
  const cited = s && tryCite(s.sources);
  if (!s || !cited || !(await resolveCitations(ctx, cited, a))) return undefined;
  const prev = row.checkIn?.suggestion;
  if (prev?.template === s.template) return prev;
  if (aiEnabled())
    await ctx.scheduler.runAfter(0, internal.checkIns.phrase, {
      journeyId: row._id,
      template: s.template,
    });
  return {
    kind: s.kind,
    ...(s.eventId && { eventId: s.eventId }),
    ...(s.groupId && { groupId: s.groupId }),
    template: s.template,
    text: s.template,
    via: "template",
    citations: cited,
  };
}

/* ---------- Write (scheduled only) ---------- */

/**
 * Updates someone's check-ins: this week's, and any earlier week whose
 * check-in is missing or was last computed before the week ended. Called by
 * the Journeys build and by `refresh` (for the week after the first 90 days).
 */
export async function writeCheckIns(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const profile = await getProfile(ctx, user);
  if (profile.briefCompletedAt === null || !profile.moveIn) return;
  const moveInAt = moveInStart(profile.moveIn.value);
  const rows = await ctx.db
    .query("journeys")
    .withIndex("by_user_week", (q) => q.eq("userId", userId))
    .order("desc")
    .take(ROWS);
  const stale = (r: Journey) => r.endsAt > now || !r.checkIn || r.checkIn.computedAt < r.endsAt;
  if (!rows.some(stale)) return;

  const { activity, events } = await gatherActivity(ctx, userId, moveInAt, now);
  const onJourneys = new Set(rows.flatMap((r) => [...journeyEventIds(r)]));
  const total = activityIn(activity, moveInAt, now + 1, onJourneys);
  for (const [i, row] of rows.entries()) {
    if (!stale(row)) continue;
    const { from, to } = checkInWindow(row, moveInAt);
    const week = activityIn(activity, from, to, journeyEventIds(row));
    let suggestion: CheckInSuggestion | undefined;
    if (i === 0 && row.endsAt > now) {
      const last = lastWeekWindow(row, moveInAt);
      suggestion = await suggestionFor(
        ctx,
        row,
        events,
        new Set(total.groups),
        last && doneCount(activityIn(activity, last.from, last.to, onJourneys)),
        now,
      );
    } else suggestion = row.checkIn?.suggestion;
    const checkIn: JourneyCheckIn = {
      from,
      to,
      week,
      total,
      ...(suggestion && { suggestion }),
      computedAt: now,
    };
    await ctx.db.patch(row._id, { checkIn });
  }
}

/** Finishes a check-in when there's no Journey to build (the week after the first 90 days). */
export const refresh = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => writeCheckIns(ctx, userId, Date.now()),
});

/* ---------- Muse phrasing (optional) ---------- */

/** What Muse may know: first name, counts, the suggested plan or Group and what it builds on. */
export const phraseContext = internalQuery({
  args: { journeyId: v.id("journeys"), template: v.string() },
  handler: async (
    ctx,
    { journeyId, template },
  ): Promise<{ userId: Id<"users">; input: CheckInInput; sources: NonEmpty<Source> } | null> => {
    const row = await ctx.db.get(journeyId);
    const s = row?.checkIn?.suggestion;
    const user = row && (await ctx.db.get(row.userId));
    if (!row || !s || s.template !== template || !user) return null;
    const profile = await getProfile(ctx, user);
    if (!profile.moveIn) return null;
    const moveInAt = moveInStart(profile.moveIn.value);
    const prev = await ctx.db
      .query("journeys")
      .withIndex("by_user_week", (q) => q.eq("userId", row.userId).lt("weekOf", row.weekOf))
      .order("desc")
      .first();
    const last = prev?.checkIn && row.week > 1 ? prev.checkIn.week : null;
    const event = s.eventId ? await ctx.db.get(s.eventId) : null;
    const groupId = s.groupId ?? event?.groupId;
    const group = groupId ? await ctx.db.get(groupId) : null;
    const sources = sourcesOf(s.citations);
    const went = s.kind === "moreLike" && sources[1]?.kind === "event" ? sources[1] : null;
    const wentTo = went ? await ctx.db.get(went.eventId) : null;
    // What Muse would read about these plans (titles and descriptions, as the
    // cited sources carry them). Anything protected-sounding keeps the template.
    const text = [event, group, wentTo].flatMap((d) =>
      d ? ["title" in d ? d.title : d.name, d.description] : [],
    );
    if (text.some(hasProtected)) return null;
    return {
      userId: user._id,
      sources,
      input: {
        you: user.firstName,
        weeksIn: Math.max(1, Math.floor(daysSince(moveInAt, Date.now()) / 7)),
        lastWeek: last
          ? { events: last.events.length, groups: last.groups.length, friends: last.friends.length }
          : null,
        kind: s.kind,
        plan: event
          ? { title: event.title, when: planWhen(event.startAt), venue: event.venue ?? null }
          : null,
        group: group && (await canSeeGroup(ctx, group, user._id)) ? group.name : null,
        wentTo: wentTo?.title ?? null,
        draft: s.template,
      },
    };
  },
});

export const phrase = internalAction({
  args: { journeyId: v.id("journeys"), template: v.string() },
  handler: async (ctx, { journeyId, template }): Promise<void> => {
    const c = await ctx.runQuery(internal.checkIns.phraseContext, { journeyId, template });
    if (!c) return;
    const r = await runAgent(ctx, museCheckIn, {
      input: c.input,
      sources: [...c.sources],
      shownTo: c.userId,
    });
    if (r.via === "fallback" || !r.cited) return;
    await ctx.runMutation(internal.checkIns.savePhrasing, {
      journeyId,
      template,
      text: r.output.text.trim(),
      citations: r.cited,
      runId: r.runId,
    });
  },
});

/**
 * Stores Muse's phrasing if the suggestion hasn't changed since, Muse cited
 * what's suggested, and the owner can still see every source.
 */
export const savePhrasing = internalMutation({
  args: {
    journeyId: v.id("journeys"),
    template: v.string(),
    text: v.string(),
    citations,
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.journeyId);
    const s = row?.checkIn?.suggestion;
    if (!row?.checkIn || !s || s.template !== args.template) return;
    const target = sourceKey(sourcesOf(s.citations)[0]);
    if (!sourcesOf(args.citations).some((c) => sourceKey(c) === target)) return;
    if (!(await resolveCitations(ctx, args.citations, await loadAudience(ctx, row.userId)))) return;
    await ctx.db.patch(row._id, {
      checkIn: {
        ...row.checkIn,
        suggestion: {
          ...s,
          text: args.text,
          via: "model",
          runId: args.runId,
          citations: args.citations,
        },
      },
    });
  },
});

/* ---------- Read (owner only) ---------- */

export type ActivityView = {
  events: { _id: Id<"events">; title: string; startAt: number }[];
  groups: { _id: Id<"groups">; slug: string; name: string }[];
  friends: UserSummary[];
  /** Of `events`, the ones that were on a Journey. */
  journeyStops: Id<"events">[];
};

/**
 * A stored check-in's records as the viewer may see them now. Events they no
 * longer RSVP Going to, Groups they left, friendships that ended and anyone
 * blocked drop out.
 */
export async function viewActivity(
  ctx: QueryCtx,
  a: Audience,
  act: CheckInActivity,
): Promise<ActivityView> {
  const events: ActivityView["events"] = [];
  for (const id of act.events) {
    const e = await ctx.db.get(id);
    if (!e || e.online || !isOver(e, Date.now()) || a.blocked.has(e.hostId)) continue;
    if (!(await goingTo(ctx, id, a.viewerId))) continue;
    if (!(await canSeeEvent(ctx, e, a))) continue;
    events.push({ _id: e._id, title: e.title, startAt: e.startAt });
  }
  const groups: ActivityView["groups"] = [];
  for (const id of act.groups) {
    const g = a.groups.has(id) ? await ctx.db.get(id) : null;
    if (g) groups.push({ _id: g._id, slug: g.slug, name: g.name });
  }
  const live = new Set(events.map((e) => e._id));
  return {
    events,
    groups,
    friends: [
      ...(
        await getSummaries(
          ctx,
          act.friends.filter((id) => a.friends.has(id) && !a.blocked.has(id)),
        )
      ).values(),
    ],
    journeyStops: act.journeyStops.filter((id) => live.has(id)),
  };
}

export type SuggestionView = {
  kind: CheckInSuggestion["kind"];
  text: string;
  via: CheckInSuggestion["via"];
  sources: NonEmpty<CitedSource>;
  event: { _id: Id<"events">; title: string; startAt: number; viewerGoing: boolean } | null;
  group: { slug: string; name: string } | null;
};

async function viewSuggestion(
  ctx: QueryCtx,
  a: Audience,
  s: CheckInSuggestion,
  now: number,
): Promise<SuggestionView | null> {
  const sources = await resolveCitations(ctx, s.citations, a);
  if (!sources) return null;
  let event: SuggestionView["event"] = null;
  if (s.eventId) {
    const e = await ctx.db.get(s.eventId);
    if (!e || isOver(e, now) || !(await canSeeEvent(ctx, e, a))) return null;
    event = {
      _id: e._id,
      title: e.title,
      startAt: e.startAt,
      viewerGoing: await goingTo(ctx, e._id, a.viewerId),
    };
  }
  const g = s.groupId ? await ctx.db.get(s.groupId) : null;
  if (s.groupId && (!g || !a.groups.has(g._id))) return null;
  return {
    kind: s.kind,
    text: s.text,
    via: s.via,
    sources,
    event,
    group: g ? { slug: g.slug, name: g.name } : null,
  };
}

/**
 * The viewer's check-in: what they've done since move-in, this week so far
 * and last week, their level and what the next one needs, and what to try
 * next. Null until the Journeys job has written their first check-in.
 */
export const current = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const profile = await getProfile(ctx, ctx.viewer);
    if (profile.briefCompletedAt === null || !profile.moveIn) return null;
    const moveInAt = moveInStart(profile.moveIn.value);
    const rows = (
      await ctx.db
        .query("journeys")
        .withIndex("by_user_week", (q) => q.eq("userId", ctx.viewer._id))
        .order("desc")
        .take(3)
    ).filter((r): r is Journey & { checkIn: JourneyCheckIn } => r.checkIn !== undefined);
    const thisWeek = rows.find((r) => r.endsAt > now) ?? null;
    const lastWeek = rows.find((r) => r.endsAt <= now) ?? null;
    const latest = thisWeek ?? lastWeek;
    if (!latest || now < moveInAt) return null;

    const a = await loadAudience(ctx, ctx.viewer._id);
    const week = async (r: (typeof rows)[number] | null) =>
      r && {
        week: r.week,
        from: r.checkIn.from,
        to: r.checkIn.to,
        ...(await viewActivity(ctx, a, r.checkIn.week)),
      };
    const total = await viewActivity(ctx, a, latest.checkIn.total);
    const days = daysSince(moveInAt, now);
    const s = thisWeek?.checkIn.suggestion;
    return {
      moveInAt,
      days,
      total,
      level: levelFor(days, doneCount(total)),
      thisWeek: await week(thisWeek),
      lastWeek: await week(lastWeek),
      suggestion: s ? await viewSuggestion(ctx, a, s, now) : null,
      computedAt: latest.checkIn.computedAt,
    };
  },
});
