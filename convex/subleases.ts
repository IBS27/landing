import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { defineTask, runAgent } from "./ai/agent";
import { cite } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { NEIGHBORHOODS } from "./lib/listings";
import { canSeeListing, currentPlace, placeSublet } from "./lib/myPlace";
import { locationPoint, neighborhoodIdAt } from "./lib/neighborhoods";
import { dropDraft, logEvent, propose } from "./lib/proposals";
import { redactProtected } from "./lib/protectedText";
import { factsForModel, renterTrust } from "./lib/renterTrust";
import {
  type SubletInput,
  type SubletMove,
  subletLadder,
  subletMoveProblems,
} from "./lib/subleases";
import { BADGE } from "./lib/trust";
import { photoInput, placeFor, resolvePhotos, validate } from "./listings";
import { insertMessage } from "./messenger";
import { syncProfile } from "./myPlace";
import { negotiationMove } from "./validators";

/**
 * Subleases (#45). A sublet is an ordinary Marketplace rental with
 * `listingType: "sublet"`, so #11's verified badges and scam signals and #12's
 * vouching apply on its Landing listing view. The lister sets a lowest rent and
 * Muse (Spark) drafts replies to renters; every reply is a proposal (#6).
 *
 * Move out as one flow (#141): a sublet can start from the lister's place
 * (`fromPlace` prefills the form, `placeId` links them), and Muse's replies
 * and the lister's view of each chat carry cited trust facts about the renter
 * (`renterTrust`).
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
    /** The viewer's current place, when listed from My Place. */
    placeId: v.optional(v.id("places")),
  },
  handler: async (ctx, a) => {
    const ownerId = ctx.viewer._id;
    if (a.placeId) {
      const place = await ctx.db.get(a.placeId);
      if (!place || place.userId !== ownerId || place.endedAt !== undefined)
        throw new ConvexError("Place not found");
      const open = await placeSublet(ctx, ownerId, place._id);
      if (open && open.status !== "sold")
        throw new ConvexError("You've already listed a sublet for this place");
    }
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
      neighborhoodId: await neighborhoodIdAt(ctx, locationPoint(location)),
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
      placeId: a.placeId,
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
        placeId: s.placeId ?? null,
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

/** The sublet form's neighborhood (a NEIGHBORHOODS name) for a place, or null. */
function formNeighborhood(names: (string | undefined)[]): string | null {
  for (const name of names) if (name && NEIGHBORHOODS.some((n) => n.name === name)) return name;
  return null;
}

/**
 * The sublet form filled in from the viewer's current place, or null with no
 * place. Listing facts (type, rooms, furnished, rent, photos) come from the
 * rental they took, while they can still see it; a place found elsewhere has
 * only its neighborhood and dates. Nothing is listed until they submit.
 */
export const fromPlace = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.viewer._id;
    const place = await currentPlace(ctx, userId);
    if (!place) return null;
    const [hood, listing, open] = await Promise.all([
      ctx.db.get(place.neighborhoodId),
      place.listingId && (await canSeeListing(ctx, userId, place.listingId))
        ? ctx.db.get(place.listingId)
        : null,
      placeSublet(ctx, userId, place._id),
    ]);
    const r = listing?.rental;
    const propertyType =
      r?.propertyType === "room" || r?.propertyType === "studio"
        ? r.propertyType
        : r
          ? ("apartment" as const)
          : null;
    const hoodName = hood ? (hood.shortName ?? hood.name) : null;
    return {
      placeId: place._id,
      status: place.status,
      title: hoodName ? `Sublet in ${hoodName}` : "",
      neighborhood: formNeighborhood([listing?.location.neighborhood, hood?.shortName, hood?.name]),
      propertyType,
      bedrooms: r ? r.bedrooms : null,
      bathrooms: r ? r.bathrooms : null,
      furnished: r?.furnished ?? null,
      rent: listing?.price ?? null,
      photos: listing?.photos ?? [],
      /** "YYYY-MM-DD": the planned move-out. */
      availableFrom: place.moveOut ?? null,
      /** The sublet already listed for this place and not yet taken. */
      open: open && open.status !== "sold" ? open : null,
    };
  },
});

/** The sublet a Marketplace chat is about, when `viewerId` is its lister, and the renter. */
async function listerChat(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  const conv = await ctx.db.get(conversationId);
  if (conv?.kind !== "marketplace" || !conv.listingId || !conv.memberIds.includes(viewerId))
    return null;
  const listingId = conv.listingId;
  const sublet = await ctx.db
    .query("sublets")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .unique();
  const renterId = conv.memberIds.find((id) => id !== viewerId);
  if (sublet?.ownerId !== viewerId || !renterId) return null;
  return { sublet, renterId };
}

/**
 * Trust facts about the renter in a sublet chat, each with its sources. Only
 * for the sublet's lister, and shown whether or not AI is on.
 */
export const renterTrustFor = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const chat = await listerChat(ctx, ctx.viewer._id, conversationId);
    return chat ? renterTrust(ctx, ctx.viewer._id, chat.renterId) : null;
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
renter lists what the lister's network says about the renter, each fact with its source. Use those facts only in rationale, naming the source ("Identity verified, per their Facebook profile"). Never put them in text: the renter doesn't see them. They never change the rent rules. Say nothing else about who the renter is.
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
    const renterId = conv.memberIds.find((id) => id !== sublet.ownerId);
    const trust = renterId ? await renterTrust(ctx, sublet.ownerId, renterId) : null;
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
      renter: trust ? factsForModel(trust.facts) : [],
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

/* ── Demo seed ────────────────────────────────────────────────────────── */

const byUsername = (ctx: QueryCtx, username: string) =>
  ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();

/**
 * Priya is moving out of her place in January (#141): her room's sublet is
 * linked to it, and a renter has written, so Muse drafts a reply with the
 * renter's trust facts. Maya's story (moving in) is untouched. Run by `seed:reset`.
 */
export const seedDemo = internalMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const [priya, renter, listing] = await Promise.all([
      byUsername(ctx, "priya.raman"),
      byUsername(ctx, "theo.grant"),
      ctx.db.get(listingId),
    ]);
    if (!priya || !renter || listing?.sellerId !== priya._id || !listing.neighborhoodId) return;
    if (await currentPlace(ctx, priya._id)) return;
    const now = Date.now();
    const placeId = await ctx.db.insert("places", {
      userId: priya._id,
      neighborhoodId: listing.neighborhoodId,
      moveIn: "2025-08-20",
      moveOut: "2027-01-04",
      status: "moving_out",
      createdAt: now,
      updatedAt: now,
    });
    await syncProfile(ctx, priya._id);
    await ctx.db.insert("sublets", {
      listingId,
      ownerId: priya._id,
      minRent: Math.round((listing.price * 0.92) / 25) * 25,
      notes: "Leaving for Copenhagen in early January. Flexible on the start date.",
      museReplies: "active",
      placeId,
      createdAt: now,
      updatedAt: now,
    });
    const conversationId = await ctx.db.insert("conversations", {
      kind: "marketplace",
      listingId,
      memberIds: [renter._id, priya._id],
      createdAt: now,
      lastMessageAt: now,
    });
    for (const userId of [renter._id, priya._id])
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId,
        lastReadAt: userId === renter._id ? now : 0,
        lastMessageAt: now,
      });
    // Through Messenger's own path, so Muse drafts Priya's reply as it would live.
    await insertMessage(ctx, conversationId, renter._id, {
      text: "Hi Priya! Is your room still available from January? I'm starting a co-op in the city then.",
      attachments: [],
    });
  },
});
