import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  friendRequestAudience,
  friendsListAudience,
  NotificationCategory,
  privacy,
} from "../validators";
import { areFriends } from "./users";

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
  listing_message: "marketplace",
  listing_saved: "marketplace",
  birthday: "birthdays",
  memory: "reminders",
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
  "two-factor": pref(OFF_ON),
  "login-alerts": pref(ON_OFF),
  "ads-interests": pref(ON_OFF),
  "ads-partners": pref(ON_OFF),
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
