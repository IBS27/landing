import type { UnitAppearance } from "./unitAppearance";
import { sceneProblems, type UnitScene } from "./unitScene";

/** Keep only independently valid evidence; never resize or move a fixture to hide an error. */
export function retainValidAppearance(
  scene: UnitScene,
  appearance: UnitAppearance,
  keys: string[],
) {
  const valid = (value: UnitAppearance) => sceneProblems({ ...scene, appearance: value }, keys);
  if (!valid(appearance).length) return { appearance, omitted: [] as string[] };
  const kept: UnitAppearance = { materials: [], surfaces: [], objects: [], notes: [] };
  const omitted: string[] = [];
  for (const material of appearance.materials.slice(0, 64)) {
    const next = { ...kept, materials: [...kept.materials, material] };
    if (!valid(next).length) kept.materials.push(material);
    else omitted.push(`material ${material.id}`);
  }
  for (const surface of appearance.surfaces.slice(0, 184)) {
    const next = { ...kept, surfaces: [...kept.surfaces, surface] };
    if (!valid(next).length) kept.surfaces.push(surface);
    else omitted.push(`surface ${surface.targetId}`);
  }
  for (const object of appearance.objects.slice(0, 64)) {
    const next = { ...kept, objects: [...kept.objects, object] };
    const errors = valid(next);
    if (!errors.length) kept.objects.push(object);
    else omitted.push(`${object.label}: ${errors[0]}`.slice(0, 400));
  }
  if (
    appearance.materials.length > 64 ||
    appearance.surfaces.length > 184 ||
    appearance.objects.length > 64
  )
    omitted.push("Additional details exceeded the scene limits");
  kept.notes = appearance.notes.filter((n) => n.length <= 500).slice(0, 6);
  if (omitted.length) {
    kept.notes.push(
      `${omitted.length} details omitted because their geometry or evidence could not be validated.`,
    );
    kept.notes.push(...omitted.slice(0, 5).map((n) => `Omitted: ${n}`));
  }
  return { appearance: kept.objects.length || kept.surfaces.length ? kept : null, omitted };
}
