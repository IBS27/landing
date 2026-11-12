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
  /** Videos: a poster frame shown before playback, and the length in seconds. */
  poster: v.optional(v.string()),
  duration: v.optional(v.number()),
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
  /** A reply to someone's story: a snapshot of the story so it survives expiry. */
  v.object({
    kind: v.literal("story"),
    storyId: v.id("stories"),
    url: v.optional(v.string()),
    background: v.optional(v.string()),
    text: v.optional(v.string()),
  }),
  /** A call log line ("You called Ethan", "Missed video call"). */
  v.object({
    kind: v.literal("call"),
    media: v.union(v.literal("audio"), v.literal("video")),
    outcome: v.union(
      v.literal("no_answer"),
      v.literal("cancelled"),
      v.literal("answered"),
      v.literal("declined"),
    ),
    durationMs: v.optional(v.number()),
    callId: v.optional(v.id("calls")),
  }),
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
  v.literal("homesales"),
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
    v.literal("condo"),
  ),
  listingType: v.union(v.literal("rent"), v.literal("sublet"), v.literal("sale")),
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

/** Vehicles for sale (Marketplace category "vehicles"). */
export const vehicleDetails = v.object({
  vehicleType: v.optional(v.string()), // "Car/Truck", "Motorcycle", ...
  make: v.string(),
  model: v.string(),
  year: v.number(),
  mileage: v.optional(v.number()),
  bodyStyle: v.optional(v.string()),
  transmission: v.optional(v.string()),
  fuelType: v.optional(v.string()),
  exteriorColor: v.optional(v.string()),
  titleStatus: v.optional(v.string()),
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
  v.literal("live"),
);

/** Settings → Notifications categories (each maps to one or more notification kinds). */
export const notificationCategory = v.union(
  v.literal("comments"),
  v.literal("tags"),
  v.literal("reminders"),
  v.literal("activity"),
  v.literal("friend_updates"),
  v.literal("friend_requests"),
  v.literal("people_you_may_know"),
  v.literal("birthdays"),
  v.literal("groups"),
  v.literal("video"),
  v.literal("events"),
  v.literal("pages"),
  v.literal("marketplace"),
  v.literal("fundraisers"),
);
export type NotificationCategory = Infer<typeof notificationCategory>;

/** Settings → "Who can send you friend requests?" */
export const friendRequestAudience = v.union(
  v.literal("everyone"),
  v.literal("friends_of_friends"),
);

/** Settings → "Who can see your friends list?" */
export const friendsListAudience = v.union(
  v.literal("public"),
  v.literal("friends"),
  v.literal("only_me"),
);

/* ---------- AI (see convex/ai/) ---------- */

/** Landing's model-backed agents: Muse drafts and acts, Ember reads local threads, Spark finds consensus. */
export const aiAgent = v.union(v.literal("muse"), v.literal("ember"), v.literal("spark"));
export type AiAgent = Infer<typeof aiAgent>;

/** Why a run returned its task's non-AI fallback instead of model output. */
export const aiFallbackReason = v.union(
  v.literal("disabled"),
  v.literal("invalid_output"),
  v.literal("model_error"),
  v.literal("refusal"),
);
export type AiFallbackReason = Infer<typeof aiFallbackReason>;

export const aiJobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);
export type AiJobStatus = Infer<typeof aiJobStatus>;

/** A logged model call (the `aiRuns` table). */
export const aiRun = v.object({
  agent: aiAgent,
  task: v.string(),
  inputHash: v.string(),
  outcome: v.union(v.literal("model"), v.literal("fallback")),
  fallbackReason: v.optional(aiFallbackReason),
  /** JSON of the validated model output, or of the fallback output. */
  output: v.string(),
  /** Keys of the sources the output cites; every one was in the run's input. */
  cited: v.array(v.string()),
  /** The model that answered (a refusal fallback can switch models). */
  model: v.optional(v.string()),
  attempts: v.number(),
  /** Why earlier attempts were rejected, or the API error. */
  errors: v.optional(v.array(v.string())),
  latencyMs: v.number(),
  usage: v.optional(
    v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      cacheReadTokens: v.number(),
      cacheWriteTokens: v.number(),
    }),
  ),
  costUsd: v.optional(v.number()),
  jobId: v.optional(v.id("aiJobs")),
  createdAt: v.number(),
});
