import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/functions";

/** Instant games are a static catalog on the client; ids are short slugs. */
const gameId = v.string();
const MAX_ID = 64;

function check(id: string) {
  if (!id || id.length > MAX_ID) throw new ConvexError("Invalid game");
}

/** The viewer's saved games (newest first) and per-game best scores (most recently played first). */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.viewer._id;
    const [saves, scores] = await Promise.all([
      ctx.db
        .query("gameSaves")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("gameScores")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);
    return {
      saved: saves.map((s) => s.gameId),
      scores: scores.map((s) => ({ gameId: s.gameId, best: s.best, lastPlayedAt: s.lastPlayedAt })),
    };
  },
});

export const toggleSave = viewerMutation({
  args: { gameId },
  handler: async (ctx, { gameId }) => {
    check(gameId);
    const userId = ctx.viewer._id;
    const row = await ctx.db
      .query("gameSaves")
      .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gameId))
      .first();
    if (row) {
      await ctx.db.delete(row._id);
      return false;
    }
    await ctx.db.insert("gameSaves", { userId, gameId, savedAt: Date.now() });
    return true;
  },
});

async function upsertScore(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameId: string,
  score: number,
  playedAt: number,
) {
  const row = await ctx.db
    .query("gameScores")
    .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gameId))
    .first();
  const best = Math.max(0, Math.floor(score));
  if (!row) {
    await ctx.db.insert("gameScores", { userId, gameId, best, lastPlayedAt: playedAt });
    return;
  }
  await ctx.db.patch(row._id, {
    best: Math.max(row.best, best),
    lastPlayedAt: Math.max(row.lastPlayedAt, playedAt),
  });
}

/** Opening a game counts as playing it ("Recently played"). */
export const recordPlay = viewerMutation({
  args: { gameId },
  handler: async (ctx, { gameId }) => {
    check(gameId);
    await upsertScore(ctx, ctx.viewer._id, gameId, 0, Date.now());
  },
});

/** Keep the higher of the stored best and `score`. */
export const reportScore = viewerMutation({
  args: { gameId, score: v.number() },
  handler: async (ctx, { gameId, score }) => {
    check(gameId);
    if (!Number.isFinite(score)) return;
    await upsertScore(ctx, ctx.viewer._id, gameId, score, Date.now());
  },
});

/**
 * One-time migration of the old browser-only "Your games" and best scores.
 * Idempotent: saves are only added, bests only raised.
 */
export const importLocal = viewerMutation({
  args: {
    saved: v.array(gameId),
    best: v.array(v.object({ gameId, score: v.number() })),
  },
  handler: async (ctx, { saved, best }) => {
    const userId = ctx.viewer._id;
    const now = Date.now();
    // Local order is newest first; keep it by giving older saves earlier times.
    const ids = saved.slice(0, 200);
    for (const [i, id] of ids.entries()) {
      if (!id || id.length > MAX_ID) continue;
      const row = await ctx.db
        .query("gameSaves")
        .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", id))
        .first();
      if (!row) await ctx.db.insert("gameSaves", { userId, gameId: id, savedAt: now - i });
    }
    for (const { gameId: id, score } of best.slice(0, 200)) {
      if (!id || id.length > MAX_ID || !Number.isFinite(score)) continue;
      await upsertScore(ctx, userId, id, score, now - 1000);
    }
  },
});
