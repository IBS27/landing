import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  friendRequestAudience,
  friendsListAudience,
  NotificationCategory,
  privacy,
} from "../validators";
import { isBlockedEitherWay } from "./blocks";
import { areFriends, mutualFriendIds } from "./users";

/* ---------- Notification categories ---------- */

/** Settings → Notifications rows, in Facebook's order. */
export const NOTIFICATION_CATEGORIES: {
  id: NotificationCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "comments",
    label: "Comments",
    description: "These are notifications for comments on your posts and replies to your comments.",
  },
  {
    id: "tags",
    label: "Tags",
    description: "These are notifications for when someone tags you in a post or comment.",
  },
  {
    id: "reminders",
    label: "Reminders",
    description: "These are notifications to remind you of updates you may have missed.",
  },
  {
    id: "activity",
    label: "Activity about you",
    description:
      "These are notifications for reactions to your posts and other activity about you.",
  },
  {
    id: "friend_updates",
    label: "Updates from friends",
    description: "These are notifications about updates from your friends.",
  },
  {
    id: "friend_requests",
    label: "Friend requests",
    description:
      "These are notifications when someone sends you a friend request or accepts yours.",
  },
  {
    id: "people_you_may_know",
    label: "People you may know",
    description: "These are notifications about people you may know.",
  },
  {
    id: "birthdays",
    label: "Birthdays",
    description: "These are notifications about your friends' birthdays.",
  },
  {
    id: "groups",
    label: "Groups",
    description: "These are notifications about activity in groups you're a member of.",
  },
  {
    id: "video",
    label: "Video",
    description: "These are notifications about videos from people and Pages you follow.",
  },
  {
    id: "events",
    label: "Events",
    description: "These are notifications about events you're invited to or interested in.",
  },
  {
    id: "pages",
    label: "Pages you follow",
    description: "These are notifications about updates from Pages you follow.",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "These are notifications about listings, messages and items you've saved.",
  },
  {
    id: "fundraisers",
    label: "Fundraisers and crises",
    description: "These are notifications about fundraisers and crisis response.",
  },
  {
    id: "landing",
    label: "Landing",
    description:
      "These are notifications about drafts Muse has waiting for your OK and your weekly check-ins.",
  },
];

/** Which Settings category silences each notification kind. Unlisted kinds always notify. */
const CATEGORY_OF: Partial<Record<Doc<"notifications">["kind"], NotificationCategory>> = {
  reaction: "activity",
  comment: "comments",
  reply: "comments",
  mention: "tags",
  friend_request: "friend_requests",
  friend_accept: "friend_requests",
  group_post: "groups",
  group_invite: "groups",
  event_invite: "events",
  event_reminder: "events",
  event_activity: "events",
  listing_message: "marketplace",
  listing_saved: "marketplace",
  vouch: "marketplace",
  birthday: "birthdays",
  memory: "reminders",
  landing_check_in: "landing",
  landing_drafts: "landing",
};

export function notificationCategoryOf(kind: Doc<"notifications">["kind"]) {
  return CATEGORY_OF[kind] ?? null;
}

/* ---------- Display-only preferences ---------- */

const ON_OFF = ["On", "Off"] as const;
const OFF_ON = ["Off", "On"] as const;
const AUDIENCE3 = ["Public", "Friends", "Only me"] as const;
const LOOKUP = ["Everyone", "Friends of friends", "Friends", "Only me"] as const;

type Pref = { options: readonly string[]; default: string };
const pref = (options: readonly string[], def?: string): Pref => ({
  options,
  default: def ?? options[0],
});

/**
 * Settings that persist but have no behavior in the clone (Media, Reels,
 * tagging review...). Values are the option labels shown in the UI.
 */
export const PREFS: Record<string, Pref> = {
  "compact-mode": pref(OFF_ON),
  "saved-reminders": pref(ON_OFF),
  "memories-notifications": pref(["All memories", "Highlights", "None"]),
  translations: pref(["Translate posts into English (US)", "Don't translate"]),
  "region-format": pref(["English (US)", "English (UK)", "Español", "Français (France)"]),
  "video-quality": pref(["Default", "SD only", "HD if available"]),
  autoplay: pref(["Default", "On", "Off"]),
  "share-to-stories": pref(ON_OFF),
  "lookup-email": pref(LOOKUP),
  "lookup-phone": pref(LOOKUP),
  "search-engines": pref(ON_OFF),
  "stories-audience": pref(["Public", "Friends", "Custom"], "Friends"),
  "stories-sharing": pref(ON_OFF),
  "reels-audience": pref(["Public", "Friends"]),
  "reels-remix": pref(ON_OFF),
  "reels-download": pref(ON_OFF),
  /** Home's Reels shelf menu ("Show fewer reels" moves it down the Feed, "Hide all reels" removes it). */
  "reels-in-feed": pref(["Show", "Show fewer", "Hidden"]),
  "who-can-follow": pref(["Public", "Friends"]),
  "public-comments": pref(["Public", "Friends of friends", "Friends"]),
  "public-profile-info": pref(["Public", "Friends of friends", "Friends"]),
  "review-tags-profile": pref(OFF_ON),
  "review-tags-posts": pref(OFF_ON),
  "who-can-post-on-profile": pref(["Friends", "Only me"]),
  "who-can-see-profile-posts": pref(["Friends", "Friends of friends", "Only me"]),
  "audience-city": pref(AUDIENCE3),
  "audience-hometown": pref(AUDIENCE3),
  "audience-work": pref(AUDIENCE3),
  "audience-birthday": pref(AUDIENCE3, "Friends"),
  "audience-education": pref(AUDIENCE3),
  "audience-relationship": pref(AUDIENCE3),
  /** Own profile's "Get more out of Facebook" card (its X hides it for good). */
  "profile-tips-card": pref(["Show", "Hidden"]),
  "two-factor": pref(OFF_ON),
  "login-alerts": pref(ON_OFF),
  "ads-interests": pref(ON_OFF),
  "ads-partners": pref(ON_OFF),
  "games-notifications": pref(ON_OFF),
  "games-activity": pref(ON_OFF),
  ...Object.fromEntries(
    NOTIFICATION_CATEGORIES.flatMap((c) =>
      (["push", "email", "sms"] as const).map((ch) => [
        `notify-${c.id}-${ch}`,
        pref(ch === "sms" ? OFF_ON : ON_OFF),
      ]),
    ),
  ),
};

export const LANGUAGES = [
  "English (US)",
  "English (UK)",
  "Español",
  "Français (France)",
  "Deutsch",
  "Português (Brasil)",
  "Tiếng Việt",
  "中文(简体)",
] as const;

/* ---------- Resolved settings ---------- */

export type Settings = {
  defaultAudience: Infer<typeof privacy>;
  friendRequests: Infer<typeof friendRequestAudience>;
  friendsList: Infer<typeof friendsListAudience>;
  hideReactionCountsOthers: boolean;
  hideReactionCountsOwn: boolean;
  notificationsOff: NotificationCategory[];
  language: string;
  prefs: Record<string, string>;
};

export function settingsRow(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** A user's settings with Facebook's defaults filled in. */
export async function getSettings(ctx: QueryCtx, userId: Id<"users">): Promise<Settings> {
  const row = await settingsRow(ctx, userId);
  const prefs: Record<string, string> = {};
  for (const [key, p] of Object.entries(PREFS)) {
    const saved = row?.prefs?.[key];
    prefs[key] = saved !== undefined && p.options.includes(saved) ? saved : p.default;
  }
  return {
    defaultAudience: row?.defaultAudience ?? "friends",
    friendRequests: row?.friendRequests ?? "everyone",
    friendsList: row?.friendsList ?? "public",
    hideReactionCountsOthers: row?.hideReactionCountsOthers ?? false,
    hideReactionCountsOwn: row?.hideReactionCountsOwn ?? false,
    notificationsOff: row?.notificationsOff ?? [],
    language: row?.language ?? "English (US)",
    prefs,
  };
}

/** "Who can see your friends list?": owners always can; others per the owner's choice. */
export async function canSeeFriendsList(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  viewerId: Id<"users">,
) {
  if (ownerId === viewerId) return true;
  const row = await settingsRow(ctx, ownerId);
  const audience = row?.friendsList ?? "public";
  if (audience === "public") return true;
  if (audience === "only_me") return false;
  return areFriends(ctx, ownerId, viewerId);
}

/**
 * The part of `ownerId`'s friend list the viewer may see: never people
 * blocked either way, and only mutual friends when the list is hidden.
 */
export async function visibleFriendIds(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  viewerId: Id<"users">,
  ids: Id<"users">[],
  viewerFriends: Set<Id<"users">>,
  blocked: Set<Id<"users">>,
) {
  const open = await canSeeFriendsList(ctx, ownerId, viewerId);
  return ids.filter((id) => !blocked.has(id) && (open || viewerFriends.has(id)));
}

/* ---------- Enforced privacy preferences ---------- */

/**
 * "Who can post on your profile?": the owner always can; others only when the
 * owner allows Friends and they are friends (never when blocked either way).
 */
export async function canPostOnProfile(ctx: QueryCtx, ownerId: Id<"users">, viewerId: Id<"users">) {
  if (ownerId === viewerId) return true;
  const owner = await ctx.db.get(ownerId);
  if (!owner || owner.kind === "page") return false;
  if (await isBlockedEitherWay(ctx, ownerId, viewerId)) return false;
  const { prefs } = await getSettings(ctx, ownerId);
  if (prefs["who-can-post-on-profile"] === "Only me") return false;
  return areFriends(ctx, ownerId, viewerId);
}

/**
 * "Who can comment on your public posts?": applies to a person's public,
 * non-group posts. The author can always comment. Returns whether the viewer
 * may comment.
 */
export async function canCommentOn(ctx: QueryCtx, post: Doc<"posts">, viewerId: Id<"users">) {
  if (post.authorId === viewerId || post.privacy !== "public" || post.groupId) return true;
  const author = await ctx.db.get(post.authorId);
  if (!author || author.kind === "page" || author.pageOwnerId === viewerId) return true;
  const audience = (await getSettings(ctx, post.authorId)).prefs["public-comments"];
  if (audience === "Public") return true;
  if (await areFriends(ctx, post.authorId, viewerId)) return true;
  if (audience === "Friends") return false;
  return (await mutualFriendIds(ctx, post.authorId, viewerId)).length > 0;
}

/* ---------- Profile details audiences ---------- */

/** About details that carry their own audience (Settings → Profile details, or the About tab). */
export const DETAIL_PREFS = {
  city: "audience-city",
  hometown: "audience-hometown",
  work: "audience-work",
  education: "audience-education",
  relationship: "audience-relationship",
  birthday: "audience-birthday",
} as const;
export type DetailField = keyof typeof DETAIL_PREFS;
export type DetailAudience = (typeof AUDIENCE3)[number];

/** Each detail's audience, as chosen by the person (defaults filled in). */
export async function detailAudiences(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Record<DetailField, DetailAudience>> {
  const { prefs } = await getSettings(ctx, userId);
  const out = {} as Record<DetailField, DetailAudience>;
  for (const [field, key] of Object.entries(DETAIL_PREFS) as [DetailField, string][])
    out[field] = prefs[key] as DetailAudience;
  return out;
}

/**
 * The person's About details that the viewer may see: the owner sees
 * everything; others see a detail only when its audience is Public, or
 * Friends and they are friends. Hidden details come back empty.
 */
export async function visibleDetails(
  ctx: QueryCtx,
  u: Doc<"users">,
  viewerId: Id<"users">,
  isFriend?: boolean,
) {
  const isSelf = u._id === viewerId;
  const aud = await detailAudiences(ctx, u._id);
  const friend =
    isSelf ||
    (Object.values(aud).includes("Friends") &&
      (isFriend ?? (await areFriends(ctx, u._id, viewerId))));
  const show = (f: DetailField) =>
    isSelf || aud[f] === "Public" || (aud[f] === "Friends" && friend);
  return {
    city: show("city") ? (u.city ?? null) : null,
    hometown: show("hometown") ? (u.hometown ?? null) : null,
    work: show("work") ? (u.work ?? []) : [],
    education: show("education") ? (u.education ?? []) : [],
    relationship: show("relationship") ? (u.relationship ?? null) : null,
    birthday: show("birthday") ? (u.birthday ?? null) : null,
  };
}

/**
 * "Who can see what others post on your profile?": whether the viewer may see
 * posts other people wrote on `ownerId`'s timeline. The owner always can.
 */
export async function canSeeWallPosts(ctx: QueryCtx, ownerId: Id<"users">, viewerId: Id<"users">) {
  if (ownerId === viewerId) return true;
  const rule = (await getSettings(ctx, ownerId)).prefs["who-can-see-profile-posts"];
  if (rule === "Only me") return false;
  if (await areFriends(ctx, ownerId, viewerId)) return true;
  if (rule === "Friends") return false;
  return (await mutualFriendIds(ctx, ownerId, viewerId)).length > 0;
}
