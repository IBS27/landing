import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type FactEntry,
  type FactEvidence,
  type FactKey,
  type FactSource,
  factSlot,
  type SingleKey,
  valueKey,
} from "./cityProfileFacts";
import { getInterest, type InterestId } from "./interests";
import { narrowQuote } from "./profileText";
import { employerHasProtected, hasProtected } from "./protectedText";

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
  /**
   * The move-in features match and plan on (Crew, roommates, Journeys). One
   * kept in step with the person's place is their private record: it's in
   * `facts`, never here.
   */
  moveIn: Fact<"moveIn"> | null;
  transport: Fact<"transport"> | null;
  schedule: Fact<"schedule"> | null;
  employer: Fact<"employer"> | null;
  /** Where they live now, from their place on My Place. Never used for matching. */
  home: Fact<"home"> | null;
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

/** A typed value (an employer, a work area) that names a protected trait is never read back. */
function protectedValue(d: FactDoc): boolean {
  return (
    d.key === "employer" &&
    (employerHasProtected(d.value.name) || employerHasProtected(d.value.workArea ?? ""))
  );
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
    .filter((d) => d.removedAt === undefined && !protectedValue(d))
    .map(toFact)
    .sort(rank);
  return {
    userId,
    briefCompletedAt: row?.briefCompletedAt ?? null,
    budget: only(facts, "budget")[0] ?? null,
    moveIn: only(facts, "moveIn").find((f) => f.evidence.kind !== "place") ?? null,
    transport: only(facts, "transport")[0] ?? null,
    schedule: only(facts, "schedule")[0] ?? null,
    employer: only(facts, "employer")[0] ?? null,
    home: only(facts, "home")[0] ?? null,
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
 * The brief's entries as stated facts. `fromText` holds the quotes the person
 * confirmed from their own words ("Tell us about you"), by fact slot. Each is
 * cut down to the fact's own words ("hiking", "$2,400"), and one that can't be,
 * or still names a protected trait, isn't kept: that fact saves as a plain
 * brief answer.
 */
export function briefFacts(
  entries: FactEntry[],
  fromText: { slot: string; quote: string }[],
): StatedFact[] {
  const quotes = new Map(fromText.map((q) => [q.slot, q.quote]));
  return entries.map((entry) => {
    const raw = quotes.get(factSlot(entry));
    const quote = raw ? narrowQuote(entry, raw.slice(0, 400)).slice(0, 200) : "";
    const evidence: FactEvidence =
      quote && !hasProtected(quote)
        ? { kind: "free_text", summary: "From what you wrote about yourself", quote }
        : { kind: "brief", summary: "You said so in your brief" };
    return { entry, evidence };
  });
}

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

/**
 * Keeps one stated single-valued fact in step with something the person set
 * elsewhere in Landing (their place: `evidence.kind` "place"). That origin owns
 * the rows with its evidence kind; `entry: null` deletes them.
 * - Never overrides what the person stated another way (brief, their own
 *   words, a fact they confirmed): while one is live, this origin keeps no row.
 * - Keeps a removal (#5) while the value is unchanged. A new value is a new
 *   statement, so it shows again.
 * Returns the fact id, or null when there's no fact from this origin.
 */
export async function syncStatedFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: SingleKey,
  entry: Extract<FactEntry, { key: SingleKey }> | null,
  evidence: FactEvidence,
): Promise<Id<"cityProfileFacts"> | null> {
  if (entry && entry.key !== key) throw new Error(`Expected a ${key} fact`);
  const rows = await rowsFor(ctx, userId, key);
  const owned = rows.filter((r) => r.evidence.kind === evidence.kind);
  const statedElsewhere = rows.some(
    (r) => r.evidence.kind !== evidence.kind && r.source === "stated" && r.removedAt === undefined,
  );
  if (!entry || statedElsewhere) {
    for (const r of owned) await ctx.db.delete(r._id);
    return null;
  }
  const [row, ...extra] = owned;
  for (const r of extra) await ctx.db.delete(r._id);
  const now = Date.now();
  if (row) {
    if (row.removedAt !== undefined && sameValue(row.value, entry.value)) return null;
    const unchanged =
      row.removedAt === undefined &&
      row.source === "stated" &&
      sameValue(row.value, entry.value) &&
      sameValue(row.evidence, evidence);
    if (!unchanged)
      await ctx.db.patch(row._id, {
        value: entry.value,
        source: "stated",
        evidence,
        confidence: 1,
        updatedAt: now,
        removedAt: undefined,
      } as Partial<FactDoc>);
    return row._id;
  }
  const id = await ctx.db.insert("cityProfileFacts", {
    userId,
    ...entry,
    source: "stated",
    evidence,
    confidence: 1,
    updatedAt: now,
  });
  await touchProfile(ctx, userId);
  return id;
}

/**
 * Records what the person just told Landing (Home's chat, #150): it becomes
 * their stated fact for that slot.
 * - It replaces the value they stated before (the brief, their own words) and
 *   one that was inferred: their newest statement wins.
 * - It undoes a removal (#5): saying it again is a new statement. They can
 *   remove it again on "What Muse knows about you".
 * - A row kept in step with their place (`syncStatedFact`) isn't touched.
 * Returns false when the profile already says so (nothing is written).
 */
export async function restateFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  entry: FactEntry,
  evidence: FactEvidence,
): Promise<boolean> {
  const slot = factSlot(entry);
  const [row, ...extra] = (await rowsFor(ctx, userId, entry.key)).filter(
    (r) => factSlot(r) === slot && r.evidence.kind !== "place",
  );
  for (const r of extra) await ctx.db.delete(r._id);
  const now = Date.now();
  if (!row) {
    await ctx.db.insert("cityProfileFacts", {
      userId,
      ...entry,
      source: "stated",
      evidence,
      confidence: 1,
      updatedAt: now,
    });
    await touchProfile(ctx, userId);
    return true;
  }
  if (row.source === "stated" && row.removedAt === undefined && sameValue(row.value, entry.value))
    return false;
  await ctx.db.patch(row._id, {
    value: entry.value,
    source: "stated",
    evidence,
    confidence: 1,
    updatedAt: now,
    removedAt: undefined,
  } as Partial<FactDoc>);
  await touchProfile(ctx, userId);
  return true;
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

/**
 * Drops an inferred fact that activity no longer supports (#4). Stated facts and
 * removals stay: a removal is the person's choice, and it keeps the fact from
 * being inferred again.
 */
export async function dropInferredFact(ctx: MutationCtx, userId: Id<"users">, entry: FactEntry) {
  const slot = factSlot(entry);
  for (const row of await rowsFor(ctx, userId, entry.key))
    if (factSlot(row) === slot && row.source === "inferred" && row.removedAt === undefined)
      await ctx.db.delete(row._id);
}

/** Whether Landing learns from this person's activity (#4). On unless they turned it off. */
export async function learnsFromActivity(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const row = await ctx.db
    .query("cityProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.learnFromActivity !== false;
}

/** Turns learning from activity on or off (#4). */
export async function setLearnFromActivity(ctx: MutationCtx, userId: Id<"users">, on: boolean) {
  const row = await ctx.db
    .query("cityProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const learnFromActivity = on ? undefined : false;
  if (row) await ctx.db.patch(row._id, { learnFromActivity, updatedAt: Date.now() });
  else if (!on)
    await ctx.db.insert("cityProfiles", { userId, learnFromActivity, updatedAt: Date.now() });
}

/* ---------------- "What Muse knows about you" (#5) ---------------- */

/** A removed fact, kept so it's never inferred again; the person can undo it. */
export type RemovedFact = Fact & { removedAt: number };

/** The person's removed facts, newest first. Protected values never come back, even here. */
export async function getRemovedFacts(ctx: QueryCtx, userId: Id<"users">): Promise<RemovedFact[]> {
  const docs = await ctx.db
    .query("cityProfileFacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return docs
    .filter((d) => d.removedAt !== undefined && !protectedValue(d))
    .map((d) => ({ ...toFact(d), removedAt: d.removedAt as number }))
    .sort((a, b) => b.removedAt - a.removedAt);
}

/**
 * "Keep" on an inferred fact: it becomes something the person said, so activity
 * never changes or drops it. Returns false unless it's the owner's live fact.
 */
export async function confirmFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  factId: Id<"cityProfileFacts">,
): Promise<boolean> {
  const row = await ctx.db.get(factId);
  if (!row || row.userId !== userId || row.removedAt !== undefined || protectedValue(row))
    return false;
  if (row.source === "stated") return true;
  await ctx.db.patch(factId, {
    source: "stated",
    confidence: 1,
    evidence: { kind: "edit", summary: "You confirmed what Muse noticed" },
    updatedAt: Date.now(),
  });
  await touchProfile(ctx, userId);
  return true;
}

/**
 * Undoes a removal. A stated fact comes back as it was. An inferred one isn't
 * revived from old evidence: its tombstone is deleted so activity may infer it
 * again if it still holds. Returns the restored fact's source, or null unless
 * it's the owner's removed fact.
 */
export async function restoreFact(
  ctx: MutationCtx,
  userId: Id<"users">,
  factId: Id<"cityProfileFacts">,
): Promise<FactSource | null> {
  const row = await ctx.db.get(factId);
  if (!row || row.userId !== userId || row.removedAt === undefined) return null;
  const slot = factSlot(row);
  const live = (await rowsFor(ctx, userId, row.key)).some(
    (r) => r._id !== row._id && r.removedAt === undefined && factSlot(r) === slot,
  );
  if (row.source === "inferred" || live) await ctx.db.delete(row._id);
  else await ctx.db.patch(row._id, { removedAt: undefined, updatedAt: Date.now() });
  return row.source;
}

/** What a removed activity fact says once the activity behind it is cleared. */
export const CLEARED_ACTIVITY_SUMMARY = "From activity you cleared";

/**
 * After "Clear my activity" (#5): inferred facts from activity are deleted, and
 * removed ones keep their tombstone (so they still aren't inferred again) but
 * lose the signal ids and the reason that named Events and Groups.
 */
export async function forgetActivityEvidence(ctx: MutationCtx, userId: Id<"users">) {
  const docs = await ctx.db
    .query("cityProfileFacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const d of docs) {
    if (d.evidence.kind !== "activity") continue;
    if (d.removedAt === undefined) {
      if (d.source === "inferred") await ctx.db.delete(d._id);
    } else if (d.evidence.signalIds || d.evidence.summary !== CLEARED_ACTIVITY_SUMMARY) {
      await ctx.db.patch(d._id, {
        evidence: { kind: "activity", summary: CLEARED_ACTIVITY_SUMMARY },
      });
    }
  }
}
