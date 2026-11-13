import { describe, expect, test } from "bun:test";
import { hasTerm, type MatchVibe, matchListing, rankVibeMatches } from "../convex/lib/vibeMatch";

const vibe: MatchVibe = {
  styles: ["mid_century", "vintage"],
  palette: ["walnut", "mustard"],
  keywords: ["reading chair", "walnut"],
};

const l = (id: string, title: string, description = "", createdAt = 0) => ({
  id,
  title,
  description,
  createdAt,
});

describe("hasTerm", () => {
  test("whole words and phrases, plural s allowed", () => {
    expect(hasTerm("two vintage wool rugs", "wool rug")).toBe(true);
    expect(hasTerm("a teak credenza", "teak")).toBe(true);
    expect(hasTerm("steakhouse chairs", "teak")).toBe(false);
    expect(hasTerm("anything", "  ")).toBe(false);
  });
});

describe("matchListing", () => {
  test("names the style words that matched", () => {
    const m = matchListing(vibe, l("a", "Mid-century cane armchair, solid teak"));
    expect(m.reasons).toEqual(['Mid-century: "mid-century", "teak"']);
    expect(m.score).toBe(4);
  });
  test("each word counts once across style, keywords and palette", () => {
    const m = matchListing(vibe, l("a", "Walnut side table"));
    expect(m.reasons).toEqual(['Mid-century: "walnut"']);
    expect(m.score).toBe(2);
  });
  test("keywords and palette colors add their own reasons", () => {
    const m = matchListing(vibe, l("a", "Reading chair", "Upholstered in mustard velvet"));
    expect(m.reasons).toEqual(['Your keyword: "reading chair"', "Matches your palette: mustard"]);
  });
  test("a word inside a longer phrase that already matched counts once", () => {
    const m = matchListing(vibe, l("a", "Vintage lamp", "Brass base"));
    expect(m.reasons).toEqual(['Vintage: "vintage lamp", "brass"']);
    expect(m.score).toBe(4);
  });
  test("no matching words, no score", () => {
    expect(matchListing(vibe, l("a", "Glass top desk", "Chrome legs")).score).toBe(0);
  });
});

describe("rankVibeMatches", () => {
  test("best match first, ties to the newer listing, non-matches dropped", () => {
    const ranked = rankVibeMatches(vibe, [
      l("lamp", "Vintage lamp", "", 1),
      l("chair", "Mid-century teak chair with brass feet", "", 2),
      l("desk", "Glass top desk", "", 3),
      l("lamp2", "Vintage lamp", "", 5),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["chair", "lamp2", "lamp"]);
  });
});
