import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { type EngineProps, GameFrame, type Phase, randInt, useKeys, useReport } from "./kit";

/**
 * Match-3: swap neighbours to line up three or more. Each level has a move
 * budget and a target score; cascades multiply the points.
 */

const N = 8;
const CELL = 46;
const KINDS = 6;
const MOVES = 22;
const target = (level: number) => 1200 + (level - 1) * 900;

type Piece = { id: number; kind: number; drop: number };
type Grid = (Piece | null)[];

type Skin = { pieces: string[]; board: string; cell: string; gems?: boolean };
const SKINS: Record<string, Skin> = {
  "orchard-friends": {
    pieces: ["🍎", "🍋", "🍇", "🍐", "🫐", "🍊"],
    board: "linear-gradient(160deg, #8cc84b, #4f8f2f)",
    cell: "rgba(255,255,255,0.28)",
  },
  "candy-valley": {
    pieces: ["🍬", "🍭", "🧁", "🍩", "🍫", "🍪"],
    board: "linear-gradient(160deg, #f78fc2, #b9387a)",
    cell: "rgba(255,255,255,0.3)",
  },
  "gem-cascade": {
    pieces: [],
    gems: true,
    board: "linear-gradient(160deg, #0f5f66, #082f3a)",
    cell: "rgba(255,255,255,0.08)",
  },
};

const GEMS = [
  { c: ["#ff8a8a", "#d61f1f", "#7d0b0b"], pts: "6,10 34,10 40,20 20,38 0,20" },
  { c: ["#8fd3ff", "#1c7ed6", "#0b3f7a"], pts: "20,1 39,20 20,39 1,20" },
  { c: ["#a5f0a5", "#2f9e44", "#145a22"], pts: "10,3 30,3 39,20 30,37 10,37 1,20" },
  {
    c: ["#fff3a0", "#f2c200", "#8a6a00"],
    pts: "20,2 25,14 38,15 28,24 31,37 20,30 9,37 12,24 2,15 15,14",
  },
  { c: ["#e5b3ff", "#9c36b5", "#4e1460"], pts: "20,2 38,36 2,36" },
  { c: ["#ffd0a0", "#f76707", "#8a3200"], pts: "12,2 28,2 38,12 38,28 28,38 12,38 2,28 2,12" },
];

const GEM_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

function Gem({ kind }: { kind: number }) {
  const g = GEMS[kind];
  const id = `gem-${kind}`;
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={g.c[0]} />
          <stop offset=".55" stopColor={g.c[1]} />
          <stop offset="1" stopColor={g.c[2]} />
        </linearGradient>
      </defs>
      <polygon points={g.pts} fill={`url(#${id})`} stroke={g.c[2]} strokeWidth="1.2" />
      <polygon points={g.pts} fill="#fff" opacity=".22" transform="translate(6 5) scale(.55)" />
    </svg>
  );
}

let nextId = 1;
const piece = (kind: number, drop = 0): Piece => ({ id: nextId++, kind, drop });

function findMatches(g: Grid) {
  const out = new Set<number>();
  const kind = (r: number, c: number) => g[r * N + c]?.kind ?? -1;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const k = kind(r, c);
      if (k < 0) continue;
      if (c <= N - 3 && kind(r, c + 1) === k && kind(r, c + 2) === k) {
        let e = c;
        while (e < N && kind(r, e) === k) out.add(r * N + e++);
      }
      if (r <= N - 3 && kind(r + 1, c) === k && kind(r + 2, c) === k) {
        let e = r;
        while (e < N && kind(e, c) === k) out.add(e++ * N + c);
      }
    }
  return out;
}

function swapped(g: Grid, a: number, b: number) {
  const n = [...g];
  [n[a], n[b]] = [n[b], n[a]];
  return n;
}

const adjacent = (a: number, b: number) =>
  (Math.abs(a - b) === 1 && Math.floor(a / N) === Math.floor(b / N)) || Math.abs(a - b) === N;

function hasMove(g: Grid) {
  for (let i = 0; i < N * N; i++) {
    if (i % N < N - 1 && findMatches(swapped(g, i, i + 1)).size) return true;
    if (i < N * (N - 1) && findMatches(swapped(g, i, i + N)).size) return true;
  }
  return false;
}

function freshGrid(): Grid {
  for (;;) {
    const g: Grid = [];
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N);
      const c = i % N;
      let k: number;
      do k = randInt(KINDS);
      while (
        (c >= 2 && g[i - 1]?.kind === k && g[i - 2]?.kind === k) ||
        (r >= 2 && g[i - N]?.kind === k && g[i - 2 * N]?.kind === k)
      );
      g.push(piece(k, r + 1));
    }
    if (hasMove(g)) return g;
  }
}

/** Drops pieces into the gaps and refills from above. */
function collapse(g: Grid): Grid {
  const n: Grid = Array(N * N).fill(null);
  for (let c = 0; c < N; c++) {
    let w = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      const p = g[r * N + c];
      if (p) n[w-- * N + c] = { ...p, drop: 0 };
    }
    const gaps = w + 1;
    for (; w >= 0; w--) n[w * N + c] = piece(randInt(KINDS), gaps);
  }
  return n;
}

export default function Match3({ game, onScore }: EngineProps) {
  const skin = SKINS[game.id] ?? SKINS["orchard-friends"];
  const [phase, setPhase] = useState<Phase>("ready");
  const [grid, setGrid] = useState<Grid>(freshGrid);
  const [clearing, setClearing] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES);
  const [level, setLevel] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [grab, setGrab] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  /** Bumped whenever a move finishes resolving, so level checks run then. */
  const [settled, setSettled] = useState(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animated = useRef(new Set<number>());
  useReport(score, onScore);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const show = (text: string) => {
    setBanner(text);
    later(() => setBanner(null), 1100);
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    busy.current = false;
    animated.current.clear();
    setGrid(freshGrid());
    setClearing(new Set());
    setScore(0);
    setMoves(MOVES);
    setLevel(1);
    setSel(null);
    setPhase("playing");
  };

  const resolve = (g: Grid, chain: number) => {
    const m = findMatches(g);
    if (m.size === 0) {
      busy.current = false;
      setSettled((x) => x + 1);
      if (!hasMove(g)) {
        show("No moves — shuffling");
        setGrid(freshGrid());
      }
      return;
    }
    if (chain > 1) show(chain > 3 ? "Amazing!" : chain > 2 ? "Great!" : "Nice!");
    setClearing(new Set(m));
    later(() => {
      setScore((s) => s + m.size * 10 * chain + (m.size > 3 ? (m.size - 3) * 20 : 0));
      const removed = g.map((p, i) => (m.has(i) ? null : p));
      const next = collapse(removed);
      setClearing(new Set());
      setGrid(next);
      gridRef.current = next;
      later(() => resolve(next, chain + 1), 260);
    }, 200);
  };

  const trySwap = (a: number, b: number) => {
    if (busy.current || phase !== "playing" || !adjacent(a, b)) return;
    busy.current = true;
    setSel(null);
    const g = swapped(gridRef.current, a, b);
    setGrid(g);
    if (findMatches(g).size === 0) {
      later(() => {
        setGrid(swapped(g, a, b));
        busy.current = false;
      }, 200);
      return;
    }
    setMoves((m) => m - 1);
    later(() => resolve(g, 1), 200);
  };

  // Level progress: reaching the target clears the level; running out ends the game.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `settled` re-runs the check once a move finishes resolving.
  useEffect(() => {
    if (phase !== "playing" || busy.current) return;
    if (score >= target(level)) {
      show(`Level ${level} complete!`);
      setLevel((l) => l + 1);
      setMoves(MOVES);
    } else if (moves <= 0) setPhase("over");
  }, [score, moves, level, phase, settled]);

  const onPointerDown = (e: ReactPointerEvent, i: number) => {
    if (e.button !== 0 || phase !== "playing") return;
    setCursor(null);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      done();
      const c = i % N;
      const r = Math.floor(i / N);
      const j =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0 && c < N - 1
            ? i + 1
            : dx < 0 && c > 0
              ? i - 1
              : -1
          : dy > 0 && r < N - 1
            ? i + N
            : dy < 0 && r > 0
              ? i - N
              : -1;
      if (j >= 0) trySwap(i, j);
    };
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  };

  const onClick = (i: number) => {
    if (phase !== "playing" || busy.current) return;
    if (sel === null) setSel(i);
    else if (sel === i) setSel(null);
    else if (adjacent(sel, i)) trySwap(sel, i);
    else setSel(i);
  };

  useKeys((e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? 27;
      const c = cur % N;
      const nextIdx = cur + d;
      const valid =
        nextIdx >= 0 && nextIdx < N * N && !(d === -1 && c === 0) && !(d === 1 && c === N - 1);
      if (cursor === null) setCursor(27);
      else if (valid) {
        if (grab) {
          trySwap(cur, nextIdx);
          setGrab(false);
        } else setCursor(nextIdx);
      }
      return true;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (cursor === null) setCursor(27);
      else setGrab((g) => !g);
      return true;
    }
    return false;
  }, phase === "playing");

  const goal = target(level);
  const pct = Math.min(100, (score / goal) * 100);

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo={`Swap neighbouring pieces to match three or more. Reach the target score before you run out of moves.`}
      overTitle="Out of moves"
      overDetail={`You reached level ${level} with ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Level <b>{level}</b>
          </span>
          <span className="flex flex-1 items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-btn">
              <span
                className="block h-full rounded-full bg-fb transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </span>
            <b>{goal}</b>
          </span>
          <span>
            Moves <b>{moves}</b>
          </span>
        </>
      }
      hint="Drag a piece, or click two neighbours · Arrows + Enter"
      className="p-[10px]"
      style={{ background: skin.board, width: N * CELL + 20 }}
    >
      <div className="relative" style={{ width: N * CELL, height: N * CELL }}>
        {Array.from({ length: N * N }, (_, i) => (
          <span
            key={`bg-${i}`}
            className="absolute rounded-md"
            style={{
              left: (i % N) * CELL + 1,
              top: Math.floor(i / N) * CELL + 1,
              width: CELL - 2,
              height: CELL - 2,
              background: (i + Math.floor(i / N)) % 2 ? skin.cell : "transparent",
            }}
          />
        ))}
        {grid.map((p, i) => {
          if (!p) return null;
          const r = Math.floor(i / N);
          const c = i % N;
          return (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              aria-label={skin.gems ? `${GEM_NAMES[p.kind]} gem` : skin.pieces[p.kind]}
              ref={(el) => {
                if (!el || !p.drop || animated.current.has(p.id)) return;
                animated.current.add(p.id);
                el.animate(
                  [
                    { transform: `translateY(${-p.drop * CELL}px)`, opacity: 0.3 },
                    { transform: "none", opacity: 1 },
                  ],
                  { duration: 160 + p.drop * 35, easing: "cubic-bezier(.3,.7,.4,1.1)" },
                );
              }}
              onPointerDown={(e) => onPointerDown(e, i)}
              onClick={() => onClick(i)}
              className={cn(
                "absolute flex touch-none items-center justify-center rounded-lg text-[30px] leading-none transition-[left,top,transform,opacity] duration-200",
                clearing.has(i) && "scale-[1.35] opacity-0",
                sel === i && "scale-110 bg-white/45 ring-2 ring-white",
                cursor === i && (grab ? "ring-[3px] ring-[#ffe066]" : "ring-2 ring-white"),
              )}
              style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
            >
              {skin.gems ? <Gem kind={p.kind} /> : skin.pieces[p.kind]}
            </button>
          );
        })}
      </div>
      {banner && (
        <p className="pointer-events-none absolute inset-x-0 top-[42%] z-20 animate-[fade-in_.2s] text-center font-extrabold text-[28px] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.55)]">
          {banner}
        </p>
      )}
    </GameFrame>
  );
}
