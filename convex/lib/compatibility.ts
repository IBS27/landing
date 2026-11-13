import {
  compareLifestyles,
  type DealbreakerResult,
  type LifestyleAnswers,
  type MatchField,
  ROOMMATE_MATCH_FIELDS,
  type RoommateInputs,
  SCALE_FIELDS,
  type TraitComparison,
} from "./lifestyle";

/**
 * Roommate compatibility score (#23): a 0–100 score with the traits two people
 * share, where they differ and any dealbreakers. Deterministic and pure (no
 * AI, no server imports), so the server computes it and the tests pin it.
 *
 * ## How it's computed
 * - Only fields both people answered count. A field either person skipped adds
 *   nothing, and nothing about the other person's value is returned.
 * - Each compared field contributes its similarity from `compareLifestyles`
 *   (#21) times its weight below: `score = round(100 × Σ w·s / Σ w)`.
 * - Fewer than MIN_COMPARED fields in common: no score (`null`).
 * - A dealbreaker hit, in either direction, **caps** the score at
 *   DEALBREAKER_CAP. It doesn't exclude: the person stays in the list with the
 *   reason, rather than silently disappearing from the viewer's network. A
 *   dealbreaker the other person didn't answer never caps; it's `unchecked`.
 *
 * ## Protected-trait review
 * The score reads only COMPATIBILITY_WEIGHTS' fields, which are exactly #21's
 * allowlist (`ROOMMATE_MATCH_FIELDS`, reviewed field by field in
 * `./lifestyle.ts`) plus each person's dealbreakers. `allowlisted()` copies the
 * inputs through that list first, so nothing else a caller passes can reach
 * it. Never inputs: name, photo, age, gender, network closeness, mutual
 * friends, employer, move-in month, neighborhoods or any other profile or
 * Facebook field. Budget enters only as "do the ranges overlap" (no amounts),
 * workplace "not working" is never compared, and no model computes the score.
 * Its result, as the Roommates page shows it to the viewer (the score, what
 * the two share and where they differ), is also what Muse reads in that
 * viewer's own Landing Home chat (#154): never the answers themselves.
 */

/** How much each allowlisted field counts. Keys are exactly `ROOMMATE_MATCH_FIELDS`. */
export const COMPATIBILITY_WEIGHTS = {
  sleep: 3,
  quietHours: 3,
  cleanliness: 3,
  noise: 2,
  groceries: 1,
  guests: 2,
  overnightGuests: 2,
  smoking: 3,
  pets: 2,
  budget: 3,
  workday: 1,
} as const satisfies Record<MatchField, number>;

/** Fields both people must have answered before there's a score. */
export const MIN_COMPARED = 3;
/** The highest score while either person's dealbreaker is hit. */
export const DEALBREAKER_CAP = 40;

export type Compatibility = {
  /** 0–100, or null with fewer than MIN_COMPARED fields in common. */
  score: number | null;
  /** A dealbreaker was hit, so the score is at most DEALBREAKER_CAP. */
  capped: boolean;
  /** Fields where both gave the same answer: "You both keep quiet hours after 10pm". */
  shared: TraitComparison[];
  /** Fields that differ, closest first. Cites `a` are the viewer's answers, `b` the candidate's. */
  differences: TraitComparison[];
  /** Dealbreakers hit in either direction (`holder` "a" is the viewer). */
  dealbreakers: DealbreakerResult[];
  /** The viewer's dealbreakers the candidate didn't answer, so they couldn't be checked. */
  unchecked: DealbreakerResult[];
  /** What the score is based on: every field compared, in vocabulary order. */
  basedOn: MatchField[];
  /** Allowlisted fields one of them skipped. No values. */
  notCompared: MatchField[];
};

/** Copies only allowlisted inputs, so nothing else a caller passes can reach the score. */
export function allowlisted(inputs: RoommateInputs): RoommateInputs {
  const answers: Record<string, unknown> = {};
  for (const field of [...SCALE_FIELDS, "pets", "dealbreakers"] as const)
    if (inputs.answers[field] !== undefined) answers[field] = inputs.answers[field];
  return {
    answers: answers as LifestyleAnswers,
    budget: inputs.budget ?? null,
    workplace: inputs.workplace ?? null,
  };
}

/**
 * Compares the viewer with a candidate. The caller decides who may be
 * compared (`comparableLifestyles`: both share, no block either way).
 */
export function compatibility(viewer: RoommateInputs, candidate: RoommateInputs): Compatibility {
  const { traits, dealbreakers, unanswered } = compareLifestyles(
    allowlisted(viewer),
    allowlisted(candidate),
  );
  const weighted = traits.filter((t) => t.field in COMPATIBILITY_WEIGHTS);
  const total = weighted.reduce((s, t) => s + COMPATIBILITY_WEIGHTS[t.field], 0);
  const sum = weighted.reduce((s, t) => s + COMPATIBILITY_WEIGHTS[t.field] * t.similarity, 0);
  const hits = dealbreakers.filter((d) => d.status === "conflict");
  const raw = weighted.length >= MIN_COMPARED && total > 0 ? Math.round((100 * sum) / total) : null;
  return {
    score: raw === null ? null : hits.length > 0 ? Math.min(raw, DEALBREAKER_CAP) : raw,
    capped: raw !== null && hits.length > 0,
    shared: weighted.filter((t) => t.outcome === "same"),
    differences: weighted
      .filter((t) => t.outcome !== "same")
      .sort((x, y) => y.similarity - x.similarity),
    dealbreakers: hits,
    unchecked: dealbreakers.filter((d) => d.holder === "a" && d.status === "unknown"),
    basedOn: weighted.map((t) => t.field),
    notCompared: ROOMMATE_MATCH_FIELDS.filter((f) => unanswered.includes(f)),
  };
}

/** Short words for a score, for the badge and screen readers. */
export function scoreLabel(c: Pick<Compatibility, "score" | "dealbreakers">): string {
  if (c.score === null) return "Not enough answers";
  if (c.dealbreakers.length > 0) return "Dealbreaker";
  if (c.score >= 80) return "Great match";
  if (c.score >= 65) return "Good match";
  return "Some differences";
}
