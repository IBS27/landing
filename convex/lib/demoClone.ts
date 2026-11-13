import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { insertCityProfile } from "../seed/cityProfiles";
import { cityProfileSeeds } from "../seed/world/cityProfiles";
import { crewOptInSeeds } from "../seed/world/crews";
import { groups as groupSeeds } from "../seed/world/groups";
import { neighborhoodGroups } from "../seed/world/neighborhoods/groups";
import { roommateLifestyles } from "../seed/world/roommateLifestyles";

/**
 * The starting persona every demo user is cloned from: Sofia Alvarez, an ER
 * nurse moving within San Francisco in two months, before she has a place.
 *
 * What a clone gets (and nothing else):
 * - Her public Facebook profile fields (photo, cover, bio, work, school,
 *   hometown), under the name "Sofia (guest)" and a fresh username.
 * - Her City Profile brief and its stated facts (budget, move-in month,
 *   neighborhoods, transport, schedule, employer, interests, goals), built from
 *   the seed definition as of now, so it never picks up anyone's edits to the
 *   shared Sofia, nor a place.
 * - Her Move-in Crew opt-in and roommate lifestyle answers, from the seed.
 * - Her friends, as one-way friendships from the clone to the seeded people
 *   Sofia is friends with: the clone sees them, they never see the clone.
 * - Plain membership of the Groups she belongs to in the seed (never her
 *   moderator role).
 *
 * Never copied: chats, drafts, negotiations, proposals, places, rooms, unit
 * scenes, owned items, saved items, RSVPs, posts, activity signals or vouches.
 */
export const TEMPLATE_USERNAME = "sofia.alvarez";
export const DEMO_NAME = "Sofia (guest)";

/** Friendships read from the template; plenty for one person's friends. */
const FRIENDS_MAX = 200;

const isTemplateMember = (g: {
  admins: readonly string[];
  moderators?: readonly string[];
  members: readonly string[];
}) => [...g.admins, ...(g.moderators ?? []), ...g.members].includes(TEMPLATE_USERNAME);

/** Seed Group slugs the template belongs to. */
export const TEMPLATE_GROUP_SLUGS: readonly string[] = [...groupSeeds, ...neighborhoodGroups]
  .filter(isTemplateMember)
  .map((g) => g.slug);

function randomSuffix() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function freeUsername(ctx: MutationCtx) {
  for (;;) {
    const username = `guest.${randomSuffix()}`;
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (!taken) return username;
  }
}

/** Makes a new demo user from the template. Throws if the seed isn't loaded. */
export async function cloneTemplate(ctx: MutationCtx, now: number): Promise<Id<"users">> {
  const template = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", TEMPLATE_USERNAME))
    .unique();
  if (!template) throw new ConvexError("The demo isn't set up yet. Seed the database first.");

  const userId = await ctx.db.insert("users", {
    name: DEMO_NAME,
    firstName: template.firstName,
    username: await freeUsername(ctx),
    avatar: template.avatar,
    cover: template.cover,
    bio: template.bio,
    pronouns: template.pronouns,
    city: template.city,
    hometown: template.hometown,
    work: template.work,
    education: template.education,
    relationship: template.relationship,
    verified: false,
    joinedAt: now,
    lastActiveAt: now,
    isPersona: false,
    kind: "person",
    isDemo: true,
  });
  const user = (await ctx.db.get(userId)) as Doc<"users">;

  const profile = cityProfileSeeds.find((s) => s.username === TEMPLATE_USERNAME);
  if (profile) await insertCityProfile(ctx, user, profile, now);

  const crew = crewOptInSeeds.find((s) => s.username === TEMPLATE_USERNAME);
  if (crew)
    await ctx.db.insert("crewOptIns", {
      userId,
      matchBy: crew.matchBy,
      createdAt: now,
      updatedAt: now,
      demo: true,
    });

  const lifestyle = roommateLifestyles.find((s) => s.username === TEMPLATE_USERNAME);
  if (lifestyle)
    await ctx.db.insert("roommateLifestyles", {
      userId,
      answers: lifestyle.answers,
      shared: lifestyle.shared,
      sharedAt: lifestyle.shared ? now : undefined,
      updatedAt: now,
    });

  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_user", (q) => q.eq("userId", template._id))
    .take(FRIENDS_MAX);
  for (const f of friendships) {
    const friend = await ctx.db.get(f.friendId);
    if (!friend || friend.isDemo) continue;
    await ctx.db.insert("friendships", { userId, friendId: friend._id, createdAt: now });
  }

  for (const slug of TEMPLATE_GROUP_SLUGS) {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!group) continue;
    await ctx.db.insert("groupMembers", {
      groupId: group._id,
      userId,
      role: "member",
      joinedAt: now,
    });
    await ctx.db.patch(group._id, { memberCount: group.memberCount + 1 });
  }
  return userId;
}
