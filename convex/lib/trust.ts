import type { Doc, Id } from "../_generated/dataModel";
import type { ChatFlagCategory } from "../validators";

/**
 * "Things to check" on rental listings (#11). Each signal is computed by code
 * and states its reason and evidence. There is no overall score, and the
 * wording never calls anyone a scammer: honest listers can trip a signal too.
 *
 * Signals carry the ids of the listings behind them (`compIds`, `listingIds`)
 * for citations. The query resolves those for the viewer and never sends the
 * raw ids to the client.
 */

export type ListingSignal =
  | {
      kind: "low_price";
      /** e.g. "45% below" */
      percentBelow: number;
      median: number;
      /** How many comparable listings the median is from. */
      comps: number;
      /** "the Mission", "San Francisco" or "the Bay Area". */
      area: string;
      /** "1BR", "studio" or "room" */
      unit: string;
      /** The comparable listings, newest first, at most COMPS_CITED. */
      compIds: Id<"listings">[];
    }
  | { kind: "new_account"; daysOld: number }
  | {
      kind: "reused_photos";
      /** Distinct photos of this listing found on older listings by others. */
      count: number;
      /** Those older listings, at most REUSED_CITED. */
      listingIds: Id<"listings">[];
    }
  | { kind: "lister_far_away"; listerCity: string; listingCity: string };

/** A price this far under the median for comparable listings is flagged. */
export const LOW_PRICE_RATIO = 0.7;
/** Fewer comparable listings than this and the median isn't trusted. */
export const MIN_COMPS = 3;
/** An account younger than this, with no one from the viewer's network, is flagged. */
export const NEW_ACCOUNT_DAYS = 30;
/** Rentals read per query, newest first, for medians and photo matches. */
export const RENTAL_SCAN_MAX = 500;
/** Comparable listings cited under a price signal. */
export const COMPS_CITED = 20;
/** Older listings cited under a reused-photos signal. */
export const REUSED_CITED = 5;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Cities counted as "local" to a Bay Area listing: the nine Bay Area counties'
 * cities and towns. Matched exactly against the city part of `users.city` /
 * `location.city` ("San Rafael, CA"), with a California region or none.
 */
const BAY_AREA = new Set([
  // San Francisco and San Mateo
  "san francisco",
  "daly city",
  "south san francisco",
  "brisbane",
  "colma",
  "pacifica",
  "san bruno",
  "millbrae",
  "burlingame",
  "hillsborough",
  "san mateo",
  "foster city",
  "belmont",
  "san carlos",
  "redwood city",
  "menlo park",
  "atherton",
  "east palo alto",
  "half moon bay",
  // Santa Clara
  "palo alto",
  "los altos",
  "mountain view",
  "sunnyvale",
  "santa clara",
  "cupertino",
  "san jose",
  "campbell",
  "saratoga",
  "los gatos",
  "milpitas",
  "morgan hill",
  "gilroy",
  // Alameda and Contra Costa
  "oakland",
  "berkeley",
  "emeryville",
  "alameda",
  "albany",
  "piedmont",
  "san leandro",
  "hayward",
  "union city",
  "fremont",
  "newark",
  "castro valley",
  "pleasanton",
  "dublin",
  "livermore",
  "richmond",
  "el cerrito",
  "san pablo",
  "pinole",
  "hercules",
  "walnut creek",
  "concord",
  "pleasant hill",
  "lafayette",
  "orinda",
  "moraga",
  "danville",
  "san ramon",
  "martinez",
  "antioch",
  "pittsburg",
  // Marin, Sonoma, Napa and Solano
  "sausalito",
  "mill valley",
  "tiburon",
  "corte madera",
  "larkspur",
  "san anselmo",
  "fairfax",
  "san rafael",
  "novato",
  "petaluma",
  "santa rosa",
  "sonoma",
  "napa",
  "vallejo",
  "benicia",
  "fairfield",
]);
const CALIFORNIA = new Set(["ca", "calif", "calif.", "california", "usa", "us"]);

/** "Richmond, CA" is; "Richmond, Virginia" and "Sacramento, CA" aren't. */
export function isBayArea(place: string) {
  const [city = "", ...region] = place
    .toLowerCase()
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "));
  if (!BAY_AREA.has(city)) return false;
  return region.every((r) => CALIFORNIA.has(r));
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

const sameCity = (a: string, b: string) =>
  a.split(",")[0].trim().toLowerCase() === b.split(",")[0].trim().toLowerCase();

/**
 * Price far below comparable rentals: same unit class, active, for rent or
 * sublet. Uses the neighborhood when it has MIN_COMPS, else the city, else the
 * Bay Area (Bay Area listings only). With too few comparables anywhere, no signal.
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
  const city = listing.location.city;
  const inCity = comparable.filter((o) => sameCity(o.location.city, city));
  const hood = listing.location.neighborhood;
  const tiers: [Doc<"listings">[], string][] = [
    [hood ? inCity.filter((o) => o.location.neighborhood === hood) : [], `the ${hood}`],
    [inCity, city.split(",")[0].trim()],
    [isBayArea(city) ? comparable.filter((o) => isBayArea(o.location.city)) : [], "the Bay Area"],
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
    area,
    unit: cls,
    compIds: [...pool]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, COMPS_CITED)
      .map((o) => o._id),
  };
}

/** How the viewer is connected to the lister, from `listerNetwork` (#12). */
export type NetworkEvidence = {
  relation: "you" | "friend" | "friend_of_friend" | "none";
  mutualFriendCount: number;
  vouchTotal: number;
};

/**
 * A new account with no one the viewer knows: not a friend, no mutual friends
 * and no vouches from the viewer's network. `network` is null when the lister
 * is hidden from the viewer (blocked), which counts as no one they know.
 */
export function newAccountSignal(
  lister: Doc<"users">,
  network: NetworkEvidence | null,
  now = Date.now(),
): ListingSignal | null {
  const daysOld = Math.max(0, Math.floor((now - lister.joinedAt) / DAY));
  if (daysOld >= NEW_ACCOUNT_DAYS) return null;
  if (network && (network.relation === "you" || network.relation === "friend")) return null;
  if (network && (network.mutualFriendCount > 0 || network.vouchTotal > 0)) return null;
  return { kind: "new_account", daysOld };
}

/** True when the account is young enough that `newAccountSignal` needs the network. */
export function isNewAccount(lister: Doc<"users">, now = Date.now()) {
  return now - lister.joinedAt < NEW_ACCOUNT_DAYS * DAY;
}

/**
 * Photos of this listing already on an older listing by someone else, so the
 * original isn't flagged. Counts distinct photos.
 */
export function reusedPhotosSignal(
  listing: Doc<"listings">,
  others: Doc<"listings">[],
): ListingSignal | null {
  const mine = new Set(listing.photos);
  const found = new Set<string>();
  const listingIds: Id<"listings">[] = [];
  const older = others
    .filter(
      (o) =>
        o._id !== listing._id && o.sellerId !== listing.sellerId && o.createdAt < listing.createdAt,
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const o of older) {
    const shared = o.photos.filter((p) => mine.has(p));
    if (shared.length === 0) continue;
    for (const p of shared) found.add(p);
    if (listingIds.length < REUSED_CITED) listingIds.push(o._id);
  }
  return found.size > 0 ? { kind: "reused_photos", count: found.size, listingIds } : null;
}

/** The lister's own city is outside the Bay Area, for a Bay Area listing. */
export function farAwaySignal(
  listing: Doc<"listings">,
  lister: Doc<"users">,
): ListingSignal | null {
  if (!lister.city?.trim() || !isBayArea(listing.location.city) || isBayArea(lister.city))
    return null;
  return { kind: "lister_far_away", listerCity: lister.city, listingCity: listing.location.city };
}

/* ── Chat phrases ──────────────────────────────────────────────────────── */

const MONEY =
  "deposit|first month|first and last|holding fee|application fee|rent|payment|money|\\$\\s?\\d";
const PAY = "send|pay|wire|transfer|venmo|zelle";
const PAY_APPS =
  "wire( transfer)?|western union|moneygram|gift ?cards?|crypto|bitcoin|zelle|cash ?app|venmo";

/**
 * The rules-based chat check, used when AI is off and as Ember's fallback.
 * Each rule matches one sentence. `reason` describes what the message says,
 * not what the lister meant, so a harmless match still reads as neutral.
 */
export const SCAM_PHRASES: {
  category: ChatFlagCategory;
  pattern: RegExp;
  reason: string;
  /** Skip sentences that say the opposite ("please don't pay by wire"). */
  negatable?: boolean;
}[] = [
  {
    category: "deposit_before_viewing",
    pattern: new RegExp(
      `\\b(${MONEY})\\b[^.?!]*\\b(before (you |we )?(see|the viewing|a viewing|the showing|a showing|the tour|a tour|viewing|touring|signing)|to (hold|reserve|secure)|hold it|reserve it|secure it)\\b|\\b(${PAY})\\b[^.?!]*\\bbefore (you |we )?(see|the viewing|a viewing|viewing|the showing|the tour|touring)\\b`,
      "i",
    ),
    reason: "Mentions paying before you've seen the place in person.",
    negatable: true,
  },
  {
    category: "away_lister",
    pattern:
      /\b(out of (the )?(country|town|state)|overseas|abroad|deployed|on (a )?mission trip|(mail|ship|send) (you )?the keys)\b/i,
    reason: "Says they can't meet you or show the place in person.",
  },
  {
    category: "untraceable_payment",
    pattern: new RegExp(`\\b(${PAY_APPS})\\b`, "i"),
    reason: "Mentions a payment method that's hard to get back if something goes wrong.",
    negatable: true,
  },
  {
    category: "pressure",
    pattern:
      /\b((a )?lots? of (other )?(people|interest)|first come|today only|act fast|need to know (by )?today|decide (by )?today)\b/i,
    reason: "Asks you to decide or pay quickly.",
  },
  {
    category: "off_platform",
    pattern: /\b(text me|whatsapp|email me|my (personal )?(email|number)|telegram)\b/i,
    reason: "Asks to move the conversation off Facebook, where it's harder to report.",
  },
];

/** "Please don't pay by wire", "never send a deposit", "no need to Zelle me". */
const NEGATED = new RegExp(
  `\\b(don'?t|do not|never|won'?t (ask|need)|no need to)\\b(\\s+\\w+){0,4}?\\s*\\b(${PAY}|${PAY_APPS}|deposit|money|payment)\\b`,
  "i",
);

export function phraseFlags(text: string) {
  const sentences = text.split(/(?<=[.?!])\s+|\n+/).filter((s) => s.trim());
  return SCAM_PHRASES.filter((p) =>
    sentences.some((s) => p.pattern.test(s) && !(p.negatable && NEGATED.test(s))),
  ).map((p) => ({ category: p.category, reason: p.reason }));
}

/* ── Verified levels ──────────────────────────────────────────────────── */

/** Kinds in `listings.badges` for verified levels. Only seed or staff tools set them. */
export const BADGE = {
  identity: "identity_verified",
  property: "property_verified",
  toured: "toured",
} as const;

/** Badges that vouch for this specific unit: a different place makes them false. */
const PROPERTY_BADGES = new Set<string>([BADGE.property, BADGE.toured]);

/**
 * The listing's badges after its owner edits it. Moving it, changing its
 * photos or changing the unit (type, bedrooms, bathrooms) drops "Property
 * verified" and "Toured", which were about the old unit.
 */
export function badgesAfterEdit(
  before: Pick<Doc<"listings">, "badges" | "location" | "photos" | "rental">,
  after: Pick<Doc<"listings">, "location" | "photos" | "rental">,
): Doc<"listings">["badges"] {
  const unit = (r: Doc<"listings">["rental"]) =>
    r ? `${r.propertyType}:${r.bedrooms}:${r.bathrooms}` : "";
  const photos = (p: string[]) => [...p].sort().join("\n");
  const changed =
    before.location.city !== after.location.city ||
    before.location.neighborhood !== after.location.neighborhood ||
    before.location.lat !== after.location.lat ||
    before.location.lng !== after.location.lng ||
    photos(before.photos) !== photos(after.photos) ||
    unit(before.rental) !== unit(after.rental);
  return changed ? before.badges.filter((b) => !PROPERTY_BADGES.has(b.kind)) : before.badges;
}
