import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { type CitedSource, cite, type NonEmpty, resolveCitations } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { afterProposalApproved } from "./lib/inventory";
import { type Audience, loadAudience } from "./lib/posts";
import {
  assertPayload,
  assertSameTarget,
  dropDraft,
  executeProposal,
  inConversation,
  inGroup,
  isExpired,
  logEvent,
  propose as proposeImpl,
  syncDraft,
  waitingProposals,
} from "./lib/proposals";
import { getSummaries, type UserSummary } from "./lib/users";
import { citations, proposalOrigin, proposalPayload, type Source } from "./validators";

/* ── Writing ──────────────────────────────────────────────────────────── */

/**
 * The entry point for agent actions: `ctx.runMutation(internal.proposals.propose, ...)`
 * with `runAgent`'s output as the payload and its `cited` sources as citations.
 * It stores a proposal; it never sends anything.
 */
export const propose = internalMutation({
  args: {
    ownerId: v.id("users"),
    payload: proposalPayload,
    rationale: v.string(),
    citations: v.optional(citations),
    origin: proposalOrigin,
    ttlMs: v.optional(v.number()),
    byOwner: v.optional(v.boolean()),
  },
  handler: (ctx, args) => proposeImpl(ctx, args),
});

async function ownPending(
  ctx: Parameters<typeof logEvent>[0],
  viewerId: Id<"users">,
  proposalId: Id<"proposals">,
) {
  const p = await ctx.db.get(proposalId);
  if (!p || p.ownerId !== viewerId) throw new ConvexError("Proposal not found");
  if (isExpired(p)) throw new ConvexError("This proposal expired");
  if (p.status !== "pending") throw new ConvexError("This proposal was already handled");
  return p;
}

/** Saves the owner's changes without sending. The draft in the chat updates too. */
export const saveEdit = viewerMutation({
  args: { proposalId: v.id("proposals"), payload: proposalPayload },
  handler: async (ctx, { proposalId, payload }) => {
    const p = await ownPending(ctx, ctx.viewer._id, proposalId);
    assertSameTarget(p.payload, payload);
    await assertPayload(ctx, p.ownerId, payload, p.origin);
    const now = Date.now();
    await ctx.db.patch(p._id, { payload, original: p.original ?? p.payload, updatedAt: now });
    await syncDraft(ctx, { ...p, payload });
    await logEvent(ctx, p._id, p.ownerId, "edited", "owner", now);
  },
});

/**
 * The owner's yes. Optionally applies last-second edits, records the decision,
 * then runs the executor: the only place a proposal turns into a real action.
 */
export const approve = viewerMutation({
  args: { proposalId: v.id("proposals"), payload: v.optional(proposalPayload) },
  handler: async (ctx, { proposalId, payload }) => {
    let p = await ownPending(ctx, ctx.viewer._id, proposalId);
    const now = Date.now();
    if (payload && JSON.stringify(payload) !== JSON.stringify(p.payload)) {
      assertSameTarget(p.payload, payload);
      p = { ...p, payload, original: p.original ?? p.payload };
      await logEvent(ctx, p._id, p.ownerId, "edited", "owner", now);
    }
    const status = p.original ? "edited" : "approved";
    const result = await executeProposal(ctx, p);
    await ctx.db.patch(p._id, {
      payload: p.payload,
      original: p.original,
      status,
      result,
      decidedAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, p._id, p.ownerId, "approved", "owner", now);
    // An agreed Marketplace deal joins the buyer's inventory (#27).
    await afterProposalApproved(ctx, p, now);
    return result;
  },
});

/** The owner's no. The draft disappears from the chat. */
export const discard = viewerMutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, { proposalId }) => {
    const p = await ownPending(ctx, ctx.viewer._id, proposalId);
    const now = Date.now();
    await dropDraft(ctx, p);
    await ctx.db.patch(p._id, { status: "rejected", decidedAt: now, updatedAt: now });
    await logEvent(ctx, p._id, p.ownerId, "rejected", "owner", now);
  },
});

/** Scheduled at `expiresAt` by `propose()`. */
export const expire = internalMutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, { proposalId }) => {
    const p = await ctx.db.get(proposalId);
    if (p?.status !== "pending") return;
    const now = Date.now();
    if (p.expiresAt && p.expiresAt > now) return; // pushed back since
    await dropDraft(ctx, p);
    await ctx.db.patch(p._id, { status: "expired", decidedAt: now, updatedAt: now });
    await logEvent(ctx, p._id, p.ownerId, "expired", "system", now);
  },
});

/* ── Reading ──────────────────────────────────────────────────────────── */

type ConversationChip = {
  _id: Id<"conversations">;
  kind: Doc<"conversations">["kind"];
  /** Group title, or the other people's names. */
  title: string;
  people: UserSummary[];
};

async function conversationChip(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  viewerId: Id<"users">,
): Promise<ConversationChip | null> {
  const c = await ctx.db.get(conversationId);
  if (!c || !(await inConversation(ctx, conversationId, viewerId))) return null;
  const others = c.memberIds.filter((id) => id !== viewerId);
  const map = await getSummaries(ctx, others);
  const people = others.map((id) => map.get(id)).filter((u): u is UserSummary => !!u);
  return {
    _id: c._id,
    kind: c.kind,
    title: c.title ?? (people.map((u) => u.name).join(", ") || "Chat"),
    people,
  };
}

/**
 * What the owner sees of a proposal, or null when a cited source is now hidden
 * from them (see `citationsVisible`): then nothing it says is shown.
 */
async function proposalView(ctx: QueryCtx, p: Doc<"proposals">, a: Audience, now: number) {
  const pay = p.payload;
  const sources: NonEmpty<CitedSource> | null = p.citations
    ? await resolveCitations(ctx, p.citations, a)
    : null;
  if (p.citations && !sources) return null;
  const base = {
    _id: p._id,
    status: isExpired(p, now) ? ("expired" as const) : p.status,
    rationale: p.rationale,
    origin: p.origin,
    createdAt: p.createdAt,
    expiresAt: p.expiresAt ?? null,
    decidedAt: p.decidedAt ?? null,
    edited: !!p.original,
    sources,
    payload: pay,
    result: p.result ?? null,
  };
  switch (pay.kind) {
    case "message":
      return {
        ...base,
        kind: "message" as const,
        conversation: await conversationChip(ctx, pay.conversationId, p.ownerId),
      };
    case "offer": {
      const l = await ctx.db.get(pay.listingId);
      const seller = l ? await ctx.db.get(l.sellerId) : null;
      return {
        ...base,
        kind: "offer" as const,
        conversation: await conversationChip(ctx, pay.conversationId, p.ownerId),
        listing: l
          ? {
              _id: l._id,
              title: l.title,
              price: l.price,
              photo: l.photos[0] ?? null,
              status: l.status,
              // A lister's own reply (#45) is titled by the renter's chat instead.
              sellerName: l.sellerId === p.ownerId ? null : (seller?.name ?? null),
            }
          : null,
      };
    }
    case "event": {
      const map = await getSummaries(ctx, pay.inviteIds);
      // Only while the owner is still in it: a Group they left is no longer theirs to see.
      const group =
        pay.groupId && (await inGroup(ctx, pay.groupId, p.ownerId))
          ? await ctx.db.get(pay.groupId)
          : null;
      return {
        ...base,
        kind: "event" as const,
        invitees: pay.inviteIds.map((id) => map.get(id)).filter((u): u is UserSummary => !!u),
        group: group ? { name: group.name, slug: group.slug } : null,
      };
    }
    case "group": {
      const map = await getSummaries(ctx, pay.inviteIds);
      return {
        ...base,
        kind: "group" as const,
        invitees: pay.inviteIds.map((id) => map.get(id)).filter((u): u is UserSummary => !!u),
      };
    }
  }
}
export type ProposalView = NonNullable<Awaited<ReturnType<typeof proposalView>>>;

const present = <T>(x: T | null): x is T => x !== null;

/**
 * Everything waiting on the viewer: what expires soonest first, then newest.
 * Expired ones move to history.
 */
export const pending = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const { rows, audience: a } = await waitingProposals(ctx, ctx.viewer._id, now);
    const live = rows.sort(
      (x, y) =>
        (x.expiresAt ?? Number.POSITIVE_INFINITY) - (y.expiresAt ?? Number.POSITIVE_INFINITY) ||
        y.createdAt - x.createdAt,
    );
    return (await Promise.all(live.map((p) => proposalView(ctx, p, a, now)))).filter(present);
  },
});

/** The count badge on Inbox: the proposals `pending` shows. */
export const pendingCount = viewerQuery({
  args: {},
  handler: async (ctx) => {
    return (await waitingProposals(ctx, ctx.viewer._id, Date.now())).rows.length;
  },
});

/** Decided and expired proposals with their audit trail, newest first. */
export const history = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("proposals")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id))
      .order("desc")
      .take(100);
    const done = rows.filter((p) => p.status !== "pending" || isExpired(p, now)).slice(0, 40);
    const a = await loadAudience(ctx, ctx.viewer._id);
    const rowsOut = await Promise.all(
      done.map(async (p) => {
        const view = await proposalView(ctx, p, a, now);
        if (!view) return null;
        const events = await ctx.db
          .query("proposalEvents")
          .withIndex("by_proposal", (q) => q.eq("proposalId", p._id))
          .collect();
        return {
          ...view,
          events: events.map((e) => ({ action: e.action, actor: e.actor, at: e.at })),
        };
      }),
    );
    return rowsOut.filter(present);
  },
});

/** Pending chat drafts in one conversation, shown inline in the thread. */
export const forConversation = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const now = Date.now();
    const { rows, audience: a } = await waitingProposals(ctx, ctx.viewer._id, now);
    const mine = rows.filter(
      (p) =>
        (p.payload.kind === "message" || p.payload.kind === "offer") &&
        p.payload.conversationId === conversationId,
    );
    return (await Promise.all(mine.map((p) => proposalView(ctx, p, a, now)))).filter(present);
  },
});

/* ── Demo seed ────────────────────────────────────────────────────────── */

/**
 * A few proposals for Maya so the inbox and chats have something to show.
 * Run by `seed:reset` (and on its own with `convex run proposals:seedDemo`).
 * These stand in for what feature tasks will create through `runAgent`.
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const byName = async (username: string) =>
      ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
    const maya = await byName("maya.chen");
    if (!maya) return 0;
    const conversationsOf = async () => {
      const rows = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", maya._id))
        .collect();
      return Promise.all(rows.map((r) => ctx.db.get(r.conversationId)));
    };
    const convs = (await conversationsOf()).filter((c): c is Doc<"conversations"> => !!c);
    const dmWith = async (username: string) => {
      const u = await byName(username);
      return u ? convs.find((c) => c.kind === "dm" && c.memberIds.includes(u._id)) : undefined;
    };
    const groupBySlug = (slug: string) =>
      ctx.db
        .query("groups")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
    const groupPosts = async (slug: string, n: number) => {
      const g = await groupBySlug(slug);
      if (!g) return [];
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .order("desc")
        .take(n);
      return posts.map((p): Source => ({ kind: "post", postId: p._id }));
    };
    const tryCite = (sources: Source[]) =>
      sources.length ? cite([sources[0], ...sources.slice(1)]) : undefined;
    const HOUR = 60 * 60 * 1000;
    let made = 0;
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        made++;
      } catch (e) {
        console.warn("seedDemo skipped a proposal:", e instanceof Error ? e.message : e);
      }
    };

    // 1. Answer a buyer on Maya's own listing, from the listing's facts.
    for (const c of convs) {
      if (c.kind !== "marketplace" || !c.listingId) continue;
      const l = await ctx.db.get(c.listingId);
      if (!l) continue;
      if (l.sellerId === maya._id && l.status === "active") {
        await safe(() =>
          proposeImpl(ctx, {
            ownerId: maya._id,
            payload: {
              kind: "message",
              conversationId: c._id,
              text: `Yes, it's still available! Pickup works best Saturday after 10am, and I can help carry it down. Want me to hold it for you?`,
            },
            rationale:
              "The buyer asked if it's still available. Muse answered from your listing and kept your address private until you confirm a pickup.",
            citations: cite([{ kind: "listing", listingId: l._id }]),
            origin: { agent: "spark", task: "spark.buyerReply", via: "model" },
          }),
        );
        break;
      }
    }

    // 2. An offer on something Maya is buying. Time-sensitive, so it expires.
    for (const c of convs) {
      if (c.kind !== "marketplace" || !c.listingId) continue;
      const l = await ctx.db.get(c.listingId);
      if (!l || l.sellerId === maya._id || l.status !== "active" || l.price < 20) continue;
      if (l.category === "propertyrentals") continue;
      const amount = Math.round((l.price * 0.8) / 5) * 5;
      const seller = await ctx.db.get(l.sellerId);
      await safe(() =>
        proposeImpl(ctx, {
          ownerId: maya._id,
          payload: {
            kind: "offer",
            conversationId: c._id,
            listingId: l._id,
            amount,
            text: `Hi ${seller?.firstName ?? "there"}! Would you take $${amount} for the ${l.title.split(",")[0].toLowerCase()}? I can pick up tomorrow evening.`,
          },
          rationale: `Asking is $${l.price}. Similar listings nearby went for less, so Muse suggests opening about 20% under with a quick pickup.`,
          citations: cite([{ kind: "listing", listingId: l._id }]),
          origin: { agent: "spark", task: "spark.negotiate", via: "model" },
          ttlMs: 5 * HOUR,
        }),
      );
      break;
    }

    // 3. Invite a friend to a climbing night, citing the Group thread.
    const priyaDm = await dmWith("priya.raman");
    const climbing = await groupPosts("bay-area-climbers", 2);
    if (priyaDm)
      await safe(() =>
        proposeImpl(ctx, {
          ownerId: maya._id,
          payload: {
            kind: "message",
            conversationId: priyaDm._id,
            text: "Bay Area Climbers is doing a beginner bouldering night this Thursday. Want to come with me? I'll grab us day passes 🧗",
          },
          rationale:
            "Locals in Bay Area Climbers keep recommending the beginner night, and you said you want to climb more with friends.",
          citations: tryCite(climbing),
          origin: { agent: "spark", task: "spark.journeyInvite", via: "model" },
        }),
      );

    // 4. Chat talk turned into plans ("we should hike sometime") is proposed
    //    from Maya's real group chats by `chatPlans.seedDemo` (#34).

    // 5. The Move-in Crew Group is proposed from Maya's real crew by `crews.seedDemo` (#31).

    // History: one Maya approved earlier and one she discarded.
    const hannahDm = await dmWith("hannah.lee");
    if (hannahDm)
      await safe(async () => {
        const id = await proposeImpl(ctx, {
          ownerId: maya._id,
          payload: {
            kind: "message",
            conversationId: hannahDm._id,
            text: "Still on for Saturday? I'll bring snacks!",
          },
          rationale: "You and Hannah made Saturday plans earlier this week.",
          origin: { agent: "spark", task: "spark.reminder", via: "model" },
        });
        const p = await ctx.db.get(id);
        if (!p) return;
        const result = await executeProposal(ctx, p);
        const now = Date.now();
        await ctx.db.patch(id, { status: "approved", result, decidedAt: now, updatedAt: now });
        await logEvent(ctx, id, maya._id, "approved", "owner", now);
      });
    const ethanDm = await dmWith("ethan.park");
    if (ethanDm)
      await safe(async () => {
        const id = await proposeImpl(ctx, {
          ownerId: maya._id,
          payload: {
            kind: "message",
            conversationId: ethanDm._id,
            text: "Want to split a Costco run this weekend?",
          },
          rationale: "You and Ethan both mentioned stocking up for the new place.",
          origin: { agent: "spark", task: "spark.sharedRun", via: "fallback" },
        });
        const p = await ctx.db.get(id);
        if (!p) return;
        const now = Date.now();
        await dropDraft(ctx, p);
        await ctx.db.patch(id, { status: "rejected", decidedAt: now, updatedAt: now });
        await logEvent(ctx, id, maya._id, "rejected", "owner", now);
      });

    // Spread the demo drafts over the last few hours so they read naturally.
    const waiting = await ctx.db
      .query("proposals")
      .withIndex("by_owner", (q) => q.eq("ownerId", maya._id))
      .collect();
    const MIN = 60 * 1000;
    const ago = [12, 38, 95, 160, 240, 26 * 60, 30 * 60];
    for (const [i, p] of waiting.entries()) {
      const createdAt = Date.now() - (ago[i] ?? 60 * (i + 1)) * MIN;
      await ctx.db.patch(p._id, {
        createdAt,
        ...(p.decidedAt ? { decidedAt: createdAt + 20 * MIN } : {}),
      });
    }

    return made;
  },
});
