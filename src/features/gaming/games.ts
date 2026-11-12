/**
 * The Gaming catalog. Titles and art are original (no real game trademarks):
 * key art lives in public/seed/games (painted by scripts/game-art), and each
 * game plays one of the small built-in engines.
 */

export type Engine = "merge" | "memory" | "tap";

export type Game = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  /** Monthly players, shown as "36K players". */
  players: number;
  emoji: string;
  /** Cover gradient stops and the solid "info band" color of featured cards. */
  from: string;
  to: string;
  band: string;
  engine: Engine;
};

export const CATEGORIES = [
  "All games",
  "Action",
  "Adventure",
  "Arcade",
  "Battle",
  "Board",
  "Builder",
  "Card",
  "Match 3",
  "Puzzle",
  "Simulation",
  "Solitaire",
  "Sports",
  "Strategy",
  "Word",
] as const;

const g = (x: Game) => x;

export const GAMES: Game[] = [
  g({
    id: "solitaire-grove",
    name: "Solitaire: Cedar Grove",
    tagline: "Restore the old cabin one hand at a time",
    category: "Card",
    players: 36_000,
    emoji: "🃏",
    from: "#2f8f4e",
    to: "#9fd36b",
    band: "#bb1708",
    engine: "memory",
  }),
  g({
    id: "orchard-friends",
    name: "Orchard Friends",
    tagline: "Swap and match the juiciest fruit in the valley",
    category: "Match 3",
    players: 310_000,
    emoji: "🍓",
    from: "#7ac943",
    to: "#ffd25e",
    band: "#7a8a12",
    engine: "merge",
  }),
  g({
    id: "tower-legends",
    name: "Tower Legends",
    tagline: "Epic fantasy hero battles, one floor at a time",
    category: "Action",
    players: 48_000,
    emoji: "🗡️",
    from: "#3a4a6b",
    to: "#9cc0e8",
    band: "#1e7b1e",
    engine: "tap",
  }),
  g({
    id: "harbor-tycoon",
    name: "Harbor Tycoon",
    tagline: "Build a bustling port on the Sound",
    category: "Simulation",
    players: 92_000,
    emoji: "⚓",
    from: "#0b6aa8",
    to: "#62d0f5",
    band: "#0a4f7d",
    engine: "merge",
  }),
  g({
    id: "brick-burst",
    name: "Brick Burst",
    tagline: "Bounce, break, repeat",
    category: "Puzzle",
    players: 120_000,
    emoji: "🧱",
    from: "#2a1f7a",
    to: "#f2486e",
    band: "#3b2a9e",
    engine: "tap",
  }),
  g({
    id: "gem-cascade",
    name: "Gem Cascade Classic",
    tagline: "Line up three sparkling gems",
    category: "Puzzle",
    players: 210_000,
    emoji: "💎",
    from: "#0d8a8a",
    to: "#f7c948",
    band: "#0d6e6e",
    engine: "merge",
  }),
  g({
    id: "manor-makeover",
    name: "Manor Makeover: Merge",
    tagline: "Merge your way through a grand old house",
    category: "Puzzle",
    players: 75_000,
    emoji: "🏚️",
    from: "#d4815b",
    to: "#f6d6a8",
    band: "#a3502a",
    engine: "merge",
  }),
  g({
    id: "night-solitaire",
    name: "Midnight Solitaire",
    tagline: "Classic patience under the stars",
    category: "Solitaire",
    players: 54_000,
    emoji: "🌙",
    from: "#1c2340",
    to: "#4b5c9e",
    band: "#1c2340",
    engine: "memory",
  }),
  g({
    id: "candy-valley",
    name: "Sugar Valley",
    tagline: "Sweet puzzles in a candy-colored land",
    category: "Puzzle",
    players: 180_000,
    emoji: "🍬",
    from: "#f25ca2",
    to: "#ffd1e8",
    band: "#c2367a",
    engine: "merge",
  }),
  g({
    id: "maze-slide",
    name: "Arrow Slide Puzzle",
    tagline: "Slide every arrow out of the maze",
    category: "Puzzle",
    players: 41_000,
    emoji: "🧭",
    from: "#2b2b2b",
    to: "#7b61ff",
    band: "#4a3ac2",
    engine: "merge",
  }),
  g({
    id: "island-village",
    name: "Island Village",
    tagline: "Grow a tropical town from a single hut",
    category: "Builder",
    players: 88_000,
    emoji: "🏝️",
    from: "#08a6c9",
    to: "#ffe08a",
    band: "#05768f",
    engine: "merge",
  }),
  g({
    id: "home-story",
    name: "Solitaire Home Story",
    tagline: "Win hands, renovate rooms",
    category: "Solitaire",
    players: 66_000,
    emoji: "🏡",
    from: "#4f9d69",
    to: "#f4e1a1",
    band: "#3a7a50",
    engine: "memory",
  }),
  g({
    id: "solitaire-social",
    name: "Solitaire Social",
    tagline: "Play patience with your friends",
    category: "Solitaire",
    players: 59_000,
    emoji: "♠️",
    from: "#156b3a",
    to: "#47b36b",
    band: "#0f5a30",
    engine: "memory",
  }),
  g({
    id: "jungle-trek",
    name: "Jungle Trek 2",
    tagline: "Clear the path and find the lost temple",
    category: "Adventure",
    players: 37_000,
    emoji: "🌴",
    from: "#2e7d32",
    to: "#c5e1a5",
    band: "#1b5e20",
    engine: "tap",
  }),
  g({
    id: "rail-city",
    name: "Rail City",
    tagline: "Lay track and connect the frontier",
    category: "Simulation",
    players: 44_000,
    emoji: "🚂",
    from: "#b23a1d",
    to: "#f5b971",
    band: "#8a2c16",
    engine: "merge",
  }),
  g({
    id: "jigsaw-calm",
    name: "Calm Jigsaw Puzzles",
    tagline: "Relaxing scenes, piece by piece",
    category: "Puzzle",
    players: 52_000,
    emoji: "🧩",
    from: "#5c7cfa",
    to: "#d0ebff",
    band: "#3b5bdb",
    engine: "memory",
  }),
  g({
    id: "word-garden",
    name: "Word Garden",
    tagline: "Grow words, harvest points",
    category: "Word",
    players: 29_000,
    emoji: "🌻",
    from: "#f59f00",
    to: "#fff3bf",
    band: "#d9480f",
    engine: "memory",
  }),
  g({
    id: "puck-rush",
    name: "Puck Rush",
    tagline: "Fast hands win the faceoff",
    category: "Sports",
    players: 23_000,
    emoji: "🏒",
    from: "#1864ab",
    to: "#a5d8ff",
    band: "#1864ab",
    engine: "tap",
  }),
  g({
    id: "castle-clash",
    name: "Castle Siege",
    tagline: "Defend the keep from waves of raiders",
    category: "Strategy",
    players: 61_000,
    emoji: "🏰",
    from: "#5f3dc4",
    to: "#b197fc",
    band: "#4527a0",
    engine: "tap",
  }),
  g({
    id: "checkers-club",
    name: "Checkers Club",
    tagline: "Quick matches against friends",
    category: "Board",
    players: 33_000,
    emoji: "🔴",
    from: "#c92a2a",
    to: "#ffa8a8",
    band: "#a51111",
    engine: "memory",
  }),
  g({
    id: "arena-blitz",
    name: "Arena Blitz",
    tagline: "Last one standing takes the crown",
    category: "Battle",
    players: 140_000,
    emoji: "⚔️",
    from: "#343a40",
    to: "#fa5252",
    band: "#862e2e",
    engine: "tap",
  }),
  g({
    id: "bubble-pop",
    name: "Bubble Pop Party",
    tagline: "Aim, shoot and pop the bubbles",
    category: "Arcade",
    players: 97_000,
    emoji: "🫧",
    from: "#4dabf7",
    to: "#e599f7",
    band: "#1c7ed6",
    engine: "tap",
  }),
  g({
    id: "royal-21",
    name: "Royal 21",
    tagline: "Beat the dealer without going bust",
    category: "Card",
    players: 71_000,
    emoji: "👑",
    from: "#0b7285",
    to: "#ffd43b",
    band: "#0b5f6e",
    engine: "memory",
  }),
  g({
    id: "snake-trail",
    name: "Snake Trail",
    tagline: "The classic, with a twist",
    category: "Arcade",
    players: 58_000,
    emoji: "🐍",
    from: "#2b8a3e",
    to: "#d8f5a2",
    band: "#2b8a3e",
    engine: "tap",
  }),
];

/**
 * The Play home splits the catalog into disjoint sections (Featured, Top picks,
 * Most played) so no game shows twice on one screen.
 */
export const FEATURED = ["solitaire-grove", "orchard-friends", "tower-legends", "harbor-tycoon"];
export const TOP_PICKS = [
  "manor-makeover",
  "night-solitaire",
  "maze-slide",
  "home-story",
  "jungle-trek",
  "word-garden",
  "rail-city",
  "jigsaw-calm",
  "castle-clash",
  "solitaire-social",
  "puck-rush",
  "checkers-club",
  "royal-21",
  "snake-trail",
];

export const byId = new Map(GAMES.map((x) => [x.id, x]));

/** "Recently released": the newest titles in the catalog, newest first. */
export const RECENTLY_RELEASED = [
  "snake-trail",
  "royal-21",
  "checkers-club",
  "puck-rush",
  "solitaire-social",
  "castle-clash",
  "jigsaw-calm",
  "rail-city",
];

/**
 * Which of the viewer's friends play a game. There is no play history in the
 * clone, so it is derived deterministically from the game and friend ids
 * (each game gets its own popularity, so the counts vary).
 */
export function friendPlays(gameId: string, friendId: string) {
  return fnv(`${gameId}:${friendId}`) % (4 + (fnv(gameId) % 12)) === 0;
}

function fnv(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Everything not featured or picked, ranked by players. */
export const MOST_PLAYED = GAMES.filter(
  (x) => !FEATURED.includes(x.id) && !TOP_PICKS.includes(x.id),
).sort((a, b) => b.players - a.players);

export function playersLabel(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M players`;
  if (n >= 1000) return `${Math.round(n / 1000)}K players`;
  return `${n} players`;
}
