import { Eye } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import {
  type EngineProps,
  GameFrame,
  gameScale,
  type Phase,
  shuffle,
  useKeys,
  useReport,
} from "./kit";

/**
 * Jigsaw in swap mode: the picture is cut into pieces and scrambled; drag a
 * piece onto another (or click two) to swap them until the scene is whole.
 */

const W = 360;
const H = 270;
const PICTURES = [
  "/seed/covers/mountains-01.jpg",
  "/seed/posts/alpine-meadow-01.jpg",
  "/seed/covers/trail-01.jpg",
  "/seed/covers/mountains-02.jpg",
  "/seed/posts/snowy-trail-01.jpg",
  "/seed/posts/alpine-meadow-02.jpg",
  "/seed/covers/mountains-03.jpg",
  "/seed/posts/beach-03.jpg",
];
const gridFor = (level: number) => {
  const cols = Math.min(7, 3 + level);
  return { cols, rows: Math.min(6, 2 + level) };
};

/** A scramble with no piece already in place. */
function scramble(count: number) {
  for (;;) {
    const order = shuffle([...Array(count).keys()]);
    if (order.every((p, i) => p !== i)) return order;
  }
}

export default function Jigsaw({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(1);
  const [order, setOrder] = useState<number[]>(() => scramble(12));
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [peek, setPeek] = useState(false);
  const [solved, setSolved] = useState(false);
  const [drag, setDrag] = useState<{ from: number; dx: number; dy: number } | null>(null);
  const suppress = useRef(false);
  useReport(score, onScore);

  const { cols, rows } = gridFor(level);
  const pw = W / cols;
  const ph = H / rows;
  const picture = PICTURES[(level - 1) % PICTURES.length];
  const placed = order.filter((p, i) => p === i).length;

  const setup = (lv: number) => {
    const g = gridFor(lv);
    setLevel(lv);
    setOrder(scramble(g.cols * g.rows));
    setMoves(0);
    setSel(null);
    setSolved(false);
  };

  const start = () => {
    setup(1);
    setScore(0);
    setPhase("playing");
  };

  const swap = (a: number, b: number) => {
    if (a === b || solved || phase !== "playing") return;
    const next = [...order];
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
    setMoves((m) => m + 1);
    setSel(null);
    if (next.every((p, i) => p === i)) {
      setSolved(true);
      const count = next.length;
      setScore((s) => s + Math.max(count * 10, count * 40 - (moves + 1 - count) * 15));
      setTimeout(() => setup(level + 1), 1600);
    }
  };

  const click = (i: number) => {
    if (suppress.current || phase !== "playing" || solved) return;
    if (order[i] === i) return;
    if (sel === null) setSel(i);
    else if (sel === i) setSel(null);
    else swap(sel, i);
  };

  const onPointerDown = (e: ReactPointerEvent, from: number) => {
    if (e.button !== 0 || phase !== "playing" || solved || order[from] === from) return;
    setCursor(null);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const k = gameScale(e.currentTarget);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / k;
      const dy = (ev.clientY - y0) / k;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      setDrag({ from, dx, dy });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) return;
      suppress.current = true;
      setTimeout(() => {
        suppress.current = false;
      }, 0);
      for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
        const slot = el.closest<HTMLElement>("[data-slot]");
        if (!slot || slot.dataset.slot === String(from)) continue;
        const to = Number(slot.dataset.slot);
        if (order[to] !== to) swap(from, to);
        return;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useKeys((e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? 0;
      const n = cur + d;
      const ok =
        n >= 0 &&
        n < order.length &&
        !(d === -1 && cur % cols === 0) &&
        !(d === 1 && cur % cols === cols - 1);
      setCursor(cursor === null ? 0 : ok ? n : cur);
      return true;
    }
    if ((e.key === "Enter" || e.key === " ") && cursor !== null) {
      click(cursor);
      return true;
    }
    if (e.key === "p" || e.key === "P") {
      setPeek((x) => !x);
      return true;
    }
    return false;
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="The picture has been scrambled. Swap pieces until every one is back in place."
      overTitle="Puzzle complete"
      overDetail={`${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Puzzle <b>{level}</b> · {cols * rows} pieces
          </span>
          <span>
            In place <b>{placed}</b>/{order.length}
          </span>
          <span>
            Moves <b>{moves}</b>
          </span>
        </>
      }
      hint="Drag a piece onto another to swap · Arrows + Enter · P peek"
      extra={
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={14} />}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onClick={(e) => e.detail === 0 && setPeek((x) => !x)}
        >
          Peek
        </Button>
      }
      className="p-[14px]"
      style={{ width: W + 28, background: `linear-gradient(160deg, ${game.band}, #1d2b4a)` }}
    >
      <div className="relative" style={{ width: W, height: H }}>
        {order.map((p, i) => {
          const home = p === i;
          const dragging = drag?.from === i;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              data-slot={i}
              aria-label={home ? "Piece in place" : `Piece ${i + 1}`}
              onPointerDown={(e) => onPointerDown(e, i)}
              onClick={() => click(i)}
              className={cn(
                "absolute touch-none transition-[box-shadow,filter]",
                !home &&
                  !solved &&
                  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),inset_0_0_0_2px_rgba(0,0,0,0.25)] hover:brightness-110",
                sel === i && "z-10 shadow-[inset_0_0_0_3px_#fff] brightness-110",
                cursor === i &&
                  "z-10 outline-[3px] outline-[#ffe066] outline-offset-[-3px] outline",
                dragging && "z-20 shadow-[0_8px_18px_rgba(0,0,0,0.45)]",
              )}
              style={{
                left: (i % cols) * pw,
                top: Math.floor(i / cols) * ph,
                width: pw,
                height: ph,
                backgroundImage: `url(${picture})`,
                backgroundSize: `${W}px ${H}px`,
                backgroundPosition: `${-(p % cols) * pw}px ${-Math.floor(p / cols) * ph}px`,
                transform: dragging
                  ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.04)`
                  : undefined,
              }}
            />
          );
        })}
        {peek && (
          <img
            src={picture}
            alt=""
            className="pointer-events-none absolute inset-0 z-30 h-full w-full opacity-90"
          />
        )}
      </div>
      {solved && (
        <p className="pointer-events-none absolute inset-x-0 top-[44%] text-center font-extrabold text-[26px] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          Puzzle complete!
        </p>
      )}
    </GameFrame>
  );
}
