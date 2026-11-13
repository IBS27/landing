import { hasProtected } from "./protectedText";
import { ITEM_LIMITS, itemSize, type PlacementKind } from "./unitScene";
import { COLORS, type ColorId, STYLES, type StyleId } from "./vibe";
import { hasTerm, type MatchVibe } from "./vibeMatch";

/**
 * Furnishing the apartment from Landing Home's chat (#150): pure helpers that
 * turn the person's words into a Marketplace vibe, guess what kind of thing a
 * listing is and how big, and word the reply. Used by the `muse.furnish` task
 * (./furnishTask.ts), its rules fallback and convex/apartment.ts. Client-safe.
 */

export const FURNISH_LIMITS = {
  vibeMax: 200,
  budgetMax: 1_000_000,
  picksMax: 8,
  textMax: 400,
  reasonMax: 160,
  candidatesMax: 40,
} as const;

/* ---------------- The vibe ---------------- */

/** Everyday colour words for palette colours whose label is two words. */
const COLOR_ALIASES: Readonly<Record<string, ColorId>> = {
  white: "warm_white",
  cream: "oat",
  beige: "oat",
  wood: "natural_wood",
  wooden: "natural_wood",
  oak: "natural_wood",
  green: "forest",
  blue: "sky",
  pink: "blush",
  grey: "charcoal",
  gray: "charcoal",
};

/** Words that say nothing about furniture. */
const STOP = new Set(
  `a an and the or of in on to for with my our me i we it is are be im id want wants like love need
  feel feeling vibe vibes style styled look looks looking room rooms apartment place home flat unit
  furnish furnished furniture budget under over about around up max please some very really kind
  sort bit more less lots lot make give get add put pick find show something things stuff that this
  but not too so just can you could would should have has total spend dollars bucks usd
  another one two new also here there`.split(/\s+/),
);

const flat = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/**
 * A Marketplace vibe from what the person typed ("cozy mid-century, walnut and
 * sage"): style and palette ids for the words that name one, and the rest as
 * keywords. Describes a room, never a person: pass it text already through
 * `redactProtected`.
 */
export function vibeFromText(text: string): MatchVibe {
  const said = flat(text.replace(/\[removed\]/g, " "));
  let rest = said;
  // A word can name both a style and a colour ("walnut"); either way it isn't a keyword.
  const take = (phrase: string) => {
    const p = flat(phrase);
    if (p.trim().length < 2 || !said.includes(p)) return false;
    rest = rest.split(p).join(" ");
    return true;
  };
  const styles: StyleId[] = [];
  for (const s of STYLES) {
    const names = [s.label, s.id.replace(/_/g, " "), ...s.words].sort(
      (a, b) => b.length - a.length,
    );
    // Every name is tried, so each is removed from the keywords.
    if (names.map(take).some(Boolean)) styles.push(s.id);
  }
  const palette: ColorId[] = [];
  const addColor = (id: ColorId) => {
    if (!palette.includes(id)) palette.push(id);
  };
  for (const c of COLORS) if (take(c.label)) addColor(c.id);
  for (const [word, id] of Object.entries(COLOR_ALIASES)) if (take(word)) addColor(id);
  const keywords = [
    ...new Set(
      rest
        .split(" ")
        .filter((w) => w.length >= 3 && w.length <= 30 && !/^\d+k?$/.test(w) && !STOP.has(w)),
    ),
  ];
  return {
    styles: styles.slice(0, 3),
    palette: palette.slice(0, 5),
    keywords: keywords.slice(0, 8),
  };
}

/* ---------------- What a listing is ---------------- */

type Size = { width: number; depth: number; height: number };
const size = (width: number, depth: number, height: number): Size => ({ width, depth, height });

/**
 * Title words that say what kind of thing a listing is, most specific first,
 * with a typical size in metres where the kind's default would be wrong.
 */
const KIND_RULES: readonly { words: string[]; kind: PlacementKind; size?: Size }[] = [
  { words: ["floor lamp"], kind: "lamp", size: size(0.4, 0.4, 1.6) },
  { words: ["lamp", "lantern"], kind: "lamp", size: size(0.3, 0.3, 0.5) },
  { words: ["plant stand"], kind: "table", size: size(0.35, 0.35, 0.6) },
  { words: ["coffee table", "cocktail table"], kind: "table", size: size(1.1, 0.6, 0.45) },
  {
    words: ["side table", "end table", "nightstand", "night stand", "bedside table"],
    kind: "table",
    size: size(0.5, 0.45, 0.55),
  },
  { words: ["dining table", "kitchen table"], kind: "table", size: size(1.5, 0.9, 0.75) },
  {
    words: ["armchair", "arm chair", "accent chair", "lounge chair", "recliner", "peacock chair"],
    kind: "chair",
    size: size(0.85, 0.85, 0.9),
  },
  { words: ["bar stool", "stool"], kind: "chair", size: size(0.42, 0.42, 0.75) },
  { words: ["chair"], kind: "chair" },
  {
    words: ["tv stand", "media console", "console", "credenza", "sideboard", "buffet"],
    kind: "storage",
    size: size(1.6, 0.45, 0.65),
  },
  {
    words: ["bookcase", "bookshelf", "bookshelves", "shelf", "shelves", "shelving"],
    kind: "storage",
    size: size(0.8, 0.32, 1.8),
  },
  { words: ["wardrobe", "armoire"], kind: "storage", size: size(1, 0.6, 1.9) },
  { words: ["dresser", "chest of drawers", "cabinet"], kind: "storage", size: size(1.1, 0.5, 0.9) },
  { words: ["desk"], kind: "desk" },
  { words: ["loveseat", "love seat"], kind: "sofa", size: size(1.5, 0.85, 0.85) },
  { words: ["sofa", "couch", "sectional", "futon", "settee"], kind: "sofa" },
  { words: ["bed frame", "bed", "mattress"], kind: "bed" },
  { words: ["rug", "carpet", "kilim", "runner"], kind: "rug" },
  { words: ["mirror"], kind: "art", size: size(0.6, 0.04, 1.2) },
  {
    words: ["poster", "print", "painting", "canvas", "artwork", "wall art", "tapestry", "framed"],
    kind: "art",
  },
  {
    words: ["houseplant", "plant", "monstera", "pothos", "fern", "ficus", "succulent", "cactus"],
    kind: "plant",
  },
  { words: ["bench", "ottoman", "pouf"], kind: "chair", size: size(1, 0.4, 0.45) },
  { words: ["table"], kind: "table" },
  { words: ["vase", "clock", "candle", "sculpture", "basket", "planter"], kind: "decor" },
];

/** Categories whose listings are never home furnishings, whatever the title says. */
const NOT_HOME = new Set([
  "vehicles",
  "propertyrentals",
  "homesales",
  "pets",
  "apparel",
  "sporting",
  "toys",
  "musical",
  "family",
]);

function kindRule(l: { title: string; category: string }) {
  if (NOT_HOME.has(l.category)) return null;
  const title = l.title.toLowerCase();
  return KIND_RULES.find((r) => r.words.some((w) => hasTerm(title, w))) ?? null;
}

/** What kind of thing a listing is, from its title; null when the title doesn't say. */
export function kindOf(l: { title: string; category: string }): PlacementKind | null {
  return kindRule(l)?.kind ?? null;
}

/** A typical size in metres for a listing placed as `kind`: an estimate, never a measurement. */
export function sizeOf(kind: PlacementKind, l: { title: string; category: string }): Size {
  const rule = kindRule(l);
  if (kind === "bed") {
    const t = l.title.toLowerCase();
    const width = hasTerm(t, "king")
      ? 1.95
      : hasTerm(t, "queen")
        ? 1.55
        : hasTerm(t, "twin")
          ? 1
          : 1.4;
    return size(width, 2.05, 0.9);
  }
  return rule?.kind === kind && rule.size ? { ...rule.size } : itemSize(kind);
}

/**
 * The kinds of thing a message asks for by name and nothing else ("add a floor
 * lamp and a rug"). Empty when it also describes a look ("cozy, lots of
 * plants"): that is a vibe for the whole apartment, not a shopping list.
 */
export function kindsAsked(text: string): PlacementKind[] {
  let rest = flat(text.replace(/\[removed\]/g, " "));
  const kinds: PlacementKind[] = [];
  for (const rule of KIND_RULES)
    for (const word of rule.words)
      for (const p of [flat(word), flat(`${word}s`)])
        if (rest.includes(p)) {
          rest = rest.split(p).join(" ");
          if (!kinds.includes(rule.kind)) kinds.push(rule.kind);
        }
  return saysLook(rest) ? [] : kinds;
}

/** Whether text describes a look at all: a style, a colour or a word worth matching. */
export function saysLook(text: string): boolean {
  const look = vibeFromText(text);
  return look.styles.length + look.palette.length + look.keywords.length > 0;
}

/** Plausible metres per kind: [min, max] for width, depth and height. */
const KIND_RANGE: Record<PlacementKind, readonly [number, number][]> = {
  sofa: [
    [1, 3.6],
    [0.6, 1.8],
    [0.5, 1.2],
  ],
  bed: [
    [0.7, 2.3],
    [1.6, 2.4],
    [0.3, 1.6],
  ],
  table: [
    [0.3, 3],
    [0.3, 1.6],
    [0.25, 1.2],
  ],
  storage: [
    [0.3, 3],
    [0.2, 1],
    [0.3, 2.6],
  ],
  chair: [
    [0.3, 1.5],
    [0.3, 1.3],
    [0.35, 1.4],
  ],
  desk: [
    [0.6, 2.4],
    [0.4, 1.2],
    [0.5, 1.3],
  ],
  lamp: [
    [0.1, 0.9],
    [0.1, 0.9],
    [0.2, 2.2],
  ],
  rug: [
    [0.4, 4],
    [0.4, 5],
    [ITEM_LIMITS.min, 0.08],
  ],
  art: [
    [0.15, 2.5],
    [ITEM_LIMITS.min, 0.15],
    [0.15, 2.5],
  ],
  plant: [
    [0.1, 1.5],
    [0.1, 1.5],
    [0.1, 2.6],
  ],
  decor: [
    [0.05, 1.2],
    [0.05, 1.2],
    [0.05, 1.8],
  ],
};

/** Why these dimensions can't be this kind of item, or null. */
export function sizeProblem(kind: PlacementKind, s: Size): string | null {
  const [w, d, h] = KIND_RANGE[kind];
  const off = (n: number, [min, max]: readonly [number, number]) =>
    !Number.isFinite(n) || n < min || n > max;
  return off(s.width, w) || off(s.depth, d) || off(s.height, h)
    ? `a ${kind} is ${w[0]}–${w[1]} m wide, ${d[0]}–${d[1]} m deep and ${h[0]}–${h[1]} m tall`
    : null;
}

/* ---------------- Words ---------------- */

// The same patterns convex/homeChat.ts holds Muse's chat replies to.
const LINK = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|ly|co|app|me|info|biz|xyz|us)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/** What's wrong with text Muse wrote for the person: empty, too long, a link or contact detail, a protected trait. */
export function textProblems(field: string, text: string, max: number): string[] {
  const t = text.trim();
  const out: string[] = [];
  if (!t) out.push(`${field}: write a few words`);
  if (t.length > max) out.push(`${field}: keep it under ${max} characters`);
  if (LINK.test(t) || EMAIL.test(t) || PHONE.test(t))
    out.push(`${field}: no links, email addresses or phone numbers`);
  if (hasProtected(t)) out.push(`${field}: never mention protected traits`);
  return out;
}

export const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * The reply when Landing's rules furnish, or when Muse's count no longer
 * matches what was placed. It says what was placed in the private model,
 * never that anything was bought or anyone was messaged.
 */
export function furnishText(a: {
  count: number;
  vibe: string;
  total: number;
  budget: { total: number; spent: number } | null;
}): string {
  if (a.count === 0)
    return a.budget && a.budget.total - a.budget.spent <= 0
      ? `Your ${dollars(a.budget.total)} furniture budget is used up. Remove something or raise it to add more.`
      : "Nothing on Marketplace fits that right now. Try another vibe or a higher budget.";
  const what = `Picked ${a.count} ${a.count === 1 ? "item" : "items"}`;
  const feel = a.vibe.trim() ? ` for a ${a.vibe.trim().replace(/[.!?\s]+$/, "")} feel` : "";
  const cost = !a.budget
    ? `${dollars(a.total)} in all`
    : a.budget.spent > 0
      ? `${dollars(a.total)} more, ${dollars(a.total + a.budget.spent)} of your ${dollars(a.budget.total)}`
      : `${dollars(a.total)} of your ${dollars(a.budget.total)}`;
  return `${what}${feel}: ${cost}. They're in your apartment to review; nothing is bought yet.`;
}
