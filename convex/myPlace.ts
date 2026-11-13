import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getProfile, syncStatedFact } from "./lib/cityProfile";
import {
  type FactEvidence,
  type NeighborhoodSlug,
  neighborhoodSlug,
  todayInSF,
} from "./lib/cityProfileFacts";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  canSeeListing,
  currentPlace,
  type PlaceStatus,
  placeProblem,
  placeStatus,
} from "./lib/myPlace";
import { isNeighborhoodSlug } from "./lib/neighborhoods";

/**
 * My place (#132): the apartment the person chose, set from a rental on
 * Landing ("I'm taking this place") or added by hand when they found it
 * elsewhere. One current place per person; the ones they've left are history.
 *
 * Private: every function reads and writes only the viewer's own rows. The
 * lister is never notified, and nothing here is shown on maps, crews, Journeys
 * or to anyone else. The only address shown is the listing's public title.
 *
 * The City Profile gets a stated "Lives in" fact and the move-in date from the
 * current place (source "Your place"), never overriding what the person said.
 */

const PLACE_EVIDENCE: FactEvidence = { kind: "place", summary: "Your place" };
const PAST_SHOWN = 20;

/* ---------------- Reading ---------------- */

async function neighborhoodView(ctx: QueryCtx, id: Id<"neighborhoods">) {
  const n = await ctx.db.get(id);
  return n ? { slug: n.slug, name: n.shortName ?? n.name } : null;
}

/** The listing as its public page shows it, or null when the owner can no longer see it. */
async function listingView(ctx: QueryCtx, userId: Id<"users">, id: Id<"listings"> | undefined) {
  if (!id || !(await canSeeListing(ctx, userId, id))) return null;
  const l = await ctx.db.get(id);
  if (!l) return null;
  return {
    _id: l._id,
    title: l.title,
    price: l.price,
    photo: l.photos[0] ?? null,
    bedrooms: l.rental?.bedrooms ?? null,
    bathrooms: l.rental?.bathrooms ?? null,
  };
}

async function placeView(ctx: QueryCtx, userId: Id<"users">, p: Doc<"places">) {
  const [neighborhood, listing] = await Promise.all([
    neighborhoodView(ctx, p.neighborhoodId),
    listingView(ctx, userId, p.listingId),
  ]);
  return {
    _id: p._id,
    status: p.status,
    moveIn: p.moveIn,
    moveOut: p.moveOut ?? null,
    neighborhood,
    listing,
    /** Taken from a listing the owner can no longer see. */
    listingGone: p.listingId !== undefined && listing === null,
    createdAt: p.createdAt,
  };
}

/**
 * The viewer's place with links to its rooms and 3D unit, and the places they
 * moved out of, newest first.
 */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.viewer._id;
    const [current, all] = await Promise.all([
      currentPlace(ctx, userId),
      ctx.db
        .query("places")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(PAST_SHOWN + 1),
    ]);
    const past = await Promise.all(
      all
        .filter((p) => p.endedAt !== undefined)
        .slice(0, PAST_SHOWN)
        .map((p) => placeView(ctx, userId, p)),
    );
    if (!current) return { current: null, past };
    const view = await placeView(ctx, userId, current);
    const listingId = view.listing?._id;
    const [rooms, unit] = await Promise.all([
      ctx.db
        .query("rooms")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      listingId
        ? ctx.db
            .query("unitScenes")
            .withIndex("by_owner_listing", (q) =>
              q.eq("ownerId", userId).eq("listingId", listingId),
            )
            .first()
        : null,
    ]);
    return {
      current: {
        ...view,
        // Rooms in this place: added while it was current, or before any place was set.
        rooms: rooms
          .filter((r) => r.listingId === undefined || r.listingId === current.listingId)
          .map((r) => ({ _id: r._id, name: r.name })),
        unit: unit ? { _id: unit._id, title: unit.scene.title } : null,
      },
      past,
    };
  },
});

/** Whether this listing is the viewer's current place, for "I'm taking this place". */
export const isMine = viewerQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const p = await currentPlace(ctx, ctx.viewer._id);
    return p?.listingId === listingId;
  },
});

/* ---------------- Writing ---------------- */

/** Keeps the City Profile's "Lives in" and move-in facts in step with the current place. */
async function syncProfile(ctx: MutationCtx, userId: Id<"users">) {
  const place = await currentPlace(ctx, userId);
  const n = place ? await ctx.db.get(place.neighborhoodId) : null;
  await syncStatedFact(
    ctx,
    userId,
    "home",
    n && isNeighborhoodSlug(n.slug) ? { key: "home", value: { slug: n.slug } } : null,
    PLACE_EVIDENCE,
  );
  await syncStatedFact(
    ctx,
    userId,
    "moveIn",
    place
      ? { key: "moveIn", value: { month: place.moveIn.slice(0, 7), date: place.moveIn } }
      : null,
    PLACE_EVIDENCE,
  );
}

function check(p: { status: PlaceStatus; moveIn: string; moveOut?: string }) {
  const problem = placeProblem(p, todayInSF());
  if (problem) throw new ConvexError(problem);
}

/**
 * Makes a new place current. One the person was only moving into is replaced
 * (they changed their mind); one they lived in moves to history as moved out.
 */
async function setPlace(
  ctx: MutationCtx,
  userId: Id<"users">,
  next: { listingId?: Id<"listings">; neighborhoodId: Id<"neighborhoods">; moveIn: string },
): Promise<Id<"places">> {
  check({ status: "moving_in", moveIn: next.moveIn });
  const now = Date.now();
  const prev = await currentPlace(ctx, userId);
  if (prev?.status === "moving_in") await ctx.db.delete(prev._id);
  else if (prev) {
    const today = todayInSF(now);
    const left = next.moveIn < today ? next.moveIn : today;
    await ctx.db.patch(prev._id, {
      status: "moved_out",
      moveOut: prev.moveOut ?? (left < prev.moveIn ? prev.moveIn : left),
      endedAt: now,
      updatedAt: now,
    });
  }
  const id = await ctx.db.insert("places", {
    userId,
    ...next,
    status: "moving_in",
    createdAt: now,
    updatedAt: now,
  });
  await syncProfile(ctx, userId);
  return id;
}

async function neighborhoodBySlug(ctx: QueryCtx, slug: NeighborhoodSlug) {
  const n = await ctx.db
    .query("neighborhoods")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!n || n.park) throw new ConvexError("Pick the neighborhood your place is in");
  return n;
}

/** "I'm taking this place": a rental on Landing becomes the viewer's place. The lister isn't told. */
export const takeListing = viewerMutation({
  args: { listingId: v.id("listings"), moveIn: v.string() },
  handler: async (ctx, { listingId, moveIn }) => {
    const userId = ctx.viewer._id;
    const listing = (await canSeeListing(ctx, userId, listingId))
      ? await ctx.db.get(listingId)
      : null;
    if (!listing) throw new ConvexError("This listing isn't available");
    const type = listing.rental?.listingType;
    if (type !== "rent" && type !== "sublet")
      throw new ConvexError("Only a rental can be your place");
    if (listing.sellerId === userId) throw new ConvexError("This is your own listing");
    if (!listing.neighborhoodId)
      throw new ConvexError(
        "This listing isn't in a San Francisco neighborhood we know. Add it on My Place instead.",
      );
    const prev = await currentPlace(ctx, userId);
    if (prev?.listingId === listingId) {
      // Already their place: only the move-in date can change here.
      if (prev.moveIn !== moveIn) await updatePlace(ctx, prev, { moveIn });
      return prev._id;
    }
    return setPlace(ctx, userId, {
      listingId,
      neighborhoodId: listing.neighborhoodId,
      moveIn,
    });
  },
});

/** "Add the place I found": a place found elsewhere, by neighborhood and move-in date only. */
export const addFound = viewerMutation({
  args: { neighborhood: neighborhoodSlug, moveIn: v.string() },
  handler: async (ctx, { neighborhood, moveIn }) => {
    const n = await neighborhoodBySlug(ctx, neighborhood);
    return setPlace(ctx, ctx.viewer._id, { neighborhoodId: n._id, moveIn });
  },
});

async function ownPlace(ctx: QueryCtx, userId: Id<"users">, placeId: Id<"places">) {
  const p = await ctx.db.get(placeId);
  if (!p || p.userId !== userId) throw new ConvexError("Place not found");
  return p;
}

type Change = {
  status?: PlaceStatus;
  moveIn?: string;
  moveOut?: string | null;
  neighborhoodId?: Id<"neighborhoods">;
};

async function updatePlace(ctx: MutationCtx, p: Doc<"places">, change: Change) {
  const status = change.status ?? p.status;
  const moveIn = change.moveIn ?? p.moveIn;
  let moveOut = change.moveOut === null ? undefined : (change.moveOut ?? p.moveOut);
  // Marking it moved out without a date: they left today.
  if (status === "moved_out" && moveOut === undefined) moveOut = todayInSF();
  check({ status, moveIn, moveOut });
  const now = Date.now();
  await ctx.db.patch(p._id, {
    status,
    moveIn,
    moveOut,
    ...(change.neighborhoodId ? { neighborhoodId: change.neighborhoodId } : {}),
    ...(status === "moved_out" ? { endedAt: now } : {}),
    updatedAt: now,
  });
  await syncProfile(ctx, p.userId);
}

/**
 * Changes the current place: its status, dates, or (for a place found
 * elsewhere) its neighborhood. Moved out makes it history. `moveOut: null`
 * clears a planned move-out.
 */
export const update = viewerMutation({
  args: {
    placeId: v.id("places"),
    status: v.optional(placeStatus),
    moveIn: v.optional(v.string()),
    moveOut: v.optional(v.union(v.string(), v.null())),
    neighborhood: v.optional(neighborhoodSlug),
  },
  handler: async (ctx, { placeId, neighborhood, ...change }) => {
    const p = await ownPlace(ctx, ctx.viewer._id, placeId);
    if (p.endedAt !== undefined) throw new ConvexError("You've moved out of this place");
    if (neighborhood && p.listingId)
      throw new ConvexError("This place's neighborhood comes from its listing");
    const neighborhoodId = neighborhood
      ? (await neighborhoodBySlug(ctx, neighborhood))._id
      : undefined;
    await updatePlace(ctx, p, { ...change, neighborhoodId });
  },
});

/** Clears a place: the current one, or one from history. Its City Profile facts go with it. */
export const remove = viewerMutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    await ownPlace(ctx, ctx.viewer._id, placeId);
    await ctx.db.delete(placeId);
    await syncProfile(ctx, ctx.viewer._id);
  },
});

/* ---------------- Seed ---------------- */

/** Maya took a Mission rental and is moving in, on the date in her brief. */
export const seedDemo = internalMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const maya = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "maya.chen"))
      .unique();
    const listing = await ctx.db.get(listingId);
    if (!maya || !listing?.neighborhoodId) return;
    const brief = (await getProfile(ctx, maya._id)).moveIn?.value;
    const now = Date.now();
    await ctx.db.insert("places", {
      userId: maya._id,
      listingId,
      neighborhoodId: listing.neighborhoodId,
      moveIn: brief ? (brief.date ?? `${brief.month}-01`) : todayInSF(now),
      status: "moving_in",
      createdAt: now,
      updatedAt: now,
    });
    await syncProfile(ctx, maya._id);
  },
});
