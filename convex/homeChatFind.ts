import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { Json } from "./ai/outputSchema";
import { type CitedSource, resolveCitations } from "./lib/citations";
import { todayInSF } from "./lib/cityProfileFacts";
import { compatibility, scoreLabel as matchLabel } from "./lib/compatibility";
import { vibeFromText } from "./lib/furnish";
import { joinGroupAction, rsvpAction, saveListingAction } from "./lib/homeChatActions";
import {
  type ChatCard,
  type ChatRentalCard,
  type ChatSource,
  rentalSource,
} from "./lib/homeChatRules";
import {
  type FactsOf,
  type Found,
  type FoundKind,
  foundKey,
  type GroupFacts,
  type HomeTool,
  type ListerFacts,
  listed,
  parseKey,
  type Recall,
  said,
  TOOL_RESULTS_MAX,
  type ToolViewer,
} from "./lib/homeChatThings";
import { type DealbreakerResult, fieldTopic } from "./lib/lifestyle";
import { categoryFor, conditionLabel, ITEM_CATEGORIES } from "./lib/listings";
import { approximatePoint, type LatLng } from "./lib/mapPins";
import {
  neighborhoodPage,
  type Place as PlaceSeed,
  placeKindLabel,
  placeSources,
  visibleGroups,
} from "./lib/neighborhoodPage";
import {
  type Audience,
  canView,
  eventVisible,
  isSaved,
  listingShownTo,
  loadAudience,
} from "./lib/posts";
import { redactProtected } from "./lib/protectedText";
import { comparableLifestyles } from "./lib/roommates";
import { hasTerm, matchListing } from "./lib/vibeMatch";
import { listerNetwork } from "./lib/vouches";
import { sharedScores } from "./neighborhoodScores";
import { rankedRentals } from "./rentals";
import { NEIGHBORHOOD_PLACES } from "./seed/world/neighborhoods/places";
import { listingTrust } from "./trust";
import type { Citations } from "./validators";

/**
 * How Muse searches Landing in Landing Home's chat (#154): rentals, Marketplace
 * items, Events, Groups, places and landmarks, neighborhoods and Weekend
 * Routes, and posts in Groups (informal plans that aren't Events). Every tool reads for the viewer only (blocks, privacy, membership),
 * with bounded reads, and returns `Found` things (convex/lib/homeChatThings.ts):
 * the facts Muse reads, and the card and links code builds for the chat.
 *
 * Text other people wrote reaches Muse only through `cap` (cut short,
 * protected traits and contact details removed). Addresses and exact listing
 * coordinates never do.
 */

/* ───────────── Limits ───────────── */

/** Newest listings scanned for Marketplace items. */
const ITEM_SCAN = 600;
/** Upcoming Events and active Groups scanned per search. */
const EVENT_SCAN = 300;
const GROUP_SCAN = 300;
/** How far ahead Events are searched: the default, and the most. */
const EVENT_DAYS = 30;
const EVENT_DAYS_MAX = 90;
/** An Event that started this long ago may still be on; one without an end lasts this long. */
const EVENT_LOOKBACK_MS = 2 * 24 * 60 * 60_000;
const EVENT_LENGTH_MS = 3 * 60 * 60_000;
const DAY = 24 * 60 * 60_000;
/** The viewer's RSVPs and an Event's "going" rows read. */
const RESPONSES_MAX = 500;
/** Cited facts read per neighborhood, and across the city for a place search. */
const FACTS_MAX = 200;
const FACTS_SCAN = 600;
/** Neighborhoods whose Group threads are read for mentions in one place search. */
const MENTION_HOODS_MAX = 2;
/** Sources shown with one thing. */
const SOURCES_MAX = 3;
/** Groups, Events and places listed with a neighborhood. */
const HOOD_THINGS = 3;
/** The viewer's units read for a remembered look. */
const UNITS_READ = 20;
/** Groups whose posts one post search reads, and the newest posts read in each. */
const POST_GROUPS_MAX = 12;
const POSTS_PER_GROUP = 25;
/** Members' Groups considered for a post search before the most active visible ones. */
const MY_GROUPS_READ = 30;
/** How far back posts are searched: the default, and the most. */
const POST_DAYS = 14;
const POST_DAYS_MAX = 60;
/** A Group's upcoming Events, and its newest posts, read for its details. */
const GROUP_EVENTS_SCAN = 40;
const GROUP_THINGS = 3;
const EXCERPT_MAX = 200;
const CARD_EXCERPT_MAX = 140;
const TITLE_MAX = 120;
const ABOUT_MAX = 200;
const DETAIL_MAX = 600;

/* ───────────── Text ───────────── */

/** Text someone else wrote, cleaned for Muse and the chat (`said`). */
export const cap = said;
/** For text Landing's own code or cited feeds wrote ("J Church"), which needs no redaction. */
export const uncut = (text: string, max: number) => text.trim().slice(0, max);

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const firstName = (u: { firstName?: string; name: string }) =>
  cap(u.firstName || u.name.split(" ")[0] || u.name, 40);
const isoDay = (ms: number) => todayInSF(ms);

const STOP_WORDS = new Set(
  "a an and any are around at for from i in is me my near of on or some that the this to with".split(
    " ",
  ),
);

/** The words of a search, lowercased, without filler. */
function terms(query: string | undefined): string[] {
  if (!query) return [];
  const words = redactProtected(query)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 8);
}

/** The search words a text names, as whole words; "desks" also finds "desk". */
function named(text: string, words: readonly string[]): string[] {
  const t = text.toLowerCase();
  return words.filter(
    (w) => hasTerm(t, w) || (w.length > 3 && w.endsWith("s") && hasTerm(t, w.slice(0, -1))),
  );
}

/* ───────────── Sources ───────────── */

const eventDay = (ms: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(ms);

/**
 * A cited record as a chat source the client can open. Code builds every link,
 * and only in-app ones: an outside page is named, never linked.
 */
export function sourceLink(s: CitedSource, label: typeof cap = cap): ChatSource | null {
  switch (s.kind) {
    case "listing":
      return rentalSource({ id: s.listingId, title: label(s.title, TITLE_MAX), price: s.price });
    case "event":
      return {
        label: `${label(s.title, TITLE_MAX)} · ${eventDay(s.startAt)}`,
        href: `/events/${s.eventId}`,
      };
    case "group":
      return { label: label(s.name, TITLE_MAX), href: `/groups/${s.slug}` };
    case "external":
      return { label: `${label(s.title, TITLE_MAX)} · ${label(s.publisher, 60)}` };
    case "post":
      return {
        label: `${firstName(s.author)}'s post${s.group ? ` in ${label(s.group.name, 80)}` : ""}`,
        href: `/${encodeURIComponent(s.author.username)}/posts/${s.postId}`,
      };
    case "comment":
      return {
        label: `${firstName(s.author)}'s comment${s.group ? ` in ${label(s.group.name, 80)}` : ""}`,
        href: `/${encodeURIComponent(s.postAuthorUsername)}/posts/${s.postId}?comment_id=${s.commentId}`,
      };
    default:
      return null;
  }
}

/** Up to `SOURCES_MAX` distinct links for the sources behind a thing. */
function sourceLinks(sources: readonly CitedSource[]): ChatSource[] {
  const out: ChatSource[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    // Titles other people wrote stay redacted; a transit feed's "J Church" doesn't.
    const link = s.kind === "external" ? sourceLink(s, uncut) : sourceLink(s);
    const key = link && (link.href ?? link.label);
    if (!link || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(link);
    if (out.length >= SOURCES_MAX) break;
  }
  return out;
}

const CARD_REASONS_MAX = 2;
const CARD_REASON_TEXT_MAX = 160;

/**
 * A ranked rental's reasons for its card: the strongest, each with the sources
 * it cites. Code wrote the lines (convex/lib/rentalFit.ts) and Find shows the
 * same ones, so a station named "Church St" stays whole.
 */
export function cardReasons(
  reasons: readonly { text: string; sources: readonly CitedSource[] }[],
): ChatRentalCard["reasons"] {
  return reasons.slice(0, CARD_REASONS_MAX).map((r) => ({
    text: uncut(r.text, CARD_REASON_TEXT_MAX),
    // Titles other people wrote stay redacted; a transit feed's "J Church" doesn't.
    sources: r.sources
      .flatMap((x) => (x.kind === "external" ? sourceLink(x, uncut) : sourceLink(x)) ?? [])
      .slice(0, SOURCES_MAX),
  }));
}

/* ───────────── One read of the viewer's world per query ───────────── */

type Hood = Doc<"neighborhoods">;
type Reasons = Awaited<ReturnType<typeof rankedRentals>>["results"][number]["reasons"];
type Response = Doc<"eventResponses">["status"];

/** What every tool needs about the viewer, read once and shared within a query. */
type Scope = {
  ctx: QueryCtx;
  viewer: ToolViewer;
  now: number;
  audience: Audience;
  hoodBySlug: Map<string, Hood>;
  hoodById: Map<Id<"neighborhoods">, Hood>;
  /** The viewer's RSVPs, by Event. */
  responses: () => Promise<Map<Id<"events">, Response>>;
  /** Why each ranked rental ranks where it does, by listing. */
  /** Their rentals ranked with no filters, read once per query. */
  ranked: () => ReturnType<typeof rankedRentals>;
  reasons: () => Promise<Map<string, Reasons>>;
  lister: (id: Id<"users">) => Promise<ListerFacts | null>;
};

const scopes = new WeakMap<QueryCtx, Map<string, Promise<Scope>>>();

/** The viewer's scope, built once per query however many things it reads. */
function scopeOf(ctx: QueryCtx, viewer: ToolViewer): Promise<Scope> {
  let byViewer = scopes.get(ctx);
  if (!byViewer) {
    byViewer = new Map();
    scopes.set(ctx, byViewer);
  }
  let scope = byViewer.get(viewer._id);
  if (!scope) {
    scope = loadScope(ctx, viewer);
    byViewer.set(viewer._id, scope);
  }
  return scope;
}

const once = <T>(load: () => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => {
    value ??= load();
    return value;
  };
};

async function loadScope(ctx: QueryCtx, viewer: ToolViewer): Promise<Scope> {
  const [audience, hoods] = await Promise.all([
    loadAudience(ctx, viewer._id),
    ctx.db.query("neighborhoods").take(200),
  ]);
  const listers = new Map<Id<"users">, Promise<ListerFacts | null>>();
  const ranked = once(() => rankedRentals(ctx, viewer._id));
  return {
    ctx,
    viewer,
    now: Date.now(),
    audience,
    hoodBySlug: new Map(hoods.map((n) => [n.slug, n])),
    hoodById: new Map(hoods.map((n) => [n._id, n])),
    responses: once(async () => {
      const rows = await ctx.db
        .query("eventResponses")
        .withIndex("by_user", (q) => q.eq("userId", viewer._id))
        .take(RESPONSES_MAX);
      return new Map(rows.map((r) => [r.eventId, r.status]));
    }),
    ranked,
    reasons: once(
      async () => new Map((await ranked()).results.map((r) => [r._id as string, r.reasons])),
    ),
    lister: (id) => {
      let facts = listers.get(id);
      if (!facts) {
        facts = listerFacts(ctx, viewer, id);
        listers.set(id, facts);
      }
      return facts;
    },
  };
}

const hoodLabel = (n: Hood) => n.shortName ?? n.name;
const hoodHref = (slug: string) => `/landing/find/neighborhoods/${slug}`;

/** The neighborhood for a slug Muse gave, or an error it can act on. */
function needHood(s: Scope, slug: string): Hood {
  const n = s.hoodBySlug.get(slug);
  if (!n)
    throw new ConvexError(
      `There is no neighborhood "${slug.slice(0, 60)}". Use a slug from input.neighborhoods.`,
    );
  return n;
}

const slugOf = (s: Scope, id: Id<"neighborhoods"> | undefined) =>
  (id && s.hoodById.get(id)?.slug) || null;
const labelOf = (s: Scope, id: Id<"neighborhoods"> | undefined) => {
  const n = id && s.hoodById.get(id);
  return n ? hoodLabel(n) : null;
};

/* ───────────── Arguments ───────────── */

const text = (x: unknown, max: number) =>
  typeof x === "string" && x.trim() ? x.trim().slice(0, max) : undefined;
const flag = (x: unknown) => (typeof x === "boolean" ? x : undefined);
/** A positive number, or an error Muse can act on. */
function positive(x: unknown, what: string, max: number): number | undefined {
  if (x === undefined || x === null) return undefined;
  if (typeof x !== "number" || !Number.isFinite(x) || x <= 0 || x > max)
    throw new ConvexError(`${what} must be a number from 1 to ${max}`);
  return x;
}

/* ───────────── Listers ───────────── */

/** A dealbreaker that was hit, as the Roommates page words it. */
function dealbreakerLine(d: DealbreakerResult, name: string): string {
  const topic = fieldTopic(d.field);
  const answer = d.answer ? `"${d.answer.label}"` : "that";
  return d.holder === "a"
    ? `Your dealbreaker "${d.label}": ${name} answered ${answer} for ${topic}`
    : `${name}'s dealbreaker "${d.label}": you answered ${answer} for ${topic}`;
}

const list = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/**
 * A rental's lister (or an item's seller) as the viewer may know them: how
 * they're connected through the viewer's network (`listerNetwork`, which names
 * only what profiles already show), and roommate compatibility.
 *
 * Compatibility follows the Roommates page's rules exactly: both people share
 * their lifestyle answers (`comparableLifestyles`), neither blocks the other,
 * and the lister is in the viewer's network (a friend, vouched for by a
 * friend, or a friend of a friend), since sharing promises the answers only to
 * "people who match with you". It carries the score and Landing's own
 * sentences for the allowlisted lifestyle topics, never a protected trait.
 * Null for the viewer themselves, a deleted account, or a block either way.
 */
export async function listerFacts(
  ctx: QueryCtx,
  viewer: ToolViewer,
  listerId: Id<"users">,
): Promise<ListerFacts | null> {
  if (listerId === viewer._id) return null;
  const lister = await ctx.db.get(listerId);
  if (!lister) return null;
  const network = await listerNetwork(ctx, viewer._id, listerId);
  if (!network) return null;
  const name = firstName(lister);

  const vouchers = network.vouches.filter((x) => x.via === "friend" || x.via === "you");
  const parts: string[] = [];
  if (network.relation === "friend") parts.push("friend");
  else if (network.relation === "friend_of_friend") parts.push("friend of a friend");
  if (vouchers.length > 0) {
    const names = vouchers.map((x) => (x.via === "you" ? "you" : firstName(x.voucher)));
    const more = vouchers.length > 2 ? ` and ${vouchers.length - 2} more` : "";
    parts.push(`vouched for by ${list(names.slice(0, 2))}${more}`);
  }

  const inNetwork =
    network.relation === "friend" ||
    network.relation === "friend_of_friend" ||
    vouchers.some((x) => x.via === "friend");
  let compat: ListerFacts["compatibility"] = null;
  if (inNetwork) {
    const both = await comparableLifestyles(ctx, viewer._id, [listerId]);
    const theirs = both?.others.get(listerId);
    if (both && theirs) {
      const c = compatibility(both.mine, theirs);
      compat = {
        score: c.score,
        label: matchLabel(c),
        shared: c.shared.slice(0, 6).map((t) => t.sentence),
        different: c.differences.slice(0, 6).map((t) => t.sentence),
        dealbreakers: c.dealbreakers.map((d) => dealbreakerLine(d, name)),
      };
    }
  }
  return {
    name,
    connection: parts.length ? parts.join(", ") : null,
    mutualFriends: network.mutualFriendCount,
    compatibility: compat,
  };
}

/* ───────────── Listings: rentals and Marketplace items ───────────── */

const NOT_ITEMS = new Set<string>(["propertyrentals", "homesales"]);
const isRental = (l: Doc<"listings">) => !!l.rental && l.rental.listingType !== "sale";
const isItem = (l: Doc<"listings">) => !l.rental && !NOT_ITEMS.has(l.category);
const categoryLabel = (l: Doc<"listings">) =>
  ITEM_CATEGORIES.find((c) => c.value === l.category)?.label ??
  categoryFor(l.category)?.label ??
  l.category;

/**
 * Whether a listing is one the viewer may be shown: active, its seller there,
 * not blocked, and not hidden from them as the seller's friend (`listingShownTo`).
 */
async function listingVisible(s: Scope, l: Doc<"listings">): Promise<boolean> {
  if (l.status !== "active" || !listingShownTo(l, s.audience)) return false;
  return (await s.ctx.db.get(l.sellerId)) !== null;
}

type ListingFacts = FactsOf<"listing">;

/** A rental as Muse reads it and the chat shows it, with why it ranks where it does. */
async function rentalFound(s: Scope, l: Doc<"listings">, reasons: Reasons): Promise<Found> {
  const rental = l.rental;
  const yours = l.sellerId === s.viewer._id;
  const [saved, lister] = await Promise.all([
    isSaved(s.ctx, s.viewer._id, "listing", l._id),
    yours ? null : s.lister(l.sellerId),
  ]);
  const title = cap(l.title, TITLE_MAX);
  const availableFrom =
    rental?.availableFrom && rental.availableFrom > s.now ? isoDay(rental.availableFrom) : null;
  const key = foundKey("listing", l._id);
  const facts: ListingFacts = {
    kind: "listing",
    key,
    id: l._id,
    type: "rental",
    title,
    price: l.price,
    neighborhood: slugOf(s, l.neighborhoodId),
    saved,
    availableFrom,
    listingType: rental?.listingType ?? "rent",
    bedrooms: rental?.bedrooms ?? null,
    bathrooms: rental?.bathrooms ?? null,
    // Code wrote these; only a transit line's own name ("J Church") skips redaction.
    reasons: reasons.map((r) =>
      r.kind === "transit" ? uncut(r.text, ABOUT_MAX) : cap(r.text, ABOUT_MAX),
    ),
    verified: l.badges.some(
      (b) => b.kind === "identity_verified" || b.kind === "property_verified",
    ),
    lister,
    ...(yours ? { yours: true } : {}),
  };
  return {
    key,
    facts,
    link: rentalSource({ id: l._id, title, price: l.price }),
    rental: {
      id: l._id,
      title,
      price: l.price,
      photo: l.photos[0] ?? null,
      neighborhood: labelOf(s, l.neighborhoodId),
      reasons: cardReasons(reasons),
      availableFrom,
    },
  };
}

export type RentalFilters = {
  maxPrice?: number;
  bedrooms?: number;
  pets?: boolean;
  furnished?: boolean;
  /** A neighborhood's slug. */
  neighborhood?: string;
};

/**
 * Rentals ranked for the viewer (`rankedRentals`), best first, optionally in
 * one neighborhood. `needsBrief` is set when they have no City Profile to rank by.
 */
export async function findRentals(
  ctx: QueryCtx,
  viewer: ToolViewer,
  filters: RentalFilters = {},
): Promise<{ found: Found[]; needsBrief: boolean }> {
  const s = await scopeOf(ctx, viewer);
  const hood = filters.neighborhood === undefined ? null : needHood(s, filters.neighborhood);
  const { maxPrice, bedrooms, pets, furnished } = filters;
  const unfiltered =
    maxPrice === undefined &&
    bedrooms === undefined &&
    pets === undefined &&
    furnished === undefined;
  const ranked = unfiltered
    ? await s.ranked()
    : await rankedRentals(ctx, viewer._id, {
        ...(maxPrice === undefined ? {} : { maxPrice }),
        ...(bedrooms === undefined ? {} : { bedrooms }),
        ...(pets === undefined ? {} : { pets }),
        ...(furnished === undefined ? {} : { furnished }),
      });
  const found: Found[] = [];
  for (const r of ranked.results) {
    if (found.length >= TOOL_RESULTS_MAX) break;
    if (hood && r.area?.slug !== hood.slug) continue;
    const l = await ctx.db.get(r._id);
    // `rankedRentals` already drops blocked listers; a deleted one has no page to open.
    if (l && (await listingVisible(s, l))) found.push(await rentalFound(s, l, r.reasons));
  }
  return { found, needsBrief: ranked.needsBrief };
}

/** A Marketplace item as Muse reads it and the chat shows it. `matches` says why it was found. */
async function itemFound(s: Scope, l: Doc<"listings">, matches: string[]): Promise<Found> {
  const yours = l.sellerId === s.viewer._id;
  const saved = await isSaved(s.ctx, s.viewer._id, "listing", l._id);
  const title = cap(l.title, TITLE_MAX);
  const key = foundKey("listing", l._id);
  const href = `/marketplace/item/${l._id}`;
  const condition = l.condition ? conditionLabel(l.condition) : null;
  const where =
    labelOf(s, l.neighborhoodId) ??
    (l.location.neighborhood ? cap(l.location.neighborhood, 60) : null);
  const { lat, lng } = l.location;
  const facts: ListingFacts = {
    kind: "listing",
    key,
    id: l._id,
    type: "item",
    title,
    price: l.price,
    neighborhood: slugOf(s, l.neighborhoodId),
    saved,
    category: categoryLabel(l),
    condition,
    matches,
    listed: isoDay(l.createdAt),
    ...(yours ? { yours: true } : {}),
  };
  const card: ChatCard = {
    key,
    kind: "item",
    title,
    lines: [[condition, where].filter(Boolean).join(" · "), matches[0] ?? ""]
      .filter(Boolean)
      .slice(0, 3),
    photo: l.photos[0] ?? null,
    price: l.price,
    href,
    // The approximate area only, as on the Marketplace map.
    ...(lat === undefined || lng === undefined
      ? {}
      : { point: approximatePoint(l._id, { lat, lng }) }),
    ...(saved || yours ? {} : { actions: [saveListingAction({ id: l._id, title })] }),
  };
  return {
    key,
    facts,
    link: { label: `${title} · ${l.price === 0 ? "Free" : money(l.price)}`, href },
    card,
  };
}

/** The look remembered for the viewer's apartment (Landing Home's furnishing), if any. */
async function rememberedVibe(s: Scope): Promise<string | null> {
  const units = await s.ctx.db
    .query("unitScenes")
    .withIndex("by_owner", (q) => q.eq("ownerId", s.viewer._id))
    .order("desc")
    .take(UNITS_READ);
  const vibe = units.find((u) => u.furnishing?.vibe?.trim())?.furnishing?.vibe?.trim();
  return vibe ? redactProtected(vibe) : null;
}

type ItemSearch = {
  /** Things named: "walnut desk". */
  query?: string;
  /** A look in words: "cozy mid-century, sage green". */
  vibe?: string;
  /** Use the look remembered for their apartment. */
  myVibe?: boolean;
  maxPrice?: number;
  neighborhood?: string;
  category?: string;
};

/**
 * Marketplace items for sale, best match first: the things `query` names, the
 * look `vibe` describes (or the one remembered for their apartment), or the
 * newest when neither is given. Never the viewer's own listings, a blocked
 * seller's, a rental or a home for sale.
 */
export async function findMarketplace(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: ItemSearch = {},
): Promise<{ found: Found[]; vibe: string | null; noRememberedVibe: boolean }> {
  const s = await scopeOf(ctx, viewer);
  const hood = a.neighborhood === undefined ? null : needHood(s, a.neighborhood);
  let category: string | undefined;
  if (a.category !== undefined) {
    const wanted = a.category.trim().toLowerCase();
    category = ITEM_CATEGORIES.find(
      (c) => c.value === wanted || c.label.toLowerCase() === wanted,
    )?.value;
    if (!category)
      throw new ConvexError(
        `There is no category "${a.category.slice(0, 40)}". Use one of: ${ITEM_CATEGORIES.map((c) => c.value).join(", ")}.`,
      );
  }
  const remembered = a.myVibe ? await rememberedVibe(s) : null;
  const look = [a.vibe ? redactProtected(a.vibe) : "", remembered ?? ""].join(" ").trim();
  const vibe = look ? vibeFromText(look) : null;
  const words = terms(a.query);

  const recent = await ctx.db
    .query("listings")
    .withIndex("by_created")
    .order("desc")
    .take(ITEM_SCAN);
  const pool = recent.filter(
    (l) =>
      l.status === "active" &&
      isItem(l) &&
      l.sellerId !== viewer._id &&
      !s.audience.blocked.has(l.sellerId) &&
      (a.maxPrice === undefined || l.price <= a.maxPrice) &&
      (!hood || l.neighborhoodId === hood._id) &&
      (!category || l.category === category),
  );

  const scored = pool.flatMap((l) => {
    // A named thing counts most in the title: "desk" in a chair's description is a weak match.
    const inTitle = named(l.title, words);
    const inAll = named(`${l.title} ${l.description}`, words);
    const m = vibe
      ? matchListing(vibe, {
          id: l._id,
          title: l.title,
          description: l.description,
          createdAt: l.createdAt,
        })
      : null;
    if (words.length && inAll.length === 0) return [];
    if (!words.length && vibe && (m?.score ?? 0) === 0) return [];
    const matches = [
      ...(inAll.length ? [`Names ${inAll.map((w) => `"${w}"`).join(", ")}`] : []),
      ...(m?.reasons ?? []),
    ];
    return [{ l, query: inTitle.length * 3 + inAll.length, look: m?.score ?? 0, matches }];
  });
  scored.sort((x, y) => y.query - x.query || y.look - x.look || y.l.createdAt - x.l.createdAt);

  const found: Found[] = [];
  // What the viewer can't open (a deleted seller) is skipped: check twice the cap, keep the cap.
  for (const x of scored.slice(0, TOOL_RESULTS_MAX * 2)) {
    if (found.length >= TOOL_RESULTS_MAX) break;
    if (await listingVisible(s, x.l)) found.push(await itemFound(s, x.l, x.matches));
  }
  return { found, vibe: look || null, noRememberedVibe: !!a.myVibe && !remembered };
}

/* ───────────── Events ───────────── */

const notOver = (e: Doc<"events">, now: number) => (e.endAt ?? e.startAt + EVENT_LENGTH_MS) > now;

const eventWhen = (ms: number) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(ms);

async function goingCount(s: Scope, e: Doc<"events">) {
  const going = await s.ctx.db
    .query("eventResponses")
    .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
    .take(RESPONSES_MAX);
  return e.externalGoingCount + going.length;
}

/** Whether the viewer may see an Event: its host there and not blocked, and Facebook's audience rules. */
async function eventOpen(s: Scope, e: Doc<"events">): Promise<boolean> {
  if (s.audience.blocked.has(e.hostId)) return false;
  const responded = (await s.responses()).has(e._id);
  if (!eventVisible(e, s.audience, responded)) return false;
  return (await s.ctx.db.get(e.hostId)) !== null;
}

/**
 * The Group hosting an Event, when the viewer can see that Group; null for
 * one they can't (a hidden Group they aren't in stays unnamed).
 */
async function hostGroup(s: Scope, e: Doc<"events">): Promise<Doc<"groups"> | null> {
  if (!e.groupId) return null;
  const g = await s.ctx.db.get(e.groupId);
  return g && groupOpen(s, g) ? g : null;
}

/**
 * An Event as Muse reads it and the chat shows it, with the Group hosting it
 * ("Hosted by …", linked, and cited with the Event). `host: false` leaves the
 * Group out, for an Event listed under that Group's own details.
 */
async function eventFound(
  s: Scope,
  e: Doc<"events">,
  { host: withHost = true }: { host?: boolean } = {},
): Promise<Found> {
  const [responses, going, host] = await Promise.all([
    s.responses(),
    goingCount(s, e),
    withHost ? hostGroup(s, e) : null,
  ]);
  const hostFound = host && groupFound(s, host);
  const status = responses.get(e._id);
  const yourResponse = status === "going" || status === "interested" ? status : null;
  const title = cap(e.title, TITLE_MAX);
  const startsAt = new Date(e.startAt).toISOString();
  const venue = e.online ? "Online" : e.venue ? cap(e.venue, 80) : null;
  const key = foundKey("event", e._id);
  const href = `/events/${e._id}`;
  const facts: FactsOf<"event"> = {
    kind: "event",
    key,
    id: e._id,
    title,
    startsAt,
    neighborhood: slugOf(s, e.neighborhoodId),
    yourResponse,
    venue,
    online: e.online,
    going,
    category: cap(e.category, 40),
    ...(host ? { hostedBy: groupRef(s, host) } : {}),
  };
  // A named venue is a public place; an address alone may be someone's home, so only its area.
  const point =
    e.online || !e.point ? undefined : e.venue ? e.point : approximatePoint(e._id, e.point);
  const card: ChatCard = {
    key,
    kind: "event",
    title,
    lines: [
      eventWhen(e.startAt),
      [venue, labelOf(s, e.neighborhoodId)].filter(Boolean).join(" · "),
      `${going} going`,
    ].filter(Boolean),
    photo: e.cover,
    href,
    ...(hostFound?.link ? { host: hostFound.link } : {}),
    ...(point ? { point } : {}),
    ...(yourResponse || e.hostId === s.viewer._id
      ? {}
      : { actions: [rsvpAction({ id: e._id, title, startsAt }, "interested")] }),
  };
  return {
    key,
    facts,
    link: { label: `${title} · ${eventDay(e.startAt)}`, href },
    card,
    ...(hostFound?.link ? { sources: [hostFound.link], related: [hostFound] } : {}),
  };
}

type EventSearch = { neighborhood?: string; query?: string; withinDays?: number };

/** Upcoming Events the viewer can see, soonest first; with `query`, the best matches first. */
export async function findEvents(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: EventSearch = {},
): Promise<Found[]> {
  const s = await scopeOf(ctx, viewer);
  const hood = a.neighborhood === undefined ? null : needHood(s, a.neighborhood);
  const until = s.now + Math.min(a.withinDays ?? EVENT_DAYS, EVENT_DAYS_MAX) * DAY;
  const from = s.now - EVENT_LOOKBACK_MS;
  const rows = hood
    ? await ctx.db
        .query("events")
        .withIndex("by_neighborhood", (q) =>
          q.eq("neighborhoodId", hood._id).gt("startAt", from).lt("startAt", until),
        )
        .take(EVENT_SCAN)
    : await ctx.db
        .query("events")
        .withIndex("by_start", (q) => q.gt("startAt", from).lt("startAt", until))
        .take(EVENT_SCAN);
  const words = terms(a.query);
  const matched = rows.flatMap((e) => {
    if (!notOver(e, s.now)) return [];
    const hits = named(`${e.title} ${e.category} ${e.venue ?? ""} ${e.description}`, words);
    return words.length && hits.length === 0 ? [] : [{ e, hits: hits.length }];
  });
  matched.sort((x, y) => y.hits - x.hits || x.e.startAt - y.e.startAt);
  const found: Found[] = [];
  for (const { e } of matched) {
    if (found.length >= TOOL_RESULTS_MAX) break;
    if (await eventOpen(s, e)) found.push(await eventFound(s, e));
  }
  return found;
}

/* ───────────── Groups ───────────── */

/** Visible Groups, plus hidden ones the viewer belongs to. */
const groupOpen = (s: Scope, g: Doc<"groups">) => g.visible || s.audience.groups.has(g._id);

/**
 * Whether the viewer may read a Group's posts, as its Discussion feed decides:
 * members always; others only in a public Group that isn't hidden.
 */
const postsOpen = (s: Scope, g: Doc<"groups">) =>
  s.audience.groups.has(g._id) || (g.privacy === "public" && g.visible);

/** A Group named by another thing's facts (an Event's host, a post's Group): the fields checks use. */
function groupRef(s: Scope, g: Doc<"groups">): GroupFacts {
  return {
    kind: "group",
    key: foundKey("group", g._id),
    id: g._id,
    name: cap(g.name, TITLE_MAX),
    privacy: g.privacy,
    joined: s.audience.groups.has(g._id),
    neighborhood: slugOf(s, g.neighborhoodId),
  };
}

function groupFound(s: Scope, g: Doc<"groups">): Found {
  const name = cap(g.name, TITLE_MAX);
  const joined = s.audience.groups.has(g._id);
  const key = foundKey("group", g._id);
  const href = `/groups/${g.slug}`;
  const facts: FactsOf<"group"> = {
    ...groupRef(s, g),
    members: g.memberCount,
    category: cap(g.category, 40),
    about: cap(g.description, ABOUT_MAX),
  };
  const card: ChatCard = {
    key,
    kind: "group",
    title: name,
    lines: [
      `${g.privacy === "public" ? "Public" : "Private"} group · ${g.memberCount.toLocaleString("en-US")} members`,
      labelOf(s, g.neighborhoodId) ?? "",
      joined ? "You're a member" : "",
    ].filter(Boolean),
    photo: g.cover,
    href,
    ...(g.point ? { point: g.point } : {}),
    // A private Group has its own way in; only a public one joins with a click.
    ...(g.privacy === "public" && !joined
      ? { actions: [joinGroupAction({ id: g._id, name })] }
      : {}),
  };
  return { key, facts, link: { label: name, href }, card };
}

type GroupSearch = { neighborhood?: string; query?: string };

/** Groups the viewer can see, most active first; with `query`, the best matches first. */
export async function findGroups(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: GroupSearch = {},
): Promise<Found[]> {
  const s = await scopeOf(ctx, viewer);
  const hood = a.neighborhood === undefined ? null : needHood(s, a.neighborhood);
  const rows = hood
    ? await ctx.db
        .query("groups")
        .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", hood._id))
        .order("desc")
        .take(GROUP_SCAN)
    : await ctx.db.query("groups").withIndex("by_activity").order("desc").take(GROUP_SCAN);
  const words = terms(a.query);
  const matched = rows.flatMap((g, i) => {
    if (!groupOpen(s, g)) return [];
    const hits = named(`${g.name} ${g.category} ${g.tags.join(" ")} ${g.description}`, words);
    return words.length && hits.length === 0 ? [] : [{ g, hits: hits.length, i }];
  });
  matched.sort((x, y) => y.hits - x.hits || x.i - y.i);
  return matched.slice(0, TOOL_RESULTS_MAX).map(({ g }) => groupFound(s, g));
}

/* ───────────── Group posts ───────────── */

const postDay = (ms: number) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(ms);

const plural = (n: number, one: string) =>
  `${n.toLocaleString("en-US")} ${one}${n === 1 ? "" : "s"}`;

/**
 * Whether a Group post shows to the viewer, as the Groups feed decides: a Group
 * whose posts they may read, Facebook's audience rules (blocks either way,
 * "only me"), an author still there, and some text to read.
 */
async function postOpen(s: Scope, p: Doc<"posts">, g: Doc<"groups">) {
  if (p.groupId !== g._id || !postsOpen(s, g) || p.sponsored || !p.text?.trim()) return null;
  if (!(await canView(s.ctx, p, s.audience))) return null;
  const author = await s.ctx.db.get(p.authorId);
  return author && author.kind !== "page" ? author : null;
}

/**
 * A Group post as Muse reads it and the chat shows it: the Group, a short
 * cleaned excerpt, the author's first name, when, how many comments, and a
 * link to the post. Never where anyone is, nor how to reach them.
 */
function postFound(s: Scope, p: Doc<"posts">, g: Doc<"groups">, author: Doc<"users">): Found {
  const group = groupFound(s, g);
  const by = firstName(author);
  const where = cap(g.name, 80);
  const excerpt = cap(p.text ?? "", EXCERPT_MAX);
  const key = foundKey("post", p._id);
  const href = `/${encodeURIComponent(author.username)}/posts/${p._id}`;
  const label = `${by}'s post in ${where}`;
  const facts: FactsOf<"post"> = {
    kind: "post",
    key,
    id: p._id,
    group: groupRef(s, g),
    author: by,
    postedAt: new Date(p.createdAt).toISOString(),
    excerpt,
    comments: p.commentCount,
  };
  const card: ChatCard = {
    key,
    kind: "post",
    title: label,
    lines: [
      `“${excerpt.length > CARD_EXCERPT_MAX ? `${excerpt.slice(0, CARD_EXCERPT_MAX - 1).trimEnd()}…` : excerpt}”`,
      `Posted ${postDay(p.createdAt)} · ${plural(p.commentCount, "comment")}`,
      "A Group post, not an Event",
    ],
    href,
  };
  return {
    key,
    facts,
    link: { label, href },
    card,
    ...(group.link ? { sources: [group.link] } : {}),
    related: [group],
  };
}

/** A Group's newest posts the viewer may read, since `since`, newest first. */
async function groupPosts(
  s: Scope,
  g: Doc<"groups">,
  since: number,
  take = POSTS_PER_GROUP,
): Promise<Doc<"posts">[]> {
  if (!postsOpen(s, g)) return [];
  return s.ctx.db
    .query("posts")
    .withIndex("by_group", (q) => q.eq("groupId", g._id).gte("createdAt", since))
    .order("desc")
    .take(take);
}

/** A Group Muse named by id, slug or key, if the viewer may read its posts. */
async function groupNamed(s: Scope, ref: string): Promise<Doc<"groups">> {
  const raw = ref.startsWith("group:") ? ref.slice("group:".length) : ref;
  const id = s.ctx.db.normalizeId("groups", raw);
  const g =
    (id && (await s.ctx.db.get(id))) ||
    (await s.ctx.db
      .query("groups")
      .withIndex("by_slug", (q) => q.eq("slug", raw))
      .first());
  // The same answer for a Group that doesn't exist and one they can't read, so neither leaks.
  if (!g || !groupOpen(s, g) || !postsOpen(s, g))
    throw new ConvexError(
      `There is no Group "${raw.slice(0, 60)}" whose posts they can read. Use a Group's id or slug from search_groups.`,
    );
  return g;
}

/**
 * The Groups a post search reads, most relevant first: one Group, a
 * neighborhood's Groups, or the viewer's own Groups and then the most active
 * visible ones. At most `POST_GROUPS_MAX`, each one whose posts they may read.
 */
async function postGroups(
  s: Scope,
  a: { group?: string; neighborhood?: string },
): Promise<Doc<"groups">[]> {
  if (a.group !== undefined) return [await groupNamed(s, a.group)];
  const out = new Map<Id<"groups">, Doc<"groups">>();
  const add = (g: Doc<"groups"> | null) => {
    if (g && out.size < POST_GROUPS_MAX && groupOpen(s, g) && postsOpen(s, g)) out.set(g._id, g);
  };
  if (a.neighborhood !== undefined) {
    const hood = needHood(s, a.neighborhood);
    const rows = await s.ctx.db
      .query("groups")
      .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", hood._id))
      .order("desc")
      .take(GROUP_SCAN);
    for (const g of rows) add(g);
    return [...out.values()];
  }
  const mine = await Promise.all(
    [...s.audience.groups].slice(0, MY_GROUPS_READ).map((id) => s.ctx.db.get(id)),
  );
  for (const g of mine
    .filter((g): g is Doc<"groups"> => g !== null)
    .sort((x, y) => y.lastActivityAt - x.lastActivityAt))
    add(g);
  if (out.size < POST_GROUPS_MAX) {
    const active = await s.ctx.db
      .query("groups")
      .withIndex("by_activity")
      .order("desc")
      .take(GROUP_SCAN);
    for (const g of active) add(g);
  }
  return [...out.values()];
}

type PostSearch = { group?: string; neighborhood?: string; query?: string; withinDays?: number };

/**
 * Recent posts in Groups the viewer may read: informal plans and notes (a
 * hike, a game night) that aren't Events. Newest first; with `query`, the
 * best matches first. Reads are bounded: at most `POST_GROUPS_MAX` Groups and
 * `POSTS_PER_GROUP` posts each, by index.
 */
export async function findGroupPosts(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: PostSearch = {},
): Promise<Found[]> {
  const s = await scopeOf(ctx, viewer);
  const groups = await postGroups(s, a);
  const since = s.now - Math.min(a.withinDays ?? POST_DAYS, POST_DAYS_MAX) * DAY;
  const words = terms(a.query);
  const rows = await Promise.all(
    groups.map(async (g) => ({ g, posts: await groupPosts(s, g, since) })),
  );
  const matched = rows.flatMap(({ g, posts }) =>
    posts.flatMap((p) => {
      const hits = named(p.text ?? "", words);
      return words.length && hits.length === 0 ? [] : [{ p, g, hits: hits.length }];
    }),
  );
  matched.sort((x, y) => y.hits - x.hits || y.p.createdAt - x.p.createdAt);
  const found: Found[] = [];
  for (const { p, g } of matched) {
    if (found.length >= TOOL_RESULTS_MAX) break;
    const author = await postOpen(s, p, g);
    if (author) found.push(postFound(s, p, g, author));
  }
  return found;
}

/**
 * What's happening in a Group, for the viewer: its next `GROUP_THINGS`
 * upcoming Events they can see, and its newest `GROUP_THINGS` posts they may
 * read (none when its posts are for members and they aren't one).
 */
async function groupActivity(
  s: Scope,
  g: Doc<"groups">,
): Promise<{ events: Found[]; posts: Found[] }> {
  const [eventRows, postRows] = await Promise.all([
    s.ctx.db
      .query("events")
      .withIndex("by_group", (q) => q.eq("groupId", g._id).gt("startAt", s.now - EVENT_LOOKBACK_MS))
      .take(GROUP_EVENTS_SCAN),
    groupPosts(s, g, 0, POSTS_PER_GROUP),
  ]);
  const events: Found[] = [];
  for (const e of eventRows) {
    if (events.length >= GROUP_THINGS) break;
    if (notOver(e, s.now) && (await eventOpen(s, e)))
      events.push(await eventFound(s, e, { host: false }));
  }
  const posts: Found[] = [];
  for (const p of postRows) {
    if (posts.length >= GROUP_THINGS) break;
    const author = await postOpen(s, p, g);
    if (author) posts.push(postFound(s, p, g, author));
  }
  return { events, posts };
}

/** A Group with what's happening in it: the facts gain `upcomingEvents` and `recentPosts`. */
async function groupInDepth(s: Scope, g: Doc<"groups">): Promise<Found> {
  const found = groupFound(s, g);
  const { events, posts } = await groupActivity(s, g);
  return {
    ...found,
    facts: {
      ...found.facts,
      upcomingEvents: events.map((f) => f.facts as Json),
      recentPosts: posts.map((f) => f.facts as Json),
      ...(postsOpen(s, g) ? {} : { postsNote: "Its posts are for members only." }),
    } as Found["facts"],
    related: [...events, ...posts],
  };
}

/** Words that only say a message is about a Group's activity, not which Group. */
const ACTIVITY_WORDS = new Set(
  "group groups club whats what happening going on new up planned plans lately latest posts post events event this week weekend".split(
    " ",
  ),
);

/**
 * The Group a message asks about ("what's happening in the climbing Group?"),
 * with its upcoming Events and recent posts, or null. `phrase` is the words
 * naming it (`groupAsked` in convex/lib/homeChatRules.ts). Picks the Group the
 * viewer can see whose name, category or tags hold every one of those words,
 * their own Groups first, then the most active; reads are bounded.
 */
export async function groupAskedAbout(
  ctx: QueryCtx,
  viewer: ToolViewer,
  phrase: string,
): Promise<Found | null> {
  const s = await scopeOf(ctx, viewer);
  const words = terms(phrase).filter((w) => !ACTIVITY_WORDS.has(w));
  if (!words.length) return null;
  const mine = await Promise.all(
    [...s.audience.groups].slice(0, MY_GROUPS_READ).map((id) => ctx.db.get(id)),
  );
  const active = await ctx.db
    .query("groups")
    .withIndex("by_activity")
    .order("desc")
    .take(GROUP_SCAN);
  const all = (text: string) => named(text, words).length === words.length;
  // Best first: the name says it all, then a Group they're in, then one whose posts they can read.
  const rank = (g: Doc<"groups">) =>
    (all(g.name) ? 4 : 0) + (s.audience.groups.has(g._id) ? 2 : 0) + (postsOpen(s, g) ? 1 : 0);
  const seen = new Set<Id<"groups">>();
  const candidates = [...mine, ...active].filter((g): g is Doc<"groups"> => {
    if (!g || seen.has(g._id)) return false;
    seen.add(g._id);
    return groupOpen(s, g) && all(`${g.name} ${g.category} ${g.tags.join(" ")}`);
  });
  // A stable sort keeps the newest activity first among equals.
  const g = candidates.sort((x, y) => rank(y) - rank(x))[0];
  return g ? groupInDepth(s, g) : null;
}

/* ───────────── Places and landmarks ───────────── */

/** A place Landing knows: one the neighborhood threads name, or a cited fact with a location. */
type PlaceRow = {
  key: string;
  name: string;
  /** "park", "cafe", "transit", "campus", "nightlife"… */
  type: string;
  typeLabel: string;
  slug: string;
  /** Cross streets, or what a cited fact says about it. */
  at: string | null;
  point: LatLng;
  /** The fact's own citations; a thread-named place is cited by the threads that name it. */
  citations?: Citations;
  seed?: PlaceSeed;
};

const SYSTEM_LABEL: Record<string, string> = {
  bart: "BART",
  muni_metro: "Muni Metro",
  caltrain: "Caltrain",
};

const seedRow = (p: PlaceSeed): PlaceRow => ({
  key: p.key,
  name: p.name,
  type: p.kind,
  typeLabel: placeKindLabel(p.kind),
  slug: p.neighborhood,
  at: p.at,
  point: p.point,
  seed: p,
});

/** A cited fact that is somewhere you can go: a station, a campus, a nightlife corridor. */
function factRow(s: Scope, f: Doc<"neighborhoodFacts">): PlaceRow | null {
  const slug = s.hoodById.get(f.neighborhoodId)?.slug;
  if (!slug) return null;
  switch (f.kind) {
    case "transit_station":
      return {
        key: f.key,
        name: `${f.name} station`,
        type: "transit",
        typeLabel: `${SYSTEM_LABEL[f.system] ?? "Transit"} station`,
        slug,
        at: f.lines.length ? `Lines: ${f.lines.join(", ")}` : null,
        point: f.point,
        citations: f.citations,
      };
    case "campus":
      return {
        key: f.key,
        name: f.name,
        type: "campus",
        typeLabel: "Campus",
        slug,
        at: uncut(f.detail, ABOUT_MAX),
        point: f.point,
        citations: f.citations,
      };
    case "nightlife_corridor": {
      const mid = f.path[Math.floor(f.path.length / 2)];
      return mid
        ? {
            key: f.key,
            name: f.name,
            type: "nightlife",
            typeLabel: "Nightlife corridor",
            slug,
            at: uncut(f.detail, ABOUT_MAX),
            point: mid,
            citations: f.citations,
          }
        : null;
    }
    default:
      return null;
  }
}

/** A place as Muse reads it and the chat shows it. `sources` is undefined when nobody looked. */
function placeFound(s: Scope, p: PlaceRow, sources?: readonly CitedSource[]): Found {
  const key = foundKey("place", p.key);
  const hood = s.hoodBySlug.get(p.slug);
  const where = hood ? hoodLabel(hood) : p.slug;
  const facts: FactsOf<"place"> = {
    kind: "place",
    key,
    name: p.name,
    type: p.type,
    neighborhood: p.slug,
    at: p.at,
    // How many Group threads or cited sources back it; null when they weren't read.
    mentionedIn: sources ? sources.length : null,
  };
  const card: ChatCard = {
    key,
    kind: "place",
    title: p.name,
    lines: [`${p.typeLabel} · ${where}`, p.at ?? ""].filter(Boolean),
    href: hoodHref(p.slug),
    point: p.point,
  };
  return {
    key,
    facts,
    link: { label: `${p.name} · ${where}`, href: hoodHref(p.slug) },
    ...(sources?.length ? { sources: sourceLinks(sources) } : {}),
    card,
  };
}

/** What people call a kind of place, for `type`. */
const TYPE_WORDS: Readonly<Record<string, string>> = {
  coffee: "cafe",
  "coffee shop": "cafe",
  food: "restaurant",
  eat: "restaurant",
  pub: "bar",
  station: "transit",
  bart: "transit",
  muni: "transit",
  caltrain: "transit",
  university: "campus",
  college: "campus",
  school: "campus",
  bars: "bar",
  view: "viewpoint",
  lookout: "viewpoint",
  hike: "trail",
  venue: "music-venue",
  "live music": "music-venue",
  "farmers market": "market",
  stairs: "stairway",
  gym: "climbing-gym",
};

const flat = (x: string) =>
  x
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const singular = (x: string) => (x.length > 3 && x.endsWith("s") ? x.slice(0, -1) : x);

/** Whether a place is the kind asked for ("parks", "coffee", "music venue"). */
function isType(p: PlaceRow, type: string): boolean {
  const wanted = flat(type);
  const kind = TYPE_WORDS[wanted] ?? TYPE_WORDS[singular(wanted)] ?? singular(wanted);
  return [flat(p.type), flat(p.typeLabel)].some((t) => t === flat(kind) || singular(t) === kind);
}

/** With nothing else to go on, the places people ask about first. */
const PLACE_ORDER = ["landmark", "viewpoint", "museum", "park", "beach", "trail", "plaza"];
const placeRank = (p: PlaceRow) => {
  const i = PLACE_ORDER.indexOf(p.type);
  return i < 0 ? PLACE_ORDER.length : i;
};

type PlaceSearch = { neighborhood?: string; type?: string; query?: string };

/**
 * Places and landmarks: what the neighborhood Group threads name (parks, cafes,
 * viewpoints, museums…) and cited stations, campuses and nightlife corridors.
 * A thread-named place comes with the threads the viewer can see that mention
 * it, read for the first `MENTION_HOODS_MAX` neighborhoods in the result.
 */
export async function findPlaces(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: PlaceSearch = {},
): Promise<{ found: Found[]; total: number; types: string[] }> {
  const s = await scopeOf(ctx, viewer);
  const hood = a.neighborhood === undefined ? null : needHood(s, a.neighborhood);
  const factDocs = hood
    ? await ctx.db
        .query("neighborhoodFacts")
        .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", hood._id))
        .take(FACTS_MAX)
    : await ctx.db.query("neighborhoodFacts").take(FACTS_SCAN);
  const rows = new Map<string, PlaceRow>();
  for (const p of NEIGHBORHOOD_PLACES)
    if (!hood || p.neighborhood === hood.slug) rows.set(p.key, seedRow(p));
  // A corridor that crosses neighborhoods has a row in each: keep the first.
  for (const f of factDocs) {
    const row = factRow(s, f);
    if (row && !rows.has(row.key)) rows.set(row.key, row);
  }
  const all = [...rows.values()];
  const types = [...new Set(all.map((p) => p.type))].sort();

  const words = terms(a.query);
  const matched = all.flatMap((p) => {
    if (a.type && !isType(p, a.type)) return [];
    const inName = named(`${p.name} ${p.seed?.aliases?.join(" ") ?? ""}`, words);
    const inAll = named(`${p.name} ${p.typeLabel} ${p.at ?? ""}`, words);
    if (words.length && inName.length + inAll.length === 0) return [];
    return [{ p, hits: inName.length * 3 + inAll.length }];
  });
  matched.sort(
    (x, y) =>
      y.hits - x.hits || placeRank(x.p) - placeRank(y.p) || x.p.name.localeCompare(y.p.name),
  );
  const top = matched.slice(0, TOOL_RESULTS_MAX).map((m) => m.p);

  // Threads that name the places, for the first few neighborhoods (each is a bounded read of its Groups).
  const mentions = new Map<string, readonly CitedSource[]>();
  const slugs = [...new Set(top.filter((p) => p.seed).map((p) => p.slug))].slice(
    0,
    MENTION_HOODS_MAX,
  );
  for (const slug of slugs) {
    const n = s.hoodBySlug.get(slug);
    if (!n) continue;
    const here = top.flatMap((p) => (p.seed && p.slug === slug ? [p.seed] : []));
    const cited = await placeSources(
      ctx,
      await visibleGroups(ctx, n._id, s.audience),
      here,
      s.audience,
    );
    for (const p of here) mentions.set(p.key, cited.get(p.key) ?? []);
  }
  const found: Found[] = [];
  for (const p of top) {
    if (!p.citations) {
      found.push(placeFound(s, p, mentions.get(p.key)));
      continue;
    }
    // A cited fact shows only with sources the viewer can see, as on the neighborhood page.
    const sources = await resolveCitations(ctx, p.citations, s.audience);
    if (sources) found.push(placeFound(s, p, sources));
  }
  return { found, total: matched.length, types };
}

/** One place by key, without reading who mentions it. */
async function placeByKey(s: Scope, key: string): Promise<Found | null> {
  const seed = NEIGHBORHOOD_PLACES.find((p) => p.key === key);
  if (seed) return s.hoodBySlug.has(seed.neighborhood) ? placeFound(s, seedRow(seed)) : null;
  const fact = await s.ctx.db
    .query("neighborhoodFacts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  const row = fact && factRow(s, fact);
  if (!row?.citations) return null;
  const sources = await resolveCitations(s.ctx, row.citations, s.audience);
  return sources ? placeFound(s, row, sources) : null;
}

/* ───────────── Neighborhoods ───────────── */

const SCORE_NAME = { things_to_do: "Things to do", food: "Food", transit: "Transit" } as const;

/** A neighborhood with its shared scores, each backed by sources the viewer can see. */
async function neighborhoodFound(s: Scope, n: Hood, more: { [key: string]: Json } = {}) {
  const { scores } = await sharedScores(s.ctx, n._id, s.audience);
  const key = foundKey("neighborhood", n.slug);
  const label = hoodLabel(n);
  const lines: string[] = [];
  const cited: CitedSource[] = [];
  for (const sc of scores) {
    if (sc.state !== "ok") continue;
    lines.push(`${SCORE_NAME[sc.kind]} ${sc.score}/10 · ${sc.label}`);
    cited.push(...sc.sources);
  }
  const facts: FactsOf<"neighborhood"> = {
    kind: "neighborhood",
    key,
    slug: n.slug,
    name: label,
    fullName: n.name,
    park: n.park ?? false,
    // Out of 10. A score with too little public data behind it has none.
    scores: scores.map((sc) =>
      sc.state === "ok"
        ? { kind: sc.kind, score: sc.score, label: sc.label, breakdown: sc.breakdown }
        : { kind: sc.kind, score: null, label: "Not enough public data to score" },
    ),
    ...more,
  };
  const card: ChatCard = {
    key,
    kind: "neighborhood",
    title: label,
    lines: lines.length ? lines.slice(0, 3) : [n.park ? "Park" : "San Francisco neighborhood"],
    href: hoodHref(n.slug),
    point: n.center,
  };
  const found: Found = {
    key,
    facts,
    link: { label: `${label} neighborhood page`, href: hoodHref(n.slug) },
    ...(cited.length ? { sources: sourceLinks(cited) } : {}),
    card,
  };
  return found;
}

/** The cited transit, nightlife and campus facts about a neighborhood, in words. */
async function hoodFacts(s: Scope, n: Hood): Promise<{ [key: string]: Json }> {
  const rows = await s.ctx.db
    .query("neighborhoodFacts")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", n._id))
    .take(FACTS_MAX);
  const stations: string[] = [];
  const lines: string[] = [];
  const nightlife: Json[] = [];
  const campuses: Json[] = [];
  let service: Json = null;
  for (const f of rows) {
    // Every fact is cited: one whose sources the viewer can't see is left out.
    if (!(await resolveCitations(s.ctx, f.citations, s.audience))) continue;
    if (f.kind === "transit_station")
      stations.push(
        `${f.name} (${SYSTEM_LABEL[f.system] ?? f.system}${f.lines.length ? `: ${f.lines.join(", ")}` : ""})`,
      );
    else if (f.kind === "transit_line") lines.push(`${f.name} (${f.stops.length} stops here)`);
    else if (f.kind === "nightlife_corridor")
      nightlife.push({ name: f.name, about: uncut(f.detail, ABOUT_MAX) });
    else if (f.kind === "campus")
      campuses.push({
        name: f.name,
        institution: f.institution,
        about: uncut(f.detail, ABOUT_MAX),
      });
    else if (f.kind === "transit_service")
      service = {
        weekdayTripsPerHour: f.tripsPerHour,
        allNightLines: f.routes.filter((r) => r.allNight).map((r) => r.name),
      };
  }
  return {
    transit: { stations: stations.slice(0, 12), lines: lines.slice(0, 12), service },
    nightlife: nightlife.slice(0, 6),
    campuses: campuses.slice(0, 6),
  };
}

/**
 * One neighborhood in depth: its scores and cited facts, what fits the
 * viewer's interests there, and the top few Groups, Events and places as
 * things the reply can show. Everything is what its page shows this viewer.
 */
async function neighborhoodInDepth(ctx: QueryCtx, viewer: ToolViewer, slug: string) {
  const s = await scopeOf(ctx, viewer);
  const n = needHood(s, slug);
  const [page, more] = await Promise.all([
    neighborhoodPage(ctx, viewer, slug, { crew: null, now: s.now }),
    hoodFacts(s, n),
  ]);
  const picks = page?.forYou.state === "ready" ? page.forYou.items : [];
  const why = new Map(
    picks.map((x) => [
      x.key,
      `${x.reason.label} · ${x.reason.because}${x.reason.also.length ? ` (also ${x.reason.also.join(", ")})` : ""}`,
    ]),
  );
  // What fits the viewer comes first, then the page's own order.
  const order = <T extends { _id: string }>(kind: "event" | "group", rows: readonly T[]) => {
    const picked = new Set(picks.map((x) => x.key));
    return [...rows]
      .sort(
        (x, y) => Number(picked.has(`${kind}:${y._id}`)) - Number(picked.has(`${kind}:${x._id}`)),
      )
      .slice(0, HOOD_THINGS);
  };

  const groups: Found[] = [];
  for (const g of order("group", page?.groups ?? [])) {
    const doc = await ctx.db.get(g._id);
    if (doc && groupOpen(s, doc)) groups.push(groupFound(s, doc));
  }
  const events: Found[] = [];
  for (const e of order("event", page?.events ?? [])) {
    const doc = await ctx.db.get(e._id);
    if (doc && (await eventOpen(s, doc))) events.push(await eventFound(s, doc));
  }
  const places: Found[] = [];
  for (const x of picks)
    if (x.kind === "place" && places.length < HOOD_THINGS) {
      const seed = NEIGHBORHOOD_PLACES.find((p) => p.key === x.place.key);
      if (seed) places.push(placeFound(s, seedRow(seed), x.sources));
    }
  const shown = new Set(places.map((p) => p.key));
  const rest = NEIGHBORHOOD_PLACES.filter(
    (p) => p.neighborhood === slug && !shown.has(foundKey("place", p.key)),
  )
    .map(seedRow)
    .sort((x, y) => placeRank(x) - placeRank(y) || x.name.localeCompare(y.name));
  for (const p of rest.slice(0, HOOD_THINGS - places.length)) places.push(placeFound(s, p));

  const withWhy = (f: Found): Json => {
    const reason = why.get(f.key);
    return reason ? { ...f.facts, fitsYou: reason } : (f.facts as Json);
  };
  const hood = await neighborhoodFound(s, n, {
    ...more,
    counts: {
      groups: page?.groups.length ?? 0,
      upcomingEvents: page?.events.length ?? 0,
      places: NEIGHBORHOOD_PLACES.filter((p) => p.neighborhood === slug).length,
    },
    // What here shares the interests in their City Profile, or that they have none yet.
    fitsYou:
      page?.forYou.state === "ready"
        ? picks.length
          ? [...why.values()].slice(0, 6)
          : "Nothing here matches the interests in their City Profile"
        : "No interests in their City Profile yet",
  });
  return {
    result: {
      neighborhood: hood.facts as Json,
      groups: groups.map(withWhy),
      events: events.map(withWhy),
      places: places.map(withWhy),
    },
    found: [hood, ...groups, ...events, ...places],
  };
}

/* ───────────── Details ───────────── */

/** Landing's "things to check" for a rental, in the words its page uses. */
function trustLines(trust: NonNullable<Awaited<ReturnType<typeof listingTrust>>>): string[] {
  const out: string[] = [];
  for (const b of trust.badges) {
    if (b.kind === "identity") out.push("The lister's identity is verified");
    else if (b.kind === "property") out.push("The property is verified");
    else out.push(`Toured in person by ${firstName(b.by)}, who is in their network`);
  }
  for (const sig of trust.signals) {
    switch (sig.kind) {
      case "low_price":
        out.push(
          `To check: the price is ${sig.percentBelow}% below similar listings. Similar ${sig.unit === "room" ? "rooms" : `${sig.unit}s`} in ${sig.area} go for about ${money(sig.median)}/mo (${sig.comps} listings)`,
        );
        break;
      case "new_account":
        out.push(
          `To check: the lister's account is new (${sig.daysOld} ${sig.daysOld === 1 ? "day" : "days"} old), with no mutual friends or vouches from their network`,
        );
        break;
      case "reused_photos":
        out.push(
          `To check: ${sig.count} of its photos also appear on an older listing by someone else`,
        );
        break;
      case "lister_far_away":
        out.push("To check: the lister's profile says they live outside the Bay Area");
        break;
    }
  }
  return out;
}

const yesNo = (x: boolean | undefined) => (x === undefined ? null : x);

/** More about one listing, Event or Group: the same thing the searches return, with its details. */
async function details(ctx: QueryCtx, viewer: ToolViewer, key: string): Promise<Found> {
  const s = await scopeOf(ctx, viewer);
  const k = parseKey(key);
  if (!k || !["listing", "event", "group"].includes(k.kind))
    throw new ConvexError(
      "get_details reads a listing:, event: or group: key from earlier results",
    );
  const gone = new ConvexError(`${key.slice(0, 80)} is gone, or they can't see it`);
  const more = (found: Found, extra: { [key: string]: Json }): Found => ({
    ...found,
    facts: { ...found.facts, ...extra } as Found["facts"],
  });

  if (k.kind === "listing") {
    const id = ctx.db.normalizeId("listings", k.id);
    const l = id && (await ctx.db.get(id));
    if (!l || !(await listingVisible(s, l)) || !(isRental(l) || isItem(l))) throw gone;
    const description = cap(l.description, DETAIL_MAX);
    if (l.rental) {
      const r = l.rental;
      const [found, trust] = await Promise.all([
        rentalFound(s, l, (await s.reasons()).get(l._id) ?? []),
        listingTrust(ctx, viewer._id, l._id),
      ]);
      return more(found, {
        description,
        // Never the address: the page shows the approximate area only.
        details: {
          propertyType: r.propertyType,
          sqft: r.sqft ?? null,
          furnished: yesNo(r.furnished),
          petsAllowed: yesNo(r.petsAllowed),
          laundry: r.laundry ? cap(r.laundry, 80) : null,
          parking: r.parking ? cap(r.parking, 80) : null,
          availableUntil: r.availableTo ? isoDay(r.availableTo) : null,
          views: r.views ?? [],
        },
        trust: trust ? trustLines(trust) : [],
      });
    }
    const seller = l.sellerId === viewer._id ? null : await s.lister(l.sellerId);
    return more(await itemFound(s, l, []), {
      description,
      brand: l.brand ? cap(l.brand, 60) : null,
      seller: seller && {
        name: seller.name,
        connection: seller.connection,
        mutualFriends: seller.mutualFriends,
      },
    });
  }

  if (k.kind === "event") {
    const id = ctx.db.normalizeId("events", k.id);
    const e = id && (await ctx.db.get(id));
    if (!e || !notOver(e, s.now) || !(await eventOpen(s, e))) throw gone;
    const host = await ctx.db.get(e.hostId);
    const interested = await ctx.db
      .query("eventResponses")
      .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "interested"))
      .take(RESPONSES_MAX);
    return more(await eventFound(s, e), {
      description: cap(e.description, DETAIL_MAX),
      host: host ? firstName(host) : null,
      endsAt: e.endAt ? new Date(e.endAt).toISOString() : null,
      interested: e.externalInterestedCount + interested.length,
      ticketPrice: e.ticketPrice ? cap(e.ticketPrice, 40) : null,
    });
  }

  const id = ctx.db.normalizeId("groups", k.id);
  const g = id && (await ctx.db.get(id));
  if (!g || !groupOpen(s, g)) throw gone;
  return more(await groupInDepth(s, g), {
    about: cap(g.description, DETAIL_MAX),
    rules: g.rules.slice(0, 6).map((r) => cap(r.title, 80)),
    tags: g.tags.slice(0, 8).map((t) => cap(t, 30)),
  });
}

/* ───────────── Weekend Routes ───────────── */

/** A neighborhood's shared Weekend Route, each stop with the place or Event it sends you to. */
async function weekendRoute(ctx: QueryCtx, viewer: ToolViewer, slug: string) {
  const s = await scopeOf(ctx, viewer);
  const n = needHood(s, slug);
  const row = await ctx.db
    .query("weekendRoutes")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", n._id))
    .first();
  if (!row)
    return {
      result: {
        neighborhood: slug,
        route: null,
        note: `There is no Weekend Route for ${hoodLabel(n)} yet. The weekend_route command shows the neighborhood on the map, which builds one.`,
      } as Json,
      found: [] as Found[],
    };
  const found: Found[] = [];
  const stops: Json[] = [];
  for (const stop of row.stops) {
    if (stop.startAt !== undefined && (stop.endAt ?? stop.startAt + EVENT_LENGTH_MS) < s.now)
      continue;
    // A stop is its sources: one the viewer can't see them for is left out.
    const sources = await resolveCitations(ctx, stop.citations, s.audience);
    if (!sources) continue;
    const against =
      stop.disagreement && (await resolveCitations(ctx, stop.disagreement.citations, s.audience));
    let thing: Found | null = null;
    if (stop.eventId) {
      const e = await ctx.db.get(stop.eventId);
      thing = e && (await eventOpen(s, e)) ? await eventFound(s, e) : null;
    } else if (stop.placeKey) {
      const seed = NEIGHBORHOOD_PLACES.find((p) => p.key === stop.placeKey);
      thing = seed ? placeFound(s, seedRow(seed), sources) : null;
    }
    if (thing) found.push(thing);
    stops.push({
      name: cap(stop.name, 80),
      timeOfDay: stop.timeOfDay,
      type: cap(stop.kind, 40),
      // Muse's words from locals' threads: data like any other.
      why: cap(stop.why, ABOUT_MAX),
      localsDisagree: stop.disagreement && against ? cap(stop.disagreement.note, ABOUT_MAX) : null,
      thing: thing ? (thing.facts as Json) : null,
    });
  }
  return {
    result: {
      neighborhood: slug,
      route: { builtOn: isoDay(row.generatedAt), stops },
      ...(stops.length ? {} : { note: "The route has no stops they can see right now." }),
    } as Json,
    found,
  };
}

/* ───────────── Recall ───────────── */

/**
 * Reads one thing again by id, for the viewer, under the rules the searches
 * apply: what's gone, sold, over, or no longer theirs to see comes back null.
 */
export const RECALL_FIND: Pick<
  Record<FoundKind, Recall>,
  "listing" | "event" | "group" | "place" | "neighborhood" | "post"
> = {
  listing: async (ctx, viewer, id) => {
    const s = await scopeOf(ctx, viewer);
    const listingId = ctx.db.normalizeId("listings", id);
    const l = listingId && (await ctx.db.get(listingId));
    if (!l || !(await listingVisible(s, l))) return null;
    if (isRental(l)) return rentalFound(s, l, (await s.reasons()).get(l._id) ?? []);
    return isItem(l) ? itemFound(s, l, []) : null;
  },
  event: async (ctx, viewer, id) => {
    const s = await scopeOf(ctx, viewer);
    const eventId = ctx.db.normalizeId("events", id);
    const e = eventId && (await ctx.db.get(eventId));
    return e && notOver(e, s.now) && (await eventOpen(s, e)) ? eventFound(s, e) : null;
  },
  group: async (ctx, viewer, id) => {
    const s = await scopeOf(ctx, viewer);
    const groupId = ctx.db.normalizeId("groups", id);
    const g = groupId && (await ctx.db.get(groupId));
    return g && groupOpen(s, g) ? groupFound(s, g) : null;
  },
  post: async (ctx, viewer, id) => {
    const s = await scopeOf(ctx, viewer);
    const postId = ctx.db.normalizeId("posts", id);
    const p = postId && (await ctx.db.get(postId));
    const g = p?.groupId && (await ctx.db.get(p.groupId));
    if (!p || !g || !groupOpen(s, g)) return null;
    const author = await postOpen(s, p, g);
    return author && postFound(s, p, g, author);
  },
  place: async (ctx, viewer, id) => placeByKey(await scopeOf(ctx, viewer), id),
  neighborhood: async (ctx, viewer, id) => {
    const s = await scopeOf(ctx, viewer);
    const n = s.hoodBySlug.get(id);
    return n ? neighborhoodFound(s, n) : null;
  },
};

/* ───────────── The tools ───────────── */

const LISTER_NOTE =
  "lister.compatibility is Landing's roommate score from the lifestyle answers both people share. It is null unless they and the lister both share their answers (Roommates page) and the lister is in their network: say so rather than guess.";

export const FIND_TOOLS: readonly HomeTool[] = [
  {
    name: "search_rentals",
    description:
      "Places to rent, ranked for the person by their City Profile, best first, each with why it ranks there and who lists it (lister: how they're connected, and roommate compatibility with the reasons). maxPrice is monthly rent in whole dollars; neighborhood is a slug. Use it for any question about rentals or their listers.",
    args: v.object({
      maxPrice: v.optional(v.number()),
      bedrooms: v.optional(v.number()),
      pets: v.optional(v.boolean()),
      furnished: v.optional(v.boolean()),
      neighborhood: v.optional(v.string()),
    }),
    run: async (ctx, viewer, a) => {
      const { found, needsBrief } = await findRentals(ctx, viewer, {
        maxPrice: positive(a.maxPrice, "maxPrice", 100_000),
        bedrooms: a.bedrooms === 0 ? 0 : positive(a.bedrooms, "bedrooms", 10),
        pets: flag(a.pets),
        furnished: flag(a.furnished),
        neighborhood: text(a.neighborhood, 80),
      });
      return {
        result: listed(found, {
          // No City Profile to rank by: these are the newest.
          needsBrief,
          note: LISTER_NOTE,
        }),
        found,
      };
    },
  },
  {
    name: "search_marketplace",
    description:
      'Things for sale on Marketplace (furniture, decor, electronics, anything but homes), best match first. query names what they want ("walnut desk", "floor lamp"); vibe is a look in a few words ("cozy mid-century, sage green"); myVibe: true uses the look remembered for their apartment. Give query, vibe, both, or neither for the newest. maxPrice is whole dollars; neighborhood is a slug; category is one of furniture, household, electronics, apparel, sporting, musical, hobbies, toys, family, garden, homeimprovement, officesupplies, pets, entertainment, classifieds, free. Each result says which words matched.',
    args: v.object({
      query: v.optional(v.string()),
      vibe: v.optional(v.string()),
      myVibe: v.optional(v.boolean()),
      maxPrice: v.optional(v.number()),
      neighborhood: v.optional(v.string()),
      category: v.optional(v.string()),
    }),
    run: async (ctx, viewer, a) => {
      const r = await findMarketplace(ctx, viewer, {
        query: text(a.query, 100),
        vibe: text(a.vibe, 200),
        myVibe: flag(a.myVibe),
        maxPrice: positive(a.maxPrice, "maxPrice", 1_000_000),
        neighborhood: text(a.neighborhood, 80),
        category: text(a.category, 40),
      });
      return {
        result: listed(r.found, {
          vibe: r.vibe,
          ...(r.noRememberedVibe
            ? {
                note: "No look is remembered for their apartment yet. Ask what vibe they want, or search with vibe.",
              }
            : {}),
        }),
        found: r.found,
      };
    },
  },
  {
    name: "search_events",
    description:
      'Upcoming Events the person can see, soonest first. neighborhood is a slug; query is words to look for ("run club", "trivia"); withinDays is how far ahead (default 30, at most 90). Each says whether they\'ve responded, and hostedBy is the Group hosting it, when there is one. Plans people post in a Group without making an Event are found with search_group_posts.',
    args: v.object({
      neighborhood: v.optional(v.string()),
      query: v.optional(v.string()),
      withinDays: v.optional(v.number()),
    }),
    run: async (ctx, viewer, a) => {
      const found = await findEvents(ctx, viewer, {
        neighborhood: text(a.neighborhood, 80),
        query: text(a.query, 100),
        withinDays: positive(a.withinDays, "withinDays", EVENT_DAYS_MAX),
      });
      return { result: listed(found), found };
    },
  },
  {
    name: "search_groups",
    description:
      'Facebook Groups the person can see, most active first. neighborhood is a slug; query is words to look for ("climbing", "dog owners"). Each says whether they\'re a member and whether it\'s public (only a public Group can be joined from here).',
    args: v.object({
      neighborhood: v.optional(v.string()),
      query: v.optional(v.string()),
    }),
    run: async (ctx, viewer, a) => {
      const found = await findGroups(ctx, viewer, {
        neighborhood: text(a.neighborhood, 80),
        query: text(a.query, 100),
      });
      return { result: listed(found), found };
    },
  },
  {
    name: "search_group_posts",
    description:
      'Recent posts in Groups the person can read: informal plans and news that aren\'t Events ("anyone up for a hike Saturday?", "board games at mine"). Newest first; with query, the best matches first. group is one Group\'s id or slug (from search_groups); neighborhood is a slug; query is words to look for ("hike", "board games"); withinDays is how far back (default 14, at most 60). Each post has its Group, the author\'s first name, when it was posted, a short excerpt and its comment count. A post is not an Event: there is nothing to RSVP to.',
    args: v.object({
      group: v.optional(v.string()),
      neighborhood: v.optional(v.string()),
      query: v.optional(v.string()),
      withinDays: v.optional(v.number()),
    }),
    run: async (ctx, viewer, a) => {
      const found = await findGroupPosts(ctx, viewer, {
        group: text(a.group, 120),
        neighborhood: text(a.neighborhood, 80),
        query: text(a.query, 100),
        withinDays: positive(a.withinDays, "withinDays", POST_DAYS_MAX),
      });
      return {
        result: listed(found, {
          note: "These are posts, not Events. Cite each post you mention by its key, and the Group's key when you name it.",
        }),
        found,
      };
    },
  },
  {
    name: "search_places",
    description:
      'Places and landmarks in San Francisco: parks, cafes, restaurants, bars, viewpoints, museums, markets, music venues, stairways, plus transit stations, campuses and nightlife corridors. neighborhood is a slug; type is a kind of place ("park", "cafe", "viewpoint", "transit", "campus"); query is a name or words to look for. mentionedIn counts the Group threads or sources that back a place (null when not read).',
    args: v.object({
      neighborhood: v.optional(v.string()),
      type: v.optional(v.string()),
      query: v.optional(v.string()),
    }),
    run: async (ctx, viewer, a) => {
      const r = await findPlaces(ctx, viewer, {
        neighborhood: text(a.neighborhood, 80),
        type: text(a.type, 40),
        query: text(a.query, 100),
      });
      return {
        result: listed(r.found, {
          total: r.total,
          // What `type` can be, for a search that found nothing.
          ...(r.found.length ? {} : { types: r.types }),
        }),
        found: r.found,
      };
    },
  },
  {
    name: "get_neighborhood",
    description:
      "One neighborhood in depth, by slug: its scores out of 10 (things to do, food, transit) with what they're based on, cited transit, nightlife and campus facts, what there fits the person's interests, and its top Groups, Events and places. Use it to describe or compare neighborhoods.",
    args: v.object({ slug: v.string() }),
    run: async (ctx, viewer, a) => neighborhoodInDepth(ctx, viewer, text(a.slug, 80) ?? ""),
  },
  {
    name: "get_details",
    description:
      "More about one thing from earlier results, by its key (listing:…, event:… or group:…): the description; for a rental its details, lister and Landing's things to check; for an item its condition and seller; for an Event its host and counts; for a Group its rules, its next upcoming Events (upcomingEvents) and its newest posts (recentPosts). Use it on a Group for \"what's happening in <Group>\".",
    args: v.object({ key: v.string() }),
    run: async (ctx, viewer, a) => {
      const found = await details(ctx, viewer, text(a.key, 120) ?? "");
      return { result: found.facts as Json, found: [found] };
    },
  },
  {
    name: "get_weekend_route",
    description:
      "A neighborhood's Weekend Route, by slug: the stops locals recommend in day order, why, and where locals disagree. Says so when no route is built yet.",
    args: v.object({ slug: v.string() }),
    run: async (ctx, viewer, a) => weekendRoute(ctx, viewer, text(a.slug, 80) ?? ""),
  },
];
