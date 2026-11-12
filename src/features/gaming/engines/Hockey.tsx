import { useEffect, useRef, useState } from "react";
import {
  BOARD,
  clamp,
  type EngineProps,
  GameFrame,
  localPoint,
  type Phase,
  useCanvas,
  useFrame,
  useHeldKeys,
  useReport,
} from "./kit";

/** Air hockey against the computer: first to seven goals wins the match. */

/** Rink size inside the 5px boards. */
const W = BOARD - 10;
const H = 440;
const GOAL = 124;
const PR = 23;
const KR = 13;
const TO_WIN = 7;
const MAX = 950;

type Body = { x: number; y: number; vx: number; vy: number };
type World = {
  me: Body;
  ai: Body;
  puck: Body;
  pause: number;
  goals: [number, number];
  flash: string;
};

const fresh = (): World => ({
  me: { x: W / 2, y: H - 60, vx: 0, vy: 0 },
  ai: { x: W / 2, y: 60, vx: 0, vy: 0 },
  puck: { x: W / 2, y: H / 2 + 50, vx: 0, vy: 0 },
  pause: 0.6,
  goals: [0, 0],
  flash: "",
});

function hit(p: Body, k: Body) {
  const dx = k.x - p.x;
  const dy = k.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= PR + KR) return;
  const nx = dx / d;
  const ny = dy / d;
  k.x = p.x + nx * (PR + KR);
  k.y = p.y + ny * (PR + KR);
  const rel = (k.vx - p.vx) * nx + (k.vy - p.vy) * ny;
  if (rel < 0) {
    k.vx -= 1.9 * rel * nx;
    k.vy -= 1.9 * rel * ny;
  }
  const sp = Math.hypot(k.vx, k.vy);
  if (sp > MAX) {
    k.vx *= MAX / sp;
    k.vy *= MAX / sp;
  }
}

export default function Hockey({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [goals, setGoals] = useState<[number, number]>([0, 0]);
  const w = useRef<World>(fresh());
  const target = useRef<{ x: number; y: number } | null>(null);
  const { ref, ctx } = useCanvas(W, H);
  const held = useHeldKeys(phase === "playing");
  const won = goals[0] >= TO_WIN;
  const score = Math.max(0, goals[0] * 100 - goals[1] * 25) + (won ? 1000 : 0);
  useReport(score, onScore);

  const start = () => {
    w.current = fresh();
    target.current = null;
    setGoals([0, 0]);
    setPhase("playing");
  };

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const st = w.current;
    x.fillStyle = "#eef6fc";
    x.fillRect(0, 0, W, H);
    x.lineWidth = 3;
    x.strokeStyle = "#d63939";
    x.beginPath();
    x.moveTo(0, H / 2);
    x.lineTo(W, H / 2);
    x.stroke();
    x.beginPath();
    x.arc(W / 2, H / 2, 46, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = "#1c7ed6";
    for (const y of [H / 3, (2 * H) / 3]) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(W, y);
      x.stroke();
    }
    // Goal creases and mouths.
    x.fillStyle = "rgba(28,126,214,0.18)";
    for (const y of [0, H]) {
      x.beginPath();
      x.arc(W / 2, y, GOAL / 2, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#343a40";
    x.fillRect(W / 2 - GOAL / 2, 0, GOAL, 5);
    x.fillRect(W / 2 - GOAL / 2, H - 5, GOAL, 5);
    const paddle = (b: Body, c: string, rim: string) => {
      x.fillStyle = rim;
      x.beginPath();
      x.arc(b.x, b.y, PR, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = c;
      x.beginPath();
      x.arc(b.x, b.y, PR - 6, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "rgba(255,255,255,0.35)";
      x.beginPath();
      x.arc(b.x - 3, b.y - 4, 7, 0, Math.PI * 2);
      x.fill();
    };
    paddle(st.ai, "#e03131", "#a51111");
    paddle(st.me, "#1c7ed6", "#0b4f9c");
    x.fillStyle = "#111";
    x.beginPath();
    x.arc(st.puck.x, st.puck.y, KR, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#444";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(st.puck.x, st.puck.y, KR - 4, 0, Math.PI * 2);
    x.stroke();
    if (st.flash) {
      x.fillStyle = "rgba(0,0,0,0.55)";
      x.font = "800 30px system-ui, sans-serif";
      x.textAlign = "center";
      x.fillText(st.flash, W / 2, H / 2 - 64);
    }
  };

  useEffect(() => {
    if (phase !== "playing") draw();
  });

  useFrame((dt) => {
    const st = w.current;
    const { me, ai, puck } = st;
    // Player paddle follows the pointer, or the arrow keys.
    const k = held.current;
    const kx =
      (k.has("ArrowRight") || k.has("d") ? 1 : 0) - (k.has("ArrowLeft") || k.has("a") ? 1 : 0);
    const ky =
      (k.has("ArrowDown") || k.has("s") ? 1 : 0) - (k.has("ArrowUp") || k.has("w") ? 1 : 0);
    const px = me.x;
    const py = me.y;
    if (kx || ky) {
      target.current = null;
      me.x += kx * 480 * dt;
      me.y += ky * 480 * dt;
    } else if (target.current) {
      const t = target.current;
      const d = Math.hypot(t.x - me.x, t.y - me.y);
      const step = Math.min(d, 1400 * dt);
      if (d > 0) {
        me.x += ((t.x - me.x) / d) * step;
        me.y += ((t.y - me.y) / d) * step;
      }
    }
    me.x = clamp(me.x, PR, W - PR);
    me.y = clamp(me.y, H / 2 + PR, H - PR);
    me.vx = (me.x - px) / dt;
    me.vy = (me.y - py) / dt;

    // Computer: attack the puck in its half, otherwise guard the goal.
    const ax = ai.x;
    const ay = ai.y;
    const speed = 300 + Math.min(4, st.goals[0]) * 25;
    let tx: number;
    let ty: number;
    if (puck.y < H / 2 + 10 && puck.y > ai.y - 5) {
      tx = puck.x;
      ty = puck.y - KR;
    } else {
      tx = W / 2 + (puck.x - W / 2) * 0.55;
      ty = 58;
    }
    const d = Math.hypot(tx - ai.x, ty - ai.y);
    const step = Math.min(d, speed * dt);
    if (d > 0) {
      ai.x += ((tx - ai.x) / d) * step;
      ai.y += ((ty - ai.y) / d) * step;
    }
    ai.x = clamp(ai.x, PR, W - PR);
    ai.y = clamp(ai.y, PR, H / 2 - PR);
    ai.vx = (ai.x - ax) / dt;
    ai.vy = (ai.y - ay) / dt;

    if (st.pause > 0) {
      st.pause -= dt;
      if (st.pause <= 0) st.flash = "";
      draw();
      return;
    }

    const sub = 3;
    for (let i = 0; i < sub; i++) {
      puck.x += (puck.vx * dt) / sub;
      puck.y += (puck.vy * dt) / sub;
      hit(me, puck);
      hit(ai, puck);
      if (puck.x < KR) {
        puck.x = KR;
        puck.vx = Math.abs(puck.vx) * 0.9;
      } else if (puck.x > W - KR) {
        puck.x = W - KR;
        puck.vx = -Math.abs(puck.vx) * 0.9;
      }
      const inMouth = Math.abs(puck.x - W / 2) < GOAL / 2 - KR / 2;
      if (!inMouth) {
        if (puck.y < KR) {
          puck.y = KR;
          puck.vy = Math.abs(puck.vy) * 0.9;
        } else if (puck.y > H - KR) {
          puck.y = H - KR;
          puck.vy = -Math.abs(puck.vy) * 0.9;
        }
      }
    }
    const f = 0.992 ** (dt * 60);
    puck.vx *= f;
    puck.vy *= f;

    const scored = puck.y < -KR ? 0 : puck.y > H + KR ? 1 : null;
    if (scored !== null) {
      const g: [number, number] = [...st.goals];
      g[scored]++;
      st.goals = g;
      setGoals(g);
      st.flash = scored === 0 ? "Goal!" : "They scored";
      if (g[scored] >= TO_WIN) {
        draw();
        setPhase("over");
        return;
      }
      // The side that conceded restarts with the puck.
      Object.assign(puck, { x: W / 2, y: scored === 0 ? H / 2 - 60 : H / 2 + 60, vx: 0, vy: 0 });
      st.pause = 1;
    }
    draw();
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Move your blue paddle to strike the puck into the top goal. First to 7 wins."
      overTitle={won ? "You win the match!" : "The computer wins"}
      overDetail={`${goals[0]} – ${goals[1]} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            You <b>{goals[0]}</b>
          </span>
          <span>First to {TO_WIN}</span>
          <span>
            Computer <b>{goals[1]}</b>
          </span>
        </>
      }
      hint="Move the mouse, or arrow keys / WASD"
      className="border-[5px] border-[#adb5bd]"
      style={{ width: W + 10 }}
    >
      <canvas
        ref={ref}
        className="block cursor-none touch-none"
        style={{ width: W, height: H }}
        onPointerMove={(e) => {
          const p = localPoint(e, e.currentTarget);
          target.current = p;
        }}
      />
    </GameFrame>
  );
}
