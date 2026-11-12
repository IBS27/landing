import { useEffect, useRef, useState } from "react";
import {
  type EngineProps,
  GameFrame,
  localPoint,
  type Phase,
  shuffle,
  useKeys,
  useReport,
} from "./kit";

/**
 * Jungle maze: guide the explorer through a generated maze to the temple
 * before the torch burns out, picking up relics in dead ends on the way.
 */

const PX = 360;
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const STEP: Record<number, [number, number]> = {
  [N]: [0, -1],
  [E]: [1, 0],
  [S]: [0, 1],
  [W]: [-1, 0],
};
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

const sizeFor = (level: number) => Math.min(17, 7 + level * 2);
const timeFor = (n: number) => 20 + n * 3;

type Level = { n: number; open: number[]; relics: Set<number> };

/** Recursive-backtracker maze; `open[i]` has a bit set for each passage out of cell i. */
function generate(n: number): Level {
  const open = Array(n * n).fill(0);
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack[stack.length - 1];
    const x = i % n;
    const y = Math.floor(i / n);
    const next = shuffle([N, E, S, W]).find((d) => {
      const [dx, dy] = STEP[d];
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen.has(ny * n + nx);
    });
    if (next === undefined) {
      stack.pop();
      continue;
    }
    const [dx, dy] = STEP[next];
    const j = (y + dy) * n + x + dx;
    open[i] |= next;
    open[j] |= OPP[next];
    seen.add(j);
    stack.push(j);
  }
  // Relics sit in dead ends away from the start and the temple.
  const ends = open
    .map((o, i) => ({ o, i }))
    .filter(
      ({ o, i }) => [N, E, S, W].filter((d) => o & d).length === 1 && i !== 0 && i !== n * n - 1,
    )
    .map(({ i }) => i);
  return { n, open, relics: new Set(shuffle(ends).slice(0, Math.max(2, Math.floor(n / 3)))) };
}

/** Shortest path between two cells (the maze is a tree, so BFS is exact). */
function path(level: Level, from: number, to: number) {
  const { n, open } = level;
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const i = q.shift()!;
    if (i === to) break;
    for (const d of [N, E, S, W]) {
      if (!(open[i] & d)) continue;
      const [dx, dy] = STEP[d];
      const j = i + dy * n + dx;
      if (!prev.has(j)) {
        prev.set(j, i);
        q.push(j);
      }
    }
  }
  const out: number[] = [];
  for (let c = to; c !== from && c !== undefined && c >= 0; c = prev.get(c)!) out.unshift(c);
  return prev.has(to) ? out : [];
}

export default function Maze({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [levelNo, setLevelNo] = useState(1);
  const [level, setLevel] = useState<Level>(() => generate(sizeFor(1)));
  const [pos, setPos] = useState(0);
  const [time, setTime] = useState(timeFor(sizeFor(1)));
  const [score, setScore] = useState(0);
  const [relics, setRelics] = useState(0);
  const [won, setWon] = useState(false);
  const walk = useRef<ReturnType<typeof setInterval>>(undefined);
  const posRef = useRef(pos);
  posRef.current = pos;
  useReport(score, onScore);

  const { n, open } = level;
  const cell = PX / n;
  const goal = n * n - 1;

  const stopWalk = () => clearInterval(walk.current);
  useEffect(() => () => clearInterval(walk.current), []);

  const setup = (no: number) => {
    stopWalk();
    const lv = generate(sizeFor(no));
    setLevel(lv);
    setLevelNo(no);
    setPos(0);
    setTime(timeFor(lv.n));
    setWon(false);
  };

  const start = () => {
    setup(1);
    setScore(0);
    setRelics(0);
    setPhase("playing");
  };

  // Torch timer.
  useEffect(() => {
    if (phase !== "playing" || won) return;
    const t = setInterval(() => setTime((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [phase, won]);
  useEffect(() => {
    if (phase === "playing" && time <= 0 && !won) {
      clearInterval(walk.current);
      setPhase("over");
    }
  }, [time, phase, won]);

  const arrive = (i: number) => {
    setPos(i);
    posRef.current = i;
    if (level.relics.has(i)) {
      level.relics.delete(i);
      setRelics((r) => r + 1);
      setScore((s) => s + 50);
    }
    if (i === goal && !won) {
      stopWalk();
      setWon(true);
      setScore((s) => s + 200 + time * 5);
      setTimeout(() => setup(levelNo + 1), 900);
    }
  };

  const stepDir = (d: number) => {
    if (phase !== "playing" || won) return;
    stopWalk();
    const i = posRef.current;
    if (!(open[i] & d)) return;
    const [dx, dy] = STEP[d];
    arrive(i + dy * n + dx);
  };

  const walkTo = (target: number) => {
    if (phase !== "playing" || won) return;
    stopWalk();
    const route = path(level, posRef.current, target);
    walk.current = setInterval(() => {
      const next = route.shift();
      if (next === undefined) return stopWalk();
      arrive(next);
    }, 70);
  };

  useKeys((e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const d = { ArrowUp: N, w: N, ArrowRight: E, d: E, ArrowDown: S, s: S, ArrowLeft: W, a: W }[k];
    if (d === undefined) return false;
    stepDir(d);
    return true;
  }, phase === "playing");

  // Walls: draw the closed east and south side of each cell, plus the outer frame.
  let walls = `M0 0H${PX}V${PX}H0Z`;
  for (let i = 0; i < n * n; i++) {
    const x = (i % n) * cell;
    const y = Math.floor(i / n) * cell;
    if (!(open[i] & E) && i % n < n - 1) walls += `M${x + cell} ${y}V${y + cell}`;
    if (!(open[i] & S) && Math.floor(i / n) < n - 1) walls += `M${x} ${y + cell}H${x + cell}`;
  }
  const at = (i: number) => ({
    x: (i % n) * cell + cell / 2,
    y: Math.floor(i / n) * cell + cell / 2,
  });
  const p = at(pos);
  const g = at(goal);
  const lowTime = time <= 10;

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Find the path through the jungle to the lost temple before your torch burns out. Grab relics on the way."
      overTitle="Your torch burned out"
      overDetail={`Reached stage ${levelNo} · ${relics} relics · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Stage <b>{levelNo}</b>
          </span>
          <span>
            Relics <b>{relics}</b>
          </span>
          <span className={lowTime ? "text-[#e41e3f]" : undefined}>
            🔥 <b className={lowTime ? "!text-[#e41e3f]" : undefined}>{Math.max(0, time)}s</b>
          </span>
        </>
      }
      hint="Arrow keys / WASD, or click where to go"
      className="p-[14px]"
      style={{ width: PX + 28, background: "linear-gradient(160deg, #1b5e20, #0d3311)" }}
    >
      <svg
        viewBox={`0 0 ${PX} ${PX}`}
        width={PX}
        height={PX}
        role="img"
        aria-label={`Maze, stage ${levelNo}`}
        className="block cursor-pointer touch-none"
        onPointerDown={(e) => {
          const pt = localPoint(e, e.currentTarget);
          const x = Math.floor(pt.x / cell);
          const y = Math.floor(pt.y / cell);
          if (x >= 0 && y >= 0 && x < n && y < n) walkTo(y * n + x);
        }}
      >
        <defs>
          <radialGradient id="mz-floor" cx=".5" cy=".5" r=".7">
            <stop offset="0" stopColor="#a3c46b" />
            <stop offset="1" stopColor="#6d8f3a" />
          </radialGradient>
        </defs>
        <rect width={PX} height={PX} fill="url(#mz-floor)" />
        <path
          d={walls}
          fill="none"
          stroke="#0b3d12"
          strokeWidth={Math.max(3, cell * 0.22)}
          strokeLinecap="round"
        />
        <path
          d={walls}
          fill="none"
          stroke="#2f7d32"
          strokeWidth={Math.max(1.5, cell * 0.1)}
          strokeLinecap="round"
          strokeDasharray={`${cell * 0.3} ${cell * 0.2}`}
        />
        {[...level.relics].map((i) => {
          const r = at(i);
          return (
            <text
              key={i}
              x={r.x}
              y={r.y}
              fontSize={cell * 0.55}
              textAnchor="middle"
              dominantBaseline="central"
            >
              💎
            </text>
          );
        })}
        <text x={g.x} y={g.y} fontSize={cell * 0.75} textAnchor="middle" dominantBaseline="central">
          🛕
        </text>
        <g
          style={{
            transform: `translate(${p.x}px, ${p.y}px)`,
            transition: "transform 70ms linear",
          }}
        >
          <circle r={cell * 0.42} fill="#ffd43b" opacity=".35" />
          <text fontSize={cell * 0.62} textAnchor="middle" dominantBaseline="central">
            🤠
          </text>
        </g>
      </svg>
      {won && (
        <p className="pointer-events-none absolute inset-x-0 top-[44%] text-center font-extrabold text-[26px] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          Temple found!
        </p>
      )}
    </GameFrame>
  );
}
