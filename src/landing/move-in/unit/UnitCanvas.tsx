import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { DoubleSide, type Material, PerspectiveCamera, Shape, Vector2, Vector3 } from "three";
import {
  along,
  canWalk,
  distance,
  inside,
  type Placement,
  roomCenter,
  type UnitScene,
  wallParts,
} from "../../../../convex/lib/unitScene";

import { ObservedFixture, Solid, WallTrim } from "./UnitDetails";
import { UnitEffects } from "./UnitEffects";
import { useUnitMaterials } from "./UnitMaterials";

export type ViewMode = "dollhouse" | "walk" | "plan";
export type WalkInput = { forward: number; turn: number };
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
}: {
  jobId?: string;
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
  const surfaceMaterial = (id: string) =>
    materials.get(appearance?.surfaces.find((s) => s.targetId === id)?.materialId ?? "");
  const points = scene.rooms.flatMap((r) => r.polygon);
  const x = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
  const z = (Math.min(...points.map((p) => p.z)) + Math.max(...points.map((p) => p.z))) / 2;
  const size = Math.max(5, ...points.map((p) => Math.hypot(p.x - x, p.z - z) * 2));
  return (
    <CanvasError jobId={jobId}>
      <Canvas
        shadows
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
        {scene.rooms.map((room) => (
          <group key={room.id}>
            <Floor room={room} material={surfaceMaterial(room.id)} />
            {mode === "walk" && (
              <Floor room={room} ceiling={Math.max(...scene.walls.map((w) => w.height), 2.4)} />
            )}
          </group>
        ))}
        {scene.walls.map((w) => {
          const theta = -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x);
          const cap = mode === "dollhouse" && cutaway ? 0.8 : w.height;
          return (
            <group key={w.id}>
              {appearance && <WallTrim wall={w} cutaway={cap < w.height} />}
              {wallParts(w).map((part, i) => {
                const top = Math.min(part.top, cap);
                if (part.bottom >= top) return null;
                const center = along(w, (part.start + part.end) / 2);
                return (
                  <Solid
                    key={i}
                    size={[part.end - part.start, top - part.bottom, w.thickness]}
                    position={[center.x, (part.bottom + top) / 2, center.z]}
                    rotation={[0, theta, 0]}
                    color={w.color}
                    material={surfaceMaterial(w.id)}
                    rounded={0}
                  />
                );
              })}
              {w.openings
                .filter((o) => o.kind === "window" && cap === w.height)
                .map((o, i) => {
                  const p = along(w, o.offset + o.width / 2);
                  return (
                    <mesh
                      key={i}
                      position={[p.x, o.bottom + o.height / 2, p.z]}
                      rotation={[0, theta, 0]}
                    >
                      <boxGeometry args={[o.width, o.height, 0.025]} />
                      <meshStandardMaterial
                        color="#9dc7d6"
                        transparent
                        opacity={0.38}
                        roughness={0.15}
                      />
                    </mesh>
                  );
                })}
            </group>
          );
        })}
        {appearance?.objects.map((object) => (
          <ObservedFixture key={object.id} object={object} materials={materials} />
        ))}
        {appearance && <UnitEffects />}
        {placements.map((p) => (
          <Furniture
            key={p.id}
            item={p}
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
  item: p,
  selected,
  onSelect,
}: {
  item: Placement;
  selected: boolean;
  onSelect: () => void;
}) {
  const cushion = p.kind === "sofa" || p.kind === "bed";
  return (
    <group
      position={[p.x, 0, p.z]}
      rotation={[0, p.rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, p.height * (cushion ? 0.3 : 0.5), 0]} castShadow receiveShadow>
        <boxGeometry args={[p.width, p.height * (cushion ? 0.6 : 1), p.depth]} />
        <meshStandardMaterial
          color={p.color}
          roughness={0.85}
          emissive={selected ? "#0866ff" : "#000000"}
          emissiveIntensity={0.18}
        />
      </mesh>
      {cushion && (
        <mesh position={[0, p.height * 0.8, -p.depth * 0.42]} castShadow>
          <boxGeometry args={[p.width, p.height * 0.4, p.depth * 0.16]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      )}
      {p.kind === "sofa" &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * p.width * 0.45, p.height * 0.5, 0]} castShadow>
            <boxGeometry args={[p.width * 0.1, p.height * 0.4, p.depth]} />
            <meshStandardMaterial color={p.color} />
          </mesh>
        ))}
      {selected && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[p.width + 0.12, p.depth + 0.12]} />
          <meshBasicMaterial color="#0866ff" side={DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
function WalkCamera({
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
