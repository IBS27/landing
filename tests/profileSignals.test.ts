import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { recomputeInferred, recordSignal, undoSignal } from "../convex/lib/activity";
import { getProfile, setLearnFromActivity } from "../convex/lib/cityProfile";
import {
  activitySummary,
  confidenceFor,
  HALF_LIFE_MS,
  inferFromSignals,
  isPositiveReaction,
  msUntilBelowThreshold,
  neighborhoodIn,
  type SignalLike,
  signalWeight,
} from "../convex/lib/profileSignals";
import { fakeCtx, type Row } from "./fakeDb";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const USER = "users:1" as Id<"users">;

let n = 0;
function sig(over: Partial<SignalLike>): SignalLike {
  return {
    _id: `s${++n}`,
    kind: "going",
    targetKind: "event",
    targetId: `t${n}`,
    interestIds: ["climbing"],
    at: NOW,
    ...over,
  };
}

describe("rules", () => {
  test("weights per action", () => {
    const w = (kind: SignalLike["kind"]) => signalWeight(sig({ kind }), NOW);
    expect([w("going"), w("join"), w("interested"), w("save"), w("like"), w("skip")]).toEqual([
      3, 2, 1, 1, 0.5, -2,
    ]);
  });

  test("weights halve every 60 days; undone signals count 0", () => {
    expect(signalWeight(sig({ at: NOW - HALF_LIFE_MS }), NOW)).toBeCloseTo(1.5);
    expect(signalWeight(sig({ at: NOW - 2 * HALF_LIFE_MS }), NOW)).toBeCloseTo(0.75);
    expect(signalWeight(sig({ undoneAt: NOW }), NOW)).toBe(0);
  });

  test("inferred at a score of 4 across two distinct targets", () => {
    const climbing = (signals: SignalLike[]) =>
      inferFromSignals(signals, NOW).interests.get("climbing");
    // One Event, even with a save and a like on it, is one target.
    expect(
      climbing([sig({ targetId: "e1" }), sig({ kind: "save", targetId: "e1" })]),
    ).toBeUndefined();
    // 3 + 0.5 = 3.5 across two targets: under the threshold.
    expect(climbing([sig({}), sig({ kind: "like", targetKind: "post" })])).toBeUndefined();
    // 3 + 1 = 4 across two targets.
    const inf = climbing([sig({}), sig({ kind: "save" })]);
    expect(inf?.score).toBe(4);
    expect(inf?.confidence).toBe(0.4);
    // Two old RSVPs decay under it.
    expect(climbing([sig({ at: NOW - 60 * DAY }), sig({ at: NOW - 60 * DAY })])).toBeUndefined();
  });

  test("skips count against, and skipped targets don't count as targets", () => {
    const two = [sig({}), sig({})];
    expect(
      inferFromSignals([...two, sig({ kind: "skip" }), sig({ kind: "skip" })], NOW).interests.has(
        "climbing",
      ),
    ).toBe(false);
    expect(
      inferFromSignals([...two, sig({ kind: "join", targetKind: "group" })], NOW).interests.has(
        "climbing",
      ),
    ).toBe(true);
    // 3 + 3 − 2 = 4, but only one RSVP'd target counts: the skipped one doesn't.
    const one = [sig({ targetId: "a" }), sig({ targetId: "a", kind: "interested" })];
    expect(inferFromSignals([...one, sig({}), sig({ kind: "skip" })], NOW).interests.size).toBe(1);
    expect(
      inferFromSignals(
        [
          sig({ targetId: "a" }),
          sig({ targetId: "a", kind: "join" }),
          sig({ kind: "skip", at: NOW - 365 * DAY }),
        ],
        NOW,
      ).interests.size,
    ).toBe(0);
  });

  test("a score decays under the threshold on the half-life clock", () => {
    expect(msUntilBelowThreshold(8)).toBe(HALF_LIFE_MS);
    expect(msUntilBelowThreshold(4)).toBe(0);
  });

  test("confidence maps from the score and never reaches stated", () => {
    expect(confidenceFor(4)).toBe(0.4);
    expect(confidenceFor(9)).toBeCloseTo(0.65);
    expect(confidenceFor(100)).toBe(0.9);
  });

  test("neighborhoods use the same rule", () => {
    const m = { neighborhoodSlug: "mission" as const };
    const r = inferFromSignals([sig(m), sig(m), sig({})], NOW);
    expect(r.neighborhoods.get("mission")?.score).toBe(6);
  });

  test("place strings map to neighborhoods by name; parks and other cities don't", () => {
    expect(neighborhoodIn("Valencia St & 18th St, Mission")).toBe("mission");
    expect(neighborhoodIn("Mission District, San Francisco")).toBe("mission");
    expect(neighborhoodIn("4th St & Brannan St, SoMa")).toBe("south-of-market");
    expect(neighborhoodIn("Haight St & Cole St, Haight-Ashbury")).toBe("haight-ashbury");
    expect(neighborhoodIn("Stow Lake Boathouse, Golden Gate Park")).toBeUndefined();
    expect(neighborhoodIn("Regent St & Parker St, Berkeley")).toBeUndefined();
    expect(neighborhoodIn(undefined)).toBeUndefined();
  });

  test("likes are the positive reactions", () => {
    expect(["like", "love", "care", "haha", "wow"].every(isPositiveReaction)).toBe(true);
    expect(isPositiveReaction("sad") || isPositiveReaction("angry")).toBe(false);
  });

  test("the reason names a few Events and Groups and counts the rest", () => {
    const names = new Map([
      ["g1", "Bay Area Climbers"],
      ["e1", "Climb Night"],
    ]);
    const subject = { key: "interest", value: { id: "climbing" } } as const;
    expect(
      activitySummary(
        subject,
        [
          sig({ targetId: "e1" }),
          sig({ targetId: "e2" }),
          sig({ targetId: "e3" }),
          sig({ kind: "join", targetKind: "group", targetId: "g1" }),
          sig({ kind: "like", targetKind: "post" }),
        ],
        names,
      ),
    ).toBe("RSVP'd to 3 climbing Events, joined Bay Area Climbers and liked 1 related post");
    expect(
      activitySummary(
        { key: "neighborhood", value: { slug: "mission" } },
        [sig({ targetId: "e1" }), sig({ targetId: "e2" })],
        new Map(),
      ),
    ).toBe("RSVP'd to 2 Events in Mission");
  });
});

/* ---------------- Hooks and recompute against a fake db ---------------- */

type Scheduled = { delay: number; args: Record<string, unknown> };

function world(extra: Record<string, Row[]> = {}) {
  const event = (id: string, title: string, category: string, address: string) => ({
    _id: id,
    title,
    category,
    address,
    online: false,
  });
  const tables: Record<string, Row[]> = {
    events: [
      event("events:1", "Bouldering Night", "Fitness", "Valencia St & 16th St, Mission"),
      event("events:2", "Climb & Coffee", "Fitness", "Mission St & 22nd St, Mission"),
      event("events:3", "Sunday Service", "Religions", "Valencia St & 18th St, Mission"),
      event("events:4", "Rock climbing support circle", "Health & Medical", "SoMa"),
    ],
    groups: [
      {
        _id: "groups:1",
        name: "Bay Area Climbers",
        category: "Sports",
        tags: ["Climbing"],
        location: "San Francisco Bay Area",
      },
      { _id: "groups:2", name: "Parents who climb", category: "Parenting", tags: ["Climbing"] },
    ],
    profileSignals: [],
    cityProfiles: [],
    cityProfileFacts: [],
    ...extra,
  };
  const base = fakeCtx(tables);
  const scheduled: Scheduled[] = [];
  const ctx = {
    db: {
      ...base.db,
      normalizeId: (table: string, id: string) => (id.startsWith(`${table}:`) ? id : null),
    },
    scheduler: {
      runAfter: async (delay: number, _fn: unknown, args: Record<string, unknown>) => {
        scheduled.push({ delay, args });
      },
    },
  } as unknown as MutationCtx;
  return { ctx, tables, scheduled };
}

const interestFacts = (tables: Record<string, Row[]>) =>
  tables.cityProfileFacts.filter((f) => f.key === "interest");

describe("hooks and recompute", () => {
  test("RSVPs are recorded, debounced, and infer an interest and neighborhood with a reason", async () => {
    const { ctx, tables, scheduled } = world();
    await recordSignal(ctx, USER, "going", "event", "events:1");
    await recordSignal(ctx, USER, "going", "event", "events:2");
    expect(tables.profileSignals).toHaveLength(2);
    expect(tables.profileSignals[0]).toMatchObject({
      interestIds: ["climbing"],
      neighborhoodSlug: "mission",
    });
    expect(scheduled.map((s) => s.delay)).toEqual([5000, 5000]);

    await recomputeInferred(ctx, USER);
    const profile = await getProfile(ctx, USER);
    const climbing = profile.interests.find((f) => f.value.id === "climbing");
    expect(climbing?.source).toBe("inferred");
    expect(climbing?.confidence).toBeCloseTo(0.5);
    expect(climbing?.evidence.kind).toBe("activity");
    // Strongest (newest) first.
    expect(climbing?.evidence.summary).toMatch(
      /^RSVP'd to (Bouldering Night and Climb & Coffee|Climb & Coffee and Bouldering Night)$/,
    );
    expect([...(climbing?.evidence.signalIds ?? [])].sort()).toEqual(
      tables.profileSignals.map((s) => s._id).sort() as never,
    );
    expect(profile.neighborhoods.map((f) => f.value.slug)).toEqual(["mission"]);
    // A follow-up recompute is due when the score (6) decays under 4, so it fades without new activity.
    const followUp = scheduled[scheduled.length - 1].delay;
    expect(followUp).toBeCloseTo(HALF_LIFE_MS * Math.log2(6 / 4) + 60_000, -4);
  });

  test("undo marks the signal undone, and the inferred fact is dropped below the threshold", async () => {
    const { ctx, tables } = world();
    await recordSignal(ctx, USER, "going", "event", "events:1");
    await recordSignal(ctx, USER, "going", "event", "events:2");
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toHaveLength(1);

    await undoSignal(ctx, USER, ["going", "interested"], "events:2");
    expect(tables.profileSignals).toHaveLength(2);
    expect(tables.profileSignals[1].undoneAt).toBeNumber();
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toHaveLength(0);
    expect(tables.cityProfileFacts).toHaveLength(0);

    // Redoing reuses the row and brings it back.
    await recordSignal(ctx, USER, "going", "event", "events:2");
    expect(tables.profileSignals).toHaveLength(2);
    expect(tables.profileSignals[1].undoneAt).toBeUndefined();
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toHaveLength(1);
  });

  test("never overrides a stated fact", async () => {
    const stated: Row = {
      _id: "cityProfileFacts:1",
      userId: USER,
      key: "interest",
      value: { id: "climbing" },
      source: "stated",
      evidence: { kind: "brief", summary: "You said so in your brief" },
      confidence: 1,
      updatedAt: 1,
    };
    const { ctx, tables } = world({ cityProfileFacts: [stated] });
    await recordSignal(ctx, USER, "going", "event", "events:1");
    await recordSignal(ctx, USER, "going", "event", "events:2");
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toEqual([stated]);
    // And a stated fact is never dropped when activity stops supporting it.
    await undoSignal(ctx, USER, ["going"], "events:1");
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toEqual([stated]);
  });

  test("never brings back a fact the person removed", async () => {
    const removed: Row = {
      _id: "cityProfileFacts:1",
      userId: USER,
      key: "interest",
      value: { id: "climbing" },
      source: "inferred",
      evidence: { kind: "activity", summary: "RSVP'd to 2 climbing Events" },
      confidence: 0.5,
      updatedAt: 1,
      removedAt: 2,
    };
    const { ctx, tables } = world({ cityProfileFacts: [removed] });
    await recordSignal(ctx, USER, "going", "event", "events:1");
    await recordSignal(ctx, USER, "going", "event", "events:2");
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toEqual([removed]);
    // Dropping leaves the tombstone too.
    await undoSignal(ctx, USER, ["going"], "events:1");
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toEqual([removed]);
  });

  test("excluded categories are never recorded, even when the title names an interest", async () => {
    const { ctx, tables, scheduled } = world();
    await recordSignal(ctx, USER, "going", "event", "events:3");
    await recordSignal(ctx, USER, "going", "event", "events:4");
    await recordSignal(ctx, USER, "join", "group", "groups:2");
    expect(tables.profileSignals).toEqual([]);
    expect(scheduled).toEqual([]);
  });

  test("unknown targets aren't recorded", async () => {
    const { ctx, tables } = world();
    await recordSignal(ctx, USER, "going", "event", "events:99");
    await recordSignal(ctx, USER, "save", "post", "nope");
    expect(tables.profileSignals).toEqual([]);
  });

  test("the switch stops recording and recomputing", async () => {
    const { ctx, tables, scheduled } = world();
    await setLearnFromActivity(ctx, USER, false);
    await recordSignal(ctx, USER, "going", "event", "events:1");
    await recordSignal(ctx, USER, "join", "group", "groups:1");
    expect(tables.profileSignals).toEqual([]);
    expect(scheduled).toEqual([]);

    tables.profileSignals.push(
      {
        _id: "profileSignals:a",
        userId: USER,
        kind: "going",
        targetKind: "event",
        targetId: "events:1",
        interestIds: ["climbing"],
        at: NOW,
        updatedAt: NOW,
      },
      {
        _id: "profileSignals:b",
        userId: USER,
        kind: "going",
        targetKind: "event",
        targetId: "events:2",
        interestIds: ["climbing"],
        at: NOW,
        updatedAt: NOW,
      },
    );
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toEqual([]);

    await setLearnFromActivity(ctx, USER, true);
    expect(tables.cityProfiles[0].learnFromActivity).toBeUndefined();
    await recomputeInferred(ctx, USER);
    expect(interestFacts(tables)).toHaveLength(1);
  });
});
