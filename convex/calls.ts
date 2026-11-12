import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { dmBlockNotice } from "./lib/blocks";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { getSummaries, type UserSummary } from "./lib/users";
import { insertMessage } from "./messenger";

/**
 * Messenger calls. A call rings its callees for RING_MS, becomes active once
 * someone accepts, and ends when fewer than two people remain. Finished calls
 * are logged in the thread as a call bubble from the caller. WebRTC offer,
 * answer, ICE and mic/camera state travel through `callSignals`.
 */

const RING_MS = 30_000;

type Ctx = QueryCtx | MutationCtx;
type Outcome = "answered" | "no_answer" | "cancelled" | "declined";

const live = (c: Doc<"calls">) => c.status === "ringing" || c.status === "active";
const isParty = (c: Doc<"calls">, id: Id<"users">) => c.callerId === id || c.calleeIds.includes(id);

async function liveCalls(ctx: Ctx) {
  const [ringing, active] = await Promise.all([
    ctx.db
      .query("calls")
      .withIndex("by_status", (q) => q.eq("status", "ringing"))
      .collect(),
    ctx.db
      .query("calls")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect(),
  ]);
  return [...ringing, ...active];
}

async function requireParty(ctx: Ctx, callId: Id<"calls">, viewerId: Id<"users">) {
  const call = await ctx.db.get(callId);
  if (!call || !isParty(call, viewerId)) throw new ConvexError("Call not found");
  return call;
}

/** Closes a call, logs it in the thread and drops its signaling rows. */
async function finish(
  ctx: MutationCtx,
  call: Doc<"calls">,
  status: "ended" | "missed" | "declined",
  outcome: Outcome,
) {
  const now = Date.now();
  await ctx.db.patch(call._id, { status, endedAt: now, joinedIds: [] });
  await insertMessage(ctx, call.conversationId, call.callerId, {
    attachments: [
      {
        kind: "call",
        media: call.kind,
        outcome,
        callId: call._id,
        durationMs: call.answeredAt ? now - call.answeredAt : undefined,
      },
    ],
  });
  const signals = await ctx.db
    .query("callSignals")
    .withIndex("by_call_to", (q) => q.eq("callId", call._id))
    .collect();
  for (const s of signals) await ctx.db.delete(s._id);
}

/** Starts ringing everyone else in the thread. Re-starting the same live call returns it. */
export const start = viewerMutation({
  args: {
    conversationId: v.id("conversations"),
    kind: v.union(v.literal("audio"), v.literal("video")),
  },
  handler: async (ctx, { conversationId, kind }) => {
    const viewerId = ctx.viewer._id;
    const conv = await ctx.db.get(conversationId);
    if (!conv?.memberIds.includes(viewerId)) throw new ConvexError("Chat not found");
    const blocked = await dmBlockNotice(ctx, conv, viewerId);
    if (blocked) throw new ConvexError(blocked);
    const calleeIds = conv.memberIds.filter((id) => id !== viewerId);
    if (calleeIds.length === 0) throw new ConvexError("There's no one to call in this chat.");

    const mine = (await liveCalls(ctx)).filter((c) => c.joinedIds?.includes(viewerId));
    const same = mine.find((c) => c.conversationId === conversationId);
    if (same) return same._id;
    if (mine.length > 0)
      throw new ConvexError("You're already in a call. End it to start a new one.");

    const callId = await ctx.db.insert("calls", {
      conversationId,
      callerId: viewerId,
      calleeIds,
      kind,
      status: "ringing",
      startedAt: Date.now(),
      joinedIds: [viewerId],
      declinedIds: [],
    });
    await ctx.scheduler.runAfter(RING_MS, internal.calls.expire, { callId });
    return callId;
  },
});

/** Nobody picked up: the caller sees "No answer", callees see a missed call. */
export const expire = internalMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call?.status === "ringing") await finish(ctx, call, "missed", "no_answer");
  },
});

export const accept = viewerMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const viewerId = ctx.viewer._id;
    const call = await requireParty(ctx, callId, viewerId);
    if (!live(call)) throw new ConvexError("This call has ended.");
    if (call.callerId === viewerId || call.joinedIds?.includes(viewerId)) return;
    await ctx.db.patch(callId, {
      status: "active",
      answeredAt: call.answeredAt ?? Date.now(),
      joinedIds: [...(call.joinedIds ?? []), viewerId],
      declinedIds: (call.declinedIds ?? []).filter((id) => id !== viewerId),
    });
  },
});

export const decline = viewerMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const viewerId = ctx.viewer._id;
    const call = await requireParty(ctx, callId, viewerId);
    if (call.status !== "ringing" || call.callerId === viewerId) return;
    const declinedIds = [...new Set([...(call.declinedIds ?? []), viewerId])];
    if (call.calleeIds.every((id) => declinedIds.includes(id)))
      await finish(ctx, { ...call, declinedIds }, "declined", "declined");
    else await ctx.db.patch(callId, { declinedIds });
  },
});

/** Hang up. The call ends once fewer than two people are left in it. Idempotent. */
export const leave = viewerMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const viewerId = ctx.viewer._id;
    const call = await requireParty(ctx, callId, viewerId);
    if (!live(call) || !call.joinedIds?.includes(viewerId)) return;
    if (call.status === "ringing") {
      // Only the caller is in a ringing call; hanging up cancels it.
      await finish(ctx, call, "missed", "cancelled");
      return;
    }
    const joinedIds = call.joinedIds.filter((id) => id !== viewerId);
    if (joinedIds.length < 2) await finish(ctx, call, "ended", "answered");
    else await ctx.db.patch(callId, { joinedIds });
  },
});

/** One call as the viewer sees it; null when it doesn't exist or isn't theirs. */
export const get = viewerQuery({
  args: { callId: v.string() },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const callId = ctx.db.normalizeId("calls", args.callId);
    const call = callId ? await ctx.db.get(callId) : null;
    if (!call || !isParty(call, viewerId)) return null;
    const conv = await ctx.db.get(call.conversationId);
    if (!conv) return null;
    const users = await getSummaries(ctx, [call.callerId, ...call.calleeIds]);
    const pick = (ids: Id<"users">[]) =>
      ids.map((id) => users.get(id)).filter((u): u is UserSummary => u !== undefined);
    const others = pick([call.callerId, ...call.calleeIds].filter((id) => id !== viewerId));
    return {
      _id: call._id,
      conversationId: call.conversationId,
      kind: call.kind,
      status: call.status,
      startedAt: call.startedAt,
      answeredAt: call.answeredAt ?? null,
      endedAt: call.endedAt ?? null,
      role: call.callerId === viewerId ? ("caller" as const) : ("callee" as const),
      callerId: call.callerId,
      caller: users.get(call.callerId) ?? null,
      joinedIds: call.joinedIds ?? [],
      declinedIds: call.declinedIds ?? [],
      others,
      thread: {
        kind: conv.kind,
        name:
          conv.kind === "group"
            ? (conv.title ?? (others.map((o) => o.firstName).join(", ") || "Group chat"))
            : (others[0]?.name ?? "Facebook user"),
        photo: conv.kind === "group" ? (conv.photo ?? null) : (others[0]?.avatar ?? null),
      },
    };
  },
});

/** Calls ringing for the viewer right now (drives the incoming-call card). */
export const incoming = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const ringing = await ctx.db
      .query("calls")
      .withIndex("by_status", (q) => q.eq("status", "ringing"))
      .collect();
    const mine = ringing.filter(
      (c) =>
        c.calleeIds.includes(viewerId) &&
        !c.joinedIds?.includes(viewerId) &&
        !c.declinedIds?.includes(viewerId),
    );
    const users = await getSummaries(
      ctx,
      mine.map((c) => c.callerId),
    );
    const rows = await Promise.all(
      mine.map(async (c) => {
        const caller = users.get(c.callerId);
        const conv = await ctx.db.get(c.conversationId);
        if (!caller || !conv) return null;
        return {
          _id: c._id,
          kind: c.kind,
          startedAt: c.startedAt,
          caller,
          groupName: conv.kind === "group" ? (conv.title ?? "your group") : null,
        };
      }),
    );
    return rows.filter((r) => r !== null);
  },
});

/** WebRTC signaling: offer / answer / ICE candidate / mic+camera state for one peer. */
export const signal = viewerMutation({
  args: {
    callId: v.id("calls"),
    toId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice"), v.literal("media")),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toId, type, payload }) => {
    const viewerId = ctx.viewer._id;
    const call = await requireParty(ctx, callId, viewerId);
    if (call.status !== "active" || !isParty(call, toId)) return;
    if (payload.length > 64_000) throw new ConvexError("Signal too large");
    await ctx.db.insert("callSignals", {
      callId,
      fromId: viewerId,
      toId,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

/** Signals addressed to the viewer, oldest first. */
export const signals = viewerQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const viewerId = ctx.viewer._id;
    const rows = await ctx.db
      .query("callSignals")
      .withIndex("by_call_to", (q) => q.eq("callId", callId).eq("toId", viewerId))
      .collect();
    return rows.map((s) => ({ _id: s._id, fromId: s.fromId, type: s.type, payload: s.payload }));
  },
});

/** "Report a problem" from the call window's menu: one report per person and call. */
export const reportProblem = viewerMutation({
  args: { callId: v.id("calls"), reason: v.string() },
  handler: async (ctx, { callId, reason }) => {
    const userId = ctx.viewer._id;
    await requireParty(ctx, callId, userId);
    const text = reason.trim().slice(0, 1000);
    if (!text) throw new ConvexError("Tell us what went wrong.");
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", userId).eq("targetType", "call").eq("targetId", callId),
      )
      .first();
    if (existing) await ctx.db.patch(existing._id, { reason: text, createdAt: Date.now() });
    else
      await ctx.db.insert("reports", {
        userId,
        targetType: "call",
        targetId: callId,
        reason: text,
        createdAt: Date.now(),
      });
  },
});
