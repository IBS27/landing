import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type Ref, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlwaysStencilFunc,
  BackSide,
  Color,
  DoubleSide,
  type Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  Path,
  ReplaceStencilOp,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
} from "three";
import { fitModel, type ItemModel, proxyModel } from "../../../../convex/lib/itemModel";
import type { Placement } from "../../../../convex/lib/unitScene";
import { PartMesh } from "./UnitDetails";
import { useFinishMaterials } from "./UnitMaterials";

export type ItemLook = "idle" | "hover" | "selected";
/** "arrive": settle in when first shown and when the model changes. "swap": only when it changes. */
export type ItemSettle = "none" | "swap" | "arrive";
export type ItemShape = Pick<
  Placement,
  "kind" | "x" | "z" | "y" | "rotation" | "width" | "depth" | "height" | "color"
>;

const ACCENT = "#0866ff";
const WARNING = "#e8912d";
const WHITE = new Color("#ffffff");

/**
 * One placed item, in the editor and in Landing Home's Apartment tab (#150):
 * Muse's model of the listing when there is one, else the stand-in shape for
 * its kind (`proxyModel`), stretched to the placement's size and lifted by its
 * `y`. The origin is the centre of the footprint on the item's base; the back
 * is at −z. A model with `photo` shows the listing's first photo on that face
 * of its first part.
 */
export function ItemMesh({
  item: p,
  model,
  photo,
  look = "idle",
  warn = false,
  settle = "none",
  ref,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: {
  item: ItemShape;
  /** The stored model (any size: it is fitted here). Null or absent draws the stand-in. */
  model?: ItemModel | null;
  /** The listing's first photo, for a model with a photo face. */
  photo?: string | null;
  look?: ItemLook;
  /** The placement has a problem: the selection ring and outline turn amber. */
  warn?: boolean;
  settle?: ItemSettle;
  /** The group that carries the item's position and yaw (a drag moves it directly). */
  ref?: Ref<Group>;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  // Query results are new objects on every update: key the model by its content.
  const key = useMemo(() => JSON.stringify(model ?? null), [model]);
  const stored = useMemo(() => JSON.parse(key) as ItemModel | null, [key]);
  const fitted = useMemo(() => {
    const size = { width: p.width, depth: p.depth, height: p.height };
    return stored?.parts.length
      ? fitModel(stored, size)
      : proxyModel(p.kind, size, /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#b9ab98");
  }, [stored, p.kind, p.width, p.depth, p.height, p.color]);
  const materials = useFinishMaterials(fitted.materials);
  const face = fitted.photo && photo && fitted.parts[0]?.shape === "box" ? fitted.photo : null;
  const picture = usePhoto(face ? (photo ?? null) : null);
  const pictureMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        roughness: 0.8,
        transparent: true,
        opacity: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  useEffect(() => () => pictureMaterial.dispose(), [pictureMaterial]);

  const lit = look !== "idle";
  const color = warn ? WARNING : ACCENT;
  useEffect(() => {
    for (const m of [...materials.values(), pictureMaterial]) {
      m.emissive.copy(WHITE);
      m.emissiveIntensity = look === "selected" ? 0.05 : look === "hover" ? 0.035 : 0;
      // The outline hull is drawn only where the item itself isn't (see `outline`).
      m.stencilWrite = lit;
      m.stencilRef = 1;
      m.stencilFunc = AlwaysStencilFunc;
      m.stencilZPass = ReplaceStencilOp;
    }
    invalidate();
  }, [materials, pictureMaterial, look, lit, invalidate]);

  const size = useThree((s) => s.size);
  const outline = useMemo(() => (lit ? outlineMaterial() : null), [lit]);
  useEffect(() => () => outline?.dispose(), [outline]);
  useEffect(() => {
    if (!outline) return;
    outline.uniforms.color.value.set(color);
    outline.uniforms.thickness.value = look === "selected" ? 2.5 : 2;
    outline.uniforms.opacity.value = look === "selected" ? 1 : 0.6;
    outline.uniforms.size.value.set(size.width, size.height);
    invalidate();
  }, [outline, color, look, size, invalidate]);

  // Settle: a new item drops in, and a stand-in that becomes Muse's model eases instead of popping.
  const body = useRef<Group>(null);
  const settling = useRef<{ start: number; arrive: boolean } | null>(null);
  const shown = useRef<string | null>(null);
  useLayoutEffect(() => {
    const first = shown.current === null;
    if (shown.current === key) return;
    shown.current = key;
    if (settle === "none" || (first && settle !== "arrive")) return;
    settling.current = { start: performance.now(), arrive: first };
    body.current?.scale.setScalar(first ? 0.82 : 0.94);
    invalidate();
  }, [key, settle, invalidate]);
  const fade = useRef(0);
  useFrame((_, dt) => {
    if (picture.texture && fade.current < 1) {
      // The photo fades in over the flat colour.
      fade.current = settle === "none" ? 1 : Math.min(1, fade.current + dt / 0.25);
      pictureMaterial.opacity = fade.current;
      if (fade.current < 1) invalidate();
      else {
        pictureMaterial.transparent = false;
        pictureMaterial.needsUpdate = true;
      }
    }
    const s = settling.current,
      g = body.current;
    if (!s || !g) return;
    const t = Math.min(1, (performance.now() - s.start) / (s.arrive ? 560 : 320));
    // Ease out with a slight overshoot, so the item settles rather than stops.
    const back = s.arrive ? 1.4 : 0;
    const e = 1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2;
    const from = s.arrive ? 0.82 : 0.94;
    g.scale.setScalar(from + (1 - from) * e);
    g.position.y = s.arrive ? Math.max(0, 1 - e) * 0.2 : 0;
    if (t >= 1) settling.current = null;
    else invalidate();
  });
  useEffect(() => {
    if (!picture.texture) return;
    fade.current = 0;
    pictureMaterial.map = picture.texture;
    pictureMaterial.opacity = 0;
    pictureMaterial.transparent = true;
    pictureMaterial.needsUpdate = true;
    invalidate();
  }, [picture.texture, pictureMaterial, invalidate]);

  const first = fitted.parts[0];
  const top = face === "top";
  const faceWidth = first?.size.x ?? 1,
    faceHeight = (top ? first?.size.z : first?.size.y) ?? 1;
  useEffect(() => {
    if (picture.texture) cover(picture.texture, faceWidth / faceHeight);
    invalidate();
  }, [picture.texture, faceWidth, faceHeight, invalidate]);

  const wall = (p.y ?? 0) > 0;
  return (
    <group
      ref={ref}
      position={[p.x, p.y ?? 0, p.z]}
      rotation={[0, p.rotation, 0]}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <group ref={body}>
        {fitted.parts.map((part, i) => (
          <PartMesh key={i} part={part} material={materials.get(part.materialId)}>
            {outline && <Hull material={outline} />}
          </PartMesh>
        ))}
        {face && first && picture.texture && (
          <mesh
            position={
              top
                ? [first.position.x, first.position.y + first.size.y / 2 + 0.0015, first.position.z]
                : [first.position.x, first.position.y, first.position.z + first.size.z / 2 + 0.0015]
            }
            rotation={top ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
            material={pictureMaterial}
            receiveShadow
          >
            <planeGeometry args={[faceWidth, faceHeight]} />
          </mesh>
        )}
      </group>
      {look === "selected" && (
        <Ring
          width={p.width}
          depth={wall ? p.height : p.depth}
          color={color}
          position={wall ? [0, p.height / 2, -p.depth / 2 + 0.004] : [0, 0.028, 0]}
          rotation={wall ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
        />
      )}
    </group>
  );
}

const none = () => null;

/** The outline's hull for one part: the part's own geometry, drawn with the outline material. */
function Hull({ material }: { material: Material }) {
  const ref = useRef<Mesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (mesh && mesh.parent instanceof Mesh) mesh.geometry = mesh.parent.geometry;
  });
  // The geometry and material belong to the part and the item: never disposed from here.
  return <mesh ref={ref} material={material} renderOrder={10} raycast={none} dispose={null} />;
}

/** A soft rounded frame around the footprint (or, for something on a wall, behind it). */
function Ring({
  width,
  depth,
  color,
  position,
  rotation,
}: {
  width: number;
  depth: number;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const { line, fill } = useMemo(() => {
    const gap = 0.09,
      stroke = 0.022;
    const rounded = <T extends Path>(path: T, inset: number) => {
      const w = width + (gap - inset) * 2,
        d = depth + (gap - inset) * 2,
        r = Math.min(0.12 - inset, w / 2, d / 2);
      path.moveTo(-w / 2 + r, -d / 2);
      path.lineTo(w / 2 - r, -d / 2);
      path.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
      path.lineTo(w / 2, d / 2 - r);
      path.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
      path.lineTo(-w / 2 + r, d / 2);
      path.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
      path.lineTo(-w / 2, -d / 2 + r);
      path.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
      return path;
    };
    const outer = rounded(new Shape(), 0);
    const band = rounded(new Shape(), 0);
    band.holes.push(rounded(new Path(), stroke));
    return { line: new ShapeGeometry(band, 8), fill: new ShapeGeometry(outer, 8) };
  }, [width, depth]);
  useEffect(
    () => () => {
      line.dispose();
      fill.dispose();
    },
    [line, fill],
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={fill} raycast={none} renderOrder={2}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={line} raycast={none} position={[0, 0, 0.001]} renderOrder={3}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * The silhouette outline of a selected or hovered item: each part's back
 * faces, pushed out along the normal by a few screen pixels and drawn only
 * where the item's own parts aren't (they write the stencil), so the outline
 * goes round the whole item and not round every part.
 */
function outlineMaterial() {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(ACCENT) },
      thickness: { value: 2 },
      opacity: { value: 1 },
      size: { value: new Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      uniform float thickness;
      uniform vec2 size;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 out_ = projectionMatrix * modelViewMatrix * vec4(normal, 0.0);
        float len = length(out_.xy);
        if (len > 1e-6) clip.xy += out_.xy / len * thickness * 2.0 / size * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      void main() {
        gl_FragColor = vec4(color, opacity);
        #include <colorspace_fragment>
      }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: NotEqualStencilFunc,
  });
}

/** Crops a texture to a face's aspect ratio (cover-fit), so the photo is never stretched. */
function cover(texture: Texture, aspect: number) {
  const image = texture.image as { width?: number; height?: number } | null;
  const ratio = image?.width && image.height ? image.width / image.height : 1;
  const x = ratio > aspect ? aspect / ratio : 1,
    y = ratio > aspect ? 1 : ratio / aspect;
  texture.repeat.set(x, y);
  texture.offset.set((1 - x) / 2, (1 - y) / 2);
}

/** Loads a listing photo as a colour texture. A missing or failed photo gives none: the face stays flat. */
function usePhoto(url: string | null) {
  const [state, setState] = useState<{ url: string; texture: Texture } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    let loaded: Texture | null = null;
    new TextureLoader().load(
      url,
      (t) => {
        if (!live) return t.dispose();
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 8;
        loaded = t;
        setState({ url, texture: t });
      },
      undefined,
      () => undefined,
    );
    return () => {
      live = false;
      loaded?.dispose();
    };
  }, [url]);
  return { texture: url && state?.url === url ? state.texture : null };
}
