/**
 * The Gaming catalog. Titles and art are original (no real game trademarks):
 * key art lives in public/seed/games (painted by scripts/game-art), and each
 * game plays the engine in ./engines that matches its genre.
 */

export type Engine =
  | "klondike"
  | "tripeaks"
  | "blackjack"
  | "match3"
  | "merge"
  | "arrows"
  | "maze"
  | "jigsaw"
  | "word"
  | "snake"
  | "breakout"
  | "hockey"
  | "defense"
  | "checkers"
  | "arena"
  | "bubbles"
  | "tower";

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
    engine: "klondike",
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
    engine: "match3",
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
    engine: "tower",
  }),
  g({
    id: "harbor-tycoon",
    name: "Harbor Tycoon",
    tagline: "Merge boats into a bustling port on the Sound",
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
    category: "Arcade",
    players: 120_000,
    emoji: "🧱",
    from: "#2a1f7a",
    to: "#f2486e",
    band: "#3b2a9e",
    engine: "breakout",
  }),
  g({
    id: "gem-cascade",
    name: "Gem Cascade Classic",
    tagline: "Line up three sparkling gems",
    category: "Match 3",
    players: 210_000,
    emoji: "💎",
    from: "#0d8a8a",
    to: "#f7c948",
    band: "#0d6e6e",
    engine: "match3",
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
    engine: "klondike",
  }),
  g({
    id: "candy-valley",
    name: "Sugar Valley",
    tagline: "Sweet puzzles in a candy-colored land",
    category: "Match 3",
    players: 180_000,
    emoji: "🍬",
    from: "#f25ca2",
    to: "#ffd1e8",
    band: "#c2367a",
    engine: "match3",
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
    engine: "arrows",
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
    engine: "tripeaks",
  }),
  g({
    id: "solitaire-social",
    name: "Solitaire Social",
    tagline: "Classic Klondike, one card at a time",
    category: "Solitaire",
    players: 59_000,
    emoji: "♠️",
    from: "#156b3a",
    to: "#47b36b",
    band: "#0f5a30",
    engine: "klondike",
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
    engine: "maze",
  }),
  g({
    id: "rail-city",
    name: "Rail City",
    tagline: "Merge track and trains to connect the frontier",
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
    engine: "jigsaw",
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
    engine: "word",
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
    engine: "hockey",
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
    engine: "defense",
  }),
  g({
    id: "checkers-club",
    name: "Checkers Club",
    tagline: "Quick matches, kings and all",
    category: "Board",
    players: 33_000,
    emoji: "🔴",
    from: "#c92a2a",
    to: "#ffa8a8",
    band: "#a51111",
    engine: "checkers",
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
    engine: "arena",
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
    engine: "bubbles",
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
    engine: "blackjack",
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
    engine: "snake",
  }),
];

/**
 * The Play home splits the catalog so no game shows twice on one screen: Top
 * picks, Most played and Recently released are disjoint, and Most played (the
 * only shelf that can share the first screen with Featured) leaves out the
 * Featured games. Recently released sits far below Featured, so it may repeat one.
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
];

export const byId = new Map(GAMES.map((x) => [x.id, x]));

/** "Recently released": the newest titles in the catalog, newest first. */
export const RECENTLY_RELEASED = [
  "snake-trail",
  "royal-21",
  "harbor-tycoon",
  "tower-legends",
  "orchard-friends",
  "solitaire-grove",
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

/** Everything not featured, picked or recently released, ranked by players. */
export const MOST_PLAYED = GAMES.filter(
  (x) => ![...FEATURED, ...TOP_PICKS, ...RECENTLY_RELEASED].includes(x.id),
).sort((a, b) => b.players - a.players);

export function playersLabel(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M players`;
  if (n >= 1000) return `${Math.round(n / 1000)}K players`;
  return `${n} players`;
}
