import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  type Group,
  type Material,
  PerspectiveCamera,
  Shape,
  Vector2,
  Vector3,
} from "three";
import type { ItemModel } from "../../../../convex/lib/itemModel";
import type { UnitAppearance } from "../../../../convex/lib/unitAppearance";
import {
  along,
  canWalk,
  distance,
  inside,
  type Placement,
  roomCenter,
  type UnitScene,
  type Wall,
  wallParts,
} from "../../../../convex/lib/unitScene";
import { ItemMesh } from "./ItemMesh";
import { ObservedFixture, OpeningTrim, Solid, WallTrim } from "./UnitDetails";
import { UnitEffects } from "./UnitEffects";
import { useUnitMaterials } from "./UnitMaterials";

export type ViewMode = "dollhouse" | "walk" | "plan";
export type WalkInput = { forward: number; turn: number };
/** What is known about a placed item beyond its placement: Muse's model and the listing's photo. */
export type ItemAssets = { model?: ItemModel | null; photo?: string | null };
export function UnitCanvas({
  scene,
  placements,
  mode,
  roomId,
  selected,
  onSelect,
  input,
  details = true,
  cutaway = true,
  jobId,
  items,
}: {
  jobId?: string;
  /** Models and photos by placement id; without them every item is its kind's stand-in shape. */
  items?: ReadonlyMap<string, ItemAssets>;
  details?: boolean;
  cutaway?: boolean;
  scene: UnitScene;
  placements: Placement[];
  mode: ViewMode;
  roomId: string;
  selected: string | null;
  onSelect: (id: string) => void;
  input: React.RefObject<WalkInput>;
}) {
  const appearance = details ? scene.appearance : undefined;
  const walkingScene = useMemo(
    () => (details ? scene : { ...scene, appearance: undefined }),
    [scene, details],
  );
  const materials = useUnitMaterials(appearance);
  const points = scene.rooms.flatMap((r) => r.polygon);
  const x = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
  const z = (Math.min(...points.map((p) => p.z)) + Math.max(...points.map((p) => p.z))) / 2;
  const size = Math.max(5, ...points.map((p) => Math.hypot(p.x - x, p.z - z) * 2));
  return (
    <CanvasError jobId={jobId}>
      <Canvas
        shadows
        gl={{ stencil: true }}
        frameloop={mode === "walk" ? "always" : "demand"}
        dpr={[1, 1.5]}
        camera={{
          position: [x + size * 0.7, size * 0.85, z + size * 0.7],
          fov: 45,
          near: 0.05,
          far: 400,
        }}
      >
        <color attach="background" args={["#e8edf1"]} />
        <hemisphereLight args={["#fffaf2", "#b5ad9d", 0.9]} />
        <ambientLight intensity={0.15} />
        {appearance && (
          <Environment resolution={128} frames={1} environmentIntensity={0.4}>
            <Lightformer
              position={[x, 8, z]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[size, size, 1]}
              intensity={2}
            />
            <Lightformer
              position={[x - size, 3, z]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[size, 5, 1]}
              intensity={2}
            />
          </Environment>
        )}
        <directionalLight
          position={[x - 8, 18, z - 10]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-normalBias={0.015}
          shadow-bias={-0.0001}
          shadow-radius={3}
          shadow-camera-left={-size}
          shadow-camera-right={size}
          shadow-camera-top={size}
          shadow-camera-bottom={-size}
        />
        <UnitModel
          scene={scene}
          appearance={appearance}
          materials={materials}
          ceiling={mode === "walk"}
          lowered={mode === "dollhouse" && cutaway ? "all" : undefined}
        />
        {appearance && <UnitEffects />}
        {placements.map((p) => (
          <Furniture
            key={p.id}
            item={p}
            assets={items?.get(p.id)}
            selected={selected === p.id}
            onSelect={() => onSelect(p.id)}
          />
        ))}
        {mode === "walk" ? (
          <WalkCamera scene={walkingScene} placements={placements} roomId={roomId} input={input} />
        ) : (
          <>
            <Overview x={x} z={z} size={size} />
            <OrbitControls
              makeDefault
              target={[x, 0, z]}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={2}
              maxDistance={size * 3}
            />
          </>
        )}
      </Canvas>
    </CanvasError>
  );
}
/** Materials for floors and walls the scene's appearance doesn't cover, by their colour. */
export type SurfaceDefaults = {
  floor: (color: string) => Material | undefined;
  wall: (color: string) => Material | undefined;
};
/**
 * The unit itself, shared by the editor's canvas and Landing Home's Apartment
 * tab (#150): floors, walls with their openings, windows, trim and the
 * fixtures seen in the media. `lowered` walls are cut down to `cap` so the
 * rooms behind them show.
 */
export function UnitModel({
  scene,
  appearance,
  materials,
  defaults,
  ceiling = false,
  lowered,
  cap = 0.8,
  animate = false,
  trim = !!appearance,
  corners = false,
}: {
  scene: UnitScene;
  /** The finishes and fixtures to draw; left out, the plain layout. */
  appearance?: UnitAppearance;
  /** `useUnitMaterials(appearance)`. */
  materials: Map<string, Material>;
  defaults?: SurfaceDefaults;
  ceiling?: boolean;
  /** The walls to cut down: all of them, or these ids. */
  lowered?: "all" | ReadonlySet<string>;
  /** Height in metres a lowered wall is cut to. */
  cap?: number;
  /** Walls sink and rise smoothly as `lowered` changes, instead of being rebuilt. */
  animate?: boolean;
  /** Baseboards and window and door frames. */
  trim?: boolean;
  /** Walls run on by half their thickness at each end, so outside corners are closed. */
  corners?: boolean;
}) {
  const surface = (id: string) =>
    materials.get(appearance?.surfaces.find((s) => s.targetId === id)?.materialId ?? "");
  const top = Math.max(...scene.walls.map((w) => w.height), 2.4);
  return (
    <>
      {scene.rooms.map((room) => (
        <group key={room.id}>
          <Floor room={room} material={surface(room.id) ?? defaults?.floor(room.floorColor)} />
          {ceiling && <Floor room={room} ceiling={top} />}
        </group>
      ))}
      {scene.walls.map((w) => (
        <WallMesh
          key={w.id}
          wall={w}
          material={surface(w.id) ?? defaults?.wall(w.color)}
          lowered={lowered === "all" || !!lowered?.has(w.id)}
          cap={cap}
          animate={animate}
          trim={trim}
          corners={corners}
        />
      ))}
      {appearance?.objects.map((object) => (
        <ObservedFixture key={object.id} object={object} materials={materials} />
      ))}
    </>
  );
}
function WallMesh({
  wall: w,
  material,
  lowered,
  cap,
  animate,
  trim,
  corners,
}: {
  wall: Wall;
  material?: Material;
  lowered: boolean;
  cap: number;
  animate: boolean;
  trim: boolean;
  corners: boolean;
}) {
  const theta = -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x);
  const length = distance(w.a, w.b);
  const cut = Math.min(cap, w.height);
  const parts = wallParts(w);
  const run = corners ? w.thickness / 2 : 0;
  const solid = (part: (typeof parts)[number], bottom: number, top: number, key: number) => {
    if (bottom >= top) return null;
    const start = part.start <= 0.001 ? -run : part.start,
      end = part.end >= length - 0.001 ? length + run : part.end;
    const center = along(w, (start + end) / 2);
    return (
      <Solid
        key={key}
        size={[end - start, top - bottom, w.thickness]}
        position={[center.x, (bottom + top) / 2, center.z]}
        rotation={[0, theta, 0]}
        color={w.color}
        material={material}
        rounded={0}
      />
    );
  };
  const windows = w.openings
    .filter((o) => o.kind === "window")
    .map((o, i) => {
      const p = along(w, o.offset + o.width / 2);
      return (
        <mesh key={i} position={[p.x, o.bottom + o.height / 2, p.z]} rotation={[0, theta, 0]}>
          <boxGeometry args={[o.width, o.height, 0.025]} />
          <meshStandardMaterial color="#9dc7d6" transparent opacity={0.38} roughness={0.15} />
        </mesh>
      );
    });
  if (!animate) {
    const top = lowered ? cut : w.height;
    return (
      <group>
        {trim && <WallTrim wall={w} cutaway={top < w.height} />}
        {parts.map((part, i) => solid(part, part.bottom, Math.min(part.top, top), i))}
        {top === w.height && windows}
      </group>
    );
  }
  return (
    <group>
      {trim && <WallTrim wall={w} cutaway />}
      {parts.map((part, i) => solid(part, part.bottom, Math.min(part.top, cut), i))}
      {cut < w.height && (
        <Sinking down={lowered} y={cut}>
          {parts.map((part, i) => solid(part, Math.max(part.bottom, cut), part.top, i))}
          {trim && <OpeningTrim wall={w} />}
          {windows}
        </Sinking>
      )}
    </group>
  );
}
/** The part of a wall above the cut: it sinks into the cut when `down` and rises back. */
function Sinking({ down, y, children }: { down: boolean; y: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const level = useRef(down ? 0 : 1);
  const invalidate = useThree((s) => s.invalidate);
  const apply = () => {
    const g = ref.current;
    if (!g) return;
    g.scale.y = Math.max(level.current, 0.0001);
    g.visible = level.current > 0.001;
  };
  useLayoutEffect(apply);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change of `down` needs a frame to start moving.
  useEffect(() => invalidate(), [down, invalidate]);
  useFrame((_, dt) => {
    const target = down ? 0 : 1;
    if (level.current === target) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    level.current +=
      (target - level.current) * (still ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 12));
    if (Math.abs(target - level.current) < 0.004) level.current = target;
    apply();
    invalidate();
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      <group position={[0, -y, 0]}>{children}</group>
    </group>
  );
}
function Overview({ x, z, size }: { x: number; z: number; size: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 1, 0);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 45;
      camera.updateProjectionMatrix();
    }
    camera.position.set(x + size * 0.7, size * 0.85, z + size * 0.7);
    camera.lookAt(x, 0, z);
  }, [camera, x, z, size]);
  return null;
}
function Floor({
  room,
  ceiling,
  material,
}: {
  room: UnitScene["rooms"][number];
  ceiling?: number;
  material?: Material;
}) {
  const shape = useMemo(
    () => new Shape(room.polygon.map((p) => new Vector2(p.x, -p.z))),
    [room.polygon],
  );
  return (
    <mesh
      position={[0, ceiling ?? 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      material={material}
    >
      <shapeGeometry args={[shape]} />
      {!material && (
        <meshStandardMaterial
          color={ceiling ? "#eee9df" : room.floorColor}
          side={DoubleSide}
          roughness={0.9}
        />
      )}
    </mesh>
  );
}
function Furniture({
  item,
  assets,
  selected,
  onSelect,
}: {
  item: Placement;
  assets?: ItemAssets;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ItemMesh
      item={item}
      model={assets?.model}
      photo={assets?.photo}
      look={selected ? "selected" : "idle"}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    />
  );
}
export function WalkCamera({
  scene,
  placements,
  roomId,
  input,
}: {
  scene: UnitScene;
  placements: Placement[];
  roomId: string;
  input: React.RefObject<WalkInput>;
}) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const lastRoom = useRef("");

  useEffect(() => {
    const room = scene.rooms.find((r) => r.id === roomId) ?? scene.rooms[0];
    const roomKey = `${room.id}:${JSON.stringify(room.polygon)}`;
    const sameRoom = lastRoom.current === roomKey;
    // Appearance updates must not teleport a walker who is still in clear space.
    if (sameRoom && canWalk(scene, { x: camera.position.x, z: camera.position.z }, placements))
      return;
    lastRoom.current = roomKey;
    let p = roomCenter(room);
    if (!canWalk(scene, p, placements)) {
      const candidate = room.polygon
        .map((v) => ({ x: v.x * 0.2 + p.x * 0.8, z: v.z * 0.2 + p.z * 0.8 }))
        .find((v) => canWalk(scene, v, placements));
      if (candidate) p = candidate;
      else {
        const xs = room.polygon.map((v) => v.x),
          zs = room.polygon.map((v) => v.z);
        search: for (let x = Math.min(...xs) + 0.2; x < Math.max(...xs); x += 0.2)
          for (let z = Math.min(...zs) + 0.2; z < Math.max(...zs); z += 0.2)
            if (inside({ x, z }, room.polygon) && canWalk(scene, { x, z }, placements)) {
              p = { x, z };
              break search;
            }
      }
    }
    camera.up.set(0, 1, 0);
    camera.position.set(p.x, 1.65, p.z);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 72;
      camera.updateProjectionMatrix();
    }
    if (!sameRoom) yaw.current = 0;
  }, [camera, scene, roomId, placements]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Walkthrough. Use W and S to walk, A and D to turn. Drag to look.",
    );
    const down = (e: KeyboardEvent) => {
      if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keys.current.add(e.key);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    let last: { x: number; y: number } | null = null;
    const start = (e: PointerEvent) => {
      canvas.focus();
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (last !== null) {
        yaw.current -= (e.clientX - last.x) * 0.006;
        pitch.current = Math.max(-1.1, Math.min(1.1, pitch.current - (e.clientY - last.y) * 0.005));
        last = { x: e.clientX, y: e.clientY };
      }
    };
    const end = () => {
      last = null;
    };
    canvas.addEventListener("keydown", down);
    canvas.addEventListener("keyup", up);
    canvas.addEventListener("blur", blur);
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    return () => {
      canvas.removeEventListener("keydown", down);
      canvas.removeEventListener("keyup", up);
      canvas.removeEventListener("blur", blur);
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
    };
  }, [gl]);
  useFrame((_, dt) => {
    const k = keys.current;
    const delta = Math.min(dt, 0.04);
    const forward =
      (k.has("w") || k.has("ArrowUp") ? 1 : 0) -
      (k.has("s") || k.has("ArrowDown") ? 1 : 0) +
      input.current.forward;
    yaw.current +=
      ((k.has("a") || k.has("ArrowLeft") ? 1 : 0) -
        (k.has("d") || k.has("ArrowRight") ? 1 : 0) +
        input.current.turn) *
      delta *
      1.5;
    const dx = -Math.sin(yaw.current) * forward * delta * 1.5,
      dz = -Math.cos(yaw.current) * forward * delta * 1.5;
    // Substeps prevent crossing a thin wall at low frame rates.
    const n = Math.max(1, Math.ceil(distance({ x: 0, z: 0 }, { x: dx, z: dz }) / 0.05));
    for (let i = 0; i < n; i++) {
      const next = { x: camera.position.x + dx / n, z: camera.position.z + dz / n };
      if (canWalk(scene, next, placements)) camera.position.set(next.x, 1.65, next.z);
    }
    camera.lookAt(
      new Vector3(
        camera.position.x - Math.sin(yaw.current),
        1.65 + Math.tan(pitch.current),
        camera.position.z - Math.cos(yaw.current),
      ),
    );
  });
  return null;
}
class CanvasError extends Component<{ children: ReactNode; jobId?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Unit 3D renderer failed", { jobId: this.props.jobId, error });
  }
  render() {
    return this.state.failed ? (
      <div className="p-8 text-primary">
        3D is unavailable on this device. Use Floor plan to edit and place items.
      </div>
    ) : (
      this.props.children
    );
  }
}
