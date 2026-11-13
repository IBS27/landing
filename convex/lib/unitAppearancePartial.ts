import { canonicalJson } from "../ai/outputSchema";
import type { UnitAppearance } from "./unitAppearance";
import { sceneProblems, type UnitScene } from "./unitScene";

function usedMaterials(appearance: UnitAppearance) {
  const ids = new Set([
    ...appearance.surfaces.map((s) => s.materialId),
    ...appearance.objects.flatMap((o) => o.parts.map((p) => p.materialId)),
  ]);
  return appearance.materials.filter((m) => ids.has(m.id));
}

/** How `omitted` names a dropped finish; a dropped fixture is `<label>: <problem>`. */
const SURFACE = "surface ";
const OVER_LIMITS = "Additional details exceeded the scene limits";
/** The fixtures and finishes in an `omitted` list, counted apart (#153). */
export function omittedCounts(omitted: string[]) {
  const surfaces = omitted.filter((o) => o.startsWith(SURFACE) && !o.includes(": ")).length;
  const fixtures = omitted.filter((o) => o !== OVER_LIMITS).length - surfaces;
  return { fixtures, surfaces };
}

/** Keep only independently valid evidence; never resize or move a fixture to hide an error. */
export function retainValidAppearance(
  scene: UnitScene,
  appearance: UnitAppearance,
  keys: string[],
  previous?: UnitAppearance,
) {
  const valid = (value: UnitAppearance) => sceneProblems({ ...scene, appearance: value }, keys);
  if (!previous && !valid(appearance).length)
    return {
      appearance: { ...appearance, materials: usedMaterials(appearance) },
      omitted: [] as string[],
    };
  const kept: UnitAppearance = previous
    ? structuredClone(previous)
    : { materials: [], surfaces: [], objects: [], notes: [] };
  kept.materials = usedMaterials(kept);
  // Retry adds missing details. Existing fixtures and finishes remain authoritative.
  const materialIds = new Map<string, string>();
  const reserved = new Set(
    [...kept.materials, ...kept.objects, ...appearance.materials, ...appearance.objects].map(
      (item) => item.id,
    ),
  );
  const omitted: string[] = [];
  const incomingMaterials: UnitAppearance["materials"] = [];
  for (const material of appearance.materials.slice(0, 64)) {
    const existing = kept.materials.find((m) => m.id === material.id);
    if (existing && canonicalJson(existing) === canonicalJson(material)) continue;
    let id = material.id;
    if (existing || kept.objects.some((o) => o.id === id)) {
      let suffix = 1;
      do {
        id = `${material.id.slice(0, 48)}-retry-${suffix++}`;
      } while (reserved.has(id));
      reserved.add(id);
      materialIds.set(material.id, id);
    }
    incomingMaterials.push({ ...material, id });
  }
  // Commit a detail and its material dependencies together, or keep neither.
  const withMaterials = (next: UnitAppearance) => ({
    ...next,
    materials: usedMaterials({
      ...next,
      materials: [
        ...kept.materials,
        ...incomingMaterials.filter((m) => !kept.materials.some((k) => k.id === m.id)),
      ],
    }),
  });
  for (const surface of appearance.surfaces.slice(0, 184)) {
    if (kept.surfaces.some((s) => s.targetId === surface.targetId)) continue;
    const incoming = {
      ...surface,
      materialId: materialIds.get(surface.materialId) ?? surface.materialId,
    };
    const next = withMaterials({ ...kept, surfaces: [...kept.surfaces, incoming] });
    if (!valid(next).length) {
      kept.surfaces.push(incoming);
      kept.materials = next.materials;
    } else omitted.push(`${SURFACE}${surface.targetId}`);
  }
  for (const object of appearance.objects.slice(0, 64)) {
    if (kept.objects.some((o) => o.id === object.id)) continue;
    const incoming = {
      ...object,
      parts: object.parts.map((part) => ({
        ...part,
        materialId: materialIds.get(part.materialId) ?? part.materialId,
      })),
    };
    const next = withMaterials({ ...kept, objects: [...kept.objects, incoming] });
    const errors = valid(next);
    if (!errors.length) {
      kept.objects.push(incoming);
      kept.materials = next.materials;
    } else omitted.push(`${object.label}: ${errors[0]}`.slice(0, 400));
  }
  if (
    appearance.materials.length > 64 ||
    appearance.surfaces.length > 184 ||
    appearance.objects.length > 64
  )
    omitted.push(OVER_LIMITS);
  kept.notes = appearance.notes.filter((n) => n.length <= 500).slice(0, 6);
  if (omitted.length) {
    kept.notes.push(
      `${omitted.length} details omitted because their geometry or evidence could not be validated.`,
    );
    kept.notes.push(...omitted.slice(0, 5).map((n) => `Omitted: ${n}`));
  }
  return { appearance: kept.objects.length || kept.surfaces.length ? kept : null, omitted };
}
