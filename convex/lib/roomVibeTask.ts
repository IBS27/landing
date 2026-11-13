import { v } from "convex/values";
import { defineTask } from "../ai/agent";
import type { AgentSource } from "../ai/sources";
import {
  COLORS,
  colorId,
  type RoomKind,
  STYLES,
  styleId,
  VIBE_LIMITS,
  vibeFromSignals,
  vibeProblems,
} from "./vibe";

/**
 * Muse's room vibe task (#25 on #8's `runAgent`, Meta's Muse Spark). Reads
 * what the person saved, liked and follows, plus their City Profile
 * interests, and proposes a vibe for one room. The output is only a proposal:
 * the person keeps or edits it and `rooms.setVibe` stores it, so the agent
 * never writes. With AI off, or when the model can't give a valid answer, the
 * rules in `./vibe.ts` answer from the same signals.
 */

export type RoomVibeInput = {
  room: { name: string; kind: RoomKind; size: { widthFt: number; lengthFt: number } | null };
  /** City Profile interests (id and label), stated and inferred. */
  interests: { id: string; label: string }[];
  /** Facebook Pages the person follows. */
  follows: { name: string; category: string }[];
};

const output = v.object({
  summary: v.string(),
  styles: v.array(styleId),
  palette: v.array(colorId),
  keywords: v.array(v.string()),
  /** Sources that shaped the vibe: the source key and a few words on why. */
  because: v.array(v.object({ source: v.string(), why: v.string() })),
  /** Interest labels or Page names from the input that shaped it, copied exactly. */
  fromProfile: v.array(v.string()),
});

const L = VIBE_LIMITS;

const INSTRUCTIONS = `Suggest a home decor style vibe for one room, from what the person saved, liked and follows. <input> has the room (name, kind, floor size in feet or null), their interests and the Facebook Pages they follow. <sources> are posts they liked or saved and Marketplace listings they saved.

Return:
- summary: one or two plain sentences describing the room's look and feel (at most ${L.summaryMax} characters), e.g. "Warm mid-century with a reading corner: walnut, mustard and lots of plants."
- styles: ${L.styles.min}–${L.styles.max} ids from ${STYLES.map((s) => s.id).join(", ")}.
- palette: ${L.palette.min}–${L.palette.max} ids from ${COLORS.map((c) => c.id).join(", ")}.
- keywords: up to ${L.keywordsMax} short, concrete search words for furniture and decor that fit (materials, pieces, textures), each at most ${L.keywordMax} characters, lowercase, e.g. "walnut", "linen", "record shelf".
- because: the sources that actually shaped the vibe (at most ${L.basisMax}), each { source: the exact source key, why: a few words, at most 80 characters, e.g. "Saved a teak cane armchair" }. Skip sources that say nothing about taste in things, places or style.
- fromProfile: interest labels or Page names from <input> that shaped the vibe, copied exactly.

Base the vibe on real signals: there must be at least one entry in because or fromProfile. Don't describe the person, only the room. Never base a style on who someone is (culture, religion, nationality, age, gender or family): a vibe is about objects, materials and colors.`;

/** Interest labels and Page names the model may name in `fromProfile`. */
function profileNames(input: RoomVibeInput) {
  return new Set([...input.interests.map((i) => i.label), ...input.follows.map((f) => f.name)]);
}

export const roomVibeTask = defineTask({
  agent: "muse",
  name: "muse.roomVibe",
  instructions: INSTRUCTIONS,
  output,
  cites: (o) => o.because.map((b) => b.source),
  check: (o, input: RoomVibeInput) => {
    const problems = vibeProblems(o);
    if (o.because.length === 0 && o.fromProfile.length === 0)
      problems.push("Name at least one source in because or one interest or Page in fromProfile");
    if (o.because.length > L.basisMax) problems.push(`because: at most ${L.basisMax} entries`);
    for (const [i, b] of o.because.entries())
      if (!b.why.trim() || b.why.length > 80) problems.push(`because[${i}].why: 1–80 characters`);
    const names = profileNames(input);
    for (const [i, name] of o.fromProfile.entries())
      if (!names.has(name))
        problems.push(`fromProfile[${i}] "${name}" isn't an interest or Page in the input`);
    return problems;
  },
  fallback: (input, sources: AgentSource[]) => {
    const rules = vibeFromSignals(
      { room: input.room, interests: input.interests, follows: input.follows },
      sources.map((s) => ({ key: s.key, text: sourceText(s) })),
    );
    return { ...rules.vibe, because: rules.because, fromProfile: rules.fromProfile };
  },
  effort: "low",
  maxAttempts: 2,
});

/** A source's words for the rules: a listing's title first, then its text. */
function sourceText(s: AgentSource): string {
  return "title" in s && s.title ? `${s.title}\n${s.text}` : s.text;
}
