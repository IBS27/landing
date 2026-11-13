import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewActivity } from "./checkIns";
import { daysSince } from "./lib/checkIns";
import { resolveSources } from "./lib/citations";
import { type CityProfile, getProfile } from "./lib/cityProfile";
import { isCalendarDate, todayInSF } from "./lib/cityProfileFacts";
import { crewOptIn } from "./lib/crewMembers";
import { crewProfile, usableAnchors } from "./lib/crews";
import { viewerQuery } from "./lib/functions";
import {
  daysBetween,
  moveInOf,
  moveOutOf,
  NEEDS,
  type Need,
  type PlaceFacts,
  pickSteps,
  type StepInput,
  stageOf,
} from "./lib/homeTimeline";
import { moveInStart } from "./lib/journeys";
import { currentPlace } from "./lib/myPlace";
import { neighborhoodDef } from "./lib/neighborhoods";
import type { Audience } from "./lib/posts";
import { waitingProposals } from "./lib/proposals";
import { checkInText, draftsText, upcomingReminders } from "./lib/reminders";
import { MAX_ROOMS } from "./lib/vibe";

/**
 * Landing Home (#142): the viewer's move timeline. Their stage, the one next
 * step and a few more (rules in `./lib/homeTimeline.ts`), and what's coming
 * up: Events they're going to, this week's check-in and Inbox drafts.
 *
 * Reads only the viewer's own rows, through indexes and with bounds, and
 * only what the stage's rules use. No AI, so it's the same with AI off.
 */

/** Newest saves read for saved rentals. */
const SAVED_SCAN = 50;
/** Saved listings checked for a live rental. */
const SAVED_CHECK = 10;
/** Owned items counted; the steps only need "none" and how many are unlisted. */
const ITEMS_SCAN = 51;
/** Sublets read for the place (one per listing it was sublet from). */
const SUBLETS_SCAN = 5;
/** Unit scenes without a listing read for a place found elsewhere (rooms' plus its own). */
const UNITS_SCAN = MAX_ROOMS + 10;
/** Events shown under "Coming up". */
const EVENTS_SHOWN = 3;

/**
 * The day the timeline counts from: the client's San Francisco date (so the
 * countdown rolls over at midnight without a data change), when it's a real
 * date within a day of the server's; otherwise the server's.
 */
function pickToday(asked: string | undefined, now: number): string {
  const server = todayInSF(now);
  if (!asked || !isCalendarDate(asked)) return server;
  return Math.abs(daysBetween(server, asked)) <= 1 ? asked : server;
}

async function visibleListing(ctx: QueryCtx, a: Audience, id: Id<"listings">) {
  const seen = await resolveSources(ctx, [{ kind: "listing", listingId: id }], a);
  return seen.length > 0 ? await ctx.db.get(id) : null;
}

async function placeFacts(ctx: QueryCtx, a: Audience, p: Doc<"places">): Promise<PlaceFacts> {
  const [n, listing] = await Promise.all([
    ctx.db.get(p.neighborhoodId),
    p.listingId ? visibleListing(ctx, a, p.listingId) : null,
  ]);
  return {
    status: p.status,
    moveIn: p.moveIn,
    moveOut: p.moveOut ?? null,
    neighborhood: n ? { slug: n.slug, name: n.shortName ?? n.name } : null,
    listingTitle: listing?.title ?? null,
  };
}

/** Rentals the viewer saved and can still see, newest first (only the newest is needed). */
async function savedRentals(ctx: QueryCtx, a: Audience): Promise<StepInput["saved"]> {
  const saves = await ctx.db
    .query("saved")
    .withIndex("by_user", (q) => q.eq("userId", a.viewerId))
    .order("desc")
    .take(SAVED_SCAN);
  let count = 0;
  let newest: { listingId: Id<"listings">; title: string } | null = null;
  for (const s of saves.filter((s) => s.kind === "listing").slice(0, SAVED_CHECK)) {
    const id = ctx.db.normalizeId("listings", s.refId);
    const l = id ? await visibleListing(ctx, a, id) : null;
    const type = l?.rental?.listingType;
    if (!l || l.status === "sold" || l.sellerId === a.viewerId) continue;
    if (type !== "rent" && type !== "sublet") continue;
    count++;
    newest ??= { listingId: l._id, title: l.title };
  }
  return { count, newest };
}

async function crewFacts(ctx: QueryCtx, profile: CityProfile): Promise<StepInput["crew"]> {
  const row = await crewOptIn(ctx, profile.userId);
  const usable = usableAnchors(
    crewProfile(profile, { month: true, neighborhood: true, employer: true }),
  );
  return {
    optedIn: row !== null,
    canJoin:
      profile.briefCompletedAt !== null && (usable.month || usable.neighborhood || usable.employer),
  };
}

/** Rooms in this place: added while it was current, or before any place was set (as My Place counts them). */
async function roomCount(ctx: QueryCtx, userId: Id<"users">, place: Doc<"places">) {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_ROOMS);
  return rooms.filter((r) => r.listingId === undefined || r.listingId === place.listingId).length;
}

/** Whether the place has a 3D unit: its listing's, or for a place found elsewhere, one started from neither. */
async function hasUnit(ctx: QueryCtx, userId: Id<"users">, place: Doc<"places">) {
  const units = await ctx.db
    .query("unitScenes")
    .withIndex("by_owner_listing", (q) => q.eq("ownerId", userId).eq("listingId", place.listingId))
    .take(place.listingId ? 1 : UNITS_SCAN);
  return place.listingId ? units.length > 0 : units.some((u) => !u.roomId);
}

async function itemFacts(ctx: QueryCtx, userId: Id<"users">): Promise<StepInput["items"]> {
  const rows = await ctx.db
    .query("ownedItems")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(ITEMS_SCAN);
  let unlisted = 0;
  // A sale listing that was deleted no longer counts as listed.
  for (const r of rows) if (!r.saleListingId || !(await ctx.db.get(r.saleListingId))) unlisted++;
  return { total: rows.length, unlisted };
}

/** Mover quotes (#28): whether the viewer has asked movers for quotes. */
async function moverFacts(ctx: QueryCtx, userId: Id<"users">): Promise<StepInput["movers"]> {
  const req = await ctx.db
    .query("moveRequests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return { requested: req?.requestedAt !== undefined };
}

/**
 * Whether the viewer listed a sublet from this place (#141), and it's still
 * up or already subleased.
 */
async function hasSublet(ctx: QueryCtx, userId: Id<"users">, place: Doc<"places">) {
  const rows = await ctx.db
    .query("sublets")
    .withIndex("by_place", (q) => q.eq("placeId", place._id))
    .take(SUBLETS_SCAN);
  for (const s of rows) if (s.ownerId === userId && (await ctx.db.get(s.listingId))) return true;
  return false;
}

/**
 * This week's check-in (#33), once the Journeys job has written it: the
 * same week and wording as its "Your check-in is ready" notification, with
 * the counts Journeys shows.
 */
async function checkInFacts(
  ctx: QueryCtx,
  a: Audience,
  profile: CityProfile,
  now: number,
): Promise<StepInput["checkIn"]> {
  if (profile.briefCompletedAt === null || !profile.moveIn) return null;
  const moveInAt = moveInStart(profile.moveIn.value);
  if (now < moveInAt) return null;
  const [row] = await ctx.db
    .query("journeys")
    .withIndex("by_user_week", (q) => q.eq("userId", profile.userId))
    .order("desc")
    .take(1);
  if (!row?.checkIn || row.endsAt <= now) return null;
  // Counted as Journeys shows them now: un-RSVPs, leaves, unfriends and blocks drop out.
  const total = await viewActivity(ctx, a, row.checkIn.total);
  return {
    week: row.week,
    text: checkInText(daysSince(moveInAt, now), {
      events: total.events.length,
      groups: total.groups.length,
      friends: total.friends.length,
    }),
  };
}

export const timeline = viewerQuery({
  args: { today: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = ctx.viewer._id;
    const today = pickToday(args.today, now);
    const [profile, place, waiting] = await Promise.all([
      getProfile(ctx, ctx.viewer),
      currentPlace(ctx, userId),
      waitingProposals(ctx, userId, now),
    ]);
    const a = waiting.audience;
    const briefDone = profile.briefCompletedAt !== null;
    const facts = place ? await placeFacts(ctx, a, place) : null;
    const stage = stageOf({ today, briefDone, place: facts });

    const need = new Set<Need>(NEEDS[stage]);
    const when = <T>(n: Need, load: () => Promise<T>) =>
      need.has(n) ? load() : Promise.resolve(undefined);
    const [saved, crew, rooms, unit, movers, items, sublet, checkIn, events] = await Promise.all([
      when("saved", () => savedRentals(ctx, a)),
      when("crew", () => crewFacts(ctx, profile)),
      when("rooms", async () => (place ? roomCount(ctx, userId, place) : undefined)),
      when("unit", async () => (place ? hasUnit(ctx, userId, place) : undefined)),
      when("movers", () => moverFacts(ctx, userId)),
      when("items", () => itemFacts(ctx, userId)),
      when("sublet", async () => (place ? hasSublet(ctx, userId, place) : undefined)),
      checkInFacts(ctx, a, profile, now),
      upcomingReminders(ctx, userId, now, EVENTS_SHOWN),
    ]);

    const input: StepInput = {
      today,
      briefDone,
      place: facts,
      plannedMoveIn: profile.moveIn?.value ?? null,
      neighborhoods: profile.neighborhoods.slice(0, 2).map((f) => {
        const n = neighborhoodDef(f.value.slug);
        return { slug: n.slug, name: n.short ?? n.name };
      }),
      saved,
      crew,
      rooms,
      unit,
      movers,
      checkIn,
      items,
      sublet,
    };
    const { nextStep, alsoSteps } = pickSteps(stage, input);
    const checkInStep = [nextStep, ...alsoSteps].some((s) => s?.id === "checkIn");
    const drafts = waiting.rows.length;
    return {
      today,
      stage,
      place: facts,
      moveIn: moveInOf(input),
      moveOut: moveOutOf(input),
      nextStep,
      alsoSteps,
      comingUp: {
        events: events.map((e) => ({ ...e.event, remindAt: e.remindAt, via: e.via })),
        checkIn: checkInStep ? null : (checkIn ?? null),
        drafts: drafts > 0 ? { count: drafts, text: draftsText(drafts) } : null,
      },
    };
  },
});
