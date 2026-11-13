import { moveInLabel, neighborhoodLabel } from "../../../convex/lib/cityProfileFacts";
import {
  type DealbreakerResult,
  fieldTopic,
  type MatchField,
  type TraitComparison,
} from "../../../convex/lib/lifestyle";
import type { Overlap } from "../../../convex/lib/roommates";

/** Wording for roommate candidates (#22). Pure, so it's unit-tested. */

/** "A", "A and B", "A, B and C". */
function list(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const month = (m: string) => moveInLabel({ month: m });

/** Names to link and how many others to count: "Jordan, Priya and 3 others". */
export function namesShown<T>(people: readonly T[], total: number) {
  const shown = people.slice(0, 2);
  return { shown, others: Math.max(total - shown.length, 0) };
}

/** "Also moving in March 2027 · Mission · Budgets overlap", or null when nothing overlaps. */
export function overlapLine(o: Overlap): string | null {
  const hoods = list(o.neighborhoods.map(neighborhoodLabel));
  const parts = [
    o.moveInMonth && `Also moving in ${month(o.moveInMonth)}`,
    hoods && (o.moveInMonth ? hoods : `Also looking at ${hoods}`),
    o.budget && "Budgets overlap",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The editable first message for "Ask to connect". Mentions only plans both
 * people stated, and never a budget.
 */
export function askMessage(firstName: string, o: Overlap): string {
  const hoods = list(o.neighborhoods.map(neighborhoodLabel));
  const plans = o.moveInMonth
    ? `I'm also moving in ${month(o.moveInMonth)}${hoods ? `, and we both have ${hoods} on our list` : ""}. `
    : hoods
      ? `We both have ${hoods} on our list. `
      : "";
  return `Hi ${firstName}! I saw you on Landing's roommate matching. ${plans}Want to chat about finding a place together?`;
}

/* ---------- Compatibility (#23) ---------- */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One difference as a topic and the two answers: "Quiet hours" and
 * "You: 10pm · Tasha: 11pm". Budgets never show amounts: "Your budgets don't overlap".
 */
export function differenceLine(
  t: TraitComparison,
  firstName: string,
): { topic: string; detail: string } {
  const topic = capitalize(fieldTopic(t.field));
  if (!t.a || !t.b) return { topic, detail: t.sentence };
  return { topic, detail: `You: ${t.a.label} · ${firstName}: ${t.b.label}` };
}

/**
 * `Your dealbreaker "Dogs": Leo answered "Dog" for pets`, or the candidate's
 * dealbreaker that the viewer's answer hits.
 */
export function dealbreakerLine(d: DealbreakerResult, firstName: string): string {
  const topic = fieldTopic(d.field);
  const answer = d.answer ? `"${d.answer.label}"` : "";
  return d.holder === "a"
    ? `Your dealbreaker "${d.label}": ${firstName} answered ${answer} for ${topic}`
    : `${firstName}'s dealbreaker "${d.label}": you answered ${answer} for ${topic}`;
}

/** The viewer's dealbreaker the candidate didn't answer. */
export function uncheckedLine(d: DealbreakerResult, firstName: string): string {
  return `Your dealbreaker "${d.label}" couldn't be checked: ${firstName} didn't answer ${fieldTopic(d.field)}.`;
}

/** "sleep schedule, quiet hours and 3 more" style list of topics. */
export function topicsLine(fields: readonly MatchField[]): string {
  return list(fields.map(fieldTopic));
}

/** "85% match", or "No score yet". */
export function scoreText(score: number | null): string {
  return score === null ? "No score yet" : `${score}% match`;
}
