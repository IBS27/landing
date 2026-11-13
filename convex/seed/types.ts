/**
 * Authoring types for the seed world. World files under `./world` are plain,
 * hand-written data shaped by these types; `./plan.ts` turns them into rows.
 *
 * Conventions:
 * - Times are `TimeSpec`s from `./lib/time` (`hoursAgo(3)`, `daysAgo(2, "14:30")`, `daysFromNow(5, "19:00")`).
 * - Photos are topic slots, not file paths: `"couch"`, `"gray sectional sofa"`, or with an explicit
 *   folder `"rooms/bedroom"`. Folders: avatars, posts, listings, rooms, covers, events, pages.
 *   The seeder picks the best tag match from `public/seed/<folder>` deterministically.
 * - Cross references use natural keys: usernames, page handles, group slugs, and the `key`
 *   fields of listings / events / posts / conversations.
 */
import type { Doc } from "../_generated/dataModel";
import type { LatLng } from "../lib/geo";
import type { NeighborhoodSlug } from "../lib/neighborhoods";
import type { ListingCategory, ReactionType } from "../validators";
import type { BackgroundName } from "./lib/backgrounds";
import type { Neighborhood } from "./lib/places";
import type { TimeSpec } from "./lib/time";
import type { VideoClip } from "./lib/videos";
import type { GroupSlug } from "./world/groups";
import type { PageHandle } from "./world/pages";
import type { Username } from "./world/people";

export type { BackgroundName, GroupSlug, Neighborhood, PageHandle, TimeSpec, Username };

/** A person or a Page. */
export type Handle = Username | PageHandle;

/**
 * A photo slot: `"topic words"` (folder implied by context), `"folder/topic words"`, or one
 * exact file, `"folder/name-01.jpg"`.
 */
export type PhotoSlot = string;

// ---------------------------------------------------------------------------
// People & Pages

export type Birthday = `${number}-${number}` | "today" | { readonly inDays: number };

export type PersonSeed = {
  readonly username: string;
  readonly name: string;
  /** Avatar pool: `avatars/m-NN.jpg` or `avatars/w-NN.jpg`. */
  readonly gender: "m" | "w";
  /** Authoring aid only (not stored). */
  readonly age: number;
  readonly persona?: boolean;
  /** Authoring aid: what this persona is for. */
  readonly role?: string;
  readonly bio?: string;
  readonly pronouns?: string;
  readonly city: string;
  readonly hometown?: string;
  /** `start` / `end` are "YYYY-MM"; a job with a start and no end is current. */
  readonly work?: readonly {
    readonly title: string;
    readonly company: string;
    readonly start?: string;
    readonly end?: string;
  }[];
  readonly education?: readonly {
    readonly school: string;
    readonly detail?: string;
    readonly start?: string;
    readonly end?: string;
  }[];
  readonly relationship?: string;
  readonly birthday: Birthday;
  readonly verified?: boolean;
  readonly alwaysOnline?: boolean;
  /** Year they joined Facebook. */
  readonly joined: number;
  /** Cover photo slot (covers folder). */
  readonly cover?: PhotoSlot;
};

export type PageSeed = {
  readonly username: string;
  readonly name: string;
  readonly category: string;
  readonly bio: string;
  readonly city: string;
  readonly followers: number;
  readonly verified?: boolean;
  /** Profile picture slot (pages folder). */
  readonly avatar: PhotoSlot;
  readonly cover: PhotoSlot;
  readonly joined: number;
  /** Website / social URLs for the Page's Links card. */
  readonly links?: readonly string[];
};

// ---------------------------------------------------------------------------
// Groups

export type GroupSeed = {
  readonly slug: string;
  readonly name: string;
  readonly privacy: "public" | "private";
  readonly description: string;
  readonly category: string;
  readonly location?: string;
  readonly cover: PhotoSlot;
  readonly rules: readonly { readonly title: string; readonly body: string }[];
  readonly tags: readonly string[];
  readonly externalMembers: number;
  readonly createdYearsAgo: number;
  readonly admins: readonly Username[];
  readonly moderators?: readonly Username[];
  readonly members: readonly Username[];
  /** A neighborhood Group: based at the neighborhood's center (sets `point` and `neighborhoodId`). */
  readonly neighborhood?: NeighborhoodSlug;
  /** Where a Group without a neighborhood is based (e.g. the Ferry Building). */
  readonly point?: LatLng;
};

// ---------------------------------------------------------------------------
// Posts, comments, reactions

/** Shapes the reaction-type mix the seeder generates. */
export type Mood = "default" | "love" | "haha" | "sad" | "wow" | "care";

export type ReplySeed = {
  readonly by: Handle;
  readonly text: string;
  /** Optional key so notifications or other seeds can reference this comment. */
  readonly key?: string;
  /** Minutes after the parent comment (default: a plausible small gap). */
  readonly after?: number;
  /** Number of reactions on the comment (default 0–3, generated). */
  readonly likes?: number;
  readonly photo?: PhotoSlot;
  /** Replies to this reply (Facebook's third and deepest level); only on replies. */
  readonly replies?: readonly ReplySeed[];
};

export type CommentSeed = ReplySeed & {
  /** Minutes after the post (default: generated, increasing). */
  readonly after?: number;
  readonly replies?: readonly ReplySeed[];
};

export type LinkSeed = {
  readonly url: string;
  readonly title: string;
  readonly domain: string;
  readonly description?: string;
  /** Preview image slot. */
  readonly image?: PhotoSlot;
};

export type PostSeed = {
  /** Needed only when something references this post (shares, messages, saved, notifications). */
  readonly key?: string;
  readonly by: Handle;
  readonly at: TimeSpec;
  readonly text?: string;
  /** Group post: the group's slug. */
  readonly in?: GroupSlug;
  /** Posted on a friend's timeline (birthday wishes etc.). */
  readonly on?: Username;
  /** 1–5 photo slots (folder defaults to `posts`). */
  readonly photos?: readonly PhotoSlot[];
  /** A video clip (`./lib/videos`) instead of photos; 9:16 clips make the post a Reel. */
  readonly video?: VideoClip;
  /** Text-on-color background; only for short text posts without photos. */
  readonly bg?: BackgroundName;
  /** e.g. "feeling excited", "feeling grateful". */
  readonly feeling?: string;
  /** Check-in, e.g. "Sutro Boulders" or "Lands End Trail". */
  readonly place?: string;
  readonly tagged?: readonly Username[];
  /** Key of the post being shared. */
  readonly share?: string;
  /** Key of a Marketplace listing attached to the post. */
  readonly listing?: string;
  /** Key of an event attached to the post. */
  readonly event?: string;
  readonly link?: LinkSeed;
  readonly privacy?: "public" | "friends" | "only_me";
  /** Page ads shown as "Sponsored". */
  readonly sponsored?: boolean;
  /** Total reactions (generated reactors). Default depends on the post kind. */
  readonly reactions?: number;
  readonly mood?: Mood;
  /** People guaranteed among the reactors (e.g. the main persona). */
  readonly likedBy?: readonly Handle[];
  /** People kept out of the generated reactors (e.g. the main persona on most Reels). */
  readonly notLikedBy?: readonly Handle[];
  readonly comments?: readonly CommentSeed[];
  /** Video posts: views before the seeded history; recorded plays add to it. */
  readonly views?: number;
};

// ---------------------------------------------------------------------------
// Stories

export type StorySeed = {
  readonly by: Handle;
  /** Required unless the story is a `video`. */
  readonly photo?: PhotoSlot;
  /** A 9:16 video clip (`./lib/videos`) instead of a photo. */
  readonly video?: VideoClip;
  readonly text?: string;
  /** Must be within the last 24 hours, unless `archived`. */
  readonly at: TimeSpec;
  /** An expired story that only shows in the author's Story archive. */
  readonly archived?: boolean;
};

// ---------------------------------------------------------------------------
// Marketplace

export type ListingCondition = "new" | "used_like_new" | "used_good" | "used_fair";

export type RentalSeed = {
  readonly propertyType: "apartment" | "house" | "room" | "townhouse" | "studio" | "condo";
  readonly listingType: "rent" | "sublet" | "sale";
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly sqft?: number;
  readonly availableFrom?: TimeSpec;
  readonly availableTo?: TimeSpec;
  readonly furnished?: boolean;
  readonly petsAllowed?: boolean;
  /** e.g. "In-unit laundry", "Laundry in building", "No laundry". */
  readonly laundry?: string;
  /** e.g. "Street parking", "Garage parking", "Off-street parking". */
  readonly parking?: string;
  readonly address?: string;
};

export type ListingSeed = {
  readonly key: string;
  readonly seller: Username;
  readonly title: string;
  /** Whole dollars; 0 = free. Rentals: monthly rent. */
  readonly price: number;
  readonly category: ListingCategory;
  readonly condition?: ListingCondition;
  readonly brand?: string;
  /** Meetup preferences shown under "Listed …" on the item page (Public meetup, Door pickup…). */
  readonly meetup?: readonly ("public" | "door_pickup" | "door_dropoff")[];
  readonly description: string;
  /**
   * Photos (folder `listings`, or `rooms` for rentals). Either one topic whose exact-topic files
   * belong to this listing alone (`"velvet sofa"` → `listings/velvet-sofa-NN.jpg`, up to
   * `photoCount` of them), or one slot per photo (`["living room", "bedroom", "kitchen"]`), each
   * filled with a photo no other listing uses. The seed fails if two listings share a photo.
   */
  readonly photos: PhotoSlot | readonly PhotoSlot[];
  /** Upper bound for a single-topic `photos` (defaults to every exact-topic file). */
  readonly photoCount?: number;
  readonly hood: Neighborhood;
  readonly status?: "active" | "pending" | "sold";
  readonly listed: TimeSpec;
  readonly views?: number;
  /** Groups the listing was also posted to. */
  readonly groups?: readonly GroupSlug[];
  readonly rental?: RentalSeed;
  /** Vehicles: make/model/year/mileage etc. */
  readonly vehicle?: Doc<"listings">["vehicle"];
  /** The price before the seller lowered it (shown struck through). */
  readonly originalPrice?: number;
  /** A short clip the seller added; it leads the item gallery and badges the grid tile. */
  readonly video?: VideoClip;
};

// ---------------------------------------------------------------------------
// Events

export type EventSeed = {
  readonly key: string;
  readonly host: Handle;
  /** Hosted in a group. */
  readonly in?: GroupSlug;
  readonly title: string;
  /** Cover slot (folder `events`). */
  readonly cover: PhotoSlot;
  readonly description: string;
  /** e.g. "Music", "Games", "Fitness", "Food & Drink", "Arts", "Tech", "Outdoors", "Party". */
  readonly category: string;
  readonly start: TimeSpec;
  /** Duration in hours (omit for no end time). */
  readonly hours?: number;
  readonly online?: boolean;
  readonly venue?: string;
  readonly address?: string;
  /** Defaults to "San Francisco, CA". */
  readonly city?: string;
  readonly privacy: "public" | "friends" | "private" | "group";
  /** Going / interested counts from outside the seeded world. */
  readonly externalGoing: number;
  readonly externalInterested: number;
  /** Ticketed events: ticket site, its display name and an optional price label ("$15 – $25"). */
  readonly tickets?: { readonly url: string; readonly provider?: string; readonly price?: string };
  readonly going?: readonly Username[];
  readonly interested?: readonly Username[];
  readonly invited?: readonly Username[];
  /** When the event was created (default: ~2 weeks before start, never in the future). */
  readonly created?: TimeSpec;
};

// ---------------------------------------------------------------------------
// Messenger

export type MessageSeed = {
  readonly by: Username;
  readonly text?: string;
  /** Image attachment slot (folder defaults to `posts`). */
  readonly photo?: PhotoSlot;
  /** Sticker-style emoji message, e.g. "👍" or "😂". */
  readonly sticker?: string;
  /** Share a listing by key. */
  readonly listing?: string;
  /** Share a post by key. */
  readonly post?: string;
  /** Index (0-based, within this conversation) of the message being replied to. */
  readonly replyTo?: number;
  /** Minutes since the previous message (default: 1–4). Use large values for gaps (e.g. 600). */
  readonly gap?: number;
  readonly reactions?: readonly (readonly [Username, ReactionType])[];
};

export type ConversationSeed = {
  readonly key: string;
  readonly kind: "dm" | "group" | "marketplace";
  readonly members: readonly Username[];
  /** Group chats only. */
  readonly title?: string;
  /** Group chat photo slot. */
  readonly photo?: PhotoSlot;
  /** Marketplace threads: the listing key. */
  readonly listing?: string;
  /** Time of the last message; earlier messages are laid out backwards using `gap`s. */
  readonly last: TimeSpec;
  /** Members who haven't read the latest messages. */
  readonly unreadFor?: readonly Username[];
  /** How many trailing messages are unread for `unreadFor` (default 1). */
  readonly unreadCount?: number;
  readonly mutedFor?: readonly Username[];
  readonly messages: readonly MessageSeed[];
};

export type { ReactionType };

// ---------------------------------------------------------------------------
// Neighborhoods (#15)

/**
 * An external page as fetched (DataSF, an agency's station page, a GTFS feed...). Stored in
 * `externalSources` (#7); the snippet is quoted verbatim from the page.
 */
export type SourceSnapshot = {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly snippet: string;
  readonly fetchedAt: number;
};

export type TransitSystem = "bart" | "muni_metro" | "caltrain";

/** A station (generated from GTFS). `sources` are keys of `TRANSIT_SOURCES`. */
export type TransitStationSeed = {
  readonly key: string;
  readonly system: TransitSystem;
  readonly name: string;
  readonly lines: readonly string[];
  readonly point: LatLng;
  readonly sources: readonly string[];
};

/** A Muni Metro line and its stops in the city, in route order (generated from GTFS). */
export type TransitLineSeed = {
  readonly key: string;
  readonly system: TransitSystem;
  readonly line: string;
  readonly name: string;
  readonly stops: readonly { readonly name: string; readonly point: LatLng }[];
  readonly sources: readonly string[];
};

/** A nightlife corridor (hand-curated, cited). `sources` are keys of `LANDMARK_SOURCES`. */
export type CorridorSeed = {
  readonly key: string;
  readonly name: string;
  readonly detail: string;
  /** The corridor in order, from cross streets. */
  readonly path: readonly LatLng[];
  readonly sources: readonly string[];
};

/** A college or university campus (hand-curated, cited). `sources` are keys of `LANDMARK_SOURCES`. */
export type CampusSeed = {
  readonly key: string;
  readonly name: string;
  readonly institution: string;
  readonly detail: string;
  readonly point: LatLng;
  readonly sources: readonly string[];
};

/**
 * A place the neighborhood Group threads recommend. Businesses are fictional at real cross
 * streets; parks, beaches, streets and landmarks are real. Not stored: the registry keeps the
 * threads consistent (tests check every place sits where the threads say) and gives #18 pins.
 */
export type PlaceSeed = {
  readonly key: string;
  readonly name: string;
  /** Short forms locals use in threads ("the Owl"), matched case-insensitively as whole words. Distinctive only: never a street, neighborhood or generic word. */
  readonly aliases?: readonly string[];
  readonly kind: string;
  readonly real: boolean;
  /** The neighborhood whose Group threads talk about it. */
  readonly neighborhood: NeighborhoodSlug;
  /** Cross streets ("Irving St & 9th Ave") or the real place's name, as located. */
  readonly at: string;
  readonly point: LatLng;
  readonly note: string;
};

/** A Muni line stopping in a neighborhood (generated from GTFS). */
export type ServiceRouteSeed = {
  readonly line: string;
  readonly name: string;
  readonly mode: "bus" | "metro" | "streetcar" | "cable_car";
  /** Runs in the middle of the night, 1:30–3:30am (Owl and 24-hour lines). */
  readonly allNight: boolean;
};

/** Last BART or Caltrain departure from a station, in minutes after the service day's midnight. */
export type LastTrainSeed = {
  readonly system: "bart" | "caltrain";
  readonly station: string;
  readonly weekday?: number;
  readonly saturday?: number;
  readonly sunday?: number;
};

/** Transit service in a neighborhood (generated from GTFS). `sources` are `SERVICE_SOURCES` keys. */
export type ServiceSeed = {
  readonly neighborhood: NeighborhoodSlug;
  /** Weekday trips an hour, 7am–7pm, by Muni, BART and Caltrain stopping here. */
  readonly tripsPerHour: number;
  readonly routes: readonly ServiceRouteSeed[];
  readonly lastTrains: readonly LastTrainSeed[];
  readonly sources: readonly string[];
};

/** 311 streetlight repair requests in a neighborhood over a window (DataSF). */
export type StreetlightSeed = {
  readonly neighborhood: NeighborhoodSlug;
  readonly count: number;
  readonly since: number;
  readonly until: number;
  readonly sources: readonly string[];
};
