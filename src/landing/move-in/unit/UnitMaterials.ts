import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  DataTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";
import type { Finish, UnitAppearance } from "../../../../convex/lib/unitAppearance";

/** Procedural detail is a rendering approximation, not recovered photographic texture. */
function texture(pattern: string, repeat: number, bump: boolean) {
  const n = 256,
    data = new Uint8Array(n * n * 4);
  const noise = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / n,
        w = y / n,
        grain = noise(x, y);
      let value = 0.5;
      if (pattern === "wood") {
        value = 0.5 + 0.2 * Math.sin(u * 130 + Math.sin(w * Math.PI * 2) * 3) + grain * 0.12;
        if (x % 64 < 2 || (y + Math.floor(x / 64) * 83) % 256 < 2) value = 0.12;
      } else if (pattern === "tile") {
        value = x < 3 || y < 3 ? 0.12 : 0.8 + grain * 0.1;
      } else if (pattern === "fabric") {
        value =
          0.4 + 0.18 * (Math.sin((x * Math.PI) / 2) + Math.cos((y * Math.PI) / 2)) + grain * 0.15;
      } else if (pattern === "stone") {
        value = 0.5 + 0.16 * Math.sin(u * 12 + Math.sin(w * 8) * 4) + grain * 0.2;
      } else value = grain;
      const c = Math.round(bump ? value * 255 : 235 + value * 20);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = c;
      data[i + 3] = 255;
    }
  const map = new DataTexture(data, n, n, RGBAFormat);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(1 / repeat, 1 / repeat);
  if (!bump) map.colorSpace = SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}
function material(finish: Finish) {
  const detailed = !["plain", "metal", "glass"].includes(finish.pattern);
  const m = new MeshStandardMaterial({
    color: finish.color,
    roughness: finish.roughness,
    metalness: finish.pattern === "metal" ? 0.75 : 0,
    transparent: finish.pattern === "glass",
    opacity:
      finish.pattern === "glass"
        ? 1 - new Color(finish.color).getHSL({ h: 0, s: 0, l: 0 }).l * 0.8
        : 1,
    ...(detailed
      ? {
          map: texture(finish.pattern, finish.repeat, false),
          bumpMap: texture(finish.pattern, finish.repeat, true),
          bumpScale:
            finish.pattern === "carpet" || finish.pattern === "fabric"
              ? 0.0015
              : finish.pattern === "plaster"
                ? 0.00015
                : 0.001,
        }
      : {}),
  });
  return m;
}
export function useUnitMaterials(appearance?: UnitAppearance) {
  const materials = useMemo(
    () => new Map((appearance?.materials ?? []).map((f) => [f.id, material(f)])),
    [appearance],
  );
  useEffect(
    () => () => {
      for (const m of materials.values()) {
        m.map?.dispose();
        m.bumpMap?.dispose();
        m.dispose();
      }
    },
    [materials],
  );
  return materials;
}
/** Box/shape UVs in meters keep floor tile and grain sizes consistent across surfaces. */
export function physicalUvs<T extends BufferGeometry>(geometry: T): T {
  const p = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(normal.getX(i)),
      y = Math.abs(normal.getY(i)),
      z = Math.abs(normal.getZ(i));
    uv[2 * i] = x > y && x > z ? p.getZ(i) : p.getX(i);
    uv[2 * i + 1] = y > x && y > z ? p.getZ(i) : p.getY(i);
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}
