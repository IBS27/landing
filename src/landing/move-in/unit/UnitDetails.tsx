import { useMemo } from "react";
import { BoxGeometry, CylinderGeometry, type Material, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ObservedObject } from "../../../../convex/lib/unitAppearance";
import { along, distance, type Wall } from "../../../../convex/lib/unitScene";
import { physicalUvs } from "./UnitMaterials";

export function Solid({
  size,
  position,
  rotation,
  color = "#f0ede6",
  material,
  rounded = 0.004,
}: {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  material?: Material;
  rounded?: number;
}) {
  const [x, y, z] = size;
  const geometry = useMemo(
    () =>
      physicalUvs(
        rounded > 0
          ? new RoundedBoxGeometry(x, y, z, 2, Math.min(rounded, x / 4, y / 4, z / 4))
          : new BoxGeometry(x, y, z),
      ),
    [x, y, z, rounded],
  );
  return (
    <mesh
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    >
      {!material && <meshStandardMaterial color={color} roughness={0.65} />}
    </mesh>
  );
}
export function ObservedFixture({
  object,
  materials,
}: {
  object: ObservedObject;
  materials: Map<string, Material>;
}) {
  const p = object.position;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, object.rotation, 0]}>
      {object.parts.map((part, i) => (
        <Part key={i} part={part} material={materials.get(part.materialId)} />
      ))}
    </group>
  );
}
function Part({ part, material }: { part: ObservedObject["parts"][number]; material?: Material }) {
  const { size: s, position: p, rotation: r } = part;
  const roundGeometry = useMemo(() => {
    if (part.shape === "box") return undefined;
    const g =
      part.shape === "cylinder"
        ? new CylinderGeometry(0.5, 0.5, 1, 20)
        : new SphereGeometry(0.5, 20, 12);
    g.scale(s.x, s.y, s.z);
    return g;
  }, [part.shape, s.x, s.y, s.z]);
  return part.shape === "box" ? (
    <Solid
      size={[s.x, s.y, s.z]}
      position={[p.x, p.y, p.z]}
      rotation={[r.x, r.y, r.z]}
      material={material}
    />
  ) : (
    <mesh
      geometry={roundGeometry}
      material={material}
      position={[p.x, p.y, p.z]}
      rotation={[r.x, r.y, r.z]}
      castShadow
      receiveShadow
    />
  );
}
/** Standard trim profile is inferred; openings retain the evidence-backed geometry. */
export function WallTrim({ wall: w, cutaway }: { wall: Wall; cutaway: boolean }) {
  const length = distance(w.a, w.b),
    theta = -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x);
  const center = along(w, length / 2);
  const doorRanges = w.openings.filter((o) => o.bottom < 0.15).sort((a, b) => a.offset - b.offset);
  const strips: [number, number][] = [];
  let start = 0;
  for (const door of doorRanges) {
    if (door.offset > start) strips.push([start, door.offset]);
    start = door.offset + door.width;
  }
  if (start < length) strips.push([start, length]);
  return (
    <group position={[center.x, 0, center.z]} rotation={[0, theta, 0]}>
      {strips.map(([a, b], i) => (
        <Solid
          key={i}
          size={[b - a, 0.12, w.thickness + 0.035]}
          position={[(a + b - length) / 2, 0.06, 0]}
          rounded={0.003}
        />
      ))}
      {!cutaway &&
        w.openings.map((o, i) => (
          <group key={i} position={[o.offset + o.width / 2 - length / 2, o.bottom, 0]}>
            {[-1, 1].map((side) => (
              <Solid
                key={side}
                size={[0.055, o.height + 0.05, w.thickness + 0.045]}
                position={[side * (o.width / 2 - 0.02), o.height / 2, 0]}
              />
            ))}
            <Solid
              size={[o.width, 0.055, w.thickness + 0.045]}
              position={[0, o.height - 0.02, 0]}
            />
            {o.kind === "window" && (
              <>
                <Solid
                  size={[o.width + 0.08, 0.045, w.thickness + 0.14]}
                  position={[0, 0, -0.025]}
                />
                {o.width > 1.1 && (
                  <Solid size={[0.045, o.height, 0.06]} position={[0, o.height / 2, 0]} />
                )}
              </>
            )}
          </group>
        ))}
    </group>
  );
}
