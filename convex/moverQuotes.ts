import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { defineTask, runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import { assertCitable, type CitedSource, type NonEmpty, resolveCitations } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { NEIGHBORHOODS } from "./lib/listings";
import {
  type CounterInput,
  type CounterMove,
  counterLadder,
  counterProblems,
  estimate,
  isWeekdayMove,
  MOVE_SIZES,
  type Move,
  quotedPrice,
  type RateCard,
  rateFromText,
  rateProblems,
} from "./lib/moverQuotes";
import { loadAudience } from "./lib/posts";
import { dropDraft, logEvent, propose } from "./lib/proposals";
import { getSummary } from "./lib/users";
import { citations, moveSize, rateCard } from "./validators";

/**
 * Mover quotes (#28). Moving companies are Facebook Pages (category "Movers").
 * Ember reads each Page's public posts for its rates and deals (cited); code
 * computes the estimate for the user's move; Spark drafts a quote request to
 * each mover, and every request is a proposal in the approval queue (#6).
 * Replies with a price show up as the mover's quote, side by side.
 */

const MOVERS = "Movers";

/* ── The user's move ──────────────────────────────────────────────────── */

export const saveRequest = viewerMutation({
  args: {
    size: moveSize,
    date: v.string(),
    fromNeighborhood: v.string(),
    toNeighborhood: v.string(),
    stairs: v.boolean(),
  },
  handler: async (ctx, a) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new ConvexError("Pick your move date");
    for (const n of [a.fromNeighborhood, a.toNeighborhood])
      if (!NEIGHBORHOODS.some((x) => x.name === n)) throw new ConvexError("Pick a neighborhood");
    const now = Date.now();
    const row = await ctx.db
      .query("moveRequests")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .unique();
    if (row) await ctx.db.patch(row._id, { ...a, updatedAt: now });
    else
      await ctx.db.insert("moveRequests", {
        userId: ctx.viewer._id,
        ...a,
        createdAt: now,
        updatedAt: now,
      });
  },
});

/** Reads the movers' rates and drafts a quote request to each, for approval. */
export const requestQuotes = viewerMutation({
  args: {},
  handler: async (ctx): Promise<Id<"aiJobs">> => {
    const req = await ctx.db
      .query("moveRequests")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .unique();
    if (!req) throw new ConvexError("Tell us about your move first");
    const now = Date.now();
    await ctx.db.patch(req._id, { requestedAt: now });
    return startJob(ctx, {
      kind: "moverQuotes",
      key: ctx.viewer._id,
      userId: ctx.viewer._id,
      action: internal.moverQuotes.gather,
      args: { userId: ctx.viewer._id, requestedAt: now },
    });
  },
});

/* ── Muse ─────────────────────────────────────────────────────────────── */

const ratesOutput = v.object({ ...rateCard.fields, sourceKeys: v.array(v.string()) });

const moverRates = defineTask<{ mover: string }, typeof ratesOutput>({
  agent: "ember",
  name: "ember.moverRates",
  instructions: `You read a moving company's Facebook Page posts and extract its published rates.
hourly: dollars per hour for the whole crew. crew: number of movers in that crew. minHours: the hour minimum. truckFee: any flat truck, trip or travel fee (0 if none).
discounts: each deal the posts state, with its percent and when it applies: "weekday" (midweek or Monday to Thursday), "student" (needs a student ID), or "always" (no condition at all).
A deal with any other condition (weekends, booking ahead, returning customers, a promo code, a minimum size), alone or on top of a weekday, is "other".
Use only what the posts say; never guess a number. sourceKeys: the keys of the posts you used.`,
  output: ratesOutput,
  cites: (o) => o.sourceKeys,
  check: (o) => rateProblems(o),
  fallback: (_input, sources) => {
    const card = rateFromText(sources.map((s) => s.snippet));
    if (!card) throw new Error("No rates found in this mover's posts");
    return { ...card, sourceKeys: sources.map((s) => s.key) };
  },
  effort: "low",
});

type OutreachInput = {
  mover: string;
  move: { size: string; date: string; from: string; to: string; stairs: boolean };
  estimate: number;
};
const outreachOutput = v.object({ text: v.string() });

const moverOutreach = defineTask<OutreachInput, typeof outreachOutput>({
  agent: "spark",
  name: "spark.moverOutreach",
  instructions: `Write a short, friendly Messenger message from the user to a moving company asking for a confirmed quote.
Include the move size, the date, the two neighborhoods and whether there are stairs. Mention the estimate from their posted rates and ask them to confirm a price or correct it.
Two to four sentences. Never include a street address, phone number or payment details.`,
  output: outreachOutput,
  cites: () => [],
  check: (o, input) => {
    const p: string[] = [];
    if (!o.text.trim() || o.text.length > 500) p.push("text must be 1 to 500 characters");
    if (!o.text.includes(input.move.date) && !o.text.includes(prettyDate(input.move.date)))
      p.push("text must say the move date");
    if (/\b\d{2,5}\s+\w+\s+(st|street|ave|avenue|blvd|rd|road)\b/i.test(o.text))
      p.push("text must not share a street address");
    return p;
  },
  fallback: (i) => ({
    text: `Hi! I'm moving a ${i.move.size.toLowerCase()} from ${i.move.from} to ${i.move.to} on ${prettyDate(i.move.date)}${i.move.stairs ? ", with stairs" : ", no stairs"}. Based on your posted rates I'm estimating about $${i.estimate}. Could you confirm a quote for that day?`,
  }),
  effort: "low",
  cacheTtlMs: 0,
});

function prettyDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const gatherContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const req = await ctx.db
      .query("moveRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const pages = (
      await ctx.db
        .query("users")
        .withIndex("by_persona", (q) => q.eq("isPersona", false))
        .collect()
    ).filter((u) => u.kind === "page" && u.pageCategory === MOVERS);
    const movers = [];
    for (const p of pages) {
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", p._id))
        .order("desc")
        .take(10);
      movers.push({
        pageId: p._id,
        name: p.name,
        postIds: posts.filter((x) => x.privacy === "public" && x.text).map((x) => x._id),
      });
    }
    return { req, movers };
  },
});

export const gather = internalAction({
  args: { jobId: v.id("aiJobs"), userId: v.id("users"), requestedAt: v.number() },
  handler: async (ctx, { jobId, userId, requestedAt }) => {
    await runJob(ctx, jobId, async (progress) => {
      const c = await ctx.runQuery(internal.moverQuotes.gatherContext, { userId });
      if (!c.req) throw new Error("No move request");
      const req = c.req;
      let done = 0;
      for (const m of c.movers) {
        await progress(`Reading ${m.name}`, done, c.movers.length * 2);
        // Rates are the same for everyone: read once from public posts and cached.
        const rates = await runAgent(ctx, moverRates, {
          input: { mover: m.name },
          sources: m.postIds.map((postId) => ({ kind: "post" as const, postId })),
          shownTo: "everyone",
        }).catch(() => null);
        if (!rates?.cited) continue;
        const { sourceKeys: _keys, ...card } = rates.output;
        await ctx.runMutation(internal.moverQuotes.saveRates, {
          pageId: m.pageId,
          card,
          citations: rates.cited,
          via: rates.via,
        });
        done++;
        const move: Move = { size: req.size, date: req.date, stairs: req.stairs };
        const est = estimate(card, move);
        await progress(`Drafting a request to ${m.name}`, done, c.movers.length * 2);
        const draft = await runAgent(ctx, moverOutreach, {
          input: {
            mover: m.name,
            move: {
              size: MOVE_SIZES.find((s) => s.id === req.size)?.label ?? req.size,
              date: req.date,
              from: req.fromNeighborhood,
              to: req.toNeighborhood,
              stairs: req.stairs,
            },
            estimate: est.total,
          },
          sources: [],
          shownTo: userId,
        });
        await ctx.runMutation(internal.moverQuotes.saveOutreach, {
          userId,
          pageId: m.pageId,
          text: draft.output.text,
          estimate: est.total,
          requestedAt,
          via: draft.via,
          runId: draft.runId,
        });
        done++;
      }
    });
  },
});

export const saveRates = internalMutation({
  args: {
    pageId: v.id("users"),
    card: rateCard,
    citations,
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
  },
  handler: async (ctx, a) => {
    await assertCitable(ctx, a.citations, "everyone");
    const row = await ctx.db
      .query("moverRates")
      .withIndex("by_page", (q) => q.eq("pageId", a.pageId))
      .unique();
    const doc = { ...a, extractedAt: Date.now() };
    if (row) await ctx.db.replace(row._id, doc);
    else await ctx.db.insert("moverRates", doc);
  },
});

/** Finds or starts the user's chat with the mover Page, then proposes the request there. */
export const saveOutreach = internalMutation({
  args: {
    userId: v.id("users"),
    pageId: v.id("users"),
    text: v.string(),
    estimate: v.number(),
    requestedAt: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, a) => {
    const req = await ctx.db
      .query("moveRequests")
      .withIndex("by_user", (q) => q.eq("userId", a.userId))
      .unique();
    // A newer "Get quotes" replaced this run.
    if (req?.requestedAt !== a.requestedAt) return;
    const now = Date.now();
    const mine = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", a.userId))
      .collect();
    let conversationId: Id<"conversations"> | null = null;
    for (const r of mine) {
      const c = await ctx.db.get(r.conversationId);
      if (c?.kind === "dm" && c.memberIds.includes(a.pageId)) conversationId = c._id;
    }
    if (!conversationId) {
      conversationId = await ctx.db.insert("conversations", {
        kind: "dm",
        memberIds: [a.userId, a.pageId],
        createdAt: now,
        lastMessageAt: now,
      });
      for (const userId of [a.userId, a.pageId])
        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId,
          lastReadAt: now,
          lastMessageAt: now,
        });
    }
    const page = await ctx.db.get(a.pageId);
    const proposalId = await propose(ctx, {
      ownerId: a.userId,
      payload: { kind: "message", conversationId, text: a.text },
      rationale: `Asks ${page?.name ?? "the mover"} to confirm a quote. Your estimate from their posted rates is $${a.estimate}.`,
      origin: { agent: "spark", task: "spark.moverOutreach", runId: a.runId, via: a.via },
    });
    const old = await ctx.db
      .query("moverOutreach")
      .withIndex("by_user_page", (q) => q.eq("userId", a.userId).eq("pageId", a.pageId))
      .unique();
    const row = {
      userId: a.userId,
      pageId: a.pageId,
      conversationId,
      proposalId,
      requestedAt: a.requestedAt,
    };
    if (old) {
      await expireIfPending(ctx, old.proposalId);
      if (old.counterProposalId) await expireIfPending(ctx, old.counterProposalId);
      await ctx.db.replace(old._id, row);
    } else await ctx.db.insert("moverOutreach", row);
  },
});

/** Expires a draft that a newer one replaces, if the user hasn't acted on it yet. */
async function expireIfPending(ctx: MutationCtx, proposalId: Id<"proposals">) {
  const p = await ctx.db.get(proposalId);
  if (p?.status !== "pending") return;
  const now = Date.now();
  await dropDraft(ctx, p);
  await ctx.db.patch(p._id, { status: "expired", decidedAt: now, updatedAt: now });
  await logEvent(ctx, p._id, p.ownerId, "expired", "system", now);
}

/* ── Side by side ─────────────────────────────────────────────────────── */

/** The viewer's move, and one column per mover: rates, estimate, deals, request status, quote. */
export const mine = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.viewer._id;
    const req = await ctx.db
      .query("moveRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const rates = await ctx.db.query("moverRates").collect();
    const audience = await loadAudience(ctx, userId);
    const movers = [];
    for (const r of rates) {
      const page = await getSummary(ctx, r.pageId);
      if (!page) continue;
      const out = await ctx.db
        .query("moverOutreach")
        .withIndex("by_user_page", (q) => q.eq("userId", userId).eq("pageId", r.pageId))
        .unique();
      const proposal = out ? await ctx.db.get(out.proposalId) : null;
      let quoted: { price: number; text: string; at: number } | null = null;
      let status: "none" | "waiting" | "sent" | "replied" | "discarded" = "none";
      if (out && proposal) {
        if (proposal.status === "pending") status = "waiting";
        else if (proposal.status === "approved" || proposal.status === "edited") status = "sent";
        else status = "discarded";
        if (status === "sent") {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", out.conversationId))
            .order("desc")
            .take(20);
          const reply = msgs.find(
            (m) =>
              m.senderId === r.pageId &&
              m.status === "sent" &&
              m.createdAt > (proposal.decidedAt ?? 0),
          );
          if (reply) {
            status = "replied";
            const price = quotedPrice(reply.text);
            if (price !== null) quoted = { price, text: reply.text ?? "", at: reply.createdAt };
          }
        }
      }
      // Muse's counter or acceptance still waiting for the user's OK.
      const counter = out?.counterProposalId ? await ctx.db.get(out.counterProposalId) : null;
      const counterWaiting = counter?.status === "pending";
      // Rates whose posts the viewer can't see (or that cite nothing) aren't shown.
      const sources: NonEmpty<CitedSource> | null = r.citations
        ? await resolveCitations(ctx, r.citations, audience)
        : null;
      if (!sources) continue;
      movers.push({
        counterWaiting,
        page,
        card: r.card as RateCard,
        via: r.via,
        sources,
        estimate: req
          ? estimate(r.card as RateCard, { size: req.size, date: req.date, stairs: req.stairs })
          : null,
        status,
        conversationId: out?.conversationId ?? null,
        quoted,
      });
    }
    movers.sort(
      (a, b) =>
        (a.quoted?.price ?? a.estimate?.total ?? 0) - (b.quoted?.price ?? b.estimate?.total ?? 0),
    );
    return { request: req, movers };
  },
});

/* ── Negotiating ──────────────────────────────────────────────────────── */

const counterOutput = v.object({
  move: v.union(v.literal("counter"), v.literal("accept")),
  text: v.string(),
  rationale: v.string(),
});

const moverCounter = defineTask<CounterInput, typeof counterOutput>({
  agent: "spark",
  name: "spark.moverCounter",
  instructions: `A moving company just quoted the user. Write the user's next Messenger message.
- counter: if bestOther is lower than theirQuote, politely ask them to match or beat it, naming that mover and price. Otherwise, if dealsToAsk has a deal, ask them to apply it.
- accept: only when there is no lower price and no deal to ask for; agree and ask to lock in the date.
Cite only prices and percents from the input. Friendly, two or three sentences. No address, phone number or payment details.
rationale: one sentence to the user on why this message.`,
  output: counterOutput,
  cites: () => [],
  check: (o, input) => counterProblems(o, input),
  fallback: (input) => counterLadder(input),
  effort: "low",
  cacheTtlMs: 0,
});

/** Everything the negotiator needs after a mover's reply in this chat. */
export const counterContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const out = await ctx.db
      .query("moverOutreach")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .first();
    if (!out) return null;
    const [req, page] = await Promise.all([
      ctx.db
        .query("moveRequests")
        .withIndex("by_user", (q) => q.eq("userId", out.userId))
        .unique(),
      ctx.db.get(out.pageId),
    ]);
    if (!req || !page) return null;
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(20);
    const reply = msgs.find((m) => m.senderId === out.pageId && m.status === "sent" && !m.unsent);
    const theirQuote = quotedPrice(reply?.text);
    if (!reply || theirQuote === null) return null;
    const move: Move = { size: req.size, date: req.date, stairs: req.stairs };

    // The lowest other price: another mover's quoted reply, else their estimate.
    const others = await ctx.db
      .query("moverOutreach")
      .withIndex("by_user", (q) => q.eq("userId", out.userId))
      .collect();
    let bestOther: CounterInput["bestOther"] = null;
    for (const o of others) {
      if (o.pageId === out.pageId) continue;
      const other = await ctx.db.get(o.pageId);
      const rates = await ctx.db
        .query("moverRates")
        .withIndex("by_page", (q) => q.eq("pageId", o.pageId))
        .unique();
      const om = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", o.conversationId))
        .order("desc")
        .take(20);
      const oq = quotedPrice(om.find((m) => m.senderId === o.pageId && m.status === "sent")?.text);
      const cand =
        oq !== null
          ? { mover: other?.name ?? "Another mover", price: oq, kind: "quote" as const }
          : rates
            ? {
                mover: other?.name ?? "Another mover",
                price: estimate(rates.card as RateCard, move).total,
                kind: "estimate" as const,
              }
            : null;
      if (cand && (!bestOther || cand.price < bestOther.price)) bestOther = cand;
    }
    const own = await ctx.db
      .query("moverRates")
      .withIndex("by_page", (q) => q.eq("pageId", out.pageId))
      .unique();
    // This mover's own deals that fit the move, worth asking about when their quote is above
    // what their posted rates and deal would come to.
    const ownEst = own ? estimate(own.card as RateCard, move) : null;
    const dealsToAsk =
      own && ownEst && theirQuote > ownEst.total
        ? (own.card as RateCard).discounts
            .filter((d) => d.when === "always" || (d.when === "weekday" && isWeekdayMove(req.date)))
            .map(({ label, percent }) => ({ label, percent }))
        : [];
    const input: CounterInput = {
      mover: page.name,
      theirQuote,
      bestOther,
      dealsToAsk,
      move: {
        size: MOVE_SIZES.find((s) => s.id === req.size)?.label ?? req.size,
        date: prettyDate(req.date),
      },
    };
    return {
      outreachId: out._id,
      userId: out.userId,
      handledThrough: out.handledThrough ?? 0,
      replyAt: reply.createdAt,
      input,
    };
  },
});

/** After a mover replies with a price, draft the user's counter or acceptance for approval. */
export const draftCounter = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.runQuery(internal.moverQuotes.counterContext, { conversationId });
    if (!c || c.replyAt <= c.handledThrough) return;
    const result = await runAgent(ctx, moverCounter, {
      input: c.input,
      sources: [],
      shownTo: c.userId,
    });
    // `check` already rejects bad drafts; this re-check keeps every cited number real.
    const move: CounterMove =
      counterProblems(result.output, c.input).length === 0 ? result.output : counterLadder(c.input);
    if (counterProblems(move, c.input).length > 0) return;
    await ctx.runMutation(internal.moverQuotes.saveCounter, {
      conversationId,
      text: move.text,
      rationale: move.rationale,
      replyAt: c.replyAt,
      via: result.via,
      runId: result.runId,
    });
  },
});

export const saveCounter = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    rationale: v.string(),
    replyAt: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, a) => {
    const out = await ctx.db
      .query("moverOutreach")
      .withIndex("by_conversation", (q) => q.eq("conversationId", a.conversationId))
      .first();
    // An older run finishing late never replaces a newer draft.
    if (!out || (out.handledThrough ?? 0) >= a.replyAt) return;
    if (out.counterProposalId) await expireIfPending(ctx, out.counterProposalId);
    const counterProposalId = await propose(ctx, {
      ownerId: out.userId,
      payload: { kind: "message", conversationId: a.conversationId, text: a.text },
      rationale: a.rationale,
      origin: { agent: "spark", task: "spark.moverCounter", runId: a.runId, via: a.via },
    });
    await ctx.db.patch(out._id, { counterProposalId, handledThrough: a.replyAt });
  },
});

/* ── Demo seed ────────────────────────────────────────────────────────── */

/** Three San Francisco moving companies as Pages, with rate and deal posts. Run by `seed:reset`. */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const DAY = 86_400_000;
    const movers = [
      {
        username: "fogcitymovers",
        name: "Fog City Movers",
        bio: "Local SF movers since 2014. Apartments, studios and stairs are our specialty.",
        posts: [
          "Rates for 2026: 2 movers + truck for $139/hr, 3-hour minimum. $79 truck fee covers fuel and pads. No hidden stair charges.",
          "Moving midweek? Get 15% off labor on Monday to Thursday moves this fall. Mention this post when you book.",
        ],
      },
      {
        username: "bayhaulco",
        name: "Bay Haul Co.",
        bio: "Small crew, careful hands. Studios to 3BRs anywhere in the city.",
        posts: [
          "Our pricing: 3 movers for $189/hr with a 2-hour minimum. Flat $99 truck fee, all blankets and wrap included.",
          "Students: 10% off with a valid student ID, any day of the week. Good luck with finals!",
        ],
      },
      {
        username: "goldengatemoving",
        name: "Golden Gate Moving",
        bio: "Licensed and insured. Same-week bookings for SF and the East Bay.",
        posts: [
          "2 movers and a 16 ft truck: $155/hr, 2-hour minimum, $59 trip fee.",
          "New this month: 10% off weekday moves (Mon to Thu) booked at least a week ahead.",
        ],
      },
    ];
    let made = 0;
    for (const m of movers) {
      const exists = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", m.username))
        .unique();
      if (exists) continue;
      const pageId = await ctx.db.insert("users", {
        name: m.name,
        firstName: m.name,
        username: m.username,
        avatar: "/seed/listings/moving-boxes-01.jpg",
        cover: "/seed/posts/moving-boxes-01.jpg",
        bio: m.bio,
        city: "San Francisco, California",
        verified: false,
        joinedAt: now - 900 * DAY,
        lastActiveAt: now - 3 * 3_600_000,
        isPersona: false,
        kind: "page",
        pageCategory: MOVERS,
        followerCount: 1200 + made * 850,
      });
      for (const [i, text] of m.posts.entries())
        await ctx.db.insert("posts", {
          authorId: pageId,
          text,
          media: [],
          attachments: [],
          privacy: "public",
          commentCount: 0,
          reactionCount: 0,
          shareCount: 0,
          createdAt: now - (12 - i * 5) * DAY,
        });
      made++;
    }
    return made;
  },
});
