import { type ReactNode, useId } from "react";
import type { Game, GameHero, GameScene } from "./games";

/**
 * Generated key art for the Gaming catalog: a layered SVG scene (sky, sea,
 * felt table, dungeon…), a hero illustration and a chunky outlined title.
 * Everything is original; no real game marks.
 */

const W = 320;
const H = 180;

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type Ctx = { id: string; g: Game; r: () => number };

/* ---------- Backdrops ---------- */

function Backdrop({ scene, c }: { scene: GameScene; c: Ctx }) {
  const { id, g, r } = c;
  switch (scene) {
    case "sky":
      return (
        <>
          <defs>
            <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6ec6ff" />
              <stop offset="1" stopColor="#d9f3ff" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}sky)`} />
          <circle cx="62" cy="38" r="22" fill="#fff4b0" opacity=".9" />
          <Clouds r={r} />
          <path
            d={`M0 120 Q60 88 120 112 T240 100 T${W} 108 V${H} H0Z`}
            fill={g.to}
            opacity=".85"
          />
          <path d={`M0 140 Q80 112 170 136 T${W} 128 V${H} H0Z`} fill={g.from} />
          <path d={`M0 160 Q90 146 180 158 T${W} 152 V${H} H0Z`} fill="#000" opacity=".12" />
        </>
      );
    case "night":
      return (
        <>
          <defs>
            <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b1030" />
              <stop offset="1" stopColor={g.to} />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}n)`} />
          {Array.from({ length: 40 }, (_, i) => (
            <circle
              key={i}
              cx={r() * W}
              cy={r() * H * 0.7}
              r={0.6 + r() * 1.3}
              fill="#fff"
              opacity={0.4 + r() * 0.6}
            />
          ))}
          <path d={`M0 150 Q70 120 150 146 T${W} 136 V${H} H0Z`} fill="#0a0d24" opacity=".75" />
          <path d={`M0 166 Q100 150 200 164 T${W} 158 V${H} H0Z`} fill="#06081a" />
        </>
      );
    case "sea":
      return (
        <>
          <defs>
            <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd59e" />
              <stop offset=".55" stopColor="#ffb4a2" />
              <stop offset=".56" stopColor={g.to} />
              <stop offset="1" stopColor={g.from} />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}s)`} />
          <circle cx="80" cy="86" r="26" fill="#fff1c9" opacity=".9" />
          <rect x="0" y="98" width={W} height="4" fill="#fff" opacity=".25" />
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M${(i * 37 + r() * 20) % W} ${112 + (i % 4) * 16} q8 -5 16 0 t16 0`}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              opacity=".45"
            />
          ))}
        </>
      );
    case "candy":
      return (
        <>
          <defs>
            <radialGradient id={`${id}c`} cx=".5" cy=".4" r=".8">
              <stop offset="0" stopColor={g.to} />
              <stop offset="1" stopColor={g.from} />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}c)`} />
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={i * 34 - 60}
              y="-20"
              width="14"
              height="240"
              fill="#fff"
              opacity=".12"
              transform={`rotate(28 ${i * 34} 90)`}
            />
          ))}
          {Array.from({ length: 26 }, (_, i) => {
            const x = r() * W;
            const y = r() * H;
            return (
              <rect
                key={`s${i}`}
                x={x}
                y={y}
                width="7"
                height="2.6"
                rx="1.3"
                fill={["#fff", "#ffe066", "#74c0fc", "#b2f2bb"][i % 4]}
                transform={`rotate(${Math.round(r() * 180)} ${x + 3.5} ${y + 1.3})`}
                opacity=".85"
              />
            );
          })}
        </>
      );
    case "dungeon":
      return (
        <>
          <defs>
            <radialGradient id={`${id}d`} cx=".65" cy=".45" r=".75">
              <stop offset="0" stopColor={g.to} />
              <stop offset=".55" stopColor={g.from} />
              <stop offset="1" stopColor="#0d0b1a" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}d)`} />
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 9 }, (_, col) => (
              <rect
                key={`${row}:${col}`}
                x={col * 40 - (row % 2) * 20}
                y={row * 24}
                width="38"
                height="22"
                rx="3"
                fill="#000"
                opacity=".14"
              />
            )),
          )}
          <circle cx="40" cy="60" r="34" fill="#ffb347" opacity=".18" />
          <path d="M36 60c-4-8 4-12 4-20 4 6 8 10 4 20Z" fill="#ffcf5c" />
        </>
      );
    case "neon":
      return (
        <>
          <rect width={W} height={H} fill="#120c2e" />
          <defs>
            <linearGradient id={`${id}ne`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={g.from} stopOpacity=".9" />
              <stop offset="1" stopColor="#120c2e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width={W} height={H * 0.6} fill={`url(#${id}ne)`} />
          {Array.from({ length: 13 }, (_, i) => (
            <line
              key={i}
              x1={W / 2}
              y1="96"
              x2={(i - 6) * 70 + W / 2}
              y2={H}
              stroke={g.to}
              strokeWidth="1.2"
              opacity=".7"
            />
          ))}
          {[100, 108, 120, 138, 162].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={W}
              y2={y}
              stroke={g.to}
              strokeWidth="1.2"
              opacity=".6"
            />
          ))}
        </>
      );
    case "jungle":
      return (
        <>
          <defs>
            <linearGradient id={`${id}j`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={g.to} />
              <stop offset="1" stopColor={g.from} />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}j)`} />
          <rect y="70" width={W} height="110" fill="#000" opacity=".08" />
          {Array.from({ length: 16 }, (_, i) => {
            const left = i % 2 === 0;
            const x = left ? r() * 70 - 10 : W - r() * 70 + 10;
            const y = r() * H;
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="34"
                ry="11"
                fill={i % 3 === 0 ? "#1b5e20" : "#2e7d32"}
                opacity=".9"
                transform={`rotate(${left ? -30 + r() * 60 : 150 + r() * 60} ${x} ${y})`}
              />
            );
          })}
          <rect y="158" width={W} height="22" fill="#3e2723" opacity=".55" />
        </>
      );
    case "felt":
      return (
        <>
          <defs>
            <radialGradient id={`${id}f`} cx=".5" cy=".5" r=".7">
              <stop offset="0" stopColor={g.to} />
              <stop offset="1" stopColor={g.from} />
            </radialGradient>
            <pattern id={`${id}fp`} width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M9 0 18 9 9 18 0 9Z" fill="#fff" opacity=".05" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}f)`} />
          <rect width={W} height={H} fill={`url(#${id}fp)`} />
          <rect
            x="8"
            y="8"
            width={W - 16}
            height={H - 16}
            rx="14"
            fill="none"
            stroke="#ffd56b"
            strokeWidth="2"
            opacity=".4"
          />
        </>
      );
    case "desert":
      return (
        <>
          <defs>
            <linearGradient id={`${id}de`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff8a5c" />
              <stop offset=".6" stopColor="#ffd28a" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}de)`} />
          <circle cx="250" cy="70" r="30" fill="#fff3c4" opacity=".85" />
          <path d="M0 120h40l10-30h50l10 30h60l6-18h40l6 18h98v60H0Z" fill={g.from} opacity=".85" />
          <path d={`M0 150 Q120 132 220 148 T${W} 140 V${H} H0Z`} fill="#c56a2d" />
          <rect y="160" width={W} height="20" fill="#8a4a1f" opacity=".6" />
        </>
      );
    case "ice":
      return (
        <>
          <defs>
            <linearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={g.from} />
              <stop offset=".42" stopColor={g.to} />
              <stop offset=".43" stopColor="#f1f8ff" />
              <stop offset="1" stopColor="#cfe6fb" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}i)`} />
          {Array.from({ length: 60 }, (_, i) => (
            <circle
              key={i}
              cx={r() * W}
              cy={10 + r() * 60}
              r="2.2"
              fill={["#ffd43b", "#ff6b6b", "#fff", "#74c0fc"][i % 4]}
              opacity=".7"
            />
          ))}
          <rect y="80" width={W} height="4" fill="#1864ab" opacity=".5" />
          <rect x="155" y="78" width="10" height="102" fill="#e03131" opacity=".55" />
          <ellipse
            cx="160"
            cy="140"
            rx="70"
            ry="22"
            fill="none"
            stroke="#1864ab"
            strokeWidth="2.5"
            opacity=".45"
          />
        </>
      );
    case "arena":
      return (
        <>
          <defs>
            <radialGradient id={`${id}a`} cx=".5" cy=".9" r=".9">
              <stop offset="0" stopColor={g.to} />
              <stop offset=".6" stopColor={g.from} />
              <stop offset="1" stopColor="#0b0b12" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}a)`} />
          <path d="M40 0 L110 180 H0 V0Z" fill="#fff" opacity=".07" />
          <path d="M280 0 L210 180 H320 V0Z" fill="#fff" opacity=".07" />
          {Array.from({ length: 70 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 13.7) % W}
              cy={130 + ((i * 7) % 4) * 9}
              r="4"
              fill="#000"
              opacity=".35"
            />
          ))}
        </>
      );
  }
}

function Clouds({ r }: { r: () => number }) {
  return (
    <>
      {[0, 1, 2].map((i) => {
        const x = 110 + i * 80 + r() * 30;
        const y = 22 + r() * 30;
        return (
          <g key={i} fill="#fff" opacity=".9">
            <ellipse cx={x} cy={y} rx="22" ry="9" />
            <ellipse cx={x + 12} cy={y - 6} rx="13" ry="9" />
            <ellipse cx={x - 10} cy={y - 3} rx="10" ry="7" />
          </g>
        );
      })}
    </>
  );
}

/* ---------- Heroes (drawn around 0,0 in a ~130px box) ---------- */

const OUT = "#2b1d14";

function Card({
  x,
  y,
  rot,
  suit,
  red,
  rank = "A",
}: {
  x: number;
  y: number;
  rot: number;
  suit: string;
  red?: boolean;
  rank?: string;
}) {
  const color = red ? "#e03131" : "#1c1e21";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-26" y="-38" width="52" height="76" rx="7" fill="#000" opacity=".25" />
      <rect x="-28" y="-40" width="52" height="76" rx="7" fill="#fff" stroke="#d0d4da" />
      <text x="-22" y="-24" fontSize="13" fontWeight="800" fill={color}>
        {rank}
      </text>
      <text x="-2" y="10" fontSize="30" textAnchor="middle" fill={color}>
        {suit}
      </text>
    </g>
  );
}

function Hero({ hero, c }: { hero: GameHero; c: Ctx }) {
  const { g } = c;
  switch (hero) {
    case "cards":
      return (
        <>
          <Card x={-28} y={6} rot={-18} suit="♣" />
          <Card x={0} y={-2} rot={0} suit="♥" red />
          <Card x={30} y={6} rot={16} suit="♠" rank="K" />
        </>
      );
    case "fruit":
      return (
        <>
          <circle cx="-26" cy="10" r="30" fill="#7bc043" stroke={OUT} strokeWidth="3" />
          <path d="M-30 -18q4 -14 14 -16" stroke={OUT} strokeWidth="3" fill="none" />
          <ellipse cx="-36" cy="-2" rx="8" ry="12" fill="#fff" opacity=".35" />
          <path
            d="M14 -26c18 -6 34 4 34 22 0 22 -18 42 -32 50 -14 -8 -32 -28 -32 -50 0 -18 16 -28 30 -22Z"
            fill="#ef233c"
            stroke={OUT}
            strokeWidth="3"
          />
          {[
            [6, -8],
            [22, -10],
            [14, 6],
            [30, 6],
            [0, 10],
            [20, 22],
            [10, 30],
          ].map(([x, y]) => (
            <ellipse key={`${x}:${y}`} cx={x} cy={y} rx="2" ry="3" fill="#ffe066" />
          ))}
          <path
            d="M15 -26l-12 -12 14 4 2 -14 6 14 14 -6 -10 14Z"
            fill="#2b9348"
            stroke={OUT}
            strokeWidth="2.5"
          />
        </>
      );
    case "sword":
      return (
        <>
          <g transform="rotate(35)">
            <rect
              x="-5"
              y="-62"
              width="10"
              height="84"
              rx="2"
              fill="#dfe7ef"
              stroke={OUT}
              strokeWidth="2.5"
            />
            <rect x="-1" y="-58" width="2" height="74" fill="#fff" opacity=".8" />
            <rect
              x="-20"
              y="20"
              width="40"
              height="8"
              rx="4"
              fill="#f2b705"
              stroke={OUT}
              strokeWidth="2.5"
            />
            <rect
              x="-4"
              y="28"
              width="8"
              height="20"
              rx="2"
              fill="#7b3f00"
              stroke={OUT}
              strokeWidth="2.5"
            />
            <circle cy="52" r="6" fill="#f2b705" stroke={OUT} strokeWidth="2.5" />
          </g>
          <g transform="translate(-26 14)">
            <path
              d="M0 -40 34 -30c0 34 -12 54 -34 66 -22 -12 -34 -32 -34 -66Z"
              fill={g.band}
              stroke={OUT}
              strokeWidth="3"
            />
            <path
              d="M0 -30 24 -23c0 24 -9 40 -24 48 -15 -8 -24 -24 -24 -48Z"
              fill="#fff"
              opacity=".18"
            />
            <path d="M0 -20v40M-14 -4h28" stroke="#f2b705" strokeWidth="6" strokeLinecap="round" />
          </g>
        </>
      );
    case "ship":
      return (
        <>
          <path d="M-56 18h112l-16 26h-80Z" fill="#8d5524" stroke={OUT} strokeWidth="3" />
          <rect x="-50" y="22" width="100" height="5" fill="#fff" opacity=".3" />
          <rect x="-3" y="-60" width="6" height="80" fill="#5c3a1a" stroke={OUT} strokeWidth="2" />
          <path d="M5 -54c26 8 34 28 32 60H5Z" fill="#fff" stroke={OUT} strokeWidth="2.5" />
          <path d="M-5 -46c-22 8 -30 26 -28 52H-5Z" fill="#f8f9fa" stroke={OUT} strokeWidth="2.5" />
          <path d="M3 -60h22l-6 6 6 6H3Z" fill="#e03131" stroke={OUT} strokeWidth="2" />
        </>
      );
    case "bricks":
      return (
        <>
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => (
              <rect
                key={`${row}:${col}`}
                x={-60 + col * 30 + (row % 2) * 8}
                y={-52 + row * 16}
                width="27"
                height="13"
                rx="3"
                fill={["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7"][(row + col) % 4]}
                stroke={OUT}
                strokeWidth="2"
              />
            )),
          )}
          <circle cx="14" cy="22" r="9" fill="#fff" stroke={OUT} strokeWidth="2.5" />
          <rect
            x="-30"
            y="42"
            width="60"
            height="10"
            rx="5"
            fill="#e599f7"
            stroke={OUT}
            strokeWidth="2.5"
          />
        </>
      );
    case "gems":
      return (
        <>
          <Gem x={-34} y={14} s={0.8} fill="#4dabf7" />
          <Gem x={34} y={18} s={0.75} fill="#69db7c" />
          <Gem x={0} y={-6} s={1.1} fill="#f06595" />
        </>
      );
    case "house":
      return (
        <>
          <rect
            x="-50"
            y="-10"
            width="100"
            height="58"
            fill="#f4d6a0"
            stroke={OUT}
            strokeWidth="3"
          />
          <path
            d="M-62 -6 0 -54 62 -6Z"
            fill={g.band}
            stroke={OUT}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect
            x="26"
            y="-48"
            width="12"
            height="22"
            fill="#9c6644"
            stroke={OUT}
            strokeWidth="2.5"
          />
          <rect
            x="-10"
            y="16"
            width="20"
            height="32"
            rx="2"
            fill="#7f4f24"
            stroke={OUT}
            strokeWidth="2.5"
          />
          {[-36, 22].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="4"
                width="16"
                height="16"
                fill="#a5d8ff"
                stroke={OUT}
                strokeWidth="2.5"
              />
              <path d={`M${x + 8} 4v16M${x} 12h16`} stroke={OUT} strokeWidth="1.5" />
            </g>
          ))}
          <circle cx="0" cy="-22" r="7" fill="#a5d8ff" stroke={OUT} strokeWidth="2.5" />
        </>
      );
    case "moon":
      return (
        <>
          <circle r="44" fill="#ffe8a3" />
          <circle cx="18" cy="-12" r="40" fill="#0b1030" opacity=".9" />
          <circle cx="-26" cy="10" r="5" fill="#f0d27a" />
          <circle cx="-16" cy="-22" r="3" fill="#f0d27a" />
          <Card x={34} y={30} rot={14} suit="♠" />
        </>
      );
    case "candy":
      return (
        <>
          <rect
            x="-4"
            y="-6"
            width="8"
            height="64"
            rx="3"
            fill="#fff"
            stroke={OUT}
            strokeWidth="2.5"
          />
          <circle cy="-26" r="32" fill="#ff8fab" stroke={OUT} strokeWidth="3" />
          <path
            d="M0 -26m-4 0a4 4 0 1 1 8 0a10 10 0 1 1 -18 -2a16 16 0 1 1 30 4a22 22 0 1 1 -40 -10"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <g transform="translate(-48 34) rotate(-20)">
            <path
              d="M-26 -10 -14 0 -26 10Z M26 -10 14 0 26 10Z"
              fill="#74c0fc"
              stroke={OUT}
              strokeWidth="2.5"
            />
            <ellipse rx="16" ry="12" fill="#4dabf7" stroke={OUT} strokeWidth="2.5" />
          </g>
          <g transform="translate(50 30) rotate(18)">
            <path
              d="M-26 -10 -14 0 -26 10Z M26 -10 14 0 26 10Z"
              fill="#ffe066"
              stroke={OUT}
              strokeWidth="2.5"
            />
            <ellipse rx="16" ry="12" fill="#fcc419" stroke={OUT} strokeWidth="2.5" />
          </g>
        </>
      );
    case "arrows":
      return (
        <>
          {[
            [-48, -40, 0],
            [-8, -40, 90],
            [32, -40, 180],
            [-48, 0, 270],
            [-8, 0, 0],
            [32, 0, 90],
            [-48, 40, 90],
            [-8, 40, 180],
            [32, 40, 0],
          ].map(([x, y, rot]) => (
            <g key={`${x}:${y}`} transform={`translate(${x + 8} ${y}) rotate(${rot})`}>
              <rect
                x="-17"
                y="-17"
                width="34"
                height="34"
                rx="7"
                fill={g.to}
                stroke="#fff"
                strokeWidth="2"
              />
              <path
                d="M-8 0h14M1 -7l7 7 -7 7"
                stroke="#fff"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </>
      );
    case "island":
      return (
        <>
          <ellipse cy="40" rx="66" ry="16" fill="#ffe8a3" stroke={OUT} strokeWidth="3" />
          <path
            d="M-6 38c4 -30 2 -54 -6 -70"
            stroke="#8d5524"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          {[-60, -20, 20, 60, 160].map((a) => (
            <ellipse
              key={a}
              cx="-12"
              cy="-34"
              rx="30"
              ry="9"
              fill="#2b9348"
              stroke={OUT}
              strokeWidth="2.5"
              transform={`rotate(${a} -12 -34) translate(22 0)`}
            />
          ))}
          <path d="M18 34v-20l14 -12 14 12v20Z" fill="#c08552" stroke={OUT} strokeWidth="2.5" />
          <path d="M14 16 32 -2 50 16Z" fill="#bc6c25" stroke={OUT} strokeWidth="2.5" />
        </>
      );
    case "temple":
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={-64 + i * 14}
              y={40 - i * 22}
              width={128 - i * 28}
              height="22"
              fill={i % 2 ? "#a68a64" : "#b6976d"}
              stroke={OUT}
              strokeWidth="2.5"
            />
          ))}
          <rect
            x="-12"
            y="-46"
            width="24"
            height="20"
            fill="#7f5539"
            stroke={OUT}
            strokeWidth="2.5"
          />
          <rect x="-10" y="40" width="20" height="22" fill="#3d2b1f" />
          <path
            d="M-60 40c10 -10 4 -24 16 -30M54 18c-8 -6 -2 -18 -12 -26"
            stroke="#2b9348"
            strokeWidth="4"
            fill="none"
          />
        </>
      );
    case "train":
      return (
        <>
          <rect
            x="-60"
            y="-6"
            width="80"
            height="40"
            rx="6"
            fill="#c92a2a"
            stroke={OUT}
            strokeWidth="3"
          />
          <rect
            x="20"
            y="-34"
            width="36"
            height="68"
            rx="4"
            fill="#343a40"
            stroke={OUT}
            strokeWidth="3"
          />
          <rect x="27" y="-26" width="22" height="18" fill="#ffe066" stroke={OUT} strokeWidth="2" />
          <rect
            x="-46"
            y="-34"
            width="14"
            height="28"
            fill="#495057"
            stroke={OUT}
            strokeWidth="2.5"
          />
          <path d="M-60 34l-12 12h16" fill="#868e96" stroke={OUT} strokeWidth="2.5" />
          {[-40, -8, 38].map((x) => (
            <g key={x}>
              <circle cx={x} cy="40" r="13" fill="#212529" stroke={OUT} strokeWidth="2.5" />
              <circle cx={x} cy="40" r="5" fill="#fcc419" />
            </g>
          ))}
          <circle cx="-38" cy="-48" r="9" fill="#fff" opacity=".8" />
          <circle cx="-26" cy="-60" r="12" fill="#fff" opacity=".7" />
          <circle cx="-8" cy="-68" r="9" fill="#fff" opacity=".6" />
        </>
      );
    case "puzzle":
      return (
        <>
          <Piece x={-26} y={-6} rot={-12} fill="#ff922b" />
          <Piece x={26} y={10} rot={14} fill="#4dabf7" />
          <Piece x={-6} y={34} rot={4} fill="#69db7c" s={0.7} />
        </>
      );
    case "letters":
      return (
        <>
          {["W", "O", "R", "D"].map((ch, i) => (
            <g
              key={ch}
              transform={`translate(${-54 + i * 36} ${i % 2 ? 10 : -6}) rotate(${(i - 1.5) * 6})`}
            >
              <rect x="-16" y="-16" width="32" height="34" rx="6" fill="#d9a066" />
              <rect
                x="-16"
                y="-18"
                width="32"
                height="32"
                rx="6"
                fill="#ffe8b6"
                stroke={OUT}
                strokeWidth="2.5"
              />
              <text y="8" textAnchor="middle" fontSize="22" fontWeight="900" fill="#5c3a1a">
                {ch}
              </text>
            </g>
          ))}
          <g transform="translate(40 -44)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse
                key={a}
                cy="-9"
                rx="6"
                ry="10"
                fill="#ffd43b"
                stroke={OUT}
                strokeWidth="2"
                transform={`rotate(${a})`}
              />
            ))}
            <circle r="6" fill="#e8590c" stroke={OUT} strokeWidth="2" />
          </g>
        </>
      );
    case "puck":
      return (
        <>
          <path
            d="M-40 -60 18 30h38v14H6Z"
            fill="#c08552"
            stroke={OUT}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="18" y="30" width="38" height="14" fill="#212529" stroke={OUT} strokeWidth="3" />
          <ellipse cx="-24" cy="40" rx="22" ry="9" fill="#212529" />
          <rect x="-46" y="30" width="44" height="10" fill="#343a40" />
          <ellipse cx="-24" cy="30" rx="22" ry="9" fill="#495057" stroke={OUT} strokeWidth="2.5" />
        </>
      );
    case "castle":
      return (
        <>
          <rect
            x="-46"
            y="-10"
            width="92"
            height="58"
            fill="#adb5bd"
            stroke={OUT}
            strokeWidth="3"
          />
          {[-60, 36].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="-40"
                width="24"
                height="88"
                fill="#ced4da"
                stroke={OUT}
                strokeWidth="3"
              />
              <path
                d={`M${x - 4} -40h32l-16 -26Z`}
                fill={g.band}
                stroke={OUT}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <rect x={x + 8} y="-24" width="8" height="12" rx="4" fill="#343a40" />
            </g>
          ))}
          {[-34, -14, 6, 26].map((x) => (
            <rect
              key={x}
              x={x}
              y="-22"
              width="12"
              height="12"
              fill="#adb5bd"
              stroke={OUT}
              strokeWidth="2.5"
            />
          ))}
          <path
            d="M-14 48v-24a14 14 0 0 1 28 0v24Z"
            fill="#5c3a1a"
            stroke={OUT}
            strokeWidth="2.5"
          />
          <path d="M-48 -66v-14l14 6 -14 6" fill="#ffd43b" stroke={OUT} strokeWidth="1.5" />
        </>
      );
    case "checkers":
      return (
        <>
          <g transform="skewX(-20) translate(16 0)">
            {Array.from({ length: 4 }, (_, row) =>
              Array.from({ length: 6 }, (_, col) => (
                <rect
                  key={`${row}:${col}`}
                  x={-66 + col * 22}
                  y={-10 + row * 16}
                  width="22"
                  height="16"
                  fill={(row + col) % 2 ? "#212529" : "#f8f9fa"}
                />
              )),
            )}
            <rect
              x="-66"
              y="-10"
              width="132"
              height="64"
              fill="none"
              stroke={OUT}
              strokeWidth="3"
            />
          </g>
          {[
            [-30, -20, "#e03131"],
            [6, -28, "#212529"],
            [36, -14, "#e03131"],
          ].map(([x, y, f]) => (
            <g key={`${x}`}>
              <ellipse cx={x} cy={Number(y) + 6} rx="16" ry="7" fill="#000" opacity=".3" />
              <ellipse
                cx={x}
                cy={y}
                rx="16"
                ry="7"
                fill={String(f)}
                stroke="#fff"
                strokeWidth="2"
              />
              <rect x={Number(x) - 16} y={Number(y) - 6} width="32" height="6" fill={String(f)} />
              <ellipse
                cx={x}
                cy={Number(y) - 6}
                rx="16"
                ry="7"
                fill={String(f)}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          ))}
        </>
      );
    case "swords":
      return (
        <>
          {[-38, 38].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <rect
                x="-5"
                y="-66"
                width="10"
                height="84"
                rx="2"
                fill="#e9ecef"
                stroke={OUT}
                strokeWidth="2.5"
              />
              <rect
                x="-18"
                y="18"
                width="36"
                height="8"
                rx="4"
                fill="#fab005"
                stroke={OUT}
                strokeWidth="2.5"
              />
              <rect
                x="-4"
                y="26"
                width="8"
                height="20"
                rx="2"
                fill="#5c3a1a"
                stroke={OUT}
                strokeWidth="2.5"
              />
            </g>
          ))}
          <circle cy="6" r="24" fill={g.band} stroke={OUT} strokeWidth="3" />
          <path
            d={`M0 -8l4 9h9l-7 6 3 9 -9 -6 -9 6 3 -9 -7 -6h9Z`}
            fill="#ffd43b"
            stroke={OUT}
            strokeWidth="1.5"
          />
        </>
      );
    case "bubbles":
      return (
        <>
          {[
            [-40, 10, 26, "#4dabf7"],
            [8, -20, 32, "#f06595"],
            [44, 20, 22, "#ffd43b"],
            [-6, 40, 18, "#69db7c"],
            [-50, -36, 14, "#9775fa"],
          ].map(([x, y, rad, f]) => (
            <g key={`${x}:${y}`} transform={`translate(${x} ${y})`}>
              <circle r={Number(rad)} fill={String(f)} stroke={OUT} strokeWidth="2.5" />
              <ellipse
                cx={-Number(rad) * 0.35}
                cy={-Number(rad) * 0.4}
                rx={Number(rad) * 0.3}
                ry={Number(rad) * 0.2}
                fill="#fff"
                opacity=".7"
                transform={`rotate(-30 ${-Number(rad) * 0.35} ${-Number(rad) * 0.4})`}
              />
            </g>
          ))}
        </>
      );
    case "crown":
      return (
        <>
          <Card x={-30} y={22} rot={-14} suit="♦" red />
          <Card x={22} y={24} rot={12} suit="♠" rank="K" />
          <g transform="translate(-4 -30)">
            <path
              d="M-40 18 -46 -22 -20 -2 0 -32 20 -2 46 -22 40 18Z"
              fill="#fcc419"
              stroke={OUT}
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <rect
              x="-40"
              y="16"
              width="80"
              height="12"
              rx="3"
              fill="#f59f00"
              stroke={OUT}
              strokeWidth="3"
            />
            {[-20, 0, 20].map((x) => (
              <circle key={x} cx={x} cy="22" r="4" fill={x ? "#e03131" : "#4dabf7"} />
            ))}
          </g>
        </>
      );
    case "snake":
      return (
        <>
          <path
            d="M-56 40c20 0 22 -26 42 -26s20 26 40 26 24 -34 6 -52"
            fill="none"
            stroke={OUT}
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M-56 40c20 0 22 -26 42 -26s20 26 40 26 24 -34 6 -52"
            fill="none"
            stroke="#51cf66"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M-56 40c20 0 22 -26 42 -26s20 26 40 26 24 -34 6 -52"
            fill="none"
            stroke="#2b8a3e"
            strokeWidth="4"
            strokeDasharray="4 10"
            strokeLinecap="round"
          />
          <circle cx="30" cy="-18" r="14" fill="#51cf66" stroke={OUT} strokeWidth="3" />
          <circle cx="26" cy="-22" r="3.5" fill="#fff" />
          <circle cx="36" cy="-22" r="3.5" fill="#fff" />
          <circle cx="27" cy="-22" r="1.6" fill={OUT} />
          <circle cx="37" cy="-22" r="1.6" fill={OUT} />
          <circle cx="58" cy="30" r="12" fill="#e03131" stroke={OUT} strokeWidth="2.5" />
        </>
      );
  }
  return null;
}

function Gem({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-24 -16h48l14 18 -38 40 -38 -40Z"
        fill={fill}
        stroke={OUT}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M-24 -16 -10 2h20l14 -18M-38 2h76M-10 2 0 42 10 2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        opacity=".7"
      />
      <path d="M-18 -12h14l-6 10Z" fill="#fff" opacity=".6" />
    </g>
  );
}

function Piece({
  x,
  y,
  rot,
  fill,
  s = 1,
}: {
  x: number;
  y: number;
  rot: number;
  fill: string;
  s?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path
        d="M-28 -28h16a8 8 0 1 1 16 0h24v20a8 8 0 1 1 0 16v20H4a8 8 0 1 0 -16 0h-16v-20a8 8 0 1 0 0 -16Z"
        fill={fill}
        stroke={OUT}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M-22 -22h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
    </g>
  );
}

/* ---------- Title ---------- */

function Title({ name, c }: { name: string; c: Ctx }) {
  const words = name.replace(/:/g, "").split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + w).length <= 9) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const shown = lines.slice(0, 3);
  const longest = Math.max(...shown.map((l) => l.length));
  const size = Math.min(36, Math.floor(250 / Math.max(longest, 6)));
  const base = 160 - (shown.length - 1) * size * 0.95;
  return (
    <g transform="rotate(-4 20 140)">
      <defs>
        <linearGradient id={`${c.id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="1" stopColor="#ffd43b" />
        </linearGradient>
      </defs>
      {shown.map((l, i) => (
        <text
          key={l}
          x="16"
          y={base + i * size * 0.95}
          fontSize={size}
          fontWeight="900"
          fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
          letterSpacing="-.5"
          fill={`url(#${c.id}t)`}
          stroke={c.g.band}
          strokeWidth={size / 4.5}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke" }}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

/**
 * Cover art. `variant="cover"` is the 16:9 key art with title; `"icon"` is a
 * square crop around the hero (app icons, rail shortcuts).
 */
export function GameCover({
  game,
  variant = "cover",
  className,
}: {
  game: Game;
  variant?: "cover" | "icon";
  className?: string;
}) {
  const id = `gc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c: Ctx = { id, g: game, r: rng(game.id) };
  const icon = variant === "icon";
  const hero: ReactNode = <Hero hero={game.hero} c={c} />;
  return (
    <svg
      viewBox={icon ? "150 18 150 150" : `0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <Backdrop scene={game.scene} c={c} />
      <g transform={icon ? "translate(225 95) scale(1.05)" : "translate(242 84) scale(.85)"}>
        {hero}
      </g>
      {!icon && <Title name={game.name} c={c} />}
    </svg>
  );
}
