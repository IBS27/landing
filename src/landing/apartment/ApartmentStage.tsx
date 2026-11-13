import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronDown,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Footprints,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import {
  Component,
  lazy,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { toListing, toUnit } from "@/landing/links";
import { cn, plural, price } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { ApartmentItem, ApartmentView } from "../../../convex/apartment";
import { type Placement, placementProblems, type UnitScene } from "../../../convex/lib/unitScene";
import type { ItemAssets, WalkInput } from "../move-in/unit/UnitCanvas";
import type { CanvasHandle, StageView } from "./ApartmentCanvas";
import {
  arrowStep,
  overOpening,
  type Pose,
  snapToWall,
  stayInRooms,
  wallMounted,
  wallY,
  yaw,
} from "./placing";
import "./apartment.css";

const ApartmentCanvas = lazy(() =>
  import("./ApartmentCanvas").then((m) => ({ default: m.ApartmentCanvas })),
);

/**
 * Landing Home's Apartment tab (#150): the person's place as a full-bleed 3D
 * model they furnish from the chat. Reads `api.apartment.get` itself.
 */
export type ApartmentStageProps = {
  /** Whether the Apartment tab is showing. Rendering pauses when it isn't. */
  active: boolean;
  /** A placed item to select and frame (a chat card was clicked). */
  focusItemId?: string | null;
  /** Sends a message to the chat, as if the person typed it. */
  onAsk: (text: string) => void;
};

type Unit = NonNullable<ApartmentView["unit"]>;
type Place = NonNullable<ApartmentView["place"]>;

/** What the tabs (above) and the chat dock (below) cover, for framing the model between them. */
const INSET = { top: 84, bottom: 236 } as const;
const UNDO_MS = 5000;
const NUDGE_SAVE_MS = 350;
const SUGGESTIONS = [
  "Make it cozy and warm under $1,500",
  "Mid-century with light wood under $2,000",
  "Just the basics under $800",
];

export function ApartmentStage({ active, focusItemId = null, onAsk }: ApartmentStageProps) {
  // Nothing loads until the tab is first opened; after that it keeps its state while hidden.
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  if (!opened) return null;
  return <Stage active={active} focusItemId={focusItemId} onAsk={onAsk} />;
}

function Stage({ active, focusItemId, onAsk }: Required<ApartmentStageProps>) {
  const viewer = useViewer();
  const data = useQ(api.apartment.get, {});
  const root = useRef<HTMLDivElement>(null);
  const dock = useDock(root);
  const place = data?.place ?? null;
  const unit = data?.unit ?? null;

  // A place without a unit, or with one nothing was built for yet: make it and start its build, once.
  const build = useM(api.apartment.build);
  const [buildFailed, setBuildFailed] = useState(false);
  const tried = useRef(new Set<string>());
  const startBuild = useCallback(() => {
    setBuildFailed(false);
    build({}).catch(() => setBuildFailed(true));
  }, [build]);
  const buildKey =
    place && (!unit || (unit.state === "starter" && unit.canBuild))
      ? `${viewer._id}:${place.listingId ?? "place"}:${unit?.id ?? "new"}`
      : null;
  useEffect(() => {
    if (!active || !buildKey || tried.current.has(buildKey)) return;
    tried.current.add(buildKey);
    startBuild();
  }, [active, buildKey, startBuild]);

  return (
    <div
      ref={root}
      className={cn("apt-stage", !active && "apt-off")}
      inert={!active}
      aria-hidden={!active}
    >
      {data === undefined ? null : !place ? (
        <div className="apt-center apt-glass rounded-2xl p-5 text-center">
          <p className="font-bold text-[17px] text-primary">Your apartment</p>
          <p className="mt-1.5 text-[14px] text-secondary leading-snug">
            Choose a place and it shows up here in 3D, ready to furnish from Marketplace.
          </p>
          <button
            type="button"
            onClick={() => onAsk("Rooms in my budget")}
            className="mt-4 rounded-full bg-btn-primary px-4 py-2 font-semibold text-[14px] text-white hover:bg-btn-primary-hover"
          >
            Rooms in my budget
          </button>
        </div>
      ) : unit ? (
        <Apartment
          key={unit.id}
          active={active}
          place={place}
          unit={unit}
          items={data.items}
          spent={data.spent}
          aiOn={data.aiOn}
          buildFailed={buildFailed}
          onBuild={startBuild}
          dock={dock}
          focusItemId={focusItemId}
          onAsk={onAsk}
        />
      ) : (
        <>
          <PlaceCard place={place} />
          <Status>
            {buildFailed ? (
              <>
                <span>Your apartment couldn't be set up.</span>
                <StatusAction onClick={startBuild}>Try again</StatusAction>
              </>
            ) : (
              <>
                <i className="apt-pulse" />
                <span>Setting up your apartment</span>
              </>
            )}
          </Status>
        </>
      )}
    </div>
  );
}

const tidy = (pose: Pose): Pose => ({
  x: Math.round(pose.x * 1000) / 1000,
  z: Math.round(pose.z * 1000) / 1000,
  rotation: Math.round(yaw(pose.rotation) * 10000) / 10000,
  ...(pose.y === undefined ? {} : { y: Math.round(pose.y * 1000) / 1000 }),
});
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const samePose = (p: Placement, o: Pose) =>
  near(p.x, o.x) &&
  near(p.z, o.z) &&
  near(p.rotation, o.rotation) &&
  near(p.y ?? 0, o.y ?? p.y ?? 0);

function Apartment({
  active,
  place,
  unit,
  items,
  spent,
  aiOn,
  buildFailed,
  onBuild,
  dock,
  focusItemId,
  onAsk,
}: {
  active: boolean;
  place: Place;
  unit: Unit;
  items: ApartmentItem[];
  spent: number;
  aiOn: boolean;
  buildFailed: boolean;
  onBuild: () => void;
  dock: Dock;
  focusItemId: string | null;
  onAsk: (text: string) => void;
}) {
  const unitId = unit.id;
  const dark = useDark();
  const still = useReducedMotion();
  const [view, setView] = useState<StageView>("overview");
  const [home, setHome] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const walk = useRef<WalkInput>({ forward: 0, turn: 0 });
  const handle = useRef<CanvasHandle | null>(null);

  // Query results are new objects on every update: keep the scene and each item's model by content.
  const sceneKey = useMemo(() => JSON.stringify(unit.scene), [unit.scene]);
  const scene = useMemo(() => JSON.parse(sceneKey) as UnitScene, [sceneKey]);
  const kept = useRef(new Map<string, { key: string; asset: ItemAssets }>());
  const assets = useMemo(() => {
    const next = new Map<string, ItemAssets>();
    for (const item of items) {
      const key = `${item.photo ?? ""}|${item.model ? JSON.stringify(item.model) : ""}`;
      const was = kept.current.get(item.id);
      const asset = was?.key === key ? was.asset : { model: item.model, photo: item.photo };
      kept.current.set(item.id, { key, asset });
      next.set(item.id, asset);
    }
    for (const id of [...kept.current.keys()]) if (!next.has(id)) kept.current.delete(id);
    return next;
  }, [items]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /* ── What is shown: the saved placements, with moves not yet saved and without removals not yet sent ── */
  const [moved, setMoved] = useState<ReadonlyMap<string, Pose>>(new Map());
  // The same poses, readable at once: key presses can arrive faster than renders.
  const latest = useRef(new Map<string, Pose>());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const placements = useMemo(
    () =>
      unit.placements
        .filter((p) => !hidden.has(p.id))
        .map((p) => {
          const o = moved.get(p.id);
          return o
            ? {
                ...p,
                x: o.x,
                z: o.z,
                rotation: o.rotation,
                ...(o.y === undefined ? {} : { y: o.y }),
              }
            : p;
        }),
    [unit.placements, moved, hidden],
  );
  // Once the saved placement matches (or the item is gone), the local copy is dropped.
  useEffect(() => {
    const saved = new Map(unit.placements.map((p) => [p.id, p]));
    for (const [id, pose] of [...latest.current]) {
      const p = saved.get(id);
      if (!p || samePose(p, pose)) latest.current.delete(id);
    }
    setMoved((prev) => {
      const next = new Map(prev);
      for (const [id, pose] of prev) {
        const p = saved.get(id);
        if (!p || samePose(p, pose)) next.delete(id);
      }
      return next.size === prev.size ? prev : next;
    });
    setHidden((prev) => {
      const next = new Set([...prev].filter((id) => saved.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [unit.placements]);

  // Items placed after the tab opened settle in; the ones it opened with are just there.
  const seen = useRef<Set<string> | null>(null);
  const arrivals = useRef(new Set<string>());
  if (!seen.current) seen.current = new Set(unit.placements.map((p) => p.id));
  for (const p of unit.placements)
    if (!seen.current.has(p.id)) {
      seen.current.add(p.id);
      arrivals.current.add(p.id);
    }

  const flash = useCallback((text: string) => setNote(text), []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  /* ── Saving moves: one mutation per drag; key nudges are saved once they pause ── */
  const moveItem = useM(api.apartment.moveItem);
  const waiting = useRef(new Map<string, { pose: Pose; timer: ReturnType<typeof setTimeout> }>());
  const save = useCallback(
    (id: string, pose: Pose) => {
      waiting.current.delete(id);
      moveItem({ unitId, itemId: id, ...pose }).catch(() => {
        latest.current.delete(id);
        setMoved((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        flash("That move couldn't be saved.");
      });
    },
    [moveItem, unitId, flash],
  );
  const move = useCallback(
    (id: string, to: Pose, delay = 0) => {
      const pose = tidy(to);
      latest.current.set(id, pose);
      setMoved((prev) => new Map(prev).set(id, pose));
      const was = waiting.current.get(id);
      if (was) clearTimeout(was.timer);
      if (delay) waiting.current.set(id, { pose, timer: setTimeout(() => save(id, pose), delay) });
      else save(id, pose);
    },
    [save],
  );
  const saveNow = useCallback(
    (only?: string) => {
      for (const [id, w] of [...waiting.current]) {
        if (only && id !== only) continue;
        clearTimeout(w.timer);
        save(id, w.pose);
      }
    },
    [save],
  );

  /* ── Removing: at once on screen, sent when the undo window passes ── */
  const removeItem = useM(api.apartment.removeItem);
  const leaving = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const removeNow = useCallback(() => {
    const l = leaving.current;
    if (!l) return;
    leaving.current = null;
    clearTimeout(l.timer);
    setUndo(null);
    removeItem({ unitId, itemId: l.id }).catch(() => {
      setHidden((prev) => new Set([...prev].filter((id) => id !== l.id)));
      flash("That item couldn't be removed.");
    });
  }, [removeItem, unitId, flash]);
  const remove = useCallback(
    (id: string, title: string) => {
      removeNow();
      saveNow(id);
      setHidden((prev) => new Set(prev).add(id));
      setSelected((s) => (s === id ? null : s));
      setUndo({ id, title });
      leaving.current = { id, timer: setTimeout(removeNow, UNDO_MS) };
    },
    [removeNow, saveNow],
  );
  const restore = useCallback(() => {
    const l = leaving.current;
    if (!l) return;
    clearTimeout(l.timer);
    leaving.current = null;
    setHidden((prev) => new Set([...prev].filter((id) => id !== l.id)));
    setUndo(null);
    setSelected(l.id);
  }, []);

  // Nothing waits past the tab being hidden, the page closing or the stage going away.
  const flush = useCallback(() => {
    saveNow();
    removeNow();
  }, [saveNow, removeNow]);
  useEffect(() => {
    if (!active) flush();
  }, [active, flush]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  /* ── The selected item ── */
  const current = placements.find((p) => p.id === selected);
  const shown = current;
  const currentItem = current ? itemById.get(current.id) : undefined;
  const onWall = !!current && wallMounted(current);
  const problem = useMemo(() => {
    if (!current) return null;
    const found = placementProblems(scene, current)[0];
    if (found) return found.replace(/^Item /, "").replace(/^./, (c) => c.toUpperCase());
    if (!onWall) return null;
    const snap = snapToWall(scene, current, current);
    return snap && overOpening(scene, snap, { ...current, y: current.y ?? 0 })
      ? "Covers a door or window"
      : null;
  }, [scene, current, onWall]);

  const turn = useCallback(
    (direction: 1 | -1, quarter: boolean) => {
      if (!shown || onWall) return;
      const current = { ...shown, ...latest.current.get(shown.id) };
      const step = quarter ? Math.PI / 2 : Math.PI / 12;
      move(
        current.id,
        { ...current, rotation: current.rotation + direction * step },
        NUDGE_SAVE_MS,
      );
    },
    [shown, onWall, move],
  );
  const nudge = useCallback(
    (key: "up" | "down" | "left" | "right", big: boolean) => {
      if (!shown) return;
      const current = { ...shown, ...latest.current.get(shown.id) };
      const step = big ? 0.25 : 0.05;
      const azimuth = handle.current?.azimuth() ?? 0;
      if (!onWall) {
        const d = arrowStep(azimuth, key);
        const to = stayInRooms(
          scene,
          { x: current.x + d.x * step, z: current.z + d.z * step },
          current,
        );
        move(current.id, { ...current, x: to.x, z: to.z }, NUDGE_SAVE_MS);
        return;
      }
      const here = snapToWall(scene, current, current);
      if (!here) return;
      if (key === "up" || key === "down") {
        const y = wallY(
          (current.y ?? 0) + (key === "up" ? step : -step),
          current.height,
          here.wallHeight,
        );
        move(current.id, { ...current, y }, NUDGE_SAVE_MS);
        return;
      }
      // Along the wall, towards whichever end is to that side of the screen.
      const along = { x: Math.cos(current.rotation), z: -Math.sin(current.rotation) };
      const side = along.x * Math.cos(azimuth) - along.z * Math.sin(azimuth) < 0 ? -1 : 1;
      const s = step * side * (key === "right" ? 1 : -1);
      const to = snapToWall(
        scene,
        { x: current.x + along.x * s, z: current.z + along.z * s },
        current,
      );
      if (!to) return;
      move(
        current.id,
        {
          x: to.x,
          z: to.z,
          rotation: to.rotation,
          y: wallY(current.y ?? 0, current.height, to.wallHeight),
        },
        NUDGE_SAVE_MS,
      );
    },
    [shown, onWall, scene, move],
  );

  // Keys act on the selected item, never while typing (the chat input is on this page).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "Escape") {
        if (listOpen) setListOpen(false);
        else if (selected) setSelected(null);
        else return;
        e.preventDefault();
        return;
      }
      if (!current || view !== "overview") return;
      const arrow = (
        { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const
      )[e.key];
      if (arrow) nudge(arrow, e.shiftKey);
      else if (e.key === "[" || e.key === "{") turn(1, e.shiftKey);
      else if (e.key === "]" || e.key === "}" || e.key === "r" || e.key === "R")
        turn(-1, e.shiftKey);
      else if (e.key === "Delete" || e.key === "Backspace")
        remove(current.id, currentItem?.title ?? current.label);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, listOpen, selected, current, currentItem, view, nudge, turn, remove]);

  /* ── Framing an item: from the list, or because the chat asked ── */
  const focusCount = useRef(0);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const frame = useCallback((id: string) => {
    setView("overview");
    setSelected(id);
    setFocus({ id, n: ++focusCount.current });
  }, []);
  const asked = useRef<string | null>(null);
  const askedHere = !!focusItemId && placements.some((p) => p.id === focusItemId);
  useEffect(() => {
    if (!focusItemId) asked.current = null;
    else if (askedHere && asked.current !== focusItemId) {
      asked.current = focusItemId;
      frame(focusItemId);
    }
  }, [focusItemId, askedHere, frame]);

  const setMode = (next: StageView) => {
    walk.current = { forward: 0, turn: 0 };
    if (next === "overview" && view === "overview") setHome((n) => n + 1);
    if (next === "walk") {
      setSelected(null);
      setListOpen(false);
    }
    setView(next);
  };

  /* ── The 3D view itself ── */
  const [lost, setLost] = useState(false);
  const markLost = useCallback(() => setLost(true), []);
  const [attempt, setAttempt] = useState(0);
  const noWebgl = !webglSupported();

  /* ── Where the build stands ── */
  const job = useQ(api.ai.jobs.get, unit.jobId ? { jobId: unit.jobId } : "skip");
  const regenerate = useM(api.unitScenes.requestGeneration);
  const retry = () =>
    regenerate({
      id: unitId,
      revision: unit.revision,
      detailsOnly: unit.state === "partial",
    }).catch(() => flash("The build couldn't start. Try again in a moment."));
  const editor = toUnit({ unit: unitId });
  const why = unit.explanation ? clip(unit.explanation, 140) : null;
  const status: ReactNode = note ? (
    <span>{note}</span>
  ) : buildFailed ? (
    <>
      <span>Your apartment couldn't be built.</span>
      <StatusAction onClick={onBuild}>Try again</StatusAction>
    </>
  ) : unit.state === "building" ? (
    <>
      <i className="apt-pulse" />
      <span>
        {job?.progress
          ? `${job.progress.label.replace(/[.…]+$/, "")} · ${job.progress.done} of ${job.progress.total}`
          : "Building your apartment"}
      </span>
    </>
  ) : unit.state === "failed" || (unit.state === "partial" && !dismissed) ? (
    <>
      <span>
        {why ??
          (unit.state === "failed"
            ? "Your apartment couldn't be built from its photos."
            : "Some finishes and fixtures couldn't be added.")}
      </span>
      {aiOn && unit.canBuild && <StatusAction onClick={retry}>Try again</StatusAction>}
      <Link {...editor} className="shrink-0 font-semibold text-link hover:underline">
        Edit layout
      </Link>
      {unit.state === "partial" && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="-mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-hover"
        >
          <X size={14} />
        </button>
      )}
    </>
  ) : unit.state === "starter" && !unit.canBuild ? (
    <>
      <span>An example room until photos or a floor plan are added.</span>
      <Link {...editor} className="shrink-0 font-semibold text-link hover:underline">
        Add them
      </Link>
    </>
  ) : null;

  const leavingItem = undo ? itemById.get(undo.id) : undefined;
  const total = Math.max(
    0,
    spent - (leavingItem?.available && leavingItem.listingId ? (leavingItem.price ?? 0) : 0),
  );
  const budget = unit.furnishing?.budget ?? null;
  const showCanvas = !noWebgl && !lost;

  return (
    <>
      {showCanvas ? (
        <CanvasBoundary key={attempt} onError={markLost}>
          <Suspense fallback={null}>
            <div className="apt-canvas">
              <ApartmentCanvas
                active={active}
                dark={dark}
                still={still}
                scene={scene}
                placements={placements}
                assets={assets}
                view={view}
                selected={selected}
                warn={!!problem}
                arrivals={arrivals.current}
                focus={focus}
                home={home}
                inset={INSET}
                walk={walk}
                handle={handle}
                onSelect={setSelected}
                onMove={move}
                onLost={markLost}
              />
            </div>
          </Suspense>
        </CanvasBoundary>
      ) : (
        <div className="apt-center apt-glass rounded-2xl p-5 text-center">
          <p className="font-bold text-[17px] text-primary">3D isn't available right now</p>
          <p className="mt-1.5 text-[14px] text-secondary leading-snug">
            Your apartment and everything in it are saved. You can still arrange it on the floor
            plan.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              {...editor}
              className="rounded-full bg-btn-primary px-4 py-2 font-semibold text-[14px] text-white hover:bg-btn-primary-hover"
            >
              Open the floor plan
            </Link>
            {!noWebgl && (
              <button
                type="button"
                onClick={() => {
                  setLost(false);
                  setAttempt((n) => n + 1);
                }}
                className="rounded-full bg-btn px-4 py-2 font-semibold text-[14px] text-btn-text"
              >
                Try 3D again
              </button>
            )}
          </div>
        </div>
      )}

      <div className="apt-left">
        <PlaceCard place={place} editor={editor} />
        {showCanvas && (
          <div
            className="apt-glass apt-seg flex gap-0.5 rounded-full p-1"
            role="group"
            aria-label="View"
          >
            {(
              [
                ["overview", "Overview", Box],
                ["walk", "Walk", Footprints],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setMode(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-[13px]",
                  view === id ? "bg-btn text-primary" : "text-secondary hover:bg-hover",
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {placements.length > 0 && (
        <ItemList
          open={listOpen}
          onOpen={setListOpen}
          placements={placements}
          itemById={itemById}
          selected={selected}
          summary={
            <>
              {plural(placements.length, "item")}
              {total > 0 && ` · ${price(total)}`}
              {budget !== null && total > 0 && (
                <span className="font-normal text-secondary"> of {price(budget)}</span>
              )}
            </>
          }
          onPick={(id) => {
            setListOpen(false);
            frame(id);
          }}
        />
      )}

      {status && <Status>{status}</Status>}

      <div
        className="apt-bottom"
        style={{ bottom: dock.above + 12, ...(dock.center === null ? {} : { left: dock.center }) }}
      >
        {undo && (
          <div
            role="status"
            className="apt-glass flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3.5 text-[13px]"
          >
            <span className="max-w-[260px] truncate text-primary">Removed {undo.title}</span>
            <button
              type="button"
              onClick={restore}
              className="rounded-full px-2.5 py-1 font-semibold text-link hover:bg-hover"
            >
              Undo
            </button>
          </div>
        )}
        {view === "walk" ? (
          <WalkKeys input={walk} />
        ) : current && showCanvas ? (
          <div
            role="toolbar"
            aria-label={currentItem?.title ?? current.label}
            className="apt-glass flex items-center gap-0.5 rounded-full p-1"
          >
            <Thumb photo={currentItem?.photo ?? null} color={current.color} size={32} />
            <div className="min-w-0 max-w-[220px] px-2">
              <p className="truncate font-semibold text-[13px] text-primary leading-tight">
                {currentItem?.title ?? current.label}
              </p>
              <p
                className={cn(
                  "truncate text-[12px] leading-tight",
                  problem ? "text-[#b96a00] dark:text-[#f0a63c]" : "text-secondary",
                )}
              >
                {problem ?? itemLine(currentItem)}
              </p>
            </div>
            <span className="mx-1 h-5 w-px bg-divider" />
            {!onWall && (
              <>
                <button
                  type="button"
                  className="apt-tool"
                  title="Turn left ([) · Shift for a quarter turn"
                  aria-label="Turn left"
                  onClick={(e) => turn(1, e.shiftKey)}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  className="apt-tool"
                  title="Turn right (]) · Shift for a quarter turn"
                  aria-label="Turn right"
                  onClick={(e) => turn(-1, e.shiftKey)}
                >
                  <RotateCw size={16} />
                </button>
              </>
            )}
            {currentItem?.listingId && currentItem.available && (
              <Link
                {...toListing(currentItem.listingId)}
                className="apt-tool"
                title="Open the listing"
                aria-label="Open the listing"
              >
                <ExternalLink size={16} />
              </Link>
            )}
            <button
              type="button"
              className="apt-tool"
              title="Remove (Delete)"
              aria-label="Remove"
              onClick={() => remove(current.id, currentItem?.title ?? current.label)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          placements.length === 0 &&
          !undo &&
          showCanvas &&
          // The chat dock's own chips already offer this when it has any.
          !dock.offers &&
          unit.state !== "building" && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onAsk(s)}
                  className="apt-glass apt-chip rounded-full px-3 py-1.5 text-[13px] text-primary hover:brightness-95"
                >
                  {s}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </>
  );
}

const clip = (text: string, max: number) => {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

const itemLine = (item?: ApartmentItem) =>
  !item
    ? "Placed by you"
    : !item.available
      ? "Unavailable"
      : item.price !== null
        ? price(item.price)
        : item.ownedItemId
          ? "Yours"
          : "Placed by you";

function PlaceCard({ place, editor }: { place: Place; editor?: ReturnType<typeof toUnit> }) {
  return (
    <div className="apt-glass max-w-full rounded-2xl px-3.5 py-2">
      <p className="truncate font-semibold text-[14px] text-primary">{place.title}</p>
      <p className="truncate text-[12px] text-secondary">
        {place.neighborhood ?? "Your place"}
        {editor && (
          <>
            {" · "}
            <Link {...editor} className="font-semibold text-link hover:underline">
              Edit layout
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="apt-status apt-glass flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[13px] text-primary"
    >
      {children}
    </div>
  );
}
function StatusAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 font-semibold text-link hover:underline"
    >
      {children}
    </button>
  );
}

function Thumb({ photo, color, size }: { photo: string | null; color: string; size: number }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed ? (
    <img
      src={photo}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="flex-none rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex-none rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

/** "5 items · $1,240 of $1,500", opening the list of what is placed. */
function ItemList({
  open,
  onOpen,
  placements,
  itemById,
  selected,
  summary,
  onPick,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  placements: Placement[];
  itemById: ReadonlyMap<string, ApartmentItem>;
  selected: string | null;
  summary: ReactNode;
  onPick: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) onOpen(false);
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [open, onOpen]);
  return (
    <div ref={box} className="apt-right">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="apt-glass apt-chip flex items-center gap-1 rounded-full py-1.5 pr-2.5 pl-3.5 font-semibold text-[13px] text-primary"
      >
        <span>{summary}</span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="apt-glass max-h-[min(340px,calc(100vh-420px))] min-h-[96px] w-[292px] overflow-y-auto rounded-2xl p-1.5"
          onWheel={(e) => e.stopPropagation()}
        >
          {placements.map((p) => {
            const item = itemById.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-hover",
                  selected === p.id && "bg-highlight",
                )}
              >
                <Thumb photo={item?.photo ?? null} color={p.color} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[13px] text-primary">
                    {item?.title ?? p.label}
                  </span>
                  <span className="block truncate text-[12px] text-secondary">
                    {itemLine(item)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Walking: the keys, and the same four moves as buttons to hold (touch has no keys). */
function WalkKeys({ input }: { input: RefObject<WalkInput> }) {
  const hold = (forward: number, turn: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      input.current = { forward, turn };
    },
    onPointerUp: () => {
      input.current = { forward: 0, turn: 0 };
    },
    onPointerCancel: () => {
      input.current = { forward: 0, turn: 0 };
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        input.current = { forward, turn };
      }
    },
    onKeyUp: () => {
      input.current = { forward: 0, turn: 0 };
    },
    onBlur: () => {
      input.current = { forward: 0, turn: 0 };
    },
  });
  return (
    <div className="apt-glass flex items-center gap-0.5 rounded-full p-1 text-[12px] text-secondary">
      <button type="button" className="apt-tool" aria-label="Turn left" {...hold(0, 1)}>
        <CornerUpLeft size={16} />
      </button>
      <button type="button" className="apt-tool" aria-label="Walk forward" {...hold(1, 0)}>
        <ArrowUp size={16} />
      </button>
      <button type="button" className="apt-tool" aria-label="Walk back" {...hold(-1, 0)}>
        <ArrowDown size={16} />
      </button>
      <button type="button" className="apt-tool" aria-label="Turn right" {...hold(0, -1)}>
        <CornerUpRight size={16} />
      </button>
      <span className="mx-1 h-5 w-px bg-divider" />
      <span className="flex items-center gap-1 pr-2.5">
        <kbd className="apt-key">W</kbd>
        <kbd className="apt-key">S</kbd> walk
        <kbd className="apt-key ml-1.5">A</kbd>
        <kbd className="apt-key">D</kbd> turn · drag to look
      </span>
    </div>
  );
}

class CanvasBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Apartment 3D view failed", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

let webgl: boolean | undefined;
function webglSupported() {
  if (webgl === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (changed) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", changed);
      return () => m.removeEventListener("change", changed);
    },
    () => window.matchMedia(query).matches,
  );
}
const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
/** The app's dark mode: the `dark` class on the root element (src/app/theme.tsx). */
function useDark() {
  return useSyncExternalStore(
    (changed) => {
      const o = new MutationObserver(changed);
      o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => o.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
  );
}

type Dock = { above: number; center: number | null; offers: boolean };
/**
 * Where the chat dock is, so the item tools sit just above it: the height it
 * covers from the stage's bottom, its centre (it shifts when past chats open),
 * and whether it is showing suggestion chips of its own.
 */
function useDock(root: RefObject<HTMLDivElement | null>): Dock {
  const [dock, setDock] = useState<Dock>({ above: 200, center: null, offers: false });
  useEffect(() => {
    // The dock is a sibling somewhere in Landing Home's stage, which this fills.
    const stage = root.current?.closest<HTMLElement>(".lh-stage") ?? root.current?.parentElement;
    const el = stage?.querySelector<HTMLElement>(".lh-dock");
    if (!stage || !el) return;
    const measure = () => {
      const s = stage.getBoundingClientRect(),
        d = el.getBoundingClientRect();
      if (!d.height || !s.height) return;
      const next = {
        above: Math.round(Math.min(s.bottom - d.top, s.height * 0.6)),
        center: Math.round(d.left + d.width / 2 - s.left),
        // Its own suggestion chips (anything to press besides the message log and the input).
        offers: !!el.querySelector(":scope > :not(.lh-log):not(form) button"),
      };
      setDock((prev) =>
        prev.above === next.above && prev.center === next.center && prev.offers === next.offers
          ? prev
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(stage);
    const changes = new MutationObserver(measure);
    changes.observe(el, { childList: true, subtree: true });
    el.addEventListener("transitionend", measure);
    measure();
    return () => {
      observer.disconnect();
      changes.disconnect();
      el.removeEventListener("transitionend", measure);
    };
  }, [root]);
  return dock;
}
