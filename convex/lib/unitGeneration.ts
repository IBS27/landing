import type { Doc } from "../_generated/dataModel";
import { canonicalJson } from "../ai/outputSchema";
import { rentalSources } from "./rentalMedia";
import type { UnitAppearance } from "./unitAppearance";
import { omittedCounts } from "./unitAppearancePartial";
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

/** What the person is told when a build ends without a layout (#153). */
export const NO_LAYOUT_NOTE = "The layout couldn't be read from the photos.";
/** What they are told when its layout got no finishes or fixtures at all. */
export const NO_DETAILS_NOTE = "Finishes and fixtures couldn't be added.";

/**
 * Whether a build that has its layout is finished (#153), judged on the
 * finishes and fixtures the scene now holds and what the details pass dropped
 * in validation (`omitted`). Dropping a few is normal: real passes lose about
 * a quarter to a third of their fixtures to the doorway and bounds checks (4
 * of 18, 4 of 12) and none of their finishes, and the appearance notes already
 * list them for the editor. So a build is `partial` only when it has no
 * finishes or fixtures at all, or kept fewer than half of the fixtures, or of
 * the finishes, it tried: then rooms look bare and trying again can help.
 * Fixtures and finishes are counted apart because finishes almost never fail
 * and would otherwise hide a pass that lost every fixture. The note is one
 * sentence written here, never the model's words, and short enough for one
 * line of the Apartment tab's status pill beside its actions.
 */
export function buildOutcome(
  appearance: UnitAppearance | null | undefined,
  omitted: string[] = [],
): { status: "ready" | "partial"; note: string | null } {
  if (!appearance || !(appearance.objects.length || appearance.surfaces.length))
    return { status: "partial", note: NO_DETAILS_NOTE };
  const dropped = omittedCounts(omitted);
  const fixtures = dropped.fixtures > appearance.objects.length;
  const finishes = dropped.surfaces > appearance.surfaces.length;
  const note =
    fixtures && finishes
      ? "Most finishes and fixtures couldn't be added."
      : fixtures
        ? "Most fixtures couldn't be placed."
        : finishes
          ? "Most finishes couldn't be added."
          : null;
  return { status: note ? "partial" : "ready", note };
}

/**
 * Whether a unit's stored build still counts as partial (#153). Builds from
 * before the rule above were stored `partial` whenever one detail was dropped
 * and carry no note: those go by what the scene holds, so an apartment whose
 * finishes landed reads as finished everywhere.
 */
export function buildIsPartial({
  generation,
  scene,
}: Pick<Doc<"unitScenes">, "generation" | "scene">) {
  if (generation?.status !== "partial") return false;
  const has = scene.appearance;
  return generation.note !== undefined || !has || !(has.objects.length || has.surfaces.length);
}
