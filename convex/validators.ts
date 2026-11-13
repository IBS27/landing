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
  /** Landing: someone vouched for you (convex/vouches.ts). */
  v.literal("vouch"),
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
  v.literal("timeout"),
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
  /** The model that answered. */
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
  /** Who the result was for (`shownTo`), so they can see and delete it (#5). Unset for shared results. */
  userId: v.optional(v.id("users")),
  createdAt: v.number(),
});

/**
 * A citation source: a reference to a real record, never free text. Snippets,
 * counts and ages are read from the record when it's shown (see
 * `convex/lib/citations.ts`), so they stay current and can't be invented.
 * A `post` source also covers Group threads (a Group post and its comments).
 */
export const source = v.union(
  v.object({ kind: v.literal("post"), postId: v.id("posts") }),
  v.object({ kind: v.literal("comment"), commentId: v.id("comments") }),
  v.object({ kind: v.literal("event"), eventId: v.id("events") }),
  v.object({ kind: v.literal("listing"), listingId: v.id("listings") }),
  v.object({ kind: v.literal("group"), groupId: v.id("groups") }),
  v.object({ kind: v.literal("external"), externalSourceId: v.id("externalSources") }),
);
export type Source = Infer<typeof source>;

/**
 * The sources behind a score, recommendation or proposal. The `{ first, rest }`
 * shape means a value can't be stored without at least one source: TypeScript
 * rejects it at the insert, and schema validation rejects it at runtime.
 * Build it with `cite()` / `tryCite()` from `convex/lib/citations.ts`.
 */
export const citations = v.object({ first: source, rest: v.array(source) });
export type Citations = Infer<typeof citations>;

/** A WGS84 point. */
export const latLng = v.object({ lat: v.number(), lng: v.number() });

/**
 * GeoJSON MultiPolygon coordinates: polygons → rings (outer first, then holes)
 * → `[lng, lat]` positions. Helpers live in `convex/lib/geo.ts`.
 */
export const multiPolygon = v.array(v.array(v.array(v.array(v.number()))));

export const transitSystem = v.union(
  v.literal("bart"),
  v.literal("muni_metro"),
  v.literal("caltrain"),
);
export type TransitSystem = Infer<typeof transitSystem>;

/**
 * A cited fact about one neighborhood (#15): a transit station, a Muni Metro
 * line's stops there, a nightlife corridor, or a campus. `key` is stable across
 * reseeds ("bart:16th", "muni:n", "corridor:valencia", "campus:ucsf-parnassus");
 * a line or corridor that crosses several neighborhoods has one row in each.
 */
export const neighborhoodFact = v.union(
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("transit_station"),
    system: transitSystem,
    name: v.string(),
    /** BART line colors, Muni Metro letters, or Caltrain service patterns. */
    lines: v.array(v.string()),
    point: latLng,
    citations,
  }),
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("transit_line"),
    system: transitSystem,
    /** "N" */
    line: v.string(),
    /** "N Judah" */
    name: v.string(),
    /** The line's stops inside this neighborhood, in route order. */
    stops: v.array(v.object({ name: v.string(), point: latLng })),
    citations,
  }),
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("nightlife_corridor"),
    name: v.string(),
    detail: v.string(),
    /** The whole corridor, in order (it may extend into neighboring areas). */
    path: v.array(latLng),
    citations,
  }),
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("campus"),
    name: v.string(),
    institution: v.string(),
    detail: v.string(),
    point: latLng,
    citations,
  }),
  /** How often transit runs here and what runs late, from the GTFS feeds (#17). */
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("transit_service"),
    name: v.string(),
    /** Weekday trips an hour, 7am–7pm, by Muni, BART and Caltrain stopping here. */
    tripsPerHour: v.number(),
    /** Muni lines stopping here; `allNight` ones run 1:30–3:30am (Owl and 24-hour lines). */
    routes: v.array(
      v.object({
        line: v.string(),
        name: v.string(),
        mode: v.union(
          v.literal("bus"),
          v.literal("metro"),
          v.literal("streetcar"),
          v.literal("cable_car"),
        ),
        allNight: v.boolean(),
      }),
    ),
    /** Last departures, in minutes after the service day's midnight (past 1440 is after midnight). */
    lastTrains: v.array(
      v.object({
        system: v.union(v.literal("bart"), v.literal("caltrain")),
        station: v.string(),
        weekday: v.optional(v.number()),
        saturday: v.optional(v.number()),
        sunday: v.optional(v.number()),
      }),
    ),
    citations,
  }),
  /** 311 streetlight repair requests over a window (DataSF): requests, not confirmed outages (#17). */
  v.object({
    neighborhoodId: v.id("neighborhoods"),
    key: v.string(),
    kind: v.literal("streetlight_requests"),
    name: v.string(),
    count: v.number(),
    since: v.number(),
    until: v.number(),
    citations,
  }),
);
export type NeighborhoodFact = Infer<typeof neighborhoodFact>;

export const neighborhoodScoreKind = v.union(
  v.literal("things_to_do"),
  v.literal("food"),
  v.literal("transit"),
);
export type NeighborhoodScoreKind = Infer<typeof neighborhoodScoreKind>;

/* ---------- Landing: network vouching (see convex/vouches.ts) ---------- */

/** How a voucher knows the person they vouch for. Never a protected trait. */
export const vouchRelationship = v.union(
  v.literal("rented_from"),
  v.literal("lived_with"),
  v.literal("worked_with"),
  v.literal("bought_sold"),
  v.literal("know_personally"),
);
export type VouchRelationship = Infer<typeof vouchRelationship>;

/* ── Scam signals (#11) ────────────────────────────────────────────────── */

/** Why a chat message is worth a second look. Worded as things to check, not accusations. */
export const chatFlagCategory = v.union(
  v.literal("deposit_before_viewing"),
  v.literal("away_lister"),
  v.literal("untraceable_payment"),
  v.literal("pressure"),
  v.literal("off_platform"),
);
export type ChatFlagCategory = Infer<typeof chatFlagCategory>;

export const chatFlag = v.object({
  messageId: v.id("messages"),
  category: chatFlagCategory,
  /** One plain sentence on why this is worth checking. */
  reason: v.string(),
});

/* ── Muse proposals (#6) ───────────────────────────────────────────────── */

/**
 * What Muse wants to do, by kind. Agent code only ever creates a proposal
 * (`propose()` in convex/lib/proposals.ts); the action itself runs after the
 * owner approves, in `executeProposal()`.
 */
export const proposalPayload = v.union(
  /** A chat message. Also stored as a `pending_approval` draft in the thread. */
  v.object({
    kind: v.literal("message"),
    conversationId: v.id("conversations"),
    text: v.string(),
  }),
  /** A Marketplace offer or counteroffer, sent in the listing's chat. */
  v.object({
    kind: v.literal("offer"),
    conversationId: v.id("conversations"),
    listingId: v.id("listings"),
    amount: v.number(),
    text: v.string(),
  }),
  /** A new Event hosted by the owner, with friends invited. */
  v.object({
    kind: v.literal("event"),
    title: v.string(),
    description: v.string(),
    startAt: v.number(),
    venue: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    inviteIds: v.array(v.id("users")),
  }),
  /** A new Group created by the owner, with people invited. */
  v.object({
    kind: v.literal("group"),
    name: v.string(),
    description: v.string(),
    privacy: v.union(v.literal("public"), v.literal("private")),
    inviteIds: v.array(v.id("users")),
  }),
);
export type ProposalPayload = Infer<typeof proposalPayload>;
export type ProposalKind = ProposalPayload["kind"];

/** Pending until the owner decides. "edited" = approved after the owner changed it. */
export const proposalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("edited"),
  v.literal("rejected"),
  v.literal("expired"),
);
export type ProposalStatus = Infer<typeof proposalStatus>;

/** Which agent (and, when known, which task and model run) made a proposal. */
export const proposalOrigin = v.object({
  agent: aiAgent,
  task: v.optional(v.string()),
  runId: v.optional(v.id("aiRuns")),
  /** "fallback" means plain code wrote it, not the model. */
  via: v.optional(v.union(v.literal("model"), v.literal("cache"), v.literal("fallback"))),
});

/** What the executor created once a proposal was approved. */
export const proposalResult = v.union(
  v.object({ kind: v.literal("message"), messageId: v.id("messages") }),
  v.object({ kind: v.literal("event"), eventId: v.id("events") }),
  v.object({ kind: v.literal("group"), groupId: v.id("groups") }),
);

export const proposalAction = v.union(
  v.literal("created"),
  v.literal("edited"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
);

/** When a Weekend Route stop happens (#18), in day order. */
export const routeTime = v.union(
  v.literal("morning"),
  v.literal("midday"),
  v.literal("afternoon"),
  v.literal("evening"),
  v.literal("night"),
);
export type RouteTime = Infer<typeof routeTime>;

/**
 * One stop of a neighborhood's Weekend Route (#18). Every stop cites the posts,
 * comments or Event it came from, so a stop without a source can't be stored.
 */
export const weekendStop = v.object({
  name: v.string(),
  /** The place's key in #15's place list; unset when the place isn't on it (no pin). */
  placeKey: v.optional(v.string()),
  /** From #15's place list, or the Event's own point. Never geocoded from thread text. */
  point: v.optional(latLng),
  timeOfDay: routeTime,
  /** The place list's kind ("cafe", "park"), the model's category for unlisted places, or "event". */
  kind: v.string(),
  /** One line on why locals send you here. */
  why: v.string(),
  eventId: v.optional(v.id("events")),
  /** Event stops: when it starts and ends. */
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  /** Where locals disagree about this stop, with its own sources. */
  disagreement: v.optional(v.object({ note: v.string(), citations })),
  citations,
});
export type WeekendStop = Infer<typeof weekendStop>;
/* ── Marketplace negotiation (#36) ─────────────────────────────────────── */

/** "paused" and "stopped" are the buyer's; Muse drafts nothing while either is set. */
export const negotiationStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("stopped"),
);

/** Muse's next move in a negotiation. Every one becomes a proposal the buyer approves. */
export const negotiationMove = v.union(
  v.literal("offer"),
  v.literal("accept"),
  v.literal("message"),
  v.literal("walk_away"),
);
