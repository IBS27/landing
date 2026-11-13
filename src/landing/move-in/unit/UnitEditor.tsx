import { lazy, type ReactNode, Suspense, useRef, useState } from "react";
import { Button, Card, Spinner } from "@/ui/primitives";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  distance,
  manualScene,
  type Placement,
  placementProblems,
  roomCenter,
  sceneProblems,
  type UnitScene,
} from "../../../../convex/lib/unitScene";
import { sceneId } from "./id";
import type { ViewMode, WalkInput } from "./UnitCanvas";
import { UnitPlan } from "./UnitPlan";

const UnitCanvas = lazy(() => import("./UnitCanvas").then((m) => ({ default: m.UnitCanvas })));
export const fieldClass =
  "w-full rounded-md border border-divider bg-card px-2 py-2 text-sm text-primary";
export type UnitDraft = { scene: UnitScene; placements: Placement[] };
export function UnitEditor({
  initial,
  revision,
  onSave,
  sidebar,
  items = [],
}: {
  initial: UnitDraft;
  revision: number;
  onSave?: (draft: UnitDraft, revision: number) => Promise<number>;
  sidebar?: ReactNode;
  items?: { id: Id<"listings">; title: string }[];
}) {
  const [draft, setDraft] = useState(initial);
  const [base, setBase] = useState(revision);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ViewMode>("dollhouse");
  const [details, setDetails] = useState(true);
  const [cutaway, setCutaway] = useState(true);
  const [roomId, setRoomId] = useState(initial.scene.rooms[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<WalkInput>({ forward: 0, turn: 0 });
  const problems = sceneProblems(draft.scene);
  const lastValid = useRef(draft.scene);
  if (!problems.length) lastValid.current = draft.scene;
  const selectedItem = draft.placements.find((p) => p.id === selected);
  const room = draft.scene.rooms.find((r) => r.id === roomId) ?? draft.scene.rooms[0];
  const [width, setWidth] = useState(4),
    [length, setLength] = useState(5);
  const [listing, setListing] = useState("");
  const [calibrationWall, setCalibrationWall] = useState(initial.scene.walls[0]?.id ?? "");
  const [knownLength, setKnownLength] = useState(4);
  if (!dirty && revision > base) {
    setDraft(initial);
    setBase(revision);
  }
  const measuredWall =
    draft.scene.walls.find((w) => w.id === calibrationWall) ?? draft.scene.walls[0];
  const calibrate = () => {
    if (!measuredWall) return;
    const factor = knownLength / distance(measuredWall.a, measuredWall.b);
    const scale = (p: { x: number; z: number }) => ({ x: p.x * factor, z: p.z * factor });
    const scale3 = (p: { x: number; y: number; z: number }) => ({ ...scale(p), y: p.y * factor });
    change({
      scene: {
        ...draft.scene,
        appearance: draft.scene.appearance && {
          ...draft.scene.appearance,
          objects: draft.scene.appearance.objects.map((o) => ({
            ...o,
            position: scale3(o.position),
            size: scale3(o.size),
            parts: o.parts.map((p) => ({
              ...p,
              position: scale3(p.position),
              size: scale3(p.size),
            })),
          })),
        },
        notes: [
          `Scale calibrated by you: wall ${measuredWall.id} is ${knownLength} m. Other dimensions remain estimates.`,
          ...draft.scene.notes.slice(0, 11),
        ],
        rooms: draft.scene.rooms.map((r) => ({
          ...r,
          polygon: r.polygon.map(scale),
          evidence: { ...r.evidence, basis: "estimated" },
        })),
        walls: draft.scene.walls.map((w) => ({
          ...w,
          a: scale(w.a),
          b: scale(w.b),
          height: w.height * factor,
          thickness: w.thickness * factor,
          openings: w.openings.map((o) => ({
            ...o,
            offset: o.offset * factor,
            width: o.width * factor,
            height: o.height * factor,
            bottom: o.bottom * factor,
          })),
          evidence: { ...w.evidence, basis: "estimated" },
        })),
      },
      placements: draft.placements.map((p) => ({ ...p, ...scale(p) })),
    });
  };
  const change = (next: UnitDraft) => {
    setDraft(next);
    setDirty(true);
    setMessage("");
  };
  const editItem = (patch: Partial<Placement>) =>
    change({
      ...draft,
      placements: draft.placements.map((p) => (p.id === selected ? { ...p, ...patch } : p)),
    });
  const corner = (id: string, index: number, x: number, z: number) => {
    const r = draft.scene.rooms.find((r) => r.id === id);
    if (!r) return;
    const old = r.polygon[index],
      next = { x, z };
    const same = (p: { x: number; z: number }) => distance(p, old) < 0.001;
    change({
      ...draft,
      scene: {
        ...draft.scene,
        appearance: undefined,
        rooms: draft.scene.rooms.map((r) => ({
          ...r,
          polygon: r.polygon.map((p) => (same(p) ? next : p)),
          evidence: r.polygon.some(same) ? { ...r.evidence, basis: "estimated" } : r.evidence,
        })),
        walls: draft.scene.walls.map((w) => ({
          ...w,
          a: same(w.a) ? next : w.a,
          b: same(w.b) ? next : w.b,
          evidence: same(w.a) || same(w.b) ? { ...w.evidence, basis: "estimated" } : w.evidence,
        })),
      },
    });
  };
  const addItem = (kind: Placement["kind"]) => {
    const p = roomCenter(room),
      id = sceneId();
    const item = items.find((i) => i.id === listing);
    change({
      ...draft,
      placements: [
        ...draft.placements,
        {
          id,
          label: item?.title ?? `Your ${kind}`,
          listingId: item?.id,
          kind,
          ...p,
          width: kind === "sofa" ? 2 : 1.4,
          depth: kind === "bed" ? 2 : 0.8,
          height: kind === "table" ? 0.75 : 0.9,
          rotation: 0,
          color: "#76958f",
          measured: false,
        },
      ],
    });
    setSelected(id);
    setMode("plan");
  };
  const save = async () => {
    if (!onSave) return;
    setBusy(true);
    try {
      setBase(await onSave(draft, base));
      setDirty(false);
      setMessage("Layout saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };
  const remoteChanged = revision > base;
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-divider border-b p-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="View mode">
            {(
              [
                ["dollhouse", "Bird's-eye"],
                ["walk", "Walkthrough"],
                ["plan", "Floor plan"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={mode === id ? "primary" : "secondary"}
                onClick={() => {
                  input.current = { forward: 0, turn: 0 };
                  setMode(id);
                }}
                aria-pressed={mode === id}
              >
                {label}
              </Button>
            ))}
          </div>
          <select
            aria-label="Current room"
            className={`${fieldClass} max-w-48`}
            value={room.id}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {draft.scene.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {draft.scene.appearance && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={details}
                onChange={(e) => setDetails(e.target.checked)}
              />
              Show observed finishes and fixtures
            </label>
          )}
          {mode === "dollhouse" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cutaway}
                onChange={(e) => setCutaway(e.target.checked)}
              />
              Cutaway walls
            </label>
          )}
        </div>
        <div className="relative h-[480px] min-h-[320px]">
          {mode === "plan" ? (
            <UnitPlan
              scene={draft.scene}
              placements={draft.placements}
              selected={selected}
              onSelect={setSelected}
              onMove={(id, x, z) =>
                change({
                  ...draft,
                  placements: draft.placements.map((p) => (p.id === id ? { ...p, x, z } : p)),
                })
              }
              onCorner={onSave ? corner : undefined}
            />
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <UnitCanvas
                scene={lastValid.current}
                placements={draft.placements}
                mode={mode}
                roomId={room.id}
                selected={selected}
                onSelect={setSelected}
                input={input}
                details={details}
                cutaway={cutaway}
              />
            </Suspense>
          )}
          <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs text-slate-700 shadow-sm">
            {draft.scene.appearance && details
              ? "Photo-informed reconstruction"
              : "Estimated layout"}{" "}
            · verify dimensions
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-divider border-t p-3">
          <p className="max-w-lg text-secondary text-sm">
            {mode === "walk"
              ? "Click the scene, then W/S to walk and A/D to turn. Drag to look. Choose a room to jump there."
              : mode === "plan"
                ? onSave
                  ? "Drag items to move them. Drag the blue corner handles to correct the layout."
                  : "Review room outlines and openings before applying this layout."
                : "Drag to orbit. Scroll or pinch to zoom. Switch to Floor plan to edit."}
          </p>
          {mode === "walk" && (
            <div className="flex gap-1">
              {(
                [
                  ["Turn left", 0, 1],
                  ["Forward", 1, 0],
                  ["Back", -1, 0],
                  ["Turn right", 0, -1],
                ] as const
              ).map(([label, forward, turn]) => (
                <Button
                  key={label}
                  variant="secondary"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    input.current = { forward, turn };
                  }}
                  onPointerUp={() => {
                    input.current = { forward: 0, turn: 0 };
                  }}
                  onPointerCancel={() => {
                    input.current = { forward: 0, turn: 0 };
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      input.current = { forward, turn };
                    }
                  }}
                  onKeyUp={() => {
                    input.current = { forward: 0, turn: 0 };
                  }}
                  onBlur={() => {
                    input.current = { forward: 0, turn: 0 };
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
      {problems.length > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800 text-sm">
          {problems.join(". ")}. Correct the floor plan before saving. The 3D view shows the last
          valid layout.
        </p>
      )}
      {remoteChanged && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-900 text-sm"
        >
          A newer version is available. Your unsaved changes are still here.
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(initial);
              setBase(revision);
              setDirty(false);
              setSelected(null);
            }}
          >
            Load saved version
          </Button>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {onSave && (
          <Card className="space-y-4 p-4">
            <h2 className="font-bold text-lg text-primary">Place an item</h2>
            <select
              aria-label="Marketplace item"
              className={fieldClass}
              value={listing}
              onChange={(e) => setListing(e.target.value)}
            >
              <option value="">Custom item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {(["sofa", "bed", "table", "storage"] as const).map((k) => (
                <Button
                  key={k}
                  variant="secondary"
                  onClick={() => addItem(k)}
                  disabled={draft.placements.length >= 80}
                >
                  Add {k}
                </Button>
              ))}
            </div>
            <p className="text-secondary text-sm">
              Item shapes are placeholders. Enter the item's actual dimensions before judging fit.
            </p>
            {draft.placements.length > 0 && (
              <select
                className={fieldClass}
                aria-label="Selected furniture"
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select an item</option>
                {draft.placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            {selectedItem && (
              <div className="space-y-3">
                <label className="block text-primary text-sm">
                  Item name
                  <input
                    className={fieldClass}
                    value={selectedItem.label}
                    maxLength={120}
                    onChange={(e) => editItem({ label: e.target.value })}
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["width", "depth", "height", "x", "z"] as const).map((k) => (
                    <NumberField
                      key={k}
                      label={`${k} (m)`}
                      value={selectedItem[k]}
                      onChange={(n) => editItem({ [k]: n })}
                    />
                  ))}
                  <NumberField
                    label="Rotation (°)"
                    value={Math.round((selectedItem.rotation * 180) / Math.PI)}
                    onChange={(n) => editItem({ rotation: (n * Math.PI) / 180 })}
                  />
                </div>
                <label className="flex items-center gap-2 text-primary text-sm">
                  <input
                    type="checkbox"
                    checked={selectedItem.measured}
                    onChange={(e) => editItem({ measured: e.target.checked })}
                  />
                  I entered measured item dimensions
                </label>
                <label className="flex items-center gap-2 text-primary text-sm">
                  Color
                  <input
                    type="color"
                    value={selectedItem.color}
                    onChange={(e) => editItem({ color: e.target.value })}
                  />
                </label>
                <Button
                  variant="secondary"
                  onClick={() => {
                    change({
                      ...draft,
                      placements: draft.placements.filter((p) => p.id !== selected),
                    });
                    setSelected(null);
                  }}
                >
                  Remove item
                </Button>
              </div>
            )}
            {draft.placements.flatMap((p) =>
              placementProblems(draft.scene, p).map((error) => (
                <p key={`${p.id}-${error}`} className="text-amber-700 text-sm">
                  {p.label}: {error}
                </p>
              )),
            )}
          </Card>
        )}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="font-bold text-lg text-primary">Layout and evidence</h2>
            {draft.scene.notes.map((note, i) => (
              <p key={i} className="text-secondary text-sm">
                {note}
              </p>
            ))}
            {draft.scene.appearance && (
              <details>
                <summary className="cursor-pointer font-semibold text-sm">
                  Observed finishes and fixtures ({draft.scene.appearance.objects.length})
                </summary>
                <p className="my-2 text-secondary text-sm">
                  Materials and shapes are inferred from the media. Surface texture, trim profiles
                  and hidden details are approximations.
                </p>
                {draft.scene.appearance.notes.map((note, i) => (
                  <p key={i} className="my-2 text-secondary text-sm">
                    {note}
                  </p>
                ))}
                {draft.scene.appearance.objects.map((o) => (
                  <p key={o.id} className="my-1 text-secondary text-sm">
                    {o.label} · sources: {o.sources.join(", ")}
                  </p>
                ))}
              </details>
            )}
            <p className="text-primary text-sm">
              {room.name}: {room.evidence.basis}. Sources:{" "}
              {room.evidence.sources.join(", ") || "Manual layout"}.
            </p>
            {onSave && (
              <details>
                <summary className="cursor-pointer font-semibold text-primary text-sm">
                  Edit room corners
                </summary>
                <div className="mt-2 space-y-2">
                  {draft.scene.appearance && (
                    <p className="text-secondary text-sm">
                      Changing the room outline clears generated finishes and fixtures. Generate
                      again to align them to the revised layout.
                    </p>
                  )}
                  {room.polygon.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <NumberField
                        label={`Corner ${i + 1} x (m)`}
                        value={p.x}
                        onChange={(n) => corner(room.id, i, n, p.z)}
                      />
                      <NumberField
                        label={`Corner ${i + 1} z (m)`}
                        value={p.z}
                        onChange={(n) => corner(room.id, i, p.x, n)}
                      />
                    </div>
                  ))}
                </div>
              </details>
            )}
            {onSave && measuredWall && (
              <details>
                <summary className="cursor-pointer font-semibold text-primary text-sm">
                  Calibrate scale from a measured wall
                </summary>
                <p className="my-2 text-secondary text-sm">
                  Select a wall and enter its measured length. This scales the unit and its inferred
                  fixtures uniformly. Your placed item's dimensions stay unchanged.
                </p>
                <label className="block text-primary text-sm">
                  Reference wall
                  <select
                    className={fieldClass}
                    value={measuredWall.id}
                    onChange={(e) => setCalibrationWall(e.target.value)}
                  >
                    {draft.scene.walls.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.id} · {distance(w.a, w.b).toFixed(2)} m
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Measured wall length (m)"
                  value={knownLength}
                  onChange={setKnownLength}
                />
                <Button
                  className="mt-2"
                  variant="secondary"
                  disabled={knownLength < 0.3 || knownLength > 50}
                  onClick={calibrate}
                >
                  Apply measured scale
                </Button>
              </details>
            )}
            {onSave && (
              <details>
                <summary className="cursor-pointer font-semibold text-primary text-sm">
                  Start a measured rectangular room
                </summary>
                <p className="my-2 text-secondary text-sm">
                  Replaces the current walls and rooms. Furniture stays and may need repositioning.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Room width (m)" value={width} onChange={setWidth} />
                  <NumberField label="Room length (m)" value={length} onChange={setLength} />
                </div>
                <Button
                  className="mt-2"
                  variant="secondary"
                  disabled={width < 1 || width > 50 || length < 1 || length > 50}
                  onClick={() => {
                    const scene = manualScene(width, length, draft.scene.title, true);
                    change({ ...draft, scene });
                    setRoomId(scene.rooms[0].id);
                  }}
                >
                  Use these room dimensions
                </Button>
              </details>
            )}
          </Card>
          {sidebar}
        </div>
      </div>
      {onSave && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={busy || !dirty || !!problems.length || remoteChanged}>
            {busy ? "Saving…" : "Save layout"}
          </Button>
          <span role="status" className="text-secondary text-sm">
            {message || (dirty ? "Unsaved changes" : "Saved layout")}
          </span>
        </div>
      )}
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-primary text-xs">
      {label}
      <input
        className={fieldClass}
        type="number"
        step="0.05"
        value={Math.round(value * 1000) / 1000}
        onChange={(e) => {
          if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber))
            onChange(e.target.valueAsNumber);
        }}
      />
    </label>
  );
}
