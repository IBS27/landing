import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { cite, sourceKey } from "./lib/citations";
import { getProfile } from "./lib/cityProfile";
import { crewFor, crewOptIn } from "./lib/crewMembers";
import { type Anchor, crewProfile, type MatchBy, matchBy, usableAnchors } from "./lib/crews";
import {
  type CrewContext,
  type CrewMeetupInput,
  crewContext,
  crewGroupName,
  crewGroupTask,
  crewIntro,
  crewMeetupTask,
  crewRationale,
  meetupIdea,
  pickMeetup,
} from "./lib/crewTasks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { isExpired, propose } from "./lib/proposals";
import { getSummaries, type UserSummary } from "./lib/users";
import { crewOptInSeeds } from "./seed/world/crews";

/**
 * Landing Move-in Crew (#30): opt in, choose what you're matched on, and see
 * the people arriving with you. Matching lives in `./lib/crews.ts`. Crews are
 * computed when read, so leaving takes effect at once. #31 (the crew's Group
 * and intros) and #32 (Journeys) build on `myCrew`.
 */

/** The viewer's own anchor values, for the opt-in toggles ("Feb 2027", "Mission · Bernal Heights"). */
export const status = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const [profile, row] = await Promise.all([
      getProfile(ctx, ctx.viewer),
      crewOptIn(ctx, ctx.viewer._id),
    ]);
    const own = crewProfile(
      profile,
      row?.matchBy ?? { month: true, neighborhood: true, employer: true },
    );
    return {
      briefDone: profile.briefCompletedAt !== null,
      optedIn: row !== null,
      matchBy: row?.matchBy ?? null,
      optedInAt: row?.createdAt ?? null,
      /** The viewer's own values for each anchor; null when the profile doesn't have it. */
      values: {
        month: own.month,
        neighborhoods: own.neighborhoods,
        employer: own.employer?.name ?? null,
      },
      usable: usableAnchors(own),
    };
  },
});

/**
 * The anchors to store: only those turned on that the profile has, so one the
 * person couldn't see checked never starts matching when they add it later.
 */
async function checkMatchBy(ctx: QueryCtx, userId: Id<"users">, m: MatchBy): Promise<MatchBy> {
  const profile = await getProfile(ctx, userId);
  if (profile.briefCompletedAt === null) throw new ConvexError("Set up your City Profile first");
  const usable = usableAnchors(crewProfile(profile, m));
  const on: MatchBy = {
    month: m.month && usable.month,
    neighborhood: m.neighborhood && usable.neighborhood,
    employer: m.employer && usable.employer,
  };
  if (!on.month && !on.neighborhood && !on.employer)
    throw new ConvexError("Turn on at least one thing to match on that's in your City Profile");
  return on;
}

/** Join the Move-in Crew, matched on the anchors in `matchBy`. */
export const optIn = viewerMutation({
  args: { matchBy },
  handler: async (ctx, args) => {
    const m = await checkMatchBy(ctx, ctx.viewer._id, args.matchBy);
    const now = Date.now();
    const row = await crewOptIn(ctx, ctx.viewer._id);
    if (row) await ctx.db.patch(row._id, { matchBy: m, updatedAt: now });
    else
      await ctx.db.insert("crewOptIns", {
        userId: ctx.viewer._id,
        matchBy: m,
        createdAt: now,
        updatedAt: now,
      });
  },
});

export const setMatchBy = viewerMutation({
  args: { matchBy },
  handler: async (ctx, args) => {
    const row = await crewOptIn(ctx, ctx.viewer._id);
    if (!row) throw new ConvexError("You're not in a Move-in Crew");
    const m = await checkMatchBy(ctx, ctx.viewer._id, args.matchBy);
    await ctx.db.patch(row._id, { matchBy: m, updatedAt: Date.now() });
  },
});

/** Leave: you stop appearing in anyone's crew right away. */
export const optOut = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const row = await crewOptIn(ctx, ctx.viewer._id);
    if (row) await ctx.db.delete(row._id);
  },
});

export type CrewMember = {
  user: UserSummary;
  anchors: Anchor[];
  /** Interests you share, strongest first. */
  shared: string[];
  score: number;
};

/**
 * The viewer's Move-in Crew, or null when they haven't opted in (you only see
 * a crew by joining one). Each member shows only what you have in common.
 * People blocked either way never appear.
 */
export const myCrew = viewerQuery({
  args: {},
  handler: async (ctx): Promise<{ members: CrewMember[] } | null> => {
    const members = await viewerCrew(ctx, ctx.viewer);
    return members && { members };
  },
});

/**
 * `myCrew` for other server code, such as the neighborhood page (#16): the
 * viewer's crew members, or null when the viewer hasn't opted in.
 */
export async function viewerCrew(
  ctx: QueryCtx,
  viewer: Doc<"users">,
): Promise<CrewMember[] | null> {
  const crew = await crewFor(ctx, viewer._id);
  if (!crew) return null;
  const users = await getSummaries(
    ctx,
    crew.matches.map((m) => m.userId as Id<"users">),
  );
  const members: CrewMember[] = [];
  for (const m of crew.matches) {
    const user = users.get(m.userId as Id<"users">);
    if (user) members.push({ user, anchors: m.anchors, shared: m.shared, score: m.score });
  }
  return members;
}

/** Seed (#30): Move-in Crew opt-ins for the people in `seed/world/crews.ts`. */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const s of crewOptInSeeds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", s.username))
        .unique();
      if (!user) continue; // Renamed or removed in the seed: skip rather than fail.
      const at = now - s.daysAgo * 86_400_000;
      await ctx.db.insert("crewOptIns", {
        userId: user._id,
        matchBy: s.matchBy,
        createdAt: at,
        updatedAt: at,
      });
    }
    // #31: Maya's crew Group waits for her OK in Landing Inbox, written by the
    // templates (the seed runs with AI off).
    const maya = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "maya.chen"))
      .unique();
    if (maya) await proposeCrewGroupFromTemplate(ctx, maya._id);
  },
});

/* ---------------- The crew's Group and first meetup (#31) ---------------- */

const GROUP_TASK = "muse.crewGroup";
const MEETUP_TASK = "muse.crewMeetup";

type ProposalStatus = Doc<"proposals">["status"];

/**
 * Where the owner's crew Group stands, from their own proposals: the latest
 * `muse.crewGroup` and `muse.crewMeetup` ones, and what approving them made.
 */
async function crewGroupState(ctx: QueryCtx, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("proposals")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(100);
  const statusOf = (p: Doc<"proposals">): ProposalStatus => (isExpired(p) ? "expired" : p.status);
  const groupP = rows.find((p) => p.origin.task === GROUP_TASK);
  const meetupP = rows.find((p) => p.origin.task === MEETUP_TASK);
  const groupDoc =
    groupP?.result?.kind === "group" ? await ctx.db.get(groupP.result.groupId) : null;
  const eventDoc =
    meetupP?.result?.kind === "event" ? await ctx.db.get(meetupP.result.eventId) : null;
  return {
    group: groupDoc
      ? {
          _id: groupDoc._id,
          slug: groupDoc.slug,
          name: groupDoc.name,
          memberCount: groupDoc.memberCount,
        }
      : null,
    groupProposal: groupP ? { _id: groupP._id, status: statusOf(groupP) } : null,
    // A meetup belongs to the current Group only if it was proposed after the Group.
    meetup:
      meetupP && groupDoc && meetupP.createdAt >= (groupP?.createdAt ?? 0)
        ? {
            _id: meetupP._id,
            status: statusOf(meetupP),
            event: eventDoc
              ? { _id: eventDoc._id, title: eventDoc.title, startAt: eventDoc.startAt }
              : null,
          }
        : null,
  };
}
export type CrewGroupState = Awaited<ReturnType<typeof crewGroupState>>;

/** The viewer's crew Group, its proposal and the first meetup, for the Crew page. */
export const crewGroup = viewerQuery({
  args: {},
  handler: (ctx) => crewGroupState(ctx, ctx.viewer._id),
});

export const groupState = internalQuery({
  args: { ownerId: v.id("users") },
  handler: (ctx, { ownerId }) => crewGroupState(ctx, ownerId),
});

export const groupContext = internalQuery({
  args: { ownerId: v.id("users"), eventsOnly: v.boolean() },
  handler: (ctx, { ownerId, eventsOnly }) => crewContext(ctx, ownerId, { eventsOnly }),
});

const OPEN: ProposalStatus[] = ["pending"];

function assertCanStartGroup(state: CrewGroupState) {
  if (state.group) throw new ConvexError("Your crew already has a Group");
  if (state.groupProposal && OPEN.includes(state.groupProposal.status))
    throw new ConvexError("Your crew Group is waiting for your OK in Landing Inbox");
}

/**
 * Muse drafts the crew's Group: a name, an intro in the owner's voice and a
 * first meetup idea from a cited public Event or Group (`muse.crewGroup`). It
 * becomes a pending proposal in Landing Inbox; nothing is created until the
 * owner approves it there.
 */
export const proposeGroup = action({
  args: { viewerId: v.id("users") },
  // Explicit types: this action calls functions in its own module.
  handler: async (ctx, { viewerId }): Promise<Id<"proposals">> => {
    const state: CrewGroupState = await ctx.runQuery(internal.crews.groupState, {
      ownerId: viewerId,
    });
    assertCanStartGroup(state);
    const c: CrewContext | null = await ctx.runQuery(internal.crews.groupContext, {
      ownerId: viewerId,
      eventsOnly: false,
    });
    if (!c) throw new ConvexError("Join the Move-in Crew and get matched first");
    if (c.sources.length === 0)
      throw new ConvexError("Muse couldn't find a first meetup idea yet. Try again soon.");
    const r = await runAgent(ctx, crewGroupTask, {
      input: c.input,
      sources: c.sources,
      shownTo: viewerId,
    });
    if (!r.cited)
      throw new ConvexError("Muse couldn't ground a first meetup idea. Try again soon.");
    const o = r.output;
    return ctx.runMutation(internal.proposals.propose, {
      ownerId: viewerId,
      payload: {
        kind: "group",
        name: o.name.trim(),
        description: `${o.intro.trim()}\n\nFirst meetup idea: ${o.meetupIdea.trim()}`,
        privacy: "private",
        inviteIds: c.inviteIds,
      },
      rationale: o.rationale.trim(),
      citations: r.cited,
      origin: { agent: "muse", task: GROUP_TASK, runId: r.runId, via: r.via },
    });
  },
});

/**
 * Once the crew's Group exists, Muse plans the first meetup in it, at a cited
 * upcoming public Event (`muse.crewMeetup`). The time and place come from that
 * Event, not the model. Pending in Landing Inbox until the owner approves.
 */
export const proposeMeetup = action({
  args: { viewerId: v.id("users") },
  handler: async (ctx, { viewerId }): Promise<Id<"proposals">> => {
    const state: CrewGroupState = await ctx.runQuery(internal.crews.groupState, {
      ownerId: viewerId,
    });
    if (!state.group) throw new ConvexError("Start your crew's Group first");
    if (state.meetup && (OPEN.includes(state.meetup.status) || state.meetup.event))
      throw new ConvexError("Your crew's first meetup is already planned");
    const c: CrewContext | null = await ctx.runQuery(internal.crews.groupContext, {
      ownerId: viewerId,
      eventsOnly: true,
    });
    const options = c?.input.meetupOptions.filter((o) => o.kind === "event") ?? [];
    if (!c || options.length === 0)
      throw new ConvexError("Muse couldn't find an upcoming event for a first meetup yet");
    const input: CrewMeetupInput = {
      groupName: state.group.name,
      members: c.input.members.map((m) => m.firstName),
      options,
    };
    const sources = c.sources.filter((s) => s.kind === "event");
    const r = await runAgent(ctx, crewMeetupTask, { input, sources, shownTo: viewerId });
    const event = c.events[r.output.eventSource];
    if (!event || !r.cited)
      throw new ConvexError("Muse couldn't ground the meetup. Try again soon.");
    return ctx.runMutation(internal.proposals.propose, {
      ownerId: viewerId,
      payload: {
        kind: "event",
        title: r.output.title.trim(),
        description: r.output.description.trim(),
        startAt: event.startAt,
        venue: event.venue ?? undefined,
        groupId: state.group._id,
        inviteIds: c.inviteIds,
      },
      rationale: `The first meetup for ${state.group.name}, at an upcoming event that fits what your crew shares.`,
      citations: r.cited,
      origin: { agent: "muse", task: MEETUP_TASK, runId: r.runId, via: r.via },
    });
  },
});

/** The crew Group proposal the templates write (AI off): used by the seed. */
async function proposeCrewGroupFromTemplate(ctx: MutationCtx, ownerId: Id<"users">) {
  const c = await crewContext(ctx, ownerId, { eventsOnly: false });
  const pick = c ? pickMeetup(c.input.meetupOptions) : null;
  const source = pick && c?.sources.find((s) => sourceKey(s) === pick.source);
  if (!c || !pick || !source) return;
  await propose(ctx, {
    ownerId,
    payload: {
      kind: "group",
      name: crewGroupName(c.input.owner.moving, c.input.commonPlace),
      description: `${crewIntro(c.input)}\n\nFirst meetup idea: ${meetupIdea(pick)}`,
      privacy: "private",
      inviteIds: c.inviteIds,
    },
    rationale: crewRationale(c.input),
    citations: cite([source]),
    origin: { agent: "muse", task: GROUP_TASK, via: "fallback" },
  });
}
