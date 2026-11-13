/**
 * Marketplace items that match a room's vibe (#26). Deterministic: each listing
 * is scored by the vibe's style words and decor terms, its own keywords and its
 * palette colors found in the listing's title and description. Every result
 * says which words matched. A vibe describes a room, never a person.
 */

import { COLORS, type ColorId, STYLES, type StyleId } from "./vibe";

export type MatchVibe = {
  styles: readonly StyleId[];
  palette: readonly ColorId[];
  keywords: readonly string[];
};

export type MatchListing = { id: string; title: string; description: string; createdAt: number };

export type VibeMatch = { id: string; score: number; reasons: string[] };

/** Categories that can't furnish a room. */
export const NOT_DECOR = new Set(["vehicles", "propertyrentals", "homesales", "pets"]);

/** At most this many words named per reason, so a reason stays one short line. */
const WORDS_SHOWN = 3;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (or phrase) match, allowing a plural "s": "plant" matches "plants". */
export function hasTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}s?([^a-z0-9]|$)`).test(text);
}

const quoted = (words: string[]) =>
  words
    .slice(0, WORDS_SHOWN)
    .map((w) => `"${w}"`)
    .join(", ");

/** One listing against the vibe: its score and the reasons, strongest first. */
export function matchListing(vibe: MatchVibe, l: MatchListing): VibeMatch {
  const text = `${l.title} ${l.description}`.toLowerCase();
  const parts: { weight: number; reason: string }[] = [];
  // Each word counts once: style first, then keywords, then colors.
  const used = new Set<string>();
  const fresh = (w: string) => {
    const k = w.toLowerCase();
    if (used.has(k)) return false;
    used.add(k);
    return true;
  };

  for (const id of vibe.styles) {
    const style = STYLES.find((s) => s.id === id);
    if (!style) continue;
    const hits = [...new Set([...style.words, ...style.decor])].filter(
      (w) => hasTerm(text, w) && fresh(w),
    );
    if (hits.length > 0)
      parts.push({
        weight: 2 * Math.min(hits.length, 3),
        reason: `${style.label}: ${quoted(hits)}`,
      });
  }

  const keywords = [...new Set(vibe.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  const keyHits = keywords.filter((k) => hasTerm(text, k) && fresh(k));
  if (keyHits.length > 0)
    parts.push({
      weight: 2 * keyHits.length,
      reason: `${keyHits.length === 1 ? "Your keyword" : "Your keywords"}: ${quoted(keyHits)}`,
    });

  const colorHits = vibe.palette
    .map((id) => COLORS.find((c) => c.id === id))
    .filter((c): c is (typeof COLORS)[number] => !!c)
    // The full color name only: "forest" alone is usually a place, not a color.
    .filter((c) => hasTerm(text, c.label) && fresh(c.label))
    .map((c) => c.label.toLowerCase());
  if (colorHits.length > 0)
    parts.push({
      weight: colorHits.length,
      reason: `Matches your palette: ${colorHits.slice(0, WORDS_SHOWN).join(", ")}`,
    });

  parts.sort((a, b) => b.weight - a.weight);
  return {
    id: l.id,
    score: parts.reduce((s, p) => s + p.weight, 0),
    reasons: parts.slice(0, 3).map((p) => p.reason),
  };
}

/** Listings that match at all, best first; ties go to the newer listing. */
export function rankVibeMatches(vibe: MatchVibe, listings: readonly MatchListing[]): VibeMatch[] {
  const created = new Map(listings.map((l) => [l.id, l.createdAt]));
  return listings
    .map((l) => matchListing(vibe, l))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || (created.get(b.id) ?? 0) - (created.get(a.id) ?? 0));
}
