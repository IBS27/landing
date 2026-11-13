import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { FactEntry, FactEvidence } from "../lib/cityProfileFacts";
import { DAY } from "./lib/time";
import { type CityProfileSeed, cityProfileSeeds } from "./world/cityProfiles";

/**
 * Seeds Landing City Profiles (#3) after users, Groups and Events exist.
 * Stated facts come from `world/cityProfiles.ts`. Inferred interests come
 * afterwards from #4's backfill (`profileSignals.backfill`), which replays the
 * personas' real RSVPs, joins, likes and saves through the same rules as live
 * activity.
 */
export async function seedCityProfiles(ctx: MutationCtx, now: number) {
  let facts = 0;
  for (const seed of cityProfileSeeds) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", seed.username))
      .unique();
    if (!user) continue; // The persona was renamed or removed; skip rather than fail the seed.
    facts += await insertCityProfile(ctx, user, seed, now);
  }
  return facts;
}

/**
 * One person's City Profile from a seed: the brief and its stated facts, as of
 * `now`. Also builds a demo user's starting profile (`convex/lib/demoClone.ts`).
 * Returns how many facts it wrote.
 */
export async function insertCityProfile(
  ctx: MutationCtx,
  user: Doc<"users">,
  seed: CityProfileSeed,
  now: number,
) {
  const briefAt = now - seed.briefDaysAgo * DAY;
  const stated: FactEntry[] = [
    { key: "budget", value: seed.budget },
    { key: "moveIn", value: moveIn(now, seed) },
    { key: "transport", value: { modes: seed.transport } },
    { key: "schedule", value: seed.schedule },
    ...employerFact(seed.employerFromWork ? user : null),
    ...seed.neighborhoods.map((slug) => ({ key: "neighborhood" as const, value: { slug } })),
    ...seed.interests.map((id) => ({ key: "interest" as const, value: { id } })),
    ...seed.goals.map((id) => ({ key: "goal" as const, value: { id } })),
  ];
  const brief: FactEvidence = { kind: "brief", summary: "You said so in your brief" };
  for (const entry of stated) {
    await ctx.db.insert("cityProfileFacts", {
      userId: user._id,
      ...entry,
      source: "stated",
      evidence: brief,
      confidence: 1,
      updatedAt: briefAt,
    });
  }
  await ctx.db.insert("cityProfiles", {
    userId: user._id,
    briefCompletedAt: briefAt,
    updatedAt: briefAt,
  });
  return stated.length;
}

/** The move-in fact: a date for people who already moved in, else a month. */
function moveIn(now: number, seed: CityProfileSeed) {
  if (seed.moveInDaysAgo === undefined)
    return { month: monthFromNow(now, seed.moveInMonthsFromNow) };
  const date = SF_DATE.format(now - seed.moveInDaysAgo * DAY);
  return { month: date.slice(0, 7), date };
}

/** "2026-10-27": en-CA formats dates as YYYY-MM-DD. */
const SF_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM" for the month `n` months after `now` (Pacific time is close enough for a month). */
function monthFromNow(now: number, n: number): string {
  const d = new Date(now);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The current (or incoming) job on the person's Facebook profile: the first one with no end. */
function employerFact(user: Doc<"users"> | null): FactEntry[] {
  const job = user?.work?.find((w) => !w.end);
  return job ? [{ key: "employer", value: { name: job.company } }] : [];
}
