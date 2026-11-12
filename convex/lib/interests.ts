import { literals } from "convex-helpers/validators";

/**
 * Landing's one interest list. City Profile facts, Group and Event matching,
 * crews and scores all use these ids, so "does this Event fit you?" is a table
 * lookup, not a model call. Client-safe: no server imports.
 *
 * Protected-trait review (keep it this way when adding entries):
 * - Interests are things people *do*, never who they *are*. There are no
 *   religious, political, cultural, ethnic, national-origin, language,
 *   age-band, gender, sexual-orientation, health or parenting interests, and
 *   cuisines aren't interests either (they can stand in for national origin).
 * - Unknown tags and categories map to nothing (deny by default), so a Group
 *   like "Women Who Climb" maps to `climbing` and nothing about its members.
 * - `EXCLUDED_CATEGORIES` lists categories that must never become interests.
 *
 * Ids are stored in the database: add new ones freely, but rename or remove
 * one only with a migration.
 */

export type InterestSection =
  | "active"
  | "outdoors"
  | "food"
  | "culture"
  | "nights"
  | "play"
  | "community";

export const INTEREST_SECTIONS: { id: InterestSection; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "outdoors", label: "Outdoors" },
  { id: "food", label: "Food & drink" },
  { id: "culture", label: "Arts & culture" },
  { id: "nights", label: "Music & nights out" },
  { id: "play", label: "Games & tech" },
  { id: "community", label: "Around town" },
];

type InterestDef = {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly section: InterestSection;
  /** Words and phrases (matched as whole words) in Group tags and Event titles. */
  readonly aliases: readonly string[];
};

export const INTERESTS = [
  // Active
  {
    id: "climbing",
    label: "Climbing",
    emoji: "🧗",
    section: "active",
    aliases: ["climbing", "climb", "climbers", "bouldering", "boulder", "top rope", "belay"],
  },
  {
    id: "running",
    label: "Running",
    emoji: "🏃",
    section: "active",
    aliases: ["running", "run club", "runners", "half marathon", "marathon", "jog"],
  },
  {
    id: "cycling",
    label: "Cycling",
    emoji: "🚴",
    section: "active",
    aliases: ["cycling", "bike ride", "biking", "cyclists", "bike club"],
  },
  {
    id: "yoga",
    label: "Yoga & pilates",
    emoji: "🧘",
    section: "active",
    aliases: ["yoga", "pilates", "meditation"],
  },
  {
    id: "gym",
    label: "Gym & lifting",
    emoji: "🏋️",
    section: "active",
    aliases: [
      "gym",
      "lifting",
      "weightlifting",
      "crossfit",
      "strength training",
      "workout",
      "workouts",
    ],
  },
  {
    id: "surfing",
    label: "Surfing",
    emoji: "🏄",
    section: "active",
    aliases: ["surfing", "surf", "surfers", "bodyboarding"],
  },
  {
    id: "swimming",
    label: "Swimming",
    emoji: "🏊",
    section: "active",
    aliases: ["swimming", "swim", "open water"],
  },
  {
    id: "pickup_sports",
    label: "Pickup sports",
    emoji: "🏀",
    section: "active",
    aliases: [
      "pickup basketball",
      "pickup soccer",
      "pickup games",
      "basketball",
      "soccer",
      "volleyball",
      "ultimate frisbee",
      "kickball",
      "softball",
      "pickleball",
      "tennis",
    ],
  },
  {
    id: "dancing",
    label: "Dancing",
    emoji: "💃",
    section: "active",
    aliases: ["dance", "dancing", "salsa", "swing dance"],
  },
  // Outdoors
  {
    id: "hiking",
    label: "Hiking",
    emoji: "🥾",
    section: "outdoors",
    aliases: ["hiking", "hike", "hikes", "hikers", "trail", "trails", "backpacking"],
  },
  {
    id: "camping",
    label: "Camping",
    emoji: "⛺",
    section: "outdoors",
    aliases: ["camping", "campout", "camp trip"],
  },
  {
    id: "beach_days",
    label: "Beach days",
    emoji: "🏖️",
    section: "outdoors",
    aliases: ["beach", "beaches", "beach day"],
  },
  {
    id: "parks",
    label: "Parks & picnics",
    emoji: "🧺",
    section: "outdoors",
    aliases: ["picnic", "picnics", "parks", "park day"],
  },
  {
    id: "gardening",
    label: "Plants & gardening",
    emoji: "🌱",
    section: "outdoors",
    aliases: ["gardening", "plants", "houseplants", "plant swap", "cuttings", "community garden"],
  },
  {
    id: "pets",
    label: "Dogs & pets",
    emoji: "🐕",
    section: "outdoors",
    aliases: ["dogs", "dog", "puppy", "puppies", "dog park", "cats", "pets"],
  },
  // Food & drink
  {
    id: "coffee",
    label: "Coffee",
    emoji: "☕",
    section: "food",
    aliases: ["coffee", "cafes", "cafe", "espresso", "latte", "roastery"],
  },
  {
    id: "restaurants",
    label: "Trying restaurants",
    emoji: "🍜",
    section: "food",
    aliases: [
      "restaurants",
      "restaurant",
      "food",
      "foodies",
      "eats",
      "brunch",
      "food trucks",
      "supper club",
    ],
  },
  {
    id: "cooking",
    label: "Cooking & baking",
    emoji: "🍳",
    section: "food",
    aliases: ["cooking", "baking", "recipes", "potluck", "bake"],
  },
  {
    id: "bars",
    label: "Bars & breweries",
    emoji: "🍻",
    section: "food",
    aliases: [
      "bars",
      "bar",
      "beer",
      "breweries",
      "brewery",
      "wine",
      "cocktails",
      "happy hour",
      "drinks",
    ],
  },
  {
    id: "farmers_markets",
    label: "Farmers markets",
    emoji: "🥕",
    section: "food",
    aliases: ["farmers market", "farmers markets", "farmer s market"],
  },
  // Arts & culture
  {
    id: "museums",
    label: "Museums & galleries",
    emoji: "🖼️",
    section: "culture",
    aliases: [
      "museum",
      "museums",
      "gallery",
      "galleries",
      "art show",
      "art walk",
      "exhibit",
      "exhibition",
    ],
  },
  {
    id: "making_art",
    label: "Making art",
    emoji: "🎨",
    section: "culture",
    aliases: [
      "painting",
      "drawing",
      "sketching",
      "sketch",
      "art class",
      "pottery",
      "ceramics",
      "figure drawing",
    ],
  },
  {
    id: "crafts",
    label: "Crafts & DIY",
    emoji: "🧶",
    section: "culture",
    aliases: ["crafts", "craft", "knitting", "crochet", "sewing", "diy"],
  },
  {
    id: "photography",
    label: "Photography",
    emoji: "📷",
    section: "culture",
    aliases: ["photography", "photo walk", "photographers", "film photography", "photos"],
  },
  {
    id: "film",
    label: "Movies & TV",
    emoji: "🎬",
    section: "culture",
    aliases: ["movies", "movie", "film", "films", "cinema", "screening"],
  },
  {
    id: "theater",
    label: "Theater & improv",
    emoji: "🎭",
    section: "culture",
    aliases: ["theater", "theatre", "improv", "musicals", "plays"],
  },
  {
    id: "books",
    label: "Books & writing",
    emoji: "📚",
    section: "culture",
    aliases: ["books", "book club", "reading", "bookstore", "writing", "writers"],
  },
  {
    id: "comedy",
    label: "Comedy",
    emoji: "😂",
    section: "culture",
    aliases: ["comedy", "stand up", "standup", "comedians"],
  },
  // Music & nights out
  {
    id: "live_music",
    label: "Live music",
    emoji: "🎸",
    section: "nights",
    aliases: ["live music", "concerts", "concert", "music", "shows", "gigs", "bands", "open mic"],
  },
  {
    id: "nightlife",
    label: "Clubs & nightlife",
    emoji: "🪩",
    section: "nights",
    aliases: ["nightlife", "clubs", "club night", "dj", "rave", "dance party"],
  },
  { id: "karaoke", label: "Karaoke", emoji: "🎤", section: "nights", aliases: ["karaoke"] },
  {
    id: "trivia",
    label: "Trivia nights",
    emoji: "🧠",
    section: "nights",
    aliases: ["trivia", "quiz", "pub quiz"],
  },
  // Games & tech
  {
    id: "board_games",
    label: "Board games",
    emoji: "🎲",
    section: "play",
    aliases: [
      "board games",
      "board game",
      "tabletop",
      "game night",
      "dnd",
      "dungeons and dragons",
      "chess",
    ],
  },
  {
    id: "video_games",
    label: "Video games",
    emoji: "🎮",
    section: "play",
    aliases: ["gaming", "video games", "esports", "lan", "gamers"],
  },
  {
    id: "tech_meetups",
    label: "Tech & startups",
    emoji: "💻",
    section: "play",
    aliases: ["tech", "startups", "startup", "coding", "developers", "engineers", "tech meetup"],
  },
  {
    id: "hackathons",
    label: "Hackathons",
    emoji: "🛠️",
    section: "play",
    aliases: ["hackathon", "hackathons", "hack night", "build night"],
  },
  {
    id: "networking",
    label: "Career & networking",
    emoji: "🤝",
    section: "play",
    aliases: ["careers", "career", "networking", "internships", "new grads", "mentorship"],
  },
  // Around town
  {
    id: "volunteering",
    label: "Volunteering",
    emoji: "🙌",
    section: "community",
    aliases: ["volunteering", "volunteer", "volunteers", "cleanup", "food bank"],
  },
  {
    id: "watching_sports",
    label: "Watching sports",
    emoji: "🏟️",
    section: "community",
    aliases: [
      "baseball",
      "giants",
      "warriors",
      "49ers",
      "niners",
      "valkyries",
      "watch party",
      "game day",
      "sports bar",
    ],
  },
  {
    id: "thrifting",
    label: "Thrifting & vintage",
    emoji: "🛍️",
    section: "community",
    aliases: ["thrifting", "thrift", "vintage", "flea market", "buy nothing"],
  },
  {
    id: "day_trips",
    label: "Day trips",
    emoji: "🚗",
    section: "community",
    aliases: ["day trip", "day trips", "road trip", "road trips"],
  },
] as const satisfies readonly InterestDef[];

export type Interest = (typeof INTERESTS)[number];
export type InterestId = Interest["id"];
export const INTEREST_IDS: InterestId[] = INTERESTS.map((i) => i.id);
/** Validator for anything that stores an interest id. */
export const interestId = literals(...INTEREST_IDS);

const BY_ID = new Map<string, Interest>(INTERESTS.map((i) => [i.id, i]));
export function getInterest(id: InterestId): Interest {
  return BY_ID.get(id)!;
}
export function isInterestId(id: string): id is InterestId {
  return BY_ID.has(id);
}

/* ---------------- Lookups ---------------- */

/** Lowercase, "&" → "and", punctuation → spaces, single-spaced. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Group and Event categories, as the seed writes them and as Facebook names
 * them (`EVENT_CATEGORIES` in `convex/events.ts`). A category is broad, so it
 * maps to every interest it could serve; tags and titles narrow it down.
 */
const CATEGORY_INTERESTS: Record<string, readonly InterestId[]> = {
  // Seed labels (Groups and Events)
  "Food & Drink": ["restaurants", "coffee", "cooking", "bars"],
  Fitness: ["running", "gym", "yoga", "climbing", "cycling"],
  Tech: ["tech_meetups", "hackathons"],
  Music: ["live_music"],
  Games: ["board_games", "trivia"],
  Gaming: ["video_games"],
  Outdoors: ["hiking", "camping", "beach_days", "parks"],
  Arts: ["museums", "making_art"],
  Sports: ["pickup_sports", "watching_sports"],
  Party: ["nightlife"],
  Photography: ["photography"],
  Pets: ["pets"],
  Community: ["volunteering"],
  Travel: ["day_trips"],
  Education: ["networking"],
  Work: ["networking"],
  // Facebook's event categories
  Comedy: ["comedy"],
  Crafts: ["crafts"],
  Dance: ["dancing"],
  Drinks: ["bars"],
  "Fitness & Workouts": ["running", "gym", "yoga", "climbing", "cycling"],
  Foods: ["restaurants", "cooking"],
  Gardening: ["gardening"],
  "Healthy Living & Self-Care": ["yoga"],
  "Home & Garden": ["gardening", "crafts"],
  "Music & Audio": ["live_music"],
  Parties: ["nightlife"],
  "Professional Networking": ["networking", "tech_meetups"],
  Shopping: ["thrifting"],
  Theater: ["theater"],
  "TV & Movies": ["film"],
  "Visual Arts": ["museums", "making_art"],
};

/**
 * Categories that never become interests: they describe beliefs, health or
 * family status rather than an activity. Kept explicit so nobody "fixes" them
 * into the table above.
 */
export const EXCLUDED_CATEGORIES = [
  "Religions",
  "Social Issues",
  "Health & Medical",
  "Family",
  "Parenting",
] as const;

const CATEGORY_LOOKUP = new Map<string, readonly InterestId[]>(
  Object.entries(CATEGORY_INTERESTS).map(([k, ids]) => [normalize(k), ids]),
);
for (const c of EXCLUDED_CATEGORIES) CATEGORY_LOOKUP.set(normalize(c), []);

const ALIASES: { phrase: string; id: InterestId }[] = INTERESTS.flatMap((i) =>
  i.aliases.map((a) => ({ phrase: normalize(a), id: i.id as InterestId })),
);
const ALIAS_LOOKUP = new Map<string, InterestId[]>();
for (const { phrase, id } of ALIASES) {
  ALIAS_LOOKUP.set(phrase, [...(ALIAS_LOOKUP.get(phrase) ?? []), id]);
}

function unique(ids: Iterable<InterestId>): InterestId[] {
  return [...new Set(ids)];
}

/** Interests a category could serve. Unknown and excluded categories give `[]`. */
export function interestsForCategory(category: string | undefined): InterestId[] {
  return category ? [...(CATEGORY_LOOKUP.get(normalize(category)) ?? [])] : [];
}

/** Interests an exact tag (or label) names, e.g. "Bouldering" → climbing. */
export function interestsForTag(tag: string): InterestId[] {
  return [...(ALIAS_LOOKUP.get(normalize(tag)) ?? [])];
}

/**
 * Interests mentioned in free text (Event titles, Group names), matched as
 * whole words or phrases: "Saturday Run Club" → running.
 */
export function interestsInText(text: string | undefined): InterestId[] {
  if (!text) return [];
  const padded = ` ${normalize(text)} `;
  return unique(ALIASES.filter((a) => padded.includes(` ${a.phrase} `)).map((a) => a.id));
}

/** A Group's interests: its tags and name when they're specific, else its category. */
export function interestsForGroup(group: {
  category: string;
  tags?: readonly string[];
  name?: string;
}): InterestId[] {
  if (EXCLUDED_CATEGORIES.some((c) => normalize(c) === normalize(group.category))) return [];
  const specific = unique([
    ...(group.tags ?? []).flatMap(interestsForTag),
    ...interestsInText(group.name),
  ]);
  return specific.length > 0 ? specific : interestsForCategory(group.category);
}

/** An Event's interests: its title when it's specific, else its category. */
export function interestsForEvent(event: { category: string; title?: string }): InterestId[] {
  if (EXCLUDED_CATEGORIES.some((c) => normalize(c) === normalize(event.category))) return [];
  const specific = interestsInText(event.title);
  return specific.length > 0 ? specific : interestsForCategory(event.category);
}
