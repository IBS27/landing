import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import {
  getProfile,
  interestWeights,
  recordInferredFact,
  removeFact,
  saveStatedFacts,
} from "../convex/lib/cityProfile";
import {
  type FactEntry,
  isCalendarDate,
  moveInLabel,
  moveInProblem,
  valueKey,
} from "../convex/lib/cityProfileFacts";
import { profileFromText, profileInput } from "../convex/lib/profileFromText";
import { extractFacts } from "../convex/lib/profileText";
import { hasProtected, REDACTED, redactProtected } from "../convex/lib/protectedText";
import {
  applyProposals,
  type BriefForm,
  briefProblems,
  EMPTY_BRIEF,
  liveQuote,
  type Proposal,
  toSaveArgs,
} from "../src/landing/profile/briefState";
import { fakeCtx, type Row } from "./fakeDb";

const TODAY = "2026-11-12";
const facts = (text: string) => extractFacts(text, TODAY);
const labels = (text: string) => facts(text).map((p) => `${p.entry.key}:${p.label}`);
const entries = (text: string) => facts(text).map((p) => p.entry);

/** Muse's checks on a model answer for `text` (as the model would see it). */
function modelProblems(text: string, proposals: { entry: FactEntry; quote: string }[]) {
  const input = { text: redactProtected(text), today: TODAY };
  return profileFromText.check?.({ facts: proposals }, input) ?? [];
}

/* ---------------- 1. Protected traits ---------------- */

describe("protected traits", () => {
  const MUSLIM = "I'm a 30-year-old Muslim who loves hiking.";
  const HINDU = "I am Hindu.";

  test("are removed before the model sees the text", () => {
    const input = profileInput(MUSLIM, Date.UTC(2026, 10, 12, 20));
    expect(input.text).not.toMatch(/30|year|muslim|i'm a/i);
    expect(input.text).toContain("loves hiking");
    expect(input.today).toBe(TODAY);
    expect(profileInput(HINDU).text).not.toMatch(/hindu/i);
  });

  test("the rules keep only the activity wording as evidence", () => {
    const out = facts(MUSLIM);
    expect(out.map((p) => p.entry)).toEqual([{ key: "interest", value: { id: "hiking" } }]);
    expect(out[0].quote).toBe("loves hiking.");
    for (const p of out) expect(hasProtected(p.quote)).toBe(false);
  });

  test("an identity statement proposes nothing", () => {
    expect(facts(HINDU)).toEqual([]);
    expect(facts("As a gay Black woman and a mom, I want to meet people.")).toEqual([
      expect.objectContaining({ entry: { key: "goal", value: { id: "meet_people" } } }),
    ]);
  });

  test("the model check rejects quotes carrying a protected trait", () => {
    const hiking: FactEntry = { key: "interest", value: { id: "hiking" } };
    expect(modelProblems(MUSLIM, [{ entry: hiking, quote: MUSLIM }])).not.toEqual([]);
    expect(
      modelProblems(MUSLIM, [{ entry: hiking, quote: `${REDACTED} who loves hiking` }]),
    ).not.toEqual([]);
    expect(modelProblems(MUSLIM, [{ entry: hiking, quote: "loves hiking" }])).toEqual([]);
  });

  test("the model check rejects an interest backed only by who someone is", () => {
    const yoga: FactEntry = { key: "interest", value: { id: "yoga" } };
    expect(modelProblems(HINDU, [{ entry: yoga, quote: "I am Hindu" }])).not.toEqual([]);
    expect(modelProblems(HINDU, [{ entry: yoga, quote: REDACTED }])).not.toEqual([]);
    expect(modelProblems(HINDU, [{ entry: yoga, quote: "." }])).not.toEqual([]);
    expect(modelProblems("I do yoga on Sundays.", [{ entry: yoga, quote: "I do yoga" }])).toEqual(
      [],
    );
  });

  test("redaction keeps places, activities and plans", () => {
    expect(redactProtected("Moving to Russian Hill in March.")).toBe(
      "Moving to Russian Hill in March.",
    );
    expect(redactProtected("I'm 5 minutes from BART and $2k short.")).toBe(
      "I'm 5 minutes from BART and $2k short.",
    );
    expect(redactProtected("My wife and I bike everywhere.")).toBe(
      `${REDACTED} and I bike everywhere.`,
    );
    expect(labels("Moving to Russian Hill. I'm Russian and love chess.")).toEqual([
      "neighborhood:Russian Hill",
      "interest:Board games",
    ]);
  });

  test("the fallback reads the redacted text the model would have", () => {
    const out = profileFromText.fallback(profileInput(MUSLIM, Date.UTC(2026, 10, 12, 20)), []);
    expect(out.facts.map((f) => f.quote)).toEqual(["loves hiking."]);
  });
});

/* ---------------- 2. Budget ---------------- */

describe("budget", () => {
  const budget = (text: string) => entries(text).find((e) => e.key === "budget")?.value ?? null;

  test("plain dollar amounts", () => {
    expect(budget("My budget is $2400.")).toEqual({ max: 2400 });
    expect(budget("I can do $500.")).toEqual({ max: 500 });
    expect(budget("Rent up to $2,400 a month.")).toEqual({ max: 2400 });
    expect(budget("Rent is 2400 a month")).toEqual({ max: 2400 });
  });

  test("ranges", () => {
    expect(budget("Looking at 1800–2400 per month.")).toEqual({ min: 1800, max: 2400 });
    expect(budget("Budget $1,800 to $2,400.")).toEqual({ min: 1800, max: 2400 });
    expect(budget("Somewhere between $1,800 and $2,400.")).toEqual({ min: 1800, max: 2400 });
    expect(budget("Rent of 1.8–2.4k.")).toEqual({ min: 1800, max: 2400 });
  });

  test("thousands only with an explicit k", () => {
    expect(budget("Rent around $20.")).toBeNull();
    expect(budget("Budget $2k.")).toEqual({ max: 2000 });
    expect(budget("Budget is $2.4k a month.")).toEqual({ max: 2400 });
  });

  test("years and times aren't amounts", () => {
    expect(budget("Moving in March 2027 and I work 9 to 5.")).toBeNull();
    expect(budget("Moving in March 2027, budget $2400")).toEqual({ max: 2400 });
  });
});

/* ---------------- 3. Dates ---------------- */

describe("move-in dates", () => {
  const moveIn = (text: string) => entries(text).find((e) => e.key === "moveIn")?.value ?? null;

  test("one calendar check", () => {
    expect(isCalendarDate("2027-02-31")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2027-02-29")).toBe(false);
    expect(moveInProblem({ month: "2027-02", date: "2027-02-31" }, TODAY)).not.toBeNull();
    expect(moveInProblem({ month: "2027-02", date: "2027-02-28" }, TODAY)).toBeNull();
    expect(moveInProblem({ month: "2027-03", date: "2027-02-28" }, TODAY)).not.toBeNull();
    expect(moveInProblem({ month: "2027-13" }, TODAY)).not.toBeNull();
  });

  test("one past-date policy, with saved move-ins kept editable", () => {
    expect(moveInProblem({ month: "2026-10" }, TODAY)).not.toBeNull();
    expect(moveInProblem({ month: "2026-11" }, TODAY)).toBeNull();
    expect(moveInProblem({ month: "2026-11", date: "2026-11-03" }, TODAY)).not.toBeNull();
    expect(moveInProblem({ month: "2026-11", date: "2026-11-12" }, TODAY)).toBeNull();
    // Already saved before it passed: still fine; a different past one isn't.
    expect(moveInProblem({ month: "2026-10" }, TODAY, { month: "2026-10" })).toBeNull();
    expect(moveInProblem({ month: "2026-09" }, TODAY, { month: "2026-10" })).not.toBeNull();
  });

  test("extraction never proposes what the checks reject", () => {
    expect(moveIn("Moving February 31, 2027.")).toEqual({ month: "2027-02" });
    expect(moveIn("Moving in March 2026.")).toBeNull();
    expect(moveIn("Moving November 3.")).toEqual({ month: "2026-11" });
    expect(moveIn("Arriving March 14.")).toEqual({ month: "2027-03", date: "2027-03-14" });
    for (const text of ["Moving February 31, 2027.", "Moving November 3.", "Arriving in March."]) {
      const out = profileFromText.fallback({ text, today: TODAY }, []);
      expect(modelProblems(text, out.facts)).toEqual([]);
    }
  });

  test("the model check uses the same rules", () => {
    const at = (value: { month: string; date?: string }) => [
      { entry: { key: "moveIn" as const, value }, quote: "Moving" },
    ];
    expect(modelProblems("Moving soon", at({ month: "2027-02", date: "2027-02-31" }))).not.toEqual(
      [],
    );
    expect(modelProblems("Moving soon", at({ month: "2026-09" }))).not.toEqual([]);
    expect(modelProblems("Moving soon", at({ month: "2027-02", date: "2027-02-28" }))).toEqual([]);
  });

  test("the form uses the same rules", () => {
    const form: BriefForm = {
      ...EMPTY_BRIEF,
      budgetMax: "2400",
      transport: ["bike"],
      interests: ["climbing"],
    };
    expect(
      briefProblems({ ...form, moveInMonth: "2027-02", moveInDate: "2027-02-31" }, TODAY),
    ).toHaveLength(1);
    expect(briefProblems({ ...form, moveInMonth: "2026-08" }, TODAY)).toHaveLength(1);
    expect(briefProblems({ ...form, moveInMonth: "2027-02" }, TODAY)).toEqual([]);
  });

  test("labels show the real date", () => {
    expect(moveInLabel({ month: "2027-03", date: "2027-03-14" })).toBe("March 14, 2027");
  });
});

/* ---------------- 4. Stale evidence ---------------- */

describe("evidence after an edit", () => {
  const proposal = (entry: FactEntry, quote: string): Proposal => ({ entry, quote, label: "" });
  const base: BriefForm = {
    ...EMPTY_BRIEF,
    moveInMonth: "2027-03",
    transport: ["bike"],
    interests: ["climbing"],
  };

  test("a quote is dropped once the value it supported changes", () => {
    const form = applyProposals(base, [
      proposal({ key: "budget", value: { max: 2400 } }, "$2,400"),
    ]);
    expect(liveQuote(form, "budget")).toBe("$2,400");
    expect(toSaveArgs(form).fromText).toEqual([{ slot: "budget", quote: "$2,400" }]);

    const edited = { ...form, budgetMax: "3000" };
    expect(liveQuote(edited, "budget")).toBeNull();
    expect(toSaveArgs(edited).fromText).toBeUndefined();
    // Back to what they wrote: the quote backs it again.
    expect(liveQuote({ ...edited, budgetMax: "2,400" }, "budget")).toBe("$2,400");
  });

  test("every single-valued key works the same way", () => {
    const form = applyProposals(base, [
      proposal({ key: "moveIn", value: { month: "2027-04" } }, "April"),
      proposal({ key: "schedule", value: { workHours: "night", weekendsFree: true } }, "nights"),
      proposal({ key: "employer", value: { name: "Figma" } }, "at Figma"),
      proposal({ key: "transport", value: { modes: ["bart"] } }, "BART"),
    ]);
    expect(liveQuote(form, "moveIn")).toBe("April");
    expect(liveQuote({ ...form, moveInMonth: "2027-05" }, "moveIn")).toBeNull();
    expect(liveQuote({ ...form, weekendsFree: false }, "schedule")).toBeNull();
    expect(liveQuote({ ...form, employer: "Stripe" }, "employer")).toBeNull();
    expect(liveQuote(form, "transport")).toBe("BART");
    // Modes are a set: order doesn't matter, but adding one does.
    expect(liveQuote({ ...form, transport: [...form.transport].reverse() }, "transport")).toBe(
      "BART",
    );
    expect(liveQuote({ ...form, transport: [...form.transport, "walk"] }, "transport")).toBeNull();
  });

  test("a removed interest takes its quote with it", () => {
    const form = applyProposals(base, [
      proposal({ key: "interest", value: { id: "coffee" } }, "coffee"),
    ]);
    expect(toSaveArgs(form).fromText).toEqual([{ slot: "interest:coffee", quote: "coffee" }]);
    expect(toSaveArgs({ ...form, interests: ["climbing"] }).fromText).toBeUndefined();
  });

  test("valueKey ignores key order and undefined fields", () => {
    expect(valueKey({ max: 2400, min: undefined })).toBe(valueKey({ max: 2400 }));
    expect(valueKey({ a: 1, b: 2 })).toBe(valueKey({ b: 2, a: 1 }));
    expect(valueKey({ max: 2400 })).not.toBe(valueKey({ max: 3000 }));
  });
});

/* ---------------- 5. Neighborhoods ---------------- */

describe("neighborhoods", () => {
  const slugs = (text: string) =>
    entries(text).flatMap((e) => (e.key === "neighborhood" ? [e.value.slug] : []));

  test("longer, more specific names win and matches don't overlap", () => {
    expect(slugs("Moving to Outer Mission.")).toEqual(["outer-mission"]);
    expect(slugs("Looking at Mission Bay.")).toEqual(["mission-bay"]);
    expect(slugs("Looking at the Mission and Mission Bay.")).toEqual(["mission", "mission-bay"]);
    expect(slugs("Inner Sunset or the Outer Sunset.")).toEqual(["inner-sunset", "sunset-parkside"]);
    expect(slugs("Bernal Heights or Noe Valley")).toEqual(["bernal-heights", "noe-valley"]);
  });
});

/* ---------------- 6. Negations ---------------- */

describe("negations", () => {
  test("negated activities propose nothing", () => {
    expect(facts("I don't like climbing or coffee.")).toEqual([]);
    expect(labels("I don't like climbing, but I love hiking.")).toEqual(["interest:Hiking"]);
    expect(labels("Not into the Tenderloin, love Hayes Valley")).toEqual([]);
    expect(labels("I never drink coffee. I love climbing.")).toEqual(["interest:Climbing"]);
  });

  test("negation phrases that are the fact itself still count", () => {
    expect(labels("I don't have a car but I bike. I don't know anyone.")).toEqual([
      "transport:Bike, no car",
      "goal:Meet people",
    ]);
    expect(labels("I work nights and don't work weekends.")).toEqual([
      "schedule:Works nights · weekends free",
    ]);
  });

  test("the model check rejects a negated interest quote", () => {
    const text = "I don't like climbing or coffee.";
    const climbing: FactEntry = { key: "interest", value: { id: "climbing" } };
    expect(modelProblems(text, [{ entry: climbing, quote: "I don't like climbing" }])).not.toEqual(
      [],
    );
    expect(modelProblems(text, [{ entry: climbing, quote: "climbing" }])).not.toEqual([]);
    const mixed = "I don't like coffee, but I love climbing.";
    expect(modelProblems(mixed, [{ entry: climbing, quote: "climbing" }])).toEqual([]);
  });
});

/* ---------------- Stated vs inferred, tombstones ---------------- */

/** `fakeCtx` plus the writes the City Profile writers use. */
function writableCtx(tables: Record<string, Row[]>) {
  const ctx = fakeCtx(tables);
  let n = 0;
  const find = (id: string) => {
    for (const rows of Object.values(tables)) {
      const i = rows.findIndex((r) => r._id === id);
      if (i !== -1) return { rows, i };
    }
    throw new Error(`no row ${id}`);
  };
  const db = {
    ...ctx.db,
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((r) => r._id === id) ?? null,
    insert: async (table: string, doc: Record<string, unknown>) => {
      const _id = `${table}:${++n}`;
      tables[table] ??= [];
      tables[table].push({ ...doc, _id });
      return _id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const { rows, i } = find(id);
      const next: Row = { ...rows[i] };
      for (const [k, val] of Object.entries(patch)) {
        if (val === undefined) delete next[k];
        else next[k] = val;
      }
      rows[i] = next;
    },
    delete: async (id: string) => {
      const { rows, i } = find(id);
      rows.splice(i, 1);
    },
  };
  return { db } as unknown as MutationCtx;
}

describe("stated and inferred facts", () => {
  const USER = "users:maya" as Id<"users">;
  const activity = { kind: "activity" as const, summary: "RSVP'd to 3 climbing events" };
  const brief = { kind: "brief" as const, summary: "You said so in your brief" };
  const climbing: FactEntry = { key: "interest", value: { id: "climbing" } };
  const coffee: FactEntry = { key: "interest", value: { id: "coffee" } };
  const fresh = () => {
    const tables: Record<string, Row[]> = { cityProfiles: [], cityProfileFacts: [] };
    return { tables, ctx: writableCtx(tables) };
  };
  const factRows = (tables: Record<string, Row[]>) => tables.cityProfileFacts;

  test("inference never overrides what the person stated", async () => {
    const { tables, ctx } = fresh();
    await saveStatedFacts(
      ctx,
      USER,
      ["interest", "budget"],
      [
        { entry: climbing, evidence: brief },
        { entry: { key: "budget", value: { max: 2400 } }, evidence: brief },
      ],
    );
    expect(
      await recordInferredFact(ctx, USER, climbing, { confidence: 0.6, evidence: activity }),
    ).toBeNull();
    expect(
      await recordInferredFact(
        ctx,
        USER,
        { key: "budget", value: { max: 1500 } },
        {
          confidence: 0.6,
          evidence: activity,
        },
      ),
    ).toBeNull();
    const p = await getProfile(ctx, USER);
    expect(p.budget?.value).toEqual({ max: 2400 });
    expect(p.interests.map((f) => [f.value.id, f.source])).toEqual([["climbing", "stated"]]);
    expect(factRows(tables)).toHaveLength(2);
  });

  test("inferred facts insert, update in place and weigh by confidence", async () => {
    const { tables, ctx } = fresh();
    const id = await recordInferredFact(ctx, USER, coffee, { confidence: 0.5, evidence: activity });
    expect(id).not.toBeNull();
    expect(
      await recordInferredFact(ctx, USER, coffee, { confidence: 0.8, evidence: activity }),
    ).toBe(id);
    expect(factRows(tables)).toHaveLength(1);
    await saveStatedFacts(ctx, USER, ["interest"], [{ entry: climbing, evidence: brief }]);
    const p = await getProfile(ctx, USER);
    // Stated first; inferred facts the brief doesn't mention are left alone.
    expect(p.interests.map((f) => [f.value.id, f.source])).toEqual([
      ["climbing", "stated"],
      ["coffee", "inferred"],
    ]);
    expect(interestWeights(p)).toEqual(
      new Map([
        ["climbing", 1],
        ["coffee", 0.8],
      ]),
    );
  });

  test("stating an inferred fact makes it stated", async () => {
    const { ctx } = fresh();
    await recordInferredFact(ctx, USER, coffee, { confidence: 0.5, evidence: activity });
    await saveStatedFacts(ctx, USER, ["interest"], [{ entry: coffee, evidence: brief }]);
    const [f] = (await getProfile(ctx, USER)).interests;
    expect([f.source, f.confidence, f.evidence.kind]).toEqual(["stated", 1, "brief"]);
  });

  test("a fact dropped from the brief is tombstoned and never inferred back", async () => {
    const { tables, ctx } = fresh();
    await saveStatedFacts(
      ctx,
      USER,
      ["interest"],
      [
        { entry: climbing, evidence: brief },
        { entry: coffee, evidence: brief },
      ],
    );
    await saveStatedFacts(ctx, USER, ["interest"], [{ entry: climbing, evidence: brief }]);
    expect(
      factRows(tables).find((r) => (r.value as { id: string }).id === "coffee")?.removedAt,
    ).toBeNumber();
    expect(
      await recordInferredFact(ctx, USER, coffee, { confidence: 0.9, evidence: activity }),
    ).toBeNull();
    expect((await getProfile(ctx, USER)).interests.map((f) => f.value.id)).toEqual(["climbing"]);
    // Stating it again brings it back.
    await saveStatedFacts(
      ctx,
      USER,
      ["interest"],
      [
        { entry: climbing, evidence: brief },
        { entry: coffee, evidence: brief },
      ],
    );
    expect((await getProfile(ctx, USER)).interests.map((f) => f.value.id).sort()).toEqual([
      "climbing",
      "coffee",
    ]);
  });

  test("removeFact tombstones only the owner's fact", async () => {
    const { ctx } = fresh();
    const id = await recordInferredFact(ctx, USER, coffee, { confidence: 0.5, evidence: activity });
    if (!id) throw new Error("not inserted");
    expect(await removeFact(ctx, "users:other" as Id<"users">, id)).toBe(false);
    expect((await getProfile(ctx, USER)).interests).toHaveLength(1);
    expect(await removeFact(ctx, USER, id)).toBe(true);
    expect((await getProfile(ctx, USER)).interests).toEqual([]);
    expect(
      await recordInferredFact(ctx, USER, coffee, { confidence: 0.9, evidence: activity }),
    ).toBeNull();
  });

  test("a stored quote naming a protected trait is never read back", async () => {
    const { ctx } = fresh();
    await saveStatedFacts(
      ctx,
      USER,
      ["interest"],
      [
        {
          entry: { key: "interest", value: { id: "hiking" } },
          evidence: {
            kind: "free_text",
            summary: "From what you wrote",
            quote: "I'm a 30-year-old Muslim who loves hiking.",
          },
        },
      ],
    );
    const [f] = (await getProfile(ctx, USER)).interests;
    expect(f.evidence).toEqual({ kind: "free_text", summary: "From what you wrote" });
  });
});
