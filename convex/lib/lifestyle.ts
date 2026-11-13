import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Roommate lifestyle answers (#21): the fixed vocabulary, its copy, and how two
 * people's answers compare. Pure and client-safe (no server imports), so the
 * questionnaire, the server and the compatibility score (#23) share one source.
 *
 * Every field is optional: a missing field means "not answered", never a
 * default. Answers are written only by their owner through the form; nothing
 * here or elsewhere infers them from activity.
 *
 * ## Protected-trait review
 * Matching must never use, or use a stand-in for, age, sex or gender, gender
 * identity, sexual orientation, race, color, ethnicity, ancestry, national
 * origin, religion, disability or health (including HIV status and genetic
 * information), pregnancy, family or marital status, military or veteran
 * status, or source of income. Each field was checked against that list:
 *
 * - No identity fields at all: no gender, "same-gender roommate" preference,
 *   age, student status, occupation, employer, income, language, nationality or
 *   hometown. There is no free text, so nothing identity-shaped can be typed in.
 * - Sleep, quiet hours, noise, guests: asked as behaviors with times and
 *   frequencies. The options carry no life-stage words ("student", "young
 *   professional", "retired", "family"). "During the day" covers night shifts
 *   without asking why.
 * - Guests are asked as frequency, never who they are: no partner, kids,
 *   couples or "anyone else living with you" questions (family/marital status).
 * - Groceries asks only whether to share. No diet, alcohol, fasting or holiday
 *   questions, which stand in for religion and culture.
 * - Smoking or vaping is a behavior, not a protected class. It doesn't ask what
 *   is smoked or why (no medical use questions).
 * - Pets: no allergy or health questions; the dealbreakers cover the need
 *   without a reason. Service and assistance animals are not pets: the form
 *   says so, and they are never asked about or matched on (disability).
 * - Cleanliness options describe habits ("dishes done the same day"), not
 *   judgments of people.
 * - Budget and workday come from the City Profile (#3), stated facts only.
 *   Budget is compared as "do the ranges overlap" and the amounts never leave
 *   `compareBudget` (source of income). Workplace `none` (not working) is never
 *   compared: it can stand in for age, disability, pregnancy or student status.
 *
 * Adding a field: it must be a behavior or preference about sharing a home, on
 * a fixed scale, and get a line in this review. Don't add identity fields.
 */

/* ---------------- Vocabulary ---------------- */

/** Ordered scales: options run from one end to the other, so distance means something. */
export const SCALES = {
  sleep: ["early", "regular", "late", "days"],
  quietHours: ["9pm", "10pm", "11pm", "midnight", "none"],
  cleanliness: ["relaxed", "tidy", "very_tidy"],
  noise: ["quiet", "some", "lively"],
  groceries: ["separate", "basics", "together"],
  guests: ["rarely", "monthly", "weekly", "often"],
  overnightGuests: ["rarely", "sometimes", "often"],
  smoking: ["no", "outside", "inside"],
} as const;
export type ScaleField = keyof typeof SCALES;
export type ScaleValue<F extends ScaleField> = (typeof SCALES)[F][number];
export const SCALE_FIELDS = Object.keys(SCALES) as ScaleField[];

/** Pets someone would bring. An empty list means no pets; a missing field means skipped. */
export const PETS = ["cat", "dog", "other"] as const;
export type Pet = (typeof PETS)[number];

/** Things someone can't live with. Each is checked against one of the other person's answers. */
export const DEALBREAKERS = [
  "smoking_inside",
  "smoking_any",
  "cats",
  "dogs",
  "any_pets",
  "frequent_guests",
  "frequent_overnight",
  "no_quiet_hours",
  "relaxed_tidying",
] as const;
export type Dealbreaker = (typeof DEALBREAKERS)[number];

export const lifestyleAnswers = v.object({
  sleep: v.optional(literals(...SCALES.sleep)),
  quietHours: v.optional(literals(...SCALES.quietHours)),
  cleanliness: v.optional(literals(...SCALES.cleanliness)),
  noise: v.optional(literals(...SCALES.noise)),
  groceries: v.optional(literals(...SCALES.groceries)),
  guests: v.optional(literals(...SCALES.guests)),
  overnightGuests: v.optional(literals(...SCALES.overnightGuests)),
  smoking: v.optional(literals(...SCALES.smoking)),
  pets: v.optional(v.array(literals(...PETS))),
  dealbreakers: v.optional(v.array(literals(...DEALBREAKERS))),
});
export type LifestyleAnswers = Infer<typeof lifestyleAnswers>;
export type LifestyleField = keyof LifestyleAnswers;

/** City Profile values used for matching (same shapes as #3's `budget` and `schedule.workplace`). */
export type BudgetRange = { min?: number; max: number };
export const WORKDAYS = ["office", "hybrid", "remote"] as const;
export type Workday = (typeof WORKDAYS)[number];

/**
 * The explicit allowlist of everything roommate matching may compare. Nothing
 * outside it is ever an input, whatever else the caller passes in.
 */
export const ROOMMATE_MATCH_FIELDS = [...SCALE_FIELDS, "pets", "budget", "workday"] as const;
export type MatchField = ScaleField | "pets" | "budget" | "workday";

/* ---------------- Copy ---------------- */

type OptionCopy = { label: string; hint?: string; same: string };
type ScaleCopy<F extends ScaleField> = {
  title: string;
  /** Lowercase noun phrase for "Close on …" sentences. */
  topic: string;
  options: Record<ScaleValue<F>, OptionCopy>;
};

export const SCALE_COPY: { [F in ScaleField]: ScaleCopy<F> } = {
  sleep: {
    title: "When do you usually go to sleep?",
    topic: "sleep schedule",
    options: {
      early: { label: "Before 10pm", same: "You both usually go to sleep before 10pm" },
      regular: {
        label: "10pm to midnight",
        same: "You both usually go to sleep between 10pm and midnight",
      },
      late: { label: "After midnight", same: "You both usually go to sleep after midnight" },
      days: {
        label: "During the day",
        hint: "For example, after night shifts",
        same: "You both sleep during the day",
      },
    },
  },
  quietHours: {
    title: "When should the place get quiet?",
    topic: "quiet hours",
    options: {
      "9pm": { label: "9pm", same: "You both keep quiet hours after 9pm" },
      "10pm": { label: "10pm", same: "You both keep quiet hours after 10pm" },
      "11pm": { label: "11pm", same: "You both keep quiet hours after 11pm" },
      midnight: { label: "Midnight", same: "You both keep quiet hours after midnight" },
      none: { label: "No set quiet hours", same: "Neither of you needs set quiet hours" },
    },
  },
  cleanliness: {
    title: "How tidy do you keep shared spaces?",
    topic: "tidiness",
    options: {
      relaxed: {
        label: "Relaxed",
        hint: "I tidy up now and then",
        same: "You both take a relaxed approach to tidying",
      },
      tidy: {
        label: "Tidy",
        hint: "Dishes done the same day",
        same: "You both keep shared spaces tidy",
      },
      very_tidy: {
        label: "Very tidy",
        hint: "I clean as I go",
        same: "You both keep shared spaces very tidy",
      },
    },
  },
  noise: {
    title: "How much noise at home works for you?",
    topic: "noise at home",
    options: {
      quiet: {
        label: "Quiet",
        hint: "Headphones and low voices",
        same: "You both like a quiet home",
      },
      some: {
        label: "Some",
        hint: "Music or TV at a normal volume",
        same: "You're both fine with some music or TV",
      },
      lively: {
        label: "Lively",
        hint: "Music up, people around",
        same: "You both like a lively home",
      },
    },
  },
  groceries: {
    title: "Do you want to share groceries?",
    topic: "groceries",
    options: {
      separate: { label: "Keep them separate", same: "You both keep groceries separate" },
      basics: {
        label: "Share the basics",
        hint: "Oil, coffee, paper towels",
        same: "You both like to share the basics",
      },
      together: {
        label: "Shop and cook together",
        same: "You both like to shop and cook together",
      },
    },
  },
  guests: {
    title: "How often do you have friends over?",
    topic: "having friends over",
    options: {
      rarely: { label: "Rarely", same: "You both rarely have friends over" },
      monthly: {
        label: "A few times a month",
        same: "You both have friends over a few times a month",
      },
      weekly: { label: "About once a week", same: "You both have friends over about once a week" },
      often: {
        label: "Several times a week",
        same: "You both have friends over several times a week",
      },
    },
  },
  overnightGuests: {
    title: "How often do guests stay the night?",
    topic: "overnight guests",
    options: {
      rarely: { label: "Rarely", same: "Guests rarely stay the night for either of you" },
      sometimes: {
        label: "A few nights a month",
        same: "You both have guests stay a few nights a month",
      },
      often: {
        label: "Several nights a week",
        same: "You both have guests stay several nights a week",
      },
    },
  },
  smoking: {
    title: "Do you smoke or vape?",
    topic: "smoking and vaping",
    options: {
      no: { label: "No", same: "Neither of you smokes or vapes" },
      outside: { label: "Only outside", same: "You both smoke or vape only outside" },
      inside: { label: "Inside too", same: "You both smoke or vape inside" },
    },
  },
};

export const PET_COPY = {
  title: "Will you bring any pets?",
  topic: "pets",
  note: "Service and assistance animals aren't pets. Don't list them here: they're never part of matching.",
  none: "No pets",
  options: {
    cat: { label: "Cat", noun: "a cat" },
    dog: { label: "Dog", noun: "a dog" },
    other: { label: "Another pet", noun: "another pet" },
  },
} as const satisfies {
  title: string;
  topic: string;
  note: string;
  none: string;
  options: Record<Pet, { label: string; noun: string }>;
};

export const WORKDAY_COPY: Record<Workday, OptionCopy> = {
  office: { label: "At an office", same: "You both work at an office" },
  hybrid: { label: "Hybrid", same: "You both work hybrid" },
  remote: { label: "From home", same: "You both work from home" },
};

type DealbreakerRule = {
  label: string;
  /** The other person's answer this dealbreaker is checked against. */
  field: ScaleField | "pets";
  /** True when the answer breaks it, null when that question was skipped. */
  breaks: (other: LifestyleAnswers) => boolean | null;
};

const has = (pet: Pet) => (o: LifestyleAnswers) => (o.pets ? o.pets.includes(pet) : null);
const is =
  <F extends ScaleField>(field: F, ...values: ScaleValue<F>[]) =>
  (o: LifestyleAnswers) => {
    const answer = o[field] as ScaleValue<F> | undefined;
    return answer === undefined ? null : values.includes(answer);
  };

export const DEALBREAKER_RULES: Record<Dealbreaker, DealbreakerRule> = {
  smoking_inside: {
    label: "Smoking or vaping inside",
    field: "smoking",
    breaks: is("smoking", "inside"),
  },
  smoking_any: {
    label: "Any smoking or vaping",
    field: "smoking",
    breaks: is("smoking", "outside", "inside"),
  },
  cats: { label: "Cats", field: "pets", breaks: has("cat") },
  dogs: { label: "Dogs", field: "pets", breaks: has("dog") },
  any_pets: {
    label: "Any pets",
    field: "pets",
    breaks: (o) => (o.pets ? o.pets.length > 0 : null),
  },
  frequent_guests: {
    label: "Friends over several times a week",
    field: "guests",
    breaks: is("guests", "often"),
  },
  frequent_overnight: {
    label: "Guests staying over several nights a week",
    field: "overnightGuests",
    breaks: is("overnightGuests", "often"),
  },
  no_quiet_hours: {
    label: "No quiet hours at night",
    field: "quietHours",
    breaks: is("quietHours", "none"),
  },
  relaxed_tidying: {
    label: "A relaxed approach to tidying",
    field: "cleanliness",
    breaks: is("cleanliness", "relaxed"),
  },
};

/** The questionnaire's steps, in order. */
export const STEPS = [
  { id: "sleep", title: "Sleep and quiet", fields: ["sleep", "quietHours"] },
  { id: "home", title: "Home", fields: ["cleanliness", "noise", "groceries"] },
  { id: "guests", title: "Guests", fields: ["guests", "overnightGuests"] },
  { id: "habits", title: "Habits", fields: ["smoking", "pets"] },
  { id: "dealbreakers", title: "Dealbreakers", fields: ["dealbreakers"] },
] as const satisfies readonly { id: string; title: string; fields: readonly LifestyleField[] }[];

export const DEALBREAKER_COPY = {
  title: "Anything you can't live with?",
  hint: "Pick any that apply. Matches are checked against these.",
  none: "No dealbreakers",
};

/* ---------------- Answers ---------------- */

const ALL_FIELDS: readonly LifestyleField[] = [...SCALE_FIELDS, "pets", "dealbreakers"];

/**
 * Keeps only known fields with valid values, and puts lists in vocabulary
 * order without duplicates, so equal answers are stored identically.
 */
export function normalizeAnswers(input: LifestyleAnswers): LifestyleAnswers {
  const out: LifestyleAnswers = {};
  for (const field of SCALE_FIELDS) {
    const value = input[field];
    if (value !== undefined && (SCALES[field] as readonly string[]).includes(value))
      (out as Record<string, string>)[field] = value;
  }
  if (input.pets) out.pets = PETS.filter((p) => input.pets!.includes(p));
  if (input.dealbreakers)
    out.dealbreakers = DEALBREAKERS.filter((d) => input.dealbreakers!.includes(d));
  return out;
}

/** How many questions have an answer (an empty pets or dealbreakers list counts: it's "none"). */
export function answeredCount(answers: LifestyleAnswers): number {
  return ALL_FIELDS.filter((f) => answers[f] !== undefined).length;
}
export const QUESTION_COUNT = ALL_FIELDS.length;

/** Display label for one answer, or null when skipped. */
export function answerLabel(answers: LifestyleAnswers, field: LifestyleField): string | null {
  if (field === "pets") return answers.pets ? petsLabel(answers.pets) : null;
  if (field === "dealbreakers") {
    const list = answers.dealbreakers;
    if (!list) return null;
    return list.length
      ? list.map((d) => DEALBREAKER_RULES[d].label).join(", ")
      : DEALBREAKER_COPY.none;
  }
  return scaleLabel(field, answers[field]);
}

function scaleLabel<F extends ScaleField>(field: F, value: ScaleValue<F> | undefined) {
  return value === undefined ? null : SCALE_COPY[field].options[value].label;
}

function petsLabel(pets: readonly Pet[]) {
  return pets.length ? pets.map((p) => PET_COPY.options[p].label).join(", ") : PET_COPY.none;
}

/* ---------------- Comparison ---------------- */

/** One side of a comparison: the person's answers plus their stated City Profile values. */
export type RoommateInputs = {
  answers: LifestyleAnswers;
  /** City Profile `budget`, stated facts only. */
  budget?: BudgetRange | null;
  /** City Profile `schedule.workplace`, stated facts only. `none` is ignored. */
  workplace?: string | null;
};

export type TraitOutcome = "same" | "close" | "different";

/** What a comparison was built from: one person's answer. Budgets never carry amounts. */
export type AnswerCite = { value: string | readonly string[]; label: string };

export type TraitComparison = {
  field: MatchField;
  kind: "scale" | "set" | "overlap";
  outcome: TraitOutcome;
  /** 1 = identical, 0 = opposite ends. */
  similarity: number;
  /** "You both keep quiet hours after 10pm", "Close on quiet hours: 10pm and 11pm". */
  sentence: string;
  /** The answers it came from (`a`'s, then `b`'s). Null for budgets: amounts are never shown. */
  a: AnswerCite | null;
  b: AnswerCite | null;
};

export type DealbreakerResult = {
  /** Whose dealbreaker it is. */
  holder: "a" | "b";
  dealbreaker: Dealbreaker;
  label: string;
  /** The question it was checked against, on the other person's side. */
  field: ScaleField | "pets";
  /** `unknown`: the other person skipped that question. */
  status: "conflict" | "clear" | "unknown";
  /** The other person's answer it was checked against, when they gave one. */
  answer: AnswerCite | null;
};

export type LifestyleComparison = {
  /** Allowlisted fields both people answered, in vocabulary order. */
  traits: TraitComparison[];
  /** Every dealbreaker either person picked, checked against the other's answers. */
  dealbreakers: DealbreakerResult[];
  /** Allowlisted fields at least one person hasn't answered. */
  unanswered: MatchField[];
};

function outcomeFor(distance: number): TraitOutcome {
  return distance === 0 ? "same" : distance === 1 ? "close" : "different";
}

function differSentence(outcome: TraitOutcome, topic: string, a: string, b: string) {
  return `${outcome === "close" ? "Close" : "Different"} on ${topic}: ${a} and ${b}`;
}

/** Distance on an ordered scale. */
export function compareScale<F extends ScaleField>(
  field: F,
  a: ScaleValue<F>,
  b: ScaleValue<F>,
): TraitComparison {
  const scale = SCALES[field] as readonly string[];
  const distance = Math.abs(scale.indexOf(a) - scale.indexOf(b));
  const copy = SCALE_COPY[field];
  const la = copy.options[a].label;
  const lb = copy.options[b].label;
  const outcome = outcomeFor(distance);
  return {
    field,
    kind: "scale",
    outcome,
    similarity: 1 - distance / (scale.length - 1),
    sentence:
      outcome === "same" ? copy.options[a].same : differSentence(outcome, copy.topic, la, lb),
    a: { value: a, label: la },
    b: { value: b, label: lb },
  };
}

/** Pets as sets: equal = same, some overlap = close, none = different. */
export function comparePets(a: readonly Pet[], b: readonly Pet[]): TraitComparison {
  const common = PETS.filter((p) => a.includes(p) && b.includes(p));
  const union = PETS.filter((p) => a.includes(p) || b.includes(p));
  const outcome: TraitOutcome =
    union.length === common.length ? "same" : common.length ? "close" : "different";
  const both = common.map((p) => PET_COPY.options[p].noun).join(" and ");
  const sentence =
    outcome === "different"
      ? differSentence(outcome, PET_COPY.topic, petsLabel(a), petsLabel(b))
      : common.length
        ? `You'd both bring ${both}`
        : "Neither of you has pets";
  return {
    field: "pets",
    kind: "set",
    outcome,
    // Jaccard similarity; two empty sets are identical.
    similarity: union.length ? common.length / union.length : 1,
    sentence,
    a: { value: a, label: petsLabel(a) },
    b: { value: b, label: petsLabel(b) },
  };
}

function validBudget(b: BudgetRange | null | undefined): b is BudgetRange {
  if (!b || !Number.isFinite(b.max) || b.max <= 0) return false;
  return b.min === undefined || (Number.isFinite(b.min) && b.min >= 0 && b.min <= b.max);
}

/** Whether two monthly budgets overlap. The result never contains either amount. */
export function compareBudget(a: BudgetRange, b: BudgetRange): TraitComparison {
  const overlap = Math.max(a.min ?? 0, b.min ?? 0) <= Math.min(a.max, b.max);
  return {
    field: "budget",
    kind: "overlap",
    outcome: overlap ? "same" : "different",
    similarity: overlap ? 1 : 0,
    sentence: overlap ? "Your budgets overlap" : "Your budgets don't overlap",
    a: null,
    b: null,
  };
}

function asWorkday(w: string | null | undefined): Workday | null {
  return (WORKDAYS as readonly string[]).includes(w ?? "") ? (w as Workday) : null;
}

/** How much of the workweek each person is home: office < hybrid < remote. */
export function compareWorkday(a: Workday, b: Workday): TraitComparison {
  const distance = Math.abs(WORKDAYS.indexOf(a) - WORKDAYS.indexOf(b));
  const outcome = outcomeFor(distance);
  const la = WORKDAY_COPY[a].label;
  const lb = WORKDAY_COPY[b].label;
  return {
    field: "workday",
    kind: "scale",
    outcome,
    similarity: 1 - distance / (WORKDAYS.length - 1),
    sentence:
      outcome === "same" ? WORKDAY_COPY[a].same : differSentence(outcome, "workdays", la, lb),
    a: { value: a, label: la },
    b: { value: b, label: lb },
  };
}

/** Each of `holder`'s dealbreakers, checked against `other`'s answers. */
export function checkDealbreakers(
  holder: "a" | "b",
  mine: LifestyleAnswers,
  other: LifestyleAnswers,
): DealbreakerResult[] {
  return DEALBREAKERS.filter((d) => mine.dealbreakers?.includes(d)).map((dealbreaker) => {
    const rule = DEALBREAKER_RULES[dealbreaker];
    const broken = rule.breaks(other);
    const label = answerLabel(other, rule.field);
    const value = rule.field === "pets" ? other.pets : other[rule.field];
    return {
      holder,
      dealbreaker,
      label: rule.label,
      field: rule.field,
      status: broken === null ? "unknown" : broken ? "conflict" : "clear",
      answer: value !== undefined && label !== null ? { value, label } : null,
    };
  });
}

/**
 * Compares two people on the allowlisted fields only (`ROOMMATE_MATCH_FIELDS`).
 * Pure: the caller decides who may be compared (see `comparableLifestyles`).
 */
export function compareLifestyles(a: RoommateInputs, b: RoommateInputs): LifestyleComparison {
  const A = normalizeAnswers(a.answers);
  const B = normalizeAnswers(b.answers);
  const traits: TraitComparison[] = [];
  const unanswered: MatchField[] = [];
  for (const field of SCALE_FIELDS) {
    const x = A[field];
    const y = B[field];
    if (x === undefined || y === undefined) unanswered.push(field);
    else traits.push(compareScale(field, x as never, y as never));
  }
  if (A.pets && B.pets) traits.push(comparePets(A.pets, B.pets));
  else unanswered.push("pets");
  if (validBudget(a.budget) && validBudget(b.budget))
    traits.push(compareBudget(a.budget, b.budget));
  else unanswered.push("budget");
  const wa = asWorkday(a.workplace);
  const wb = asWorkday(b.workplace);
  if (wa && wb) traits.push(compareWorkday(wa, wb));
  else unanswered.push("workday");
  return {
    traits,
    dealbreakers: [...checkDealbreakers("a", A, B), ...checkDealbreakers("b", B, A)],
    unanswered,
  };
}

/** Lowercase topic for a match field ("quiet hours"), for lists of unanswered fields. */
export function fieldTopic(field: MatchField): string {
  if (field === "pets") return PET_COPY.topic;
  if (field === "budget") return "budget";
  if (field === "workday") return "workdays";
  return SCALE_COPY[field].topic;
}
