import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CanvasTexture,
  type DirectionalLight,
  ExtrudeGeometry,
  type Group,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Shape,
  Spherical,
  Vector2,
  Vector3,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Finish } from "../../../convex/lib/unitAppearance";
import {
  area,
  distance,
  type Placement,
  placementProblems,
  type UnitScene,
} from "../../../convex/lib/unitScene";
import { ItemMesh, type ItemSettle } from "../move-in/unit/ItemMesh";
import {
  type ItemAssets,
  type SurfaceDefaults,
  UnitModel,
  WalkCamera,
  type WalkInput,
} from "../move-in/unit/UnitCanvas";
import { Solid } from "../move-in/unit/UnitDetails";
import { useFinishMaterials, useUnitMaterials } from "../move-in/unit/UnitMaterials";
import {
  type Bounds,
  cutFixtures,
  fitDistance,
  lowerWalls,
  type Pose,
  sceneBounds,
  snapToWall,
  stayInRooms,
  viewAzimuth,
  type WallSnap,
  wallMounted,
  wallSides,
  wallY,
} from "./placing";

export type StageView = "overview" | "walk";
/** What the stage asks the canvas: where the camera is looking from. */
export type CanvasHandle = { azimuth: () => number };
export type ApartmentCanvasProps = {
  /** The tab is showing: when it isn't, nothing renders. */
  active: boolean;
  dark: boolean;
  /** No easing, settling or sinking walls (`prefers-reduced-motion`). */
  still: boolean;
  scene: UnitScene;
  placements: readonly Placement[];
  assets: ReadonlyMap<string, ItemAssets>;
  view: StageView;
  selected: string | null;
  /** The selected item's placement has a problem. */
  warn: boolean;
  /** Ids placed since the tab opened: they settle in. */
  arrivals: ReadonlySet<string>;
  /** An item to frame; a new `n` frames it again. */
  focus: { id: string; n: number } | null;
  /** Each change eases the camera back to the whole apartment. */
  home: number;
  /** What covers the canvas, in CSS pixels: the tabs above and the chat dock below. */
  inset: { top: number; bottom: number };
  walk: RefObject<WalkInput>;
  handle: RefObject<CanvasHandle | null>;
  onSelect: (id: string | null) => void;
  /** A drag ended: the item's new pose, to save. */
  onMove: (id: string, pose: Pose) => void;
  /** The WebGL context was lost. */
  onLost: () => void;
};

const FOV = 34;
/** The camera orbits a point this high above the floor. */
const TARGET_Y = 0.7;
const AZIMUTH = 0.66;
const POLAR = 0.93;
/** Walls between the camera and the rooms are cut down to this, metres. */
const CUT = 0.42;
/** The slab the unit stands on. */
const SLAB = 0.1;
const UP = new Vector3(0, 1, 0);
const none = () => null;
/** Kinds that have a front worth turning the camera to. */
const FRONTED: ReadonlySet<string> = new Set(["sofa", "bed", "chair", "storage", "desk"]);

function viewBox(b: Bounds) {
  return {
    halfX: (b.maxX - b.minX) / 2 + 0.25,
    halfZ: (b.maxZ - b.minZ) / 2 + 0.25,
    below: TARGET_Y + SLAB,
    above: b.height - TARGET_Y,
  };
}

/**
 * The Apartment tab's 3D view (#150): the unit as a dollhouse on a studio
 * backdrop, with the walls between the camera and the rooms cut down, and
 * every placed item draggable. Renders on demand: a frame is drawn only when
 * something changes, except while walking.
 */
export function ApartmentCanvas(props: ApartmentCanvasProps) {
  const { scene, placements, active, view, onSelect } = props;
  // The first frame already looks from the default angle, so the right walls start cut down.
  const [start] = useState(() => {
    const b = sceneBounds(scene);
    const tan = Math.tan((FOV * Math.PI) / 360);
    const azimuth = viewAzimuth(placements, AZIMUTH);
    const d = fitDistance(viewBox(b), azimuth, POLAR, tan * 1.2, tan * 0.7);
    return new Vector3()
      .setFromSpherical(new Spherical(d, POLAR, azimuth))
      .add(new Vector3((b.minX + b.maxX) / 2, TARGET_Y, (b.minZ + b.maxZ) / 2));
  });
  return (
    <Canvas
      shadows
      frameloop={!active ? "never" : view === "walk" ? "always" : "demand"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, stencil: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 0.1, far: 300, position: start }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMissed={() => onSelect(null)}
    >
      <Stage {...props} />
    </Canvas>
  );
}

type Drag = {
  id: string;
  group: Group;
  pointerId: number;
  item: Placement;
  wall: boolean;
  startX: number;
  startY: number;
  moved: boolean;
  /** The horizontal plane the pointer is followed on: the height the item was grabbed at. */
  planeY: number;
  /** From the grabbed point to the item's centre, so it doesn't jump under the pointer. */
  dx: number;
  dz: number;
  pose: Pose;
  rect: DOMRect;
  checked: number;
  bad: boolean;
};

function Stage({
  active,
  dark,
  still,
  scene,
  placements,
  assets,
  view,
  selected,
  warn,
  arrivals,
  focus,
  home,
  inset,
  walk,
  handle,
  onSelect,
  onMove,
  onLost,
}: ApartmentCanvasProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  // A context lost while the canvas is on the page (not the one R3F forces when it unmounts).
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      if (el.isConnected) onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  const controls = useRef<OrbitControlsImpl>(null);
  const bounds = useMemo(() => sceneBounds(scene), [scene]);
  const overview = view === "overview";

  // Coming back to the tab, or changing mode, needs a frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these changes are what need the frame.
  useEffect(() => invalidate(), [active, view, dark, invalidate]);
  useEffect(() => {
    gl.toneMappingExposure = dark ? 0.92 : 1;
    invalidate();
  }, [gl, dark, invalidate]);

  /* ── Finishes ── */
  const appearance = scene.appearance;
  const materials = useUnitMaterials(appearance);
  // Floors and walls the build gave no finish still get one, from the scene's own colours.
  const plain = useMemo(() => {
    const out: Finish[] = [];
    for (const color of new Set(scene.rooms.map((r) => r.floorColor)))
      out.push({ id: `floor:${color}`, color, pattern: "wood", roughness: 0.74, repeat: 0.8 });
    for (const color of new Set(scene.walls.map((w) => w.color)))
      out.push({ id: `wall:${color}`, color, pattern: "plaster", roughness: 0.95, repeat: 1 });
    return out;
  }, [scene]);
  const plainMaterials = useFinishMaterials(plain);
  const defaults = useMemo<SurfaceDefaults>(
    () => ({
      floor: (color) => plainMaterials.get(`floor:${color}`),
      wall: (color) => plainMaterials.get(`wall:${color}`),
    }),
    [plainMaterials],
  );

  /* ── Cutaway: only the walls between the camera and the rooms come down ── */
  const sides = useMemo(() => wallSides(scene), [scene]);
  const flags = useMemo(() => new Uint8Array(scene.walls.length), [scene]);
  const [cut, setCut] = useState(0);
  const eye = useRef({ x: 0, z: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `cut` changes when the camera crosses a wall's plane.
  const lowered = useMemo(() => {
    eye.current.x = camera.position.x;
    eye.current.z = camera.position.z;
    lowerWalls(sides, eye.current, flags);
    return new Set(scene.walls.filter((_, i) => flags[i]).map((w) => w.id));
  }, [scene, sides, flags, camera, cut]);
  useFrame(() => {
    if (!overview) return;
    eye.current.x = camera.position.x;
    eye.current.z = camera.position.z;
    if (lowerWalls(sides, eye.current, flags)) setCut((n) => n + 1);
  });

  // Curtains and the like on a lowered wall are cut with it.
  const shown = useMemo(
    () => (appearance && overview ? cutFixtures(scene, appearance, lowered, CUT) : appearance),
    [scene, appearance, lowered, overview],
  );

  /* ── Hover, and dragging an item across the floor or along the walls ── */
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragWarn, setDragWarn] = useState(false);
  const groups = useRef(new Map<string, Group>());
  const live = useRef({ scene, placements, overview, onSelect, onMove });
  live.current = { scene, placements, overview, onSelect, onMove };
  const drag = useRef<Drag | null>(null);
  const tools = useMemo(
    () => ({
      ray: new Raycaster(),
      plane: new Plane(),
      ndc: new Vector2(),
      hit: new Vector3(),
      at: { x: 0, z: 0 },
      to: { x: 0, z: 0 },
      snap: { x: 0, z: 0, rotation: 0, wallId: "", wallHeight: 0, offset: 0 } as WallSnap,
    }),
    [],
  );
  const pointer = useMemo(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
        d.moved = true;
        setDragging(d.id);
      }
      const { ray, plane, ndc, hit, at, to, snap } = tools;
      ndc.set(
        ((e.clientX - d.rect.left) / d.rect.width) * 2 - 1,
        -((e.clientY - d.rect.top) / d.rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      plane.set(UP, -d.planeY);
      if (!ray.ray.intersectPlane(plane, hit) || hit.distanceTo(camera.position) > 150) return;
      at.x = hit.x + d.dx;
      at.z = hit.z + d.dz;
      const { scene } = live.current;
      if (d.wall) {
        if (!snapToWall(scene, at, d.item, snap)) return;
        d.pose.x = snap.x;
        d.pose.z = snap.z;
        d.pose.rotation = snap.rotation;
        d.pose.y = wallY(d.pose.y ?? 1.2, d.item.height, snap.wallHeight);
      } else {
        stayInRooms(scene, at, d.pose, to);
        d.pose.x = to.x;
        d.pose.z = to.z;
      }
      d.group.position.set(d.pose.x, d.pose.y ?? 0, d.pose.z);
      d.group.rotation.y = d.pose.rotation;
      // Warn, don't block: checked a few times a second, not every frame.
      if (e.timeStamp - d.checked > 90) {
        d.checked = e.timeStamp;
        const bad = placementProblems(scene, { ...d.item, ...d.pose }).length > 0;
        if (bad !== d.bad) {
          d.bad = bad;
          setDragWarn(bad);
        }
      }
      invalidate();
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      stop();
      if (d.moved && e.type === "pointerup") live.current.onMove(d.id, { ...d.pose });
      else if (d.moved) {
        // Cancelled: back to where it was.
        d.group.position.set(d.item.x, d.item.y ?? 0, d.item.z);
        d.group.rotation.y = d.item.rotation;
        invalidate();
      }
    };
    const stop = () => {
      const d = drag.current;
      drag.current = null;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (d && el.hasPointerCapture(d.pointerId)) el.releasePointerCapture(d.pointerId);
      if (controls.current) controls.current.enabled = true;
      setDragging(null);
      setDragWarn(false);
    };
    const down = (id: string, e: ThreeEvent<PointerEvent>) => {
      if (!live.current.overview || e.button !== 0 || drag.current) return;
      e.stopPropagation();
      live.current.onSelect(id);
      const item = live.current.placements.find((p) => p.id === id);
      const group = groups.current.get(id);
      if (!item || !group) return;
      // The same press reaches the orbit controls next: they must not start a rotation.
      if (controls.current) controls.current.enabled = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone: the drag ends with the next event.
      }
      drag.current = {
        id,
        group,
        pointerId: e.pointerId,
        item,
        wall: wallMounted(item),
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        planeY: e.point.y,
        dx: item.x - e.point.x,
        dz: item.z - e.point.z,
        pose: {
          x: item.x,
          z: item.z,
          rotation: item.rotation,
          ...(item.y === undefined ? {} : { y: item.y }),
        },
        rect: el.getBoundingClientRect(),
        checked: 0,
        bad: false,
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };
    const over = (id: string, e: ThreeEvent<PointerEvent>) => {
      if (!live.current.overview) return;
      e.stopPropagation();
      setHover(id);
    };
    const out = (id: string) => setHover((h) => (h === id ? null : h));
    const register = (id: string, group: Group | null) => {
      if (group) groups.current.set(id, group);
      else groups.current.delete(id);
    };
    return { down, over, out, register, stop };
  }, [gl, camera, invalidate, tools]);
  useEffect(() => pointer.stop, [pointer]);
  useEffect(() => {
    if (!overview) pointer.stop();
  }, [overview, pointer]);
  useEffect(() => {
    gl.domElement.style.cursor = dragging ? "grabbing" : hover && overview ? "grab" : "";
  }, [gl, hover, dragging, overview]);

  useEffect(() => {
    handle.current = {
      azimuth: () =>
        Math.atan2(
          camera.position.x - (controls.current?.target.x ?? 0),
          camera.position.z - (controls.current?.target.z ?? 0),
        ),
    };
    return () => {
      handle.current = null;
    };
  }, [handle, camera]);

  const focused = focus ? placements.find((p) => p.id === focus.id) : undefined;
  const room = useMemo(
    () => [...scene.rooms].sort((a, b) => area(b.polygon) - area(a.polygon))[0]?.id ?? "",
    [scene],
  );
  return (
    <>
      <Lights bounds={bounds} inside={!overview} />
      <Ground bounds={bounds} dark={dark} />
      <Plinth scene={scene} />
      <Unit
        scene={scene}
        appearance={shown}
        materials={materials}
        defaults={defaults}
        ceiling={!overview}
        lowered={overview ? lowered : undefined}
        cap={CUT}
        animate={!still}
        trim
        corners
      />
      {placements.map((p) => (
        <StageItem
          key={p.id}
          p={p}
          asset={assets.get(p.id)}
          look={
            !overview
              ? "idle"
              : selected === p.id || dragging === p.id
                ? "selected"
                : hover === p.id
                  ? "hover"
                  : "idle"
          }
          warn={dragging === p.id ? dragWarn : selected === p.id && !dragging && warn}
          settle={still ? "none" : arrivals.has(p.id) ? "arrive" : "swap"}
          pointer={pointer}
        />
      ))}
      {overview ? (
        <Rig
          bounds={bounds}
          azimuth={viewAzimuth(placements, AZIMUTH)}
          inset={inset}
          still={still}
          home={home}
          focus={focus}
          focused={focused}
          controls={controls}
        />
      ) : (
        <>
          <WalkCamera
            scene={scene}
            placements={placements as Placement[]}
            roomId={room}
            input={walk}
          />
          <FocusCanvas />
        </>
      )}
    </>
  );
}

const Unit = memo(UnitModel);

type Pointer = {
  down: (id: string, e: ThreeEvent<PointerEvent>) => void;
  over: (id: string, e: ThreeEvent<PointerEvent>) => void;
  out: (id: string) => void;
  register: (id: string, group: Group | null) => void;
};
const FIELDS = [
  "id",
  "kind",
  "x",
  "z",
  "y",
  "rotation",
  "width",
  "depth",
  "height",
  "color",
] as const;
const StageItem = memo(
  function StageItem({
    p,
    asset,
    look,
    warn,
    settle,
    pointer,
  }: {
    p: Placement;
    asset?: ItemAssets;
    look: "idle" | "hover" | "selected";
    warn: boolean;
    settle: ItemSettle;
    pointer: Pointer;
  }) {
    const { id } = p;
    const ref = useCallback((g: Group | null) => pointer.register(id, g), [pointer, id]);
    return (
      <ItemMesh
        ref={ref}
        item={p}
        model={asset?.model}
        photo={asset?.photo}
        look={look}
        warn={warn}
        settle={settle}
        onPointerDown={(e) => pointer.down(id, e)}
        onPointerOver={(e) => pointer.over(id, e)}
        onPointerOut={() => pointer.out(id)}
      />
    );
  },
  (a, b) =>
    a.asset === b.asset &&
    a.look === b.look &&
    a.warn === b.warn &&
    a.settle === b.settle &&
    a.pointer === b.pointer &&
    FIELDS.every((k) => a.p[k] === b.p[k]),
);

/** Walking is driven from the keyboard: the canvas takes focus when it starts. */
function FocusCanvas() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.domElement.focus({ preventScroll: true });
    return () => gl.domElement.blur();
  }, [gl]);
  return null;
}

/* ── Light ── */

function Lights({ bounds: b, inside }: { bounds: Bounds; inside: boolean }) {
  const key = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2;
  const reach = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2.5;
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera;
    c.left = c.bottom = -reach;
    c.right = c.top = reach;
    c.near = 1;
    c.far = reach * 6 + 20;
    c.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
  }, [cx, cz, reach, invalidate]);
  return (
    <>
      <hemisphereLight args={["#fff8ef", "#c4b8a6", 0.72]} />
      {/* Walking under a ceiling: the rooms need light the sky no longer gives. */}
      {inside && <ambientLight color="#fff6ea" intensity={0.75} />}
      {/* A warm key from the front right, not too high: it lights the floor and both back walls. */}
      <directionalLight
        ref={key}
        position={[cx + reach * 1.05, reach * 1.45, cz + reach * 1.3]}
        color="#fff0dc"
        intensity={2.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
      {/* A cool, shadowless fill from the other side. */}
      <directionalLight
        position={[cx - reach * 1.4, reach * 0.9 + 2, cz + reach * 0.4]}
        color="#dfe9ff"
        intensity={0.55}
      />
      <Environment resolution={128} frames={1} environmentIntensity={0.42}>
        <Lightformer
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 14, 1]}
          intensity={2}
          color="#fff6ea"
        />
        <Lightformer
          position={[-10, 3, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[14, 6, 1]}
          intensity={1.4}
          color="#e6eeff"
        />
        <Lightformer
          position={[6, 3, 10]}
          rotation={[0, Math.PI, 0]}
          scale={[14, 6, 1]}
          intensity={1.2}
          color="#fff1de"
        />
      </Environment>
    </>
  );
}

/* ── Ground: a soft pool under the unit and the key light's shadow, on a transparent canvas ── */

function Ground({ bounds: b, dark }: { bounds: Bounds; dark: boolean }) {
  const pool = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // A blurred white square: drawn off-canvas, so only its soft shadow lands here.
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 256;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(24 - 256, 24, 80, 80);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => pool.dispose(), [pool]);
  const w = b.maxX - b.minX,
    d = b.maxZ - b.minZ,
    cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2;
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, -SLAB - 0.012, cz]}
        raycast={none}
        renderOrder={-2}
      >
        <planeGeometry args={[(w + 0.5) * 1.6, (d + 0.5) * 1.6]} />
        <meshBasicMaterial
          map={pool}
          color={dark ? "#ffffff" : "#232c3b"}
          transparent
          opacity={dark ? 0.06 : 0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, -SLAB - 0.006, cz]}
        raycast={none}
        receiveShadow
        renderOrder={-1}
      >
        <planeGeometry args={[w + 16, d + 16]} />
        <shadowMaterial transparent opacity={dark ? 0.45 : 0.17} depthWrite={false} />
      </mesh>
    </>
  );
}

/** The slab under the floors and walls, so the unit reads as one object. */
function Plinth({ scene }: { scene: UnitScene }) {
  const slabs = useMemo(
    () =>
      scene.rooms.map(
        (r) =>
          new ExtrudeGeometry(new Shape(r.polygon.map((p) => new Vector2(p.x, -p.z))), {
            depth: SLAB,
            bevelEnabled: false,
          }),
      ),
    [scene],
  );
  useEffect(() => () => slabs.forEach((g) => void g.dispose()), [slabs]);
  return (
    <>
      {slabs.map((geometry, i) => (
        <mesh
          key={scene.rooms[i]?.id ?? i}
          geometry={geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -SLAB - 0.003, 0]}
          raycast={none}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#e3ddd3" roughness={0.9} />
        </mesh>
      ))}
      {scene.walls.map((w) => {
        const length = distance(w.a, w.b);
        return (
          <Solid
            key={w.id}
            size={[length + w.thickness, SLAB, w.thickness]}
            position={[(w.a.x + w.b.x) / 2, -SLAB / 2 - 0.003, (w.a.z + w.b.z) / 2]}
            rotation={[0, -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x), 0]}
            color="#e3ddd3"
            rounded={0}
          />
        );
      })}
    </>
  );
}

/* ── Camera ── */

type Goal = { x: number; y: number; z: number; distance: number; azimuth: number; polar: number };

/**
 * The overview camera: a damped orbit that frames the whole unit in the part
 * of the stage the tabs and the chat dock leave free, and eases to a new
 * framing when the unit's size changes, when asked to go home, and when an
 * item is focused. A touch of the controls cancels the easing.
 */
function Rig({
  bounds: b,
  azimuth: preferred,
  inset,
  still,
  home,
  focus,
  focused,
  controls,
}: {
  bounds: Bounds;
  /** The corner to look from at first and when going home: where the furniture faces. */
  azimuth: number;
  inset: { top: number; bottom: number };
  still: boolean;
  home: number;
  focus: { id: string; n: number } | null;
  focused?: Placement;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<Goal | null>(null);
  const placed = useRef(false);
  const scratch = useMemo(() => ({ offset: new Vector3(), spherical: new Spherical() }), []);

  // The scene is drawn higher than the canvas's centre: in the middle of what the dock leaves free.
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.up.set(0, 1, 0);
    camera.fov = FOV;
    const shift = Math.round((inset.bottom - inset.top) / 2);
    camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height);
    invalidate();
    return () => camera.clearViewOffset();
  }, [camera, size.width, size.height, inset.top, inset.bottom, invalidate]);

  const cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2;
  const fit = useCallback(
    (azimuth: number, polar: number) => {
      const tan = Math.tan((FOV * Math.PI) / 360);
      const side = size.width < 720 ? 16 : 44;
      const free = Math.max(120, size.height - inset.top - inset.bottom - 24);
      return fitDistance(
        viewBox(b),
        azimuth,
        polar,
        tan * (size.width / size.height) * Math.max(0.3, 1 - (side * 2) / size.width),
        tan * (free / size.height),
      );
    },
    [b, size.width, size.height, inset.top, inset.bottom],
  );
  const corner = useRef(preferred);
  corner.current = preferred;
  const whole = fit(preferred, POLAR);

  const angles = useCallback(() => {
    const c = controls.current;
    return c
      ? { azimuth: c.getAzimuthalAngle(), polar: c.getPolarAngle() }
      : { azimuth: AZIMUTH, polar: POLAR };
  }, [controls]);
  const go = useCallback(
    (g: Goal) => {
      goal.current = g;
      invalidate();
    },
    [invalidate],
  );

  // The unit's size or the stage's changed: frame the whole of it from where the camera is.
  useLayoutEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!placed.current) {
      placed.current = true;
      c.target.set(cx, TARGET_Y, cz);
      camera.position
        .setFromSpherical(scratch.spherical.set(fit(corner.current, POLAR), POLAR, corner.current))
        .add(c.target);
      camera.lookAt(c.target);
      c.update();
      invalidate();
      return;
    }
    const a = angles();
    go({ x: cx, y: TARGET_Y, z: cz, distance: fit(a.azimuth, a.polar), ...a });
  }, [cx, cz, fit, angles, go, camera, controls, scratch, invalidate]);

  const lastHome = useRef(home);
  useEffect(() => {
    if (home === lastHome.current) return;
    lastHome.current = home;
    go({
      x: cx,
      y: TARGET_Y,
      z: cz,
      distance: fit(corner.current, POLAR),
      azimuth: corner.current,
      polar: POLAR,
    });
  }, [home, cx, cz, fit, go]);

  const lastFocus = useRef(focus?.n ?? 0);
  useEffect(() => {
    if (!focus || !focused || focus.n === lastFocus.current) return;
    lastFocus.current = focus.n;
    const a = angles();
    const wall = wallMounted(focused);
    // Things with a front are looked at from it, a little to one side: something on a
    // wall always, furniture when the camera is behind it (its back is usually to a wall).
    const fronted = wall || FRONTED.has(focused.kind);
    const behind = Math.cos(focused.rotation - a.azimuth) < 0.25;
    const azimuth = fronted && (wall || behind) ? focused.rotation + 0.45 : a.azimuth;
    go({
      x: focused.x,
      y: Math.min(1.3, (focused.y ?? 0) + focused.height / 2),
      z: focused.z,
      // Nearer, but with the room around it still in view.
      distance: Math.min(
        whole,
        Math.max(whole * 0.6, Math.hypot(focused.width, focused.depth, focused.height) * 4),
      ),
      azimuth,
      polar: Math.min(Math.max(a.polar, 0.75), wall ? 1.25 : 1.1),
    });
  }, [focus, focused, whole, angles, go]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => {
      goal.current = null;
    };
    // Panning stays over the unit.
    const keep = () => {
      const t = c.target;
      const x = Math.max(b.minX, Math.min(b.maxX, t.x)),
        z = Math.max(b.minZ, Math.min(b.maxZ, t.z)),
        y = Math.max(0, Math.min(b.height, t.y));
      if (x === t.x && z === t.z && y === t.y) return;
      camera.position.x += x - t.x;
      camera.position.y += y - t.y;
      camera.position.z += z - t.z;
      t.set(x, y, z);
    };
    c.addEventListener("start", cancel);
    c.addEventListener("change", keep);
    return () => {
      c.removeEventListener("start", cancel);
      c.removeEventListener("change", keep);
    };
  }, [controls, camera, b]);

  useFrame((_, dt) => {
    const g = goal.current,
      c = controls.current;
    if (!g || !c) return;
    const { offset, spherical } = scratch;
    const k = still ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 5.5);
    const t = c.target;
    spherical.setFromVector3(offset.copy(camera.position).sub(t));
    t.x += (g.x - t.x) * k;
    t.y += (g.y - t.y) * k;
    t.z += (g.z - t.z) * k;
    const turn = Math.atan2(
      Math.sin(g.azimuth - spherical.theta),
      Math.cos(g.azimuth - spherical.theta),
    );
    spherical.theta += turn * k;
    spherical.phi += (g.polar - spherical.phi) * k;
    spherical.radius += (g.distance - spherical.radius) * k;
    camera.position.setFromSpherical(spherical).add(t);
    camera.lookAt(t);
    c.update();
    if (
      Math.abs(turn) < 0.002 &&
      Math.abs(g.polar - spherical.phi) < 0.002 &&
      Math.abs(g.distance - spherical.radius) < 0.01 &&
      Math.hypot(g.x - t.x, g.y - t.y, g.z - t.z) < 0.01
    )
      goal.current = null;
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      panSpeed={0.7}
      screenSpacePanning={false}
      minPolarAngle={0.12}
      maxPolarAngle={1.42}
      minDistance={1.6}
      maxDistance={Math.max(whole * 1.7, 8)}
    />
  );
}
