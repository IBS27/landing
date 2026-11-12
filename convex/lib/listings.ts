import type { Doc, Id } from "../_generated/dataModel";
import type { ListingCategory } from "../validators";

/**
 * Marketplace shared metadata. Pure (no server imports) so the client can use
 * the same category table, conditions and distance math.
 */

export type CategoryMeta = {
  slug: string;
  label: string;
  /** Stored categories this browse category covers. Empty = matched by `match`. */
  categories: readonly ListingCategory[];
  /** Free Stuff also includes anything priced at $0. */
  includeFree?: boolean;
};

export const CATEGORIES: readonly CategoryMeta[] = [
  { slug: "vehicles", label: "Vehicles", categories: ["vehicles"] },
  { slug: "propertyrentals", label: "Property Rentals", categories: ["propertyrentals"] },
  { slug: "apparel", label: "Apparel", categories: ["apparel"] },
  { slug: "classifieds", label: "Classifieds", categories: ["classifieds"] },
  { slug: "electronics", label: "Electronics", categories: ["electronics"] },
  { slug: "entertainment", label: "Entertainment", categories: ["entertainment"] },
  { slug: "family", label: "Family", categories: ["family"] },
  { slug: "free", label: "Free Stuff", categories: ["free"], includeFree: true },
  { slug: "garden", label: "Garden & Outdoor", categories: ["garden"] },
  { slug: "hobbies", label: "Hobbies", categories: ["hobbies"] },
  { slug: "home", label: "Home Goods", categories: ["household", "furniture"] },
  {
    slug: "home-improvements",
    label: "Home Improvement Supplies",
    categories: ["homeimprovement"],
  },
  { slug: "propertyforsale", label: "Home Sales", categories: ["homesales"] },
  { slug: "instruments", label: "Musical Instruments", categories: ["musical"] },
  { slug: "office-supplies", label: "Office Supplies", categories: ["officesupplies"] },
  { slug: "pets", label: "Pet Supplies", categories: ["pets"] },
  { slug: "sports", label: "Sporting Goods", categories: ["sporting"] },
  { slug: "toys", label: "Toys & Games", categories: ["toys"] },
];

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** The browse category a stored category belongs to (for breadcrumbs). */
export function categoryFor(category: ListingCategory) {
  return CATEGORIES.find((c) => c.categories.includes(category)) ?? null;
}

/** Categories offered in the "Item for sale" composer, FB labels. */
export const ITEM_CATEGORIES: readonly { value: ListingCategory; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "household", label: "Household" },
  { value: "electronics", label: "Electronics" },
  { value: "apparel", label: "Clothing & accessories" },
  { value: "sporting", label: "Sporting goods" },
  { value: "musical", label: "Musical instruments" },
  { value: "hobbies", label: "Hobbies" },
  { value: "toys", label: "Toys & games" },
  { value: "family", label: "Baby & kids" },
  { value: "garden", label: "Garden & outdoor" },
  { value: "homeimprovement", label: "Tools & home improvement" },
  { value: "officesupplies", label: "Office supplies" },
  { value: "pets", label: "Pet supplies" },
  { value: "entertainment", label: "Books, movies & music" },
  { value: "classifieds", label: "Classifieds" },
  { value: "free", label: "Free stuff" },
];

export type Condition = NonNullable<Doc<"listings">["condition"]>;
export const CONDITIONS: readonly { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "used_like_new", label: "Used - like new" },
  { value: "used_good", label: "Used - good" },
  { value: "used_fair", label: "Used - fair" },
];
export const conditionLabel = (c: Condition) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

export type PropertyType = NonNullable<Doc<"listings">["rental"]>["propertyType"];
export const PROPERTY_TYPES: readonly { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "room", label: "Room only" },
  { value: "studio", label: "Studio" },
];
export const propertyTypeLabel = (t: PropertyType) =>
  PROPERTY_TYPES.find((x) => x.value === t)?.label ?? t;

/** Property-type filter: "Apartments" also covers studios. */
export function matchesPropertyType(actual: PropertyType, wanted: PropertyType) {
  return actual === wanted || (wanted === "apartment" && actual === "studio");
}

export type Meetup = NonNullable<Doc<"listings">["meetup"]>[number];
export const MEETUPS: readonly { value: Meetup; label: string; sub: string }[] = [
  { value: "public", label: "Public meetup", sub: "You'll meet at a public location." },
  { value: "door_pickup", label: "Door pickup", sub: "You'll leave the item at your door." },
  {
    value: "door_dropoff",
    label: "Door drop-off",
    sub: "You'll drop off the item at the buyer's door.",
  },
];

/** Bay Area places a listing (or the browse location) can be set to. */
export const PLACES = [
  {
    name: "San Francisco",
    region: "California",
    city: "San Francisco, CA",
    lat: 37.7749,
    lng: -122.4194,
  },
  { name: "Oakland", region: "California", city: "Oakland, CA", lat: 37.8045, lng: -122.2714 },
  { name: "Berkeley", region: "California", city: "Berkeley, CA", lat: 37.8708, lng: -122.2729 },
  { name: "Daly City", region: "California", city: "Daly City, CA", lat: 37.6905, lng: -122.4727 },
  { name: "San Mateo", region: "California", city: "San Mateo, CA", lat: 37.4969, lng: -122.3331 },
  {
    name: "Mountain View",
    region: "California",
    city: "Mountain View, CA",
    lat: 37.3894,
    lng: -122.0832,
  },
  { name: "San Jose", region: "California", city: "San Jose, CA", lat: 37.3362, lng: -121.8906 },
  {
    name: "Sacramento",
    region: "California",
    city: "Sacramento, CA",
    lat: 38.5811,
    lng: -121.4939,
  },
] as const;

/** Neighborhoods offered as a listing's location in the composer. */
export const NEIGHBORHOODS = [
  { name: "Mission", city: "San Francisco, CA", lat: 37.7599, lng: -122.4148 },
  { name: "Berkeley", city: "Berkeley, CA", lat: 37.867, lng: -122.2584 },
  { name: "Inner Richmond", city: "San Francisco, CA", lat: 37.7786, lng: -122.4642 },
  { name: "Haight-Ashbury", city: "San Francisco, CA", lat: 37.77, lng: -122.447 },
  { name: "Elmwood", city: "Berkeley, CA", lat: 37.8578, lng: -122.2539 },
  { name: "Pacific Heights", city: "San Francisco, CA", lat: 37.7927, lng: -122.4356 },
  { name: "Bernal Heights", city: "San Francisco, CA", lat: 37.741, lng: -122.4142 },
  { name: "Dogpatch", city: "San Francisco, CA", lat: 37.7607, lng: -122.3892 },
  { name: "Inner Sunset", city: "San Francisco, CA", lat: 37.7615, lng: -122.4676 },
  { name: "Rockridge", city: "Oakland, CA", lat: 37.8448, lng: -122.2513 },
  { name: "SoMa", city: "San Francisco, CA", lat: 37.7809, lng: -122.401 },
  { name: "Outer Sunset", city: "San Francisco, CA", lat: 37.7541, lng: -122.5062 },
  { name: "Nob Hill", city: "San Francisco, CA", lat: 37.793, lng: -122.4161 },
  { name: "Marina", city: "San Francisco, CA", lat: 37.803, lng: -122.4375 },
  { name: "Castro", city: "San Francisco, CA", lat: 37.7626, lng: -122.4353 },
  { name: "North Beach", city: "San Francisco, CA", lat: 37.8012, lng: -122.409 },
  { name: "Hayes Valley", city: "San Francisco, CA", lat: 37.7767, lng: -122.4229 },
  { name: "Noe Valley", city: "San Francisco, CA", lat: 37.7516, lng: -122.4321 },
  { name: "Oakland", city: "Oakland, CA", lat: 37.8045, lng: -122.2714 },
  { name: "Mountain View", city: "Mountain View, CA", lat: 37.3894, lng: -122.0832 },
  { name: "Daly City", city: "Daly City, CA", lat: 37.6905, lng: -122.4727 },
] as const;

export const RADII = [1, 2, 5, 10, 20, 40, 60, 80, 100, 250, 500] as const;

/** Great-circle distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Near = { lat: number; lng: number; radiusMi: number };

export function distanceTo(l: Doc<"listings">, near: Near | undefined) {
  if (!near || l.location.lat === undefined || l.location.lng === undefined) return null;
  return milesBetween(near, { lat: l.location.lat, lng: l.location.lng });
}

const DAY = 24 * 60 * 60 * 1000;

/** The compact shape every listing grid renders. */
export type ListingCard = {
  _id: Id<"listings">;
  title: string;
  price: number;
  originalPrice: number | null;
  photo: string | null;
  city: string;
  status: Doc<"listings">["status"];
  category: ListingCategory;
  createdAt: number;
  justListed: boolean;
  /** The seller added a video (grid tiles show a camera badge beside the price). */
  hasVideo: boolean;
  rental: {
    propertyType: PropertyType;
    bedrooms: number;
    bathrooms: number;
    listingType: "rent" | "sublet" | "sale";
  } | null;
  mileage: number | null;
};

export function toCard(l: Doc<"listings">, now = Date.now()): ListingCard {
  return {
    _id: l._id,
    title: l.title,
    price: l.price,
    originalPrice: l.originalPrice ?? null,
    photo: l.photos[0] ?? null,
    city: l.location.city,
    status: l.status,
    category: l.category,
    createdAt: l.createdAt,
    justListed: now - l.createdAt < DAY / 2,
    hasVideo: l.video !== undefined,
    rental: l.rental
      ? {
          propertyType: l.rental.propertyType,
          bedrooms: l.rental.bedrooms,
          bathrooms: l.rental.bathrooms,
          listingType: l.rental.listingType,
        }
      : null,
    mileage: l.vehicle?.mileage ?? null,
  };
}

/** "Listed a few seconds ago", "Listed 3 hours ago", "Listed a week ago", ... */
export function listedAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;
  if (s < 45) return "a few seconds ago";
  if (m < 1.5) return "a minute ago";
  if (m < 45) return `${Math.round(m)} minutes ago`;
  if (h < 1.5) return "an hour ago";
  if (h < 22) return `${Math.round(h)} hours ago`;
  if (d < 1.5) return "a day ago";
  if (d < 6.5) return `${Math.round(d)} days ago`;
  if (d < 10.5) return "a week ago";
  if (d < 26) return `${Math.round(d / 7)} weeks ago`;
  if (d < 45) return "a month ago";
  if (d < 320) return `${Math.round(d / 30)} months ago`;
  return "over a year ago";
}

/** "1 bed 1 bath", "3 beds 2.5 baths". */
export function bedsBaths(r: { bedrooms: number; bathrooms: number }) {
  const beds = r.bedrooms === 0 ? "Studio" : `${r.bedrooms} ${r.bedrooms === 1 ? "bed" : "beds"}`;
  return `${beds} ${r.bathrooms} ${r.bathrooms === 1 ? "bath" : "baths"}`;
}

/**
 * Facebook's generated home-listing title: "2 Beds 1 Bath Apartment",
 * "Studio 1 Bath Apartment". Rooms keep the seller's own title.
 */
export function homeTitle(
  r: { propertyType: PropertyType; bedrooms: number; bathrooms: number },
  fallback: string,
) {
  if (r.propertyType === "room") return fallback;
  const beds = r.bedrooms === 0 ? "Studio" : `${r.bedrooms} ${r.bedrooms === 1 ? "Bed" : "Beds"}`;
  const baths = `${r.bathrooms} ${r.bathrooms === 1 ? "Bath" : "Baths"}`;
  const type = r.propertyType === "studio" ? "Apartment" : propertyTypeLabel(r.propertyType);
  return `${beds} ${baths} ${type}`;
}

/**
 * A seller's Marketplace rating, derived deterministically from their id
 * (there are no buyer reviews in the clone).
 */
export function sellerRating(sellerId: string): { stars: number; count: number } {
  let h = 2166136261;
  for (let i = 0; i < sellerId.length; i++) {
    h ^= sellerId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const stars = [5, 5, 5, 4.5, 4.5, 4][(u >>> 3) % 6] ?? 5;
  const count = 1 + ((u >>> 7) % 48);
  return { stars, count };
}
