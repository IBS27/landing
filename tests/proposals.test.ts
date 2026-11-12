import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import { assertSameTarget, statesAmount } from "../convex/lib/proposals";
import type { ProposalPayload } from "../convex/validators";

describe("statesAmount", () => {
  test("finds the amount as whole dollars", () => {
    expect(statesAmount("Would you take $80 for it?", 80)).toBe(true);
    expect(statesAmount("Would you take $1,200?", 1200)).toBe(true);
    expect(statesAmount("Would you take $1200?", 1200)).toBe(true);
    expect(statesAmount("$80.", 80)).toBe(true);
  });

  test("rejects other figures that start the same way", () => {
    expect(statesAmount("Would you take $100?", 80)).toBe(false);
    expect(statesAmount("Would you take $800?", 80)).toBe(false);
    expect(statesAmount("Would you take $80.50?", 80)).toBe(false);
    expect(statesAmount("Would you take $1,200?", 1)).toBe(false);
    expect(statesAmount("Would you take 80?", 80)).toBe(false);
  });
});

describe("assertSameTarget", () => {
  const event = (groupId?: string): ProposalPayload => ({
    kind: "event",
    title: "Hike",
    description: "",
    startAt: 0,
    inviteIds: [],
    groupId: groupId as Id<"groups"> | undefined,
  });

  test("an edit can't move an Event to another Group", () => {
    expect(() => assertSameTarget(event("g1"), event("g2"))).toThrow();
    expect(() => assertSameTarget(event(), event("g1"))).toThrow();
    expect(() => assertSameTarget(event("g1"), event("g1"))).not.toThrow();
  });
});
