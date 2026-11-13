import { v } from "convex/values";
import { defineTask } from "../ai/agent";
import {
  briefFactEntry,
  type FactEntry,
  factSlot,
  GOALS,
  moveInProblem,
  SF_NEIGHBORHOODS,
  TRANSPORT_MODES,
  todayInSF,
  WORK_HOURS,
  WORKPLACES,
} from "./cityProfileFacts";
import { INTEREST_SECTIONS, INTERESTS } from "./interests";
import {
  employerProblem,
  extractFacts,
  narrowQuote,
  profileSentences,
  quoteProblem,
} from "./profileText";
import { hasProtected, REDACTED } from "./protectedText";

/**
 * Muse's "Tell us about you" task (#3 on #8's `runAgent`): reads what the
 * person wrote and proposes typed City Profile facts, each with the exact
 * words it came from. The output is only a proposal. The person ticks what's
 * right and `saveBrief` stores it, so the agent never writes profile data.
 *
 * Protected traits: the model only ever sees the text with them removed
 * (`profileInput`), and a quote can't contain one. An interest must be backed
 * by words naming the activity, so who someone is can't stand in for it.
 *
 * Grounding: every quote must be copied from the text and an employer must be
 * named in it (`check`). Values are limited to the profile's own vocabularies
 * by the output schema. With AI off, or when the model can't give a valid
 * answer, the rules in `./profileText.ts` answer instead.
 */

export type ProfileTextInput = {
  /** What the person wrote: only sentences with profile vocabulary, protected traits replaced by `REDACTED`. */
  text: string;
  /** "YYYY-MM-DD" in San Francisco, so "in March" resolves to the right year. */
  today: string;
};

/**
 * The task's input: the only form of the person's text that reaches the model.
 * Protected traits are redacted, and only sentences with profile vocabulary
 * are kept (`profileSentences`), so the rest of what they wrote never leaves.
 */
export function profileInput(text: string, now = Date.now()): ProfileTextInput {
  return { text: profileSentences(text.trim()), today: todayInSF(now) };
}

const proposedFact = v.object({
  entry: briefFactEntry,
  /** The shortest exact phrase from the text that supports this fact. */
  quote: v.string(),
  /** Transport only: true when they said they have no car. */
  carFree: v.optional(v.boolean()),
});

const output = v.object({ facts: v.array(proposedFact) });

const MAX_FACTS = 25;

const interestList = INTEREST_SECTIONS.map(
  (s) =>
    `${s.label}: ${INTERESTS.filter((i) => i.section === s.id)
      .map((i) => `${i.id} (${i.label.toLowerCase()})`)
      .join(", ")}`,
).join("\n");

const neighborhoodList = SF_NEIGHBORHOODS.filter((n) => !("park" in n && n.park))
  .map((n) => ("short" in n ? `${n.slug} (${n.name}, "${n.short}")` : `${n.slug} (${n.name})`))
  .join(", ");

const INSTRUCTIONS = `The person is setting up their Landing City Profile before moving to San Francisco. <input> has what they wrote about themselves ("text") and today's date ("today"). Turn it into profile facts they can confirm. They will see every fact with your quote and untick anything wrong, so propose only what the text says or clearly means. Fewer, accurate facts beat many guesses.

Each fact is { entry: { key, value }, quote, carFree? }. At most one fact per key, except interest, neighborhood and goal, which get one fact per item.
- quote: the shortest phrase from the text that supports the fact and contains its own words (the activity, the place, the amount, the month, each transport mode), copied character for character (same spelling, no added words, no ellipses). Only those words are kept as evidence.
- budget: monthly rent in whole US dollars. "$2k" = 2000, "1.8–2.4k" = min 1800 and max 2400. A single number or "under X" is max only. Other amounts in the same sentence aren't rent: "$2,500 including $300 for utilities" is max 2500.
- moveIn: month "YYYY-MM", the next such month on or after today unless they give a year. Add date "YYYY-MM-DD" only when they give a day. Numeric dates are US month/day: "3/15/2027" and "2027-03-15" are both 2027-03-15.
- neighborhood: only San Francisco neighborhoods they name as places they'd consider living, using these slugs: ${neighborhoodList}. Map everyday names: "the Mission" = mission, "Outer Sunset" or "the Sunset" = sunset-parkside, "SoMa" = south-of-market, "Dogpatch" = potrero-hill, "NoPa" = western-addition, "the Haight" = haight-ashbury. Skip places outside these, places they only work in or visit, and places they're moving from: "moving from the Mission to SoMa" is SoMa only.
- transport: modes from ${TRANSPORT_MODES.map((m) => m.id).join(", ")} that they'll use to get around ("N Judah", "the bus" and "streetcar" are muni). Include "car" only if they'll have one. Set carFree true only when they say they won't have a car.
- schedule: workHours ${WORK_HOURS.map((w) => w.id).join(" | ")}, workplace ${WORKPLACES.map((w) => w.id).join(" | ")} (only if they say), weekendsFree false only if they say they work weekends. Propose a schedule only when they say something about work hours or where they work.
- employer: the company or school by the name they use, only if they name it. workArea only if they say where it is.
- interest: activities they say they do or enjoy, using these ids. The quote must name the activity itself. Skip activities they say they don't do or don't like. Map synonyms ("boulder" = climbing, "board game nights" = board_games). Skip anything with no close match:
${interestList}
- goal: ${GOALS.map((g) => `${g.id} (${g.label.toLowerCase()})`).join(", ")}. Only when they say what they want from the move.

Never turn who someone is into a fact: no age, gender, ethnicity, nationality, religion, health, family or relationship status, and no interest stood in for one (a cultural or faith group is not an interest). Anything like that has already been replaced with "${REDACTED}": never quote it or guess what it was. If the text has nothing usable, return { "facts": [] }.`;

/** Lowercase, straight quotes, single spaces: for "was this copied from the text?" checks. */
function loose(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Muse's (or the rules') proposals as the person sees and saves them: each
 * quote cut down to the fact's own words (`narrowQuote`), so nothing else
 * they wrote can become evidence. A proposal whose quote doesn't contain them
 * is dropped.
 */
export function tidyProposals<T extends { entry: FactEntry; quote: string; carFree?: boolean }>(
  facts: T[],
): T[] {
  return facts.flatMap((f) => {
    const quote = narrowQuote(f.entry, f.quote, f.carFree);
    return quote ? [{ ...f, quote }] : [];
  });
}

export const profileFromText = defineTask({
  agent: "muse",
  name: "muse.profileFromText",
  instructions: INSTRUCTIONS,
  output,
  // The person's own words are the evidence (each fact's quote), not shared sources.
  cites: () => [],
  check: (out, input: ProfileTextInput) => {
    const problems: string[] = [];
    const text = loose(input.text);
    const seen = new Set<string>();
    if (out.facts.length > MAX_FACTS) problems.push(`Propose at most ${MAX_FACTS} facts`);
    out.facts.forEach((f, i) => {
      const at = `facts[${i}]`;
      const quote = loose(f.quote);
      if (!quote) problems.push(`${at}.quote is empty`);
      else if (hasProtected(f.quote))
        problems.push(
          `${at}.quote includes something about who they are; quote only the words for this fact`,
        );
      else if (!text.includes(quote))
        problems.push(`${at}.quote "${f.quote}" isn't copied exactly from the text`);
      else {
        const problem = quoteProblem(input.text, f.entry, f.quote, f.carFree, input.today);
        if (problem) problems.push(`${at}: ${problem}; drop it`);
      }
      const slot = factSlot(f.entry);
      if (seen.has(slot)) problems.push(`${at}: more than one fact for ${slot}`);
      seen.add(slot);
      if (f.carFree !== undefined && f.entry.key !== "transport")
        problems.push(`${at}: carFree only goes on the transport fact`);
      const e = f.entry;
      switch (e.key) {
        case "budget":
          if (e.value.max < 300 || e.value.max > 20000)
            problems.push(`${at}: budget max should be monthly rent in dollars (300–20000)`);
          if (e.value.min !== undefined && (e.value.min < 0 || e.value.min > e.value.max))
            problems.push(`${at}: budget min should be between 0 and max`);
          break;
        case "moveIn": {
          const problem = moveInProblem(e.value, input.today);
          if (problem)
            problems.push(
              `${at}: ${problem} (month "YYYY-MM", date a real "YYYY-MM-DD" in it, not before ${input.today})`,
            );
          break;
        }
        case "transport":
          if (e.value.modes.length === 0 && !f.carFree)
            problems.push(`${at}: transport needs at least one mode`);
          if (f.carFree && e.value.modes.includes("car"))
            problems.push(`${at}: carFree but modes include car`);
          break;
        case "employer": {
          const problem = employerProblem(input.text, e.value);
          if (problem || hasProtected(e.value.name) || hasProtected(e.value.workArea ?? ""))
            problems.push(`${at}: ${problem ?? "the employer says something about who they are"}`);
          break;
        }
        default:
          break;
      }
    });
    return problems;
  },
  fallback: (input) => ({
    facts: extractFacts(input.text, input.today).map((p) => ({
      entry: p.entry,
      quote: p.quote,
      ...(p.carFree ? { carFree: true } : {}),
    })),
  }),
  // Short text in, short JSON out: keep it quick for an onboarding form.
  effort: "low",
  maxAttempts: 2,
  // 3: quotes must contain the fact's own words, which are all that's kept as evidence.
  // 4: only sentences with profile vocabulary reach the model; origin places, numeric dates (#77).
  version: 4,
});
