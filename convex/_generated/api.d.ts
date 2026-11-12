/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as comments from "../comments.js";
import type * as conversations from "../conversations.js";
import type * as events from "../events.js";
import type * as feed from "../feed.js";
import type * as friends from "../friends.js";
import type * as groups from "../groups.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_listings from "../lib/listings.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_posts from "../lib/posts.js";
import type * as lib_users from "../lib/users.js";
import type * as listings from "../listings.js";
import type * as media from "../media.js";
import type * as messenger from "../messenger.js";
import type * as notifications from "../notifications.js";
import type * as pages from "../pages.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as reactions from "../reactions.js";
import type * as saved from "../saved.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seed_images from "../seed/images.js";
import type * as seed_lib_backgrounds from "../seed/lib/backgrounds.js";
import type * as seed_lib_images from "../seed/lib/images.js";
import type * as seed_lib_places from "../seed/lib/places.js";
import type * as seed_lib_prng from "../seed/lib/prng.js";
import type * as seed_lib_time from "../seed/lib/time.js";
import type * as seed_plan from "../seed/plan.js";
import type * as seed_types from "../seed/types.js";
import type * as seed_world_events from "../seed/world/events.js";
import type * as seed_world_extras from "../seed/world/extras.js";
import type * as seed_world_friends from "../seed/world/friends.js";
import type * as seed_world_groups from "../seed/world/groups.js";
import type * as seed_world_listings from "../seed/world/listings.js";
import type * as seed_world_messages from "../seed/world/messages.js";
import type * as seed_world_pages from "../seed/world/pages.js";
import type * as seed_world_people from "../seed/world/people.js";
import type * as seed_world_posts_friends from "../seed/world/posts/friends.js";
import type * as seed_world_posts_groups from "../seed/world/posts/groups.js";
import type * as seed_world_posts_pages from "../seed/world/posts/pages.js";
import type * as seed_world_rentals from "../seed/world/rentals.js";
import type * as seed_world_stories from "../seed/world/stories.js";
import type * as stories from "../stories.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  comments: typeof comments;
  conversations: typeof conversations;
  events: typeof events;
  feed: typeof feed;
  friends: typeof friends;
  groups: typeof groups;
  "lib/functions": typeof lib_functions;
  "lib/listings": typeof lib_listings;
  "lib/notify": typeof lib_notify;
  "lib/posts": typeof lib_posts;
  "lib/users": typeof lib_users;
  listings: typeof listings;
  media: typeof media;
  messenger: typeof messenger;
  notifications: typeof notifications;
  pages: typeof pages;
  posts: typeof posts;
  profiles: typeof profiles;
  reactions: typeof reactions;
  saved: typeof saved;
  search: typeof search;
  seed: typeof seed;
  "seed/images": typeof seed_images;
  "seed/lib/backgrounds": typeof seed_lib_backgrounds;
  "seed/lib/images": typeof seed_lib_images;
  "seed/lib/places": typeof seed_lib_places;
  "seed/lib/prng": typeof seed_lib_prng;
  "seed/lib/time": typeof seed_lib_time;
  "seed/plan": typeof seed_plan;
  "seed/types": typeof seed_types;
  "seed/world/events": typeof seed_world_events;
  "seed/world/extras": typeof seed_world_extras;
  "seed/world/friends": typeof seed_world_friends;
  "seed/world/groups": typeof seed_world_groups;
  "seed/world/listings": typeof seed_world_listings;
  "seed/world/messages": typeof seed_world_messages;
  "seed/world/pages": typeof seed_world_pages;
  "seed/world/people": typeof seed_world_people;
  "seed/world/posts/friends": typeof seed_world_posts_friends;
  "seed/world/posts/groups": typeof seed_world_posts_groups;
  "seed/world/posts/pages": typeof seed_world_posts_pages;
  "seed/world/rentals": typeof seed_world_rentals;
  "seed/world/stories": typeof seed_world_stories;
  stories: typeof stories;
  users: typeof users;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
