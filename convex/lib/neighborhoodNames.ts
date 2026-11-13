import { type NeighborhoodSlug, SF_NEIGHBORHOODS } from "./cityProfileFacts";

/**
 * The names people use for San Francisco's 41 DataSF Analysis Neighborhoods,
 * shared by "Try the neighborhood" (reading a question) and the neighborhoods
 * search. Client-safe: no server imports.
 *
 * Everyday names are mapped to the DataSF neighborhood whose boundary holds
 * them (checked with `neighborhoodSlugAt`): Civic Center is in the Tenderloin,
 * Union Square in the Financial District, Alamo Square and the Lower Haight in
 * Hayes Valley. A name that spans several lists them all, the one it's usually
 * meant as first: "the Richmond" is the Inner Richmond, and search also shows
 * the Outer Richmond.
 */
export const EVERYDAY_NAMES: readonly (readonly [
  string,
  NeighborhoodSlug,
  ...NeighborhoodSlug[],
])[] = [
  ["Richmond", "inner-richmond", "outer-richmond"],
  ["Richmond District", "inner-richmond", "outer-richmond"],
  ["Sunset District", "sunset-parkside", "inner-sunset"],
  ["Mission District", "mission"],
  ["Inner Mission", "mission"],
  ["Hayes", "hayes-valley"],
  ["Alamo Square", "hayes-valley"],
  ["Lower Haight", "hayes-valley"],
  ["Upper Haight", "haight-ashbury"],
  ["Haight-Ashbury", "haight-ashbury"],
  ["Cole Valley", "haight-ashbury"],
  ["Civic Center", "tenderloin"],
  ["Mid-Market", "south-of-market", "tenderloin"],
  ["Union Square", "financial-district-south-beach"],
  ["Financial District", "financial-district-south-beach"],
  ["Downtown", "financial-district-south-beach"],
  ["Rincon Hill", "financial-district-south-beach"],
  ["Duboce Triangle", "castro-upper-market"],
  ["Eureka Valley", "castro-upper-market"],
  ["Mission Dolores", "castro-upper-market", "mission"],
  ["Noe", "noe-valley"],
  ["Bernal", "bernal-heights"],
  ["Potrero", "potrero-hill"],
  ["Dogpatch", "potrero-hill"],
  ["NoPa", "western-addition", "lone-mountain-usf"],
  ["North Panhandle", "western-addition", "lone-mountain-usf"],
  ["Fillmore", "western-addition"],
  ["Cathedral Hill", "western-addition"],
  ["Anza Vista", "lone-mountain-usf"],
  ["Laurel Heights", "presidio-heights"],
  ["Jordan Park", "presidio-heights"],
  ["Lower Pac Heights", "pacific-heights", "western-addition"],
  ["Polk Gulch", "nob-hill"],
  ["Lower Nob Hill", "nob-hill"],
  ["Cow Hollow", "marina"],
  ["Telegraph Hill", "north-beach"],
  ["West Portal", "west-of-twin-peaks"],
  ["Forest Hill", "west-of-twin-peaks"],
  ["Miraloma Park", "west-of-twin-peaks"],
  ["St. Francis Wood", "west-of-twin-peaks"],
  ["Sunnyside", "west-of-twin-peaks"],
  ["Diamond Heights", "glen-park"],
  ["Golden Gate Heights", "inner-sunset"],
  ["Hunters Point", "bayview-hunters-point"],
  ["Hunter's Point", "bayview-hunters-point"],
  ["India Basin", "bayview-hunters-point"],
  ["Crocker-Amazon", "excelsior"],
  ["Merced Heights", "oceanview-merced-ingleside"],
  ["Lake Merced", "lakeshore"],
  ["Parkmerced", "lakeshore"],
  ["Stonestown", "lakeshore"],
  ["Sea Cliff", "seacliff"],
  ["Yerba Buena Island", "treasure-island"],
  ["Pacific Heights", "pacific-heights"],
  ["GG Park", "golden-gate-park"],
];

export type NeighborhoodName = {
  name: string;
  /** The neighborhood it's usually meant as. */
  slug: NeighborhoodSlug;
  /** Every neighborhood it covers, `slug` first. */
  slugs: readonly NeighborhoodSlug[];
};

/**
 * Every name for every neighborhood, each once (case-insensitive): DataSF
 * names, their parts ("Castro/Upper Market" is also "Castro" and "Upper
 * Market"), short names ("SoMa") and everyday names.
 */
export const NEIGHBORHOOD_NAMES: readonly NeighborhoodName[] = (() => {
  const seen = new Set<string>();
  const out: NeighborhoodName[] = [];
  const add = (name: string, slugs: readonly NeighborhoodSlug[]) => {
    const text = name.trim();
    const key = text.toLowerCase();
    const [slug] = slugs;
    if (!slug || text.length < 3 || seen.has(key)) return;
    seen.add(key);
    out.push({ name: text, slug, slugs });
  };
  for (const n of SF_NEIGHBORHOODS) {
    add(n.name, [n.slug]);
    if ("short" in n) add(n.short, [n.slug]);
    if (n.name.includes("/")) for (const part of n.name.split("/")) add(part, [n.slug]);
  }
  for (const [name, ...slugs] of EVERYDAY_NAMES) add(name, slugs);
  return out;
})();

/** Lowercase, without a leading "the", punctuation or the difference between spaces and hyphens. */
export function normalizeNeighborhoodQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the(?:\s+|$)/, "")
    .replace(/\s+district$/, "");
}

const SEARCHABLE = NEIGHBORHOOD_NAMES.map((n) => ({
  ...n,
  key: normalizeNeighborhoodQuery(n.name),
}));

/**
 * The neighborhoods a search box query finds, by any of their names: "the
 * Richmond" finds the Inner and Outer Richmond, "dogpatch" Potrero Hill. Null
 * for an empty query (everything matches).
 */
export function searchNeighborhoods(query: string): ReadonlySet<string> | null {
  const q = normalizeNeighborhoodQuery(query);
  if (!q) return null;
  return new Set(SEARCHABLE.filter((n) => n.key.includes(q)).flatMap((n) => n.slugs));
}
