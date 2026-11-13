import { ChevronDown } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Button, Card, Spinner } from "@/ui/primitives";
import {
  distance,
  ITEM_KINDS,
  itemSize,
  manualScene,
  type Placement,
  placementProblems,
  roomCenter,
  sceneProblems,
  type UnitScene,
} from "../../../../convex/lib/unitScene";
import { ItemPicker, type PickerItem } from "./ItemPicker";
import { sceneId } from "./id";
import type { ViewMode, WalkInput } from "./UnitCanvas";
import { UnitPlan } from "./UnitPlan";

const UnitCanvas = lazy(() => import("./UnitCanvas").then((m) => ({ default: m.UnitCanvas })));
export const fieldClass =
  "h-9 w-full rounded-md border border-divider bg-card px-2.5 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";
/** A label stacked over its control. */
export const labelClass = "flex flex-col gap-1 text-[13px] text-secondary";
/** Collapsible editor sections in "Layout and evidence". */
const summaryClass =
  "flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 font-semibold text-[15px] text-primary [&::-webkit-details-marker]:hidden";
const chevron = (
  <ChevronDown
    size={18}
    className="shrink-0 text-icon-secondary transition-transform group-open:rotate-180"
    aria-hidden
  />
);
export type UnitDraft = { scene: UnitScene; placements: Placement[] };
export function UnitEditor({
  initial,
  revision,
  onSave,
  sidebar,
  items,
  pick,
  pickMissing,
  onDirtyChange,
  viewKey = "saved",
  jobId,
}: {
  jobId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  viewKey?: string;
  initial: UnitDraft;
  revision: number;
  onSave?: (draft: UnitDraft, revision: number) => Promise<number>;
  sidebar?: ReactNode;
  /** What can be placed (#131); undefined while loading. */
  items?: PickerItem[];
  /** Picker key to start with, from a "Place in my room" link, once resolved. */
  pick?: string;
  /** The linked item can't be placed (gone, or not the owner's). */
  pickMissing?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const latest = useRef(draft);
  latest.current = draft;
  const [base, setBase] = useState(revision);
  const [baseView, setBaseView] = useState(viewKey);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
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
  const [choice, setChoice] = useState(pick ?? "");
  const [shownPick, setShownPick] = useState(pick);
  if (pick && pick !== shownPick) {
    setShownPick(pick);
    setChoice(pick);
  }
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shownPick && !pickMissing) return;
    // After layout settles, bring the picker and its chosen row into view.
    const frame = requestAnimationFrame(() => {
      pickerRef.current?.scrollIntoView({ block: "center" });
      pickerRef.current
        ?.querySelector('[aria-checked="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [shownPick, pickMissing]);
  const chosen = items?.find((i) => i.key === choice);
  const placedKeys = new Set(
    draft.placements.flatMap((p) =>
      p.ownedItemId ? [`owned:${p.ownedItemId}`] : p.listingId ? [`listing:${p.listingId}`] : [],
    ),
  );
  const [calibrationWall, setCalibrationWall] = useState(initial.scene.walls[0]?.id ?? "");
  const [knownLength, setKnownLength] = useState(4);
  if (!dirty && (revision > base || baseView !== viewKey)) {
    setBaseView(viewKey);
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
    change({
      ...draft,
      placements: [
        ...draft.placements,
        {
          id,
          label: chosen?.title.slice(0, 120) ?? `Your ${kind}`,
          ...(chosen?.ownedItemId
            ? { ownedItemId: chosen.ownedItemId }
            : chosen?.listingId
              ? { listingId: chosen.listingId }
              : {}),
          kind,
          ...p,
          ...itemSize(kind),
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
    const submitted = draft;
    try {
      setBase(await onSave(submitted, base));
      if (latest.current === submitted) setDirty(false);
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-divider border-b px-3 py-2">
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
                variant={mode === id ? "soft" : "ghost"}
                className={mode === id ? undefined : "text-primary!"}
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
            className="h-9 min-w-0 max-w-[240px] truncate rounded-md border border-divider bg-card px-2.5 text-[15px] text-primary outline-none focus:border-fb"
            value={room.id}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {draft.scene.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {(draft.scene.appearance || mode === "dollhouse") && (
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              {draft.scene.appearance && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-fb"
                    checked={details}
                    onChange={(e) => setDetails(e.target.checked)}
                  />
                  Show observed finishes and fixtures
                </label>
              )}
              {mode === "dollhouse" && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-fb"
                    checked={cutaway}
                    onChange={(e) => setCutaway(e.target.checked)}
                  />
                  Cutaway walls
                </label>
              )}
            </div>
          )}
        </div>
        <div className="relative h-[480px] min-h-[320px]">
          {mode === "plan" ? (
            <UnitPlan
              scene={draft.scene}
              placements={draft.placements}
              selected={selected}
              onSelect={setSelected}
              onMove={
                onSave
                  ? (id, x, z) =>
                      change({
                        ...draft,
                        placements: draft.placements.map((p) => (p.id === id ? { ...p, x, z } : p)),
                      })
                  : undefined
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
                jobId={jobId}
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
          <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-card/95 px-2.5 py-1 text-[13px] text-secondary shadow-base">
            {draft.scene.appearance && details
              ? "Photo-informed reconstruction"
              : "Estimated layout"}{" "}
            · verify dimensions
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-divider border-t px-3 py-2.5">
          <p className="min-w-0 max-w-lg text-[13px] text-secondary leading-4">
            {mode === "walk"
              ? "Click the scene, then W/S to walk and A/D to turn. Drag to look. Choose a room to jump there."
              : mode === "plan"
                ? onSave
                  ? "Drag items to move them. Drag the blue corner handles to correct the layout."
                  : "Review room outlines and openings before applying this layout."
                : "Drag to orbit. Scroll or pinch to zoom. Switch to Floor plan to edit."}
          </p>
          {mode === "walk" && (
            <div className="flex flex-wrap gap-1">
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
        <p
          role="alert"
          className="rounded-lg bg-card p-3 text-[15px] text-negative leading-5 shadow-base"
        >
          {problems.join(". ")}. Correct the floor plan before saving. The 3D view shows the last
          valid layout.
        </p>
      )}
      {remoteChanged && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 text-[15px] text-primary leading-5 shadow-base"
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
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {onSave && (
          <Card className="min-w-0 space-y-4 p-4">
            <div ref={pickerRef} className="scroll-mt-20 space-y-3">
              <h2 className="font-bold text-[17px] text-primary leading-5">Place an item</h2>
              <ItemPicker items={items} value={choice} placed={placedKeys} onChange={setChoice} />
              {pickMissing && (
                <p className="text-[13px] text-negative">
                  That item isn't available to place any more. Choose another one.
                </p>
              )}
              <p className="text-[15px] text-primary leading-5">
                {chosen ? (
                  <>
                    Choose a shape for <span className="font-semibold">{chosen.title}</span>.
                  </>
                ) : (
                  "Choose a shape."
                )}{" "}
                <span className="block text-[13px] text-secondary leading-4">
                  Shapes are placeholders. Enter the item's actual dimensions before judging fit.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {ITEM_KINDS.map((k) => (
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
            </div>
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
              <div className="space-y-3 border-divider border-t pt-4">
                <label className={labelClass}>
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
                <label className="flex cursor-pointer items-center gap-2 text-[15px] text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-fb"
                    checked={selectedItem.measured}
                    onChange={(e) => editItem({ measured: e.target.checked })}
                  />
                  I entered measured item dimensions
                </label>
                <label className="flex items-center gap-2 text-[15px] text-primary">
                  Color
                  <input
                    type="color"
                    className="h-8 w-10 cursor-pointer rounded-md border border-divider bg-card p-0.5"
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
                <p key={`${p.id}-${error}`} className="text-[13px] text-negative">
                  {p.label}: {error}
                </p>
              )),
            )}
          </Card>
        )}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 font-bold text-[17px] text-primary leading-5">
              Layout and evidence
            </h2>
            <div className="space-y-1.5">
              {draft.scene.notes.map((note, i) => (
                <p key={i} className="text-[13px] text-secondary leading-[18px]">
                  {note}
                </p>
              ))}
            </div>
            <p className="mt-3 text-[15px] text-primary leading-5">
              {room.name}: {room.evidence.basis}. Sources:{" "}
              {room.evidence.sources.join(", ") || "Manual layout"}.
            </p>
            {(draft.scene.appearance || onSave) && (
              <div className="mt-3 divide-y divide-divider border-divider border-t">
                {draft.scene.appearance && (
                  <details className="group">
                    <summary className={summaryClass}>
                      Observed finishes and fixtures ({draft.scene.appearance.objects.length})
                      {chevron}
                    </summary>
                    <div className="pb-3">
                      <p className="mb-2 text-[13px] text-secondary leading-[18px]">
                        Materials and shapes are inferred from the media. Surface texture, trim
                        profiles and hidden details are approximations.
                      </p>
                      {draft.scene.appearance.notes.map((note, i) => (
                        <p key={i} className="mb-2 text-[13px] text-secondary leading-[18px]">
                          {note}
                        </p>
                      ))}
                      <ul className="space-y-1">
                        {draft.scene.appearance.objects.map((o) => (
                          <li key={o.id} className="text-[13px] text-primary leading-[18px]">
                            {o.label}{" "}
                            <span className="text-secondary">
                              · sources: {o.sources.join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )}
                {onSave && (
                  <details className="group">
                    <summary className={summaryClass}>
                      Edit room corners
                      {chevron}
                    </summary>
                    <div className="space-y-2 pb-3">
                      {draft.scene.appearance && (
                        <p className="text-[13px] text-secondary leading-[18px]">
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
                  <details className="group">
                    <summary className={summaryClass}>
                      Calibrate scale from a measured wall
                      {chevron}
                    </summary>
                    <div className="space-y-2 pb-3">
                      <p className="text-[13px] text-secondary leading-[18px]">
                        Select a wall and enter its measured length. This scales the unit and its
                        inferred fixtures uniformly. Your placed item's dimensions stay unchanged.
                      </p>
                      <label className={labelClass}>
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
                        className="mt-1"
                        variant="secondary"
                        disabled={knownLength < 0.3 || knownLength > 50}
                        onClick={calibrate}
                      >
                        Apply measured scale
                      </Button>
                    </div>
                  </details>
                )}
                {onSave && (
                  <details className="group">
                    <summary className={summaryClass}>
                      Start a measured rectangular room
                      {chevron}
                    </summary>
                    <div className="space-y-2 pb-3">
                      <p className="text-[13px] text-secondary leading-[18px]">
                        Replaces the current walls and rooms. Furniture stays and may need
                        repositioning.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label="Room width (m)" value={width} onChange={setWidth} />
                        <NumberField label="Room length (m)" value={length} onChange={setLength} />
                      </div>
                      <Button
                        className="mt-1"
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
                    </div>
                  </details>
                )}
              </div>
            )}
          </Card>
          {sidebar}
        </div>
      </div>
      {onSave && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg bg-card p-3 shadow-elevated">
          <Button
            variant="primary"
            onClick={save}
            disabled={busy || !dirty || !!problems.length || remoteChanged}
          >
            {busy ? "Saving…" : "Save layout"}
          </Button>
          <span role="status" className="text-[13px] text-secondary">
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
    <label className={labelClass}>
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
