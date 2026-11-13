import { describe, expect, test } from "bun:test";
import {
  answeredCount,
  answerLabel,
  checkDealbreakers,
  compareBudget,
  compareLifestyles,
  comparePets,
  compareScale,
  compareWorkday,
  DEALBREAKER_RULES,
  DEALBREAKERS,
  type LifestyleAnswers,
  lifestyleAnswers,
  normalizeAnswers,
  QUESTION_COUNT,
  ROOMMATE_MATCH_FIELDS,
  SCALE_COPY,
  SCALE_FIELDS,
  SCALES,
  STEPS,
} from "../convex/lib/lifestyle";
import { roommateLifestyles } from "../convex/seed/world/roommateLifestyles";

const maya: LifestyleAnswers = {
  sleep: "regular",
  quietHours: "10pm",
  cleanliness: "tidy",
  noise: "some",
  guests: "monthly",
  smoking: "no",
  pets: [],
  dealbreakers: ["smoking_inside", "dogs"],
};
const tasha: LifestyleAnswers = {
  sleep: "regular",
  quietHours: "10pm",
  cleanliness: "very_tidy",
  noise: "quiet",
  guests: "often",
  smoking: "outside",
  pets: ["cat"],
  dealbreakers: ["smoking_any"],
};

describe("vocabulary", () => {
  test("every scale option has copy, and every field is in exactly one step", () => {
    for (const field of SCALE_FIELDS)
      expect(Object.keys(SCALE_COPY[field].options).sort()).toEqual([...SCALES[field]].sort());
    const stepped = STEPS.flatMap((s) => s.fields as readonly string[]);
    expect(new Set(stepped).size).toBe(stepped.length);
    expect(stepped.sort()).toEqual([...SCALE_FIELDS, "pets", "dealbreakers"].sort());
    expect(QUESTION_COUNT).toBe(stepped.length);
  });

  test("the allowlist is exactly the lifestyle scales, pets, budget and workday", () => {
    expect([...ROOMMATE_MATCH_FIELDS].sort()).toEqual(
      [...SCALE_FIELDS, "pets", "budget", "workday"].sort(),
    );
  });

  test("no field or option names a protected trait", () => {
    const words =
      /\b(age|gender|sex|male|female|pronoun|race|ethnic|nation|religio|church|pray|halal|kosher|disab|health|allerg|pregnan|kid|child|famil|married|partner|spouse|couple|student|retire|income|salary|language|veteran)/i;
    const fields = Object.keys(lifestyleAnswers.fields);
    const copy = JSON.stringify({ SCALE_COPY, DEALBREAKER_RULES, SCALES, DEALBREAKERS });
    for (const text of [...fields, copy]) expect(text).not.toMatch(words);
  });

  test("seed answers validate and use known usernames only once", () => {
    const names = roommateLifestyles.map((r) => r.username);
    expect(new Set(names).size).toBe(names.length);
    for (const r of roommateLifestyles) expect(normalizeAnswers(r.answers)).toEqual(r.answers);
  });
});

describe("answers", () => {
  test("normalize drops unknown fields and values and orders lists", () => {
    const messy = {
      sleep: "regular",
      quietHours: "3am",
      pets: ["dog", "cat", "dog"],
      dealbreakers: ["dogs", "smoking_inside", "dogs"],
      gender: "x",
    } as unknown as LifestyleAnswers;
    expect(normalizeAnswers(messy)).toEqual({
      sleep: "regular",
      pets: ["cat", "dog"],
      dealbreakers: ["smoking_inside", "dogs"],
    });
  });

  test("an empty pets or dealbreakers list counts as an answer (none), a missing one doesn't", () => {
    expect(answeredCount({})).toBe(0);
    expect(answeredCount({ pets: [] })).toBe(1);
    expect(answerLabel({ pets: [] }, "pets")).toBe("No pets");
    expect(answerLabel({}, "pets")).toBeNull();
    expect(answerLabel({ dealbreakers: [] }, "dealbreakers")).toBe("No dealbreakers");
    expect(answerLabel({ quietHours: "10pm" }, "quietHours")).toBe("10pm");
  });
});

describe("comparisons", () => {
  test("scale: same, close and different, with the answers it came from", () => {
    const same = compareScale("quietHours", "10pm", "10pm");
    expect(same).toMatchObject({
      outcome: "same",
      similarity: 1,
      sentence: "You both keep quiet hours after 10pm",
      a: { value: "10pm", label: "10pm" },
      b: { value: "10pm", label: "10pm" },
    });
    const close = compareScale("quietHours", "10pm", "11pm");
    expect(close.outcome).toBe("close");
    expect(close.similarity).toBe(0.75);
    expect(close.sentence).toBe("Close on quiet hours: 10pm and 11pm");
    const far = compareScale("cleanliness", "relaxed", "very_tidy");
    expect(far).toMatchObject({ outcome: "different", similarity: 0 });
  });

  test("scale similarity is symmetric", () => {
    for (const field of SCALE_FIELDS)
      for (const x of SCALES[field])
        for (const y of SCALES[field])
          expect(compareScale(field, x as never, y as never).similarity).toBe(
            compareScale(field, y as never, x as never).similarity,
          );
  });

  test("pets compare as sets", () => {
    expect(comparePets([], [])).toMatchObject({
      outcome: "same",
      similarity: 1,
      sentence: "Neither of you has pets",
    });
    expect(comparePets(["cat"], ["cat"]).sentence).toBe("You'd both bring a cat");
    expect(comparePets(["cat", "dog"], ["cat"])).toMatchObject({
      outcome: "close",
      similarity: 0.5,
    });
    expect(comparePets([], ["dog"])).toMatchObject({
      outcome: "different",
      sentence: "Different on pets: No pets and Dog",
    });
  });

  test("budget says only whether the ranges overlap, never the amounts", () => {
    const yes = compareBudget({ min: 1800, max: 2400 }, { max: 2000 });
    expect(yes).toMatchObject({
      outcome: "same",
      sentence: "Your budgets overlap",
      a: null,
      b: null,
    });
    const no = compareBudget({ min: 3000, max: 3500 }, { min: 1200, max: 2000 });
    expect(no.outcome).toBe("different");
    expect(JSON.stringify([yes, no])).not.toMatch(/\d{3,}/);
  });

  test("workday is a scale, and 'not working' is never compared", () => {
    expect(compareWorkday("remote", "remote").sentence).toBe("You both work from home");
    expect(compareWorkday("office", "remote").outcome).toBe("different");
    const r = compareLifestyles(
      { answers: {}, workplace: "none" },
      { answers: {}, workplace: "none" },
    );
    expect(r.traits).toEqual([]);
    expect(r.unanswered).toContain("workday");
  });

  test("dealbreakers check the other person's answer: conflict, clear or unknown", () => {
    const results = checkDealbreakers("a", maya, tasha);
    expect(results).toEqual([
      {
        holder: "a",
        dealbreaker: "smoking_inside",
        label: "Smoking or vaping inside",
        field: "smoking",
        status: "clear",
        answer: { value: "outside", label: "Only outside" },
      },
      {
        holder: "a",
        dealbreaker: "dogs",
        label: "Dogs",
        field: "pets",
        status: "clear",
        answer: { value: ["cat"], label: "Cat" },
      },
    ]);
    expect(checkDealbreakers("b", tasha, maya)[0].status).toBe("clear");
    expect(checkDealbreakers("b", tasha, { smoking: "outside" })[0].status).toBe("conflict");
    expect(checkDealbreakers("b", tasha, {})[0]).toMatchObject({ status: "unknown", answer: null });
  });

  test("every dealbreaker can conflict, clear, and be unknown", () => {
    for (const d of DEALBREAKERS) {
      const rule = DEALBREAKER_RULES[d];
      expect(rule.breaks({})).toBeNull();
      const options =
        rule.field === "pets"
          ? [[], ["cat"], ["dog"], ["other"]].map((pets) => ({ pets }) as LifestyleAnswers)
          : SCALES[rule.field].map((x) => ({ [rule.field]: x }) as LifestyleAnswers);
      const outcomes = new Set(options.map((o) => rule.breaks(o)));
      expect(outcomes).toEqual(new Set([true, false]));
    }
  });

  test("compareLifestyles covers both people and only allowlisted fields", () => {
    const sneaky = { ...maya, gender: "x", age: 30 } as unknown as LifestyleAnswers;
    const r = compareLifestyles(
      { answers: sneaky, budget: { min: 1800, max: 2400 }, workplace: "hybrid" },
      { answers: tasha, budget: { max: 2000 }, workplace: "remote" },
    );
    expect(r.traits.map((t) => t.field)).toEqual([
      "sleep",
      "quietHours",
      "cleanliness",
      "noise",
      "guests",
      "smoking",
      "pets",
      "budget",
      "workday",
    ]);
    for (const t of r.traits) expect(ROOMMATE_MATCH_FIELDS).toContain(t.field);
    expect(r.unanswered).toEqual(["groceries", "overnightGuests"]);
    expect(r.traits.filter((t) => t.outcome === "same").map((t) => t.sentence)).toEqual([
      "You both usually go to sleep between 10pm and midnight",
      "You both keep quiet hours after 10pm",
      "Your budgets overlap",
    ]);
    expect(r.dealbreakers.map((d) => [d.holder, d.dealbreaker, d.status])).toEqual([
      ["a", "smoking_inside", "clear"],
      ["a", "dogs", "clear"],
      ["b", "smoking_any", "clear"],
    ]);
  });

  test("invalid budgets are treated as unanswered", () => {
    const r = compareLifestyles(
      { answers: {}, budget: { min: 3000, max: 2000 } },
      { answers: {}, budget: { max: Number.NaN } },
    );
    expect(r.traits).toEqual([]);
    expect(r.unanswered).toContain("budget");
  });
});
