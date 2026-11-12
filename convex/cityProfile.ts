import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { runAgent } from "./ai/agent";
import { getProfile, type StatedFact, saveStatedFacts } from "./lib/cityProfile";
import {
  budgetValue,
  type FactEntry,
  type FactEvidence,
  type FactKey,
  factEntry,
  factSlot,
  goalId,
  moveInValue,
  neighborhoodSlug,
  scheduleValue,
  transportValue,
} from "./lib/cityProfileFacts";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { interestId } from "./lib/interests";
import { profileFromText } from "./lib/profileFromText";
import { MAX_TEXT_LENGTH, proposalLabel } from "./lib/profileText";

/**
 * Landing City Profile (#3). Other features read profiles with `getProfile`
 * from `./lib/cityProfile` inside their own functions; the client reads its own
 * with `cityProfile.get`.
 */

/** The viewer's City Profile. */
export const get = viewerQuery({
  args: {},
  handler: (ctx) => getProfile(ctx, ctx.viewer),
});

/** The onboarding brief: the structured form every person can fill without AI. */
const brief = v.object({
  budget: budgetValue,
  moveIn: moveInValue,
  neighborhoods: v.array(neighborhoodSlug),
  transport: transportValue,
  schedule: scheduleValue,
  employer: v.optional(v.object({ name: v.string(), workArea: v.optional(v.string()) })),
  interests: v.array(interestId),
  goals: v.array(goalId),
});

const BRIEF_KEYS: readonly FactKey[] = [
  "budget",
  "moveIn",
  "neighborhood",
  "transport",
  "schedule",
  "employer",
  "interest",
  "goal",
];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function check(ok: boolean, message: string) {
  if (!ok) throw new ConvexError(message);
}

/**
 * Saves the brief as stated facts. `fromText` marks the facts the person
 * confirmed from their own words ("Tell us about you"), keyed by fact slot,
 * so the profile can show that quote as the evidence.
 */
export const saveBrief = viewerMutation({
  args: {
    brief,
    fromText: v.optional(v.array(v.object({ slot: v.string(), quote: v.string() }))),
  },
  handler: async (ctx, { brief: b, fromText }) => {
    check(
      b.budget.max >= 300 && b.budget.max <= 20000,
      "Budget should be between $300 and $20,000 a month",
    );
    check(
      b.budget.min === undefined || (b.budget.min >= 0 && b.budget.min <= b.budget.max),
      "The low end of your budget should be below the high end",
    );
    check(MONTH.test(b.moveIn.month), "Pick a move-in month");
    check(
      b.moveIn.date === undefined ||
        (DATE.test(b.moveIn.date) && b.moveIn.date.startsWith(b.moveIn.month)),
      "Move-in date doesn't match the month",
    );
    check(b.transport.modes.length > 0, "Pick at least one way of getting around");
    check(
      b.interests.length <= 25 && b.neighborhoods.length <= 10 && b.goals.length <= 10,
      "That's too many to save",
    );
    const employerName = b.employer?.name.trim().slice(0, 80);
    const workArea = b.employer?.workArea?.trim().slice(0, 80) || undefined;

    const entries: FactEntry[] = [
      { key: "budget", value: b.budget },
      { key: "moveIn", value: b.moveIn },
      { key: "transport", value: { modes: [...new Set(b.transport.modes)] } },
      { key: "schedule", value: b.schedule },
      ...(employerName
        ? [
            {
              key: "employer" as const,
              value: workArea ? { name: employerName, workArea } : { name: employerName },
            },
          ]
        : []),
      ...[...new Set(b.neighborhoods)].map((slug) => ({
        key: "neighborhood" as const,
        value: { slug },
      })),
      ...[...new Set(b.interests)].map((id) => ({ key: "interest" as const, value: { id } })),
      ...[...new Set(b.goals)].map((id) => ({ key: "goal" as const, value: { id } })),
    ];

    const quotes = new Map((fromText ?? []).map((q) => [q.slot, q.quote.trim().slice(0, 200)]));
    const facts: StatedFact[] = entries.map((entry) => {
      const quote = quotes.get(factSlot(entry));
      const evidence: FactEvidence = quote
        ? { kind: "free_text", summary: "From what you wrote about yourself", quote }
        : { kind: "brief", summary: "You said so in your brief" };
      return { entry, evidence };
    });
    await saveStatedFacts(ctx, ctx.viewer._id, BRIEF_KEYS, facts, { completeBrief: true });
    return getProfile(ctx, ctx.viewer);
  },
});

const proposal = v.object({
  entry: factEntry,
  quote: v.string(),
  label: v.string(),
  carFree: v.optional(v.boolean()),
});

/** Today in San Francisco, "YYYY-MM-DD" (en-CA formats dates that way). */
function todayInSF() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

/**
 * "Tell us about you": Muse proposes facts from free text, each with the
 * words it came from (`muse.profileFromText` on #8's `runAgent`). Saves
 * nothing; the person confirms what's right and the brief saves it. `via`
 * says who answered: the model, a cached model answer, or the rules-based
 * fallback when AI is off or the model's answer didn't pass its checks.
 */
export const suggestFromText = action({
  // Viewer-scoped like the rest of the app: the result is for this person only.
  args: { viewerId: v.id("users"), text: v.string() },
  returns: v.object({
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    proposals: v.array(proposal),
  }),
  handler: async (ctx, { viewerId, text }) => {
    // Throws "Unknown viewer" for a bad id, before any model call.
    await ctx.runQuery(api.users.me, { viewerId });
    if (text.length > MAX_TEXT_LENGTH) {
      throw new ConvexError(`Keep it under ${MAX_TEXT_LENGTH} characters`);
    }
    const trimmed = text.trim();
    if (!trimmed) return { via: "fallback" as const, proposals: [] };
    const result = await runAgent(ctx, profileFromText, {
      input: { text: trimmed, today: todayInSF() },
      // The person's own words are the evidence; there are no shared sources to read.
      sources: [],
      shownTo: viewerId,
    });
    return {
      via: result.via,
      proposals: result.output.facts.map((f) => ({
        entry: f.entry,
        quote: f.quote,
        label: proposalLabel(f.entry, f.carFree),
        ...(f.carFree ? { carFree: true } : {}),
      })),
    };
  },
});
