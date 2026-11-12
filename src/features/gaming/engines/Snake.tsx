import { useEffect, useRef, useState } from "react";
import {
  type EngineProps,
  GameFrame,
  localPoint,
  type Phase,
  randInt,
  useCanvas,
  useKeys,
  useReport,
} from "./kit";

/**
 * Snake: eat apples to grow; golden apples are worth more but vanish fast.
 * The snake speeds up as it grows. Hitting a wall or yourself ends the run.
 */

const G = 20;
const C = 18;
const PX = G * C;
type P = { x: number; y: number };
const DIRS: Record<string, P> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type State = {
  snake: P[];
  dir: P;
  queue: P[];
  food: P;
  gold: (P & { until: number }) | null;
  eaten: number;
};

function freeCell(s: Pick<State, "snake"> & { avoid?: P[] }): P {
  for (;;) {
    const p = { x: randInt(G), y: randInt(G) };
    if (![...s.snake, ...(s.avoid ?? [])].some((q) => q.x === p.x && q.y === p.y)) return p;
  }
}

function fresh(): State {
  const snake = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
  ];
  return { snake, dir: DIRS.right, queue: [], food: freeCell({ snake }), gold: null, eaten: 0 };
}

export default function Snake({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(3);
  const s = useRef<State>(fresh());
  const { ref, ctx } = useCanvas(PX, PX);
  useReport(score, onScore);

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const st = s.current;
    for (let i = 0; i < G; i++)
      for (let j = 0; j < G; j++) {
        x.fillStyle = (i + j) % 2 ? "#a9d751" : "#a2d149";
        x.fillRect(i * C, j * C, C, C);
      }
    x.font = `${C * 0.95}px serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("🍎", st.food.x * C + C / 2, st.food.y * C + C / 2 + 1);
    if (st.gold) {
      const left = st.gold.until - performance.now();
      if (left > 1500 || Math.floor(left / 150) % 2) {
        x.beginPath();
        x.arc(st.gold.x * C + C / 2, st.gold.y * C + C / 2, C * 0.62, 0, Math.PI * 2);
        x.fillStyle = "rgba(255,215,0,0.45)";
        x.fill();
        x.fillText("🍋", st.gold.x * C + C / 2, st.gold.y * C + C / 2 + 1);
      }
    }
    const n = st.snake.length;
    st.snake.forEach((p, i) => {
      const t = i / Math.max(1, n - 1);
      // Amber head fading to yellow, like the key art.
      x.fillStyle = `rgb(${Math.round(232 + t * 23)}, ${Math.round(120 + t * 92)}, ${Math.round(12 + t * 47)})`;
      const pad = i === 0 ? 0.5 : 1.5;
      x.beginPath();
      x.roundRect(p.x * C + pad, p.y * C + pad, C - pad * 2, C - pad * 2, i === 0 ? 7 : 5);
      x.fill();
    });
    // Eyes.
    const h = st.snake[0];
    const d = st.dir;
    for (const side of [-1, 1]) {
      const ex = h.x * C + C / 2 + d.x * 3 + -d.y * side * 4;
      const ey = h.y * C + C / 2 + d.y * 3 + d.x * side * 4;
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(ex, ey, 3, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#111";
      x.beginPath();
      x.arc(ex + d.x, ey + d.y, 1.5, 0, Math.PI * 2);
      x.fill();
    }
  };

  const start = () => {
    s.current = fresh();
    setScore(0);
    setLength(3);
    setPhase("playing");
  };

  // Game tick; the interval shortens as the snake grows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `draw` reads refs only; the loop restarts per run.
  useEffect(() => {
    if (phase !== "playing") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive) return;
      const st = s.current;
      const nd = st.queue.shift();
      if (nd) st.dir = nd;
      const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
      const willEat = head.x === st.food.x && head.y === st.food.y;
      const body = willEat ? st.snake : st.snake.slice(0, -1);
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= G ||
        head.y >= G ||
        body.some((p) => p.x === head.x && p.y === head.y)
      ) {
        draw();
        setPhase("over");
        return;
      }
      st.snake = [head, ...body];
      if (willEat) {
        st.eaten++;
        st.food = freeCell({ snake: st.snake, avoid: st.gold ? [st.gold] : [] });
        setScore((x) => x + 10);
        if (!st.gold && st.eaten % 5 === 0)
          st.gold = {
            ...freeCell({ snake: st.snake, avoid: [st.food] }),
            until: performance.now() + 6000,
          };
      }
      if (st.gold && head.x === st.gold.x && head.y === st.gold.y) {
        st.gold = null;
        setScore((x) => x + 50);
      }
      if (st.gold && performance.now() > st.gold.until) st.gold = null;
      setLength(st.snake.length);
      draw();
      timer = setTimeout(tick, Math.max(65, 135 - st.eaten * 3));
    };
    timer = setTimeout(tick, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [phase]);

  // Draw the starting board.
  useEffect(() => {
    if (phase === "ready") draw();
  });

  const turn = (name: keyof typeof DIRS) => {
    const st = s.current;
    const d = DIRS[name];
    const last = st.queue[st.queue.length - 1] ?? st.dir;
    if (last.x === -d.x && last.y === -d.y) return;
    if (last.x === d.x && last.y === d.y) return;
    if (st.queue.length < 3) st.queue.push(d);
  };

  useKeys((e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const name = (
      {
        ArrowUp: "up",
        w: "up",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
        ArrowRight: "right",
        d: "right",
      } as const
    )[k];
    if (!name) return false;
    turn(name);
    return true;
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Eat apples to grow longer without hitting the walls or your own tail. Golden lemons are worth 50 but don't last."
      overDetail={`${score} points · length ${length}`}
      onStart={start}
      hud={
        <>
          <span>
            Length <b>{length}</b>
          </span>
          <span>🍎 10 · 🍋 50</span>
        </>
      }
      hint="Arrow keys / WASD, or click to turn"
      className="border-[6px] border-[#4a752c]"
      style={{ width: PX + 12 }}
    >
      <canvas
        ref={ref}
        className="block touch-none"
        style={{ width: PX, height: PX }}
        onPointerDown={(e) => {
          if (phase !== "playing") return;
          const st = s.current;
          const p = localPoint(e, e.currentTarget);
          const last = st.queue[st.queue.length - 1] ?? st.dir;
          const hx = st.snake[0].x * C + C / 2;
          const hy = st.snake[0].y * C + C / 2;
          if (last.x !== 0) turn(p.y < hy ? "up" : "down");
          else turn(p.x < hx ? "left" : "right");
        }}
      />
    </GameFrame>
  );
}
