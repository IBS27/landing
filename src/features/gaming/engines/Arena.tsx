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

/**
 * Arena Blitz: a top-down battle with seven bots inside a shrinking ring.
 * Move, aim and shoot; the last fighter standing takes the crown.
 */

const W = BOARD;
const H = 388;
const R = 11;
const BOTS = 7;
const SPEED = 140;
const BULLET = 430;
const COLORS = ["#fa5252", "#fd7e14", "#fab005", "#40c057", "#be4bdb", "#15aabf", "#e64980"];

type Fighter = {
  id: number;
  x: number;
  y: number;
  hp: number;
  cool: number;
  color: string;
  aim: number;
  wander: number;
  kills: number;
  bot: boolean;
};
type Bullet = { x: number; y: number; vx: number; vy: number; from: number; life: number };
type Rock = { x: number; y: number; r: number };
type World = {
  fighters: Fighter[];
  bullets: Bullet[];
  rocks: Rock[];
  zone: number;
  t: number;
  place: number;
  pops: { x: number; y: number; life: number }[];
};

function fresh(): World {
  const rocks: Rock[] = [
    { x: 110, y: 120, r: 20 },
    { x: 280, y: 100, r: 16 },
    { x: 194, y: 200, r: 24 },
    { x: 90, y: 280, r: 17 },
    { x: 300, y: 290, r: 21 },
  ];
  const fighters: Fighter[] = Array.from({ length: BOTS + 1 }, (_, i) => {
    const a = (i / (BOTS + 1)) * Math.PI * 2 + Math.PI / 2;
    return {
      id: i,
      x: W / 2 + Math.cos(a) * 160,
      y: H / 2 + Math.sin(a) * 160,
      hp: 100,
      cool: 1 + Math.random(),
      color: i === 0 ? "#1877f2" : COLORS[i - 1],
      aim: a + Math.PI,
      wander: Math.random() * Math.PI * 2,
      kills: 0,
      bot: i > 0,
    };
  });
  return { fighters, bullets: [], rocks, zone: 280, t: 0, place: BOTS + 1, pops: [] };
}

const blocked = (rocks: Rock[], x: number, y: number, r: number) =>
  rocks.some((k) => Math.hypot(k.x - x, k.y - y) < k.r + r);

export default function Arena({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ alive: BOTS + 1, hp: 100, kills: 0, place: BOTS + 1 });
  const w = useRef<World>(fresh());
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const firing = useRef(false);
  const { ref, ctx } = useCanvas(W, H);
  const held = useHeldKeys(phase === "playing");
  const won = hud.place === 1;
  const score = hud.kills * 100 + (BOTS + 1 - hud.place) * 40 + (won ? 500 : 0);
  useReport(score, onScore);

  const start = () => {
    w.current = fresh();
    setHud({ alive: BOTS + 1, hp: 100, kills: 0, place: BOTS + 1 });
    setPhase("playing");
  };

  const shoot = (s: World, f: Fighter, angle: number) => {
    if (f.cool > 0) return;
    s.bullets.push({
      x: f.x + Math.cos(angle) * (R + 4),
      y: f.y + Math.sin(angle) * (R + 4),
      vx: Math.cos(angle) * BULLET,
      vy: Math.sin(angle) * BULLET,
      from: f.id,
      life: 0.7,
    });
    f.cool = f.bot ? 0.75 + Math.random() * 0.5 : 0.28;
  };

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const s = w.current;
    x.fillStyle = "#2b2f36";
    x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,0.05)";
    x.lineWidth = 1;
    for (let g = 0; g < W; g += 24) {
      x.beginPath();
      x.moveTo(g, 0);
      x.lineTo(g, H);
      x.moveTo(0, g);
      x.lineTo(W, g);
      x.stroke();
    }
    // Storm outside the ring.
    x.save();
    x.beginPath();
    x.rect(0, 0, W, H);
    x.arc(W / 2, H / 2, s.zone, 0, Math.PI * 2, true);
    x.fillStyle = "rgba(250,82,82,0.28)";
    x.fill("evenodd");
    x.restore();
    x.strokeStyle = "#ff8787";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2, H / 2, s.zone, 0, Math.PI * 2);
    x.stroke();
    for (const k of s.rocks) {
      x.fillStyle = "#495057";
      x.beginPath();
      x.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "rgba(255,255,255,0.08)";
      x.beginPath();
      x.arc(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.5, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#ffe066";
    for (const b of s.bullets) {
      x.beginPath();
      x.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      x.fill();
    }
    for (const p of s.pops) {
      x.strokeStyle = `rgba(255,255,255,${p.life})`;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(p.x, p.y, R + (1 - p.life) * 18, 0, Math.PI * 2);
      x.stroke();
    }
    for (const f of s.fighters) {
      if (f.hp <= 0) continue;
      x.strokeStyle = "#dee2e6";
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(f.x, f.y);
      x.lineTo(f.x + Math.cos(f.aim) * (R + 7), f.y + Math.sin(f.aim) * (R + 7));
      x.stroke();
      x.fillStyle = f.color;
      x.beginPath();
      x.arc(f.x, f.y, R, 0, Math.PI * 2);
      x.fill();
      if (!f.bot) {
        x.strokeStyle = "#fff";
        x.lineWidth = 2.5;
        x.stroke();
      }
      x.fillStyle = "rgba(0,0,0,0.6)";
      x.fillRect(f.x - 12, f.y - R - 8, 24, 4);
      x.fillStyle = f.hp > 40 ? "#51cf66" : "#ff6b6b";
      x.fillRect(f.x - 12, f.y - R - 8, 24 * (f.hp / 100), 4);
    }
    const me = s.fighters[0];
    if (me.hp > 0 && mouse.current) {
      x.strokeStyle = "rgba(255,255,255,0.7)";
      x.lineWidth = 1.5;
      x.beginPath();
      x.arc(mouse.current.x, mouse.current.y, 7, 0, Math.PI * 2);
      x.moveTo(mouse.current.x - 11, mouse.current.y);
      x.lineTo(mouse.current.x + 11, mouse.current.y);
      x.moveTo(mouse.current.x, mouse.current.y - 11);
      x.lineTo(mouse.current.x, mouse.current.y + 11);
      x.stroke();
    }
  };

  useEffect(() => {
    if (phase !== "playing") draw();
  });

  useFrame((dt) => {
    const s = w.current;
    s.t += dt;
    // The ring starts closing after a few seconds.
    if (s.t > 6) s.zone = Math.max(46, s.zone - dt * 4.2);
    const alive = s.fighters.filter((f) => f.hp > 0);
    const me = s.fighters[0];
    const keys = held.current;

    for (const f of alive) {
      f.cool -= dt;
      let mx = 0;
      let my = 0;
      if (!f.bot) {
        mx =
          (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) -
          (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
        my =
          (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) -
          (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
        const others = alive.filter((o) => o !== f);
        const nearest = others.sort(
          (a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y),
        )[0];
        if (mouse.current) f.aim = Math.atan2(mouse.current.y - f.y, mouse.current.x - f.x);
        if (keys.has(" ") && nearest) {
          f.aim = Math.atan2(nearest.y - f.y, nearest.x - f.x);
          shoot(s, f, f.aim);
        }
        if (firing.current) shoot(s, f, f.aim);
      } else {
        const others = alive.filter((o) => o !== f);
        const target = others
          .map((o) => ({ o, d: Math.hypot(o.x - f.x, o.y - f.y) }))
          .sort((a, b) => a.d - b.d)[0];
        const toCentre = Math.hypot(W / 2 - f.x, H / 2 - f.y);
        if (toCentre > s.zone - 24) {
          mx = W / 2 - f.x;
          my = H / 2 - f.y;
        } else if (target && target.d < 210) {
          const a = Math.atan2(target.o.y - f.y, target.o.x - f.x);
          f.aim = a;
          // Keep a fighting distance and strafe.
          const want = target.d > 120 ? 1 : -0.6;
          mx = Math.cos(a) * want + Math.cos(a + Math.PI / 2) * Math.sin(s.t + f.id) * 0.8;
          my = Math.sin(a) * want + Math.sin(a + Math.PI / 2) * Math.sin(s.t + f.id) * 0.8;
          shoot(s, f, a + (Math.random() - 0.5) * 0.32);
        } else {
          f.wander += (Math.random() - 0.5) * dt * 3;
          mx = Math.cos(f.wander);
          my = Math.sin(f.wander);
        }
      }
      const len = Math.hypot(mx, my);
      if (len > 0) {
        const sp = (f.bot ? SPEED * 0.8 : SPEED) * dt;
        const nx = clamp(f.x + (mx / len) * sp, R, W - R);
        const ny = clamp(f.y + (my / len) * sp, R, H - R);
        if (!blocked(s.rocks, nx, f.y, R)) f.x = nx;
        if (!blocked(s.rocks, f.x, ny, R)) f.y = ny;
      }
      if (Math.hypot(W / 2 - f.x, H / 2 - f.y) > s.zone) f.hp -= 9 * dt;
    }

    for (const b of s.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (blocked(s.rocks, b.x, b.y, 1)) b.life = 0;
      for (const f of alive) {
        if (f.id === b.from || f.hp <= 0 || b.life <= 0) continue;
        if (Math.hypot(f.x - b.x, f.y - b.y) < R + 2) {
          f.hp -= 20;
          b.life = 0;
          if (f.hp <= 0) {
            const killer = s.fighters[b.from];
            if (killer) killer.kills++;
          }
        }
      }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > 0 && b.y > 0 && b.x < W && b.y < H);

    for (const f of alive)
      if (f.hp <= 0) {
        s.pops.push({ x: f.x, y: f.y, life: 1 });
        if (f.id === 0) s.place = alive.filter((o) => o.hp > 0).length + 1;
      }
    for (const p of s.pops) p.life -= dt * 2;
    s.pops = s.pops.filter((p) => p.life > 0);

    const left = s.fighters.filter((f) => f.hp > 0).length;
    if (me.hp > 0 && left === 1) s.place = 1;
    setHud((h) => {
      const next = {
        alive: left,
        hp: Math.max(0, Math.ceil(me.hp)),
        kills: me.kills,
        place: s.place,
      };
      return h.alive === next.alive &&
        h.hp === next.hp &&
        h.kills === next.kills &&
        h.place === next.place
        ? h
        : next;
    });
    draw();
    if (me.hp <= 0 || left === 1) setPhase("over");
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Eight fighters, one ring that keeps shrinking. Move, aim and fire — be the last one standing."
      overTitle={won ? "Last one standing!" : `Eliminated — #${hud.place}`}
      overDetail={`${hud.kills} ${hud.kills === 1 ? "elimination" : "eliminations"} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Alive <b>{hud.alive}</b>
          </span>
          <span>
            Health <b>{hud.hp}</b>
          </span>
          <span>
            Eliminations <b>{hud.kills}</b>
          </span>
        </>
      }
      hint="WASD move · Click fires · Space auto-aims"
      style={{ width: W }}
    >
      <canvas
        ref={ref}
        className="block cursor-none touch-none"
        style={{ width: W, height: H }}
        onPointerMove={(e) => {
          mouse.current = localPoint(e, e.currentTarget);
        }}
        onPointerLeave={() => {
          mouse.current = null;
          firing.current = false;
        }}
        onPointerDown={(e) => {
          mouse.current = localPoint(e, e.currentTarget);
          firing.current = true;
        }}
        onPointerUp={() => {
          firing.current = false;
        }}
      />
    </GameFrame>
  );
}
