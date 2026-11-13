import { moveInLabel, neighborhoodLabel } from "../../../convex/lib/cityProfileFacts";
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
