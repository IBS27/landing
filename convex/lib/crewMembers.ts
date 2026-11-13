import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { blockedSet } from "./blocks";
import { getProfile } from "./cityProfile";
import { CREW_MAX, type CrewMatch, crewProfile, type MatchBy, matchCrew } from "./crews";

/**
 * A person's current Move-in Crew (#30), computed from everyone who opted in.
 * The one place crews are worked out: the Crew page and neighborhood page
 * (`crews.viewerCrew`), crew proposals (#31) and the approval queue's invite
 * check all read it.
 */

/** Muse tasks whose proposals invite only the owner's current crew (#31). */
export const CREW_TASKS: ReadonlySet<string> = new Set(["muse.crewGroup", "muse.crewMeetup"]);

/** How many opt-ins are read per crew; plenty for a city's month of arrivals. */
const OPT_IN_SCAN = 500;

export async function crewOptIn(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("crewOptIns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** The person's crew, best match first, or null when they haven't opted in. */
export async function crewFor(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{ matchBy: MatchBy; matches: CrewMatch[] } | null> {
  const mine = await crewOptIn(ctx, userId);
  if (!mine) return null;
  const [profile, rows, blocked] = await Promise.all([
    getProfile(ctx, userId),
    // Demo users (one per browser) see a crew of the seeded world, never each other.
    ctx.db
      .query("crewOptIns")
      .withIndex("by_demo", (q) => q.eq("demo", undefined))
      .take(OPT_IN_SCAN),
    blockedSet(ctx, userId),
  ]);
  const others = rows.filter((r) => r.userId !== userId && !blocked.has(r.userId));
  const profiles = await Promise.all(
    others.map(async (r) => crewProfile(await getProfile(ctx, r.userId), r.matchBy)),
  );
  return {
    matchBy: mine.matchBy,
    matches: matchCrew(crewProfile(profile, mine.matchBy), profiles, CREW_MAX),
  };
}

/** Who is in the person's crew right now (empty when they haven't opted in). */
export async function crewMateIds(ctx: QueryCtx, userId: Id<"users">): Promise<Set<Id<"users">>> {
  const crew = await crewFor(ctx, userId);
  return new Set((crew?.matches ?? []).map((m) => m.userId as Id<"users">));
}
