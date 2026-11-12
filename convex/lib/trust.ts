import type { Doc } from "../_generated/dataModel";
import type { ChatFlagCategory } from "../validators";

/**
 * "Things to check" on rental listings (#11). Each signal is computed by code
 * and states its reason and evidence. There is no overall score, and the
 * wording never calls anyone a scammer: honest listers can trip a signal too.
 */

export type ListingSignal =
  | {
      kind: "low_price";
      /** e.g. "45% below" */
      percentBelow: number;
      median: number;
      /** How many comparable listings the median is from. */
      comps: number;
      /** "the Mission" or "San Francisco" when there weren't enough nearby. */
      area: string;
      /** "1BR", "studio" or "room" */
      unit: string;
    }
  | { kind: "new_account"; daysOld: number }
  | { kind: "reused_photos"; count: number; otherListingTitle: string }
  | { kind: "lister_far_away"; listerCity: string; listingCity: string };

/** A price this far under the median for comparable listings is flagged. */
export const LOW_PRICE_RATIO = 0.7;
/** Fewer comparable listings than this and the median isn't trusted. */
export const MIN_COMPS = 3;
/** An account younger than this, with no one from the viewer's network, is flagged. */
export const NEW_ACCOUNT_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** Places counted as "local" to a Bay Area listing. Matched against `users.city`. */
const BAY_AREA = [
  "san francisco",
  "oakland",
  "berkeley",
  "emeryville",
  "alameda",
  "albany",
  "richmond",
  "el cerrito",
  "daly city",
  "south san francisco",
  "san mateo",
  "burlingame",
  "redwood city",
  "palo alto",
  "menlo park",
  "mountain view",
  "sunnyvale",
  "santa clara",
  "san jose",
  "fremont",
  "hayward",
  "san leandro",
  "walnut creek",
  "sausalito",
  "mill valley",
];

export function isBayArea(city: string) {
  const c = city.toLowerCase();
  return BAY_AREA.some((place) => c.startsWith(place));
}

/** Rooms are compared with rooms; whole units with units of the same bedroom count. */
export function unitClass(r: NonNullable<Doc<"listings">["rental"]>) {
  if (r.propertyType === "room") return "room";
  return r.bedrooms === 0 ? "studio" : `${r.bedrooms}BR`;
}

export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Price far below comparable rentals: same unit class, active, for rent or
 * sublet. Uses the neighborhood when it has enough comps, else the city.
 */
export function lowPriceSignal(
  listing: Doc<"listings">,
  others: Doc<"listings">[],
): ListingSignal | null {
  const r = listing.rental;
  if (!r || r.listingType === "sale" || listing.price <= 0) return null;
  const cls = unitClass(r);
  const comparable = others.filter(
    (o) =>
      o._id !== listing._id &&
      o.status === "active" &&
      o.rental &&
      o.rental.listingType !== "sale" &&
      unitClass(o.rental) === cls &&
      o.price > 0,
  );
  // Narrowest area with enough comparable listings: neighborhood, city, then the Bay Area.
  const hood = listing.location.neighborhood;
  const tiers: [Doc<"listings">[], string][] = [
    [hood ? comparable.filter((o) => o.location.neighborhood === hood) : [], `the ${hood}`],
    [comparable.filter((o) => o.location.city === listing.location.city), listing.location.city],
    [comparable, "the Bay Area"],
  ];
  const tier = tiers.find(([pool]) => pool.length >= MIN_COMPS);
  if (!tier) return null;
  const [pool, area] = tier;
  const m = median(pool.map((o) => o.price));
  if (listing.price > m * LOW_PRICE_RATIO) return null;
  return {
    kind: "low_price",
    percentBelow: Math.round((1 - listing.price / m) * 100),
    median: m,
    comps: pool.length,
    area: area.replace(/, (CA|California)$/, ""),
    unit: cls,
  };
}

/** A new account with no mutual friends and no vouches from the viewer's network. */
export function newAccountSignal(
  lister: Doc<"users">,
  network: { mutualFriendCount: number; vouchTotal: number } | null,
  now = Date.now(),
): ListingSignal | null {
  const daysOld = Math.floor((now - lister.joinedAt) / DAY);
  if (daysOld >= NEW_ACCOUNT_DAYS) return null;
  if (network && (network.mutualFriendCount > 0 || network.vouchTotal > 0)) return null;
  return { kind: "new_account", daysOld };
}

/** Any of this listing's photos already on an older listing by someone else (so the original isn't flagged). */
export function reusedPhotosSignal(
  listing: Doc<"listings">,
  others: Doc<"listings">[],
): ListingSignal | null {
  const mine = new Set(listing.photos);
  let count = 0;
  let first: Doc<"listings"> | null = null;
  for (const o of others) {
    if (o._id === listing._id || o.sellerId === listing.sellerId) continue;
    if (o.createdAt >= listing.createdAt) continue;
    const shared = o.photos.filter((p) => mine.has(p)).length;
    if (shared > 0) {
      count += shared;
      first ??= o;
    }
  }
  return first ? { kind: "reused_photos", count, otherListingTitle: first.title } : null;
}

/** The lister's own city is far from a Bay Area listing. */
export function farAwaySignal(
  listing: Doc<"listings">,
  lister: Doc<"users">,
): ListingSignal | null {
  if (!lister.city || !isBayArea(listing.location.city) || isBayArea(lister.city)) return null;
  return { kind: "lister_far_away", listerCity: lister.city, listingCity: listing.location.city };
}

/* ── Chat phrases ──────────────────────────────────────────────────────── */

/** Common rental scam lines (FTC patterns). The non-AI fallback for the chat check. */
export const SCAM_PHRASES: { category: ChatFlagCategory; pattern: RegExp; reason: string }[] = [
  {
    category: "deposit_before_viewing",
    pattern:
      /\b(deposit|first month|holding fee|application fee)\b[^.?!]*\b(before|to hold|to reserve|secure)\b|\bbefore (the |a )?(viewing|showing|tour)\b/i,
    reason: "Asks for money before you've seen the place in person.",
  },
  {
    category: "away_lister",
    pattern:
      /\b(out of (the )?(country|town|state)|overseas|abroad|on (a )?mission|deployed|(mail|ship|send) (you )?the keys)\b/i,
    reason: "The lister says they can't meet or show the place in person.",
  },
  {
    category: "untraceable_payment",
    pattern: /\b(wire|western union|moneygram|gift ?cards?|crypto|bitcoin|zelle|cash app|venmo)\b/i,
    reason: "Asks for a payment method that's hard to get back if something goes wrong.",
  },
  {
    category: "pressure",
    pattern:
      /\b((a )?lots? of (other )?(people|interest)|first come|today only|act fast|right away|asap|need to know today)\b/i,
    reason: "Pushes you to decide or pay quickly.",
  },
  {
    category: "off_platform",
    pattern: /\b(text me|whatsapp|email me|my (personal )?email|telegram)\b/i,
    reason: "Moves the conversation off Facebook, where it's harder to report.",
  },
];

export function phraseFlags(text: string) {
  return SCAM_PHRASES.filter((p) => p.pattern.test(text)).map((p) => ({
    category: p.category,
    reason: p.reason,
  }));
}
