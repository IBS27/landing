import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { type FactEntry, type FactEvidence, factSlot } from "../lib/cityProfileFacts";
import { getInterest, type InterestId, interestsForGroup, interestsInText } from "../lib/interests";
import { DAY } from "./lib/time";
import { cityProfileSeeds } from "./world/cityProfiles";

/**
 * Seeds Landing City Profiles (#3) after users, Groups and Events exist.
 * Stated facts come from `world/cityProfiles.ts`; inferred interests are
 * derived from each persona's actual Group joins and Event RSVPs, so their
 * evidence ("You joined SF Climbers") is true in the seeded world.
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

    const statedSlots = new Set(stated.map(factSlot));
    const signals = (await activitySignals(ctx, user._id))
      .filter((s) => !statedSlots.has(`interest:${s.id}`))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // The strongest few, like a person's own activity would show.
    for (const signal of signals) {
      const entry: FactEntry = { key: "interest", value: { id: signal.id } };
      await ctx.db.insert("cityProfileFacts", {
        userId: user._id,
        ...entry,
        source: "inferred",
        evidence: { kind: "activity", summary: signal.summary },
        confidence: Math.min(0.8, 0.35 + 0.15 * signal.count),
        updatedAt: now - DAY,
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

type Signal = { id: InterestId; count: number; summary: string };

/** Interests behind the Groups someone joined and the Events they RSVP'd to. */
async function activitySignals(ctx: MutationCtx, userId: Id<"users">): Promise<Signal[]> {
  const groups: { id: InterestId; name: string }[] = [];
  for (const m of await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()) {
    const g = await ctx.db.get(m.groupId);
    // Only Groups that name a specific interest count, not broad categories.
    if (g)
      for (const id of interestsForGroup({ category: "", tags: g.tags, name: g.name }))
        groups.push({ id, name: g.name });
  }
  const events: { id: InterestId; title: string }[] = [];
  for (const r of await ctx.db
    .query("eventResponses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()) {
    if (r.status === "invited") continue;
    const e = await ctx.db.get(r.eventId);
    if (e) for (const id of interestsInText(e.title)) events.push({ id, title: e.title });
  }

  const ids = new Set<InterestId>([...groups.map((g) => g.id), ...events.map((e) => e.id)]);
  return [...ids].map((id) => {
    const gs = groups.filter((g) => g.id === id);
    const es = events.filter((e) => e.id === id);
    const label = getInterest(id).label.toLowerCase();
    const parts = [
      gs.length === 1
        ? `Joined ${gs[0].name}`
        : gs.length > 1
          ? `Joined ${gs.length} Groups about ${label}`
          : null,
      es.length === 1
        ? `RSVP'd to ${es[0].title}`
        : es.length > 1
          ? `RSVP'd to ${es.length} events about ${label}`
          : null,
    ].filter(Boolean);
    return { id, count: gs.length + es.length, summary: parts.join(" · ") };
  });
}
