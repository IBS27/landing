import { NEIGHBORHOOD_PLACES } from "../seed/world/neighborhoods/places";
import type { LatLng } from "./geo";
import { normalize } from "./interests";
import type { NeighborhoodSlug } from "./neighborhoods";

/**
 * #15's place list: every place the neighborhood Group threads name, located
 * with OpenStreetMap. It is the only source of coordinates for places found in
 * threads (#18's Weekend Route): free text from a thread is never geocoded.
 */
export type Place = {
  key: string;
  name: string;
  kind: string;
  neighborhood: NeighborhoodSlug;
  point: LatLng;
  /** Short forms locals use ("the Owl"). */
  aliases: readonly string[];
};

const PLACES: readonly Place[] = NEIGHBORHOOD_PLACES.map((p) => ({
  key: p.key,
  name: p.name,
  kind: p.kind,
  neighborhood: p.neighborhood,
  point: p.point,
  aliases: p.aliases ?? [],
}));
const BY_KEY = new Map(PLACES.map((p) => [p.key, p]));

export function placeByKey(key: string): Place | undefined {
  return BY_KEY.get(key);
}

/** The places a neighborhood's threads talk about. */
export function placesIn(slug: string): Place[] {
  return PLACES.filter((p) => p.neighborhood === slug);
}

type Named = Pick<Place, "name" | "aliases">;

/** A place's name and aliases, normalized, without a leading "the". */
function phrases(p: Named): string[] {
  return [...new Set([p.name, ...p.aliases].map((s) => normalize(s).replace(/^the /, "")))].filter(
    Boolean,
  );
}

const padded = (text: string) => ` ${normalize(text)} `;

/** Whether `text` names the place, by name or alias, as whole words. */
export function mentions(text: string, place: Named): boolean {
  const t = padded(text);
  return phrases(place).some((ph) => t.includes(` ${ph} `));
}

/** The places `text` names, in list order. */
export function placesMentioned<P extends Named>(text: string, places: readonly P[]): P[] {
  const t = padded(text);
  return places.filter((p) => phrases(p).some((ph) => t.includes(` ${ph} `)));
}

/** The place whose name or an alias is exactly `name` ("Kumo" → Kumo Ramen Bar). */
export function placeNamed<P extends Named>(name: string, places: readonly P[]): P | undefined {
  const n = normalize(name).replace(/^the /, "");
  return places.find((p) => phrases(p).includes(n));
}
