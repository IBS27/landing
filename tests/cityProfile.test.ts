import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import {
  briefFacts,
  getProfile,
  interestWeights,
  recordInferredFact,
  removeFact,
  saveStatedFacts,
} from "../convex/lib/cityProfile";
import {
  type FactEntry,
  factSlot,
  isCalendarDate,
  moveInLabel,
  moveInProblem,
  valueKey,
} from "../convex/lib/cityProfileFacts";
import { profileFromText, profileInput, tidyProposals } from "../convex/lib/profileFromText";
import { extractFacts, narrowQuote } from "../convex/lib/profileText";
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
const factSlotOf = (e: FactEntry) => factSlot(e);

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
    expect(out[0].quote).toBe("hiking");
    for (const p of out) expect(hasProtected(p.quote)).toBe(false);
  });

  test("disclosures are removed whatever country or condition they name", () => {
    const R = REDACTED;
    for (const [text, redacted, quote] of [
      ["I was born in Mexico and love hiking.", `${R} and love hiking.`, "hiking"],
      ["I have multiple sclerosis and like coffee.", `${R} and like coffee.`, "coffee"],
      ["I have lupus, love climbing", `${R}, love climbing`, "climbing"],
      ["My family is from Lagos and I love trivia.", `${R} and I love trivia.`, "trivia"],
      ["Originally from Oaxaca, I love surfing.", `${R}, I love surfing.`, "surfing"],
      ["I identify as nonbinary and love trivia.", `${R} and love trivia.`, "trivia"],
    ]) {
      expect(profileInput(text).text).toBe(redacted);
      const out = facts(text);
      expect(out.map((p) => p.quote)).toEqual([quote]);
      // The whole sentence is never an acceptable quote.
      expect(modelProblems(text, [{ entry: out[0].entry, quote: text }])).not.toEqual([]);
    }
  });

  test("contractions and full forms are both caught", () => {
    for (const text of [
      "I've got MS and love hiking.",
      "I have got MS and love hiking.",
      "I am single and love hiking.",
      "We are single and love hiking.",
    ]) {
      expect(profileInput(text).text).toBe(`${REDACTED} and love hiking.`);
      expect(facts(text).map((p) => p.quote)).toEqual(["hiking"]);
    }
  });

  test("race stated in the singular is caught through save and read", async () => {
    const text = "I am a person of color looking for roommates.";
    expect(profileInput(text).text).toBe(`${REDACTED} looking for roommates.`);
    const out = facts(text);
    expect(out.map((p) => [p.entry, p.quote])).toEqual([
      [{ key: "goal", value: { id: "find_roommates" } }, "looking for roommates"],
    ]);
    // Even a full-sentence quote from a tampered client never reaches the profile.
    const saved = briefFacts([out[0].entry], [{ slot: "goal:find_roommates", quote: text }]);
    const tables: Record<string, Row[]> = { cityProfiles: [], cityProfileFacts: [] };
    const ctx = writableCtx(tables);
    const user = "users:jordan" as Id<"users">;
    await saveStatedFacts(ctx, user, ["goal"], saved);
    const [goal] = (await getProfile(ctx, user)).goals;
    expect(hasProtected(goal.evidence.quote ?? "")).toBe(false);
    expect(redactProtected("We're a community of colour")).not.toMatch(/colou?r/);
  });

  test("a model quote is cut down to the fact's own words", () => {
    const hiking: FactEntry = { key: "interest", value: { id: "hiking" } };
    expect(narrowQuote(hiking, "I've got MS and love hiking.")).toBe("hiking");
    expect(
      tidyProposals([{ entry: hiking, quote: "I really like work and love hiking" }])[0].quote,
    ).toBe("hiking");
    // No words for the fact: the proposal is dropped.
    expect(tidyProposals([{ entry: hiking, quote: "I'm outdoorsy" }])).toEqual([]);
    const budget: FactEntry = { key: "budget", value: { min: 1800, max: 2400 } };
    expect(narrowQuote(budget, "I'm new here, budget $1,800 to $2,400")).toBe("$1,800 to $2,400");
    const moveIn: FactEntry = { key: "moveIn", value: { month: "2027-03" } };
    expect(narrowQuote(moveIn, "I love tacos and I'm moving in March")).toBe("March");
    const transport: FactEntry = { key: "transport", value: { modes: ["bike", "bart"] } };
    expect(narrowQuote(transport, "I don't have a car, I bike and take BART", true)).toBe(
      "don't have a car … bike … BART",
    );
  });

  test("saved evidence holds only the fact's words, whatever else the sentence says", () => {
    const roommates: FactEntry = { key: "goal", value: { id: "find_roommates" } };
    const bart: FactEntry = { key: "transport", value: { modes: ["bart"] } };
    for (const [entry, text, quote] of [
      [roommates, "I'm a single professional looking for roommates.", "looking for roommates"],
      [roommates, "25F looking for roommates.", "looking for roommates"],
      [roommates, "We're a couple looking for roommates.", "looking for roommates"],
      [bart, "I take BART to dialysis.", "BART"],
      [bart, "I'm partially sighted taking BART.", "BART"],
    ] as const) {
      const [fact] = briefFacts([entry], [{ slot: factSlotOf(entry), quote: text }]);
      expect(fact.evidence.quote).toBe(quote);
      expect(narrowQuote(entry, text)).toBe(quote);
      expect(hasProtected(text)).toBe(true);
    }
  });

  test("a protected quote never survives save and read", async () => {
    const hiking: FactEntry = { key: "interest", value: { id: "hiking" } };
    const coffee: FactEntry = { key: "interest", value: { id: "coffee" } };
    const facts = briefFacts(
      [hiking, coffee],
      [
        // A tampered or unredacted whole-sentence quote is narrowed to the activity.
        { slot: "interest:hiking", quote: "I've got MS and love hiking." },
        // Only the activity's own word is kept from this one.
        { slot: "interest:coffee", quote: "As a Muslim coffee lover" },
      ],
    );
    expect(facts.map((f) => f.evidence)).toEqual([
      { kind: "free_text", summary: "From what you wrote about yourself", quote: "hiking" },
      { kind: "free_text", summary: "From what you wrote about yourself", quote: "coffee" },
    ]);
    const tables: Record<string, Row[]> = { cityProfiles: [], cityProfileFacts: [] };
    const ctx = writableCtx(tables);
    const user = "users:priya" as Id<"users">;
    await saveStatedFacts(ctx, user, ["interest"], facts);
    for (const f of (await getProfile(ctx, user)).facts)
      expect(hasProtected(f.evidence.quote ?? "")).toBe(false);
  });

  test("everyday phrasings of protected traits are caught", () => {
    for (const text of [
      "I'm 30.",
      "I am thirty.",
      "I'm over 50.",
      "I'm on the spectrum.",
      "I'm expecting.",
      "We're newlyweds.",
      "I'm biracial.",
      "I'm a DACA recipient.",
      "I go to Mass on Sundays.",
      "I'm a person of color.",
      "I'm elderly.",
      "I take antidepressants.",
    ])
      expect(hasProtected(text)).toBe(true);
  });

  test("ordinary plans and belongings aren't disclosures", () => {
    for (const text of [
      "I have a car and two cats.",
      "I have always loved hiking.",
      "Moving from Chicago in March, budget $2k.",
      "Living in Chinatown, near Russian Hill.",
      "I am 5 minutes from BART and 2.5k short.",
      "We are 2 people looking for a place.",
      "I am a senior engineer at Stripe.",
    ])
      expect(redactProtected(text)).toBe(text);
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
    expect(out.facts.map((f) => f.quote)).toEqual(["hiking"]);
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

  test("negated amounts don't count, limits do", () => {
    expect(budget("My budget is not $3000; it is $2000.")).toEqual({ max: 2000 });
    expect(budget("Rent no more than $2,400 a month.")).toEqual({ max: 2400 });
    expect(budget("Rent not over $2,400.")).toEqual({ max: 2400 });
  });

  test("rent wins over other expenses", () => {
    expect(budget("I can spend $2400 on furniture. My rent budget is $1800.")).toEqual({
      max: 1800,
    });
    expect(budget("I'll spend $600 on a couch.")).toBeNull();
    expect(budget("$2,400 for a studio")).toEqual({ max: 2400 });
  });

  test("salary and other money aren't rent", () => {
    expect(budget("My salary is $6000 and rent is $2000.")).toEqual({ max: 2000 });
    expect(budget("I make $9000 a month, rent up to $2,500.")).toEqual({ max: 2500 });
    expect(budget("I saved $5000 for a deposit.")).toBeNull();
  });

  test("the model check rejects a negated amount", () => {
    const text = "My budget is not $3000; it is $2000.";
    const at = (max: number, quote: string) => [
      { entry: { key: "budget" as const, value: { max } }, quote },
    ];
    expect(modelProblems(text, at(3000, "not $3000"))).not.toEqual([]);
    expect(modelProblems(text, at(3000, "My budget is not $3000"))).not.toEqual([]);
    expect(modelProblems("Rent no more than $2,400.", at(2400, "no more than $2,400"))).toEqual([]);
    expect(modelProblems(text, at(3000, "$3000"))).not.toEqual([]);
    expect(modelProblems(text, at(2000, "$2000"))).toEqual([]);
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

  test("negated months don't count, limits do", () => {
    expect(moveIn("I do not want to move in March. I am moving in April.")).toEqual({
      month: "2027-04",
    });
    expect(moveIn("Not moving until March.")).toEqual({ month: "2027-03" });
    const text = "I do not want to move in March. I am moving in April.";
    const at = (month: string, quote: string) => [
      { entry: { key: "moveIn" as const, value: { month } }, quote },
    ];
    expect(modelProblems(text, at("2027-03", "move in March"))).not.toEqual([]);
    expect(modelProblems(text, at("2027-03", "I do not want to move in March"))).not.toEqual([]);
    expect(modelProblems(text, at("2027-04", "moving in April"))).toEqual([]);
  });

  test("the model check uses the same rules", () => {
    const at = (value: { month: string; date?: string }) => [
      { entry: { key: "moveIn" as const, value }, quote: "Feb" },
    ];
    const text = "Moving Feb 28";
    expect(modelProblems(text, at({ month: "2027-02", date: "2027-02-31" }))).not.toEqual([]);
    expect(modelProblems(text, at({ month: "2026-09" }))).not.toEqual([]);
    expect(modelProblems(text, at({ month: "2027-02" }))).toEqual([]);
    expect(
      modelProblems(text, [
        {
          entry: { key: "moveIn", value: { month: "2027-02", date: "2027-02-28" } },
          quote: "Feb 28",
        },
      ]),
    ).toEqual([]);
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
    // "BART" backs [bart], not [bike, bart] once merged into what was ticked.
    expect(liveQuote(form, "transport")).toBeNull();
    const fresh = applyProposals({ ...base, transport: [] }, [
      proposal({ key: "transport", value: { modes: ["bart", "bike"] } }, "BART"),
    ]);
    expect(liveQuote(form, "moveIn")).toBe("April");
    expect(liveQuote({ ...form, moveInMonth: "2027-05" }, "moveIn")).toBeNull();
    expect(liveQuote({ ...form, weekendsFree: false }, "schedule")).toBeNull();
    expect(liveQuote({ ...form, employer: "Stripe" }, "employer")).toBeNull();
    expect(liveQuote(fresh, "transport")).toBe("BART");
    // Modes are a set: order doesn't matter, but adding one does.
    expect(liveQuote({ ...fresh, transport: [...fresh.transport].reverse() }, "transport")).toBe(
      "BART",
    );
    expect(
      liveQuote({ ...fresh, transport: [...fresh.transport, "walk"] }, "transport"),
    ).toBeNull();
  });

  test("a new employer doesn't inherit the old work area or its evidence", () => {
    const old: BriefForm = { ...base, employer: "Figma", workArea: "SoMa" };
    const form = applyProposals(old, [
      proposal({ key: "employer", value: { name: "Google" } }, "I work at Google"),
    ]);
    expect([form.employer, form.workArea]).toEqual(["Google", ""]);
    expect(liveQuote(form, "employer")).toBe("I work at Google");
    expect(toSaveArgs(form).brief.employer).toEqual({ name: "Google" });
  });

  test("a merged schedule keeps the quote only if it's what was proposed", () => {
    const form = applyProposals({ ...base, workplace: "hybrid" }, [
      proposal({ key: "schedule", value: { workHours: "night", weekendsFree: true } }, "nights"),
    ]);
    expect(liveQuote(form, "schedule")).toBeNull();
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

  test("a workplace isn't a place to live", () => {
    const text = "I work in the Mission and want to live in the Outer Sunset.";
    expect(slugs(text)).toEqual(["sunset-parkside"]);
    expect(slugs("My office is in SoMa, looking at Noe Valley")).toEqual(["noe-valley"]);
    const mission: FactEntry = { key: "neighborhood", value: { slug: "mission" } };
    expect(modelProblems(text, [{ entry: mission, quote: "I work in the Mission" }])).not.toEqual(
      [],
    );
    const soma = "I work in the Mission and want to live in SoMa.";
    expect(modelProblems(soma, [{ entry: mission, quote: "the Mission" }])).not.toEqual([]);
    expect(modelProblems(soma, [{ entry: mission, quote: "Mission" }])).not.toEqual([]);
    const both = "I work in the Mission and want to live in the Mission too.";
    expect(modelProblems(both, [{ entry: mission, quote: "the Mission" }])).toEqual([]);
    expect(
      modelProblems("Moving to the Mission.", [{ entry: mission, quote: "Moving to the Mission" }]),
    ).toEqual([]);
  });
});

/* ---------------- 6. Negations ---------------- */

describe("negations", () => {
  test("negated activities propose nothing", () => {
    expect(facts("I don't like climbing or coffee.")).toEqual([]);
    expect(labels("I don't like climbing, but I love hiking.")).toEqual(["interest:Hiking"]);
    expect(labels("Not into the Tenderloin, love Hayes Valley")).toEqual([]);
    expect(labels("I never drink coffee. I love climbing.")).toEqual(["interest:Climbing"]);
    expect(facts("I do not like (climbing or coffee).")).toEqual([]);
    expect(facts("I cannot stand climbing.")).toEqual([]);
  });

  test("negation phrases that are the fact itself still count", () => {
    expect(labels("I don't have a car but I bike. I don't know anyone.")).toEqual([
      "transport:Bike, no car",
      "goal:Meet people",
    ]);
    expect(labels("I work nights and don't work weekends.")).toEqual([
      "schedule:Works nights · weekends free",
    ]);
    expect(labels("I work remote, not weekends.")).toEqual([
      "schedule:Works daytime · remote · weekends free",
    ]);
    expect(labels("I work remote and work weekends.")).toEqual([
      "schedule:Works daytime · remote · works some weekends",
    ]);
  });

  test("the model check rejects a negated interest quote", () => {
    const text = "I don't like climbing or coffee.";
    const climbing: FactEntry = { key: "interest", value: { id: "climbing" } };
    expect(modelProblems(text, [{ entry: climbing, quote: "I don't like climbing" }])).not.toEqual(
      [],
    );
    expect(modelProblems(text, [{ entry: climbing, quote: "climbing" }])).not.toEqual([]);
    for (const negated of ["I do not like (climbing or coffee).", "I cannot stand climbing."])
      expect(modelProblems(negated, [{ entry: climbing, quote: "climbing" }])).not.toEqual([]);
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

/* ---------------- Round 4: value-matched checks and common phrasings ---------------- */

describe("the model check reads the proposed value", () => {
  test("a negated amount or month is rejected even when the quote has both", () => {
    const budget = (max: number, quote: string) => [
      { entry: { key: "budget" as const, value: { max } }, quote },
    ];
    const text = "My budget is $2000, not $3000.";
    expect(modelProblems(text, budget(3000, text.slice(0, -1)))).not.toEqual([]);
    expect(modelProblems(text, budget(2000, "My budget is $2000"))).toEqual([]);
    // Narrowing keeps the proposed amount, not the first one.
    expect(narrowQuote({ key: "budget", value: { max: 2000 } }, text)).toBe("$2000");

    const moveIn = (month: string, quote: string) => [
      { entry: { key: "moveIn" as const, value: { month } }, quote },
    ];
    const when = "I will move in April, not March.";
    expect(modelProblems(when, moveIn("2027-03", when.slice(0, -1)))).not.toEqual([]);
    expect(modelProblems(when, moveIn("2027-04", "move in April"))).toEqual([]);
    expect(narrowQuote({ key: "moveIn", value: { month: "2027-04" } }, when)).toBe("April");
  });

  test("a quote without the fact's words is rejected", () => {
    const hiking: FactEntry = { key: "interest", value: { id: "hiking" } };
    expect(
      modelProblems("I love the outdoors.", [{ entry: hiking, quote: "the outdoors" }]),
    ).not.toEqual([]);
    const bike: FactEntry = { key: "transport", value: { modes: ["bike", "bart"] } };
    expect(modelProblems("I take BART.", [{ entry: bike, quote: "I take BART" }])).not.toEqual([]);
  });
});

describe("common phrasings", () => {
  const budget = (text: string) => entries(text).find((e) => e.key === "budget")?.value ?? null;
  const moveIn = (text: string) => entries(text).find((e) => e.key === "moveIn")?.value ?? null;
  const modes = (text: string) =>
    entries(text).flatMap((e) => (e.key === "transport" ? e.value.modes : []));
  const slugs = (text: string) =>
    entries(text).flatMap((e) => (e.key === "neighborhood" ? [e.value.slug] : []));
  const goals = (text: string) =>
    entries(text).flatMap((e) => (e.key === "goal" ? [e.value.id] : []));
  const schedule = (text: string) => entries(text).find((e) => e.key === "schedule")?.value ?? null;

  test("can't and cannot negate", () => {
    expect(budget("I can't afford $3000, but I can do $2000.")).toEqual({ max: 2000 });
    expect(moveIn("I can't move in March. I'm moving in April.")).toEqual({ month: "2027-04" });
    expect(modes("I can't bike. I take BART.")).toEqual(["bart"]);
    expect(modes("I cannot bike. I take BART.")).toEqual(["bart"]);
    expect(facts("I can't wait to try climbing!").map((p) => p.entry.key)).toEqual(["interest"]);
    expect(modes("I have no car and take BART.")).toEqual(["bart"]);
  });

  test("the rent they want beats other money", () => {
    expect(budget("My furniture budget is $500 and my rent budget is $2000.")).toEqual({
      max: 2000,
    });
    expect(budget("I can spend $800 a month on groceries. My rent budget is $2400.")).toEqual({
      max: 2400,
    });
    expect(budget("My current rent is $3000. My budget is $2000.")).toEqual({ max: 2000 });
    expect(budget("I currently pay $3000 in rent but my new budget is $2000.")).toEqual({
      max: 2000,
    });
    expect(budget("Rent is $2000 plus a $2000 deposit.")).toEqual({ max: 2000 });
    expect(budget("I can pay $2,200 a month.")).toEqual({ max: 2200 });
  });

  test("workplaces and past homes aren't places to live", () => {
    expect(slugs("I work at Google in SoMa and want to live in Noe Valley.")).toEqual([
      "noe-valley",
    ]);
    expect(slugs("My office will be in the Mission. I want to live in SoMa.")).toEqual([
      "south-of-market",
    ]);
    expect(slugs("I work in the Mission and SoMa. I want to live in Noe Valley.")).toEqual([
      "noe-valley",
    ]);
    expect(slugs("I used to live in the Mission but want to live in SoMa.")).toEqual([
      "south-of-market",
    ]);
    expect(slugs("I want to live near my office in SoMa.")).toEqual(["south-of-market"]);
    const mission: FactEntry = { key: "neighborhood", value: { slug: "mission" } };
    const text = "My office will be in the Mission. I want to live in SoMa.";
    expect(modelProblems(text, [{ entry: mission, quote: "the Mission" }])).not.toEqual([]);
  });

  test("the move date beats a job start", () => {
    expect(moveIn("I start work in March, but move in April.")).toEqual({ month: "2027-04" });
    expect(moveIn("My lease starts in March but I'm moving in April.")).toEqual({
      month: "2027-04",
    });
    expect(moveIn("Starting at Figma in March.")).toEqual({ month: "2027-03" });
  });

  test("having roommates isn't looking for them", () => {
    expect(goals("I already have roommates but need a new apartment.")).toEqual(["find_place"]);
    expect(goals("Looking for roommates in the Mission.")).toEqual(["find_roommates"]);
    expect(goals("I'm not looking for roommates.")).toEqual([]);
  });

  test("Saturday and Sunday shifts are weekend work", () => {
    expect(schedule("I work from home and work Saturdays and Sundays.")?.weekendsFree).toBe(false);
    expect(schedule("I work from home. I'm on call every weekend.")?.weekendsFree).toBe(false);
    expect(schedule("I work remote, never on Sundays.")?.weekendsFree).toBe(true);
  });
});
