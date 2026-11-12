import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  badge,
  listingCategory,
  listingCondition,
  location,
  media,
  messageAttachment,
  messageAuthor,
  messageStatus,
  notificationKind,
  postAttachment,
  privacy,
  reactionTarget,
  reactionType,
  rentalDetails,
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
    work: v.optional(v.array(v.object({ title: v.string(), company: v.string() }))),
    education: v.optional(
      v.array(v.object({ school: v.string(), detail: v.optional(v.string()) })),
    ),
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
  })
    .index("by_username", ["username"])
    .index("by_persona", ["isPersona"])
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
  })
    .index("by_slug", ["slug"])
    .index("by_activity", ["lastActivityAt"])
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
    reactionCount: v.number(),
    commentCount: v.number(),
    shareCount: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_author", ["authorId", "createdAt"])
    .index("by_group", ["groupId", "createdAt"])
    .index("by_timeline", ["timelineUserId", "createdAt"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["groupId"] }),

  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    parentId: v.optional(v.id("comments")),
    text: v.string(),
    media: v.optional(media),
    createdAt: v.number(),
    reactionCount: v.number(),
    replyCount: v.number(),
  })
    .index("by_post", ["postId", "createdAt"])
    .index("by_parent", ["parentId", "createdAt"]),

  reactions: defineTable({
    targetType: reactionTarget,
    targetId: v.string(),
    userId: v.id("users"),
    type: reactionType,
    createdAt: v.number(),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_target_user", ["targetType", "targetId", "userId"]),

  stories: defineTable({
    authorId: v.id("users"),
    media: media,
    text: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_author", ["authorId", "createdAt"])
    .index("by_expires", ["expiresAt"]),

  saved: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("post"), v.literal("listing"), v.literal("event")),
    refId: v.string(),
    collection: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_ref", ["userId", "kind", "refId"]),

  listings: defineTable({
    sellerId: v.id("users"),
    title: v.string(),
    price: v.number(), // whole dollars; 0 = free
    category: listingCategory,
    condition: v.optional(listingCondition),
    brand: v.optional(v.string()),
    description: v.string(),
    photos: v.array(v.string()),
    location,
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("sold")),
    rental: v.optional(rentalDetails),
    badges: v.array(badge),
    groupIds: v.optional(v.array(v.id("groups"))),
    createdAt: v.number(),
    updatedAt: v.number(),
    viewCount: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_category", ["category", "createdAt"])
    .index("by_seller", ["sellerId", "createdAt"])
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
  }),

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
    createdAt: v.number(),
  })
    .index("by_start", ["startAt"])
    .index("by_host", ["hostId", "startAt"])
    .index("by_group", ["groupId", "startAt"])
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
    .index("by_user_unseen", ["userId", "seen"]),
});
