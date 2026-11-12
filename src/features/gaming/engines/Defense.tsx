import { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/primitives";
import {
  type EngineProps,
  GameFrame,
  localPoint,
  type Phase,
  useCanvas,
  useFrame,
  useKeys,
  useReport,
} from "./kit";

/**
 * Castle Siege, a small tower defense: build archer towers beside the road
 * and upgrade them to stop each wave of raiders before they reach the keep.
 */

const COLS = 12;
const ROWS = 11;
const C = 32;
const W = COLS * C;
const H = ROWS * C;
const LIVES = 10;
const BUILD = 50;
const UPGRADE = [0, 60, 100];
const BREAK = 6;

/** Road waypoints in cell coordinates; raiders enter on the left. */
const WAYPOINTS = [
  [-1, 1],
  [9, 1],
  [9, 4],
  [2, 4],
  [2, 8],
  [10, 8],
] as const;

const ROAD = (() => {
  const cells = new Set<number>();
  for (let k = 0; k < WAYPOINTS.length - 1; k++) {
    const [x0, y0] = WAYPOINTS[k];
    const [x1, y1] = WAYPOINTS[k + 1];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        if (x >= 0) cells.add(y * COLS + x);
  }
  return cells;
})();
const KEEP = 8 * COLS + 11;

const SEGMENTS = WAYPOINTS.slice(1).map((p, k) => {
  const a = WAYPOINTS[k];
  return { a, b: p, len: Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]) };
});
const PATH_LEN = SEGMENTS.reduce((s, x) => s + x.len, 0);

function pointAt(dist: number) {
  let d = dist;
  for (const s of SEGMENTS) {
    if (d <= s.len) {
      const t = d / s.len;
      return {
        x: (s.a[0] + (s.b[0] - s.a[0]) * t + 0.5) * C,
        y: (s.a[1] + (s.b[1] - s.a[1]) * t + 0.5) * C,
      };
    }
    d -= s.len;
  }
  const end = WAYPOINTS[WAYPOINTS.length - 1];
  return { x: (end[0] + 0.5) * C, y: (end[1] + 0.5) * C };
}

type Raider = { id: number; d: number; hp: number; max: number; speed: number; boss: boolean };
type Tower = { cell: number; level: number; cool: number };
type Shot = { x: number; y: number; target: number; dmg: number };
type World = {
  raiders: Raider[];
  towers: Tower[];
  shots: Shot[];
  gold: number;
  lives: number;
  wave: number;
  toSpawn: number;
  spawnCool: number;
  breakLeft: number;
  kills: number;
  nextId: number;
};

const fresh = (): World => ({
  raiders: [],
  towers: [],
  shots: [],
  gold: 120,
  lives: LIVES,
  wave: 0,
  toSpawn: 0,
  spawnCool: 0,
  breakLeft: BREAK,
  kills: 0,
  nextId: 1,
});

const towerStats = (level: number) => ({
  range: (2.3 + level * 0.45) * C,
  dmg: 9 * 1.7 ** (level - 1),
  rate: 0.75 - level * 0.08,
});

export default function Defense({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ gold: 120, lives: LIVES, wave: 0, kills: 0, breakLeft: BREAK });
  const [cursor, setCursor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const w = useRef<World>(fresh());
  const { ref, ctx } = useCanvas(W, H);
  const score = hud.kills * 10 + Math.max(0, hud.wave - 1) * 50;
  useReport(score, onScore);

  const sync = () => {
    const s = w.current;
    setHud((h) =>
      h.gold === s.gold &&
      h.lives === s.lives &&
      h.wave === s.wave &&
      h.kills === s.kills &&
      h.breakLeft === Math.ceil(s.breakLeft)
        ? h
        : {
            gold: s.gold,
            lives: s.lives,
            wave: s.wave,
            kills: s.kills,
            breakLeft: Math.ceil(s.breakLeft),
          },
    );
  };

  const start = () => {
    w.current = fresh();
    sync();
    setPhase("playing");
  };

  const sendWave = () => {
    const s = w.current;
    if (s.toSpawn > 0 || phase !== "playing") return;
    // Calling the wave early pays a bonus for the time saved.
    s.gold += Math.floor(Math.max(0, s.breakLeft) * 3);
    s.wave++;
    s.toSpawn = 6 + s.wave * 2;
    s.spawnCool = 0;
    s.breakLeft = 0;
    sync();
  };

  const act = (cell: number) => {
    const s = w.current;
    if (phase !== "playing" || ROAD.has(cell) || cell === KEEP) return;
    const t = s.towers.find((x) => x.cell === cell);
    if (t) {
      const cost = UPGRADE[t.level];
      if (cost && s.gold >= cost) {
        s.gold -= cost;
        t.level++;
      }
    } else if (s.gold >= BUILD) {
      s.gold -= BUILD;
      s.towers.push({ cell, level: 1, cool: 0 });
    }
    sync();
  };

  const draw = () => {
    const x = ctx.current;
    if (!x) return;
    const s = w.current;
    for (let i = 0; i < COLS * ROWS; i++) {
      const cx = (i % COLS) * C;
      const cy = Math.floor(i / COLS) * C;
      x.fillStyle = ROAD.has(i)
        ? "#c9a46a"
        : (i + Math.floor(i / COLS)) % 2
          ? "#6aa84f"
          : "#74b257";
      x.fillRect(cx, cy, C, C);
    }
    x.fillStyle = "rgba(120,85,40,0.35)";
    for (const i of ROAD)
      x.fillRect((i % COLS) * C + 4, Math.floor(i / COLS) * C + C / 2 - 1, C - 8, 2);
    x.font = `${C * 0.95}px serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("🏰", (KEEP % COLS) * C + C / 2, Math.floor(KEEP / COLS) * C + C / 2 - 4);

    const focus = cursor ?? hover;
    if (focus !== null && !ROAD.has(focus) && focus !== KEEP) {
      const t = s.towers.find((tw) => tw.cell === focus);
      const fx = (focus % COLS) * C + C / 2;
      const fy = Math.floor(focus / COLS) * C + C / 2;
      x.fillStyle = "rgba(255,255,255,0.18)";
      x.beginPath();
      x.arc(
        fx,
        fy,
        towerStats(t ? Math.min(3, t.level + (UPGRADE[t.level] ? 1 : 0)) : 1).range,
        0,
        Math.PI * 2,
      );
      x.fill();
      x.strokeStyle = cursor === focus ? "#ffe066" : "rgba(255,255,255,0.8)";
      x.lineWidth = 2;
      x.strokeRect((focus % COLS) * C + 1, Math.floor(focus / COLS) * C + 1, C - 2, C - 2);
    }

    for (const t of s.towers) {
      const tx = (t.cell % COLS) * C;
      const ty = Math.floor(t.cell / COLS) * C;
      x.fillStyle = "#6c757d";
      x.beginPath();
      x.roundRect(tx + 4, ty + 4, C - 8, C - 8, 4);
      x.fill();
      x.fillStyle = ["", "#adb5bd", "#4dabf7", "#ffd43b"][t.level];
      x.beginPath();
      x.arc(tx + C / 2, ty + C / 2, 8, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#212529";
      x.font = "700 10px system-ui, sans-serif";
      x.fillText(String(t.level), tx + C / 2, ty + C / 2 + 1);
    }
    for (const r of s.raiders) {
      const p = pointAt(r.d);
      const rad = r.boss ? 12 : 8;
      x.fillStyle = r.boss ? "#5f3dc4" : "#c92a2a";
      x.beginPath();
      x.arc(p.x, p.y, rad, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#343a40";
      x.beginPath();
      x.arc(p.x, p.y - rad * 0.35, rad * 0.7, Math.PI, 0);
      x.fill();
      x.fillStyle = "#000";
      x.fillRect(p.x - 10, p.y - rad - 7, 20, 3);
      x.fillStyle = "#51cf66";
      x.fillRect(p.x - 10, p.y - rad - 7, 20 * (r.hp / r.max), 3);
    }
    x.fillStyle = "#3b2a14";
    for (const sh of s.shots) {
      x.beginPath();
      x.arc(sh.x, sh.y, 2.5, 0, Math.PI * 2);
      x.fill();
    }
  };

  useEffect(() => {
    if (phase !== "playing") draw();
  });

  useFrame((dt) => {
    const s = w.current;
    if (s.toSpawn === 0 && s.raiders.length === 0) {
      s.breakLeft -= dt;
      if (s.breakLeft <= 0) sendWave();
    }
    if (s.toSpawn > 0) {
      s.spawnCool -= dt;
      if (s.spawnCool <= 0) {
        const boss = s.wave % 5 === 0 && s.toSpawn === 1;
        const max = Math.round(28 * 1.2 ** (s.wave - 1) * (boss ? 8 : 1));
        s.raiders.push({
          id: s.nextId++,
          d: 0,
          hp: max,
          max,
          speed: boss ? 0.9 : 1.35 + Math.random() * 0.3,
          boss,
        });
        s.toSpawn--;
        s.spawnCool = 0.75;
        if (s.toSpawn === 0) s.breakLeft = BREAK;
      }
    }
    for (const r of s.raiders) r.d += r.speed * dt;
    const through = s.raiders.filter((r) => r.d >= PATH_LEN);
    if (through.length) {
      s.lives -= through.reduce((n, r) => n + (r.boss ? 3 : 1), 0);
      s.raiders = s.raiders.filter((r) => r.d < PATH_LEN);
      if (s.lives <= 0) {
        s.lives = 0;
        sync();
        draw();
        setPhase("over");
        return;
      }
    }
    for (const t of s.towers) {
      t.cool -= dt;
      if (t.cool > 0) continue;
      const st = towerStats(t.level);
      const tx = (t.cell % COLS) * C + C / 2;
      const ty = Math.floor(t.cell / COLS) * C + C / 2;
      // Aim at the raider furthest along the road within range.
      let target: Raider | null = null;
      for (const r of s.raiders) {
        const p = pointAt(r.d);
        if (Math.hypot(p.x - tx, p.y - ty) <= st.range && (!target || r.d > target.d)) target = r;
      }
      if (target) {
        s.shots.push({ x: tx, y: ty, target: target.id, dmg: st.dmg });
        t.cool = st.rate;
      }
    }
    for (const sh of s.shots) {
      const r = s.raiders.find((x) => x.id === sh.target);
      if (!r) {
        sh.dmg = 0;
        continue;
      }
      const p = pointAt(r.d);
      const d = Math.hypot(p.x - sh.x, p.y - sh.y);
      const step = 420 * dt;
      if (d <= step) {
        r.hp -= sh.dmg;
        sh.dmg = 0;
      } else {
        sh.x += ((p.x - sh.x) / d) * step;
        sh.y += ((p.y - sh.y) / d) * step;
      }
    }
    s.shots = s.shots.filter((sh) => sh.dmg > 0);
    const dead = s.raiders.filter((r) => r.hp <= 0);
    if (dead.length) {
      s.kills += dead.length;
      s.gold += dead.reduce((n, r) => n + (r.boss ? 60 : 7), 0);
      s.raiders = s.raiders.filter((r) => r.hp > 0);
    }
    sync();
    draw();
  }, phase === "playing");

  useKeys((e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? 2 * COLS + 5;
      const n = cur + d;
      const ok =
        n >= 0 &&
        n < COLS * ROWS &&
        !(d === -1 && cur % COLS === 0) &&
        !(d === 1 && cur % COLS === COLS - 1);
      setCursor(cursor === null ? cur : ok ? n : cur);
      return true;
    }
    if ((e.key === "Enter" || e.key === " ") && cursor !== null) {
      act(cursor);
      return true;
    }
    if (e.key === "n" || e.key === "N") {
      sendWave();
      return true;
    }
    return false;
  }, phase === "playing");

  const between = w.current.toSpawn === 0 && w.current.raiders.length === 0;
  const cellAt = (e: { clientX: number; clientY: number }, el: Element) => {
    const p = localPoint(e, el);
    const cx = Math.floor(p.x / C);
    const cy = Math.floor(p.y / C);
    return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? cy * COLS + cx : null;
  };

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Build archer towers beside the road (50 gold) and click them to upgrade. Stop the raiders before they reach your keep."
      overTitle="The keep has fallen"
      overDetail={`Held out until wave ${hud.wave} · ${hud.kills} raiders stopped`}
      onStart={start}
      hud={
        <>
          <span>
            Wave <b>{hud.wave}</b>
          </span>
          <span>
            🪙 <b>{hud.gold}</b>
          </span>
          <span>
            ❤️ <b>{hud.lives}</b>
          </span>
        </>
      }
      hint="Click grass to build, a tower to upgrade · Arrows + Enter · N next wave"
      extra={
        between && phase === "playing" ? (
          <Button variant="primary" size="sm" onClick={sendWave}>
            Send wave {hud.wave + 1} ({hud.breakLeft}s)
          </Button>
        ) : null
      }
      className="border-[2px] border-[#4527a0]"
      style={{ width: W + 4 }}
    >
      <canvas
        ref={ref}
        className="block cursor-pointer touch-none"
        style={{ width: W, height: H }}
        onPointerMove={(e) => setHover(cellAt(e, e.currentTarget))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          setCursor(null);
          const c = cellAt(e, e.currentTarget);
          if (c !== null) act(c);
        }}
      />
    </GameFrame>
  );
}
