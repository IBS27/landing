import { plural } from "@/lib/format";
import type { NetworkVouch, Relation } from "../../../convex/lib/vouches";
import type { VouchRelationship } from "../../../convex/validators";

/** Wording for network vouching. Pure, so it's unit-tested. */

type Person = { name: string; firstName: string };

/** Choices in the vouch dialog, in the voucher's words. */
export const RELATIONSHIP_OPTIONS: readonly { value: VouchRelationship; label: string }[] = [
  { value: "rented_from", label: "I rented from them" },
  { value: "lived_with", label: "We lived together" },
  { value: "worked_with", label: "We work or worked together" },
  { value: "bought_sold", label: "I bought or sold something with them" },
  { value: "know_personally", label: "I know them personally" },
];

/** How the voucher knows the subject: "Rented from Derek". */
export function relationshipLine(r: VouchRelationship, subject: Person) {
  const first = subject.firstName;
  switch (r) {
    case "rented_from":
      return `Rented from ${first}`;
    case "lived_with":
      return `Lived with ${first}`;
    case "worked_with":
      return `Worked with ${first}`;
    case "bought_sold":
      return `Bought or sold with ${first}`;
    case "know_personally":
      return `Knows ${first} personally`;
  }
}

/** "Dev", "Dev and Priya", "Dev, Priya and 3 others". `total` counts people not listed. */
export function nameList(people: readonly { firstName: string }[], total = people.length) {
  const names = people.slice(0, 2).map((p) => p.firstName);
  const others = total - names.length;
  if (others > 0) return `${names.join(", ")} and ${plural(others, "other")}`;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names[0] ?? "";
}

/** The viewer's connection to the lister, in one line. */
export function relationLine(
  relation: Relation,
  lister: Person,
  mutual: readonly { firstName: string }[],
  mutualCount: number,
  /** Not every friendship or block could be checked. */
  partial = false,
) {
  switch (relation) {
    case "you":
      return "This is your listing";
    case "friend":
      return mutualCount > 0
        ? `${lister.firstName} is your friend · ${plural(mutualCount, "mutual friend")}`
        : `${lister.firstName} is your friend`;
    case "friend_of_friend":
      return `Friends with ${nameList(mutual, mutualCount)}`;
    case "none":
      return partial
        ? `No mutual friends found with ${lister.firstName}`
        : `No one in your network is friends with ${lister.firstName}`;
  }
}

/** How the voucher is connected to the viewer. */
export function viaLine(v: Pick<NetworkVouch, "via" | "bridges" | "bridgeCount">) {
  switch (v.via) {
    case "you":
      return "You";
    case "friend":
      return "Your friend";
    case "friend_of_friend":
      return `Friend of ${nameList(v.bridges, v.bridgeCount)}`;
    case "other":
      return "Not in your network";
  }
}

/** Header for the vouch list. When `partial`, an empty list isn't proof there are none. */
export function vouchesTitle(relation: Relation, count: number, partial = false) {
  if (relation === "you") {
    if (count) return `${plural(count, "person vouches", "people vouch")} for you`;
    return partial ? "No vouches found" : "No vouches yet";
  }
  if (count) return `${plural(count, "vouch", "vouches")} from your network`;
  return partial ? "No vouches found in your network" : "No vouches from your network";
}

/** Shown under the card when not everything could be checked. */
export const PARTIAL_NOTICE =
  "Not everyone could be checked, so some vouches or connections may be missing.";
