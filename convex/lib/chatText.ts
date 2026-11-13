import type { AiFallbackReason } from "../validators";
import { FURNISH_LIMITS, ITEM_WORDS, kindsNamed } from "./furnish";
import { hasProtected, REDACTED, redactProtected } from "./protectedText";
import type { PlacementKind } from "./unitScene";

/**
 * What a Landing Home chat message says: the neighborhoods it names, the
 * prices in it, and whether it asks to furnish the apartment (#150). Pure text
 * helpers under the keyword rules (./homeChatRules.ts), the move plan
 * (./movePlan.ts) and the server's checks (convex/homeChat.ts).
 */

export type ChatNeighborhood = { slug: string; name: string; aliases?: string[] };
/** Which tab of Landing Home is showing: the map, or the 3D apartment. */
export type ChatView = "map" | "apartment";

/** Everyday names people use that aren't the DataSF name or its short name. */
export const CHAT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "south-of-market": ["soma"],
  "bernal-heights": ["bernal"],
  "potrero-hill": ["dogpatch"],
  "western-addition": ["nopa", "fillmore"],
  "haight-ashbury": ["the haight", "upper haight"],
  "sunset-parkside": ["the sunset", "outer sunset", "parkside"],
  "financial-district-south-beach": ["fidi", "financial district", "south beach"],
  "castro-upper-market": ["castro", "the castro", "upper market"],
  "lone-mountain-usf": ["lone mountain", "usf"],
  "oceanview-merced-ingleside": ["omi", "ingleside"],
  "pacific-heights": ["pac heights"],
  "visitacion-valley": ["vis valley"],
  "bayview-hunters-point": ["bayview", "hunters point"],
};

/** Lowercase words separated by single spaces, so phrases match on word boundaries. */
export function words(s: string): string {
  return ` ${s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Every name a neighborhood answers to, normalized. */
function namesOf(n: ChatNeighborhood): string[] {
  const raw = [
    n.name,
    n.slug.replace(/-/g, " "),
    ...n.name.split("/"),
    ...(n.aliases ?? []),
    ...(CHAT_ALIASES[n.slug] ?? []),
  ];
  return [...new Set(raw.map((r) => words(r).trim()).filter((r) => r.length >= 3))];
}

/** Every name of every neighborhood, longest first ("Mission Bay" before "Mission"). */
function allNames(neighborhoods: ChatNeighborhood[]) {
  return neighborhoods
    .flatMap((n) => namesOf(n).map((name) => ({ slug: n.slug, name })))
    .sort((a, b) => b.name.length - a.name.length);
}

/**
 * The neighborhoods a message names, in the order it names them. Longer names
 * win ("Mission Bay" is not the Mission), and each word counts once.
 */
export function findNeighborhoods(message: string, neighborhoods: ChatNeighborhood[]): string[] {
  let text = words(message);
  const found: { slug: string; at: number }[] = [];
  for (const { slug, name } of allNames(neighborhoods)) {
    const needle = ` ${name} `;
    let at = text.indexOf(needle);
    while (at >= 0) {
      if (!found.some((f) => f.slug === slug)) found.push({ slug, at });
      // Blank the match so a shorter name can't reuse its words.
      text = text.slice(0, at + 1) + "#".repeat(name.length) + text.slice(at + 1 + name.length);
      at = text.indexOf(needle);
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.slug);
}

/**
 * The neighborhoods listed at the very start of `text` ("the Mission or Noe
 * Valley, and what's on in SoMa?" gives the first two), in order.
 */
export function leadingNeighborhoods(text: string, neighborhoods: ChatNeighborhood[]): string[] {
  const names = allNames(neighborhoods);
  let rest = words(text).trimStart();
  const found: string[] = [];
  for (;;) {
    const hit = names.find((n) => rest.startsWith(`${n.name} `));
    if (hit) {
      if (!found.includes(hit.slug)) found.push(hit.slug);
      rest = rest.slice(hit.name.length + 1);
      continue;
    }
    const filler = /^(?:the|or|and|maybe|either|possibly|near|around|in) /.exec(rest);
    if (!filler) return found;
    rest = rest.slice(filler[0].length);
  }
}

/* ── Prices ── */

const dollars = (digits: string, k: string | undefined) =>
  Number(digits.replace(/,/g, "")) * (k ? 1000 : 1);

/** "under $2,400", "below 2.5k", "max $1800", "$2k". Monthly rent in whole dollars, or undefined. */
export function priceIn(message: string): number | undefined {
  const m =
    /(?:under|below|less than|max(?:imum)?|up to|at most|<|cheaper than|within)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(
      message,
    ) ?? /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(message);
  if (!m) return undefined;
  const n = dollars(m[1], m[2]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // "under 2.5" with no k reads as thousands; rent is never under $100.
  return Math.round(n < 100 ? n * 1000 : n);
}

/** The most a furnish request may spend on furniture, in whole dollars. */
export const FURNISH_BUDGET_MAX = 100_000;

/** Whether `n` is a furniture budget: whole dollars, 1 to `FURNISH_BUDGET_MAX`. */
export function validFurnishBudget(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= FURNISH_BUDGET_MAX;
}

/**
 * What a furnish request may spend in total: "under $800", "$1.5k", "budget of
 * 600", "500 dollars". Whole dollars as written (a $50 lamp is $50), or undefined.
 */
export function spendIn(message: string): number | undefined {
  const m =
    /(?:under|below|less than|max(?:imum)?|up to|at most|<|within|budget(?:\s+(?:is|of))?|spend(?:ing)?)\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(
      message,
    ) ??
    /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(message) ??
    /\b(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:dollars|bucks|usd)\b/i.exec(message);
  if (!m) return undefined;
  const n = Math.round(dollars(m[1], m[2]));
  return validFurnishBudget(n) ? n : undefined;
}

/**
 * Every number a text writes, as whole dollars: "2,400", "$2400" and "2.4k"
 * all give 2400, and a bare "2.4" also counts as 2400. For checking that an
 * amount Muse reports is one the person wrote.
 */
export function numbersIn(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/gi)) {
    const n = dollars(m[1], m[2]);
    if (!Number.isFinite(n)) continue;
    out.add(Math.round(n));
    if (!m[2] && n < 100) out.add(Math.round(n * 1000));
  }
  return [...out];
}

/* ── Links and contact details ── */

const LINK = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|ly|co|app|me|info|biz|xyz|us)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/** Whether a text carries a link, an email address or a phone number. */
export function hasContact(text: string): boolean {
  return LINK.test(text) || EMAIL.test(text) || PHONE.test(text);
}

/* ── Furnishing (#150) ── */

/** The longest vibe a furnish request carries, in characters. */
export const VIBE_MAX = 200;

/**
 * Why a vibe can't go with a furnish request, or null when it's fine: 1 to
 * `VIBE_MAX` characters, no links or contact details, no protected traits.
 */
export function vibeProblem(vibe: string): string | null {
  const v = vibe.trim();
  if (!v) return "describe the vibe in a few words";
  if (v.length > VIBE_MAX) return `keep it under ${VIBE_MAX} characters`;
  if (hasContact(v)) return "no links, email addresses or phone numbers";
  if (hasProtected(v)) return "never mention protected traits";
  return null;
}

/**
 * The person's words as a vibe: protected traits taken out, whitespace
 * collapsed, cut to `VIBE_MAX`. Null when nothing usable is left or it carries
 * a link or contact detail.
 */
export function cleanVibe(text: string): string | null {
  const v = redactProtected(text)
    .split(REDACTED)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VIBE_MAX)
    .trim();
  return vibeProblem(v) === null ? v : null;
}

/**
 * The look a furnish request describes, without the ask and the price around
 * it: "make it cozy and warm, $1,500" is "cozy and warm".
 */
export function vibeWords(text: string): string {
  return text
    .replace(
      /[,;]?\s*(?:(?:with|for|on|and)\s+)?(?:(?:a|my|our)\s+)?(?:(?:budget|max|maximum|under|below|up to|at most|less than|no more than|around|about|within)\s+(?:of\s+|is\s+)?)*\$?\s*\d[\d,]*(?:\.\d+)?\s*k?\b(?:\s*(?:budget|max|total|dollars|bucks))?/gi,
      " ",
    )
    .replace(
      /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:make|furnish|decorate|style|give|set up)\s+(?:it|me|(?:my|our|the) \w+)?\s*(?:up\s+)?(?:(?:with|in|like|as|to be|to feel|to look)\s+)?/i,
      "",
    )
    .replace(
      /^\s*(?:i(?:'d| would)? (?:want|like|love)|i'm (?:going|looking) for|go(?:ing)? for|something)\s+(?:it\s+)?(?:to (?:be|feel|look)\s+)?/i,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "");
}

/** Words for a rental search ("rooms under $2k"), as opposed to the person's own apartment. */
export const RENTAL_WORDS =
  / (rooms?|rentals?|rent|apartments?|apts?|studios?|1br|2br|places to live|listings?|housing|homes?|sublets?) /;

const FURNISH_VERBS =
  / (furnish|furnishing|furnishings|decorate|decorating|redecorate|decor|aesthetic|interior design) /;
const FURNISH_MOODS = / (vibe|vibes|cozy|cosy|style|styled|styling) /;
const FURNISH_ITEMS =
  / (furniture|couch|sofa|bed|bed frame|mattress|lamps?|rugs?|posters?|desk|chairs?|table|bookshelf|shelves|dresser|nightstand|curtains|mirror|plants?) /;
const MY_PLACE =
  / (my|our|the) (place|apartment|apt|room|bedroom|living room|studio|unit|home|flat) /;
/** Words that ask for a thing: "add a lamp", "I need a desk", "could use a rug". */
const ADD_CUES =
  / (add|adding|another|get me|i need|need (a|an|some)|want (a|an|some)|find me|buy|put (a|an|in|some)|place (a|an|some)|looking for|could use|missing) /;

/**
 * Whether a message asks to furnish or style the person's apartment. "Furnish"
 * and "decorate" always do. A mood ("cozy", "vibe", "style") does unless the
 * message is a rental search or about a neighborhood. A piece of furniture,
 * or asking for any kind of thing by name, does only for their own place, or
 * on the Apartment tab.
 */
export function furnishAsk(
  message: string,
  about: { view?: ChatView; neighborhoods?: ChatNeighborhood[] } = {},
): boolean {
  const t = words(message);
  if (FURNISH_VERBS.test(t)) return true;
  const mine = about.view === "apartment" || MY_PLACE.test(t);
  if (FURNISH_MOODS.test(t))
    return (
      mine ||
      (!RENTAL_WORDS.test(t) && findNeighborhoods(message, about.neighborhoods ?? []).length === 0)
    );
  // "Will my furniture fit" is a question for My Place, not a request for new pieces.
  if (!mine || / (fit|fits) /.test(t)) return false;
  // Any kind of thing asked for by name counts (#153): "find me an armchair".
  return FURNISH_ITEMS.test(t) || (ADD_CUES.test(t) && kindsNamed(message).kinds.length > 0);
}

/* ── A look for the whole place, or named things to add (#153) ── */

/** Words about the whole place, beyond `FURNISH_VERBS` and `FURNISH_MOODS`. */
const ROOM_CUES = / (make it|make (my|our|the|this) \w+|feel|feels|look) /;

/**
 * A mood word inside a named thing's own phrase ("a cozy armchair", "cozy
 * reading lamp") describes the thing, not the place. A comma or a joining word
 * breaks the phrase: "cozy, lots of plants" and "cozy with plants" are a look.
 */
const ITEM_MOOD = new RegExp(
  `\\b(?:vibes?|cozy|cosy|style|styled|styling)\\s+(?:(?!(?:with|and|or|plus|lots|of|some|a|an|the)\\b)[a-z-]+\\s+){0,2}(?:${ITEM_WORDS.map(
    (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})s?\\b`,
  "gi",
);

/** Whether a message asks, with an add cue, for things it names ("find me a reading lamp"). */
export function asksForItems(text: string): boolean {
  return ADD_CUES.test(words(text)) && kindsNamed(text).kinds.length > 0;
}

export type FurnishRequest =
  /** Style or furnish the whole apartment: `vibe` is the look, without the ask and the price. */
  | { type: "room"; vibe: string }
  /** Add these things and nothing else: `want` is how the person described them, maybe "". */
  | { type: "items"; kinds: PlacementKind[]; want: string };

/**
 * What a furnishing message asks for. Naming things ("add a reading lamp", "a
 * rug under $200") asks for those things, at most `FURNISH_LIMITS.onlyMax`
 * kinds, unless the message is plainly about the whole place and has no add
 * cue ("cozy, lots of plants", "make it cozy with a big rug"). An adjective
 * never turns a list of things into a look: "add a cozy armchair" is a chair.
 */
export function furnishRequest(text: string): FurnishRequest {
  const { kinds, want } = kindsNamed(text);
  const t = words(text);
  const room =
    !kinds.length ||
    (!ADD_CUES.test(t) &&
      (FURNISH_VERBS.test(t) ||
        ROOM_CUES.test(t) ||
        FURNISH_MOODS.test(words(text.replace(ITEM_MOOD, " ")))));
  return room
    ? { type: "room", vibe: vibeWords(text) }
    : { type: "items", kinds: kinds.slice(0, FURNISH_LIMITS.onlyMax), want };
}

/**
 * Whether a reply says nothing was placed ("nothing is bought or placed").
 * Furnishing does place its picks in the private 3D model, so that is false:
 * the true line is that nothing is bought or sent.
 */
export function deniesPlacing(text: string): boolean {
  return /\b(?:bought|ordered|purchased|sent|reserved)\s+(?:or|nor)\s+placed\b|\bnothing\s+(?:is|was|has been|gets|will be)\s+placed\b|(?:\bnot|\bnever|n['’]t)\s+(?:been\s+|yet\s+)?placed\b/i.test(
    text,
  );
}

/**
 * Whether a reply says drafts are waiting in the Inbox ("your drafts are
 * waiting for approval"), as opposed to "nothing is waiting" or "no drafts are
 * waiting". True only of an Inbox that holds some (#153).
 */
export function saysDraftsWait(text: string): boolean {
  const m =
    /\b(\w+\s+)?(?:drafts?|messages?)\s+(?:(?:is|are|re)\s+)?(?:still\s+)?(?:waiting|pending)\b/i.exec(
      text.replace(/['’]/g, " "),
    );
  return !!m && !/^(?:no|any|zero)\s+$/i.test(m[1] ?? "");
}

/* ── Why Landing's rules answered (#153) ── */

/**
 * Why a reply came from Landing's rules and not Muse, for its label. `off`:
 * AI is disabled. `busy`: the viewer is over the rate limit, or the model
 * timed out or failed. `unsure`: Muse's answer was rejected, or the rules
 * answered for another reason (nothing to ask Muse about).
 */
export type RulesWhy = "off" | "busy" | "unsure";

/** `runAgent`'s reason for falling back, as the reason a reply shows. */
export function rulesWhy(reason: AiFallbackReason | undefined): RulesWhy {
  if (reason === "disabled") return "off";
  return reason === "timeout" || reason === "model_error" ? "busy" : "unsure";
}
