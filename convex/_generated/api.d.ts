/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ads from "../ads.js";
import type * as ai_agent from "../ai/agent.js";
import type * as ai_jobs from "../ai/jobs.js";
import type * as ai_model from "../ai/model.js";
import type * as ai_outputSchema from "../ai/outputSchema.js";
import type * as ai_runs from "../ai/runs.js";
import type * as ai_sources from "../ai/sources.js";
import type * as ai_status from "../ai/status.js";
import type * as calls from "../calls.js";
import type * as citations from "../citations.js";
import type * as cityProfile from "../cityProfile.js";
import type * as comments from "../comments.js";
import type * as conversations from "../conversations.js";
import type * as events from "../events.js";
import type * as feed from "../feed.js";
import type * as feedReasons from "../feedReasons.js";
import type * as friends from "../friends.js";
import type * as games from "../games.js";
import type * as groups from "../groups.js";
import type * as lib_blocks from "../lib/blocks.js";
import type * as lib_callFormat from "../lib/callFormat.js";
import type * as lib_citations from "../lib/citations.js";
import type * as lib_cityProfile from "../lib/cityProfile.js";
import type * as lib_cityProfileFacts from "../lib/cityProfileFacts.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_groupActivity from "../lib/groupActivity.js";
import type * as lib_interests from "../lib/interests.js";
import type * as lib_lifestyle from "../lib/lifestyle.js";
import type * as lib_listings from "../lib/listings.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_posts from "../lib/posts.js";
import type * as lib_profileFromText from "../lib/profileFromText.js";
import type * as lib_profileText from "../lib/profileText.js";
import type * as lib_proposals from "../lib/proposals.js";
import type * as lib_protectedText from "../lib/protectedText.js";
import type * as lib_reports from "../lib/reports.js";
import type * as lib_roommates from "../lib/roommates.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_thumb from "../lib/thumb.js";
import type * as lib_trust from "../lib/trust.js";
import type * as lib_users from "../lib/users.js";
import type * as lib_vouchNote from "../lib/vouchNote.js";
import type * as lib_vouches from "../lib/vouches.js";
import type * as listings from "../listings.js";
import type * as live from "../live.js";
import type * as liveReplay from "../liveReplay.js";
import type * as media from "../media.js";
import type * as memories from "../memories.js";
import type * as messenger from "../messenger.js";
import type * as notifications from "../notifications.js";
import type * as pages from "../pages.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as proposals from "../proposals.js";
import type * as reactions from "../reactions.js";
import type * as reports from "../reports.js";
import type * as roommates from "../roommates.js";
import type * as saved from "../saved.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seed_cityProfiles from "../seed/cityProfiles.js";
import type * as seed_images from "../seed/images.js";
import type * as seed_lib_backgrounds from "../seed/lib/backgrounds.js";
import type * as seed_lib_images from "../seed/lib/images.js";
import type * as seed_lib_places from "../seed/lib/places.js";
import type * as seed_lib_prng from "../seed/lib/prng.js";
import type * as seed_lib_time from "../seed/lib/time.js";
import type * as seed_lib_videos from "../seed/lib/videos.js";
import type * as seed_plan from "../seed/plan.js";
import type * as seed_types from "../seed/types.js";
import type * as seed_world_cityProfiles from "../seed/world/cityProfiles.js";
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
import type * as seed_world_posts_threads from "../seed/world/posts/threads.js";
import type * as seed_world_rentals from "../seed/world/rentals.js";
import type * as seed_world_roommateLifestyles from "../seed/world/roommateLifestyles.js";
import type * as seed_world_stories from "../seed/world/stories.js";
import type * as seed_world_videos from "../seed/world/videos.js";
import type * as seed_world_vouches from "../seed/world/vouches.js";
import type * as settings from "../settings.js";
import type * as stories from "../stories.js";
import type * as trust from "../trust.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as vouches from "../vouches.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ads: typeof ads;
  "ai/agent": typeof ai_agent;
  "ai/jobs": typeof ai_jobs;
  "ai/model": typeof ai_model;
  "ai/outputSchema": typeof ai_outputSchema;
  "ai/runs": typeof ai_runs;
  "ai/sources": typeof ai_sources;
  "ai/status": typeof ai_status;
  calls: typeof calls;
  citations: typeof citations;
  cityProfile: typeof cityProfile;
  comments: typeof comments;
  conversations: typeof conversations;
  events: typeof events;
  feed: typeof feed;
  feedReasons: typeof feedReasons;
  friends: typeof friends;
  games: typeof games;
  groups: typeof groups;
  "lib/blocks": typeof lib_blocks;
  "lib/callFormat": typeof lib_callFormat;
  "lib/citations": typeof lib_citations;
  "lib/cityProfile": typeof lib_cityProfile;
  "lib/cityProfileFacts": typeof lib_cityProfileFacts;
  "lib/functions": typeof lib_functions;
  "lib/groupActivity": typeof lib_groupActivity;
  "lib/interests": typeof lib_interests;
  "lib/lifestyle": typeof lib_lifestyle;
  "lib/listings": typeof lib_listings;
  "lib/notify": typeof lib_notify;
  "lib/posts": typeof lib_posts;
  "lib/profileFromText": typeof lib_profileFromText;
  "lib/profileText": typeof lib_profileText;
  "lib/proposals": typeof lib_proposals;
  "lib/protectedText": typeof lib_protectedText;
  "lib/reports": typeof lib_reports;
  "lib/roommates": typeof lib_roommates;
  "lib/settings": typeof lib_settings;
  "lib/thumb": typeof lib_thumb;
  "lib/trust": typeof lib_trust;
  "lib/users": typeof lib_users;
  "lib/vouchNote": typeof lib_vouchNote;
  "lib/vouches": typeof lib_vouches;
  listings: typeof listings;
  live: typeof live;
  liveReplay: typeof liveReplay;
  media: typeof media;
  memories: typeof memories;
  messenger: typeof messenger;
  notifications: typeof notifications;
  pages: typeof pages;
  posts: typeof posts;
  profiles: typeof profiles;
  proposals: typeof proposals;
  reactions: typeof reactions;
  reports: typeof reports;
  roommates: typeof roommates;
  saved: typeof saved;
  search: typeof search;
  seed: typeof seed;
  "seed/cityProfiles": typeof seed_cityProfiles;
  "seed/images": typeof seed_images;
  "seed/lib/backgrounds": typeof seed_lib_backgrounds;
  "seed/lib/images": typeof seed_lib_images;
  "seed/lib/places": typeof seed_lib_places;
  "seed/lib/prng": typeof seed_lib_prng;
  "seed/lib/time": typeof seed_lib_time;
  "seed/lib/videos": typeof seed_lib_videos;
  "seed/plan": typeof seed_plan;
  "seed/types": typeof seed_types;
  "seed/world/cityProfiles": typeof seed_world_cityProfiles;
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
  "seed/world/posts/threads": typeof seed_world_posts_threads;
  "seed/world/rentals": typeof seed_world_rentals;
  "seed/world/roommateLifestyles": typeof seed_world_roommateLifestyles;
  "seed/world/stories": typeof seed_world_stories;
  "seed/world/videos": typeof seed_world_videos;
  "seed/world/vouches": typeof seed_world_vouches;
  settings: typeof settings;
  stories: typeof stories;
  trust: typeof trust;
  users: typeof users;
  validators: typeof validators;
  vouches: typeof vouches;
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
