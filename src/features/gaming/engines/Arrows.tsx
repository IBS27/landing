import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { type EngineProps, GameFrame, type Phase, shuffle, useKeys, useReport } from "./kit";

/**
 * Arrow slide puzzle: tap an arrow to slide it off the board in the direction
 * it points. Arrows in its way block it, and a blocked slide costs a heart.
 * Every level is generated solvable.
 */

type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const COLORS = ["#f03e3e", "#1c7ed6", "#37b24d", "#f59f00"];
const HEARTS = 3;

const sizeFor = (level: number) => Math.min(9, 5 + level);
const BOARD_PX = 360;

/** Cells from (x, y) to the edge in direction d, excluding the start. */
function ray(n: number, x: number, y: number, d: Dir) {
  const out: number[] = [];
  for (
    let cx = x + DX[d], cy = y + DY[d];
    cx >= 0 && cy >= 0 && cx < n && cy < n;
    cx += DX[d], cy += DY[d]
  )
    out.push(cy * n + cx);
  return out;
}

/**
 * Builds a solvable board: arrows are placed one at a time, each only where
 * its path to the edge is clear of every arrow placed before it, so removing
 * them in reverse order always works.
 */
function generate(n: number): (Dir | null)[] {
  const cells: (Dir | null)[] = Array(n * n).fill(null);
  for (let pass = 0; pass < 3; pass++)
    for (const i of shuffle([...cells.keys()])) {
      if (cells[i] !== null) continue;
      for (const d of shuffle([0, 1, 2, 3] as Dir[])) {
        if (ray(n, i % n, Math.floor(i / n), d).every((j) => cells[j] === null)) {
          cells[i] = d;
          break;
        }
      }
    }
  return cells;
}

function Arrow({ d }: { d: Dir }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[62%] w-[62%]"
      style={{ transform: `rotate(${d * 90}deg)` }}
      aria-hidden
    >
      <path
        d="M12 3 4.5 11h5v10h5V11h5z"
        fill="#fff"
        stroke="rgba(0,0,0,.15)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Arrows({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(1);
  const [cells, setCells] = useState<(Dir | null)[]>(() => generate(sizeFor(1)));
  const [leaving, setLeaving] = useState<Map<number, Dir>>(new Map());
  const [bump, setBump] = useState<number | null>(null);
  const [hearts, setHearts] = useState(HEARTS);
  const [score, setScore] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useReport(score, onScore);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const n = Math.round(Math.sqrt(cells.length));
  const cell = BOARD_PX / n;
  const left = cells.filter((c) => c !== null).length;

  const start = () => {
    timers.current.forEach(clearTimeout);
    setLevel(1);
    setCells(generate(sizeFor(1)));
    setLeaving(new Map());
    setHearts(HEARTS);
    setScore(0);
    setPhase("playing");
  };

  const tap = (i: number) => {
    if (phase !== "playing") return;
    const d = cells[i];
    if (d === null) return;
    const blocked = ray(n, i % n, Math.floor(i / n), d).some((j) => cells[j] !== null);
    if (blocked) {
      setBump(i);
      timers.current.push(setTimeout(() => setBump(null), 320));
      const h = hearts - 1;
      setHearts(h);
      if (h <= 0) timers.current.push(setTimeout(() => setPhase("over"), 400));
      return;
    }
    const next = [...cells];
    next[i] = null;
    setCells(next);
    setScore((s) => s + 10);
    setLeaving((m) => new Map(m).set(i, d));
    timers.current.push(
      setTimeout(
        () =>
          setLeaving((m) => {
            const c = new Map(m);
            c.delete(i);
            return c;
          }),
        380,
      ),
    );
    if (next.every((c) => c === null)) {
      const bonus = 100 * level + 50 * hearts;
      setScore((s) => s + bonus);
      timers.current.push(
        setTimeout(() => {
          setLevel((l) => l + 1);
          setCells(generate(sizeFor(level + 1)));
          setHearts(HEARTS);
          setCursor(null);
        }, 650),
      );
    }
  };

  useKeys((e) => {
    const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? Math.floor((n * n) / 2);
      const x = (cur % n) + DX[d];
      const y = Math.floor(cur / n) + DY[d];
      setCursor(cursor === null ? cur : x >= 0 && y >= 0 && x < n && y < n ? y * n + x : cur);
      return true;
    }
    if ((e.key === "Enter" || e.key === " ") && cursor !== null) {
      tap(cursor);
      return true;
    }
    return false;
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Tap an arrow to slide it off the board. If another arrow is in its path it gets stuck and you lose a heart."
      overTitle="Out of hearts"
      overDetail={`Level ${level} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Level <b>{level}</b>
          </span>
          <span>
            Arrows left <b>{left}</b>
          </span>
          <span className="tracking-[2px]" role="img" aria-label={`${hearts} hearts`}>
            {Array.from({ length: HEARTS }, (_, k) => (k < hearts ? "❤️" : "🤍")).join("")}
          </span>
        </>
      }
      hint="Click an arrow · Arrow keys + Enter"
      className="p-[14px]"
      style={{ width: BOARD_PX + 28, background: `linear-gradient(160deg, #2b2b3a, ${game.band})` }}
    >
      <style>
        {"@keyframes ar-bump{0%,100%{translate:0 0}30%{translate:var(--bx) var(--by)}}"}
      </style>
      <div className="relative" style={{ width: BOARD_PX, height: BOARD_PX }}>
        {cells.map((d, i) => {
          const x = i % n;
          const y = Math.floor(i / n);
          const gone = leaving.get(i);
          const shown = d ?? gone;
          return (
            <span
              key={`${n}-${i}`}
              className="absolute flex items-center justify-center p-[3px]"
              style={{ left: x * cell, top: y * cell, width: cell, height: cell }}
            >
              <span className="absolute h-1.5 w-1.5 rounded-full bg-white/15" />
              {shown !== undefined && shown !== null && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Arrow pointing ${["up", "right", "down", "left"][shown]}`}
                  onClick={() => tap(i)}
                  className={cn(
                    "relative flex h-full w-full items-center justify-center rounded-[22%] shadow-[inset_0_-3px_0_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.3)] transition-[transform,opacity] ease-in hover:brightness-110",
                    gone !== undefined && "pointer-events-none opacity-0 duration-[380ms]",
                    bump === i && "animate-[ar-bump_.3s]",
                    cursor === i && "ring-[3px] ring-white",
                  )}
                  style={
                    {
                      background: COLORS[shown],
                      transform:
                        gone !== undefined
                          ? `translate(${DX[gone] * BOARD_PX}px, ${DY[gone] * BOARD_PX}px)`
                          : undefined,
                      "--bx": `${DX[shown] * 8}px`,
                      "--by": `${DY[shown] * 8}px`,
                    } as CSSProperties
                  }
                >
                  <Arrow d={shown} />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </GameFrame>
  );
}
