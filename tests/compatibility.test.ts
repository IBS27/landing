import { describe, expect, test } from "bun:test";
import {
  COMPATIBILITY_WEIGHTS,
  compatibility,
  DEALBREAKER_CAP,
  MIN_COMPARED,
  scoreLabel,
} from "../convex/lib/compatibility";
import {
  type LifestyleAnswers,
  ROOMMATE_MATCH_FIELDS,
  type RoommateInputs,
} from "../convex/lib/lifestyle";
import { cityProfileSeeds } from "../convex/seed/world/cityProfiles";
import { roommateLifestyles } from "../convex/seed/world/roommateLifestyles";

const me = (answers: LifestyleAnswers, extra: Partial<RoommateInputs> = {}): RoommateInputs => ({
  answers,
  ...extra,
});

const base: LifestyleAnswers = {
  sleep: "regular",
  quietHours: "10pm",
  cleanliness: "tidy",
  noise: "some",
  smoking: "no",
};

describe("allowlist", () => {
  test("weights cover exactly the matching allowlist", () => {
    expect(Object.keys(COMPATIBILITY_WEIGHTS).sort()).toEqual([...ROOMMATE_MATCH_FIELDS].sort());
    for (const w of Object.values(COMPATIBILITY_WEIGHTS)) expect(w).toBeGreaterThan(0);
  });

  test("anything outside the allowlist never changes the result", () => {
    const plain = compatibility(me(base), me({ ...base, noise: "quiet" }));
    const noisy = compatibility(
      {
        answers: { ...base, gender: "f", religion: "x" } as unknown as LifestyleAnswers,
        age: 31,
        neighborhoods: ["mission"],
      } as unknown as RoommateInputs,
      {
        answers: { ...base, noise: "quiet", gender: "m" } as unknown as LifestyleAnswers,
        age: 52,
        ethnicity: "y",
      } as unknown as RoommateInputs,
    );
    expect(noisy).toEqual(plain);
    expect(JSON.stringify(noisy)).not.toMatch(/gender|religion|ethnicity|age|mission/);
  });
});

describe("score", () => {
  test("identical answers score 100 and every field is a shared trait", () => {
    const c = compatibility(me(base), me(base));
    expect(c.score).toBe(100);
    expect(c.shared.map((t) => t.sentence)).toContain("You both keep quiet hours after 10pm");
    expect(c.differences).toEqual([]);
    expect(c.basedOn).toEqual(["sleep", "quietHours", "cleanliness", "noise", "smoking"]);
  });

  test("weighted mean of similarities over the fields both answered", () => {
    // sleep 3 × 1, quietHours 3 × 0.75, cleanliness 3 × 0.5, noise 2 × 0.5, smoking 3 × 1
    const c = compatibility(
      me(base),
      me({ ...base, quietHours: "11pm", cleanliness: "very_tidy", noise: "quiet" }),
    );
    expect(c.score).toBe(Math.round((100 * (3 + 2.25 + 1.5 + 1 + 3)) / 14));
    expect(c.differences.map((t) => t.field)).toEqual(["quietHours", "cleanliness", "noise"]);
    expect(c.differences[0]).toMatchObject({
      outcome: "close",
      a: { label: "10pm" },
      b: { label: "11pm" },
    });
  });

  test("a field either person skipped doesn't count and leaks nothing", () => {
    const theirs = { ...base, noise: undefined, guests: "often" } as LifestyleAnswers;
    const c = compatibility(me(base), me(theirs));
    expect(c.score).toBe(100);
    expect(c.basedOn).not.toContain("noise");
    expect(c.basedOn).not.toContain("guests");
    expect(c.notCompared).toContain("noise");
    expect(c.notCompared).toContain("guests");
    // The candidate's guests answer appears nowhere.
    expect(JSON.stringify(c)).not.toContain("often");
  });

  test(`fewer than ${MIN_COMPARED} fields in common gives no score`, () => {
    const c = compatibility(me({ sleep: "early", noise: "quiet" }), me({ sleep: "early", noise: "quiet" }));
    expect(c.score).toBeNull();
    expect(c.shared).toHaveLength(2);
    expect(scoreLabel(c)).toBe("Not enough answers");
  });

  test("budgets count as overlap only, never amounts", () => {
    const c = compatibility(
      me(base, { budget: { min: 1800, max: 2400 }, workplace: "hybrid" }),
      me(base, { budget: { min: 2600, max: 3100 }, workplace: "none" }),
    );
    expect(c.basedOn).toContain("budget");
    expect(c.basedOn).not.toContain("workday");
    expect(c.differences.find((t) => t.field === "budget")).toMatchObject({
      sentence: "Your budgets don't overlap",
      a: null,
      b: null,
    });
    expect(JSON.stringify(c)).not.toMatch(/1800|2400|2600|3100|none/);
  });
});

describe("dealbreakers", () => {
  test("a hit in either direction caps the score", () => {
    const mine = me({ ...base, dealbreakers: ["dogs"] });
    const dog = me({ ...base, pets: ["dog"] });
    const c = compatibility(mine, dog);
    expect(c.score).toBe(DEALBREAKER_CAP);
    expect(c.capped).toBe(true);
    expect(c.dealbreakers).toMatchObject([
      { holder: "a", dealbreaker: "dogs", status: "conflict", answer: { label: "Dog" } },
    ]);
    expect(scoreLabel(c)).toBe("Dealbreaker");

    const reverse = compatibility(dog, mine);
    expect(reverse.score).toBe(DEALBREAKER_CAP);
    expect(reverse.dealbreakers[0]).toMatchObject({ holder: "b", dealbreaker: "dogs" });
  });

  test("a score already under the cap stays as it is", () => {
    const c = compatibility(
      me({ sleep: "early", quietHours: "9pm", noise: "quiet", dealbreakers: ["smoking_any"] }),
      me({ sleep: "days", quietHours: "none", noise: "lively", smoking: "outside" }),
    );
    // smoking isn't compared (only one answered), but the dealbreaker still checks it.
    expect(c.score).toBe(0);
    expect(c.capped).toBe(true);
  });

  test("a dealbreaker the other person skipped is unchecked, never a cap", () => {
    const c = compatibility(me({ ...base, dealbreakers: ["dogs"] }), me(base));
    expect(c.score).toBe(100);
    expect(c.capped).toBe(false);
    expect(c.dealbreakers).toEqual([]);
    expect(c.unchecked).toMatchObject([{ dealbreaker: "dogs", status: "unknown", answer: null }]);
  });

  test("the candidate's clear dealbreakers aren't returned", () => {
    const c = compatibility(me(base), me({ ...base, dealbreakers: ["smoking_inside"] }));
    expect(c.dealbreakers).toEqual([]);
    expect(c.unchecked).toEqual([]);
  });
});

describe("seed", () => {
  const inputs = (username: string): RoommateInputs => {
    const l = roommateLifestyles.find((r) => r.username === username);
    const p = cityProfileSeeds.find((r) => r.username === username);
    if (!l) throw new Error(username);
    return { answers: l.answers, budget: p?.budget ?? null, workplace: p?.schedule.workplace };
  };

  test("Maya's candidates spread from a great match to a dealbreaker", () => {
    const score = (u: string) => compatibility(inputs("maya.chen"), inputs(u));
    const labels = Object.fromEntries(
      ["luis.hernandez", "tasha.okafor", "sofia.alvarez", "camila.santos", "leo.novak"].map(
        (u) => [u, [score(u).score, scoreLabel(score(u))]],
      ),
    );
    expect(labels).toEqual({
      "luis.hernandez": [85, "Great match"],
      "tasha.okafor": [73, "Good match"],
      "sofia.alvarez": [67, "Good match"],
      "camila.santos": [60, "Some differences"],
      "leo.novak": [40, "Dealbreaker"],
    });
    expect(score("sofia.alvarez").unchecked.map((d) => d.dealbreaker)).toEqual(["dogs"]);
  });
});
