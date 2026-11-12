import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import type { Game } from "./games";

/** Small, fully playable instant games. Each reports its score to the host. */

type GameProps = { game: Game; onScore: (s: number) => void };

export function MiniGame(props: GameProps) {
  if (props.game.engine === "merge") return <MergeGame {...props} />;
  if (props.game.engine === "memory") return <MemoryGame {...props} />;
  return <TapGame {...props} />;
}

/* ---------- Merge: slide and combine tiles (4x4) ---------- */

type Grid = number[];
const N = 4;

function addTile(grid: Grid): Grid {
  const empty = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (empty.length === 0) return grid;
  const next = [...grid];
  next[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]) {
  const vals = row.filter(Boolean);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else out.push(vals[i]);
  }
  while (out.length < N) out.push(0);
  return { row: out, gained };
}

type Dir = "left" | "right" | "up" | "down";

function move(grid: Grid, dir: Dir) {
  const next = [...grid];
  let gained = 0;
  for (let k = 0; k < N; k++) {
    const idx = Array.from({ length: N }, (_, j) =>
      dir === "left" || dir === "right" ? k * N + j : j * N + k,
    );
    if (dir === "right" || dir === "down") idx.reverse();
    const res = slideRow(idx.map((i) => grid[i]));
    gained += res.gained;
    idx.forEach((i, j) => {
      next[i] = res.row[j];
    });
  }
  const changed = next.some((v, i) => v !== grid[i]);
  return { grid: next, gained, changed };
}

function canMove(grid: Grid) {
  return (["left", "right", "up", "down"] as Dir[]).some((d) => move(grid, d).changed);
}

const TILE: Record<number, string> = {
  2: "bg-[#eee4da] text-[#776e65]",
  4: "bg-[#ede0c8] text-[#776e65]",
  8: "bg-[#f2b179] text-white",
  16: "bg-[#f59563] text-white",
  32: "bg-[#f67c5f] text-white",
  64: "bg-[#f65e3b] text-white",
  128: "bg-[#edcf72] text-white",
  256: "bg-[#edcc61] text-white",
  512: "bg-[#edc850] text-white",
  1024: "bg-[#edc53f] text-white",
  2048: "bg-[#edc22e] text-white",
};

function MergeGame({ onScore }: GameProps) {
  const fresh = () => addTile(addTile(Array(N * N).fill(0)));
  const [grid, setGrid] = useState<Grid>(fresh);
  const [score, setScore] = useState(0);
  const over = !canMove(grid);
  const won = grid.some((v) => v >= 2048);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const go = useCallback((dir: Dir) => {
    const r = move(gridRef.current, dir);
    if (!r.changed) return;
    const next = addTile(r.grid);
    gridRef.current = next;
    setGrid(next);
    if (r.gained) setScore((s) => s + r.gained);
  }, []);

  useEffect(() => onScore(score), [score, onScore]);

  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      a: "left",
      d: "right",
      w: "up",
      s: "down",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = keys[e.key];
      if (!dir) return;
      e.preventDefault();
      go(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Swipe / drag support.
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative grid touch-none select-none grid-cols-4 gap-2 rounded-lg bg-[#bbada0] p-2"
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        {grid.map((v, i) => (
          <div
            key={i}
            className={cn(
              "flex h-[72px] w-[72px] items-center justify-center rounded-md font-bold transition-colors",
              v ? (TILE[v] ?? "bg-[#3c3a32] text-white") : "bg-[rgba(238,228,218,0.35)]",
              v >= 1024 ? "text-[22px]" : v >= 128 ? "text-[26px]" : "text-[30px]",
            )}
          >
            {v || ""}
          </div>
        ))}
        {(over || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-[rgba(238,228,218,0.75)]">
            <p className="font-bold text-[#776e65] text-[28px]">{won ? "You win!" : "Game over"}</p>
            <Button
              variant="primary"
              onClick={() => {
                setGrid(fresh());
                setScore(0);
              }}
            >
              Play again
            </Button>
          </div>
        )}
      </div>
      <p className="text-[13px] text-secondary">Use arrow keys or swipe to merge matching tiles.</p>
    </div>
  );
}

/* ---------- Memory: flip cards to find pairs ---------- */

const FACES = ["🍓", "🍋", "🍇", "🥝", "🍒", "🍑", "🍍", "🥥"];

function shuffled<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MemoryGame({ game, onScore }: GameProps) {
  const deal = () => shuffled([...FACES, ...FACES]);
  const [cards, setCards] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const done = found.size === FACES.length;

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open;
    const t = setTimeout(
      () => {
        if (cards[a] === cards[b]) setFound((f) => new Set(f).add(cards[a]));
        setOpen([]);
      },
      cards[a] === cards[b] ? 250 : 800,
    );
    return () => clearTimeout(t);
  }, [open, cards]);

  useEffect(
    () => onScore(found.size * 100 - Math.max(0, moves - FACES.length) * 5),
    [found, moves, onScore],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid grid-cols-4 gap-2">
        {cards.map((face, i) => {
          const shown = open.includes(i) || found.has(face);
          return (
            <button
              key={i}
              type="button"
              aria-label={shown ? face : "Hidden card"}
              disabled={shown || open.length === 2}
              onClick={() => {
                setOpen((o) => [...o, i]);
                if (open.length === 1) setMoves((m) => m + 1);
              }}
              className={cn(
                "flex h-[72px] w-[72px] items-center justify-center rounded-lg text-[34px] shadow-base transition-transform duration-200",
                shown ? "bg-card" : "hover:scale-[1.03]",
                found.has(face) && "opacity-60",
              )}
              style={
                shown
                  ? undefined
                  : { background: `linear-gradient(135deg, ${game.from}, ${game.to})` }
              }
            >
              {shown ? face : <span className="text-[20px] opacity-80">{game.emoji}</span>}
            </button>
          );
        })}
        {done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-card/85">
            <p className="font-bold text-[24px] text-primary">Cleared in {moves} moves!</p>
            <Button
              variant="primary"
              onClick={() => {
                setCards(deal());
                setFound(new Set());
                setOpen([]);
                setMoves(0);
              }}
            >
              Play again
            </Button>
          </div>
        )}
      </div>
      <p className="text-[13px] text-secondary">Find all the pairs · {moves} moves</p>
    </div>
  );
}

/* ---------- Tap: hit targets before the clock runs out ---------- */

const ROUND = 20;

function TapGame({ game, onScore }: GameProps) {
  const [state, setState] = useState<"ready" | "playing" | "over">("ready");
  const [left, setLeft] = useState(ROUND);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [target, setTarget] = useState({ x: 50, y: 50, size: 56 });

  const place = useCallback(() => {
    const size = 40 + Math.random() * 28;
    setTarget({ x: 8 + Math.random() * 84, y: 8 + Math.random() * 84, size });
  }, []);

  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setState("over");
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    // Targets move on their own if you are too slow.
    const m = setInterval(place, 1100);
    return () => {
      clearInterval(t);
      clearInterval(m);
    };
  }, [state, place]);

  useEffect(() => onScore(hits * 10 - misses * 2), [hits, misses, onScore]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-[312px] justify-between font-semibold text-[15px] text-primary">
        <span>Score {hits * 10 - misses * 2}</span>
        <span>{left}s</span>
      </div>
      <div
        role="application"
        aria-label={`${game.name} play area`}
        className="relative h-[312px] w-[312px] select-none overflow-hidden rounded-lg"
        style={{ background: `linear-gradient(160deg, ${game.from}, ${game.to})` }}
        onPointerDown={(e) => {
          if (state === "playing" && e.target === e.currentTarget) setMisses((m) => m + 1);
        }}
      >
        {state === "playing" && (
          <button
            type="button"
            aria-label="Target"
            onPointerDown={(e) => {
              e.stopPropagation();
              setHits((h) => h + 1);
              place();
            }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-[left,top] duration-75 active:scale-90"
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              width: target.size,
              height: target.size,
              fontSize: target.size * 0.55,
            }}
          >
            {game.emoji}
          </button>
        )}
        {state !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 text-white">
            <span className="text-[56px]">{game.emoji}</span>
            {state === "over" && (
              <p className="font-bold text-[22px]">
                {hits} hits · {misses} misses
              </p>
            )}
            <Button
              variant="primary"
              onClick={() => {
                setHits(0);
                setMisses(0);
                setLeft(ROUND);
                place();
                setState("playing");
              }}
            >
              {state === "over" ? "Play again" : "Start"}
            </Button>
          </div>
        )}
      </div>
      <p className="text-[13px] text-secondary">Tap the {game.emoji} as fast as you can.</p>
    </div>
  );
}
