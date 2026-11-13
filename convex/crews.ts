import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { blockedSet } from "./lib/blocks";
import { getProfile } from "./lib/cityProfile";
import {
  type Anchor,
  CREW_MAX,
  crewProfile,
  type MatchBy,
  matchBy,
  matchCrew,
  usableAnchors,
} from "./lib/crews";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getSummaries, type UserSummary } from "./lib/users";
import { crewOptInSeeds } from "./seed/world/crews";

/**
 * Landing Move-in Crew (#30): opt in, choose what you're matched on, and see
 * the people arriving with you. Matching lives in `./lib/crews.ts`. Crews are
 * computed when read, so leaving takes effect at once. #31 (the crew's Group
 * and intros) and #32 (Journeys) build on `myCrew`.
 */

/** How many opt-ins are read per crew query; plenty for a city's month of arrivals. */
const OPT_IN_SCAN = 500;

async function optInRow(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("crewOptIns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** The viewer's own anchor values, for the opt-in toggles ("Feb 2027", "Mission · Bernal Heights"). */
export const status = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const [profile, row] = await Promise.all([
      getProfile(ctx, ctx.viewer),
      optInRow(ctx, ctx.viewer._id),
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
    const row = await optInRow(ctx, ctx.viewer._id);
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
    const row = await optInRow(ctx, ctx.viewer._id);
    if (!row) throw new ConvexError("You're not in a Move-in Crew");
    const m = await checkMatchBy(ctx, ctx.viewer._id, args.matchBy);
    await ctx.db.patch(row._id, { matchBy: m, updatedAt: Date.now() });
  },
});

/** Leave: you stop appearing in anyone's crew right away. */
export const optOut = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const row = await optInRow(ctx, ctx.viewer._id);
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
  const mine = await optInRow(ctx, viewer._id);
  if (!mine) return null;
  const [viewerProfile, rows, blocked] = await Promise.all([
    getProfile(ctx, viewer),
    ctx.db.query("crewOptIns").take(OPT_IN_SCAN),
    blockedSet(ctx, viewer._id),
  ]);
  const others = rows.filter((r) => r.userId !== viewer._id && !blocked.has(r.userId));
  const profiles = await Promise.all(
    others.map(async (r) => crewProfile(await getProfile(ctx, r.userId), r.matchBy)),
  );
  const matches = matchCrew(crewProfile(viewerProfile, mine.matchBy), profiles, CREW_MAX);
  const users = await getSummaries(
    ctx,
    matches.map((m) => m.userId as Id<"users">),
  );
  const members: CrewMember[] = [];
  for (const m of matches) {
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
  },
});
