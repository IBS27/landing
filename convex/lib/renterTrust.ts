import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasProtected } from "./protectedText";
import { isNewAccount } from "./trust";
import { type UserSummary, userSummary } from "./users";
import { listerNetwork } from "./vouches";

/**
 * Renter trust (#141): what a sublet's lister can know about a renter who
 * wrote to them, from facts Landing already shows elsewhere: identity
 * verified, vouches from the lister's network (#12), mutual friends, mutual
 * Groups and time on Facebook. Each fact carries its sources (people or
 * Groups the lister can open).
 *
 * Never a protected trait: facts are counts, a verified flag and a join date,
 * and a Group whose name or description mentions a protected trait is left
 * out. Everything is read from the lister's side (`listerNetwork` is
 * block-aware), and only the lister ever sees it.
 */

/** Memberships read per person when looking for Groups in common. */
export const GROUP_SCAN_MAX = 500;
/** People or Groups listed as a fact's sources. */
export const SOURCES_SHOWN = 3;

export type TrustSource =
  | { kind: "person"; user: UserSummary }
  | { kind: "group"; name: string; slug: string };

export type RenterFact = {
  key: "identity" | "friends" | "vouches" | "mutual_friends" | "mutual_groups" | "tenure";
  /** Plain text with no names: also what Muse reads. */
  text: string;
  /** Where it comes from, in words ("Their Facebook profile"). */
  sourceLabel: string;
  sources: TrustSource[];
};

const DAY = 24 * 60 * 60 * 1000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Groups both people are in, without any that mention a protected trait. */
async function mutualGroups(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const [mine, theirs] = await Promise.all(
    [a, b].map((userId) =>
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(GROUP_SCAN_MAX),
    ),
  );
  const theirIds = new Set(theirs.map((m) => m.groupId));
  const groups = await Promise.all(
    mine.filter((m) => theirIds.has(m.groupId)).map((m) => ctx.db.get(m.groupId)),
  );
  return groups.filter(
    (g): g is NonNullable<typeof g> => !!g && !hasProtected(g.name) && !hasProtected(g.description),
  );
}

/**
 * The renter's trust facts as `listerId` may see them, or null when either
 * has blocked the other.
 */
export async function renterTrust(
  ctx: QueryCtx,
  listerId: Id<"users">,
  renterId: Id<"users">,
  now = Date.now(),
): Promise<{ renter: UserSummary; facts: RenterFact[] } | null> {
  if (listerId === renterId) return null;
  const renter = await ctx.db.get(renterId);
  if (!renter) return null;
  const network = await listerNetwork(ctx, listerId, renterId);
  if (!network) return null;
  const groups = await mutualGroups(ctx, listerId, renterId);
  const you = userSummary(renter);
  const profile: TrustSource[] = [{ kind: "person", user: you }];
  const facts: RenterFact[] = [];

  if (renter.verified)
    facts.push({
      key: "identity",
      text: "Identity verified",
      sourceLabel: "Their Facebook profile",
      sources: profile,
    });
  if (network.relation === "friend")
    facts.push({
      key: "friends",
      text: "You're friends on Facebook",
      sourceLabel: "Your friends list",
      sources: profile,
    });
  if (network.vouchTotal > 0) {
    const byYou = network.vouches.some((v) => v.via === "you");
    facts.push({
      key: "vouches",
      text: `Vouched for by ${plural(network.vouchTotal, "person", "people")} in your network${byYou ? ", including you" : ""}`,
      sourceLabel: "Vouches on Landing",
      sources: network.vouches
        .slice(0, SOURCES_SHOWN)
        .map((v) => ({ kind: "person" as const, user: v.voucher })),
    });
  }
  if (network.mutualFriendCount > 0)
    facts.push({
      key: "mutual_friends",
      text: plural(network.mutualFriendCount, "mutual friend"),
      sourceLabel: "Your friends list",
      sources: network.mutualFriends
        .slice(0, SOURCES_SHOWN)
        .map((user) => ({ kind: "person" as const, user })),
    });
  if (groups.length > 0)
    facts.push({
      key: "mutual_groups",
      text: `In ${plural(groups.length, "Group")} with you`,
      sourceLabel: "Groups you're both in",
      sources: groups
        .slice(0, SOURCES_SHOWN)
        .map((g) => ({ kind: "group" as const, name: g.name, slug: g.slug })),
    });
  facts.push({
    key: "tenure",
    text: isNewAccount(renter, now)
      ? `Joined Facebook ${plural(Math.max(0, Math.floor((now - renter.joinedAt) / DAY)), "day")} ago`
      : `On Facebook since ${new Date(renter.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" })}`,
    sourceLabel: "Their Facebook profile",
    sources: profile,
  });
  return { renter: you, facts };
}

/** What Muse reads: each fact and where it's from, without anyone's name. */
export function factsForModel(facts: readonly RenterFact[]) {
  return facts.map((f) => ({ fact: f.text, source: f.sourceLabel }));
}
