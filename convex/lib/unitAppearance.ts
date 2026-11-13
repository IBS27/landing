import { type Infer, v } from "convex/values";

export const xyz = v.object({ x: v.number(), y: v.number(), z: v.number() });
export const finish = v.object({
  id: v.string(),
  color: v.string(),
  pattern: v.union(
    ...["plain", "plaster", "wood", "tile", "carpet", "fabric", "stone", "metal", "glass"].map(
      (s) => v.literal(s),
    ),
  ),
  roughness: v.number(),
  // Physical repeat size in meters, independent of the mesh dimensions.
  repeat: v.number(),
});
/** One primitive of a fixture or item model (#150 reuses it for Marketplace item models). */
export const part = v.object({
  shape: v.union(v.literal("box"), v.literal("cylinder"), v.literal("sphere")),
  position: xyz,
  size: xyz,
  rotation: xyz,
  materialId: v.string(),
});
export const unitAppearance = v.object({
  materials: v.array(finish),
  surfaces: v.array(
    v.object({ targetId: v.string(), materialId: v.string(), sources: v.array(v.string()) }),
  ),
  objects: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      roomId: v.string(),
      position: xyz,
      rotation: v.number(),
      size: xyz,
      sources: v.array(v.string()),
      parts: v.array(part),
    }),
  ),
  notes: v.array(v.string()),
});
export type UnitAppearance = Infer<typeof unitAppearance>;
export type Finish = Infer<typeof finish>;
export type ObservedObject = UnitAppearance["objects"][number];
export type Part = Infer<typeof part>;

/** Bounded data only: no shader source, executable code, arbitrary assets or model-provided URLs. */
export function appearanceProblems(
  appearance: UnitAppearance,
  scene: { rooms: { id: string }[]; walls: { id: string }[] },
  sourceKeys?: string[],
) {
  const { materials, surfaces, objects, notes } = appearance;
  if (
    materials.length > 64 ||
    surfaces.length > 184 ||
    objects.length > 64 ||
    objects.some((o) => o.parts.length > 64) ||
    objects.reduce((n, o) => n + o.parts.length, 0) > 640
  )
    return ["Appearance exceeds geometry limits"];
  const errors: string[] = [];
  const finite = (n: number, min: number, max: number) =>
    Number.isFinite(n) && n >= min && n <= max;
  const vector = (p: { x: number; y: number; z: number }, min: number, max: number) =>
    [p.x, p.y, p.z].every((n) => finite(n, min, max));
  const ids = new Set<string>();
  for (const item of [...materials, ...objects]) {
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(item.id) || ids.has(item.id))
      errors.push("Invalid appearance ID");
    ids.add(item.id);
  }
  const materialIds = new Set(materials.map((m) => m.id));
  for (const m of materials)
    if (
      !/^#[0-9a-f]{6}$/i.test(m.color) ||
      !finite(m.roughness, 0, 1) ||
      !finite(m.repeat, 0.02, 5)
    )
      errors.push(`${m.id}: invalid material`);
  const cited = (sources: string[]) =>
    sources.length > 0 &&
    sources.length <= 20 &&
    sources.every((key) => key.length <= 80 && (!sourceKeys || sourceKeys.includes(key)));
  const targets = new Set([...scene.rooms, ...scene.walls].map((x) => x.id));
  const assigned = new Set<string>();
  for (const s of surfaces) {
    if (
      !targets.has(s.targetId) ||
      assigned.has(s.targetId) ||
      !materialIds.has(s.materialId) ||
      !cited(s.sources)
    )
      errors.push(`${s.targetId}: invalid surface reference or evidence`);
    assigned.add(s.targetId);
  }
  for (const o of objects) {
    if (
      !o.label.trim() ||
      o.label.length > 120 ||
      !scene.rooms.some((r) => r.id === o.roomId) ||
      !vector(o.position, -100, 100) ||
      !vector(o.size, 0.01, 15) ||
      !finite(o.rotation, -Math.PI * 2, Math.PI * 2) ||
      !cited(o.sources) ||
      !o.parts.length
    )
      errors.push(`${o.id}: invalid object or evidence`);
    for (const p of o.parts) {
      if (
        !materialIds.has(p.materialId) ||
        !vector(p.size, 0.001, 15) ||
        !vector(p.position, -15, 15) ||
        !vector(p.rotation, -Math.PI * 2, Math.PI * 2)
      )
        errors.push(`${o.id}: invalid part`);
      const [hx, hy, hz] = partExtents(p);
      // Relative rounding allowance stays invariant when the user calibrates the unit's scale.
      const tolerance = 0.01 * Math.max(o.size.x, o.size.y, o.size.z);
      if (
        Math.abs(p.position.x) + hx > o.size.x / 2 + tolerance ||
        p.position.y - hy < -tolerance ||
        p.position.y + hy > o.size.y + tolerance ||
        Math.abs(p.position.z) + hz > o.size.z / 2 + tolerance
      )
        errors.push(`${o.id}: part outside object bounds`);
    }
  }
  if (notes.length > 12 || notes.some((n) => n.length > 500))
    errors.push("Appearance notes exceed limits");
  return [...new Set(errors)].slice(0, 30);
}

/** Exact support of each scaled primitive after its XYZ Euler rotation. */
export function partExtents(p: Part) {
  const cx = Math.cos(p.rotation.x),
    sx = Math.sin(p.rotation.x);
  const cy = Math.cos(p.rotation.y),
    sy = Math.sin(p.rotation.y);
  const cz = Math.cos(p.rotation.z),
    sz = Math.sin(p.rotation.z);
  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ].map(([x, y, z]) => {
    const a = (x * p.size.x) / 2,
      b = (y * p.size.y) / 2,
      c = (z * p.size.z) / 2;
    return p.shape === "sphere"
      ? Math.hypot(a, b, c)
      : p.shape === "cylinder"
        ? Math.hypot(a, c) + Math.abs(b)
        : Math.abs(a) + Math.abs(b) + Math.abs(c);
  });
}
