import { useEffect, useRef, useState } from "react";
import {
  BOARD,
  clamp,
  type EngineProps,
  GameFrame,
  localPoint,
  type Phase,
  pick,
  randInt,
  useCanvas,
  useFrame,
  useHeldKeys,
  useKeys,
  useReport,
} from "./kit";

/**
 * Bubble shooter: aim, bounce off the walls and connect three or more of a
 * color to pop them; bubbles cut loose fall for bonus points. Every few misses
 * the ceiling drops a row; let the bubbles reach the line and it's over.
 */

const W = BOARD;
const H = 450;
const R = 17;
const COLS = 11;
const ROW_H = R * Math.sqrt(3);
const LEFT = (W - COLS * 2 * R) / 2;
const SHOOTER = { x: W / 2, y: H - 32 };
const DEATH = H - 74;
const MAX_ROWS = Math.floor((DEATH - R) / ROW_H) + 1;
const COLORS = ["#ff4d6d", "#ffd43b", "#51cf66", "#339af0", "#cc5de8"];
const SHADES = ["#a8122f", "#b38600", "#237a33", "#0d5aa7", "#7b2a9b"];
const MISSES_PER_ROW = 6;

type Cell = number | null;
type Flying = { x: number; y: number; vx: number; vy: number; color: number };
type Falling = { x: number; y: number; vy: number; color: number };
type World = {
  rows: Cell[][];
  parity: number;
  current: number;
  next: number;
  shot: Flying | null;
  falling: Falling[];
  misses: number;
  aim: number;
  level: number;
};

const offset = (s: { parity: number }, r: number) => (r + s.parity) % 2 === 1;
const rowLen = (s: { parity: number }, r: number) => (offset(s, r) ? COLS - 1 : COLS);
const cx = (s: { parity: number }, r: number, c: number) =>
  LEFT + R + c * 2 * R + (offset(s, r) ? R : 0);
const cy = (r: number) => R + r * ROW_H;

function neighbours(s: { parity: number }, r: number, c: number): [number, number][] {
  const o = offset(s, r);
  const cand: [number, number][] = o
    ? [
        [r, c - 1],
        [r, c + 1],
        [r - 1, c],
        [r - 1, c + 1],
        [r + 1, c],
        [r + 1, c + 1],
      ]
    : [
        [r, c - 1],
        [r, c + 1],
        [r - 1, c - 1],
        [r - 1, c],
        [r + 1, c - 1],
        [r + 1, c],
      ];
  return cand.filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < rowLen(s, rr));
}

function fresh(level = 1): World {
  const s: World = {
    rows: [],
    parity: 0,
    current: 0,
    next: 0,
    shot: null,
    falling: [],
    misses: 0,
    aim: -Math.PI / 2,
    level,
  };
  const palette = Math.min(COLORS.length, 3 + level);
  for (let r = 0; r < Math.min(8, 4 + level); r++)
    s.rows.push(Array.from({ length: rowLen(s, r) }, () => randInt(palette)));
  s.current = randInt(palette);
  s.next = randInt(palette);
  return s;
}

const at = (s: World, r: number, c: number): Cell => s.rows[r]?.[c] ?? null;

function present(s: World) {
  const set = new Set<number>();
  for (const row of s.rows) for (const v of row) if (v !== null) set.add(v);
  return [...set];
}

export default function Bubbles({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [hud, setHud] = useState({ level: 1, misses: 0 });
  const w = useRef<World>(fresh());
  const { ref, ctx } = useCanvas(W, H);
  const held = useHeldKeys(phase === "playing");
  useReport(score, onScore);

  const start = () => {
    w.current = fresh();
    setScore(0);
    setHud({ level: 1, misses: 0 });
    setPhase("playing");
  };

  const fire = () => {
    const s = w.current;
    if (s.shot || phase !== "playing") return;
    s.shot = {
      x: SHOOTER.x,
      y: SHOOTER.y,
      vx: Math.cos(s.aim) * 760,
      vy: Math.sin(s.aim) * 760,
      color: s.current,
    };
    s.current = s.next;
    const colors = present(s);
    s.next = colors.length ? pick(colors) : randInt(COLORS.length);
  };

  const bubble = (
    x: CanvasRenderingContext2D,
    px: number,
    py: number,
    color: number,
    r = R - 1,
  ) => {
    const g = x.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.15, px, py, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, COLORS[color]);
    g.addColorStop(1, SHADES[color]);
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  };

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const s = w.current;
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#3a2a7a");
    bg.addColorStop(1, "#7c3f9e");
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,0.35)";
    x.setLineDash([6, 6]);
    x.beginPath();
    x.moveTo(0, DEATH);
    x.lineTo(W, DEATH);
    x.stroke();

    // Aim guide, including one bounce off a side wall.
    if (!s.shot && phase === "playing") {
      x.strokeStyle = "rgba(255,255,255,0.55)";
      x.setLineDash([3, 7]);
      x.lineWidth = 2;
      x.beginPath();
      let px = SHOOTER.x;
      let py = SHOOTER.y;
      let dx = Math.cos(s.aim);
      const dy = Math.sin(s.aim);
      x.moveTo(px, py);
      for (let len = 0; len < 260; len += 4) {
        px += dx * 4;
        py += dy * 4;
        if (px < LEFT + R || px > W - LEFT - R) dx = -dx;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.setLineDash([]);

    s.rows.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v !== null) bubble(x, cx(s, r, c), cy(r), v);
      });
    });
    for (const f of s.falling) bubble(x, f.x, f.y, f.color);
    if (s.shot) bubble(x, s.shot.x, s.shot.y, s.shot.color);

    // Shooter.
    x.save();
    x.translate(SHOOTER.x, SHOOTER.y);
    x.rotate(s.aim + Math.PI / 2);
    x.fillStyle = "rgba(255,255,255,0.85)";
    x.beginPath();
    x.moveTo(-7, -R - 4);
    x.lineTo(7, -R - 4);
    x.lineTo(0, -R - 16);
    x.closePath();
    x.fill();
    x.restore();
    if (!s.shot) bubble(x, SHOOTER.x, SHOOTER.y, s.current);
    x.fillStyle = "rgba(255,255,255,0.75)";
    x.font = "600 12px system-ui, sans-serif";
    x.textAlign = "left";
    x.fillText("Next", SHOOTER.x + 44, SHOOTER.y + 4);
    bubble(x, SHOOTER.x + 86, SHOOTER.y, s.next, R * 0.7);
  };

  useEffect(() => {
    if (phase !== "playing") draw();
  });

  /** Puts the shot in the nearest free cell, then pops and drops. */
  const land = (s: World, f: Flying) => {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    const r0 = Math.max(0, Math.round((f.y - R) / ROW_H) - 1);
    for (let r = r0; r <= Math.min(MAX_ROWS, r0 + 2); r++)
      for (let c = 0; c < rowLen(s, r); c++) {
        if (at(s, r, c) !== null) continue;
        const d = Math.hypot(cx(s, r, c) - f.x, cy(r) - f.y);
        if (d < bestD) {
          bestD = d;
          best = [r, c];
        }
      }
    if (!best) return;
    const [br, bc] = best;
    while (s.rows.length <= br) s.rows.push(Array(rowLen(s, s.rows.length)).fill(null));
    s.rows[br][bc] = f.color;

    const group = new Set<string>([`${br},${bc}`]);
    const queue: [number, number][] = [[br, bc]];
    while (queue.length) {
      const [r, c] = queue.pop()!;
      for (const [nr, nc] of neighbours(s, r, c))
        if (at(s, nr, nc) === f.color && !group.has(`${nr},${nc}`)) {
          group.add(`${nr},${nc}`);
          queue.push([nr, nc]);
        }
    }
    let gained = 0;
    if (group.size >= 3) {
      for (const k of group) {
        const [r, c] = k.split(",").map(Number);
        s.rows[r][c] = null;
      }
      gained += group.size * 10;
      // Anything no longer connected to the ceiling falls.
      const anchored = new Set<string>();
      const q: [number, number][] = [];
      (s.rows[0] ?? []).forEach((v, c) => {
        if (v !== null) {
          anchored.add(`0,${c}`);
          q.push([0, c]);
        }
      });
      while (q.length) {
        const [r, c] = q.pop()!;
        for (const [nr, nc] of neighbours(s, r, c))
          if (at(s, nr, nc) !== null && !anchored.has(`${nr},${nc}`)) {
            anchored.add(`${nr},${nc}`);
            q.push([nr, nc]);
          }
      }
      s.rows.forEach((row, r) => {
        row.forEach((v, c) => {
          if (v !== null && !anchored.has(`${r},${c}`)) {
            s.falling.push({ x: cx(s, r, c), y: cy(r), vy: -60 - Math.random() * 80, color: v });
            row[c] = null;
            gained += 20;
          }
        });
      });
      s.misses = 0;
    } else {
      s.misses++;
      if (s.misses >= MISSES_PER_ROW) {
        s.misses = 0;
        s.parity ^= 1;
        const colors = present(s);
        s.rows.unshift(
          Array.from({ length: rowLen(s, 0) }, () => (colors.length ? pick(colors) : randInt(4))),
        );
      }
    }
    while (s.rows.length && s.rows[s.rows.length - 1].every((v) => v === null)) s.rows.pop();
    if (gained) setScore((x) => x + gained);
    if (s.rows.length === 0) {
      setScore((x) => x + 500 * s.level);
      const next = fresh(s.level + 1);
      next.falling = s.falling;
      w.current = next;
    }
    setHud({ level: w.current.level, misses: w.current.misses });
    if (w.current.rows.some((row, r) => row.some((v) => v !== null) && cy(r) + R > DEATH)) {
      draw();
      setPhase("over");
    }
  };

  useFrame((dt) => {
    const s = w.current;
    const k = held.current;
    const turn =
      (k.has("ArrowRight") || k.has("d") ? 1 : 0) - (k.has("ArrowLeft") || k.has("a") ? 1 : 0);
    if (turn) s.aim = clamp(s.aim + turn * 1.8 * dt, -Math.PI + 0.17, -0.17);
    for (const f of s.falling) {
      f.vy += 900 * dt;
      f.y += f.vy * dt;
    }
    s.falling = s.falling.filter((f) => f.y < H + R);
    const shot = s.shot;
    if (shot) {
      const steps = 6;
      for (let i = 0; i < steps && s.shot; i++) {
        shot.x += (shot.vx * dt) / steps;
        shot.y += (shot.vy * dt) / steps;
        if (shot.x < LEFT + R) {
          shot.x = LEFT + R;
          shot.vx = Math.abs(shot.vx);
        } else if (shot.x > W - LEFT - R) {
          shot.x = W - LEFT - R;
          shot.vx = -Math.abs(shot.vx);
        }
        let hit = shot.y <= R;
        if (!hit)
          s.rows.forEach((row, r) => {
            row.forEach((v, c) => {
              if (v !== null && Math.hypot(cx(s, r, c) - shot.x, cy(r) - shot.y) < 2 * R * 0.86)
                hit = true;
            });
          });
        if (hit) {
          s.shot = null;
          land(s, shot);
        }
      }
    }
    draw();
  }, phase === "playing");

  useKeys((e) => {
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
      fire();
      return true;
    }
    return false;
  }, phase === "playing");

  const aimAt = (e: { clientX: number; clientY: number }, el: Element) => {
    const p = localPoint(e, el);
    w.current.aim = clamp(Math.atan2(p.y - SHOOTER.y, p.x - SHOOTER.x), -Math.PI + 0.17, -0.17);
  };

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Aim and shoot to connect three or more bubbles of the same color. Clear the board before the bubbles reach the line."
      overTitle="The bubbles reached the line"
      overDetail={`Level ${hud.level} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Level <b>{hud.level}</b>
          </span>
          <span>
            New row in <b>{MISSES_PER_ROW - hud.misses}</b>{" "}
            {MISSES_PER_ROW - hud.misses === 1 ? "miss" : "misses"}
          </span>
        </>
      }
      hint="Aim with the mouse, click to shoot · ←/→, Space"
      style={{ width: W }}
    >
      <canvas
        ref={ref}
        className="block cursor-crosshair touch-none"
        style={{ width: W, height: H }}
        onPointerMove={(e) => aimAt(e, e.currentTarget)}
        onPointerDown={(e) => {
          aimAt(e, e.currentTarget);
          fire();
        }}
      />
    </GameFrame>
  );
}
