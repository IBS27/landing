import type { Doc } from "../_generated/dataModel";
import { canonicalJson } from "../ai/outputSchema";
import { rentalSources } from "./rentalMedia";
import { MAX_SOURCES, manualScene, type SceneSource, type UnitScene } from "./unitScene";

/** Legacy starter scenes have no measured or inferred geometry. */
export function isStarterScene(scene: UnitScene) {
  return canonicalJson(scene) === canonicalJson(manualScene(4, 5, scene.title));
}

export function listingSources(listing: Doc<"listings">): SceneSource[] {
  const sources: SceneSource[] = listing.rentalMedia
    ? rentalSources(listing.rentalMedia)
    : listing.photos.slice(0, 18).map((url, i) => ({
        key: `photo-${i + 1}`,
        kind: "photo",
        label: `Photo ${i + 1}`,
        url,
      }));
  if (listing.video)
    sources.push({
      key: "listing-video",
      kind: "video",
      label: "Listing video",
      url: listing.video.url,
    });
  return sources.map((source) => ({ ...source, imported: true }));
}

export function refreshedSources(sources: SceneSource[], listing: Doc<"listings">) {
  // Before provenance existed, create() reserved these keys; UI uploads use source-*.
  const personal = sources.filter(
    (s) =>
      !s.imported &&
      (s.imported === false || s.storageId || !/^(floorplan|photo-\d+|listing-video)$/.test(s.key)),
  );
  const keys = new Set(personal.map((s) => s.key));
  const imported = listingSources(listing).filter((s) => !keys.has(s.key));
  return [...imported.slice(0, MAX_SOURCES - personal.length), ...personal];
}

/** A room's scan photos as sources, keyed by their file so a key keeps naming the same photo. */
export function roomSources(room: Doc<"rooms">): SceneSource[] {
  return room.photos.slice(0, 18).map((p, i) => ({
    key: p.storageId ? `room-${p.storageId}` : `room-photo-${i + 1}`,
    kind: "photo",
    label: `Photo ${i + 1}`,
    url: p.url,
    ...(p.storageId ? { storageId: p.storageId } : {}),
    imported: true,
  }));
}

/**
 * A room unit's sources with the room's current photos: what the person added
 * in the unit itself stays, and the room photos it was made from (from before
 * provenance too: `photo-N`) are replaced by the room's scan as it is now.
 */
export function refreshedRoomSources(sources: SceneSource[], room: Doc<"rooms">) {
  const personal = sources.filter((s) => s.imported === false || s.key.startsWith("source-"));
  return [...roomSources(room).slice(0, MAX_SOURCES - personal.length), ...personal];
}

/** Snapshot only evidence cited by saved geometry, independently of current generation inputs. */
export function savedSceneSources(scene: UnitScene, sources: SceneSource[]) {
  const keys = new Set([
    ...scene.rooms.flatMap((room) => room.evidence.sources),
    ...scene.walls.flatMap((wall) => wall.evidence.sources),
    ...(scene.appearance?.surfaces.flatMap((surface) => surface.sources) ?? []),
    ...(scene.appearance?.objects.flatMap((object) => object.sources) ?? []),
  ]);
  return sources.filter(
    (source, i) =>
      keys.has(source.key) && sources.findIndex((other) => other.key === source.key) === i,
  );
}
