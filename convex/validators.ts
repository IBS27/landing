import { type Infer, v } from "convex/values";

/**
 * Shared validators. The `attachment` unions are deliberate extension points:
 * new product features add a `kind` here instead of new columns.
 */

export const media = v.object({
  url: v.string(),
  kind: v.union(v.literal("image"), v.literal("video")),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  alt: v.optional(v.string()),
});
export type Media = Infer<typeof media>;

export const reactionType = v.union(
  v.literal("like"),
  v.literal("love"),
  v.literal("care"),
  v.literal("haha"),
  v.literal("wow"),
  v.literal("sad"),
  v.literal("angry"),
);
export type ReactionType = Infer<typeof reactionType>;

export const reactionTarget = v.union(
  v.literal("post"),
  v.literal("comment"),
  v.literal("message"),
);

export const postAttachment = v.union(
  v.object({ kind: v.literal("listing"), listingId: v.id("listings") }),
  v.object({ kind: v.literal("event"), eventId: v.id("events") }),
  v.object({
    kind: v.literal("link"),
    url: v.string(),
    title: v.string(),
    domain: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
  }),
);
export type PostAttachment = Infer<typeof postAttachment>;

export const messageAttachment = v.union(
  v.object({
    kind: v.literal("image"),
    url: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  }),
  v.object({ kind: v.literal("listing"), listingId: v.id("listings") }),
  v.object({ kind: v.literal("post"), postId: v.id("posts") }),
  v.object({ kind: v.literal("sticker"), emoji: v.string() }),
);
export type MessageAttachment = Infer<typeof messageAttachment>;

/** Who wrote a message: the person, or an agent acting on their behalf. */
export const messageAuthor = v.union(
  v.object({ kind: v.literal("human") }),
  v.object({ kind: v.literal("agent"), agent: v.string() }),
);

/** Agent-written messages start as drafts and wait for the owner's approval. */
export const messageStatus = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("sent"),
);

export const badge = v.object({ kind: v.string(), label: v.string() });

export const listingCategory = v.union(
  v.literal("vehicles"),
  v.literal("propertyrentals"),
  v.literal("apparel"),
  v.literal("classifieds"),
  v.literal("electronics"),
  v.literal("entertainment"),
  v.literal("family"),
  v.literal("free"),
  v.literal("garden"),
  v.literal("hobbies"),
  v.literal("household"),
  v.literal("furniture"),
  v.literal("homeimprovement"),
  v.literal("musical"),
  v.literal("officesupplies"),
  v.literal("pets"),
  v.literal("sporting"),
  v.literal("toys"),
);
export type ListingCategory = Infer<typeof listingCategory>;

export const listingCondition = v.union(
  v.literal("new"),
  v.literal("used_like_new"),
  v.literal("used_good"),
  v.literal("used_fair"),
);

export const rentalDetails = v.object({
  propertyType: v.union(
    v.literal("apartment"),
    v.literal("house"),
    v.literal("room"),
    v.literal("townhouse"),
    v.literal("studio"),
  ),
  listingType: v.union(v.literal("rent"), v.literal("sublet")),
  bedrooms: v.number(),
  bathrooms: v.number(),
  sqft: v.optional(v.number()),
  availableFrom: v.optional(v.number()),
  availableTo: v.optional(v.number()),
  furnished: v.optional(v.boolean()),
  petsAllowed: v.optional(v.boolean()),
  laundry: v.optional(v.string()),
  parking: v.optional(v.string()),
  address: v.optional(v.string()),
});

export const location = v.object({
  city: v.string(),
  neighborhood: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
});

export const privacy = v.union(v.literal("public"), v.literal("friends"), v.literal("only_me"));

export const notificationKind = v.union(
  v.literal("reaction"),
  v.literal("comment"),
  v.literal("reply"),
  v.literal("mention"),
  v.literal("friend_request"),
  v.literal("friend_accept"),
  v.literal("group_post"),
  v.literal("group_invite"),
  v.literal("event_invite"),
  v.literal("event_reminder"),
  v.literal("listing_message"),
  v.literal("listing_saved"),
  v.literal("birthday"),
  v.literal("memory"),
);
