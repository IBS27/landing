import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { recomputeInferred, recordSignal, undoSignal } from "../convex/lib/activity";
import {
  CLEARED_ACTIVITY_SUMMARY,
  confirmFact,
  getProfile,
  getRemovedFacts,
  removeFact,
  saveStatedFacts,
} from "../convex/lib/cityProfile";
import {
  activitySummary,
  clearActivityBatch,
  DELETE_BATCH,
  deleteRunsBatch,
  knownFacts,
  runsSummary,
  undoRemoval,
} from "../convex/lib/museKnows";
import { fakeCtx, type Row } from "./fakeDb";

const USER = "users:1" as Id<"users">;
const OTHER = "users:2" as Id<"users">;
const HOST = "users:9";

function world(extra: Record<string, Row[]> = {}) {
  const event = (id: string, title: string, privacy = "public") => ({
    _id: id,
    title,
    category: "Fitness",
    address: "Valencia St & 16th St, Mission",
    online: false,
    hostId: HOST,
    privacy,
    description: `${title} at the gym`,
    cover: "/seed/e.jpg",
    startAt: 1,
    externalGoingCount: 0,
  });
  const tables: Record<string, Row[]> = {
    users: [
      { _id: USER, name: "Ana", username: "ana" },
      { _id: OTHER, name: "Ben", username: "ben" },
      { _id: HOST, name: "Host", username: "host" },
    ],
    events: [
      event("events:1", "Bouldering Night"),
      event("events:2", "Climb & Coffee"),
      // Friends-only, and the viewer isn't the host's friend: hidden from them now.
      event("events:3", "Crag Trip", "friends"),
    ],
    groups: [],
    neighborhoods: [{ _id: "neighborhoods:1", slug: "mission", name: "Mission" }],
    profileSignals: [],
    cityProfiles: [],
    cityProfileFacts: [],
    aiRuns: [],
    ...extra,
  };
  const base = fakeCtx(tables);
  const ctx = {
    db: {
      ...base.db,
      normalizeId: (table: string, id: string) => (id.startsWith(`${table}:`) ? id : null),
    },
    scheduler: { runAfter: async () => {} },
  } as unknown as MutationCtx;
  return { ctx, tables };
}

/** RSVPs to two climbing Events, inferred into a climbing interest (and Mission). */
async function climber(ctx: MutationCtx, userId = USER) {
  await recordSignal(ctx, userId, "going", "event", "events:1");
  await recordSignal(ctx, userId, "going", "event", "events:2");
  await recomputeInferred(ctx, userId);
  const f = (await getProfile(ctx, userId)).interests.find((i) => i.value.id === "climbing");
  if (!f) throw new Error("climbing wasn't inferred");
  return f;
}

const climbing = async (ctx: MutationCtx) =>
  (await getProfile(ctx, USER)).interests.find((i) => i.value.id === "climbing");

describe("where each fact came from", () => {
  test("an inferred fact links the Events behind it, counting ones the viewer can't see now", async () => {
    const { ctx, tables } = world();
    await recordSignal(ctx, USER, "going", "event", "events:3");
    await climber(ctx);
    // Someone else's signal id in the evidence is never followed.
    await recordSignal(ctx, OTHER, "going", "event", "events:1");
    const fact = tables.cityProfileFacts.find((f) => f.key === "interest") as Row & {
      evidence: { signalIds: string[] };
    };
    const theirs = tables.profileSignals.find((s) => s.userId === OTHER)?._id as string;
    fact.evidence.signalIds.push(theirs);

    const { facts } = await knownFacts(ctx, USER);
    const f = facts.find((x) => x.key === "interest");
    expect(f?.evidenceLinks?.links.map((l) => l.kind === "event" && l.title).sort()).toEqual([
      "Bouldering Night",
      "Climb & Coffee",
    ]);
    expect(f?.evidenceLinks?.links.every((l) => l.signal === "going")).toBe(true);
    expect(f?.evidenceLinks?.unavailable).toBe(1);
  });

  test("stated facts carry their own evidence and no links", async () => {
    const { ctx } = world();
    await saveStatedFacts(
      ctx,
      USER,
      ["interest"],
      [
        {
          entry: { key: "interest", value: { id: "hiking" } },
          evidence: { kind: "free_text", summary: "From what you wrote", quote: "hiking" },
        },
      ],
    );
    const { facts } = await knownFacts(ctx, USER);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ source: "stated", evidenceLinks: null });
    expect(facts[0].evidence.quote).toBe("hiking");
  });
});

describe("keep, remove and undo", () => {
  test("Keep makes an inferred fact stated, and activity no longer drops it", async () => {
    const { ctx } = world();
    const f = await climber(ctx);
    expect(await confirmFact(ctx, USER, f._id)).toBe(true);
    expect(await climbing(ctx)).toMatchObject({
      source: "stated",
      confidence: 1,
      evidence: { kind: "edit" },
    });
    await undoSignal(ctx, USER, ["going"], "events:1");
    await undoSignal(ctx, USER, ["going"], "events:2");
    await recomputeInferred(ctx, USER);
    expect((await climbing(ctx))?.source).toBe("stated");
  });

  test("a removed fact is never inferred again from the same or new signals", async () => {
    const { ctx } = world();
    const f = await climber(ctx);
    expect(await removeFact(ctx, USER, f._id)).toBe(true);
    expect(await climbing(ctx)).toBeUndefined();

    await recomputeInferred(ctx, USER);
    await recordSignal(ctx, USER, "going", "event", "events:3");
    await recomputeInferred(ctx, USER);
    expect(await climbing(ctx)).toBeUndefined();
    const { removed } = await knownFacts(ctx, USER);
    expect(removed.map((r) => r._id)).toEqual([f._id]);
  });

  test("undoing an inferred removal re-derives it from current activity", async () => {
    const { ctx, tables } = world();
    const f = await climber(ctx);
    await removeFact(ctx, USER, f._id);
    expect(await undoRemoval(ctx, USER, f._id)).toBe(true);
    expect(tables.cityProfileFacts.some((r) => r._id === f._id)).toBe(false);
    expect((await climbing(ctx))?.source).toBe("inferred");
    expect(await getRemovedFacts(ctx, USER)).toEqual([]);
  });

  test("undoing a stated removal brings it back as stated", async () => {
    const { ctx } = world();
    await saveStatedFacts(
      ctx,
      USER,
      ["budget"],
      [
        {
          entry: { key: "budget", value: { max: 2400 } },
          evidence: { kind: "brief", summary: "You said so in your brief" },
        },
      ],
    );
    const budget = (await getProfile(ctx, USER)).budget;
    if (!budget) throw new Error("no budget");
    await removeFact(ctx, USER, budget._id);
    expect((await getProfile(ctx, USER)).budget).toBeNull();
    await undoRemoval(ctx, USER, budget._id);
    expect((await getProfile(ctx, USER)).budget).toMatchObject({
      source: "stated",
      value: { max: 2400 },
    });
  });

  test("only the owner can keep, remove or undo a fact", async () => {
    const { ctx } = world();
    const f = await climber(ctx);
    expect(await confirmFact(ctx, OTHER, f._id)).toBe(false);
    expect(await removeFact(ctx, OTHER, f._id)).toBe(false);
    expect((await climbing(ctx))?.source).toBe("inferred");
    await removeFact(ctx, USER, f._id);
    expect(await undoRemoval(ctx, OTHER, f._id)).toBe(false);
    expect(await climbing(ctx)).toBeUndefined();
    expect((await knownFacts(ctx, OTHER)).removed).toEqual([]);
  });
});

describe("activity", () => {
  test("counts live actions by kind and every stored row", async () => {
    const { ctx } = world();
    await climber(ctx);
    await recordSignal(ctx, USER, "interested", "event", "events:3");
    await undoSignal(ctx, USER, ["interested"], "events:3");
    const s = await activitySummary(ctx, USER);
    expect(s.counts).toMatchObject({ going: 2, interested: 0 });
    expect(s.stored).toBe(3);
    expect((await activitySummary(ctx, OTHER)).stored).toBe(0);
  });

  test("Clear my activity deletes only the owner's signals and inferred facts, and removals stay", async () => {
    const { ctx, tables } = world();
    const f = await climber(ctx);
    await climber(ctx, OTHER);
    await removeFact(ctx, USER, f._id);
    await saveStatedFacts(
      ctx,
      USER,
      ["goal"],
      [
        {
          entry: { key: "goal", value: { id: "meet_people" } },
          evidence: { kind: "brief", summary: "You said so in your brief" },
        },
      ],
    );

    expect(await clearActivityBatch(ctx, USER)).toBe(false);
    expect(tables.profileSignals.every((s) => s.userId === OTHER)).toBe(true);
    const mine = await getProfile(ctx, USER);
    // The inferred neighborhood is gone; the stated goal stays.
    expect(mine.facts.map((x) => x.key)).toEqual(["goal"]);
    const [tomb] = await getRemovedFacts(ctx, USER);
    expect(tomb.evidence).toEqual({ kind: "activity", summary: CLEARED_ACTIVITY_SUMMARY });
    // Still never re-inferred.
    await climber(ctx).catch(() => null);
    expect(await climbing(ctx)).toBeUndefined();
    // The other person's profile is untouched.
    expect((await getProfile(ctx, OTHER)).interests).toHaveLength(1);
  });

  test("clears in batches", async () => {
    const rows = Array.from({ length: DELETE_BATCH + 1 }, (_, i) => ({
      _id: `profileSignals:${i}`,
      userId: USER,
      kind: "like",
      targetKind: "post",
      targetId: `posts:${i}`,
      interestIds: ["climbing"],
      at: 1,
      updatedAt: 1,
    }));
    const { ctx, tables } = world({ profileSignals: rows });
    expect(await clearActivityBatch(ctx, USER)).toBe(true);
    expect(await clearActivityBatch(ctx, USER)).toBe(false);
    expect(tables.profileSignals).toEqual([]);
  });
});

describe("Muse runs", () => {
  const run = (id: number, userId: string | undefined, task: string, createdAt: number) => ({
    _id: `aiRuns:${id}`,
    agent: "muse",
    task,
    inputHash: `h${id}`,
    outcome: "model",
    output: "{}",
    cited: [],
    attempts: 1,
    latencyMs: 1,
    createdAt,
    ...(userId ? { userId } : {}),
  });

  test("summarizes and deletes only the owner's runs", async () => {
    const { ctx, tables } = world({
      aiRuns: [
        run(1, USER, "muse.profileFromText", 10),
        run(2, USER, "muse.profileFromText", 20),
        run(3, USER, "muse.roomVibe", 15),
        run(4, OTHER, "muse.roomVibe", 30),
        run(5, undefined, "ember.weekendRoute.mentions", 40),
      ],
    });
    const s = await runsSummary(ctx, USER);
    expect(s.total).toBe(3);
    expect(s.tasks).toEqual([
      {
        task: "muse.profileFromText",
        label: "Read what you wrote about yourself",
        count: 2,
        lastAt: 20,
      },
      { task: "muse.roomVibe", label: "Suggested a vibe for your room", count: 1, lastAt: 15 },
    ]);
    expect(await deleteRunsBatch(ctx, USER)).toBe(false);
    expect(tables.aiRuns.map((r) => r._id)).toEqual(["aiRuns:4", "aiRuns:5"]);
  });
});
