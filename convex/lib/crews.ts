import { type Infer, v } from "convex/values";
import type { CityProfile } from "./cityProfile";
import { interestWeights } from "./cityProfile";
import type { NeighborhoodSlug } from "./cityProfileFacts";
import type { InterestId } from "./interests";

/**
 * Move-in Crew matching (#30). Pure and deterministic, so it can be tested and
 * explained. A crew is everyone else who opted in, shares at least one anchor
 * with you (the same move-in month, a neighborhood you both picked, or the same
 * employer) and at least one interest, ranked by the interests you share.
 *
 * Never protected traits: a `CrewProfile` holds only these City Profile facts
 * (#3), and the profile has no field for age, gender, ethnicity, religion,
 * health, family status or orientation. Matching can't use what it never sees.
 */

/** What a person agreed to be matched on. */
export const matchBy = v.object({
  month: v.boolean(),
  neighborhood: v.boolean(),
  employer: v.boolean(),
});
export type MatchBy = Infer<typeof matchBy>;

/** Month and neighborhoods on, employer off until the person turns it on. */
export const DEFAULT_MATCH_BY: MatchBy = { month: true, neighborhood: true, employer: false };

export const CREW_MAX = 6;
/** How much each shared anchor adds on top of the shared interests. */
const ANCHOR_WEIGHT = 0.75;

export type CrewProfile = {
  userId: string;
  /** Planned move-in month, "YYYY-MM": crews form before move day. */
  month: string | null;
  neighborhoods: NeighborhoodSlug[];
  employer: { key: string; name: string } | null;
  /** Stated interests weigh 1, inferred ones their confidence. */
  interests: Map<InterestId, number>;
  matchBy: MatchBy;
};

export type Anchor =
  | { kind: "month"; month: string }
  | { kind: "neighborhood"; slugs: NeighborhoodSlug[] }
  | { kind: "employer"; name: string };

export type CrewMatch = {
  userId: string;
  score: number;
  anchors: Anchor[];
  /** Shared interests, strongest first. */
  shared: InterestId[];
  /** The shared interests both people stated themselves (not inferred), strongest first. */
  stated: InterestId[];
};

/** "Google LLC", "google" and "Google, Inc." are one employer. */
export function employerKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A person's crew profile from their City Profile. Anchors come from what they
 * stated (never an inference), interests from stated and inferred facts.
 */
export function crewProfile(profile: CityProfile, matchBy: MatchBy): CrewProfile {
  const stated = <T extends { source: string }>(f: T | null) => (f?.source === "stated" ? f : null);
  const employer = stated(profile.employer);
  return {
    userId: profile.userId,
    month: stated(profile.moveIn)?.value.month ?? null,
    neighborhoods: profile.neighborhoods
      .filter((f) => f.source === "stated")
      .map((f) => f.value.slug),
    employer: employer
      ? { key: employerKey(employer.value.name), name: employer.value.name }
      : null,
    interests: interestWeights(profile),
    matchBy,
  };
}

/** Anchors two people share, counting only those both of them turned on. */
export function crewAnchors(a: CrewProfile, b: CrewProfile): Anchor[] {
  const out: Anchor[] = [];
  if (a.matchBy.month && b.matchBy.month && a.month && a.month === b.month)
    out.push({ kind: "month", month: a.month });
  if (a.matchBy.neighborhood && b.matchBy.neighborhood) {
    const theirs = new Set(b.neighborhoods);
    const slugs = a.neighborhoods.filter((s) => theirs.has(s));
    if (slugs.length > 0) out.push({ kind: "neighborhood", slugs });
  }
  if (a.matchBy.employer && b.matchBy.employer && a.employer && b.employer?.key === a.employer.key)
    out.push({ kind: "employer", name: a.employer.name });
  return out;
}

/** Interests both people have, with the weaker of their two weights, strongest first. */
export function sharedInterests(
  a: CrewProfile,
  b: CrewProfile,
): { id: InterestId; weight: number }[] {
  const out: { id: InterestId; weight: number }[] = [];
  for (const [id, wa] of a.interests) {
    const wb = b.interests.get(id);
    if (wb !== undefined) out.push({ id, weight: Math.min(wa, wb) });
  }
  return out.sort((x, y) => y.weight - x.weight || x.id.localeCompare(y.id));
}

/** Anchors a profile can match on at all (it has the fact and it's turned on). */
export function usableAnchors(p: Pick<CrewProfile, "month" | "neighborhoods" | "employer">) {
  return {
    month: p.month !== null,
    neighborhood: p.neighborhoods.length > 0,
    employer: p.employer !== null,
  };
}

/**
 * The viewer's crew: others who share an anchor and an interest, best first.
 * Symmetric: if B is eligible for A, A is eligible for B.
 */
export function matchCrew(viewer: CrewProfile, others: CrewProfile[], max = CREW_MAX): CrewMatch[] {
  const matches: CrewMatch[] = [];
  for (const other of others) {
    if (other.userId === viewer.userId) continue;
    const anchors = crewAnchors(viewer, other);
    if (anchors.length === 0) continue;
    const shared = sharedInterests(viewer, other);
    if (shared.length === 0) continue;
    const score = shared.reduce((s, x) => s + x.weight, 0) + ANCHOR_WEIGHT * anchors.length;
    matches.push({
      userId: other.userId,
      score: Math.round(score * 100) / 100,
      anchors,
      shared: shared.map((x) => x.id),
      // Stated interests weigh 1; anything less was inferred for one of them.
      stated: shared.filter((x) => x.weight >= 1).map((x) => x.id),
    });
  }
  return matches
    .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
    .slice(0, max);
}
