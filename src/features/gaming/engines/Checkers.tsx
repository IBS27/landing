import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { type EngineProps, GameFrame, type Phase, useKeys, useReport } from "./kit";

/**
 * Checkers (American rules) against the computer: captures are compulsory,
 * multi-jumps continue, and reaching the far row crowns a king.
 */

const CELL = 46;
type Side = "r" | "b";
type Piece = { side: Side; king: boolean };
type Board = (Piece | null)[];
type Move = { from: number; to: number; path: number[]; captured: number[] };

const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const other = (s: Side): Side => (s === "r" ? "b" : "r");

function initial(): Board {
  const b: Board = Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    if ((r + c) % 2 === 1) {
      if (r < 3) b[i] = { side: "b", king: false };
      else if (r > 4) b[i] = { side: "r", king: false };
    }
  }
  return b;
}

const dirsOf = (p: Piece) => (p.king ? [-1, 1] : p.side === "r" ? [-1] : [1]);

function jumpsFrom(
  b: Board,
  from: number,
  p: Piece,
  pos: number,
  path: number[],
  captured: number[],
  out: Move[],
) {
  const [r, c] = rc(pos);
  let extended = false;
  for (const dr of dirsOf(p))
    for (const dc of [-1, 1]) {
      const mid = at(r + dr, c + dc);
      const land = at(r + 2 * dr, c + 2 * dc);
      if (mid < 0 || land < 0) continue;
      const m = b[mid];
      if (!m || m.side === p.side || captured.includes(mid)) continue;
      if (b[land] && land !== from) continue;
      extended = true;
      const crowned = !p.king && (p.side === "r" ? r + 2 * dr === 0 : r + 2 * dr === 7);
      const np = [...path, land];
      const nc = [...captured, mid];
      if (crowned) out.push({ from, to: land, path: np, captured: nc });
      else jumpsFrom(b, from, p, land, np, nc, out);
    }
  if (!extended && captured.length) out.push({ from, to: pos, path, captured });
}

function legalMoves(b: Board, side: Side): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  b.forEach((p, i) => {
    if (!p || p.side !== side) return;
    jumpsFrom(b, i, p, i, [], [], jumps);
    const [r, c] = rc(i);
    for (const dr of dirsOf(p))
      for (const dc of [-1, 1]) {
        const t = at(r + dr, c + dc);
        if (t >= 0 && !b[t]) steps.push({ from: i, to: t, path: [t], captured: [] });
      }
  });
  return jumps.length ? jumps : steps;
}

function apply(b: Board, m: Move): Board {
  const n = [...b];
  const p = n[m.from]!;
  n[m.from] = null;
  for (const c of m.captured) n[c] = null;
  const row = Math.floor(m.to / 8);
  n[m.to] = { ...p, king: p.king || (p.side === "r" ? row === 0 : row === 7) };
  return n;
}

function evaluate(b: Board) {
  let s = 0;
  b.forEach((p, i) => {
    if (!p) return;
    const row = Math.floor(i / 8);
    const v = p.king ? 175 : 100 + (p.side === "b" ? row : 7 - row) * 4;
    const centre = i % 8 > 1 && i % 8 < 6 ? 3 : 0;
    s += (p.side === "b" ? 1 : -1) * (v + centre);
  });
  // In the endgame the side that is ahead hunts: its kings close in on the
  // nearest enemy piece instead of shuffling.
  const ahead: Side | null = s > 60 ? "b" : s < -60 ? "r" : null;
  if (ahead) {
    const prey = b.flatMap((p, i) => (p && p.side !== ahead ? [i] : []));
    b.forEach((p, i) => {
      if (!p?.king || p.side !== ahead || !prey.length) return;
      const [r, c] = rc(i);
      const d = Math.min(
        ...prey.map((j) => Math.max(Math.abs(rc(j)[0] - r), Math.abs(rc(j)[1] - c))),
      );
      s += (ahead === "b" ? -1 : 1) * d * 3;
    });
  }
  return s;
}

function search(b: Board, depth: number, alpha: number, beta: number, side: Side): number {
  const moves = legalMoves(b, side);
  if (moves.length === 0) return side === "b" ? -100000 - depth : 100000 + depth;
  if (depth === 0) return evaluate(b);
  if (side === "b") {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(b, m), depth - 1, alpha, beta, "r"));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(b, m), depth - 1, alpha, beta, "b"));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function aiMove(b: Board): Move | null {
  const moves = legalMoves(b, "b");
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = search(apply(b, m), 5, -Infinity, Infinity, "r") + Math.random() * 4;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export default function Checkers({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [board, setBoard] = useState<Board>(initial);
  const [turn, setTurn] = useState<Side>("r");
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [last, setLast] = useState<Move | null>(null);
  const [captures, setCaptures] = useState(0);
  const [quiet, setQuiet] = useState(0);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);

  const mine = board.filter((p) => p?.side === "r").length;
  const theirs = board.filter((p) => p?.side === "b").length;
  const score = captures * 50 + (result === "win" ? 1000 + mine * 50 : 0);
  useReport(score, onScore);

  const moves = useMemo(() => (turn === "r" ? legalMoves(board, "r") : []), [board, turn]);
  const movable = new Set(moves.map((m) => m.from));
  const targets = sel === null ? [] : moves.filter((m) => m.from === sel);

  const start = () => {
    setBoard(initial());
    setTurn("r");
    setSel(null);
    setLast(null);
    setCaptures(0);
    setQuiet(0);
    setResult(null);
    setPhase("playing");
  };

  const finish = (r: "win" | "lose" | "draw") => {
    setResult(r);
    setTimeout(() => setPhase("over"), 700);
  };

  const play = (m: Move, side: Side) => {
    const next = apply(board, m);
    setBoard(next);
    setLast(m);
    setSel(null);
    if (side === "r" && m.captured.length) setCaptures((c) => c + m.captured.length);
    const q = m.captured.length ? 0 : quiet + 1;
    setQuiet(q);
    if (q >= 80) return finish("draw");
    const opp = other(side);
    if (legalMoves(next, opp).length === 0) return finish(side === "r" ? "win" : "lose");
    setTurn(opp);
  };

  // Computer's turn.
  useEffect(() => {
    if (phase !== "playing" || turn !== "b" || result) return;
    const t = setTimeout(() => {
      const m = aiMove(board);
      if (m) play(m, "b");
    }, 450);
    return () => clearTimeout(t);
  });

  const choose = (i: number) => {
    if (phase !== "playing" || turn !== "r" || result) return;
    const m = targets.find((x) => x.to === i);
    if (m) return play(m, "r");
    if (movable.has(i)) setSel(sel === i ? null : i);
    else setSel(null);
  };

  useKeys((e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? 44;
      const n = cur + d;
      const ok = n >= 0 && n < 64 && !(d === -1 && cur % 8 === 0) && !(d === 1 && cur % 8 === 7);
      setCursor(cursor === null ? 44 : ok ? n : cur);
      return true;
    }
    if ((e.key === "Enter" || e.key === " ") && cursor !== null) {
      choose(cursor);
      return true;
    }
    if (e.key === "Escape" && sel !== null) {
      setSel(null);
      return true;
    }
    return false;
  }, phase === "playing");

  const status =
    result === "win"
      ? "You win!"
      : result === "lose"
        ? "You lose"
        : result === "draw"
          ? "Draw"
          : turn === "r"
            ? moves.some((m) => m.captured.length)
              ? "Your turn — you must jump"
              : "Your turn"
            : "Computer is thinking…";

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="You play red and move first. Jump the computer's pieces to capture them; jumps are compulsory. Reach the far row to crown a king."
      overTitle={
        result === "win" ? "You win!" : result === "draw" ? "It's a draw" : "The computer wins"
      }
      overDetail={`${captures} captures · ${score} points`}
      onStart={start}
      hud={
        <>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#d6336c]" /> <b>{mine}</b>
          </span>
          <span className="font-semibold text-primary">{status}</span>
          <span className="flex items-center gap-1.5">
            <b>{theirs}</b> <span className="h-3 w-3 rounded-full bg-[#212529] dark:bg-[#adb5bd]" />
          </span>
        </>
      }
      hint="Click a piece, then a highlighted square · Arrows + Enter"
      className="border-[10px] border-[#6b3a1f]"
      style={{ width: 8 * CELL + 20 }}
    >
      <div className="grid grid-cols-8" style={{ width: 8 * CELL }}>
        {board.map((p, i) => {
          const [r, c] = rc(i);
          const dark = (r + c) % 2 === 1;
          const target = targets.find((m) => m.to === i);
          const wasLast = last && (last.from === i || last.to === i);
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-label={
                p
                  ? `${p.side === "r" ? "Your" : "Computer"} ${p.king ? "king" : "piece"}`
                  : dark
                    ? "Empty square"
                    : "Light square"
              }
              onClick={() => choose(i)}
              className={cn(
                "relative flex items-center justify-center",
                dark ? "bg-[#7a4a2b]" : "bg-[#f0d9b5]",
                wasLast && "bg-[#9c6b3c]",
                cursor === i && "outline-[3px] outline-[#ffe066] outline-offset-[-3px] outline",
              )}
              style={{ width: CELL, height: CELL }}
            >
              {target && (
                <span className="absolute h-4 w-4 rounded-full bg-[#ffe066]/80 shadow-[0_0_0_3px_rgba(255,224,102,0.35)]" />
              )}
              {p && (
                <span
                  className={cn(
                    "relative flex h-[36px] w-[36px] items-center justify-center rounded-full text-[16px] shadow-[0_3px_0_rgba(0,0,0,0.35),inset_0_0_0_3px_rgba(255,255,255,0.15)] transition-transform",
                    p.side === "r"
                      ? "bg-[radial-gradient(circle_at_35%_30%,#ff6b8b,#c2255c)]"
                      : "bg-[radial-gradient(circle_at_35%_30%,#5c5f66,#141517)]",
                    sel === i && "-translate-y-1 ring-[3px] ring-[#ffe066]",
                    turn === "r" && movable.has(i) && sel !== i && "ring-2 ring-white/60",
                  )}
                >
                  <span className="absolute inset-[6px] rounded-full border-2 border-white/20" />
                  {p.king && <span className="relative text-[#ffd43b]">♛</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </GameFrame>
  );
}
