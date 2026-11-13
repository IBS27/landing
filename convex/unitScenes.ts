import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import type { MediaInput } from "./ai/model";
import { canonicalJson } from "./ai/outputSchema";
import { resolveSources } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { placeListingId } from "./lib/myPlace";
import { loadAudience } from "./lib/posts";
import { unitAppearanceTask } from "./lib/unitAppearanceTask";
import {
  isStarterScene,
  listingSources,
  refreshedSources,
  savedSceneSources,
} from "./lib/unitGeneration";
import {
  MAX_SOURCES,
  manualScene,
  type Placement,
  placement,
  sceneProblems,
  sceneSource,
  unitScene,
  validPlacement,
} from "./lib/unitScene";
import { generationStatus, unitSceneRecord } from "./lib/unitSceneRecord";
import { layoutMedia, unitSceneTask } from "./lib/unitSceneTask";

export async function accessibleListing(
  ctx: QueryCtx,
  listingId: Id<"listings">,
  ownerId: Id<"users">,
) {
  const visible = await resolveSources(
    ctx,
    [{ kind: "listing", listingId }],
    await loadAudience(ctx, ownerId),
  );
  if (!visible.length) throw new ConvexError("Listing is unavailable");
  const listing = await ctx.db.get(listingId);
  if (!listing) throw new ConvexError("Listing is unavailable");
  return listing;
}
export async function ownScene(ctx: QueryCtx, id: Id<"unitScenes">, ownerId: Id<"users">) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.ownerId !== ownerId) throw new ConvexError("Unit not found");
  if (doc.roomId) {
    const room = await ctx.db.get(doc.roomId);
    if (!room || room.userId !== ownerId) throw new ConvexError("Room is unavailable");
  }
  if (doc.listingId) await accessibleListing(ctx, doc.listingId, ownerId);
  return doc;
}
/**
 * Each placement names at most one source (#131). New references must be the
 * owner's own item or a listing they can see; references already saved stay,
 * so a placed item whose listing was later removed doesn't block saving.
 */
export async function checkPlacementSources(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  placements: Placement[],
  saved: Placement[],
) {
  const known = new Set(saved.flatMap((p) => [p.listingId, p.ownedItemId].filter(Boolean)));
  for (const p of placements) {
    if (p.listingId && p.ownedItemId) throw new ConvexError("An item has one source");
    if (p.ownedItemId && !known.has(p.ownedItemId)) {
      const item = await ctx.db.get(p.ownedItemId);
      if (!item || item.userId !== ownerId) throw new ConvexError("Item not found");
    }
    if (p.listingId && !known.has(p.listingId)) await accessibleListing(ctx, p.listingId, ownerId);
  }
}
export function assertRevision(doc: { revision: number }, revision: number) {
  if (doc.revision !== revision)
    throw new ConvexError("This layout changed in another tab. Reload it before saving.");
}
export const get = viewerQuery({
  args: { id: v.id("unitScenes") },
  returns: unitSceneRecord,
  handler: async (ctx, { id }) => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    const sources = await Promise.all(
      doc.sources.map(async (s) => ({
        ...s,
        url: s.storageId ? ((await ctx.storage.getUrl(s.storageId)) ?? undefined) : s.url,
      })),
    );
    const sceneSources =
      doc.sceneSources &&
      (await Promise.all(
        doc.sceneSources.map(async (s) => ({
          ...s,
          url: s.storageId ? ((await ctx.storage.getUrl(s.storageId)) ?? undefined) : s.url,
        })),
      ));
    return { ...doc, sources, sceneSources };
  },
});
export const mine = viewerQuery({
  args: {},
  returns: v.array(v.object({ id: v.id("unitScenes"), title: v.string(), updatedAt: v.number() })),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("unitScenes")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id))
        .order("desc")
        .take(30)
    ).map((d) => ({ id: d._id, title: d.scene.title, updatedAt: d.updatedAt })),
});
/** Scenes read to find a place's unit when it has no listing: the person's rooms' and these. */
const PLACE_SCENES_SCANNED = 40;
/**
 * The owner's unit for their place (#150): the scene made from the place's
 * listing, or, for a place found elsewhere (no listing), their most recently
 * updated scene that belongs to neither a room nor a listing. The caller has
 * checked the owner can see `listingId`.
 */
export async function placeScene(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  listingId: Id<"listings"> | undefined,
) {
  const scenes = await ctx.db
    .query("unitScenes")
    .withIndex("by_owner_listing", (q) => q.eq("ownerId", ownerId).eq("listingId", listingId))
    .take(listingId ? 1 : PLACE_SCENES_SCANNED);
  if (listingId) return scenes[0] ?? null;
  return scenes.filter((u) => !u.roomId).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}
/**
 * The owner's scene for a room or a listing, created as the starter scene with
 * the room's or listing's media when there is none yet. With neither, a new
 * scene every time: callers that want one per place look with `placeScene` first.
 */
export async function createScene(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  { roomId, listingId }: { roomId?: Id<"rooms">; listingId?: Id<"listings"> },
): Promise<Id<"unitScenes">> {
  const room = roomId ? await ctx.db.get(roomId) : null;
  if (roomId && (!room || room.userId !== ownerId)) throw new ConvexError("Room not found");
  const listing = listingId ? await accessibleListing(ctx, listingId, ownerId) : null;
  const existing = roomId
    ? await ctx.db
        .query("unitScenes")
        .withIndex("by_owner_room", (q) => q.eq("ownerId", ownerId).eq("roomId", roomId))
        .first()
    : listingId
      ? await placeScene(ctx, ownerId, listingId)
      : null;
  if (existing) return existing._id;
  const title = (room?.name ?? listing?.title ?? "Your unit").slice(0, 120);
  const photos: { url: string; storageId?: Id<"_storage"> }[] =
    room?.photos ?? listing?.photos.map((url) => ({ url })) ?? [];
  const sources: Doc<"unitScenes">["sources"] = listing
    ? listingSources(listing)
    : photos.slice(0, 18).map((p, i) => ({
        key: `photo-${i + 1}`,
        label: `Photo ${i + 1}`,
        kind: "photo",
        url: p.url,
        ...(p.storageId ? { storageId: p.storageId } : {}),
      }));
  const now = Date.now();
  return ctx.db.insert("unitScenes", {
    ownerId,
    roomId,
    listingId,
    scene: manualScene(
      room?.size ? room.size.widthFt * 0.3048 : 4,
      room?.size ? room.size.lengthFt * 0.3048 : 5,
      title,
      !!room?.size,
    ),
    placements: [],
    sources,
    description: listing?.description.slice(0, 8000) ?? "",
    revision: 0,
    manuallyEdited: !!room?.size,
    createdAt: now,
    updatedAt: now,
  });
}
export const create = viewerMutation({
  args: { roomId: v.optional(v.id("rooms")), listingId: v.optional(v.id("listings")) },
  returns: v.id("unitScenes"),
  handler: async (ctx, { roomId, listingId: chosen }) => {
    if (roomId && chosen) throw new ConvexError("Choose a room or a listing");
    const ownerId = ctx.viewer._id;
    // Neither given: start from the person's place.
    const listingId = chosen ?? (roomId ? undefined : await placeListingId(ctx, ownerId));
    return createScene(ctx, ownerId, { roomId, listingId });
  },
});
export const save = viewerMutation({
  args: {
    id: v.id("unitScenes"),
    revision: v.number(),
    scene: unitScene,
    placements: v.array(placement),
  },
  returns: v.number(),
  handler: async (ctx, { id, revision, scene, placements }) => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    assertRevision(doc, revision);
    const sceneSources = savedSceneSources(scene, [...(doc.sceneSources ?? []), ...doc.sources]);
    const errors = sceneProblems(
      scene,
      sceneSources.map((s) => s.key),
    );
    if (errors.length) throw new ConvexError(errors.join("; "));
    if (placements.length > 80 || new Set(placements.map((p) => p.id)).size !== placements.length)
      throw new ConvexError("At most 80 items with unique IDs");
    if (!placements.every(validPlacement)) throw new ConvexError("Invalid item dimensions");
    await checkPlacementSources(ctx, ctx.viewer._id, placements, doc.placements);
    await ctx.db.patch(id, {
      scene,
      sceneSources,
      placements,
      manuallyEdited: true,
      generation: undefined,
      jobId: undefined,
      candidate: undefined,
      revision: revision + 1,
      updatedAt: Date.now(),
    });
    return revision + 1;
  },
});
export const uploadUrl = viewerMutation({
  args: { id: v.id("unitScenes") },
  returns: v.string(),
  handler: async (ctx, { id }) => {
    await ownScene(ctx, id, ctx.viewer._id);
    return ctx.storage.generateUploadUrl();
  },
});
export const addSource = viewerMutation({
  args: { id: v.id("unitScenes"), revision: v.number(), source: sceneSource },
  returns: v.number(),
  handler: async (ctx, { id, revision, source }) => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    assertRevision(doc, revision);
    if (
      doc.sources.length >= MAX_SOURCES ||
      doc.sources.some((s) => s.key === source.key) ||
      !/^[-\w]{1,60}$/.test(source.key) ||
      !source.label.trim() ||
      source.label.length > 120
    )
      throw new ConvexError("Invalid source or media limit reached");
    source = { ...source, imported: false };
    if (source.storageId) {
      const meta = await ctx.db.system.get(source.storageId);
      const types =
        source.kind === "video"
          ? ["video/mp4", "video/webm"]
          : ["image/jpeg", "image/png", "image/webp"];
      if (!meta || meta.size > 25 * 1024 * 1024 || !types.includes(meta.contentType ?? ""))
        throw new ConvexError("Use JPG, PNG, WebP, MP4 or WebM up to 25 MB");
      source = { ...source, url: undefined };
    } else {
      if (!source.url || !publicMediaUrl(source.url))
        throw new ConvexError("Use a public HTTPS image or video URL");
    }
    await ctx.db.patch(id, {
      sources: [...doc.sources, source],
      generation: undefined,
      jobId: undefined,
      candidate: undefined,
      revision: revision + 1,
      updatedAt: Date.now(),
    });
    return revision + 1;
  },
});
export function publicMediaUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      value.length <= 4096 &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.hostname.includes(".") &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) &&
      !u.hostname.endsWith(".local") &&
      !u.hostname.startsWith("[")
    );
  } catch {
    return false;
  }
}
/** The sources and description a generation reads: the listing's current media plus the owner's own. */
export async function generationInputs(ctx: QueryCtx, doc: Doc<"unitScenes">) {
  const listing = doc.listingId ? await accessibleListing(ctx, doc.listingId, doc.ownerId) : null;
  const sources = listing ? refreshedSources(doc.sources, listing) : doc.sources;
  const description = listing?.description.slice(0, 8000) ?? doc.description;
  const changed =
    canonicalJson(sources) !== canonicalJson(doc.sources) || description !== doc.description;
  return { sources, description, changed };
}
/** Whether Muse can read a source: an upload, or a public HTTPS file (seed paths are local). */
export function readableSource(s: Doc<"unitScenes">["sources"][number]) {
  return !!s.storageId || (!!s.url && publicMediaUrl(s.url));
}
/** The scene's build job while it is queued or running, else null. */
export async function liveJob(ctx: QueryCtx, doc: Doc<"unitScenes">) {
  const job = doc.jobId ? await ctx.db.get(doc.jobId) : null;
  return job &&
    (job.status === "queued" || job.status === "running") &&
    Date.now() - job.createdAt < 15 * 60_000
    ? job
    : null;
}
/**
 * Starts (or joins) a scene's generation for its owner; the caller has checked
 * ownership and, where it matters, the revision. Shared by `requestGeneration`
 * and Landing Home's `apartment.build` (#150).
 */
export async function startGeneration(
  ctx: MutationCtx,
  doc: Doc<"unitScenes">,
  detailsOnly = false,
): Promise<Id<"aiJobs">> {
  const id = doc._id,
    revision = doc.revision;
  const { sources, description, changed } = await generationInputs(ctx, doc);
  if (!sources.length) throw new ConvexError("Add photos or a floor plan first");
  const live = await liveJob(ctx, doc);
  if (!changed && live) return live._id;
  const nextRevision = revision + (changed ? 1 : 0);
  // `generation` is cleared by every scene or source edit, so one that is still here
  // describes this scene. Item moves bump `revision` without touching it (#150).
  const retryDetails =
    detailsOnly && !changed && !!doc.generation && !!(doc.candidate || !isStarterScene(doc.scene));
  const jobId = await startJob(ctx, {
    kind: "unitScene",
    key: `${id}:${nextRevision}`,
    userId: doc.ownerId,
    action: internal.unitScenes.generate,
    args: { id, ownerId: doc.ownerId, revision: nextRevision, detailsOnly: retryDetails },
  });
  await ctx.db.patch(id, {
    sources,
    sceneSources: savedSceneSources(doc.scene, doc.sceneSources ?? doc.sources),
    description,
    revision: nextRevision,
    jobId,
    candidate: retryDetails ? doc.candidate : undefined,
    explanation: undefined,
    generation: {
      status: retryDetails ? "details" : "layout",
      revision: nextRevision,
      autoApply:
        doc.manuallyEdited === false ||
        (doc.manuallyEdited === undefined && isStarterScene(doc.scene)),
    },
  });
  return jobId;
}
export const requestGeneration = viewerMutation({
  args: { id: v.id("unitScenes"), revision: v.number(), detailsOnly: v.optional(v.boolean()) },
  returns: v.id("aiJobs"),
  handler: async (ctx, { id, revision, detailsOnly = false }): Promise<Id<"aiJobs">> => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    assertRevision(doc, revision);
    return startGeneration(ctx, doc, detailsOnly);
  },
});
export const load = internalQuery({
  args: { id: v.id("unitScenes"), ownerId: v.id("users") },
  returns: unitSceneRecord,
  handler: (ctx, { id, ownerId }) => ownScene(ctx, id, ownerId),
});
/**
 * Each stage returns the revision it published. A stage is stale when the
 * scene's `generation.revision` is no longer the one the action last saw:
 * every scene or source edit clears `generation` or replaces the job. Item
 * moves (convex/apartment.ts, #150) bump `revision` only, so they don't
 * discard a build: placements aren't generation input and are kept by it.
 */
export const saveCandidate = internalMutation({
  args: {
    id: v.id("unitScenes"),
    ownerId: v.id("users"),
    revision: v.number(),
    jobId: v.id("aiJobs"),
    candidate: v.union(unitScene, v.null()),
    explanation: v.string(),
    runId: v.optional(v.id("aiRuns")),
    status: v.optional(generationStatus),
  },
  returns: v.union(v.number(), v.null()),
  handler: async (
    ctx,
    { id, ownerId, revision, jobId, candidate, explanation, runId, status = "ready" },
  ) => {
    const doc = await ownScene(ctx, id, ownerId);
    if (doc.jobId !== jobId) return null;
    if (doc.generation?.revision !== revision) {
      await ctx.db.patch(id, {
        explanation:
          "Sources or layout changed during generation. Generate again to use your latest version.",
      });
      return null;
    }
    if (candidate) {
      const errors = sceneProblems(
        candidate,
        doc.sources.map((s) => s.key),
      );
      if (errors.length) throw new Error(errors.join("; "));
    }
    const autoApply = doc.generation.autoApply;
    const nextRevision = doc.revision + 1;
    await ctx.db.patch(id, {
      ...(candidate
        ? autoApply
          ? {
              scene: candidate,
              sceneSources: savedSceneSources(candidate, doc.sources),
              candidate: undefined,
              manuallyEdited: false,
            }
          : { candidate }
        : {}),
      explanation,
      ...(runId ? { runId } : {}),
      revision: nextRevision,
      updatedAt: Date.now(),
      generation: { status, revision: nextRevision, autoApply },
    });
    return nextRevision;
  },
});
export const acceptCandidate = viewerMutation({
  args: { id: v.id("unitScenes"), revision: v.number() },
  returns: v.number(),
  handler: async (ctx, { id, revision }) => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    assertRevision(doc, revision);
    if (!doc.candidate) throw new ConvexError("No generated layout to apply");
    await ctx.db.patch(id, {
      scene: doc.candidate,
      sceneSources: savedSceneSources(doc.candidate, doc.sources),
      candidate: undefined,
      manuallyEdited: false,
      generation: doc.generation
        ? { ...doc.generation, autoApply: true, revision: revision + 1 }
        : undefined,
      jobId: undefined,
      revision: revision + 1,
      updatedAt: Date.now(),
    });
    return revision + 1;
  },
});
export const generate = internalAction({
  args: {
    id: v.id("unitScenes"),
    ownerId: v.id("users"),
    revision: v.number(),
    jobId: v.id("aiJobs"),
    detailsOnly: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    let revision = args.revision;
    let hasLayout = !!args.detailsOnly;
    try {
      await runJob(ctx, args.jobId, async (progress) => {
        const deadline = Date.now() + 8 * 60_000;
        const doc = await ctx.runQuery(internal.unitScenes.load, {
          id: args.id,
          ownerId: args.ownerId,
        });
        if (doc.generation?.revision !== revision || doc.jobId !== args.jobId) return;
        const publish = async (
          candidate: Doc<"unitScenes">["scene"] | null,
          explanation: string,
          status: "details" | "ready" | "partial",
          runId?: Id<"aiRuns">,
        ) => {
          const next: number | null = await ctx.runMutation(internal.unitScenes.saveCandidate, {
            id: args.id,
            ownerId: args.ownerId,
            jobId: args.jobId,
            revision,
            candidate,
            explanation,
            status,
            runId,
          });
          if (next === null) return false;
          revision = next;
          return true;
        };
        await progress("Reading floor plans and listing media", 1, 3);
        const media: MediaInput[] = [];
        for (const s of doc.sources) {
          const url = s.storageId ? await ctx.storage.getUrl(s.storageId) : s.url;
          if (url && publicMediaUrl(url))
            media.push({ key: s.key, kind: s.kind === "video" ? "video" : "image", url });
        }
        if (!media.length)
          throw new Error(
            "No readable media. Upload photos or a floor plan; local seed paths cannot be read by Muse.",
          );
        let candidate = args.detailsOnly ? structuredClone(doc.candidate ?? doc.scene) : null;
        let explanation = "Layout preserved. ";
        if (!candidate) {
          const { appearance: _appearance, ...currentLayout } = doc.scene;
          const geometryMedia = layoutMedia(media, doc.sources);
          const result = await runAgent(ctx, unitSceneTask, {
            input: {
              title: doc.scene.title,
              description: doc.description,
              currentLayout,
              measurements:
                doc.scene.rooms.length === 1 && doc.scene.rooms[0].evidence.basis === "measured"
                  ? {
                      width:
                        Math.max(...doc.scene.rooms[0].polygon.map((p) => p.x)) -
                        Math.min(...doc.scene.rooms[0].polygon.map((p) => p.x)),
                      length:
                        Math.max(...doc.scene.rooms[0].polygon.map((p) => p.z)) -
                        Math.min(...doc.scene.rooms[0].polygon.map((p) => p.z)),
                    }
                  : null,
              evidence: doc.sources
                .filter((s) => geometryMedia.some((m) => m.key === s.key))
                .map(({ key, label, kind }) => ({ key, label, kind })),
            },
            media: geometryMedia,
            sources: [],
            shownTo: args.ownerId,
            jobId: args.jobId,
            deadline,
          });
          candidate = result.output.scene;
          if (!candidate) throw new Error(result.output.explanation);
          explanation = result.output.explanation;
          if (!(await publish(candidate, explanation, "details", result.runId))) return;
          hasLayout = true;
        }
        await progress("Your layout is ready. Adding finishes and fixtures…", 2, 3);
        const details = await runAgent(
          ctx,
          args.detailsOnly ? { ...unitAppearanceTask, cacheTtlMs: 0 } : unitAppearanceTask,
          {
            input: {
              scene: candidate,
              evidence: doc.sources
                .filter((s) => media.some((m) => m.key === s.key))
                .map(({ key, label, kind }) => ({ key, label, kind })),
            },
            media,
            sources: [],
            shownTo: args.ownerId,
            jobId: args.jobId,
            deadline,
          },
        );
        if (details.output.appearance) candidate.appearance = details.output.appearance;
        const partial = !details.output.appearance || !!details.output.omitted?.length;
        if (
          !(await publish(
            candidate,
            `${explanation} ${details.output.explanation}`,
            partial ? "partial" : "ready",
            details.runId,
          ))
        )
          return;
        await progress(
          partial ? "Layout ready; some details unavailable" : "Apartment ready",
          3,
          3,
        );
      });
    } catch (error) {
      await ctx.runMutation(internal.unitScenes.saveCandidate, {
        id: args.id,
        ownerId: args.ownerId,
        jobId: args.jobId,
        revision,
        candidate: null,
        explanation: error instanceof Error ? error.message : "Generation failed. Please retry.",
        status: hasLayout ? "partial" : "failed",
      });
    }
    return null;
  },
});
