import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { cityProfileFact } from "./lib/cityProfileFacts";
import { lifestyleAnswers } from "./lib/lifestyle";
import { profileSignal } from "./lib/profileSignals";
import { roomKind, roomVibe } from "./lib/vibe";
import {
  aiJobStatus,
  aiRun,
  badge,
  chatFlag,
  citations,
  friendRequestAudience,
  friendsListAudience,
  latLng,
  listingCategory,
  listingCondition,
  location,
  media,
  messageAttachment,
  messageAuthor,
  messageStatus,
  multiPolygon,
  negotiationMove,
  negotiationStatus,
  neighborhoodFact,
  notificationCategory,
  notificationKind,
  postAttachment,
  privacy,
  proposalAction,
  proposalOrigin,
  proposalPayload,
  proposalResult,
  proposalStatus,
  reactionTarget,
  reactionType,
  rentalDetails,
  vehicleDetails,
  vouchRelationship,
} from "./validators";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    firstName: v.string(),
    username: v.string(),
    avatar: v.string(),
    cover: v.optional(v.string()),
    bio: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    city: v.optional(v.string()),
    hometown: v.optional(v.string()),
    /** `start` / `end` are "YYYY-MM"; a job with a start and no end is current. */
    work: v.optional(
      v.array(
        v.object({
          title: v.string(),
          company: v.string(),
          start: v.optional(v.string()),
          end: v.optional(v.string()),
        }),
      ),
    ),
    education: v.optional(
      v.array(
        v.object({
          school: v.string(),
          detail: v.optional(v.string()),
          start: v.optional(v.string()),
          end: v.optional(v.string()),
        }),
      ),
    ),
    /** Featured photos (URLs) shown in the profile's Highlights card. */
    highlights: v.optional(v.array(v.string())),
    /** Website / social links (URLs) for the Links section (Pages and people). */
    links: v.optional(v.array(v.string())),
    relationship: v.optional(v.string()),
    birthday: v.optional(v.string()), // "MM-DD"
    verified: v.boolean(),
    joinedAt: v.number(),
    lastActiveAt: v.number(),
    /** Seeded demo accounts can be switched into from the account menu. */
    isPersona: v.boolean(),
    /** Seeded users that should always appear online in contacts. */
    alwaysOnline: v.optional(v.boolean()),
    kind: v.optional(v.union(v.literal("person"), v.literal("page"))),
    pageCategory: v.optional(v.string()),
    followerCount: v.optional(v.number()),
    /** Pages created in the app: the person who manages the Page. */
    pageOwnerId: v.optional(v.id("users")),
    /** Last time the Notifications panel was opened: newer notifications are "New" and badge the bell. */
    notificationsSeenAt: v.optional(v.number()),
    /** Profile note ("Share a thought…" bubble); shown for 24 hours. */
    note: v.optional(v.object({ text: v.string(), createdAt: v.number() })),
    /** Story privacy (Stories → Settings); unset means Friends. Custom shares with `storyAudienceIds`. */
    storyAudience: v.optional(
      v.union(v.literal("public"), v.literal("friends"), v.literal("custom")),
    ),
    storyAudienceIds: v.optional(v.array(v.id("users"))),
    /** People whose stories the user muted ("Mute <name>" in the story viewer). */
    mutedStoryAuthorIds: v.optional(v.array(v.id("users"))),
    /** Contacts → Options → "Turn off active status": others see the user as offline. */
    activeStatusOff: v.optional(v.boolean()),
  })
    .index("by_username", ["username"])
    .index("by_persona", ["isPersona"])
    .index("by_page_owner", ["pageOwnerId"])
    .searchIndex("search_name", { searchField: "name" }),

  /** Stored in both directions once accepted, so lookups are a single index read. */
  friendships: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_pair", ["userId", "friendId"]),

  friendRequests: defineTable({
    fromId: v.id("users"),
    toId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_to", ["toId", "createdAt"])
    .index("by_from", ["fromId", "createdAt"])
    .index("by_pair", ["fromId", "toId"]),

  /** Follows of Pages (Follow / Like buttons). Added on top of a Page's seeded `followerCount`. */
  follows: defineTable({
    userId: v.id("users"),
    targetId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_target", ["targetId", "createdAt"])
    .index("by_pair", ["userId", "targetId"]),

  groups: defineTable({
    name: v.string(),
    slug: v.string(),
    cover: v.string(),
    privacy: v.union(v.literal("public"), v.literal("private")),
    visible: v.boolean(),
    description: v.string(),
    category: v.string(),
    location: v.optional(v.string()),
    rules: v.array(v.object({ title: v.string(), body: v.string() })),
    tags: v.array(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    /** Members who exist outside the seeded world, so counts read realistically. */
    externalMemberCount: v.number(),
    memberCount: v.number(),
    lastActivityAt: v.number(),
    /** Where the Group is based (a neighborhood Group's center), if it has a home. */
    point: v.optional(latLng),
    /** DataSF neighborhood containing `point`, set by `neighborhoodIdAt`. */
    neighborhoodId: v.optional(v.id("neighborhoods")),
  })
    .index("by_slug", ["slug"])
    .index("by_activity", ["lastActivityAt"])
    .index("by_neighborhood", ["neighborhoodId", "lastActivityAt"])
    .searchIndex("search_name", { searchField: "name" }),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("moderator"), v.literal("member")),
    joinedAt: v.number(),
    lastVisitedAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId", "joinedAt"])
    .index("by_user", ["userId", "joinedAt"])
    .index("by_group_user", ["groupId", "userId"]),

  posts: defineTable({
    authorId: v.id("users"),
    /** Where the post lives: a profile timeline (the author's or a friend's) or a group. */
    groupId: v.optional(v.id("groups")),
    timelineUserId: v.optional(v.id("users")),
    /** Posts written in an event's Discussion tab. */
    eventId: v.optional(v.id("events")),
    text: v.optional(v.string()),
    background: v.optional(v.string()),
    media: v.array(media),
    attachments: v.array(postAttachment),
    sharedPostId: v.optional(v.id("posts")),
    feeling: v.optional(v.string()),
    place: v.optional(v.string()),
    taggedIds: v.optional(v.array(v.id("users"))),
    privacy,
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    /** Page ads rendered with a "Sponsored" label instead of a timestamp. */
    sponsored: v.optional(v.boolean()),
    /** Short vertical videos shown in Reels (a single 9:16 video). */
    isReel: v.optional(v.boolean()),
    /**
     * Live video broadcasts: set while the author is live (`endedAt` unset)
     * and after it ends. The host's heartbeat refreshes `lastSeenAt`; a
     * scheduled check ends broadcasts whose host went away.
     */
    live: v.optional(
      v.object({
        title: v.optional(v.string()),
        startedAt: v.number(),
        lastSeenAt: v.number(),
        endedAt: v.optional(v.number()),
      }),
    ),
    reactionCount: v.number(),
    commentCount: v.number(),
    shareCount: v.number(),
    /** Video posts: views from before the seeded world's history (the shown count starts here). */
    viewBaseline: v.optional(v.number()),
    /** Video posts: distinct `videoViews` rows recorded for this post (≥3s plays). */
    recordedViews: v.optional(v.number()),
  })
    .index("by_created", ["createdAt"])
    .index("by_author", ["authorId", "createdAt"])
    .index("by_group", ["groupId", "createdAt"])
    .index("by_timeline", ["timelineUserId", "createdAt"])
    .index("by_event", ["eventId", "createdAt"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["groupId"] }),

  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    parentId: v.optional(v.id("comments")),
    /** The tagged name a reply starts with; null when the replier removed it, unset = parent's author. */
    replyToId: v.optional(v.union(v.id("users"), v.null())),
    text: v.string(),
    media: v.optional(media),
    createdAt: v.number(),
    reactionCount: v.number(),
    replyCount: v.number(),
  })
    .index("by_post", ["postId", "createdAt"])
    .index("by_parent", ["parentId", "createdAt"]),

  /** Private comment downvotes (only the voter sees their own). */
  commentDownvotes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_comment_user", ["commentId", "userId"]),

  reactions: defineTable({
    targetType: reactionTarget,
    targetId: v.string(),
    userId: v.id("users"),
    type: reactionType,
    createdAt: v.number(),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_target_user", ["targetType", "targetId", "userId"])
    /** What someone reacted to, newest last ("likes" for Landing's vibe, #25). */
    .index("by_user", ["userId", "createdAt"]),

  stories: defineTable({
    authorId: v.id("users"),
    media: media,
    text: v.optional(v.string()),
    /** Text stories: a background key (see posts' `background`) instead of a photo. */
    background: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_author", ["authorId", "createdAt"])
    .index("by_expires", ["expiresAt"]),

  /** Who has seen which story: drives the tray's grey "seen" rings and the author's viewer list. */
  storyViews: defineTable({
    storyId: v.id("stories"),
    viewerId: v.id("users"),
    viewedAt: v.number(),
  })
    .index("by_story", ["storyId", "viewedAt"])
    .index("by_story_viewer", ["storyId", "viewerId"]),

  saved: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("post"), v.literal("listing"), v.literal("event")),
    refId: v.string(),
    /** The viewer's collection this item is filed under ("For later" by default). */
    collectionId: v.optional(v.id("savedCollections")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_ref", ["userId", "kind", "refId"])
    .index("by_ref", ["kind", "refId"])
    .index("by_collection", ["collectionId", "createdAt"]),

  /** Saved → My collections. */
  savedCollections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),

  /** Memories → Hide People / Hide Dates. Dates are local calendar days, "YYYY-MM-DD". */
  memoryHides: defineTable(
    v.union(
      v.object({
        userId: v.id("users"),
        kind: v.literal("person"),
        personId: v.id("users"),
        createdAt: v.number(),
      }),
      v.object({
        userId: v.id("users"),
        kind: v.literal("dates"),
        start: v.string(),
        end: v.string(),
        createdAt: v.number(),
      }),
    ),
  ).index("by_user", ["userId", "createdAt"]),

  listings: defineTable({
    sellerId: v.id("users"),
    title: v.string(),
    price: v.number(), // whole dollars; 0 = free
    category: listingCategory,
    condition: v.optional(listingCondition),
    brand: v.optional(v.string()),
    description: v.string(),
    photos: v.array(v.string()),
    /** Optional item video ("Add video" in the listing composer), shown first in the gallery. */
    video: v.optional(media),
    location,
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("sold")),
    rental: v.optional(rentalDetails),
    vehicle: v.optional(vehicleDetails),
    /** Set when the seller lowered the price; shown struck through. */
    originalPrice: v.optional(v.number()),
    /** Meetup preferences chosen by the seller. */
    meetup: v.optional(
      v.array(v.union(v.literal("public"), v.literal("door_pickup"), v.literal("door_dropoff"))),
    ),
    badges: v.array(badge),
    groupIds: v.optional(v.array(v.id("groups"))),
    createdAt: v.number(),
    updatedAt: v.number(),
    viewCount: v.number(),
    /**
     * DataSF neighborhood containing `location`'s point (unset outside San Francisco). Set from
     * coordinates by `neighborhoodIdAt`; `location.neighborhood` is only a display string.
     */
    neighborhoodId: v.optional(v.id("neighborhoods")),
  })
    .index("by_created", ["createdAt"])
    .index("by_category", ["category", "createdAt"])
    .index("by_seller", ["sellerId", "createdAt"])
    .index("by_neighborhood", ["neighborhoodId", "createdAt"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["category", "status"] }),

  conversations: defineTable({
    kind: v.union(v.literal("dm"), v.literal("group"), v.literal("marketplace")),
    title: v.optional(v.string()),
    photo: v.optional(v.string()),
    listingId: v.optional(v.id("listings")),
    memberIds: v.array(v.id("users")),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    lastMessageId: v.optional(v.id("messages")),
    /** Quick-reaction emoji sent by the composer's like button (default 👍). */
    emoji: v.optional(v.string()),
  }).index("by_listing", ["listingId"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.number(),
    lastMessageAt: v.number(),
    muted: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId", "lastMessageAt"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    author: messageAuthor,
    status: messageStatus,
    text: v.optional(v.string()),
    attachments: v.array(messageAttachment),
    replyToId: v.optional(v.id("messages")),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    unsent: v.optional(v.boolean()),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  /** Typing indicators; rows are short-lived. */
  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    until: v.number(),
  }).index("by_conversation", ["conversationId"]),

  /** Messenger end-to-end encryption PIN (salted SHA-256) and whether its prompt was dismissed. */
  messengerPins: defineTable({
    userId: v.id("users"),
    pinHash: v.optional(v.string()),
    salt: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /** Messenger audio/video calls. `joinedIds` is who is in the call right now. */
  calls: defineTable({
    conversationId: v.id("conversations"),
    callerId: v.id("users"),
    calleeIds: v.array(v.id("users")),
    kind: v.union(v.literal("audio"), v.literal("video")),
    status: v.union(
      v.literal("ringing"),
      v.literal("active"),
      v.literal("ended"),
      v.literal("missed"),
      v.literal("declined"),
    ),
    startedAt: v.number(),
    answeredAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    joinedIds: v.optional(v.array(v.id("users"))),
    declinedIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_status", ["status"])
    .index("by_conversation", ["conversationId", "startedAt"]),

  /** WebRTC signaling (offer / answer / ICE candidates / mic+camera state) between call peers. */
  callSignals: defineTable({
    callId: v.id("calls"),
    fromId: v.id("users"),
    toId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice"), v.literal("media")),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_call_to", ["callId", "toId", "createdAt"]),

  /**
   * Live video viewers: one row per open player (a person may watch in two
   * tabs). The host's Live Producer keeps one WebRTC connection per row;
   * `connected` is set once the stream reaches the viewer (the viewer count).
   */
  liveViewers: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    connected: v.boolean(),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_post", ["postId", "joinedAt"]),

  /** WebRTC signaling between a live host and one viewer session (offer, answer, ICE). */
  liveSignals: defineTable({
    postId: v.id("posts"),
    sessionId: v.id("liveViewers"),
    /** true: viewer → host; false: host → viewer. */
    toHost: v.boolean(),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
    createdAt: v.number(),
  })
    .index("by_post_dir", ["postId", "toHost", "createdAt"])
    .index("by_session_dir", ["sessionId", "toHost", "createdAt"]),

  /**
   * A live broadcast's recording, uploaded in parts while on air (one `take`
   * per producer page) and joined into the replay video once it ends.
   */
  liveRecordingParts: defineTable({
    postId: v.id("posts"),
    take: v.string(),
    seq: v.number(),
    storageId: v.id("_storage"),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    /** Set on the last part when the host finished the recording. */
    final: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_post_take", ["postId", "take", "seq"]),

  /** Reactions sent during a live video; each floats up over the stream once. */
  liveReactions: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    type: reactionType,
    createdAt: v.number(),
  }).index("by_post", ["postId", "createdAt"]),

  events: defineTable({
    hostId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    title: v.string(),
    cover: v.string(),
    description: v.string(),
    category: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    online: v.boolean(),
    venue: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.string(),
    privacy: v.union(
      v.literal("public"),
      v.literal("friends"),
      v.literal("private"),
      v.literal("group"),
    ),
    externalGoingCount: v.number(),
    externalInterestedCount: v.number(),
    /** Ticketed events: where to buy (shown as the Tickets card) and an optional price label. */
    ticketUrl: v.optional(v.string()),
    ticketProvider: v.optional(v.string()),
    ticketPrice: v.optional(v.string()),
    createdAt: v.number(),
    /** The venue's coordinates (in-person events). */
    point: v.optional(latLng),
    /** DataSF neighborhood containing `point`, set by `neighborhoodIdAt`. */
    neighborhoodId: v.optional(v.id("neighborhoods")),
  })
    .index("by_start", ["startAt"])
    .index("by_host", ["hostId", "startAt"])
    .index("by_group", ["groupId", "startAt"])
    .index("by_neighborhood", ["neighborhoodId", "startAt"])
    .searchIndex("search_title", { searchField: "title" }),

  eventResponses: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    status: v.union(v.literal("going"), v.literal("interested"), v.literal("invited")),
    createdAt: v.number(),
  })
    .index("by_event", ["eventId", "status"])
    .index("by_user", ["userId", "status"])
    .index("by_event_user", ["eventId", "userId"]),

  notifications: defineTable({
    userId: v.id("users"),
    actorId: v.optional(v.id("users")),
    kind: notificationKind,
    text: v.string(),
    postId: v.optional(v.id("posts")),
    commentId: v.optional(v.id("comments")),
    groupId: v.optional(v.id("groups")),
    eventId: v.optional(v.id("events")),
    listingId: v.optional(v.id("listings")),
    conversationId: v.optional(v.id("conversations")),
    read: v.boolean(),
    seen: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_unseen", ["userId", "seen"])
    .index("by_post", ["postId"]),

  /**
   * Citations: an external page (DataSF, SFMTA...) as fetched at `fetchedAt`.
   * Insert-only, so a score keeps citing the snapshot it was built from.
   */
  externalSources: defineTable({
    url: v.string(),
    title: v.string(),
    /** Who published it: "DataSF", "SFMTA". */
    publisher: v.string(),
    snippet: v.string(),
    fetchedAt: v.number(),
  }).index("by_url", ["url", "fetchedAt"]),

  /**
   * San Francisco's 41 DataSF Analysis Neighborhoods (#15). Built by
   * `scripts/neighborhoods/build.ts` and the seed; read through
   * `convex/lib/neighborhoods.ts` and `api.neighborhoods.*`.
   */
  neighborhoods: defineTable({
    /** DataSF name slugified ("south-of-market"); the same slugs as City Profile facts (#3). */
    slug: v.string(),
    /** DataSF's name ("South of Market"). */
    name: v.string(),
    /** What people call it ("SoMa"), when that differs. */
    shortName: v.optional(v.string()),
    /** Parks with no residents (Golden Gate Park, Lincoln Park, McLaren Park). */
    park: v.optional(v.boolean()),
    /** Label point, always inside the polygon. */
    center: latLng,
    bbox: v.object({ west: v.number(), south: v.number(), east: v.number(), north: v.number() }),
    /** Simplified to ~5 m. */
    polygon: multiPolygon,
    /** The DataSF boundary snapshot. */
    citations,
  }).index("by_slug", ["slug"]),

  /** Cited transit, nightlife and campus facts per neighborhood (#15). */
  neighborhoodFacts: defineTable(neighborhoodFact)
    .index("by_neighborhood", ["neighborhoodId", "kind"])
    .index("by_key", ["key"]),

  /** Settings & privacy choices, one row per user. Missing fields mean Facebook's defaults. */
  userSettings: defineTable({
    userId: v.id("users"),
    /** Default audience for new posts (Create post's audience chip). */
    defaultAudience: v.optional(privacy),
    friendRequests: v.optional(friendRequestAudience),
    friendsList: v.optional(friendsListAudience),
    hideReactionCountsOthers: v.optional(v.boolean()),
    hideReactionCountsOwn: v.optional(v.boolean()),
    /** Notification categories turned off ("Allow notifications on Facebook"). */
    notificationsOff: v.optional(v.array(notificationCategory)),
    /** Display only; the app stays in English. */
    language: v.optional(v.string()),
    /** Choices with no behavior in the clone (Media, Reels, tagging...), keyed by setting id. */
    prefs: v.optional(v.record(v.string(), v.string())),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** `userId` blocked `blockedId`. Blocking hides each from the other everywhere. */
  blocks: defineTable({
    userId: v.id("users"),
    blockedId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_blocked", ["blockedId"])
    .index("by_pair", ["userId", "blockedId"]),

  /** Posts (Reels) `userId` hid or reported; hidden from that viewer only. */
  hiddenPosts: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    reason: v.union(v.literal("hidden"), v.literal("reported")),
    createdAt: v.number(),
  }).index("by_user_post", ["userId", "postId"]),

  /** Videos `userId` watched (played ≥3s); drives the Watchlist's "N new videos". */
  videoViews: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    viewedAt: v.number(),
  }).index("by_user_post", ["userId", "postId"]),

  /** "Turn on notifications for this post": `userId` hears about new comments on `postId`. */
  postSubscriptions: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_user_post", ["userId", "postId"]),

  /** Per-viewer feed choices: "Hide post" (`targetId` a post) and "Snooze for 30 days" (`targetId` a user, until `until`). */
  feedHides: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("post"), v.literal("snooze")),
    targetId: v.string(),
    until: v.optional(v.number()),
  }).index("by_user_target", ["userId", "targetId"]),

  /** Content reports (posts, messages, listings), "Report a problem" and call problem reports filed by `userId`, with the reason they picked. */
  reports: defineTable({
    userId: v.id("users"),
    targetType: v.union(
      v.literal("post"),
      v.literal("message"),
      v.literal("call"),
      v.literal("listing"),
      v.literal("problem"),
    ),
    targetId: v.string(),
    reason: v.string(),
    /** "Report a problem": what happened, and whether a screenshot was included. */
    details: v.optional(v.string()),
    screenshot: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_user_target", ["userId", "targetType", "targetId"]),

  /** Ads Manager campaigns: drafts until "Review and publish". */
  adCampaigns: defineTable({
    userId: v.id("users"),
    name: v.string(),
    objective: v.string(),
    dailyBudget: v.number(),
    on: v.boolean(),
    status: v.union(v.literal("draft"), v.literal("published")),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
  }).index("by_user", ["userId", "createdAt"]),

  /** Games → "Your games": instant games `userId` saved (`gameId` is a catalog id). */
  gameSaves: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    savedAt: v.number(),
  })
    .index("by_user", ["userId", "savedAt"])
    .index("by_user_game", ["userId", "gameId"]),

  /** Games: `userId`'s best score per game and when they last played it ("Recently played"). */
  gameScores: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    best: v.number(),
    lastPlayedAt: v.number(),
  })
    .index("by_user", ["userId", "lastPlayedAt"])
    .index("by_user_game", ["userId", "gameId"]),
  /**
   * Marketplace negotiation (#36): the buyer's limits for one listing. Muse
   * drafts each move as a proposal (#6); nothing is sent without approval, and
   * no offer can go over `maxPrice`.
   */
  negotiations: defineTable({
    buyerId: v.id("users"),
    listingId: v.id("listings"),
    conversationId: v.id("conversations"),
    /** Hard limit, whole dollars. Enforced in code on every offer. */
    maxPrice: v.number(),
    /** Where Muse aims to land. */
    targetPrice: v.optional(v.number()),
    /** Anything Muse should know ("can pick up today"). */
    notes: v.optional(v.string()),
    status: negotiationStatus,
    /** The draft waiting for the buyer, if any. */
    pendingProposalId: v.optional(v.id("proposals")),
    /** Muse's last drafted move and price (the price may not have been sent). */
    lastMove: v.optional(negotiationMove),
    lastOffer: v.optional(v.number()),
    /** Time of the last seller message Muse has answered. */
    handledThrough: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_buyer", ["buyerId", "updatedAt"])
    .index("by_conversation", ["conversationId"]),

  /**
   * Things to check in a Marketplace chat about a rental (#11): which of the
   * lister's messages Ember flagged, for one viewer. Refreshed when new
   * messages arrive.
   */
  chatChecks: defineTable({
    conversationId: v.id("conversations"),
    viewerId: v.id("users"),
    listingId: v.id("listings"),
    flags: v.array(chatFlag),
    /** The conversation's `lastMessageAt` when it was checked; newer means stale. */
    checkedThrough: v.number(),
    via: v.union(v.literal("model"), v.literal("cache"), v.literal("fallback")),
    runId: v.optional(v.id("aiRuns")),
    createdAt: v.number(),
  }).index("by_conversation_viewer", ["conversationId", "viewerId"]),

  /**
   * Muse proposals (#6): everything Muse wants to send or create on someone's
   * behalf. Nothing happens until the owner approves; see convex/lib/proposals.ts.
   */
  proposals: defineTable({
    ownerId: v.id("users"),
    payload: proposalPayload,
    /** The payload as Muse first wrote it, kept when the owner edits. */
    original: v.optional(proposalPayload),
    /** One line on why Muse suggests this, shown with the proposal. */
    rationale: v.string(),
    citations: v.optional(citations),
    origin: proposalOrigin,
    status: proposalStatus,
    /** Time-sensitive proposals (offers) stop being sendable at this time. */
    expiresAt: v.optional(v.number()),
    /** For message and offer proposals: the `pending_approval` draft in the thread. */
    draftMessageId: v.optional(v.id("messages")),
    result: v.optional(proposalResult),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_owner_status", ["ownerId", "status", "createdAt"])
    .index("by_owner", ["ownerId", "createdAt"])
    .index("by_draft", ["draftMessageId"]),

  /** Audit log: one row per thing that happened to a proposal. */
  proposalEvents: defineTable({
    proposalId: v.id("proposals"),
    ownerId: v.id("users"),
    action: proposalAction,
    /** Who did it: the owner, Muse, or the system (expiry). */
    actor: v.union(v.literal("owner"), v.literal("agent"), v.literal("system")),
    at: v.number(),
  })
    .index("by_proposal", ["proposalId", "at"])
    .index("by_owner", ["ownerId", "at"]),

  /**
   * Subleases (#45): the lister's terms for a sublet listing. Muse replies to
   * renters in each chat as proposals (#6), never under `minRent`.
   */
  sublets: defineTable({
    listingId: v.id("listings"),
    ownerId: v.id("users"),
    /** Lowest monthly rent the lister would accept, whole dollars. */
    minRent: v.number(),
    /** Anything Muse should know ("flexible on move-in date"). */
    notes: v.optional(v.string()),
    /** Whether Muse drafts replies to renters. */
    museReplies: v.union(v.literal("active"), v.literal("paused")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])
    .index("by_owner", ["ownerId", "createdAt"]),

  /** One renter's chat about a sublet: Muse's waiting draft and last move there. */
  subletChats: defineTable({
    subletId: v.id("sublets"),
    conversationId: v.id("conversations"),
    pendingProposalId: v.optional(v.id("proposals")),
    lastMove: v.optional(negotiationMove),
    /** Time of the last renter message Muse has answered. */
    handledThrough: v.number(),
    updatedAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  /**
   * One row per model call made through `runAgent` (convex/ai/agent.ts), including
   * calls that ended in the task's non-AI fallback. Model results are reused by
   * `inputHash` while fresh, so shared outputs are generated once.
   */
  aiRuns: defineTable(aiRun)
    .index("by_hash", ["inputHash", "outcome", "createdAt"])
    .index("by_task", ["task", "createdAt"]),

  /**
   * Long AI jobs run on the scheduler (convex/ai/jobs.ts). The UI subscribes to
   * a row for status and progress; results land in the feature's own tables.
   */
  aiJobs: defineTable({
    kind: v.string(),
    /** Dedupe key within `kind`, e.g. a neighborhood id. */
    key: v.string(),
    /** Who may read the job; unset means any viewer (shared results). */
    userId: v.optional(v.id("users")),
    status: aiJobStatus,
    progress: v.optional(v.object({ label: v.string(), done: v.number(), total: v.number() })),
    error: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  }).index("by_kind_key", ["kind", "key", "createdAt"]),

  /* ---------------- Landing ---------------- */

  /** Landing City Profile (#3): one row per person who started the brief. Facts live in `cityProfileFacts`. */
  cityProfiles: defineTable({
    userId: v.id("users"),
    /** When the onboarding brief was last submitted; unset = not onboarded yet. */
    briefCompletedAt: v.optional(v.number()),
    updatedAt: v.number(),
    /** Learn from activity (#4). Unset means on; false stops recording signals and inferring. */
    learnFromActivity: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /**
   * City Profile facts (#3): one row per fact, each with its source, evidence and
   * confidence. Read through `getProfile` (convex/lib/cityProfile.ts), never directly.
   */
  cityProfileFacts: defineTable(cityProfileFact)
    .index("by_user", ["userId", "updatedAt"])
    .index("by_user_key", ["userId", "key"]),

  /**
   * Learn from activity (#4): what someone RSVP'd to, joined, liked, saved or
   * skipped, as the interests and neighborhood each maps to. Private to its
   * owner. Undoing an action sets `undoneAt`; rows are never deleted. Written
   * and read only through `convex/lib/activity.ts`.
   */
  profileSignals: defineTable(profileSignal)
    .index("by_user", ["userId", "at"])
    .index("by_user_target", ["userId", "targetId", "kind"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  /**
   * Landing network vouching: `voucherId` says they know `subjectId` (usually a
   * lister). One row per pair; vouching again updates it. About the person, not
   * a listing, so it carries over to all their listings (convex/lib/vouches.ts).
   */
  vouches: defineTable({
    voucherId: v.id("users"),
    subjectId: v.id("users"),
    relationship: vouchRelationship,
    /** Optional, at most VOUCH_NOTE_MAX characters. */
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["subjectId", "updatedAt"])
    .index("by_voucher", ["voucherId", "updatedAt"])
    .index("by_pair", ["voucherId", "subjectId"]),

  /**
   * Landing roommate lifestyle answers (#21): one row per person, written only
   * by them through the questionnaire. Private until `shared` is turned on, and
   * then visible only to others who share too. Read other people's answers
   * through `comparableLifestyles` (convex/lib/roommates.ts), never directly.
   */
  roommateLifestyles: defineTable({
    userId: v.id("users"),
    answers: lifestyleAnswers,
    /** Opted in to roommate matching. False until the person turns it on. */
    shared: v.boolean(),
    sharedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_shared", ["shared", "userId"]),

  /**
   * Landing rooms (#25): a person's room scan (photos and optional floor size)
   * and its style vibe. Marketplace matching (#26) and the 3D room (#37) read
   * these; see convex/rooms.ts.
   */
  rooms: defineTable({
    userId: v.id("users"),
    name: v.string(),
    kind: roomKind,
    /** The scan, oldest first; at most MAX_PHOTOS. Uploaded via `posts:generateUploadUrl`. */
    photos: v.array(
      v.object({ url: v.string(), storageId: v.optional(v.id("_storage")), addedAt: v.number() }),
    ),
    /** Floor size in feet, when the person measured it. */
    size: v.optional(v.object({ widthFt: v.number(), lengthFt: v.number() })),
    vibe: v.optional(roomVibe),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),
});
