import { v } from "convex/values";
import { defineTask } from "../ai/agent";
import {
  factEntry,
  factSlot,
  GOALS,
  SF_NEIGHBORHOODS,
  TRANSPORT_MODES,
  WORK_HOURS,
  WORKPLACES,
} from "./cityProfileFacts";
import { INTEREST_SECTIONS, INTERESTS } from "./interests";
import { extractFacts } from "./profileText";

/**
 * Muse's "Tell us about you" task (#3 on #8's `runAgent`): reads what the
 * person wrote and proposes typed City Profile facts, each with the exact
 * words it came from. The output is only a proposal. The person ticks what's
 * right and `saveBrief` stores it, so the agent never writes profile data.
 *
 * Grounding: every quote must be copied from the text and an employer must be
 * named in it (`check`). Values are limited to the profile's own vocabularies
 * by the output schema. With AI off, or when the model can't give a valid
 * answer, the rules in `./profileText.ts` answer instead.
 */

export type ProfileTextInput = {
  /** What the person wrote, trimmed. */
  text: string;
  /** "YYYY-MM-DD", so "in March" resolves to the right year. */
  today: string;
};

const proposedFact = v.object({
  entry: factEntry,
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
- quote: the shortest phrase from the text that supports the fact, copied character for character (same spelling, no added words, no ellipses).
- budget: monthly rent in whole US dollars. "$2k" = 2000, "1.8–2.4k" = min 1800 and max 2400. A single number or "under X" is max only.
- moveIn: month "YYYY-MM", the next such month on or after today unless they give a year. Add date "YYYY-MM-DD" only when they give a day.
- neighborhood: only San Francisco neighborhoods they name as places they'd consider living, using these slugs: ${neighborhoodList}. Map everyday names: "the Mission" = mission, "Outer Sunset" or "the Sunset" = sunset-parkside, "SoMa" = south-of-market, "Dogpatch" = potrero-hill, "NoPa" = western-addition, "the Haight" = haight-ashbury. Skip places outside these, and places they only work in or visit.
- transport: modes from ${TRANSPORT_MODES.map((m) => m.id).join(", ")} that they'll use to get around ("N Judah", "the bus" and "streetcar" are muni). Include "car" only if they'll have one. Set carFree true only when they say they won't have a car.
- schedule: workHours ${WORK_HOURS.map((w) => w.id).join(" | ")}, workplace ${WORKPLACES.map((w) => w.id).join(" | ")} (only if they say), weekendsFree false only if they say they work weekends. Propose a schedule only when they say something about work hours or where they work.
- employer: the company or school by the name they use, only if they name it. workArea only if they say where it is.
- interest: activities they say they do or enjoy, using these ids. Map synonyms ("boulder" = climbing, "board game nights" = board_games). Skip anything with no close match:
${interestList}
- goal: ${GOALS.map((g) => `${g.id} (${g.label.toLowerCase()})`).join(", ")}. Only when they say what they want from the move.

Never turn who someone is into a fact: no age, gender, ethnicity, nationality, religion, health, family or relationship status, and no interest stood in for one (a cultural or faith group is not an interest). If the text has nothing usable, return { "facts": [] }.`;

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

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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
      else if (!text.includes(quote))
        problems.push(`${at}.quote "${f.quote}" isn't copied exactly from the text`);
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
        case "moveIn":
          if (!MONTH.test(e.value.month)) problems.push(`${at}: month must be "YYYY-MM"`);
          else if (e.value.month < input.today.slice(0, 7))
            problems.push(`${at}: move-in month is before today (${input.today})`);
          if (
            e.value.date !== undefined &&
            (!DATE.test(e.value.date) || !e.value.date.startsWith(e.value.month))
          )
            problems.push(`${at}: date must be "YYYY-MM-DD" inside the month`);
          break;
        case "transport":
          if (e.value.modes.length === 0 && !f.carFree)
            problems.push(`${at}: transport needs at least one mode`);
          if (f.carFree && e.value.modes.includes("car"))
            problems.push(`${at}: carFree but modes include car`);
          break;
        case "employer":
          if (!text.includes(loose(e.value.name)))
            problems.push(`${at}: employer "${e.value.name}" isn't named in the text`);
          break;
        default:
          break;
      }
    });
    return problems;
  },
  fallback: (input) => ({
    facts: extractFacts(input.text, Date.parse(`${input.today}T12:00:00Z`)).map((p) => ({
      entry: p.entry,
      quote: p.quote,
      ...(p.carFree ? { carFree: true } : {}),
    })),
  }),
  // Short text in, short JSON out: keep it quick for an onboarding form.
  effort: "low",
  maxAttempts: 2,
});
