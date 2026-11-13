import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveSources } from "./citations";
import { loadAudience } from "./posts";

/**
 * My place: the apartment a person chose (`places` table, convex/myPlace.ts).
 * Private to its owner: read it only with the owner's own id, never to show
 * someone else, never on maps, crews or Journeys, and never to notify the lister.
 * Statuses and date rules are in `./placeRules.ts`, which the client can import.
 */

/**
 * The person's current place, or null. The helper every feature uses to
 * know where someone lives (move-out, Home timeline). Call it only with the
 * viewer's own id.
 */
export async function currentPlace(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"places"> | null> {
  return ctx.db
    .query("places")
    .withIndex("by_user_current", (q) => q.eq("userId", userId).eq("endedAt", undefined))
    .first();
}

/** Whether the owner may still see a listing (not deleted, hidden or blocked). */
export async function canSeeListing(
  ctx: QueryCtx,
  userId: Id<"users">,
  listingId: Id<"listings">,
): Promise<boolean> {
  const seen = await resolveSources(
    ctx,
    [{ kind: "listing", listingId }],
    await loadAudience(ctx, userId),
  );
  return seen.length > 0;
}

/**
 * The rental new rooms and 3D units start from: the current place's listing,
 * while the owner can still see it.
 */
export async function placeListingId(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Id<"listings"> | undefined> {
  const listingId = (await currentPlace(ctx, userId))?.listingId;
  return listingId && (await canSeeListing(ctx, userId, listingId)) ? listingId : undefined;
}

/** Marketplace chats read when counting a sublet's renters. */
const SUBLET_CHATS_MAX = 100;

/**
 * The newest sublet the owner listed from this place (#141), with its
 * listing's state, or null. Call it only with the place owner's id.
 */
export async function placeSublet(ctx: QueryCtx, userId: Id<"users">, placeId: Id<"places">) {
  const rows = await ctx.db
    .query("sublets")
    .withIndex("by_place", (q) => q.eq("placeId", placeId))
    .collect();
  const s = rows.filter((r) => r.ownerId === userId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const listing = s ? await ctx.db.get(s.listingId) : null;
  if (!s || !listing) return null;
  const chats = await ctx.db
    .query("conversations")
    .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
    .take(SUBLET_CHATS_MAX);
  return {
    _id: s._id,
    listingId: listing._id,
    title: listing.title,
    rent: listing.price,
    /** active: listed; pending: a renter is lined up; sold: subleased. */
    status: listing.status,
    chats: chats.length,
  };
}
