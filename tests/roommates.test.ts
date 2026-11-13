import { describe, expect, test } from "bun:test";
import { getProfile } from "../convex/lib/cityProfile";
import {
  COMPARE_MAX,
  comparableLifestyles,
  deleteLifestyle,
  getOwnLifestyle,
  matchProfileInputs,
  saveLifestyleAnswers,
  setLifestyleSharing,
} from "../convex/lib/roommates";
import { fakeCtx, type Row } from "./fakeDb";

const id = (s: string) => s as never;

const row = (
  userId: string,
  shared: boolean,
  answers: Row["answers"] = { sleep: "early" },
): Row => ({
  _id: `rl_${userId}`,
  userId,
  answers,
  shared,
  sharedAt: shared ? 1 : undefined,
  updatedAt: 1,
});

function world(rows: Row[], blocks: Row[] = []) {
  const tables: Record<string, Row[]> = { roommateLifestyles: rows, blocks };
  return { tables, ctx: fakeCtx(tables) };
}

describe("own answers", () => {
  test("the first save creates a private row; saving nothing creates nothing", async () => {
    const { tables, ctx } = world([]);
    expect(await saveLifestyleAnswers(ctx, id("V"), {}, 5)).toBeNull();
    expect(tables.roommateLifestyles).toEqual([]);
    await saveLifestyleAnswers(ctx, id("V"), { sleep: "late", pets: ["dog", "cat"] }, 5);
    expect(tables.roommateLifestyles).toEqual([
      {
        _id: expect.any(String),
        userId: "V",
        answers: { sleep: "late", pets: ["cat", "dog"] },
        shared: false,
        updatedAt: 5,
      },
    ]);
  });

  test("saving replaces the answers and keeps the sharing choice", async () => {
    const { ctx } = world([row("V", true)]);
    await saveLifestyleAnswers(ctx, id("V"), { quietHours: "10pm" }, 9);
    const r = await getOwnLifestyle(ctx, id("V"));
    expect(r).toMatchObject({ answers: { quietHours: "10pm" }, shared: true, updatedAt: 9 });
  });

  test("clearing every answer stops sharing", async () => {
    const { ctx } = world([row("V", true)]);
    await saveLifestyleAnswers(ctx, id("V"), {}, 9);
    const r = await getOwnLifestyle(ctx, id("V"));
    expect(r?.shared).toBe(false);
    expect(r?.sharedAt).toBeUndefined();
  });

  test("sharing needs at least one answer, and can be turned off", async () => {
    const empty = world([]);
    await expect(setLifestyleSharing(empty.ctx, id("V"), true, 1)).rejects.toThrow(
      "Answer at least one question",
    );
    await setLifestyleSharing(empty.ctx, id("V"), false, 1); // no row: nothing to turn off
    expect(empty.tables.roommateLifestyles).toEqual([]);

    const { ctx } = world([row("V", false)]);
    await setLifestyleSharing(ctx, id("V"), true, 7);
    expect(await getOwnLifestyle(ctx, id("V"))).toMatchObject({ shared: true, sharedAt: 7 });
    await setLifestyleSharing(ctx, id("V"), false, 8);
    const off = await getOwnLifestyle(ctx, id("V"));
    expect(off?.shared).toBe(false);
    expect(off?.sharedAt).toBeUndefined();
  });

  test("delete removes everything", async () => {
    const { tables, ctx } = world([row("V", true), row("O", true)]);
    await deleteLifestyle(ctx, id("V"));
    expect(tables.roommateLifestyles.map((r) => r.userId)).toEqual(["O"]);
    await deleteLifestyle(ctx, id("V")); // idempotent
  });
});

describe("comparableLifestyles", () => {
  const block = (a: string, b: string): Row => ({
    _id: `bl_${a}_${b}`,
    userId: a,
    blockedId: b,
    createdAt: 0,
  });

  test("null unless the viewer shares", async () => {
    const { ctx } = world([row("V", false), row("A", true)]);
    expect(await comparableLifestyles(ctx, id("V"), [id("A")])).toBeNull();
    const none = world([row("A", true)]);
    expect(await comparableLifestyles(none.ctx, id("V"), [id("A")])).toBeNull();
  });

  test("only candidates who share, aren't blocked either way, and aren't the viewer", async () => {
    const { ctx } = world(
      [
        row("V", true),
        row("A", true, { quietHours: "10pm", pets: ["dog", "cat"] }),
        row("Private", false),
        row("Bk", true),
        row("Bkr", true),
        row("Empty", true, {}),
      ],
      [block("V", "Bk"), block("Bkr", "V")],
    );
    const r = await comparableLifestyles(ctx, id("V"), [
      id("V"),
      id("Private"),
      id("A"),
      id("Bk"),
      id("Bkr"),
      id("Empty"),
      id("Nobody"),
      id("A"),
    ]);
    const none = { budget: null, workplace: null };
    expect(r?.mine).toEqual({ answers: { sleep: "early" }, ...none });
    expect([...(r?.others.entries() ?? [])]).toEqual([
      ["A", { answers: { quietHours: "10pm", pets: ["cat", "dog"] }, ...none }],
    ]);
  });

  test("checks at most COMPARE_MAX candidates", async () => {
    const many = Array.from({ length: COMPARE_MAX + 5 }, (_, i) => row(`C${i}`, true));
    const { ctx } = world([row("V", true), ...many]);
    const r = await comparableLifestyles(
      ctx,
      id("V"),
      many.map((m) => id(m.userId as string)),
    );
    expect(r?.others.size).toBe(COMPARE_MAX);
  });
});

describe("City Profile inputs", () => {
  const fact = (
    userId: string,
    key: string,
    value: unknown,
    source: "stated" | "inferred",
  ): Row => ({
    _id: `f_${userId}_${key}_${source}`,
    userId,
    key,
    value,
    source,
    evidence: { kind: source === "stated" ? "brief" : "activity", summary: "x" },
    confidence: source === "stated" ? 1 : 0.6,
    updatedAt: 1,
  });

  test("only stated budget and workday count; 'not working' is never compared", async () => {
    const tables: Record<string, Row[]> = {
      cityProfiles: [],
      cityProfileFacts: [
        fact("S", "budget", { min: 1800, max: 2400 }, "stated"),
        fact(
          "S",
          "schedule",
          { workHours: "day", workplace: "hybrid", weekendsFree: true },
          "stated",
        ),
        fact("I", "budget", { max: 2000 }, "inferred"),
        fact(
          "I",
          "schedule",
          { workHours: "day", workplace: "remote", weekendsFree: true },
          "inferred",
        ),
        fact(
          "N",
          "schedule",
          { workHours: "day", workplace: "none", weekendsFree: true },
          "stated",
        ),
      ],
    };
    const ctx = fakeCtx(tables);
    expect(matchProfileInputs(await getProfile(ctx, id("S")))).toEqual({
      budget: { min: 1800, max: 2400 },
      workday: "hybrid",
    });
    const nothing = { budget: null, workday: null };
    expect(matchProfileInputs(await getProfile(ctx, id("I")))).toEqual(nothing);
    expect(matchProfileInputs(await getProfile(ctx, id("N")))).toEqual(nothing);
  });

  test("comparableLifestyles carries each side's stated profile values", async () => {
    const tables: Record<string, Row[]> = {
      roommateLifestyles: [row("V", true), row("A", true)],
      blocks: [],
      cityProfiles: [],
      cityProfileFacts: [fact("A", "budget", { max: 2000 }, "stated")],
    };
    const r = await comparableLifestyles(fakeCtx(tables), id("V"), [id("A")]);
    expect(r?.others.get(id("A"))).toEqual({
      answers: { sleep: "early" },
      budget: { max: 2000 },
      workplace: null,
    });
  });
});
