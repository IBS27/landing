import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type FactEntry,
  type FactEvidence,
  type FactKey,
  type FactSource,
  factSlot,
  valueKey,
} from "./cityProfileFacts";
import { getInterest, type InterestId } from "./interests";
import { hasProtected } from "./protectedText";

/**
 * The City Profile's only read path and its only writers. Features call
 * `getProfile`, `recordInferredFact` and `removeFact`; nothing else touches
 * the `cityProfiles` / `cityProfileFacts` tables.
 */

type FactDoc = Doc<"cityProfileFacts">;

/** A fact as features see it: typed value plus where it came from. */
export type Fact<K extends FactKey = FactKey> = Extract<FactEntry, { key: K }> & {
  _id: Id<"cityProfileFacts">;
  source: FactSource;
  evidence: FactEvidence;
  confidence: number;
  updatedAt: number;
};

export type CityProfile = {
  userId: Id<"users">;
  /** When the onboarding brief was last submitted; null = not onboarded yet. */
  briefCompletedAt: number | null;
  budget: Fact<"budget"> | null;
  moveIn: Fact<"moveIn"> | null;
  transport: Fact<"transport"> | null;
  schedule: Fact<"schedule"> | null;
  employer: Fact<"employer"> | null;
  /** Stated first, then by confidence. */
  neighborhoods: Fact<"neighborhood">[];
  interests: Fact<"interest">[];
  goals: Fact<"goal">[];
  /** Every active fact (removed ones excluded), for "What Muse knows about you" (#5). */
  facts: Fact[];
};

/** Evidence as features may see it: a quote that names a protected trait is never passed on. */
function safeEvidence(e: FactEvidence): FactEvidence {
  if (e.quote === undefined || !hasProtected(e.quote)) return e;
  return { kind: e.kind, summary: e.summary };
}

function toFact(d: FactDoc): Fact {
  return {
    _id: d._id,
    key: d.key,
    value: d.value,
    source: d.source,
    evidence: safeEvidence(d.evidence),
    confidence: d.confidence,
    updatedAt: d.updatedAt,
  } as Fact;
}

/** Stated before inferred, then higher confidence, then newer. */
function rank(a: Fact, b: Fact): number {
  if (a.source !== b.source) return a.source === "stated" ? -1 : 1;
  if (a.confidence !== b.confidence) return b.confidence - a.confidence;
  return b.updatedAt - a.updatedAt;
}

function only<K extends FactKey>(facts: Fact[], key: K): Fact<K>[] {
  return facts.filter((f): f is Fact<K> => f.key === key).sort(rank);
}

/**
 * The one way to read a City Profile. Never exposes Facebook profile fields
 * like pronouns, birthday or relationship status: matching can't use what the
 * profile doesn't carry.
 */
export async function getProfile(
  ctx: QueryCtx,
  viewer: Doc<"users"> | Id<"users">,
): Promise<CityProfile> {
  const userId = typeof viewer === "string" ? viewer : viewer._id;
  const [row, docs] = await Promise.all([
    ctx.db
      .query("cityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
    ctx.db
      .query("cityProfileFacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);
  const facts = docs
    .filter((d) => d.removedAt === undefined)
    .map(toFact)
    .sort(rank);
  return {
    userId,
    briefCompletedAt: row?.briefCompletedAt ?? null,
    budget: only(facts, "budget")[0] ?? null,
    moveIn: only(facts, "moveIn")[0] ?? null,
    transport: only(facts, "transport")[0] ?? null,
    schedule: only(facts, "schedule")[0] ?? null,
    employer: only(facts, "employer")[0] ?? null,
    neighborhoods: only(facts, "neighborhood"),
    interests: only(facts, "interest"),
    goals: only(facts, "goal"),
    facts,
  };
}

/** How much each interest counts for matching: stated 1, inferred its confidence. */
export function interestWeights(profile: CityProfile): Map<InterestId, number> {
  const m = new Map<InterestId, number>();
  for (const f of profile.interests) {
    const w = f.source === "stated" ? 1 : f.confidence;
    m.set(f.value.id, Math.max(m.get(f.value.id) ?? 0, w));
  }
  return m;
}

/** Whether the person has a car; null when they haven't said or it hasn't been inferred. */
export function hasCar(profile: CityProfile): boolean | null {
  return profile.transport ? profile.transport.value.modes.includes("car") : null;
}

/** Interest labels in profile order, for intros and explanations ("Maya, Dev and Priya all climb"). */
export function interestLabels(profile: CityProfile): string[] {
  return profile.interests.map((f) => getInterest(f.value.id).label);
}

/* ---------------- Writers ---------------- */

function sameValue(a: unknown, b: unknown) {
  return valueKey(a) === valueKey(b);
}

async function rowsFor(ctx: QueryCtx, userId: Id<"users">, key: FactKey) {
  return ctx.db
    .query("cityProfileFacts")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .collect();
}

async function touchProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
  patch: { briefCompletedAt?: number } = {},
) {
  const now = Date.now();
  const row = await ctx.db
    .query("cityProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (row) await ctx.db.patch(row._id, { ...patch, updatedAt: now });
  else await ctx.db.insert("cityProfiles", { userId, ...patch, updatedAt: now });
}

export type StatedFact = { entry: FactEntry; evidence: FactEvidence };

/**
 * Makes `facts` the person's stated facts for `keys` (the onboarding brief).
 * - A fact they state now becomes stated, even if it was inferred or removed.
 * - A stated fact they no longer state is marked removed, so it isn't inferred back.
 * - Inferred facts the brief doesn't mention are left alone.
 */
export async function saveStatedFacts(
  ctx: MutationCtx,
  userId: Id<"users">,
  keys: readonly FactKey[],
  facts: StatedFact[],
  opts: { completeBrief?: boolean } = {},
) {
  const now = Date.now();
  const wanted = new Map(facts.map((f) => [factSlot(f.entry), f]));
  for (const key of keys) {
    const rows = await rowsFor(ctx, userId, key);
    const seen = new Set<string>();
    for (const row of rows) {
      const slot = factSlot(row);
      const next = wanted.get(slot);
      if (next && !seen.has(slot)) {
        seen.add(slot);
        const unchanged =
          row.source === "stated" &&
          row.removedAt === undefined &&
          sameValue(row.value, next.entry.value) &&
          sameValue(row.evidence, next.evidence);
        if (!unchanged) {
          await ctx.db.patch(row._id, {
            value: next.entry.value,
            source: "stated",
            evidence: next.evidence,
            confidence: 1,
            updatedAt: now,
            removedAt: undefined,
          } as Partial<FactDoc>);
        }
      } else if (next) {
        // A duplicate row for the same slot: keep one.
        await ctx.db.delete(row._id);
      } else if (row.source === "stated" && row.removedAt === undefined) {
        await ctx.db.patch(row._id, { removedAt: now, updatedAt: now });
      }
    }
    for (const [slot, f] of wanted) {
      if (f.entry.key !== key || seen.has(slot)) continue;
      await ctx.db.insert("cityProfileFacts", {
        userId,
        ...f.entry,
        source: "stated",
        evidence: f.evidence,
        confidence: 1,
        updatedAt: now,
      });
    }
  }
  await touchProfile(ctx, userId, opts.completeBrief ? { briefCompletedAt: now } : {});
}

/**
 * Records something learned from activity (#4). Never overrides what the
 * person said, and never brings back a fact they removed. Returns the fact id,
 * or null when it was skipped.
 */
export async function recordInferredFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  entry: FactEntry,
  opts: { confidence: number; evidence: FactEvidence },
): Promise<Id<"cityProfileFacts"> | null> {
  const now = Date.now();
  const confidence = Math.min(1, Math.max(0, opts.confidence));
  const slot = factSlot(entry);
  const rows = await rowsFor(ctx, userId, entry.key);
  const row = rows.find((r) => factSlot(r) === slot);
  if (row) {
    if (row.removedAt !== undefined || row.source === "stated") return null;
    await ctx.db.patch(row._id, {
      value: entry.value,
      confidence,
      evidence: opts.evidence,
      updatedAt: now,
    } as Partial<FactDoc>);
    return row._id;
  }
  const id = await ctx.db.insert("cityProfileFacts", {
    userId,
    ...entry,
    source: "inferred",
    evidence: opts.evidence,
    confidence,
    updatedAt: now,
  });
  await touchProfile(ctx, userId);
  return id;
}

/** Removes a fact for good (#5): it disappears from the profile and isn't inferred again. */
export async function removeFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  factId: Id<"cityProfileFacts">,
) {
  const row = await ctx.db.get(factId);
  if (!row || row.userId !== userId) return false;
  if (row.removedAt === undefined) {
    const now = Date.now();
    await ctx.db.patch(factId, { removedAt: now, updatedAt: now });
  }
  return true;
}
