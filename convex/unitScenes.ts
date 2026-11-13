import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import type { MediaInput } from "./ai/model";
import { resolveSources } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { loadAudience } from "./lib/posts";
import { unitAppearanceTask } from "./lib/unitAppearanceTask";
import {
  MAX_SOURCES,
  manualScene,
  placement,
  sceneProblems,
  sceneSource,
  unitScene,
} from "./lib/unitScene";
import { unitSceneRecord } from "./lib/unitSceneRecord";
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
    return { ...doc, sources };
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
export const create = viewerMutation({
  args: { roomId: v.optional(v.id("rooms")), listingId: v.optional(v.id("listings")) },
  returns: v.id("unitScenes"),
  handler: async (ctx, { roomId, listingId }) => {
    if (roomId && listingId) throw new ConvexError("Choose a room or a listing");
    const ownerId = ctx.viewer._id;
    const room = roomId ? await ctx.db.get(roomId) : null;
    if (roomId && (!room || room.userId !== ownerId)) throw new ConvexError("Room not found");
    const listing = listingId ? await accessibleListing(ctx, listingId, ownerId) : null;
    const existing = roomId
      ? await ctx.db
          .query("unitScenes")
          .withIndex("by_owner_room", (q) => q.eq("ownerId", ownerId).eq("roomId", roomId))
          .first()
      : listingId
        ? await ctx.db
            .query("unitScenes")
            .withIndex("by_owner_listing", (q) =>
              q.eq("ownerId", ownerId).eq("listingId", listingId),
            )
            .first()
        : null;
    if (existing) return existing._id;
    const title = (room?.name ?? listing?.title ?? "Your unit").slice(0, 120);
    const photos: { url: string; storageId?: Id<"_storage"> }[] =
      room?.photos ?? listing?.photos.map((url) => ({ url })) ?? [];
    const sources: Doc<"unitScenes">["sources"] = photos.slice(0, 18).map((p, i) => ({
      key: `photo-${i + 1}`,
      label: `Photo ${i + 1}`,
      kind: "photo",
      url: p.url,
      ...(p.storageId ? { storageId: p.storageId } : {}),
    }));
    if (listing?.video)
      sources.push({
        key: "listing-video",
        label: "Listing video",
        kind: "video",
        url: listing.video.url,
      });
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
      createdAt: now,
      updatedAt: now,
    });
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
    const errors = sceneProblems(
      scene,
      doc.sources.map((s) => s.key),
    );
    if (errors.length) throw new ConvexError(errors.join("; "));
    if (placements.length > 80 || new Set(placements.map((p) => p.id)).size !== placements.length)
      throw new ConvexError("At most 80 items with unique IDs");
    for (const p of placements) {
      if (
        !p.id ||
        p.id.length > 80 ||
        !p.label.trim() ||
        p.label.length > 120 ||
        ![p.x, p.z, p.rotation, p.width, p.depth, p.height].every(Number.isFinite) ||
        [p.width, p.depth, p.height].some((n) => n < 0.05 || n > 12) ||
        Math.abs(p.x) > 100 ||
        Math.abs(p.z) > 100 ||
        Math.abs(p.rotation) > Math.PI * 2 ||
        !/^#[0-9a-f]{6}$/i.test(p.color)
      )
        throw new ConvexError("Invalid item dimensions");
      if (p.listingId) await accessibleListing(ctx, p.listingId, ctx.viewer._id);
    }
    await ctx.db.patch(id, {
      scene,
      placements,
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
export const requestGeneration = viewerMutation({
  args: { id: v.id("unitScenes"), revision: v.number() },
  returns: v.id("aiJobs"),
  handler: async (ctx, { id, revision }): Promise<Id<"aiJobs">> => {
    const doc = await ownScene(ctx, id, ctx.viewer._id);
    assertRevision(doc, revision);
    if (!doc.sources.length) throw new ConvexError("Add photos or a floor plan first");
    const jobId = await startJob(ctx, {
      kind: "unitScene",
      key: `${id}:${revision}`,
      userId: ctx.viewer._id,
      action: internal.unitScenes.generate,
      args: { id, ownerId: ctx.viewer._id, revision },
    });
    await ctx.db.patch(id, { jobId, candidate: undefined, explanation: undefined });
    return jobId;
  },
});
export const load = internalQuery({
  args: { id: v.id("unitScenes"), ownerId: v.id("users") },
  returns: unitSceneRecord,
  handler: (ctx, { id, ownerId }) => ownScene(ctx, id, ownerId),
});
export const saveCandidate = internalMutation({
  args: {
    id: v.id("unitScenes"),
    ownerId: v.id("users"),
    revision: v.number(),
    jobId: v.id("aiJobs"),
    candidate: v.union(unitScene, v.null()),
    explanation: v.string(),
    runId: v.id("aiRuns"),
  },
  returns: v.null(),
  handler: async (ctx, { id, ownerId, revision, jobId, candidate, explanation, runId }) => {
    const doc = await ownScene(ctx, id, ownerId);
    if (doc.jobId !== jobId) return null;
    await ctx.db.patch(
      id,
      doc.revision !== revision
        ? {
            explanation:
              "Sources or layout changed during generation. Generate again to use your latest version.",
          }
        : { candidate: candidate ?? undefined, explanation, runId },
    );
    return null;
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
      candidate: undefined,
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
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await runJob(ctx, args.jobId, async (progress) => {
      const deadline = Date.now() + 8 * 60_000;
      const doc = await ctx.runQuery(internal.unitScenes.load, {
        id: args.id,
        ownerId: args.ownerId,
      });
      if (doc.revision !== args.revision) throw new Error("Layout changed. Generate again.");
      await progress("Reading floor plans and listing media", 1, 3);
      const media: MediaInput[] = [];
      for (const s of doc.sources) {
        const url = s.storageId ? await ctx.storage.getUrl(s.storageId) : s.url;
        if (!url || !publicMediaUrl(url)) continue;
        media.push({ key: s.key, kind: s.kind === "video" ? "video" : "image", url });
      }
      if (!media.length)
        throw new Error(
          "No readable media. Upload photos or a floor plan; local seed paths cannot be read by Muse.",
        );
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
            .map((s) => ({ key: s.key, label: s.label, kind: s.kind })),
        },
        media: geometryMedia,
        sources: [],
        shownTo: args.ownerId,
        jobId: args.jobId,
        deadline,
      });
      await progress("Reconstructing visible materials and fixtures", 2, 3);
      const candidate = result.output.scene;
      let explanation = result.output.explanation;
      if (candidate) {
        const details = await runAgent(ctx, unitAppearanceTask, {
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
        });
        if (details.output.appearance) candidate.appearance = details.output.appearance;
        explanation += ` ${details.output.explanation}`;
      }
      await ctx.runMutation(internal.unitScenes.saveCandidate, {
        ...args,
        candidate,
        explanation,
        runId: result.runId,
      });
      await progress("Preview ready", 3, 3);
    });
    return null;
  },
});
