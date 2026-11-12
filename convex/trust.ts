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
import { runJob, startJob } from "./ai/jobs";
import { viewerMutation, viewerQuery } from "./lib/functions";
import {
  farAwaySignal,
  type ListingSignal,
  lowPriceSignal,
  newAccountSignal,
  phraseFlags,
  reusedPhotosSignal,
} from "./lib/trust";
import { friendIds, getSummary, type UserSummary } from "./lib/users";
import { listerNetwork } from "./lib/vouches";
import { chatFlag, chatFlagCategory } from "./validators";

/**
 * Verified listings and scam signals (#11), for Landing's listing view.
 *
 * - Signals on the listing are plain code (convex/lib/trust.ts), each with its
 *   reason and evidence.
 * - The chat check reads the lister's messages in the viewer's Marketplace
 *   chat with Ember, falling back to a phrase list when AI is off.
 * - Verified levels come from the listing's `badges`:
 *   `identity_verified`, `property_verified`, and `toured` (label = the
 *   tourer's username, shown only when they're in the viewer's network).
 */

export const BADGE = {
  identity: "identity_verified",
  property: "property_verified",
  toured: "toured",
} as const;

type VerifiedBadge =
  | { kind: "identity" }
  | { kind: "property" }
  | { kind: "toured"; by: UserSummary; relation: "you" | "friend" | "friend_of_friend" };

async function rentals(ctx: QueryCtx) {
  return ctx.db
    .query("listings")
    .withIndex("by_category", (q) => q.eq("category", "propertyrentals"))
    .collect();
}

async function verifiedBadges(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  viewerId: Id<"users">,
): Promise<VerifiedBadge[]> {
  const out: VerifiedBadge[] = [];
  const kinds = new Set(listing.badges.map((b) => b.kind));
  if (kinds.has(BADGE.identity)) out.push({ kind: "identity" });
  if (kinds.has(BADGE.property)) out.push({ kind: "property" });
  const toured = listing.badges.find((b) => b.kind === BADGE.toured);
  if (toured) {
    const tourer = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", toured.label))
      .unique();
    if (tourer) {
      const mine = new Set(await friendIds(ctx, viewerId));
      let relation: "you" | "friend" | "friend_of_friend" | null = null;
      if (tourer._id === viewerId) relation = "you";
      else if (mine.has(tourer._id)) relation = "friend";
      else if ((await friendIds(ctx, tourer._id)).some((id) => mine.has(id)))
        relation = "friend_of_friend";
      const by = relation ? await getSummary(ctx, tourer._id) : null;
      if (relation && by) out.push({ kind: "toured", by, relation });
    }
  }
  return out;
}

async function viewerThread(ctx: QueryCtx, listingId: Id<"listings">, viewerId: Id<"users">) {
  const convs = await ctx.db
    .query("conversations")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  return convs.find((c) => c.memberIds.includes(viewerId)) ?? null;
}

/** Everything Landing's listing view shows about trust. Null for non-rentals. */
export const forListing = viewerQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const viewerId = ctx.viewer._id;
    const listing = await ctx.db.get(listingId);
    if (!listing?.rental) return null;
    const lister = await ctx.db.get(listing.sellerId);
    if (!lister) return null;
    const isOwn = lister._id === viewerId;
    const [all, network, badges, thread, report] = await Promise.all([
      rentals(ctx),
      isOwn ? null : listerNetwork(ctx, viewerId, lister._id),
      verifiedBadges(ctx, listing, viewerId),
      viewerThread(ctx, listingId, viewerId),
      ctx.db
        .query("reports")
        .withIndex("by_user_target", (q) =>
          q.eq("userId", viewerId).eq("targetType", "listing").eq("targetId", listingId),
        )
        .first(),
    ]);

    const signals: ListingSignal[] = isOwn
      ? []
      : [
          lowPriceSignal(listing, all),
          newAccountSignal(lister, network),
          reusedPhotosSignal(listing, all),
          farAwaySignal(listing, lister),
        ].filter((s): s is ListingSignal => s !== null);

    let chat: {
      conversationId: Id<"conversations">;
      status: "unchecked" | "stale" | "checked";
      via: "model" | "cache" | "fallback" | null;
      flags: {
        messageId: Id<"messages">;
        category: Doc<"chatChecks">["flags"][number]["category"];
        reason: string;
        text: string;
        createdAt: number;
      }[];
    } | null = null;
    if (thread) {
      const check = await ctx.db
        .query("chatChecks")
        .withIndex("by_conversation_viewer", (q) =>
          q.eq("conversationId", thread._id).eq("viewerId", viewerId),
        )
        .unique();
      const flags = [];
      for (const f of check?.flags ?? []) {
        const m = await ctx.db.get(f.messageId);
        if (m?.text && !m.unsent) flags.push({ ...f, text: m.text, createdAt: m.createdAt });
      }
      chat = {
        conversationId: thread._id,
        status: !check
          ? "unchecked"
          : check.checkedThrough < thread.lastMessageAt
            ? "stale"
            : "checked",
        via: check?.via ?? null,
        flags,
      };
    }

    const summary = await getSummary(ctx, lister._id);
    return {
      listing: {
        _id: listing._id,
        title: listing.title,
        price: listing.price,
        photos: listing.photos,
        description: listing.description,
        status: listing.status,
        neighborhood: listing.location.neighborhood ?? null,
        city: listing.location.city,
        rental: listing.rental,
        createdAt: listing.createdAt,
      },
      lister: summary
        ? {
            ...summary,
            city: lister.city ?? null,
            joinedAt: lister.joinedAt,
            verified: lister.verified,
          }
        : null,
      isOwn,
      badges,
      signals,
      network: network
        ? {
            relation: network.relation,
            mutualFriendCount: network.mutualFriendCount,
            vouchTotal: network.vouchTotal,
          }
        : null,
      chat,
      reported: !!report,
    };
  },
});

/** Rentals for the Find page stub, with how many things to check each has. */
export const rentalsToReview = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const all = await rentals(ctx);
    const live = all
      .filter((l) => l.status === "active" && l.rental && l.rental.listingType !== "sale")
      .sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const l of live.slice(0, 40)) {
      const lister = await ctx.db.get(l.sellerId);
      if (!lister || lister._id === viewerId) continue;
      const signals = [
        lowPriceSignal(l, all),
        newAccountSignal(lister, null),
        reusedPhotosSignal(l, all),
        farAwaySignal(l, lister),
      ].filter(Boolean).length;
      const verified = l.badges.some((b) => b.kind === BADGE.identity || b.kind === BADGE.property);
      out.push({
        _id: l._id,
        title: l.title,
        price: l.price,
        photo: l.photos[0] ?? null,
        neighborhood: l.location.neighborhood ?? null,
        signals,
        verified,
      });
    }
    // Ones with something to check or a verified badge first: the demo set.
    return out
      .sort((a, b) => Number(b.signals > 0 || b.verified) - Number(a.signals > 0 || a.verified))
      .slice(0, 12);
  },
});

/* ── Chat check (Ember) ─────────────────────────────────────────────────── */

type ChatInput = { messages: { id: string; from: "lister" | "you"; text: string }[] };

const chatCheckOutput = v.object({
  flags: v.array(
    v.object({ messageId: v.id("messages"), category: chatFlagCategory, reason: v.string() }),
  ),
});

const chatScamCheck = defineTask<ChatInput, typeof chatCheckOutput>({
  agent: "ember",
  name: "ember.rentalChatCheck",
  instructions: `You check a Marketplace chat about a rental for common rental scam patterns, on behalf of the renter ("you").
Flag only messages from the lister that match one of these categories:
- deposit_before_viewing: asks for a deposit, first month, holding or application fee before an in-person viewing or signed lease.
- away_lister: says they can't show it in person (out of the country, traveling, will mail the keys).
- untraceable_payment: asks for wire, gift cards, crypto, or app payments that are hard to reverse.
- pressure: pushes to decide or pay right away.
- off_platform: moves the chat to text, email, WhatsApp or similar.
For each flag, write one short, calm sentence to the renter on why it's worth checking. Don't call the lister a scammer.
Return an empty list when nothing matches. Never flag the renter's own messages.`,
  output: chatCheckOutput,
  cites: () => [],
  check: (out, input) => {
    const lister = new Set(input.messages.filter((m) => m.from === "lister").map((m) => m.id));
    return out.flags
      .filter((f) => !lister.has(f.messageId))
      .map((f) => `flags ${f.messageId}, which isn't a message from the lister`);
  },
  fallback: (input) => ({
    flags: input.messages
      .filter((m) => m.from === "lister")
      .flatMap((m) =>
        phraseFlags(m.text).map((f) => ({
          messageId: m.id as Id<"messages">,
          category: f.category,
          reason: f.reason,
        })),
      ),
  }),
  effort: "low",
});

/** Starts (or reuses) the chat check for the viewer's chat about this listing. */
export const requestChatCheck = viewerMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }): Promise<Id<"aiJobs">> => {
    const viewerId = ctx.viewer._id;
    const thread = await viewerThread(ctx, listingId, viewerId);
    if (!thread) throw new ConvexError("You don't have a chat about this listing");
    return startJob(ctx, {
      kind: "rentalChatCheck",
      key: `${thread._id}:${viewerId}`,
      userId: viewerId,
      action: internal.trust.runChatCheck,
      args: { conversationId: thread._id, viewerId, listingId },
    });
  },
});

export const chatForCheck = internalQuery({
  args: { conversationId: v.id("conversations"), viewerId: v.id("users") },
  handler: async (ctx, { conversationId, viewerId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv?.memberIds.includes(viewerId)) return null;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(40);
    const messages = rows
      .reverse()
      .filter((m) => m.status === "sent" && !m.unsent && m.text)
      .map((m) => ({
        id: m._id as string,
        from: m.senderId === viewerId ? ("you" as const) : ("lister" as const),
        text: m.text ?? "",
      }));
    return { messages, lastMessageAt: conv.lastMessageAt };
  },
});

export const runChatCheck = internalAction({
  args: {
    jobId: v.id("aiJobs"),
    conversationId: v.id("conversations"),
    viewerId: v.id("users"),
    listingId: v.id("listings"),
  },
  handler: async (ctx, { jobId, conversationId, viewerId, listingId }) => {
    await runJob(ctx, jobId, async (progress) => {
      const chat = await ctx.runQuery(internal.trust.chatForCheck, { conversationId, viewerId });
      if (!chat) throw new Error("Chat not found");
      await progress("Reading the chat", 0, 1);
      const result = await runAgent(ctx, chatScamCheck, {
        input: { messages: chat.messages },
        sources: [{ kind: "listing", listingId }],
        shownTo: viewerId,
      });
      await ctx.runMutation(internal.trust.saveChatCheck, {
        conversationId,
        viewerId,
        listingId,
        flags: result.output.flags,
        checkedThrough: chat.lastMessageAt,
        via: result.via,
        runId: result.runId,
      });
      await progress("Done", 1, 1);
    });
  },
});

export const saveChatCheck = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    viewerId: v.id("users"),
    listingId: v.id("listings"),
    flags: v.array(chatFlag),
    checkedThrough: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatChecks")
      .withIndex("by_conversation_viewer", (q) =>
        q.eq("conversationId", args.conversationId).eq("viewerId", args.viewerId),
      )
      .unique();
    const doc = { ...args, createdAt: Date.now() };
    if (row) await ctx.db.replace(row._id, doc);
    else await ctx.db.insert("chatChecks", doc);
  },
});

/* ── Demo seed ──────────────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;

/**
 * A few San Francisco rentals that each trigger a signal, plus verified badges
 * on a real one, for the demo. Run by `seed:reset`.
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const byName = (username: string) =>
      ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
    const maya = await byName("maya.chen");
    const derek = await byName("derek.holloway");
    if (!maya || !derek) return 0;
    const all = await rentals(ctx);
    const derekMission = all.find(
      (l) => l.sellerId === derek._id && l.location.neighborhood === "Mission",
    );
    const someRoom = all.find((l) => l.rental?.propertyType === "room" && l.photos.length > 1);

    // Verified levels on Derek's real Mission 1BR, toured by Maya's friend Priya.
    if (derekMission)
      await ctx.db.patch(derekMission._id, {
        badges: [
          ...derekMission.badges.filter((b) => !Object.values(BADGE).includes(b.kind as never)),
          { kind: BADGE.identity, label: "Identity verified" },
          { kind: BADGE.property, label: "Property verified" },
          { kind: BADGE.toured, label: "priya.raman" },
        ],
      });

    const newUser = async (u: {
      name: string;
      username: string;
      avatar: string;
      city: string;
      joinedDaysAgo: number;
    }) =>
      ctx.db.insert("users", {
        name: u.name,
        firstName: u.name.split(" ")[0],
        username: u.username,
        avatar: u.avatar,
        city: u.city,
        verified: false,
        joinedAt: now - u.joinedDaysAgo * DAY,
        lastActiveAt: now - 2 * 60 * 60 * 1000,
        isPersona: false,
      });

    const rental = (
      sellerId: Id<"users">,
      r: {
        title: string;
        price: number;
        description: string;
        photos: string[];
        hood: string;
        lat: number;
        lng: number;
        propertyType: "apartment" | "room" | "studio";
        bedrooms: number;
        listedDaysAgo: number;
      },
    ) =>
      ctx.db.insert("listings", {
        sellerId,
        title: r.title,
        price: r.price,
        category: "propertyrentals",
        description: r.description,
        photos: r.photos,
        location: { city: "San Francisco, CA", neighborhood: r.hood, lat: r.lat, lng: r.lng },
        status: "active",
        rental: {
          propertyType: r.propertyType,
          listingType: "rent",
          bedrooms: r.bedrooms,
          bathrooms: 1,
          availableFrom: now + 7 * DAY,
          furnished: false,
        },
        badges: [],
        createdAt: now - r.listedDaysAgo * DAY,
        updatedAt: now - r.listedDaysAgo * DAY,
        viewCount: 40 + r.listedDaysAgo * 13,
      });

    // 1. Trips every signal: new account far away, low price, Derek's photos.
    const mark = await newUser({
      name: "Mark Davis",
      username: "mark.davis.rentals",
      avatar: "/seed/avatars/m-30.jpg",
      city: "Phoenix, Arizona",
      joinedDaysAgo: 6,
    });
    const scamId = await rental(mark, {
      title: "Sunny 1BR in the Mission, utilities included",
      price: 1600,
      description:
        "Beautiful top floor 1 bedroom with bay windows, hardwood floors and in-unit washer/dryer. All utilities included. Available now for a quiet, responsible tenant. Message me for details.",
      photos: derekMission?.photos.slice(0, 3) ?? [],
      hood: "Mission",
      lat: 37.7589,
      lng: -122.4183,
      propertyType: "apartment",
      bedrooms: 1,
      listedDaysAgo: 1,
    });

    // 2. Only the price: an established local lister, priced far under.
    const tyler = await byName("tyler.jensen");
    if (tyler)
      await rental(tyler._id, {
        title: "2BR in the Inner Sunset near Golden Gate Park",
        price: 2100,
        description:
          "Two bedrooms on Irving near 9th Ave. Steps from the N Judah and the park. Moving in with my partner and want someone reliable to take over the lease.",
        photos: ["/seed/rooms/bedroom-10.jpg", "/seed/rooms/bathroom-20.jpg"],
        hood: "Inner Sunset",
        lat: 37.7637,
        lng: -122.4665,
        propertyType: "apartment",
        bedrooms: 2,
        listedDaysAgo: 3,
      });

    // 3. Only reused photos: a fair-priced room whose photo appears on another lister's listing.
    const chloe = await byName("chloe.wright");
    if (chloe && someRoom)
      await rental(chloe._id, {
        title: "Room in a sunny Bernal Heights flat",
        price: 1450,
        description:
          "Furnished room in a 3BR flat on Cortland. Two easygoing roommates, shared kitchen, backyard. Month to month is fine.",
        photos: [someRoom.photos[0]],
        hood: "Bernal Heights",
        lat: 37.739,
        lng: -122.4156,
        propertyType: "room",
        bedrooms: 1,
        listedDaysAgo: 2,
      });

    // 4. Only far away: an owner who lives out of state, with an established account.
    const linda = await newUser({
      name: "Linda Park",
      username: "linda.park.pdx",
      avatar: "/seed/avatars/w-30.jpg",
      city: "Portland, Oregon",
      joinedDaysAgo: 2300,
    });
    await rental(linda, {
      title: "Studio in the Haight, owner managed",
      price: 2050,
      description:
        "Cozy studio in the lower Haight that I've owned for years. I live in Portland now, so my property manager does showings on weekends.",
      photos: ["/seed/rooms/bedroom-12.jpg", "/seed/rooms/bathroom-22.jpg"],
      hood: "Haight-Ashbury",
      lat: 37.7692,
      lng: -122.4481,
      propertyType: "studio",
      bedrooms: 0,
      listedDaysAgo: 4,
    });

    // Maya's chat with "Mark", with the classic lines.
    const lines: [Id<"users">, string, number][] = [
      [maya._id, "Hi! Is the Mission 1BR still available? Could I see it this weekend?", 26 * 60],
      [
        mark,
        "Hi Maya, yes it is! Unfortunately I'm out of the country for work right now so I can't show it in person.",
        25 * 60,
      ],
      [
        mark,
        "If you send the first month and deposit through Zelle to hold it, I'll mail you the keys this week.",
        25 * 60 - 2,
      ],
      [
        mark,
        "There's a lot of interest so I'd need to know today. You can also text me at my personal number.",
        25 * 60 - 3,
      ],
      [maya._id, "Oh ok, let me think about it", 24 * 60],
    ];
    const start = now - lines[0][2] * 60 * 1000;
    const conversationId = await ctx.db.insert("conversations", {
      kind: "marketplace",
      listingId: scamId,
      memberIds: [maya._id, mark],
      createdAt: start,
      lastMessageAt: start,
    });
    let last: Id<"messages"> | undefined;
    let lastAt = start;
    for (const [senderId, text, minsAgo] of lines) {
      lastAt = now - minsAgo * 60 * 1000;
      last = await ctx.db.insert("messages", {
        conversationId,
        senderId,
        author: { kind: "human" },
        status: "sent",
        text,
        attachments: senderId === maya._id && !last ? [{ kind: "listing", listingId: scamId }] : [],
        createdAt: lastAt,
      });
    }
    await ctx.db.patch(conversationId, { lastMessageAt: lastAt, lastMessageId: last });
    for (const userId of [maya._id, mark])
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId,
        lastReadAt: lastAt,
        lastMessageAt: lastAt,
      });
    return 4;
  },
});
