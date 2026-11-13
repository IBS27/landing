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
import { defineTask, runAgent } from "./ai/agent";
import { runJob, startJob } from "./ai/jobs";
import { type CitedSource, type NonEmpty, resolveSources } from "./lib/citations";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { type Audience, loadAudience } from "./lib/posts";
import {
  BADGE,
  farAwaySignal,
  isNewAccount,
  type ListingSignal,
  lowPriceSignal,
  type NetworkEvidence,
  newAccountSignal,
  phraseFlags,
  RENTAL_SCAN_MAX,
  reusedPhotosSignal,
} from "./lib/trust";
import { getSummary, type UserSummary, userSummary } from "./lib/users";
import { listerNetwork } from "./lib/vouches";
import { chatFlag, chatFlagCategory } from "./validators";

/**
 * Verified listings and scam signals (#11), for Landing's listing view and
 * inline in Marketplace chats.
 *
 * - Signals on the listing are plain code (convex/lib/trust.ts), each with its
 *   reason and evidence. Listing-based evidence (comparables, the earlier
 *   listing with the same photos) is cited with #7's citations; profile-based
 *   evidence links to the lister's profile.
 * - The chat check reads the viewer's own Marketplace chat about the listing
 *   with Ember, falling back to a phrase list when AI is off. Results are per
 *   viewer and only ever returned to that viewer.
 * - Verified levels come from the listing's `badges`, which only seed or
 *   staff tools set (listing create and edit don't accept them):
 *   `identity_verified`, `property_verified`, and `toured` (label = the
 *   tourer's username, shown only when they're in the viewer's network).
 */

/** Marketplace chats about one listing read when looking for the viewer's. */
const CONVERSATION_SCAN_MAX = 500;
/** Messages the chat check reads, newest first. Flags on older messages are kept. */
export const CHAT_CHECK_WINDOW = 40;
/** Flags kept per chat, newest first. */
const CHAT_FLAGS_MAX = 100;
/** A chat is checked at most once per this long, even when asked again. */
export const CHAT_CHECK_COOLDOWN_MS = 30_000;
/** New listers whose network the Find list looks up, per query. */
const NETWORK_LOOKUPS_MAX = 6;
const CHECK_KIND = "rentalChatCheck";

type VerifiedBadge =
  | { kind: "identity" }
  | { kind: "property" }
  | { kind: "toured"; by: UserSummary; relation: "you" | "friend" | "friend_of_friend" };

/** The newest rentals, for medians. */
function recentRentals(ctx: QueryCtx) {
  return ctx.db
    .query("listings")
    .withIndex("by_category", (q) => q.eq("category", "propertyrentals"))
    .order("desc")
    .take(RENTAL_SCAN_MAX);
}

/** Rentals listed before `before`, newest first, for photo matches. */
function olderRentals(ctx: QueryCtx, before: number) {
  return ctx.db
    .query("listings")
    .withIndex("by_category", (q) => q.eq("category", "propertyrentals").lt("createdAt", before))
    .order("desc")
    .take(RENTAL_SCAN_MAX);
}

function networkEvidence(n: Awaited<ReturnType<typeof listerNetwork>>): NetworkEvidence | null {
  return n
    ? { relation: n.relation, mutualFriendCount: n.mutualFriendCount, vouchTotal: n.vouchTotal }
    : null;
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
    // Block-aware and bounded: null when either has blocked the other.
    const network = tourer ? await listerNetwork(ctx, viewerId, tourer._id) : null;
    const relation = network?.relation;
    if (tourer && relation && relation !== "none")
      out.push({ kind: "toured", by: userSummary(tourer), relation });
  }
  return out;
}

/** The viewer's Marketplace chat about this listing, unless they're its lister. */
async function viewerThread(ctx: QueryCtx, listing: Doc<"listings">, viewerId: Id<"users">) {
  if (listing.sellerId === viewerId) return null;
  const convs = await ctx.db
    .query("conversations")
    .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
    .take(CONVERSATION_SCAN_MAX);
  return (
    convs.find(
      (c) =>
        c.kind === "marketplace" &&
        c.memberIds.includes(viewerId) &&
        c.memberIds.includes(listing.sellerId),
    ) ?? null
  );
}

const checkKey = (conversationId: Id<"conversations">, viewerId: Id<"users">) =>
  `${conversationId}:${viewerId}`;

async function latestJob(ctx: QueryCtx, key: string) {
  return ctx.db
    .query("aiJobs")
    .withIndex("by_kind_key", (q) => q.eq("kind", CHECK_KIND).eq("key", key))
    .order("desc")
    .first();
}

/**
 * The viewer's chat check for one conversation:
 * - `checked`: covers every message so far.
 * - `checking`: a check is queued or running.
 * - `failed`: the last check for these messages failed (offer Try again).
 * - `needed`: never checked, or new messages since.
 */
export async function chatCheckState(
  ctx: QueryCtx,
  conv: Doc<"conversations">,
  viewerId: Id<"users">,
) {
  const [check, job] = await Promise.all([
    ctx.db
      .query("chatChecks")
      .withIndex("by_conversation_viewer", (q) =>
        q.eq("conversationId", conv._id).eq("viewerId", viewerId),
      )
      .unique(),
    latestJob(ctx, checkKey(conv._id, viewerId)),
  ]);
  const current = !!check && check.checkedThrough >= conv.lastMessageAt;
  const live = job?.status === "queued" || job?.status === "running";
  const status: "checked" | "checking" | "failed" | "needed" = current
    ? "checked"
    : live
      ? "checking"
      : job?.status === "failed" && job.createdAt >= conv.lastMessageAt
        ? "failed"
        : "needed";
  const flags = [];
  for (const f of check?.flags ?? []) {
    const m = await ctx.db.get(f.messageId);
    if (m?.text && !m.unsent && m.conversationId === conv._id)
      flags.push({ ...f, text: m.text, createdAt: m.createdAt });
  }
  return {
    conversationId: conv._id,
    lastMessageAt: conv.lastMessageAt,
    status,
    via: check?.via ?? null,
    flags,
  };
}

export type SignalView = Awaited<ReturnType<typeof signalView>>;

const nonEmpty = <T>(xs: T[]): NonEmpty<T> | null => (xs.length > 0 ? (xs as never) : null);

/** A signal as the client sees it: listing ids swapped for cited sources. */
async function signalView(ctx: QueryCtx, s: ListingSignal, audience: Audience) {
  const cited = async (ids: Id<"listings">[]): Promise<NonEmpty<CitedSource> | null> =>
    nonEmpty(
      await resolveSources(
        ctx,
        ids.map((listingId) => ({ kind: "listing" as const, listingId })),
        audience,
      ),
    );
  switch (s.kind) {
    case "low_price": {
      const { compIds, ...rest } = s;
      return { ...rest, sources: await cited(compIds) };
    }
    case "reused_photos": {
      const { listingIds, ...rest } = s;
      return { ...rest, sources: await cited(listingIds) };
    }
    default:
      return { ...s, sources: null };
  }
}

/** Everything Landing's listing view shows about trust. Null for non-rentals. */
export async function listingTrust(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  listingId: Id<"listings">,
) {
  const listing = await ctx.db.get(listingId);
  if (!listing?.rental) return null;
  const lister = await ctx.db.get(listing.sellerId);
  if (!lister) return null;
  const isOwn = lister._id === viewerId;
  const [recent, older, network, badges, thread, report, audience] = await Promise.all([
    isOwn ? [] : recentRentals(ctx),
    isOwn ? [] : olderRentals(ctx, listing.createdAt),
    isOwn ? null : listerNetwork(ctx, viewerId, lister._id),
    verifiedBadges(ctx, listing, viewerId),
    viewerThread(ctx, listing, viewerId),
    ctx.db
      .query("reports")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", viewerId).eq("targetType", "listing").eq("targetId", listingId),
      )
      .first(),
    loadAudience(ctx, viewerId),
  ]);

  const raw: ListingSignal[] = isOwn
    ? []
    : [
        lowPriceSignal(listing, recent),
        newAccountSignal(lister, networkEvidence(network)),
        reusedPhotosSignal(listing, older),
        farAwaySignal(listing, lister),
      ].filter((s): s is ListingSignal => s !== null);
  const signals = await Promise.all(raw.map((s) => signalView(ctx, s, audience)));

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
    lister: summary ? { ...summary, city: lister.city ?? null, joinedAt: lister.joinedAt } : null,
    isOwn,
    badges,
    signals,
    chat: thread ? await chatCheckState(ctx, thread, viewerId) : null,
    reported: !!report,
  };
}

export const forListing = viewerQuery({
  args: { listingId: v.id("listings") },
  handler: (ctx, { listingId }) => listingTrust(ctx, ctx.viewer._id, listingId),
});

/**
 * The chat check for a Marketplace chat about a rental, for inline notes in
 * Messenger. Null unless the viewer is the renter in that chat.
 */
export async function chatNotes(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  const conv = await ctx.db.get(conversationId);
  if (conv?.kind !== "marketplace" || !conv.listingId || !conv.memberIds.includes(viewerId))
    return null;
  const listing = await ctx.db.get(conv.listingId);
  if (
    !listing?.rental ||
    listing.sellerId === viewerId ||
    !conv.memberIds.includes(listing.sellerId)
  )
    return null;
  return { listingId: listing._id, ...(await chatCheckState(ctx, conv, viewerId)) };
}

export const forConversation = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: (ctx, { conversationId }) => chatNotes(ctx, ctx.viewer._id, conversationId),
});

/** Rentals for the Find page stub, with how many things to check each has. */
export const rentalsToReview = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const viewerId = ctx.viewer._id;
    const recent = await recentRentals(ctx);
    const live = recent.filter(
      (l) => l.status === "active" && l.rental && l.rental.listingType !== "sale",
    );
    // Network lookups for new listers, shared across their listings and capped per query.
    const networks = new Map<Id<"users">, NetworkEvidence | null>();
    const out = [];
    for (const l of live.slice(0, 24)) {
      const lister = await ctx.db.get(l.sellerId);
      if (!lister || lister._id === viewerId) continue;
      let network: NetworkEvidence | null = null;
      if (isNewAccount(lister)) {
        if (!networks.has(lister._id) && networks.size < NETWORK_LOOKUPS_MAX)
          networks.set(lister._id, networkEvidence(await listerNetwork(ctx, viewerId, lister._id)));
        network = networks.get(lister._id) ?? null;
      }
      const signals = [
        lowPriceSignal(l, recent),
        newAccountSignal(lister, network),
        reusedPhotosSignal(l, recent),
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

/** Words a chat-check reason must not use: things to check, never accusations. */
const ACCUSING = /\b(scam\w*|fraud\w*|con ?artist|fake)\b/i;

export const chatScamCheck = defineTask<ChatInput, typeof chatCheckOutput>({
  agent: "ember",
  name: "ember.rentalChatCheck",
  instructions: `You check a Marketplace chat about a rental for common rental warning signs, on behalf of the renter ("you").
Flag only messages from the lister that match one of these categories:
- deposit_before_viewing: asks for a deposit, first month, holding or application fee before an in-person viewing or signed lease.
- away_lister: says they can't show it in person (out of the country, traveling, will mail the keys).
- untraceable_payment: asks for wire, gift cards, crypto, or app payments that are hard to reverse.
- pressure: pushes to decide or pay right away.
- off_platform: moves the chat to text, email, WhatsApp or similar.
For each flag, write one short, calm sentence to the renter describing what the message says and why it's worth checking. Don't call the lister a scammer or the listing a scam or fake.
Return an empty list when nothing matches. Never flag the renter's own messages.`,
  output: chatCheckOutput,
  // Each flag points at the message it's about, which the UI quotes and links.
  cites: () => [],
  check: (out, input) => {
    const lister = new Set(input.messages.filter((m) => m.from === "lister").map((m) => m.id));
    return [
      ...out.flags
        .filter((f) => !lister.has(f.messageId))
        .map((f) => `flags ${f.messageId}, which isn't a message from the lister`),
      ...out.flags
        .filter((f) => ACCUSING.test(f.reason))
        .map((f) => `the reason for ${f.messageId} accuses the lister; describe what to check`),
    ];
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

/**
 * Starts the chat check for the viewer's chat about this listing.
 * - `current`: the last check already covers every message.
 * - `started`: a check is queued or running (an existing live one is reused).
 * - `wait`: a check started under CHAT_CHECK_COOLDOWN_MS ago; ask again after `retryInMs`.
 */
export async function requestCheck(
  ctx: MutationCtx,
  viewerId: Id<"users">,
  listingId: Id<"listings">,
  now = Date.now(),
): Promise<
  | { status: "current" }
  | { status: "started"; jobId: Id<"aiJobs"> }
  | { status: "wait"; retryInMs: number }
> {
  const listing = await ctx.db.get(listingId);
  const thread = listing?.rental ? await viewerThread(ctx, listing, viewerId) : null;
  if (!thread) throw new ConvexError("You don't have a chat about this rental");
  const state = await chatCheckState(ctx, thread, viewerId);
  if (state.status === "checked") return { status: "current" };
  const key = checkKey(thread._id, viewerId);
  const last = await latestJob(ctx, key);
  if (last && (last.status === "queued" || last.status === "running"))
    return { status: "started", jobId: last._id };
  if (last && last.createdAt > now - CHAT_CHECK_COOLDOWN_MS)
    return { status: "wait", retryInMs: last.createdAt + CHAT_CHECK_COOLDOWN_MS - now };
  const jobId = await startJob(ctx, {
    kind: CHECK_KIND,
    key,
    userId: viewerId,
    action: internal.trust.runChatCheck,
    args: { conversationId: thread._id, viewerId, listingId },
  });
  return { status: "started", jobId };
}

export const requestChatCheck = viewerMutation({
  args: { listingId: v.id("listings") },
  handler: (ctx, { listingId }) => requestCheck(ctx, ctx.viewer._id, listingId),
});

/** The newest messages of the viewer's own chat, labeled by who sent them. */
export const chatForCheck = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    viewerId: v.id("users"),
    listingId: v.id("listings"),
  },
  handler: async (ctx, { conversationId, viewerId, listingId }) => {
    const conv = await ctx.db.get(conversationId);
    if (
      conv?.kind !== "marketplace" ||
      conv.listingId !== listingId ||
      !conv.memberIds.includes(viewerId)
    )
      return null;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(CHAT_CHECK_WINDOW);
    const messages = rows
      .reverse()
      .filter((m) => m.status === "sent" && !m.unsent && m.text)
      .map((m) => ({
        id: m._id as string,
        from: m.senderId === viewerId ? ("you" as const) : ("lister" as const),
        text: m.text ?? "",
      }));
    return { messages, checkedIds: rows.map((m) => m._id), lastMessageAt: conv.lastMessageAt };
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
      const chat = await ctx.runQuery(internal.trust.chatForCheck, {
        conversationId,
        viewerId,
        listingId,
      });
      if (!chat) throw new Error("Chat not found");
      await progress("Reading the chat", 0, 1);
      // Only this viewer's chat, and only for them: never cached for anyone else.
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
        checkedIds: chat.checkedIds,
        checkedThrough: chat.lastMessageAt,
        via: result.via,
        runId: result.runId,
      });
      await progress("Done", 1, 1);
    });
  },
});

/**
 * Stores a check. Flags on messages this check read are replaced; flags on
 * older messages, outside its window, are kept.
 */
export async function saveCheck(
  ctx: MutationCtx,
  args: {
    conversationId: Id<"conversations">;
    viewerId: Id<"users">;
    listingId: Id<"listings">;
    flags: Doc<"chatChecks">["flags"];
    checkedIds: Id<"messages">[];
    checkedThrough: number;
    via: Doc<"chatChecks">["via"];
    runId?: Id<"aiRuns">;
  },
) {
  const { checkedIds, ...rest } = args;
  const row = await ctx.db
    .query("chatChecks")
    .withIndex("by_conversation_viewer", (q) =>
      q.eq("conversationId", args.conversationId).eq("viewerId", args.viewerId),
    )
    .unique();
  const read = new Set<string>(checkedIds);
  const kept = (row?.flags ?? []).filter((f) => !read.has(f.messageId));
  const flags = [...kept, ...args.flags].slice(-CHAT_FLAGS_MAX);
  // A slower, older run never overwrites a newer one.
  if (row && row.checkedThrough > args.checkedThrough) return;
  const doc = { ...rest, flags, createdAt: Date.now() };
  if (row) await ctx.db.patch(row._id, { ...doc, runId: args.runId });
  else await ctx.db.insert("chatChecks", doc);
}

export const saveChatCheck = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    viewerId: v.id("users"),
    listingId: v.id("listings"),
    flags: v.array(chatFlag),
    checkedIds: v.array(v.id("messages")),
    checkedThrough: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
  },
  handler: (ctx, args) => saveCheck(ctx, args),
});

/* ── Demo seed ──────────────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;

/**
 * A few San Francisco rentals that each trigger a signal, plus verified badges
 * on a real one, for the demo. Run by `seed:reset`. Keyed by username and
 * listing title, so running it again changes nothing.
 */
export const seedDemo = internalMutation({
  args: {},
  handler: (ctx) => seedTrustDemo(ctx),
});

export async function seedTrustDemo(ctx: MutationCtx, now = Date.now()) {
  const byName = (username: string) =>
    ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
  const maya = await byName("maya.chen");
  const derek = await byName("derek.holloway");
  if (!maya || !derek) return 0;
  const derekListings = await ctx.db
    .query("listings")
    .withIndex("by_seller", (q) => q.eq("sellerId", derek._id))
    .take(200);
  const derekMission = derekListings.find((l) => l.rental && l.location.neighborhood === "Mission");
  const rooms = await ctx.db
    .query("listings")
    .withIndex("by_category", (q) => q.eq("category", "propertyrentals"))
    .take(RENTAL_SCAN_MAX);
  const someRoom = rooms.find((l) => l.rental?.propertyType === "room" && l.photos.length > 1);

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

  const upsertUser = async (u: {
    name: string;
    username: string;
    avatar: string;
    city: string;
    joinedDaysAgo: number;
  }) =>
    (await byName(u.username))?._id ??
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

  const upsertRental = async (
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
  ) => {
    const existing = (
      await ctx.db
        .query("listings")
        .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
        .take(200)
    ).find((l) => l.title === r.title);
    if (existing) return existing._id;
    return ctx.db.insert("listings", {
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
  };

  // 1. Trips every signal: new account far away, low price, Derek's photos.
  const mark = await upsertUser({
    name: "Mark Davis",
    username: "mark.davis.rentals",
    avatar: "/seed/avatars/m-30.jpg",
    city: "Phoenix, Arizona",
    joinedDaysAgo: 6,
  });
  const scamId = await upsertRental(mark, {
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
    await upsertRental(tyler._id, {
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
    await upsertRental(chloe._id, {
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
  const linda = await upsertUser({
    name: "Linda Park",
    username: "linda.park.pdx",
    avatar: "/seed/avatars/w-30.jpg",
    city: "Portland, Oregon",
    joinedDaysAgo: 2300,
  });
  await upsertRental(linda, {
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
  const existingChat = await ctx.db
    .query("conversations")
    .withIndex("by_listing", (q) => q.eq("listingId", scamId))
    .first();
  if (existingChat) return 4;
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
}
