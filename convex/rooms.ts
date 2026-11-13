import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { runAgent } from "./ai/agent";
import { assertCitable, type CitedSource, type NonEmpty, resolveCitations } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { type Audience, loadAudience } from "./lib/posts";
import { type RoomVibeInput, roomVibeTask } from "./lib/roomVibeTask";
import {
  cleanVibe,
  MAX_PHOTOS,
  MAX_ROOMS,
  roomKind,
  SIZE_FT,
  VIBE_LIMITS,
  type VibeValue,
  vibeOrigin,
  vibeProblems,
  vibeValue,
} from "./lib/vibe";
import { type Citations, citations, type Source } from "./validators";

/**
 * Landing rooms (#25): a person's room scan and its style vibe. The vibe is
 * typed, or suggested by Muse from what the person saved, liked and follows
 * (`suggestVibe` proposes; `setVibe` stores what they keep). Marketplace
 * matching (#26) and the 3D room (#37) read rooms through `mine`.
 */

/* ---------------- Reading ---------------- */

async function roomView(ctx: QueryCtx, room: Doc<"rooms">, a: Audience) {
  const vibe = room.vibe;
  let sources: NonEmpty<CitedSource> | null = null;
  let sourcesHidden = false;
  if (vibe?.citations) {
    sources = await resolveCitations(ctx, vibe.citations, a);
    // A cited post or listing is gone or now hidden from the viewer: keep the
    // vibe they chose, but drop what it said it was based on.
    sourcesHidden = sources === null;
  }
  return {
    _id: room._id,
    name: room.name,
    kind: room.kind,
    photos: room.photos.map((p) => ({ url: p.url, addedAt: p.addedAt })),
    size: room.size ?? null,
    vibe: vibe
      ? {
          summary: vibe.summary,
          styles: vibe.styles,
          palette: vibe.palette,
          keywords: vibe.keywords,
          origin: vibe.origin,
          updatedAt: vibe.updatedAt,
          sources,
          basis: sourcesHidden ? [] : (vibe.basis ?? []),
        }
      : null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
export type RoomView = Awaited<ReturnType<typeof roomView>>;

/** The viewer's rooms, oldest first. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("rooms")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    const a = await loadAudience(ctx, ctx.viewer._id);
    return Promise.all(rows.map((r) => roomView(ctx, r, a)));
  },
});

/* ---------------- Writing ---------------- */

async function ownRoom(ctx: QueryCtx, userId: Id<"users">, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room || room.userId !== userId) throw new ConvexError("Room not found");
  return room;
}

function cleanName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n || n.length > 40) throw new ConvexError("Give the room a name (up to 40 characters)");
  return n;
}

const sizeArg = v.object({ widthFt: v.number(), lengthFt: v.number() });
function checkSize(size: { widthFt: number; lengthFt: number }) {
  for (const n of [size.widthFt, size.lengthFt])
    if (!Number.isFinite(n) || n < SIZE_FT.min || n > SIZE_FT.max)
      throw new ConvexError(`Room sides should be ${SIZE_FT.min}–${SIZE_FT.max} ft`);
  return {
    widthFt: Math.round(size.widthFt * 10) / 10,
    lengthFt: Math.round(size.lengthFt * 10) / 10,
  };
}

export const create = viewerMutation({
  args: { name: v.string(), kind: roomKind },
  handler: async (ctx, { name, kind }) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();
    if (existing.length >= MAX_ROOMS) throw new ConvexError(`You can add up to ${MAX_ROOMS} rooms`);
    const now = Date.now();
    return ctx.db.insert("rooms", {
      userId: ctx.viewer._id,
      name: cleanName(name),
      kind,
      photos: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Name, kind and floor size. `size: null` clears the size. */
export const update = viewerMutation({
  args: {
    roomId: v.id("rooms"),
    name: v.optional(v.string()),
    kind: v.optional(roomKind),
    size: v.optional(v.union(sizeArg, v.null())),
  },
  handler: async (ctx, { roomId, name, kind, size }) => {
    await ownRoom(ctx, ctx.viewer._id, roomId);
    await ctx.db.patch(roomId, {
      ...(name !== undefined ? { name: cleanName(name) } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(size !== undefined ? { size: size === null ? undefined : checkSize(size) } : {}),
      updatedAt: Date.now(),
    });
  },
});

async function deletePhotoFiles(ctx: MutationCtx, photos: Doc<"rooms">["photos"]) {
  for (const p of photos) if (p.storageId) await ctx.storage.delete(p.storageId);
}

export const remove = viewerMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ownRoom(ctx, ctx.viewer._id, roomId);
    await deletePhotoFiles(ctx, room.photos);
    await ctx.db.delete(roomId);
  },
});

/** Adds photos uploaded via `posts:generateUploadUrl` to the room's scan. */
export const addPhotos = viewerMutation({
  args: { roomId: v.id("rooms"), storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { roomId, storageIds }) => {
    const room = await ownRoom(ctx, ctx.viewer._id, roomId);
    if (room.photos.length + storageIds.length > MAX_PHOTOS)
      throw new ConvexError(`A room can have up to ${MAX_PHOTOS} photos`);
    const now = Date.now();
    const added: Doc<"rooms">["photos"] = [];
    for (const storageId of storageIds) {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new ConvexError("A photo didn't finish uploading");
      added.push({ url, storageId, addedAt: now });
    }
    await ctx.db.patch(roomId, { photos: [...room.photos, ...added], updatedAt: now });
  },
});

export const removePhoto = viewerMutation({
  args: { roomId: v.id("rooms"), url: v.string() },
  handler: async (ctx, { roomId, url }) => {
    const room = await ownRoom(ctx, ctx.viewer._id, roomId);
    const gone = room.photos.filter((p) => p.url === url);
    await deletePhotoFiles(ctx, gone);
    await ctx.db.patch(roomId, {
      photos: room.photos.filter((p) => p.url !== url),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Stores the room's vibe. `typed` is the person's own; `generated` is a
 * suggestion from `suggestVibe` kept as is; `edited` is one they changed.
 * A suggestion's citations must be sources the viewer can see. `keepSources`
 * (editing a vibe Muse suggested earlier) reuses the stored citations and
 * basis, dropping them if a source is no longer visible.
 */
export const setVibe = viewerMutation({
  args: {
    roomId: v.id("rooms"),
    vibe: vibeValue,
    origin: vibeOrigin,
    citations: v.optional(citations),
    basis: v.optional(v.array(v.string())),
    keepSources: v.optional(v.boolean()),
  },
  handler: async (ctx, { roomId, vibe, origin, citations: given, basis, keepSources }) => {
    const room = await ownRoom(ctx, ctx.viewer._id, roomId);
    const clean = cleanVibe(vibe);
    const problems = vibeProblems(clean);
    if (problems.length > 0) throw new ConvexError(problems[0]!);
    const fromMuse = origin !== "typed";
    const audience = await loadAudience(ctx, ctx.viewer._id);

    let cited: Citations | undefined;
    let rawBasis: string[] = [];
    if (fromMuse && given) {
      await assertCitable(ctx, given, audience);
      cited = given;
      rawBasis = basis ?? [];
    } else if (fromMuse && keepSources && room.vibe?.origin !== "typed") {
      const old = room.vibe;
      const stillVisible = old?.citations
        ? await assertCitable(ctx, old.citations, audience).then(
            () => true,
            () => false,
          )
        : true;
      if (stillVisible) {
        cited = old?.citations;
        rawBasis = old?.basis ?? [];
      }
    } else if (fromMuse) {
      rawBasis = basis ?? [];
    }
    const keptBasis = rawBasis
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, VIBE_LIMITS.basisMax)
      .map((b) => b.slice(0, VIBE_LIMITS.basisItemMax));

    const now = Date.now();
    await ctx.db.patch(roomId, {
      vibe: {
        ...clean,
        origin,
        ...(cited ? { citations: cited } : {}),
        ...(keptBasis.length ? { basis: keptBasis } : {}),
        updatedAt: now,
      },
      updatedAt: now,
    });
  },
});

export const clearVibe = viewerMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await ownRoom(ctx, ctx.viewer._id, roomId);
    await ctx.db.patch(roomId, { vibe: undefined, updatedAt: Date.now() });
  },
});

/* ---------------- Muse's suggestion ---------------- */

const CAP = {
  follows: 15,
  savedListings: 12,
  savedPosts: 8,
  likedPosts: 20,
  reactionsScanned: 200,
};

/**
 * What Muse reads for a room's vibe: the room, the Pages the person follows,
 * and as sources the listings and posts they saved and the posts they liked
 * (newest first). `runAgent` drops any source the viewer can't see.
 */
export const vibeInput = internalQuery({
  args: { viewerId: v.id("users"), roomId: v.id("rooms") },
  handler: async (
    ctx,
    { viewerId, roomId },
  ): Promise<{ input: RoomVibeInput; sources: Source[] }> => {
    if (!(await ctx.db.get(viewerId))) throw new ConvexError("Unknown viewer");
    const room = await ownRoom(ctx, viewerId, roomId);

    const followRows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(CAP.follows);
    const follows: RoomVibeInput["follows"] = [];
    for (const f of followRows) {
      const page = await ctx.db.get(f.targetId);
      if (page?.kind === "page")
        follows.push({ name: page.name, category: page.pageCategory ?? "Page" });
    }

    const sources: Source[] = [];
    const seenPosts = new Set<string>();
    const savedRows = await ctx.db
      .query("saved")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(100);
    let listings = 0;
    let savedPosts = 0;
    for (const s of savedRows) {
      if (s.kind === "listing" && listings < CAP.savedListings) {
        const id = ctx.db.normalizeId("listings", s.refId);
        if (id && (await ctx.db.get(id))) {
          sources.push({ kind: "listing", listingId: id });
          listings++;
        }
      } else if (s.kind === "post" && savedPosts < CAP.savedPosts) {
        const id = ctx.db.normalizeId("posts", s.refId);
        if (id && (await ctx.db.get(id))) {
          sources.push({ kind: "post", postId: id });
          seenPosts.add(id);
          savedPosts++;
        }
      }
    }

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(CAP.reactionsScanned);
    let liked = 0;
    for (const r of reactions) {
      if (liked >= CAP.likedPosts) break;
      if (r.targetType !== "post" || seenPosts.has(r.targetId)) continue;
      const id = ctx.db.normalizeId("posts", r.targetId);
      const post = id ? await ctx.db.get(id) : null;
      if (!post?.text?.trim()) continue;
      seenPosts.add(r.targetId);
      sources.push({ kind: "post", postId: post._id });
      liked++;
    }

    return {
      input: {
        room: { name: room.name, kind: room.kind, size: room.size ?? null },
        // City Profile interests (#3) join here once #63 is merged.
        interests: [],
        follows,
      },
      sources,
    };
  },
});

/** A suggestion's citations as the viewer sees them, for the sources chip. */
export const citedForViewer = internalQuery({
  args: { viewerId: v.id("users"), citations },
  handler: async (ctx, { viewerId, citations: c }) =>
    resolveCitations(ctx, c, await loadAudience(ctx, viewerId)),
});

/**
 * Muse suggests a vibe for one of the viewer's rooms (`muse.roomVibe` on
 * `runAgent`, shown to this viewer only). Saves nothing: the person keeps or
 * edits it, and `setVibe` stores it with its citations and basis.
 */
export type SuggestedVibe = {
  via: "model" | "cache" | "fallback";
  vibe: VibeValue;
  citations: Citations | null;
  /** The cited sources as the viewer sees them, for the sources chip. */
  sources: NonEmpty<CitedSource> | null;
  /** Plain words on what it drew on: "Saved a teak cane armchair", "Follows Moonrise Coffee Co." */
  basis: string[];
};

export const suggestVibe = action({
  args: { viewerId: v.id("users"), roomId: v.id("rooms") },
  // Explicit types: this action calls queries in its own module.
  handler: async (ctx, { viewerId, roomId }): Promise<SuggestedVibe> => {
    const { input, sources }: { input: RoomVibeInput; sources: Source[] } = await ctx.runQuery(
      internal.rooms.vibeInput,
      { viewerId, roomId },
    );
    const result = await runAgent(ctx, roomVibeTask, { input, sources, shownTo: viewerId });
    const o = result.output;
    const interests = new Set(input.interests.map((i) => i.label));
    const basis = [
      ...o.because.map((b) => b.why),
      ...o.fromProfile.map((name) =>
        interests.has(name) ? `Into ${name.toLowerCase()}` : `Follows ${name}`,
      ),
    ].slice(0, VIBE_LIMITS.basisMax);
    const shown: NonEmpty<CitedSource> | null = result.cited
      ? await ctx.runQuery(internal.rooms.citedForViewer, { viewerId, citations: result.cited })
      : null;
    const vibe: VibeValue = {
      summary: o.summary,
      styles: o.styles,
      palette: o.palette,
      keywords: o.keywords,
    };
    return { via: result.via, vibe, citations: result.cited, sources: shown, basis };
  },
});
