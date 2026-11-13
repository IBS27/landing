import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { defineTask, runAgent } from "./ai/agent";
import { cite } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { neighborhoodIdAt } from "./lib/neighborhoods";
import { dropDraft, logEvent, propose } from "./lib/proposals";
import { redactProtected } from "./lib/protectedText";
import {
  type SubletInput,
  type SubletMove,
  subletLadder,
  subletMoveProblems,
} from "./lib/subleases";
import { BADGE } from "./lib/trust";
import { photoInput, placeFor, resolvePhotos, validate } from "./listings";
import { negotiationMove } from "./validators";

/**
 * Subleases (#45). A sublet is an ordinary Marketplace rental with
 * `listingType: "sublet"`, so #11's verified badges and scam signals and #12's
 * vouching apply on its Landing listing view. The lister sets a lowest rent and
 * Muse (Spark) drafts replies to renters; every reply is a proposal (#6).
 */

const DAY = 24 * 60 * 60 * 1000;

const shortDate = (ts: number | undefined) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

/* ── The lister ───────────────────────────────────────────────────────── */

/** Lists a sublet on Marketplace and saves the lister's terms for Muse. */
export const create = viewerMutation({
  args: {
    title: v.string(),
    rent: v.number(),
    minRent: v.number(),
    description: v.string(),
    photos: v.array(photoInput),
    neighborhood: v.string(),
    propertyType: v.union(v.literal("apartment"), v.literal("room"), v.literal("studio")),
    bedrooms: v.number(),
    bathrooms: v.number(),
    availableFrom: v.number(),
    availableTo: v.number(),
    furnished: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const ownerId = ctx.viewer._id;
    const photos = await resolvePhotos(ctx, a.photos);
    validate({ title: a.title, price: a.rent, description: a.description }, photos.length);
    const rent = Math.round(a.rent);
    const minRent = Math.round(a.minRent);
    if (rent <= 0) throw new ConvexError("Enter the monthly rent");
    if (!Number.isFinite(minRent) || minRent <= 0 || minRent > rent)
      throw new ConvexError("Your lowest rent must be above $0 and no more than the rent");
    if (!Number.isFinite(a.availableFrom) || !Number.isFinite(a.availableTo))
      throw new ConvexError("Choose the dates it's available");
    if (a.availableTo <= a.availableFrom)
      throw new ConvexError("The end date must be after the start date");
    const now = Date.now();
    const location = placeFor(a.neighborhood);
    const listingId = await ctx.db.insert("listings", {
      sellerId: ownerId,
      title: a.title.trim(),
      price: rent,
      category: "propertyrentals",
      description: a.description.trim(),
      photos,
      location,
      neighborhoodId: await neighborhoodIdAt(ctx, location),
      status: "active",
      rental: {
        propertyType: a.propertyType,
        listingType: "sublet",
        bedrooms: a.propertyType === "studio" ? 0 : Math.max(1, Math.round(a.bedrooms)),
        bathrooms: Math.max(1, a.bathrooms),
        availableFrom: a.availableFrom,
        availableTo: a.availableTo,
        furnished: a.furnished,
      },
      // A verified account carries "Identity verified" (#11's badge levels).
      badges: ctx.viewer.verified ? [{ kind: BADGE.identity, label: "Identity verified" }] : [],
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
    });
    await ctx.db.insert("sublets", {
      listingId,
      ownerId,
      minRent,
      notes: a.notes?.trim() || undefined,
      museReplies: "active",
      createdAt: now,
      updatedAt: now,
    });
    return listingId;
  },
});

/** Change the lowest rent and notes, or pause Muse's replies. */
export const updateTerms = viewerMutation({
  args: {
    subletId: v.id("sublets"),
    minRent: v.optional(v.number()),
    notes: v.optional(v.string()),
    museReplies: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, { subletId, minRent, notes, museReplies }) => {
    const s = await ctx.db.get(subletId);
    if (!s || s.ownerId !== ctx.viewer._id) throw new ConvexError("Sublet not found");
    const listing = await ctx.db.get(s.listingId);
    if (
      minRent !== undefined &&
      (!Number.isFinite(minRent) || minRent <= 0 || (listing && minRent > listing.price))
    )
      throw new ConvexError("Your lowest rent must be above $0 and no more than the rent");
    const floor = minRent !== undefined ? Math.round(minRent) : s.minRent;
    await ctx.db.patch(s._id, {
      minRent: floor,
      ...(notes !== undefined ? { notes: notes.trim() || undefined } : {}),
      ...(museReplies ? { museReplies } : {}),
      updatedAt: Date.now(),
    });
    if (floor <= s.minRent) return;
    // A raised floor withdraws every waiting draft, and Muse drafts those replies again.
    const chats = await ctx.db
      .query("conversations")
      .withIndex("by_listing", (q) => q.eq("listingId", s.listingId))
      .collect();
    for (const c of chats) {
      const row = await ctx.db
        .query("subletChats")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .unique();
      const p = row?.pendingProposalId ? await ctx.db.get(row.pendingProposalId) : null;
      if (!row || p?.status !== "pending") continue;
      await retire(ctx, row);
      await ctx.db.patch(row._id, { pendingProposalId: undefined, handledThrough: 0 });
      if ((museReplies ?? s.museReplies) === "active")
        await ctx.scheduler.runAfter(0, internal.subleases.draftReply, { conversationId: c._id });
    }
  },
});

/** The viewer's sublets with their terms and how many renters have written. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sublets")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id))
      .order("desc")
      .collect();
    const out = [];
    for (const s of rows) {
      const l = await ctx.db.get(s.listingId);
      if (!l) continue;
      const chats = await ctx.db
        .query("conversations")
        .withIndex("by_listing", (q) => q.eq("listingId", l._id))
        .collect();
      let waiting = 0;
      for (const c of chats) {
        const sc = await ctx.db
          .query("subletChats")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .unique();
        const p = sc?.pendingProposalId ? await ctx.db.get(sc.pendingProposalId) : null;
        if (p?.status === "pending") waiting++;
      }
      out.push({
        _id: s._id,
        listingId: l._id,
        title: l.title,
        rent: l.price,
        status: l.status,
        photo: l.photos[0] ?? null,
        neighborhood: l.location.neighborhood ?? null,
        availableFrom: l.rental?.availableFrom ?? null,
        availableTo: l.rental?.availableTo ?? null,
        minRent: s.minRent,
        notes: s.notes ?? null,
        museReplies: s.museReplies,
        chats: chats.length,
        draftsWaiting: waiting,
      });
    }
    return out;
  },
});

/* ── Muse's replies ───────────────────────────────────────────────────── */

const replyOutput = v.object({
  move: negotiationMove,
  amount: v.number(),
  text: v.string(),
  rationale: v.string(),
});

const subletReply = defineTask<SubletInput, typeof replyOutput>({
  agent: "spark",
  name: "spark.subletReply",
  instructions: `You reply to a renter who messaged about the lister's sublet on Facebook Marketplace, writing the lister's ("you") next message.
Answer only from the listing facts given. Pick one move:
- message: answer a question or reply without changing the rent (amount = 0). Offer a tour when it fits.
- offer: counter the renter's rent. Between limits.minRent and listing.askingRent, and never above yourLastPrice.
- accept: the renter offered a rent at or above limits.minRent; agree (amount = that rent, capped at askingRent) and suggest seeing the place first.
- walk_away: the renter won't go up to limits.minRent; decline politely (amount = 0).
Be friendly and brief (one to three sentences). Use the lister's notes.
Never write a rent under limits.minRent, not even to quote the renter. Never share the street address, never ask for a deposit or any payment before a viewing and a signed sublease, and never mention payment apps.
rationale: one sentence to the lister on why this reply.`,
  output: replyOutput,
  cites: () => [],
  check: (out, input) => subletMoveProblems(out, input),
  fallback: (input) => subletLadder(input),
  effort: "low",
  cacheTtlMs: 0,
});

export const context = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv?.listingId) return null;
    const sublet = await ctx.db
      .query("sublets")
      .withIndex("by_listing", (q) => q.eq("listingId", conv.listingId as Id<"listings">))
      .unique();
    const listing = await ctx.db.get(conv.listingId);
    if (!sublet || !listing?.rental) return null;
    const chatRow = await ctx.db
      .query("subletChats")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .unique();
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(20);
    const sent = rows.reverse().filter((m) => m.status === "sent" && !m.unsent && m.text);
    const chat = sent.map((m) => ({
      from: m.senderId === sublet.ownerId ? ("you" as const) : ("renter" as const),
      text: redactProtected(m.text ?? ""),
    }));
    const lastRenterAt = Math.max(
      0,
      ...sent.filter((m) => m.senderId !== sublet.ownerId).map((m) => m.createdAt),
    );
    // The lister's last price is the last priced reply they actually sent.
    const props = await ctx.db
      .query("proposals")
      .withIndex("by_owner", (q) => q.eq("ownerId", sublet.ownerId))
      .order("desc")
      .take(200);
    const lastSent = props.find(
      (p) =>
        (p.status === "approved" || p.status === "edited") &&
        p.payload.kind === "offer" &&
        p.payload.conversationId === conversationId,
    );
    const r = listing.rental;
    const input: SubletInput = {
      listing: {
        title: redactProtected(listing.title),
        askingRent: listing.price,
        neighborhood: listing.location.neighborhood ?? null,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        furnished: r.furnished ?? null,
        availableFrom: shortDate(r.availableFrom),
        availableTo: shortDate(r.availableTo),
        description: redactProtected(listing.description.slice(0, 600)),
      },
      limits: {
        minRent: sublet.minRent,
        notes: sublet.notes ? redactProtected(sublet.notes) : null,
      },
      // Within today's limits: the floor may have risen since that reply.
      yourLastPrice:
        lastSent?.payload.kind === "offer"
          ? Math.min(listing.price, Math.max(sublet.minRent, lastSent.payload.amount))
          : null,
      chat,
    };
    return {
      sublet,
      listingOpen: listing.status === "active",
      chatRow,
      lastRenterAt,
      input,
    };
  },
});

/** Drafts the lister's reply after a renter writes. One draft waits per chat. */
export const draftReply = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.runQuery(internal.subleases.context, { conversationId });
    if (c?.sublet.museReplies !== "active" || !c.listingOpen) return;
    if (c.lastRenterAt <= (c.chatRow?.handledThrough ?? 0)) return;
    const result = await runAgent(ctx, subletReply, {
      input: c.input,
      // The listing facts come redacted in `input`; its raw description stays out of the model.
      sources: [],
      shownTo: c.sublet.ownerId,
    });
    // `check` already rejects bad moves; this re-check keeps the floor no matter what.
    const move: SubletMove =
      subletMoveProblems(result.output, c.input).length === 0
        ? result.output
        : subletLadder(c.input);
    if (subletMoveProblems(move, c.input).length > 0) return;
    await ctx.runMutation(internal.subleases.saveReply, {
      conversationId,
      ...move,
      handledThrough: c.lastRenterAt,
      termsAt: c.sublet.updatedAt,
      via: result.via,
      runId: result.runId,
    });
  },
});

export const saveReply = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    move: negotiationMove,
    amount: v.number(),
    text: v.string(),
    rationale: v.string(),
    handledThrough: v.number(),
    /** The terms revision this run drafted under (`sublets.updatedAt`, as #80's `limitsSetAt`). */
    termsAt: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, a) => {
    const conv = await ctx.db.get(a.conversationId);
    if (!conv?.listingId) return;
    const listingId = conv.listingId;
    const sublet = await ctx.db
      .query("sublets")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .unique();
    const listing = await ctx.db.get(listingId);
    if (sublet?.museReplies !== "active" || !listing) return;
    // Drafted under terms the lister has since changed: draft again under the new ones.
    if (a.termsAt !== sublet.updatedAt) {
      await ctx.scheduler.runAfter(0, internal.subleases.draftReply, {
        conversationId: a.conversationId,
      });
      return;
    }
    const priced = a.move === "offer" || a.move === "accept";
    if (priced && (a.amount < sublet.minRent || a.amount > listing.price))
      throw new ConvexError("Rent outside the lister's limits");

    const now = Date.now();
    let row = await ctx.db
      .query("subletChats")
      .withIndex("by_conversation", (q) => q.eq("conversationId", a.conversationId))
      .unique();
    // An older run finishing late never replaces a newer draft.
    if (row && row.handledThrough >= a.handledThrough) return;
    if (row) await retire(ctx, row);
    const proposalId = await propose(ctx, {
      ownerId: sublet.ownerId,
      payload: priced
        ? {
            kind: "offer",
            conversationId: a.conversationId,
            listingId,
            amount: a.amount,
            text: a.text,
          }
        : { kind: "message", conversationId: a.conversationId, text: a.text },
      rationale: a.rationale,
      citations: priced ? cite([{ kind: "listing", listingId }]) : undefined,
      origin: { agent: "spark", task: "spark.subletReply", runId: a.runId, via: a.via },
      ttlMs: priced ? DAY : undefined,
    });
    const fields = {
      pendingProposalId: proposalId,
      lastMove: a.move,
      handledThrough: a.handledThrough,
      updatedAt: now,
    };
    if (row) await ctx.db.patch(row._id, fields);
    else {
      const id = await ctx.db.insert("subletChats", {
        subletId: sublet._id,
        conversationId: a.conversationId,
        ...fields,
      });
      row = await ctx.db.get(id);
    }
  },
});

/** A newer reply replaces the draft still waiting in that chat. */
async function retire(ctx: Parameters<typeof dropDraft>[0], row: Doc<"subletChats">) {
  if (!row.pendingProposalId) return;
  const p = await ctx.db.get(row.pendingProposalId);
  if (p?.status !== "pending") return;
  const now = Date.now();
  await dropDraft(ctx, p);
  await ctx.db.patch(p._id, { status: "expired", decidedAt: now, updatedAt: now });
  await logEvent(ctx, p._id, p.ownerId, "expired", "system", now);
}
