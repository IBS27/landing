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
  useKeys,
  useReport,
} from "./kit";

/** Brick breaker: keep the ball in play with the paddle and clear every brick. */

const W = BOARD;
const H = 430;
const COLS = 8;
const PAD_W = 72;
const PAD_H = 12;
const PAD_Y = H - 30;
const R = 7;
const ROW_COLORS = ["#ff4d8d", "#ff7a59", "#ffc145", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"];

type Brick = { x: number; y: number; w: number; h: number; hp: number; row: number };
type World = {
  pad: number;
  ball: { x: number; y: number; vx: number; vy: number; stuck: boolean };
  bricks: Brick[];
  lives: number;
  level: number;
  sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[];
};

function bricksFor(level: number): Brick[] {
  const rows = Math.min(7, 4 + level);
  const gap = 4;
  const bw = (W - 20 - gap * (COLS - 1)) / COLS;
  const out: Brick[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < COLS; c++)
      out.push({
        x: 10 + c * (bw + gap),
        y: 50 + r * 22,
        w: bw,
        h: 18,
        hp: level > 1 && r < level - 1 ? 2 : 1,
        row: r,
      });
  return out;
}

const speedFor = (level: number) => 300 + level * 30;

function fresh(level = 1, lives = 3): World {
  return {
    pad: W / 2,
    ball: { x: W / 2, y: PAD_Y - R - 1, vx: 0, vy: 0, stuck: true },
    bricks: bricksFor(level),
    lives,
    level,
    sparks: [],
  };
}

export default function Breakout({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [hud, setHud] = useState({ lives: 3, level: 1 });
  const w = useRef<World>(fresh());
  const { ref, ctx } = useCanvas(W, H);
  const held = useHeldKeys(phase === "playing");
  useReport(score, onScore);

  const launch = () => {
    const b = w.current.ball;
    if (!b.stuck || phase !== "playing") return;
    const sp = speedFor(w.current.level);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
    b.stuck = false;
  };

  const start = () => {
    w.current = fresh();
    setScore(0);
    setHud({ lives: 3, level: 1 });
    setPhase("playing");
  };

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const st = w.current;
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1050");
    bg.addColorStop(1, "#3b0f4f");
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    // Synthwave floor grid.
    x.strokeStyle = "rgba(242,72,110,0.18)";
    x.lineWidth = 1;
    for (let gy = H - 120; gy < H; gy += 16) {
      x.beginPath();
      x.moveTo(0, gy);
      x.lineTo(W, gy);
      x.stroke();
    }
    for (const b of st.bricks) {
      const col = ROW_COLORS[b.row % ROW_COLORS.length];
      x.shadowColor = col;
      x.shadowBlur = 8;
      x.fillStyle = col;
      x.globalAlpha = b.hp > 1 ? 1 : 0.88;
      x.beginPath();
      x.roundRect(b.x, b.y, b.w, b.h, 4);
      x.fill();
      x.shadowBlur = 0;
      x.globalAlpha = 1;
      if (b.hp > 1) {
        x.strokeStyle = "#fff";
        x.lineWidth = 2;
        x.stroke();
      }
      x.fillStyle = "rgba(255,255,255,0.25)";
      x.fillRect(b.x + 3, b.y + 3, b.w - 6, 3);
    }
    for (const p of st.sparks) {
      x.globalAlpha = Math.max(0, p.life);
      x.fillStyle = p.color;
      x.fillRect(p.x, p.y, 3, 3);
    }
    x.globalAlpha = 1;
    // Paddle.
    x.shadowColor = "#38bdf8";
    x.shadowBlur = 12;
    x.fillStyle = "#e0f2fe";
    x.beginPath();
    x.roundRect(st.pad - PAD_W / 2, PAD_Y, PAD_W, PAD_H, 6);
    x.fill();
    // Ball.
    x.shadowColor = "#fff";
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(st.ball.x, st.ball.y, R, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    if (st.ball.stuck && phase === "playing") {
      x.fillStyle = "rgba(255,255,255,0.85)";
      x.font = "600 15px system-ui, sans-serif";
      x.textAlign = "center";
      x.fillText("Click or press Space to launch", W / 2, H / 2 + 40);
    }
  };

  useEffect(() => {
    if (phase !== "playing") draw();
  });

  useFrame((dt) => {
    const st = w.current;
    const b = st.ball;
    const keys = held.current;
    const dir =
      (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    st.pad = clamp(st.pad + dir * 460 * dt, PAD_W / 2, W - PAD_W / 2);
    for (const p of st.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt * 1.8;
    }
    st.sparks = st.sparks.filter((p) => p.life > 0);

    if (b.stuck) {
      b.x = st.pad;
      b.y = PAD_Y - R - 1;
      draw();
      return;
    }
    const steps = 4;
    let gained = 0;
    for (let k = 0; k < steps; k++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (b.x < R) {
        b.x = R;
        b.vx = Math.abs(b.vx);
      } else if (b.x > W - R) {
        b.x = W - R;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < R) {
        b.y = R;
        b.vy = Math.abs(b.vy);
      }
      // Paddle: the bounce angle depends on where the ball lands.
      if (
        b.vy > 0 &&
        b.y + R >= PAD_Y &&
        b.y - R <= PAD_Y + PAD_H &&
        Math.abs(b.x - st.pad) <= PAD_W / 2 + R
      ) {
        const off = clamp((b.x - st.pad) / (PAD_W / 2), -1, 1);
        const sp = Math.hypot(b.vx, b.vy);
        const a = off * (Math.PI / 3);
        b.vx = Math.sin(a) * sp;
        b.vy = -Math.cos(a) * sp;
        b.y = PAD_Y - R;
      }
      for (const br of st.bricks) {
        if (br.hp <= 0) continue;
        const nx = clamp(b.x, br.x, br.x + br.w);
        const ny = clamp(b.y, br.y, br.y + br.h);
        if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > R * R) continue;
        const ox = Math.min(b.x + R - br.x, br.x + br.w - (b.x - R));
        const oy = Math.min(b.y + R - br.y, br.y + br.h - (b.y - R));
        if (ox < oy) b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        br.hp--;
        if (br.hp === 0) {
          gained += 10 * (st.level + Math.max(0, 6 - br.row));
          const color = ROW_COLORS[br.row % ROW_COLORS.length];
          for (let i = 0; i < 8; i++)
            st.sparks.push({
              x: br.x + br.w / 2,
              y: br.y + br.h / 2,
              vx: (Math.random() - 0.5) * 220,
              vy: (Math.random() - 0.8) * 160,
              life: 1,
              color,
            });
        }
        break;
      }
    }
    st.bricks = st.bricks.filter((br) => br.hp > 0);
    if (gained) setScore((s) => s + gained);

    if (b.y > H + R) {
      st.lives--;
      if (st.lives <= 0) {
        setHud({ lives: 0, level: st.level });
        draw();
        setPhase("over");
        return;
      }
      b.stuck = true;
      setHud({ lives: st.lives, level: st.level });
    }
    if (st.bricks.length === 0) {
      const next = fresh(st.level + 1, st.lives);
      setScore((s) => s + 100 * st.level);
      w.current = next;
      setHud({ lives: next.lives, level: next.level });
    }
    draw();
  }, phase === "playing");

  useKeys((e) => {
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
      launch();
      return true;
    }
    return false;
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Move the paddle to bounce the ball and break every brick. Don't let the ball fall past you."
      overDetail={`Level ${hud.level} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Level <b>{hud.level}</b>
          </span>
          <span role="img" aria-label={`${hud.lives} lives`}>
            {"💜".repeat(Math.max(0, hud.lives))}
          </span>
        </>
      }
      hint="Mouse or ←/→ to move · Click or Space to launch"
      style={{ width: W }}
    >
      <canvas
        ref={ref}
        className="block cursor-none touch-none"
        style={{ width: W, height: H }}
        onPointerMove={(e) => {
          if (phase !== "playing") return;
          w.current.pad = clamp(localPoint(e, e.currentTarget).x, PAD_W / 2, W - PAD_W / 2);
        }}
        onPointerDown={launch}
      />
    </GameFrame>
  );
}
