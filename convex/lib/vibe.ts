import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { citations } from "../validators";

/**
 * Room style vibes (#25): fixed vocabularies, the shared checks, and the
 * rules-based suggestion used when AI is off. Client-safe (no server imports).
 *
 * Styles and colors are fixed ids so Marketplace matching (#26) can work on
 * them and Muse can't invent new ones; keywords carry the specifics
 * ("walnut", "record shelf"). A vibe describes a room, never a person: there
 * are no cultural, religious or identity styles.
 */

/* ---------------- Rooms ---------------- */

export const ROOM_KINDS = [
  { id: "bedroom", label: "Bedroom" },
  { id: "living_room", label: "Living room" },
  { id: "studio", label: "Studio" },
  { id: "office", label: "Office" },
  { id: "other", label: "Other" },
] as const;
export type RoomKind = (typeof ROOM_KINDS)[number]["id"];
export const roomKind = literals(...ROOM_KINDS.map((k) => k.id));

export const MAX_ROOMS = 6;
export const MAX_PHOTOS = 12;
/** Floor size bounds in feet, when the person measured it. */
export const SIZE_FT = { min: 3, max: 60 } as const;

/* ---------------- Styles and colors ---------------- */

type StyleDef = {
  readonly id: string;
  readonly label: string;
  /** Lowercase words and phrases that point to this style in listings, posts and Page names. */
  readonly words: readonly string[];
  /** Furniture and decor search words this style suggests (Marketplace matching, #26). */
  readonly decor: readonly string[];
  /** The colors a rules-based suggestion starts from. */
  readonly palette: readonly string[];
};

// biome-ignore format: one style per line reads best
export const STYLES = [
  { id: "minimalist", label: "Minimalist", words: ["minimal", "minimalist", "clean lines", "clutter free"], decor: ["low profile", "hidden storage", "neutral linen"], palette: ["warm_white", "oat", "charcoal"] },
  { id: "scandinavian", label: "Scandinavian", words: ["scandi", "scandinavian", "nordic", "birch", "ikea", "hygge"], decor: ["birch", "white oak", "wool throw"], palette: ["warm_white", "natural_wood", "sky"] },
  { id: "mid_century", label: "Mid-century", words: ["mid-century", "midcentury", "mid century", "teak", "walnut", "eames", "credenza"], decor: ["walnut", "teak", "tapered legs", "credenza"], palette: ["walnut", "mustard", "forest"] },
  { id: "japandi", label: "Japandi", words: ["japandi", "tatami", "shoji", "futon", "low bed"], decor: ["low bed", "paper lamp", "light oak"], palette: ["oat", "natural_wood", "charcoal"] },
  { id: "boho", label: "Boho", words: ["boho", "bohemian", "rattan", "macrame", "jute", "wicker", "cane"], decor: ["rattan", "jute rug", "cane", "macrame"], palette: ["terracotta", "oat", "sage"] },
  { id: "industrial", label: "Industrial", words: ["industrial", "loft", "exposed brick", "steel", "concrete", "edison bulb"], decor: ["metal frame", "reclaimed wood", "edison bulb"], palette: ["charcoal", "black", "walnut"] },
  { id: "coastal", label: "Coastal", words: ["coastal", "beach", "surf", "surfboard", "driftwood", "seaside"], decor: ["linen", "driftwood", "rattan"], palette: ["warm_white", "sky", "navy"] },
  { id: "cozy", label: "Cozy", words: ["cozy", "cosy", "throw blanket", "candles", "reading nook", "warm light", "bookshelf", "bookcase"], decor: ["throw blanket", "floor lamp", "bookshelf", "armchair"], palette: ["oat", "terracotta", "walnut"] },
  { id: "vintage", label: "Vintage", words: ["vintage", "antique", "retro", "thrifted", "thrift", "70s", "record player", "turntable", "vinyl", "records"], decor: ["record shelf", "vintage lamp", "brass"], palette: ["mustard", "walnut", "forest"] },
  { id: "eclectic", label: "Eclectic", words: ["eclectic", "gallery wall", "colorful", "posters", "art prints", "maximalist"], decor: ["gallery wall", "art prints", "patterned rug"], palette: ["terracotta", "sky", "mustard"] },
  { id: "botanical", label: "Botanical", words: ["plant", "plants", "houseplant", "houseplants", "monstera", "pothos", "fern", "succulent"], decor: ["plant stand", "planters", "hanging planter"], palette: ["sage", "forest", "warm_white"] },
  { id: "outdoorsy", label: "Outdoorsy", words: ["outdoors", "outdoor", "climbing", "bouldering", "hiking", "camping", "trail", "crash pad", "topo map"], decor: ["natural wood", "gear wall", "wool blanket"], palette: ["forest", "natural_wood", "terracotta"] },
  { id: "modern", label: "Modern", words: ["modern", "sleek", "chrome", "glass top"], decor: ["glass top", "chrome", "matte black"], palette: ["black", "warm_white", "charcoal"] },
] as const satisfies readonly StyleDef[];
export type StyleId = (typeof STYLES)[number]["id"];
export const styleId = literals(...STYLES.map((s) => s.id));

export const COLORS = [
  { id: "warm_white", label: "Warm white", hex: "#F3EEE6" },
  { id: "oat", label: "Oat", hex: "#DCCFB8" },
  { id: "natural_wood", label: "Natural wood", hex: "#B98A5A" },
  { id: "walnut", label: "Walnut", hex: "#6B4A32" },
  { id: "terracotta", label: "Terracotta", hex: "#C2643F" },
  { id: "mustard", label: "Mustard", hex: "#D4A137" },
  { id: "sage", label: "Sage", hex: "#A3B18A" },
  { id: "forest", label: "Forest green", hex: "#2F4F3A" },
  { id: "sky", label: "Sky blue", hex: "#9CC3D5" },
  { id: "navy", label: "Navy", hex: "#22324F" },
  { id: "blush", label: "Blush", hex: "#E3B5A4" },
  { id: "charcoal", label: "Charcoal", hex: "#3A3A3C" },
  { id: "black", label: "Black", hex: "#121212" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];
export const colorId = literals(...COLORS.map((c) => c.id));

const STYLE_BY_ID = new Map<string, (typeof STYLES)[number]>(STYLES.map((s) => [s.id, s]));
const COLOR_BY_ID = new Map<string, (typeof COLORS)[number]>(COLORS.map((c) => [c.id, c]));
export const styleLabel = (id: StyleId) => STYLE_BY_ID.get(id)?.label ?? id;
export const colorOf = (id: ColorId) => COLOR_BY_ID.get(id)!;

/* ---------------- The vibe ---------------- */

export const VIBE_LIMITS = {
  summaryMax: 280,
  styles: { min: 1, max: 3 },
  palette: { min: 2, max: 5 },
  keywordsMax: 8,
  keywordMax: 30,
  basisMax: 6,
  basisItemMax: 120,
} as const;

const vibeFields = {
  /** One or two sentences in plain words. */
  summary: v.string(),
  styles: v.array(styleId),
  palette: v.array(colorId),
  /** Short search words for Marketplace matching (#26): "walnut", "record shelf". */
  keywords: v.array(v.string()),
};
/** What the person (or Muse) says the vibe is. */
export const vibeValue = v.object(vibeFields);
export type VibeValue = Infer<typeof vibeValue>;

export const vibeOrigin = literals("typed", "generated", "edited");
export type VibeOrigin = Infer<typeof vibeOrigin>;

/** A room's stored vibe: the value plus where it came from. */
export const roomVibe = v.object({
  ...vibeFields,
  /** typed: the person wrote it. generated: Muse suggested it. edited: Muse suggested it, then the person changed it. */
  origin: vibeOrigin,
  /** The saved and liked posts and listings a suggestion drew on (#7). */
  citations: v.optional(citations),
  /** Plain words shown with a suggestion: "Saved: Mid-century cane armchair", "Follows Moonrise Coffee Co." */
  basis: v.optional(v.array(v.string())),
  updatedAt: v.number(),
});

/** Every rule a vibe must meet: the form, `setVibe` and Muse's task all use this. */
export function vibeProblems(vibe: VibeValue): string[] {
  const L = VIBE_LIMITS;
  const out: string[] = [];
  const summary = vibe.summary.trim();
  if (!summary) out.push("Describe the vibe in a sentence or two");
  else if (summary.length > L.summaryMax)
    out.push(`Keep the summary under ${L.summaryMax} characters`);
  if (vibe.styles.length < L.styles.min || vibe.styles.length > L.styles.max)
    out.push(`Pick ${L.styles.min} to ${L.styles.max} styles`);
  if (new Set(vibe.styles).size !== vibe.styles.length) out.push("A style is listed twice");
  if (vibe.palette.length < L.palette.min || vibe.palette.length > L.palette.max)
    out.push(`Pick ${L.palette.min} to ${L.palette.max} colors`);
  if (new Set(vibe.palette).size !== vibe.palette.length) out.push("A color is listed twice");
  if (vibe.keywords.length > L.keywordsMax) out.push(`Use at most ${L.keywordsMax} keywords`);
  const words = vibe.keywords.map((k) => k.trim().toLowerCase());
  if (words.some((k) => !k || k.length > L.keywordMax))
    out.push(`Keep each keyword between 1 and ${L.keywordMax} characters`);
  if (new Set(words).size !== words.length) out.push("A keyword is listed twice");
  return out;
}

/** Trims text and keywords the way they're stored. */
export function cleanVibe(vibe: VibeValue): VibeValue {
  return {
    summary: vibe.summary.trim().replace(/\s+/g, " "),
    styles: vibe.styles,
    palette: vibe.palette,
    keywords: vibe.keywords.map((k) => k.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean),
  };
}

/* ---------------- Rules-based suggestion (AI off) ---------------- */

/** City Profile interest ids (#3) that hint at a style. Activities only, never identities. */
const INTEREST_STYLES: Record<string, readonly StyleId[]> = {
  gardening: ["botanical"],
  surfing: ["coastal"],
  beach_days: ["coastal"],
  climbing: ["outdoorsy"],
  hiking: ["outdoorsy"],
  camping: ["outdoorsy"],
  thrifting: ["vintage"],
  making_art: ["eclectic"],
  museums: ["eclectic"],
  crafts: ["boho"],
  books: ["cozy"],
  coffee: ["cozy"],
  board_games: ["cozy"],
  yoga: ["japandi"],
  live_music: ["vintage"],
};

/** Facebook Page categories that hint at a style. */
const CATEGORY_STYLES: [RegExp, StyleId][] = [
  [/coffee|caf[eé]|tea/i, "cozy"],
  [/book/i, "cozy"],
  [/record|vinyl|antique|thrift|vintage/i, "vintage"],
  [/climbing|outdoor|sporting|camping/i, "outdoorsy"],
  [/plant|florist|garden|nursery/i, "botanical"],
  [/surf|beach/i, "coastal"],
  [/gallery|museum|art/i, "eclectic"],
  [/furniture|home goods|interior|decor/i, "modern"],
];

export type VibeSignals = {
  room: { name: string; kind: RoomKind };
  /** City Profile interests (id and label). */
  interests: { id: string; label: string }[];
  /** Facebook Pages the person follows. */
  follows: { name: string; category: string }[];
};

/** A source the rules can read: its citation key and its text. */
export type SignalSource = { key: string; text: string };

export type RulesVibe = {
  vibe: VibeValue;
  /** Source keys that matched, strongest first. */
  because: { source: string; why: string }[];
  /** Interest labels and Page names that matched. */
  fromProfile: string[];
};

function hasWord(text: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

const ROOM_WORD: Record<RoomKind, string> = {
  bedroom: "bedroom",
  living_room: "living room",
  studio: "studio",
  office: "office",
  other: "room",
};

/** Words that name a material or piece, so they're good search keywords on their own. */
const DECOR_WORDS = new Set(STYLES.flatMap((s) => s.decor as readonly string[]));
for (const w of [
  "teak",
  "walnut",
  "rattan",
  "cane",
  "jute",
  "wicker",
  "birch",
  "credenza",
  "bookshelf",
  "bookcase",
  "turntable",
  "record player",
  "monstera",
  "pothos",
  "succulent",
  "driftwood",
  "concrete",
  "steel",
  "futon",
  "low bed",
])
  DECOR_WORDS.add(w);

/** Up to `max` characters, cut at a word boundary. */
function clipWords(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).trimEnd()}…`;
}

/** How much a matched source counts: saved listings are the clearest taste signal, a liked post the faintest. */
const SOURCE_WEIGHT = (key: string) => (key.startsWith("listing:") ? 3 : 1);

/**
 * A deterministic vibe from the same signals Muse reads. Scores each style by
 * matched words in sources (saved listings weigh most) and hints from
 * interests and followed Pages, keeps the top two, and takes keywords from
 * matched materials and pieces first, then the styles' own decor words. Falls
 * back to a calm, neutral vibe when nothing matches.
 */
export function vibeFromSignals(signals: VibeSignals, sources: SignalSource[]): RulesVibe {
  const score = new Map<StyleId, number>();
  const bump = (id: StyleId, n: number) => score.set(id, (score.get(id) ?? 0) + n);
  const matches: { source: SignalSource; styles: Set<StyleId>; words: string[] }[] = [];

  for (const s of sources) {
    const styles = new Set<StyleId>();
    const words: string[] = [];
    for (const style of STYLES)
      for (const word of style.words)
        if (hasWord(s.text, word)) {
          styles.add(style.id);
          words.push(word);
        }
    if (styles.size === 0) continue;
    for (const id of styles) bump(id, SOURCE_WEIGHT(s.key));
    matches.push({ source: s, styles, words });
  }

  // Interests and followed Pages that hint at a style; named only if that style is chosen.
  const profileHits: { name: string; styles: Set<StyleId> }[] = [];
  for (const i of signals.interests) {
    const hits = new Set<StyleId>(INTEREST_STYLES[i.id] ?? []);
    if (hits.size > 0) profileHits.push({ name: i.label, styles: hits });
  }
  for (const f of signals.follows) {
    const text = `${f.name} ${f.category}`;
    const hits = new Set<StyleId>();
    for (const [re, id] of CATEGORY_STYLES) if (re.test(text)) hits.add(id);
    for (const style of STYLES)
      for (const word of style.words) if (hasWord(text, word)) hits.add(style.id);
    if (hits.size > 0) profileHits.push({ name: f.name, styles: hits });
  }
  // A followed Page or stated interest says more about lasting taste than one liked post.
  for (const h of profileHits) for (const id of h.styles) bump(id, 1.5);

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const styles: StyleId[] = ranked.length > 0 ? ranked.slice(0, 2) : ["minimalist", "cozy"];
  const chosen = new Set(styles);

  // Only sources that support a chosen style are reasons; saved listings first.
  const because = matches
    .filter((m) => [...m.styles].some((id) => chosen.has(id)))
    .sort((a, b) => SOURCE_WEIGHT(b.source.key) - SOURCE_WEIGHT(a.source.key))
    .slice(0, VIBE_LIMITS.basisMax)
    .map((m) => {
      const first = m.source.text.split("\n")[0] ?? "";
      const quote = clipWords(first, 48);
      return {
        source: m.source.key,
        why: m.source.key.startsWith("listing:") ? `Saved “${quote}”` : `Liked a post: “${quote}”`,
      };
    });

  const norm = (w: string) => w.replace(/[\s-]+/g, " ");
  const keywords: string[] = [];
  const addKeyword = (w: string) => {
    if (keywords.length < 6 && !keywords.some((k) => norm(k) === norm(w))) keywords.push(w);
  };
  for (const m of matches)
    if ([...m.styles].some((id) => chosen.has(id)))
      for (const w of m.words) if (DECOR_WORDS.has(w)) addKeyword(w);
  for (const id of styles) for (const w of STYLE_BY_ID.get(id)!.decor) addKeyword(w);

  const palette = [...new Set(styles.flatMap((id) => STYLE_BY_ID.get(id)!.palette))].slice(
    0,
    4,
  ) as ColorId[];
  const names = styles.map((id) => styleLabel(id).toLowerCase());
  const colors = palette.slice(0, 3).map((id) => colorOf(id).label.toLowerCase());
  const room = ROOM_WORD[signals.room.kind];
  const list = (xs: string[]) =>
    xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0];
  const summary =
    ranked.length > 0
      ? `${/^[aeiou]/i.test(names[0] ?? "") ? "An" : "A"} ${names.join(" and ")} ${room}: ${list(colors)}, with ${list(keywords.filter((k) => !colors.includes(k)).slice(0, 2))}.`
      : `A calm, simple ${room} to start from: ${list(colors)}.`;
  const fromProfile = [
    ...new Set(
      profileHits.filter((h) => [...h.styles].some((id) => chosen.has(id))).map((h) => h.name),
    ),
  ].slice(0, Math.max(0, VIBE_LIMITS.basisMax - because.length));
  return { vibe: { summary, styles, palette, keywords }, because, fromProfile };
}
