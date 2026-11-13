import { ConvexError, type Infer, type ObjectType, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import type { MediaInput } from "./ai/model";
import { aiEnabled } from "./ai/status";
import { blockedSet } from "./lib/blocks";
import { resolveSources } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  dollars,
  FURNISH_LIMITS,
  furnishText,
  kindOf,
  kindsAsked,
  saysLook,
  sizeOf,
  vibeFromText,
} from "./lib/furnish";
import {
  FURNISH_TASK,
  type FurnishInput,
  type FurnishOutput,
  furnishOutput,
  furnishProblems,
  furnishTask,
  rulesFurnish,
} from "./lib/furnishTask";
import { type LayoutItem, placeItems } from "./lib/itemLayout";
import {
  colorFromText,
  type ItemModel,
  itemModel,
  itemModelProblems,
  itemModelStatus,
} from "./lib/itemModel";
import { type ItemModelInput, itemModelMediaTask, itemModelTask } from "./lib/itemModelTask";
import { approximatePoint } from "./lib/mapPins";
import { currentPlace } from "./lib/myPlace";
import { placeStatus } from "./lib/placeRules";
import { loadAudience } from "./lib/posts";
import { redactProtected } from "./lib/protectedText";
import { isStarterScene } from "./lib/unitGeneration";
import {
  area,
  ITEM_LIMITS,
  type Placement,
  type PlacementKind,
  placement,
  placementKind,
  unitScene,
  validPlacement,
} from "./lib/unitScene";
import { NOT_DECOR, rankVibeMatches } from "./lib/vibeMatch";
import { ownsListing } from "./unitItems";
import {
  createScene,
  generationInputs,
  liveJob,
  ownScene,
  placeScene,
  publicMediaUrl,
  readableSource,
  startGeneration,
} from "./unitScenes";
import { latLng } from "./validators";

/**
 * Landing Home's Apartment tab (#150): a 3D view of the place the person
 * chose, furnished from the same chat with Muse. The person chooses a rental
 * (`myPlace.takeListing`), `build` makes its unit and starts the existing 3D
 * generation (convex/unitScenes.ts), and `furnish` has Muse pick Marketplace
 * items for a vibe and a budget, places them, and starts a 3D model of each.
 * The person then moves, turns and removes items, and everything persists.
 *
 * Private: every function reads and writes only the viewer's own unit, items
 * and models. Nothing is bought, messaged or sent: items are placed in a
 * private model for the person to review. Without AI the same flow works on
 * the starter room, Landing's rules and stand-in shapes.
 */

const MAX_ITEMS = 80;
/** A `building` model row this old lost its job (jobs stop at 10 minutes). */
const MODEL_STALE_MS = 15 * 60_000;
/** Item models built by one job, how many at once, and the job's shared deadline. */
const MODELS_PER_JOB = 8;
const MODELS_AT_ONCE = 3;
const MODELS_DEADLINE_MS = 6 * 60_000;
/** Listing photos Muse reads for one model. */
const MODEL_PHOTOS = 3;
/** Newest listings scanned for candidates, as `rooms.matches` does. */
const CANDIDATE_SCAN = 400;
/** Vibe matches kept before basics fill the rest of the candidates. */
const MATCHES_KEPT = 30;
const BASICS = new Set(["furniture", "household", "garden"]);
/** Muse furnishing runs per viewer: over either limit, Landing's rules pick. */
const PER_MINUTE = 4;
const PER_HOUR = 20;
const RUNS_SCANNED = 300;
const FURNISH_DEADLINE_MS = 75_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/* ---------------- Reading ---------------- */

const unitState = v.union(
  v.literal("starter"),
  v.literal("building"),
  v.literal("ready"),
  v.literal("partial"),
  v.literal("failed"),
);
const modelStatus = v.union(v.literal("none"), itemModelStatus);
const itemView = v.object({
  /** The placement's id. */
  id: v.string(),
  listingId: v.union(v.id("listings"), v.null()),
  ownedItemId: v.union(v.id("ownedItems"), v.null()),
  title: v.string(),
  price: v.union(v.number(), v.null()),
  photo: v.union(v.string(), v.null()),
  /** A Marketplace listing that is still active and visible; always true for anything else. */
  available: v.boolean(),
  /** Muse's model as stored (fit it to the placement with `fitModel`), or null: show `proxyModel`. */
  model: v.union(itemModel, v.null()),
  modelStatus,
});
export const apartmentView = v.object({
  aiOn: v.boolean(),
  place: v.union(
    v.null(),
    v.object({
      listingId: v.union(v.id("listings"), v.null()),
      title: v.string(),
      neighborhood: v.union(v.string(), v.null()),
      moveIn: v.string(),
      status: placeStatus,
      /** Approximate, never the address: the listing's map pin area, else the neighborhood's centre. */
      point: v.union(latLng, v.null()),
    }),
  ),
  unit: v.union(
    v.null(),
    v.object({
      id: v.id("unitScenes"),
      revision: v.number(),
      scene: unitScene,
      placements: v.array(placement),
      state: unitState,
      /** The live build job, for `api.ai.jobs.get`. */
      jobId: v.union(v.id("aiJobs"), v.null()),
      explanation: v.union(v.string(), v.null()),
      /** AI is on and Muse can read at least one of the unit's photos, plans or videos. */
      canBuild: v.boolean(),
      furnishing: v.union(
        v.null(),
        v.object({ vibe: v.string(), budget: v.union(v.number(), v.null()) }),
      ),
    }),
  ),
  items: v.array(itemView),
  /** Prices of placed, still-available Marketplace listings the person doesn't already own. */
  spent: v.number(),
});
export type ApartmentView = Infer<typeof apartmentView>;
export type ApartmentItem = Infer<typeof itemView>;

/** The listings among `ids` the owner may see (not deleted, hidden or blocked), by id. */
async function visibleListings(ctx: QueryCtx, ownerId: Id<"users">, ids: Id<"listings">[]) {
  const out = new Map<Id<"listings">, Doc<"listings">>();
  if (!ids.length) return out;
  const seen = await resolveSources(
    ctx,
    [...new Set(ids)].map((listingId) => ({ kind: "listing" as const, listingId })),
    await loadAudience(ctx, ownerId),
  );
  for (const s of seen) {
    const l = s.kind === "listing" ? await ctx.db.get(s.listingId) : null;
    if (l) out.set(l._id, l);
  }
  return out;
}

/**
 * The viewer's place and its unit. The unit is the scene made from the
 * place's listing. A place found elsewhere, or one whose listing the viewer
 * can no longer see, uses their most recently updated scene that belongs to
 * neither a room nor a listing (`placeScene`).
 */
async function viewerUnit(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<{
  place: Doc<"places"> | null;
  listing: Doc<"listings"> | null;
  unit: Doc<"unitScenes"> | null;
}> {
  const place = await currentPlace(ctx, ownerId);
  if (!place) return { place: null, listing: null, unit: null };
  const listing = place.listingId
    ? ((await visibleListings(ctx, ownerId, [place.listingId])).get(place.listingId) ?? null)
    : null;
  return { place, listing, unit: await placeScene(ctx, ownerId, listing?._id) };
}

function modelRow(ctx: QueryCtx, ownerId: Id<"users">, listingId: Id<"listings">) {
  return ctx.db
    .query("itemModels")
    .withIndex("by_owner_listing", (q) => q.eq("ownerId", ownerId).eq("listingId", listingId))
    .first();
}

/**
 * What is placed in a unit, as the owner may see it now, and what it costs. A
 * listing the owner can no longer see keeps only its saved label: no photo,
 * price or model. Reads are bounded by the 80-item limit.
 */
async function placedItems(ctx: QueryCtx, ownerId: Id<"users">, placements: Placement[]) {
  const visible = await visibleListings(
    ctx,
    ownerId,
    placements.flatMap((p) => (p.listingId ? [p.listingId] : [])),
  );
  const now = Date.now();
  const counted = new Set<Id<"listings">>();
  let spent = 0;
  const items: ApartmentItem[] = [];
  for (const p of placements) {
    const base = { id: p.id, listingId: null, ownedItemId: null, title: p.label, price: null };
    const none = { photo: null, available: true, model: null, modelStatus: "none" as const };
    if (p.listingId) {
      const l = visible.get(p.listingId);
      if (!l) {
        items.push({ ...base, ...none, listingId: p.listingId, available: false });
        continue;
      }
      const available = l.status === "active";
      if (
        available &&
        !counted.has(l._id) &&
        l.sellerId !== ownerId &&
        !(await ownsListing(ctx, ownerId, l._id))
      )
        spent += l.price;
      counted.add(l._id);
      const row = await modelRow(ctx, ownerId, l._id);
      const status =
        row?.status === "building" && now - row.updatedAt > MODEL_STALE_MS ? "failed" : row?.status;
      items.push({
        id: p.id,
        listingId: l._id,
        ownedItemId: null,
        title: l.title,
        price: l.price,
        photo: l.photos[0] ?? null,
        available,
        model: status === "ready" ? (row?.model ?? null) : null,
        modelStatus: status ?? "none",
      });
    } else if (p.ownedItemId) {
      const item = await ctx.db.get(p.ownedItemId);
      const mine = item?.userId === ownerId ? item : null;
      items.push({
        ...base,
        ...none,
        ownedItemId: p.ownedItemId,
        title: mine?.title ?? p.label,
        price: mine?.price ?? null,
        photo: mine?.photos[0] ?? null,
      });
    } else items.push({ ...base, ...none });
  }
  return { items, spent };
}

/**
 * Where a unit's build stands. `starter`: the example room, nothing built.
 * `building`: a job is running (the scene may already hold the layout).
 * `failed`: a build ended without a layout. `partial`: a layout without all
 * its finishes. `ready`: everything else, a hand-edited scene included.
 */
function stateOf(doc: Doc<"unitScenes">, building: boolean): Infer<typeof unitState> {
  if (building) return "building";
  const status = doc.generation?.status;
  if (isStarterScene(doc.scene))
    return status === "failed" || status === "layout" ? "failed" : "starter";
  return status === "partial" || status === "layout" || status === "details" ? "partial" : "ready";
}

/** Whether Muse could build this unit now: AI is on and it can read some of the unit's media. */
async function canBuild(ctx: QueryCtx, doc: Doc<"unitScenes">) {
  return aiEnabled() && (await generationInputs(ctx, doc)).sources.some(readableSource);
}

/** The viewer's place, its 3D unit and what is placed in it. */
export const get = viewerQuery({
  args: {},
  returns: apartmentView,
  handler: async (ctx): Promise<ApartmentView> => {
    const ownerId = ctx.viewer._id;
    const { place, listing, unit } = await viewerUnit(ctx, ownerId);
    if (!place) return { aiOn: aiEnabled(), place: null, unit: null, items: [], spent: 0 };
    const hood = await ctx.db.get(place.neighborhoodId);
    const name = hood ? (hood.shortName ?? hood.name) : null;
    const lat = listing?.location.lat,
      lng = listing?.location.lng;
    const live = unit ? await liveJob(ctx, unit) : null;
    const { items, spent } = unit
      ? await placedItems(ctx, ownerId, unit.placements)
      : { items: [], spent: 0 };
    return {
      aiOn: aiEnabled(),
      place: {
        listingId: listing?._id ?? null,
        title: listing?.title ?? (name ? `Your place in ${name}` : "Your place"),
        neighborhood: name,
        moveIn: place.moveIn,
        status: place.status,
        point:
          listing && lat !== undefined && lng !== undefined
            ? approximatePoint(listing._id, { lat, lng })
            : (hood?.center ?? null),
      },
      unit: unit && {
        id: unit._id,
        revision: unit.revision,
        scene: unit.scene,
        placements: unit.placements,
        state: stateOf(unit, !!live),
        jobId: live?._id ?? null,
        explanation: unit.explanation ?? null,
        canBuild: await canBuild(ctx, unit),
        furnishing: unit.furnishing
          ? { vibe: unit.furnishing.vibe, budget: unit.furnishing.budget ?? null }
          : null,
      },
      items,
      spent,
    };
  },
});

/* ---------------- Building ---------------- */

/**
 * Makes the unit for the viewer's place if it has none, and starts its 3D
 * build when nothing has been built or tried yet, AI is on and Muse can read
 * some of its media. Safe to call again: it never starts a second build and
 * never fails for want of media (the tab then shows the starter room). A
 * failed build is retried with `unitScenes.requestGeneration`.
 */
export const build = viewerMutation({
  args: {},
  returns: v.id("unitScenes"),
  handler: async (ctx): Promise<Id<"unitScenes">> => {
    const ownerId = ctx.viewer._id;
    const { place, listing, unit } = await viewerUnit(ctx, ownerId);
    if (!place) throw new ConvexError("Choose your place first");
    const doc =
      unit ?? (await ctx.db.get(await createScene(ctx, ownerId, { listingId: listing?._id })));
    if (!doc) throw new ConvexError("Unit not found");
    if (
      isStarterScene(doc.scene) &&
      !doc.generation &&
      doc.manuallyEdited !== true &&
      (await canBuild(ctx, doc))
    )
      await startGeneration(ctx, doc);
    return doc._id;
  },
});

/* ---------------- Items ---------------- */

/** The editor's id format (src/landing/move-in/unit/id.ts): a label, never authorization. */
function itemId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

/** A Marketplace listing that can furnish a home: active, not a rental, vehicle or pet. */
const placeable = (l: Doc<"listings">) =>
  l.status === "active" && !l.rental && !NOT_DECOR.has(l.category);

type ListingPick = {
  listing: Doc<"listings">;
  kind: PlacementKind;
  room?: string;
  width: number;
  depth: number;
  height: number;
};

/**
 * Lays the picks out in the unit, saves them, and starts their 3D models.
 * Bumps `revision` (so an open editor's stale save is refused) and leaves the
 * scene and any build in flight untouched.
 */
async function placeListings(
  ctx: MutationCtx,
  doc: Doc<"unitScenes">,
  picks: ListingPick[],
  patch: { furnishing?: Doc<"unitScenes">["furnishing"] } = {},
): Promise<Placement[]> {
  const items: LayoutItem[] = picks.map((p) => ({
    id: itemId(),
    kind: p.kind,
    width: p.width,
    depth: p.depth,
    height: p.height,
    ...(p.room ? { room: p.room } : {}),
    label: p.listing.title.trim().slice(0, 120) || "Item",
    listingId: p.listing._id,
    color: colorFromText(p.listing.title),
  }));
  const placed = placeItems(doc.scene, doc.placements, items);
  if (!placed.length && !Object.keys(patch).length) return placed;
  const revision = doc.revision + (placed.length ? 1 : 0);
  await ctx.db.patch(doc._id, {
    ...patch,
    ...(placed.length
      ? { placements: [...doc.placements, ...placed], revision, updatedAt: Date.now() }
      : {}),
  });
  await startModels(ctx, doc, revision, placed);
  return placed;
}

/** Marks each placed listing without a model as `building` and starts one job for them. */
async function startModels(
  ctx: MutationCtx,
  doc: Doc<"unitScenes">,
  revision: number,
  placed: Placement[],
) {
  // Without AI there is nothing to build: the tab keeps showing stand-in shapes.
  if (!aiEnabled()) return;
  const now = Date.now();
  const items: Infer<typeof modelItem>[] = [];
  for (const p of placed.slice(0, MODELS_PER_JOB)) {
    if (!p.listingId) continue;
    const row = await modelRow(ctx, doc.ownerId, p.listingId);
    if (row?.status === "ready") continue;
    if (row?.status === "building" && now - row.updatedAt <= MODEL_STALE_MS) continue;
    const fields = { kind: p.kind, status: "building" as const, updatedAt: now };
    if (row) await ctx.db.patch(row._id, { ...fields, error: undefined });
    else
      await ctx.db.insert("itemModels", {
        ownerId: doc.ownerId,
        listingId: p.listingId,
        ...fields,
        createdAt: now,
      });
    items.push({
      listingId: p.listingId,
      kind: p.kind,
      width: p.width,
      depth: p.depth,
      height: p.height,
    });
  }
  if (!items.length) return;
  await startJob(ctx, {
    kind: "itemModels",
    // One job per change to the unit, so a later one never waits behind an earlier one.
    key: `${doc._id}:${revision}`,
    userId: doc.ownerId,
    action: internal.apartment.buildModels,
    args: { ownerId: doc.ownerId, items },
  });
}

/** Moves or turns one item (called at the end of a drag). Returns the unit's revision. */
export const moveItem = viewerMutation({
  args: {
    unitId: v.id("unitScenes"),
    itemId: v.string(),
    x: v.number(),
    z: v.number(),
    rotation: v.number(),
    /** Height of the base above the floor, metres; left out, it stays as it was. */
    y: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, { unitId, itemId: id, x, z, rotation, y }) => {
    const doc = await ownScene(ctx, unitId, ctx.viewer._id);
    const at = doc.placements.findIndex((p) => p.id === id);
    if (at < 0) throw new ConvexError("Item not found");
    const { y: was, ...old } = doc.placements[at];
    const height = y ?? was ?? 0;
    const next: Placement = { ...old, x, z, rotation, ...(height === 0 ? {} : { y: height }) };
    if (!validPlacement(next)) throw new ConvexError("Invalid item position");
    if (old.x === x && old.z === z && old.rotation === rotation && (was ?? 0) === height)
      return doc.revision;
    const revision = doc.revision + 1;
    await ctx.db.patch(unitId, {
      placements: doc.placements.map((p, i) => (i === at ? next : p)),
      revision,
      updatedAt: Date.now(),
    });
    return revision;
  },
});

/** Takes one item out of the unit. Returns the unit's revision. */
export const removeItem = viewerMutation({
  args: { unitId: v.id("unitScenes"), itemId: v.string() },
  returns: v.number(),
  handler: async (ctx, { unitId, itemId: id }) => {
    const doc = await ownScene(ctx, unitId, ctx.viewer._id);
    const placements = doc.placements.filter((p) => p.id !== id);
    if (placements.length === doc.placements.length) return doc.revision;
    const revision = doc.revision + 1;
    await ctx.db.patch(unitId, { placements, revision, updatedAt: Date.now() });
    return revision;
  },
});

/**
 * Places one Marketplace listing in the unit where the layout finds room, and
 * starts its 3D model. Returns the placement's id (the one it already has
 * when the listing is placed).
 */
export const addItem = viewerMutation({
  args: { unitId: v.id("unitScenes"), listingId: v.id("listings") },
  returns: v.string(),
  handler: async (ctx, { unitId, listingId }) => {
    const ownerId = ctx.viewer._id;
    const doc = await ownScene(ctx, unitId, ownerId);
    const already = doc.placements.find((p) => p.listingId === listingId);
    if (already) return already.id;
    const listing = (await visibleListings(ctx, ownerId, [listingId])).get(listingId);
    if (!listing || !placeable(listing)) throw new ConvexError("This listing isn't available");
    if (listing.sellerId === ownerId) throw new ConvexError("This is your own listing");
    if (doc.placements.length >= MAX_ITEMS) throw new ConvexError(`At most ${MAX_ITEMS} items`);
    const kind = kindOf(listing) ?? "decor";
    const [placed] = await placeListings(ctx, doc, [{ listing, kind, ...sizeOf(kind, listing) }]);
    return placed.id;
  },
});

/* ---------------- Furnishing ---------------- */

export const furnishReply = v.object({
  text: v.string(),
  via: v.union(v.literal("muse"), v.literal("rules")),
  items: v.array(
    v.object({
      /** The new placement's id. */
      itemId: v.string(),
      listingId: v.id("listings"),
      title: v.string(),
      price: v.number(),
      photo: v.union(v.string(), v.null()),
      kind: placementKind,
      reason: v.string(),
    }),
  ),
  /** What this call's items cost, what is placed in all, and the total budget. */
  total: v.number(),
  spent: v.number(),
  budget: v.union(v.number(), v.null()),
  /** Each picked listing, "Title · $X", linking to its Marketplace page. */
  sources: v.array(v.object({ label: v.string(), href: v.optional(v.string()) })),
});
export type FurnishReply = Infer<typeof furnishReply>;

const cap = (text: string, max: number) => redactProtected(text.trim().slice(0, max));

const contextArgs = {
  viewerId: v.id("users"),
  vibe: v.string(),
  budget: v.optional(v.number()),
};

/**
 * Everything one furnishing reads, for the viewer only and with bounded
 * reads: their unit and what is in it, the vibe and budget (typed now, else
 * remembered), the rate limit, and the Marketplace candidates.
 */
export const context = internalQuery({
  args: contextArgs,
  handler: (ctx, a) => furnishContext(ctx, a),
});

type FurnishContext =
  | { ready: false; text: string; spent: number; budget: number | null }
  | {
      ready: true;
      unitId: Id<"unitScenes">;
      input: FurnishInput;
      limited: boolean;
      /** The vibe and total budget to remember. */
      vibe: string;
      budget: number | null;
      spent: number;
    };

export async function furnishContext(
  ctx: QueryCtx,
  a: ObjectType<typeof contextArgs>,
): Promise<FurnishContext> {
  const viewerId = a.viewerId;
  if (!(await ctx.db.get(viewerId))) throw new ConvexError("Unknown viewer");
  const { place, unit } = await viewerUnit(ctx, viewerId);
  const wait = (text: string, spent = 0, budget: number | null = null): FurnishContext => ({
    ready: false,
    text,
    spent,
    budget,
  });
  if (!place) return wait("Choose your place first, and I can furnish it.");
  if (!unit)
    return wait(
      "Your apartment model isn't ready yet. Open the Apartment tab to build it, then ask again.",
    );
  const { items, spent } = await placedItems(ctx, viewerId, unit.placements);
  const budget = a.budget ?? unit.furnishing?.budget ?? null;
  // The starter room is furnished only when no build is running or still to come
  // (AI off, no media Muse can read, or a build that failed): the flow works without AI.
  if (isStarterScene(unit.scene)) {
    if (await liveJob(ctx, unit))
      return wait(
        "Your apartment model is still being built. Ask again once it's ready.",
        spent,
        budget,
      );
    if (!unit.generation && unit.manuallyEdited !== true && (await canBuild(ctx, unit)))
      return wait(
        "Your apartment model isn't ready yet. Open the Apartment tab to build it, then ask again.",
        spent,
        budget,
      );
  }

  // "Add a lamp" names things and "furnish it" says nothing: both keep the remembered look.
  const typed = cap(a.vibe, FURNISH_LIMITS.vibeMax);
  const asked = kindsAsked(typed);
  const vibe = !asked.length && saysLook(typed) ? typed : (unit.furnishing?.vibe ?? "");
  const remaining = budget === null ? null : Math.max(0, budget - spent);

  const now = Date.now();
  const runs = await ctx.db
    .query("aiRuns")
    .withIndex("by_user", (q) => q.eq("userId", viewerId).gte("createdAt", now - HOUR))
    .order("desc")
    .take(RUNS_SCANNED);
  const mine = runs.filter((r) => r.task === FURNISH_TASK);
  const limited =
    mine.length >= PER_HOUR || mine.filter((r) => r.createdAt >= now - MINUTE).length >= PER_MINUTE;

  const [blocked, recent] = await Promise.all([
    blockedSet(ctx, viewerId),
    ctx.db.query("listings").withIndex("by_created").order("desc").take(CANDIDATE_SCAN),
  ]);
  const here = new Set(unit.placements.map((p) => p.listingId));
  const pool = recent.filter(
    (l) =>
      placeable(l) &&
      l.sellerId !== viewerId &&
      !blocked.has(l.sellerId) &&
      !here.has(l._id) &&
      (remaining === null || l.price <= remaining),
  );
  // Best vibe matches first, then furniture and household basics, newest first.
  const ranked = rankVibeMatches(
    vibeFromText(vibe),
    pool.map((l) => ({
      id: l._id,
      title: l.title,
      description: l.description,
      createdAt: l.createdAt,
    })),
  ).map((m) => m.id);
  const order = [
    ...ranked.slice(0, MATCHES_KEPT),
    ...pool.filter((l) => BASICS.has(l.category)).map((l) => l._id as string),
    ...ranked.slice(MATCHES_KEPT),
  ];
  const byId = new Map(pool.map((l) => [l._id as string, l]));
  // What the viewer can't see (a deleted seller) never reaches Muse: check twice the cap, keep the cap.
  const shortlist = [...new Set(order)]
    .slice(0, FURNISH_LIMITS.candidatesMax * 2)
    .flatMap((id) => byId.get(id) ?? []);
  const visible = await visibleListings(
    ctx,
    viewerId,
    shortlist.map((l) => l._id),
  );
  const chosen = shortlist.filter((l) => visible.has(l._id)).slice(0, FURNISH_LIMITS.candidatesMax);

  const input: FurnishInput = {
    vibe,
    asked,
    budget: budget === null ? null : { total: budget, spent, remaining: remaining ?? 0 },
    rooms: unit.scene.rooms.map((r) => ({
      id: r.id,
      name: cap(r.name, 80),
      area: Math.round(area(r.polygon) * 10) / 10,
    })),
    placed: unit.placements.map((p, i) => ({
      kind: p.kind,
      label: cap(p.label, 120),
      price: items[i].price,
    })),
    candidates: chosen.map((l) => ({
      key: `listing:${l._id}`,
      id: l._id,
      title: cap(l.title, 120),
      price: l.price,
      category: l.category,
      condition: l.condition ?? null,
      description: cap(l.description, 200),
    })),
  };
  return { ready: true, unitId: unit._id, input, limited, vibe, budget, spent };
}

const pick = furnishOutput.fields.picks.element;

/**
 * Places Muse's (or the rules') picks, after checking each again: still a
 * visible, active listing that isn't the viewer's own or already placed, a
 * valid size, and inside the budget that is left. Remembers the vibe and
 * budget on the unit. The only write `furnish` makes.
 */
export const place = internalMutation({
  args: {
    viewerId: v.id("users"),
    unitId: v.id("unitScenes"),
    vibe: v.string(),
    budget: v.optional(v.number()),
    picks: v.array(pick),
  },
  handler: async (ctx, { viewerId, unitId, vibe, budget, picks }) => {
    const doc = await ownScene(ctx, unitId, viewerId);
    const before = await placedItems(ctx, viewerId, doc.placements);
    const visible = await visibleListings(
      ctx,
      viewerId,
      picks.map((p) => p.listingId),
    );
    const here = new Set(doc.placements.map((p) => p.listingId));
    const rooms = new Set(doc.scene.rooms.map((r) => r.id));
    let left = budget === undefined ? Number.POSITIVE_INFINITY : budget - before.spent;
    const ok = (n: number) => Number.isFinite(n) && n >= ITEM_LIMITS.min && n <= ITEM_LIMITS.max;
    const accepted: (ListingPick & { reason: string })[] = [];
    for (const p of picks.slice(0, FURNISH_LIMITS.picksMax)) {
      const listing = visible.get(p.listingId);
      if (
        !listing ||
        !placeable(listing) ||
        listing.sellerId === viewerId ||
        here.has(listing._id) ||
        listing.price > left ||
        doc.placements.length + accepted.length >= MAX_ITEMS
      )
        continue;
      here.add(listing._id);
      left -= listing.price;
      const size = [p.width, p.depth, p.height].every(ok) ? p : sizeOf(p.kind, listing);
      accepted.push({
        listing,
        kind: p.kind,
        width: size.width,
        depth: size.depth,
        height: size.height,
        ...(p.room && rooms.has(p.room) ? { room: p.room } : {}),
        reason: p.reason.trim().slice(0, FURNISH_LIMITS.reasonMax),
      });
    }
    const placed = await placeListings(ctx, doc, accepted, {
      furnishing: { vibe, ...(budget === undefined ? {} : { budget }) },
    });
    const items = accepted.map((a, i) => ({
      itemId: placed[i].id,
      listingId: a.listing._id,
      title: a.listing.title,
      price: a.listing.price,
      photo: a.listing.photos[0] ?? null,
      kind: a.kind,
      reason: a.reason,
    }));
    return { items, spent: before.spent + items.reduce((sum, i) => sum + i.price, 0) };
  },
});

const furnishArgs = {
  viewerId: v.id("users"),
  /** The look the person described, or the things they asked for. Empty reuses the remembered vibe. */
  vibe: v.string(),
  /** The furniture budget for the whole apartment, in dollars. Left out, the remembered one applies. */
  budget: v.optional(v.number()),
};

/**
 * Furnishes the viewer's apartment from Marketplace for a vibe and a total
 * budget: Muse picks, or Landing's rules when AI is off, the answer is
 * rejected or the viewer is over the rate limit. The picks are placed in the
 * private 3D model for the person to review; nothing is bought or sent.
 */
export const furnish = action({
  args: furnishArgs,
  returns: furnishReply,
  handler: (ctx, a): Promise<FurnishReply> => furnishApartment(ctx, a),
});

/** `furnish`'s handler. */
export async function furnishApartment(
  ctx: ActionCtx,
  a: ObjectType<typeof furnishArgs>,
): Promise<FurnishReply> {
  if (a.vibe.length > FURNISH_LIMITS.vibeMax * 4) throw new ConvexError("Vibe too long");
  if (
    a.budget !== undefined &&
    !(Number.isFinite(a.budget) && a.budget >= 0 && a.budget <= FURNISH_LIMITS.budgetMax)
  )
    throw new ConvexError("A furniture budget is a dollar amount");
  const c: FurnishContext = await ctx.runQuery(internal.apartment.context, {
    viewerId: a.viewerId,
    vibe: a.vibe,
    ...(a.budget === undefined ? {} : { budget: Math.round(a.budget) }),
  });
  if (!c.ready)
    return {
      text: c.text,
      via: "rules",
      items: [],
      total: 0,
      spent: c.spent,
      budget: c.budget,
      sources: [],
    };

  let out: FurnishOutput = rulesFurnish(c.input);
  let via: FurnishReply["via"] = "rules";
  if (!c.limited && c.input.candidates.length) {
    const r = await runAgent(ctx, furnishTask, {
      input: c.input,
      // Only the redacted fields in `input`; raw listing text stays out of the model.
      sources: [],
      shownTo: a.viewerId,
      deadline: Date.now() + FURNISH_DEADLINE_MS,
    });
    // `runAgent` already checked the answer; check again so nothing unchecked is placed.
    if (r.via !== "fallback" && furnishProblems(r.output, c.input).length === 0) {
      out = r.output;
      via = "muse";
    }
  }

  const placed: { items: FurnishReply["items"]; spent: number } = await ctx.runMutation(
    internal.apartment.place,
    {
      viewerId: a.viewerId,
      unitId: c.unitId,
      vibe: c.vibe,
      ...(c.budget === null ? {} : { budget: c.budget }),
      picks: out.picks,
    },
  );
  const total = placed.items.reduce((sum, i) => sum + i.price, 0);
  return {
    // Muse's words only when everything it picked was placed; otherwise say what was.
    text:
      via === "muse" && placed.items.length === out.picks.length
        ? redactProtected(out.text.trim())
        : furnishText({
            count: placed.items.length,
            vibe: c.vibe,
            total,
            budget: c.budget === null ? null : { total: c.budget, spent: c.spent },
          }),
    via,
    items: placed.items,
    total,
    spent: placed.spent,
    budget: c.budget,
    sources: placed.items.map((i) => ({
      label: `${i.title.slice(0, 120)} · ${dollars(i.price)}`,
      href: `/marketplace/item/${i.listingId}`,
    })),
  };
}

/* ---------------- Item models ---------------- */

const modelItem = v.object({
  listingId: v.id("listings"),
  kind: placementKind,
  width: v.number(),
  depth: v.number(),
  height: v.number(),
});

/** What Muse reads to model one listing, or null when its owner can no longer see it. */
export const modelContext = internalQuery({
  args: { ownerId: v.id("users"), item: modelItem },
  handler: async (
    ctx,
    { ownerId, item },
  ): Promise<{ input: ItemModelInput; media: MediaInput[] } | null> => {
    const l = (await visibleListings(ctx, ownerId, [item.listingId])).get(item.listingId);
    if (!l) return null;
    return {
      input: {
        title: cap(l.title, 120),
        category: l.category,
        condition: l.condition ?? null,
        description: cap(l.description, 600),
        kind: item.kind,
        size: { width: item.width, depth: item.depth, height: item.height },
      },
      // Seed photos are local paths Muse can't read, so most models come from the words alone.
      media: l.photos
        .filter(publicMediaUrl)
        .slice(0, MODEL_PHOTOS)
        .map((url, i) => ({ key: `photo-${i + 1}`, kind: "image" as const, url })),
    };
  },
});

/** Stores a finished model, or marks the row failed so the tab keeps its stand-in shape. */
export const saveModel = internalMutation({
  args: {
    ownerId: v.id("users"),
    listingId: v.id("listings"),
    model: v.optional(itemModel),
    error: v.optional(v.string()),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, { ownerId, listingId, model, error, runId }) => {
    const row = await modelRow(ctx, ownerId, listingId);
    if (!row) return;
    const problems = model ? itemModelProblems(model) : [];
    const ready = !!model && !problems.length;
    await ctx.db.patch(row._id, {
      status: ready ? "ready" : "failed",
      model: ready ? model : undefined,
      error: ready ? undefined : (error ?? problems[0] ?? "No model").slice(0, 300),
      ...(runId ? { runId } : {}),
      updatedAt: Date.now(),
    });
  },
});

/**
 * The job behind `furnish` and `addItem`: models each listing with Muse, a
 * few at a time under one deadline. A rejected, failed or disabled run stores
 * no model, so the tab keeps showing the stand-in shape.
 */
export const buildModels = internalAction({
  args: { ownerId: v.id("users"), items: v.array(modelItem), jobId: v.id("aiJobs") },
  returns: v.null(),
  handler: async (ctx, { ownerId, items, jobId }): Promise<null> => {
    const queue = items.slice(0, MODELS_PER_JOB);
    const total = queue.length;
    const deadline = Date.now() + MODELS_DEADLINE_MS;
    await runJob(ctx, jobId, async (progress) => {
      let done = 0;
      const one = async (item: Infer<typeof modelItem>) => {
        const save = (fields: { model?: ItemModel; error?: string; runId?: Id<"aiRuns"> }) =>
          ctx.runMutation(internal.apartment.saveModel, {
            ownerId,
            listingId: item.listingId,
            ...fields,
          });
        try {
          const c = await ctx.runQuery(internal.apartment.modelContext, { ownerId, item });
          if (!c) await save({ error: "Listing is unavailable" });
          else {
            const r = await runAgent(ctx, c.media.length ? itemModelMediaTask : itemModelTask, {
              input: c.input,
              media: c.media,
              sources: [],
              // Private: listing photos are read for this owner only.
              shownTo: ownerId,
              jobId,
              deadline,
            });
            await save(
              r.via === "fallback"
                ? { error: `Muse couldn't model this item (${r.fallbackReason})`, runId: r.runId }
                : { model: r.output, runId: r.runId },
            );
          }
        } catch (error) {
          await save({ error: error instanceof Error ? error.message : "Modelling failed" });
        }
        await progress(`Modelling ${++done} of ${total}`, done, total);
      };
      const workers = Array.from({ length: Math.min(MODELS_AT_ONCE, total) }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) await one(item);
      });
      await Promise.all(workers);
    });
    return null;
  },
});
