import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { FactEntry, FactEvidence } from "../lib/cityProfileFacts";
import { DAY } from "./lib/time";
import { cityProfileSeeds } from "./world/cityProfiles";

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
    const briefAt = now - seed.briefDaysAgo * DAY;
    const stated: FactEntry[] = [
      { key: "budget", value: seed.budget },
      { key: "moveIn", value: { month: monthFromNow(now, seed.moveInMonthsFromNow) } },
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
      facts++;
    }

    await ctx.db.insert("cityProfiles", {
      userId: user._id,
      briefCompletedAt: briefAt,
      updatedAt: briefAt,
    });
  }
  return facts;
}

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
