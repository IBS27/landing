import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Source } from "../validators";
import { recomputeInferred } from "./activity";
import { type CitedSource, resolveSources } from "./citations";
import {
  type Fact,
  forgetActivityEvidence,
  getProfile,
  getRemovedFacts,
  restoreFact,
} from "./cityProfile";
import { listDismissals } from "./dismissals";
import { type Audience, loadAudience } from "./posts";
import { activitySummary as reasonFor, type SignalKind } from "./profileSignals";
import { hasProtected } from "./protectedText";

/**
 * "What Muse knows about you" (#5): everything Landing holds about one person,
 * read and cleared only by that person. Every function takes the owner's id and
 * touches only their rows. City Profile facts are written through
 * `./cityProfile.ts`; signals are recorded by `./activity.ts` (#4) and only
 * deleted here.
 */

/** An Event, Group, post or listing as the owner may see it now, named safely. */
type TargetLink =
  | { kind: "event"; eventId: Id<"events">; title: string }
  | { kind: "group"; slug: string; name: string }
  | { kind: "post"; postId: Id<"posts">; username: string; label: string }
  | { kind: "listing"; listingId: Id<"listings">; title: string };

/** One Event, Group, post or listing behind an inferred fact, as the owner may see it now. */
export type EvidenceLink = { signal: SignalKind } & TargetLink;

/** The links behind an inferred fact, plus how many of its targets can't be shown. */
export type Evidence = { links: EvidenceLink[]; unavailable: number };

type Resolved = Evidence & {
  /** The owner's live signals behind the fact, for rebuilding its reason. */
  signals: Doc<"profileSignals">[];
  /** Event titles and Group names that may still appear in the reason. */
  names: Map<string, string>;
};

export type KnownFact = Fact & { evidenceLinks: Evidence | null };

function sourceOf(
  ctx: QueryCtx,
  s: Pick<Doc<"profileSignals">, "targetKind" | "targetId">,
): Source | null {
  switch (s.targetKind) {
    case "event": {
      const eventId = ctx.db.normalizeId("events", s.targetId);
      return eventId && { kind: "event", eventId };
    }
    case "group": {
      const groupId = ctx.db.normalizeId("groups", s.targetId);
      return groupId && { kind: "group", groupId };
    }
    case "post": {
      const postId = ctx.db.normalizeId("posts", s.targetId);
      return postId && { kind: "post", postId };
    }
    case "listing": {
      const listingId = ctx.db.normalizeId("listings", s.targetId);
      return listingId && { kind: "listing", listingId };
    }
  }
}

/** A name that names a protected trait ("Women Who Climb") is never shown; a generic label is. */
const safe = (name: string, generic: string) => (hasProtected(name) ? generic : name);

function toTarget(c: CitedSource): TargetLink | null {
  switch (c.kind) {
    case "event":
      return { kind: "event", eventId: c.eventId, title: safe(c.title, "An Event") };
    case "group":
      return { kind: "group", slug: c.slug, name: safe(c.name, "A Group") };
    case "post":
      return {
        kind: "post",
        postId: c.postId,
        username: c.author.username,
        label:
          c.group && !hasProtected(c.group.name)
            ? `A post in ${c.group.name}`
            : `${c.author.name}'s post`,
      };
    case "listing":
      return { kind: "listing", listingId: c.listingId, title: safe(c.title, "A listing") };
    default:
      return null;
  }
}

function toLink(c: CitedSource, signal: SignalKind): EvidenceLink | null {
  const t = toTarget(c);
  return t && { ...t, signal };
}

/**
 * The Events, Groups, posts and listings behind an inferred fact, from its
 * signal ids. Only the owner's own live signals count, one link per target in
 * evidence order (strongest first), and each target goes through
 * `resolveSources` with the owner's audience, so something that's since been
 * deleted, made private or blocked is counted, never shown.
 */
export async function evidenceLinks(
  ctx: QueryCtx,
  userId: Id<"users">,
  signalIds: readonly Id<"profileSignals">[],
  a: Audience,
): Promise<Resolved> {
  const links: EvidenceLink[] = [];
  const signals: Doc<"profileSignals">[] = [];
  const names = new Map<string, string>();
  const seen = new Set<string>();
  let unavailable = 0;
  for (const id of signalIds) {
    const s = await ctx.db.get(id);
    if (!s || s.userId !== userId || s.undoneAt !== undefined) continue;
    signals.push(s);
    if (seen.has(s.targetId)) continue;
    seen.add(s.targetId);
    const source = sourceOf(ctx, s);
    const [cited] = source ? await resolveSources(ctx, [source], a) : [];
    const link = cited && toLink(cited, s.kind);
    if (!link) {
      unavailable++;
      continue;
    }
    links.push(link);
    // Same rule as #4's reasons: Event titles and Group names, never a protected one.
    const name = cited.kind === "event" ? cited.title : cited.kind === "group" ? cited.name : null;
    if (name && !hasProtected(name)) names.set(s.targetId, name);
  }
  return { links, unavailable, signals, names };
}

/** Every fact with where it came from, and the facts the person removed. */
export async function knownFacts(ctx: QueryCtx, userId: Id<"users">) {
  const [profile, removed, a] = await Promise.all([
    getProfile(ctx, userId),
    getRemovedFacts(ctx, userId),
    loadAudience(ctx, userId),
  ]);
  const facts: KnownFact[] = [];
  for (const f of profile.facts) {
    const ids = f.source === "inferred" ? f.evidence.signalIds : undefined;
    if (!ids || (f.key !== "interest" && f.key !== "neighborhood")) {
      facts.push({ ...f, evidenceLinks: null });
      continue;
    }
    const { links, unavailable, signals, names } = await evidenceLinks(ctx, userId, ids, a);
    // The stored reason may name an Event or Group the owner can no longer see,
    // even one past the stored evidence ids. Rebuild it from the evidence as it
    // resolves now, so it describes the links shown and a hidden target is only counted.
    const evidence = { ...f.evidence, summary: reasonFor(f, signals, names) };
    facts.push({ ...f, evidence, evidenceLinks: { links, unavailable } });
  }
  return { briefCompletedAt: profile.briefCompletedAt, facts, removed };
}

/** Undo a removal (`restoreFact`); an inferred one is re-derived from current activity right away. */
export async function undoRemoval(
  ctx: MutationCtx,
  userId: Id<"users">,
  factId: Id<"cityProfileFacts">,
): Promise<boolean> {
  const source = await restoreFact(ctx, userId, factId);
  if (source === "inferred") await recomputeInferred(ctx, userId);
  return source !== null;
}

/* ---------------- Hidden cards (#100, #108) ---------------- */

/** A card the owner marked "Not for me", as they may see it now. */
export type HiddenCard = Exclude<TargetLink, { kind: "post" }> & { targetId: string; at: number };

/** Hidden cards listed at most; the rest are counted. */
export const HIDDEN_SHOWN = 50;

/**
 * The Event, Group and listing cards the owner hid, newest first. Each goes
 * through `resolveSources` with the owner's audience, like an inferred fact's
 * evidence: one that's since been deleted, made private or blocked is counted,
 * never shown.
 */
export async function hiddenCards(ctx: QueryCtx, userId: Id<"users">) {
  const [{ rows, more }, a] = await Promise.all([
    listDismissals(ctx, userId),
    loadAudience(ctx, userId),
  ]);
  const cards: HiddenCard[] = [];
  let unavailable = 0;
  for (const d of rows) {
    if (cards.length === HIDDEN_SHOWN) break;
    const source = sourceOf(ctx, d);
    const [cited] = source ? await resolveSources(ctx, [source], a) : [];
    const t = cited && toTarget(cited);
    if (!t || t.kind === "post") unavailable++;
    else cards.push({ ...t, targetId: d.targetId, at: d.at });
  }
  return {
    total: rows.length,
    /** More than `total` are hidden. */
    more,
    cards,
    unavailable,
    /** Older ones past `HIDDEN_SHOWN`, not listed. */
    older: rows.length - cards.length - unavailable,
  };
}

/* ---------------- Activity (#4) ---------------- */

export type ActivityCounts = Record<SignalKind, number>;

/**
 * What's recorded from someone's activity: live actions by kind, and every
 * stored row (undone ones included), which "Clear my activity" deletes.
 */
export async function activitySummary(ctx: QueryCtx, userId: Id<"users">) {
  const counts: ActivityCounts = { going: 0, interested: 0, join: 0, like: 0, save: 0, skip: 0 };
  let stored = 0;
  for await (const s of ctx.db
    .query("profileSignals")
    .withIndex("by_user", (q) => q.eq("userId", userId))) {
    stored++;
    if (s.undoneAt === undefined) counts[s.kind]++;
  }
  return { counts, stored };
}

/** Rows deleted per mutation; the rest continue in a scheduled one. */
export const DELETE_BATCH = 500;

/**
 * One batch of "Clear my activity": deletes the owner's signals and forgets the
 * inferred facts built from them (removals stay removed). Returns whether rows remain.
 */
export async function clearActivityBatch(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("profileSignals")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  for (const r of rows) await ctx.db.delete(r._id);
  // Every batch, so a recompute that ran between batches can't leave facts behind.
  await forgetActivityEvidence(ctx, userId);
  return rows.length === DELETE_BATCH;
}

/* ---------------- Muse runs (#8) ---------------- */

/** What each personal task did, in the owner's words. */
const TASK_LABELS: Record<string, string> = {
  "muse.profileFromText": "Read what you wrote about yourself",
  "muse.roomVibe": "Suggested a vibe for your room",
  "ember.rentalChatCheck": "Checked your rental chats for things to look at",
  "spark.negotiate": "Drafted Marketplace offers",
  "spark.subletReply": "Drafted replies to renters",
};

/** Runs read per summary; the count says "1,000+" past this. */
export const RUNS_SCAN = 1000;

/** Muse runs whose result was for this person, by task, newest first. */
export async function runsSummary(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("aiRuns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(RUNS_SCAN);
  const tasks = new Map<string, { task: string; label: string; count: number; lastAt: number }>();
  for (const r of rows) {
    const t = tasks.get(r.task);
    if (t) t.count++;
    else
      tasks.set(r.task, {
        task: r.task,
        label: TASK_LABELS[r.task] ?? "Other Muse tasks",
        count: 1,
        lastAt: r.createdAt,
      });
  }
  return { total: rows.length, more: rows.length === RUNS_SCAN, tasks: [...tasks.values()] };
}

/** One batch of deleting the owner's Muse runs. Returns whether rows remain. */
export async function deleteRunsBatch(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("aiRuns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  for (const r of rows) await ctx.db.delete(r._id);
  return rows.length === DELETE_BATCH;
}
