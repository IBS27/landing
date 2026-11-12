/**
 * Photographic key art: a freely licensed Commons photo (see ./sources.ts),
 * re-graded and painted over with light, particles, props and a wordmark.
 */
import {
  cardFan,
  flare,
  glowAt,
  grade,
  leaf,
  orb,
  photo,
  playingCard,
  wash,
  wordmark,
} from "./fx";
import { type Art, bokeh, embers, finish, H, rays, Scene, shade, sparkles, vignette, W } from "./kit";

const f = (n: number) => Math.round(n * 100) / 100;

/** Out-of-focus foreground foliage in a corner (depth of field). */
function foliage(s: Scene, x: number, y: number, k: number, flip = false, c = "#2f6b1f", dark = "#0f2a0a") {
  const leaves = [
    [0, 0, 120, -20],
    [10, 20, 110, 15],
    [-10, 40, 100, 40],
    [30, -30, 90, -50],
    [-20, 70, 90, 70],
  ]
    .map(([lx, ly, len, rot]) => leaf(s, lx, ly, len, rot, c, dark))
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${flip ? -k : k} ${k})" filter="${s.blur(3.5)}" opacity=".95">${leaves}</g>`;
}

/* ───────────── Solitaire: Cedar Grove ───────────── */

function solitaireGrove(): Art {
  const s = new Scene("solitaire-grove");
  const art = `
${photo(s, "cabin", { box: [-30, -70, 700, 466], align: "xMinYMid", filter: grade(s, { sat: 1.3, contrast: 1.08, rgb: [1.08, 1.02, 0.86] }) })}
${wash(s, [[0, "#ffb347", 0.55], [0.45, "#ffd27a", 0.12], [1, "#ffd27a", 0]], "soft-light", 0)}
${wash(s, [[0, "#ffe6a8", 0], [0.55, "#ffe6a8", 0], [1, "#ffcf70", 0.55]], "screen", 160)}
${rays(s, 600, 10, "#fff1c2", 9, 0.28, 720)}
${flare(s, 598, 18, 0.9)}
${foliage(s, -30, -10, 0.9, false, "#3b7d22", "#123d0c")}
${bokeh(s, 26, ["#fff3c4", "#ffe08a", "#d9ff9e"], [300, 0, 340, 220], 9)}
<g transform="translate(468 214)">${cardFan(s, 0, 0, 1.05, [["10", "diamond"], ["J", "club"], ["Q", "heart"], ["K", "spade"], ["A", "heart"]], 13, -6)}</g>
${sparkles(s, 10, [380, 150, 230, 140], "#fff7d6", 7)}`;
  const logo = wordmark(
    s,
    [
      { t: "Solitaire:", size: 30, face: ["#ffffff", "#ffe9c8"], outline: "#7a1b0b", depth: 3, dx: -40 },
      { t: "Cedar Grove", size: 54, dy: 52, face: [[0, "#fff8d8"], [0.5, "#ffd45c"], [1, "#f08a12"]], outline: "#4a1f06", depth: 6, rim: "#fff1c8" },
    ],
    470,
    74,
    { font: "Lilita One", size: 54, face: ["#fff"], outline: "#4a1f06", outlineW: 0.2, rimW: 0.08, bevel: 0.9, rot: -4 },
  );
  return finish(s, { art, logo, focus: [470, 236, 170], bloom: 0.12 });
}

/* ───────────── Harbor Tycoon ───────────── */

function gull(x: number, y: number, k: number) {
  return `<path d="M${x - 12 * k} ${y}q${6 * k} ${-7 * k} ${12 * k} 0q${6 * k} ${-7 * k} ${12 * k} 0q${-6 * k} ${-3 * k} ${-12 * k} ${2 * k}q${-6 * k} ${-5 * k} ${-12 * k} ${-2 * k}Z" fill="#2a1d26"/>`;
}

function coinStack(s: Scene, x: number, y: number, n: number, r: number) {
  let out = `<ellipse cx="${x}" cy="${y + 4}" rx="${r * 1.1}" ry="${r * 0.4}" fill="#000" opacity=".4" filter="${s.blur(3)}"/>`;
  for (let i = 0; i < n; i++) {
    const cy = y - i * r * 0.22;
    out += `<path d="M${x - r} ${f(cy)}v${f(r * 0.18)}a${r} ${f(r * 0.38)} 0 0 0 ${2 * r} 0v${f(-r * 0.18)}Z" fill="${s.lin(["#a8650a", "#ffd257", "#a8650a"], 0)}"/>`;
  }
  const top = y - (n - 1) * r * 0.22;
  out += `<ellipse cx="${x}" cy="${f(top)}" rx="${r}" ry="${f(r * 0.38)}" fill="${s.lin(["#fff4b0", "#ffc928", "#d9890c"], 60)}"/><ellipse cx="${x}" cy="${f(top)}" rx="${f(r * 0.7)}" ry="${f(r * 0.26)}" fill="none" stroke="#b9770c" stroke-width="${f(r * 0.07)}"/><text x="${x}" y="${f(top + r * 0.12)}" text-anchor="middle" font-family="Alfa Slab One" font-size="${f(r * 0.5)}" fill="#a8650a" transform="translate(0 0) scale(1 1)">$</text>`;
  return out;
}

function harborTycoon(): Art {
  const s = new Scene("harbor-tycoon");
  const art = `
${photo(s, "port", { box: [-60, -96, 760, 570], align: "xMidYMin", filter: grade(s, { sat: 1.35, contrast: 1.12, rgb: [1.05, 0.98, 0.92] }) })}
${wash(s, [[0, "#ff8a3d", 0.75], [0.38, "#ffc46b", 0.45], [0.6, "#6aa8ff", 0], [1, "#0b2e5e", 0.5]], "soft-light", 90)}
${wash(s, [[0, "#2b0f3a", 0.35], [0.4, "#2b0f3a", 0], [1, "#04162e", 0.45]], "multiply", 90)}
${glowAt(s, 250, 150, 230, "#ffb35a", 0.75)}
${flare(s, 250, 150, 0.7, "#ffd29a")}
${gull(140, 70, 1)}${gull(176, 52, 0.7)}${gull(470, 40, 0.8)}
${coinStack(s, 560, 330, 7, 30)}${coinStack(s, 606, 344, 4, 24)}${coinStack(s, 516, 350, 3, 22)}
${sparkles(s, 8, [490, 240, 150, 100], "#fff2b0", 8)}`;
  const logo = wordmark(
    s,
    [
      { t: "HARBOR", size: 50 },
      { t: "TYCOON", size: 50, dy: 48, face: [[0, "#fff6c2"], [0.5, "#ffcf3d"], [1, "#e08a00"]] },
    ],
    170,
    82,
    { font: "Alfa Slab One", size: 50, face: [[0, "#ffffff"], [0.55, "#d9f0ff"], [1, "#7cc4ff"]], outline: "#06284f", outlineW: 0.2, depth: 6, extrude: "#021530", rim: "#ffffff", rimW: 0.05, bevel: 0.7, rot: -3, tracking: 1 },
  );
  return finish(s, { art, logo, focus: [400, 190, 210], bloom: 0.12 });
}

/* ───────────── Midnight Solitaire ───────────── */

function nightSolitaire(): Art {
  const s = new Scene("night-solitaire");
  const art = `
${photo(s, "milkyway", { box: [-20, -40, 680, 454], filter: grade(s, { sat: 1.5, contrast: 1.18, bright: 0.02, rgb: [0.92, 1, 1.18] }) })}
${wash(s, [[0, "#3a1a7a", 0.5], [0.6, "#1a2a6a", 0.2], [1, "#000010", 0]], "screen", 90, 0.6)}
${glowAt(s, 470, 260, 180, "#4fb8ff", 0.55)}
${glowAt(s, 470, 250, 70, "#c8f0ff", 0.6)}
<g transform="translate(470 236)">${cardFan(s, 0, 0, 1.1, [["A", "spade"], ["K", "heart"], ["Q", "club"], ["J", "diamond"]], 15, 0)}</g>
${embers(s, 26, [330, 140, 300, 200], "#8fd8ff")}
${sparkles(s, 14, [0, 0, W, 200], "#e8f4ff", 6)}`;
  const logo = wordmark(
    s,
    [
      { t: "Midnight", size: 52 },
      { t: "SOLITAIRE", size: 26, dy: 42, face: [[0, "#fff6d0"], [1, "#e9b949"]], outline: "#1c1206", tracking: 4, depth: 2 },
    ],
    170,
    92,
    { font: "Yeseva One", size: 52, face: [[0, "#ffffff"], [0.6, "#dbe9ff"], [1, "#8fb6ff"]], outline: "#0a0f2e", outlineW: 0.14, depth: 3, glow: "#5aa8ff", bevel: 0.6, rot: -2 },
  );
  return finish(s, { art, logo, focus: [470, 236, 170], bloom: 0.18, tone: false });
}

/* ───────────── Calm Jigsaw Puzzles ───────────── */

function jigsawEdge(ax: number, ay: number, bx: number, by: number, sign: number) {
  const L = Math.hypot(bx - ax, by - ay);
  const tx = (bx - ax) / L;
  const ty = (by - ay) / L;
  const nx = -ty * sign;
  const ny = tx * sign;
  const P = (t: number, n: number) => `${f(ax + tx * t * L + nx * n * L)} ${f(ay + ty * t * L + ny * n * L)}`;
  if (!sign) return `L${P(1, 0)}`;
  return `L${P(0.37, 0)}C${P(0.42, 0)} ${P(0.44, -0.04)} ${P(0.4, -0.11)}C${P(0.36, -0.2)} ${P(0.44, -0.27)} ${P(0.5, -0.27)}C${P(0.56, -0.27)} ${P(0.64, -0.2)} ${P(0.6, -0.11)}C${P(0.56, -0.04)} ${P(0.58, 0)} ${P(0.63, 0)}L${P(1, 0)}`;
}

function calmJigsaw(): Art {
  const s = new Scene("jigsaw-calm");
  const cols = 8;
  const rows = 5;
  const cw = W / cols;
  const rh = H / rows;
  const hs = Array.from({ length: rows + 1 }, (_, j) => Array.from({ length: cols }, () => (j === 0 || j === rows ? 0 : s.r() > 0.5 ? 1 : -1)));
  const vs = Array.from({ length: rows }, () => Array.from({ length: cols + 1 }, (_, i) => (i === 0 || i === cols ? 0 : s.r() > 0.5 ? 1 : -1)));
  let grid = "";
  for (let j = 1; j < rows; j++) {
    let d = `M0 ${f(j * rh)}`;
    for (let i = 0; i < cols; i++) d += jigsawEdge(i * cw, j * rh, (i + 1) * cw, j * rh, hs[j][i]);
    grid += `<path d="${d}"/>`;
  }
  for (let i = 1; i < cols; i++) {
    let d = `M${f(i * cw)} 0`;
    for (let j = 0; j < rows; j++) d += jigsawEdge(i * cw, j * rh, i * cw, (j + 1) * rh, -vs[j][i]);
    grid += `<path d="${d}"/>`;
  }
  const piece = (i: number, j: number) => {
    const x0 = i * cw;
    const y0 = j * rh;
    return `M${f(x0)} ${f(y0)}${jigsawEdge(x0, y0, x0 + cw, y0, -hs[j][i])}${jigsawEdge(x0 + cw, y0, x0 + cw, y0 + rh, -vs[j][i + 1])}${jigsawEdge(x0 + cw, y0 + rh, x0, y0 + rh, hs[j + 1][i])}${jigsawEdge(x0, y0 + rh, x0, y0, vs[j][i])}Z`;
  };
  const pic = (filter?: string) => photo(s, "rainier", { box: [-10, -60, 660, 495], filter });
  const g = grade(s, { sat: 1.3, contrast: 1.06, rgb: [1, 1.02, 1.06] });
  const holeA = piece(5, 3);
  const holeB = piece(2, 4);
  const lifted = (d: string, dx: number, dy: number, rot: number, cx: number, cy: number) =>
    `<g transform="translate(${dx} ${dy}) rotate(${rot} ${cx} ${cy})"><path d="${d}" fill="#000" opacity=".5" filter="${s.blur(6)}" transform="translate(8 12)"/><g clip-path="${s.clip(`<path d="${d}"/>`)}">${pic(g)}<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" transform="translate(-1 -1)"/><path d="${d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3" transform="translate(1.5 1.5)"/></g></g>`;
  const art = `
${pic(g)}
${wash(s, [[0, "#ffffff", 0.15], [1, "#ffffff", 0]], "screen", 90)}
<g fill="none" stroke-linejoin="round"><g stroke="#000" stroke-opacity=".38" stroke-width="1.6" transform="translate(.8 .8)">${grid}</g><g stroke="#fff" stroke-opacity=".55" stroke-width="1.1">${grid}</g></g>
<path d="${holeA}" fill="${s.lin(["#1d2b38", "#3a4b5c"], 90)}"/><path d="${holeA}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="5" filter="${s.blur(2.5)}" clip-path="${s.clip(`<path d="${holeA}"/>`)}"/>
<path d="${holeB}" fill="${s.lin(["#1d2b38", "#3a4b5c"], 90)}"/>
${lifted(holeA, 64, -46, 14, 5.5 * cw, 3.5 * rh)}
${lifted(holeB, -86, -64, -10, 2.5 * cw, 4.5 * rh)}`;
  const logo = `<g transform="rotate(-2 168 64)">${wordmark(s, [{ t: "Calm Jigsaw", size: 46 }], 168, 64, {
    font: "Quicksand",
    weight: 700,
    size: 46,
    face: [[0, "#ffffff"], [1, "#e6f2ff"]],
    outline: "#1d4f91",
    outlineW: 0.16,
    depth: 3,
    extrude: "#0e2f5e",
    bevel: 0.4,
  })}<rect x="108" y="80" width="120" height="26" rx="13" fill="#ff8a3d" stroke="#fff" stroke-width="2.5"/><text x="168" y="99" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="15" letter-spacing="3" fill="#fff">PUZZLES</text></g>`;
  return finish(s, { art, logo, focus: [420, 200, 190], bloom: 0.08, tone: false, post: vignette(s, 0.25) });
}

/* ───────────── Jungle Trek 2 ───────────── */

function vine(s: Scene, d: string, k = 1) {
  return `<path d="${d}" stroke="${s.lin(["#3f7a1f", "#1f4a10"], 90)}" stroke-width="${3 * k}" fill="none" stroke-linecap="round"/>`;
}

function jungleTrek(): Art {
  const s = new Scene("jungle-trek");
  const stone = s.id("st");
  s.def(
    `<filter id="${stone}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.1" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="tex"/><feComposite in="tex" in2="SourceGraphic" operator="arithmetic" k1="0" k2=".55" k3=".6" k4="0"/></filter>`,
  );
  const leavesOnLogo = [
    [150, 52, 22, 200],
    [158, 58, 18, 150],
    [486, 50, 22, -20],
    [478, 60, 18, 30],
    [330, 112, 18, 100],
  ]
    .map(([x, y, l, r]) => leaf(s, x, y, l, r, "#6fd13f", "#1d6a1a"))
    .join("");
  const art = `
${photo(s, "temple", { box: [-30, -30, 700, 466], filter: grade(s, { sat: 1.35, contrast: 1.15, rgb: [0.95, 1.06, 0.92] }) })}
${wash(s, [[0, "#ffe9a0", 0.45], [0.5, "#5aa83a", 0.1], [1, "#06260f", 0.55]], "soft-light", 65)}
${rays(s, 560, -20, "#fff3b8", 10, 0.32, 720)}
${glowAt(s, 560, 0, 220, "#fff2b0", 0.6)}
<rect y="250" width="${W}" height="110" fill="${s.lin([[0, "#d8f5d0", 0], [1, "#d8f5d0", 0.35]], 90)}" filter="${s.blur(10)}"/>
${foliage(s, -40, 300, 1.1, false, "#2e8a2a", "#0a3a0c")}
${foliage(s, 690, 290, 1.1, true, "#3a9a2a", "#0a3a0c")}
${embers(s, 30, [0, 120, W, 240], "#d6ff7a")}`;
  const logo = `${wordmark(
    s,
    [{ t: "JUNGLE TREK", size: 52 }],
    310,
    92,
    { font: "Bowlby One", size: 52, face: [[0, "#fff1c8"], [0.5, "#e8b860"], [1, "#a8642a"]], faceFilter: `url(#${stone})`, outline: "#2a1606", outlineW: 0.18, depth: 7, extrude: "#160a02", rim: "#ffe9a8", rimW: 0.05, bevel: 0.9, arc: 8, tracking: 1 },
  )}${vine(s, "M120 50C170 30 210 60 260 44S360 40 420 52 500 34 530 56")}${leavesOnLogo}<g transform="translate(540 92)">${orb(s, 0, 0, 30, { base: "#ffb800", dark: "#a85a00", light: "#fff3a0", shadow: 0 })}<circle r="30" fill="none" stroke="#5a2a00" stroke-width="4"/><text y="16" text-anchor="middle" font-family="Bowlby One" font-size="44" fill="#fff8e0" stroke="#5a2a00" stroke-width="3" paint-order="stroke">2</text></g>`;
  return finish(s, { art, logo, focus: [210, 250, 190], bloom: 0.14 });
}

/* ───────────── Rail City ───────────── */

function railCity(): Art {
  const s = new Scene("rail-city");
  const art = `
${photo(s, "steam", { box: [-40, -20, 720, 424], align: "xMidYMax", filter: grade(s, { sat: 1.2, contrast: 1.12 }) })}
${wash(s, [[0, "#ff7a2a"], [0.45, "#ffc070"], [0.75, "#ffe2b0"], [1, "#ffe2b0"]], "multiply", 90)}
${glowAt(s, 150, 70, 260, "#ffb050", 0.8)}
${flare(s, 150, 70, 0.8, "#ffcf8a")}
${wash(s, [[0, "#3a0a2a", 0], [0.7, "#3a0a2a", 0], [1, "#1a0610", 0.6]], "multiply", 90)}
${embers(s, 22, [60, 200, 420, 120], "#ffb347")}`;
  const logo = wordmark(
    s,
    [
      { t: "RAIL", size: 60 },
      { t: "CITY", size: 60, dy: 54 },
    ],
    500,
    84,
    { font: "Rye", size: 60, face: [[0, "#fff6d6"], [0.45, "#ffd27a"], [0.55, "#e09a2a"], [1, "#9a4a10"]], outline: "#2a0e02", outlineW: 0.16, depth: 6, extrude: "#1a0601", rim: "#ffe9b8", rimW: 0.05, bevel: 0.8, rot: -3, tracking: 2 },
  );
  return finish(s, { art, logo, focus: [210, 230, 200], bloom: 0.1, tone: false });
}

/* ───────────── Puck Rush ───────────── */

function puckRush(): Art {
  const s = new Scene("puck-rush");
  let streaks = "";
  for (let i = 0; i < 14; i++) {
    const y = 258 + s.r() * 38;
    const x = 10 + s.r() * 40;
    streaks += `<rect x="${f(x)}" y="${f(y)}" width="${f(60 + s.r() * 50)}" height="${f(1.5 + s.r() * 3)}" rx="2" fill="#fff" opacity="${f(0.35 + s.r() * 0.5)}"/>`;
  }
  let spray = "";
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI * (0.04 + s.r() * 0.45);
    const d = 6 + s.r() * 70;
    spray += `<circle cx="${f(268 + Math.cos(a) * d)}" cy="${f(292 + Math.sin(a) * d * 0.6)}" r="${f(0.6 + s.r() * 2)}" fill="#fff" opacity="${f(0.4 + s.r() * 0.6)}"/>`;
  }
  const art = `
${photo(s, "rink", { box: [0, -70, 640, 480], align: "xMidYMid", filter: grade(s, { sat: 1.2, contrast: 1.2, rgb: [0.9, 1, 1.15] }) })}
${wash(s, [[0, "#0a1a3a", 0.8], [0.35, "#0a1a3a", 0.2], [0.6, "#0a1a3a", 0]], "multiply", 90)}
${bokeh(s, 18, ["#ffffff", "#bfe0ff", "#ffe6b0"], [0, 0, W, 90], 16)}
${glowAt(s, 120, 20, 120, "#cfe6ff", 0.6)}${glowAt(s, 520, 10, 140, "#cfe6ff", 0.55)}
<g filter="${s.blur(1.4)}" style="mix-blend-mode:screen">${streaks}</g>
<g filter="${s.blur(0.6)}">${spray}</g>
${glowAt(s, 215, 280, 90, "#7fc4ff", 0.35)}`;
  const logo = `${wordmark(
    s,
    [
      { t: "PUCK", size: 66 },
      { t: "RUSH", size: 66, dy: 58, face: [[0, "#ffe0e0"], [0.5, "#ff4b4b"], [1, "#b00012"]], dx: 30 },
    ],
    450,
    90,
    { font: "Russo One", size: 66, face: [[0, "#ffffff"], [0.5, "#e8f4ff"], [1, "#8ec8ff"]], outline: "#06204a", outlineW: 0.16, depth: 6, extrude: "#020c20", rim: "#ffffff", rimW: 0.05, bevel: 0.6, skew: -14, rot: -6, tracking: 1 },
  )}<path d="M360 172L610 150L600 162L352 182Z" fill="#ff3b3b" stroke="#06204a" stroke-width="3" transform="skewX(-14)" opacity=".95"/>`;
  return finish(s, { art, logo, focus: [250, 260, 160], bloom: 0.1, tone: false });
}

/* ───────────── Royal 21 ───────────── */

function crown(s: Scene, x: number, y: number, k: number) {
  const gold = s.lin([[0, "#fff6c2"], [0.4, "#ffd24a"], [0.7, "#d18a0c"], [1, "#ffe08a"]], 90);
  const jewels = [
    [-34, -20, "#e0102a"],
    [0, -30, "#1a6bff"],
    [34, -20, "#18b34a"],
  ]
    .map(([jx, jy, c]) => orb(s, jx as number, jy as number, 6, { base: c as string, shadow: 0 }))
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${k})" filter="${s.shadow(4, 4, "#000", 0.5)}"><path d="M-50 10L-56 -36L-30 -12L0 -46L30 -12L56 -36L50 10Z" fill="${gold}" stroke="#6a3a00" stroke-width="2.5" stroke-linejoin="round"/><rect x="-52" y="6" width="104" height="16" rx="4" fill="${gold}" stroke="#6a3a00" stroke-width="2.5"/>${jewels}<circle cx="-56" cy="-38" r="5" fill="#fff3b0" stroke="#6a3a00" stroke-width="1.5"/><circle cx="56" cy="-38" r="5" fill="#fff3b0" stroke="#6a3a00" stroke-width="1.5"/><circle cy="-48" r="5" fill="#fff3b0" stroke="#6a3a00" stroke-width="1.5"/></g>`;
}

function royal21(): Art {
  const s = new Scene("royal-21");
  const fade = s.id("fm");
  s.def(`<linearGradient id="${fade}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff"/></linearGradient><mask id="${fade}"><rect width="${W}" height="${H}" fill="url(#${fade}g)"/></mask>`);
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#2c3f36", "#101814"], 0.3, 0.4, 0.9)}"/>
<g mask="url(#${fade})">${photo(s, "chips", { box: [140, -10, 560, 374], filter: grade(s, { sat: 1.25, contrast: 1.12, rgb: [0.98, 1.04, 0.98] }) })}</g>
${wash(s, [[0, "#0d4a3a", 0.45], [1, "#062018", 0.2]], "soft-light", 0)}
${glowAt(s, 420, 140, 200, "#ffd27a", 0.35)}
${playingCard(s, 196, 270, 1.35, -14, "A", "spade")}
${playingCard(s, 262, 262, 1.35, 9, "K", "heart")}
${glowAt(s, 230, 250, 110, "#ffe9a8", 0.25)}
${embers(s, 26, [60, 140, 560, 220], "#ffd27a")}
${sparkles(s, 10, [80, 160, 280, 160], "#fff4c4", 8)}`;
  const logo = `${crown(s, 168, 58, 0.62)}${wordmark(
    s,
    [
      { t: "ROYAL", size: 46 },
      { t: "21", size: 70, dy: 62 },
    ],
    168,
    112,
    { font: "Abril Fatface", size: 46, face: [[0, "#fffbe0"], [0.35, "#ffd65c"], [0.55, "#c9820c"], [0.75, "#ffe9a0"], [1, "#a8650a"]], outline: "#1c0e00", outlineW: 0.14, depth: 4, rim: "#fff0b8", rimW: 0.04, bevel: 1, tracking: 3 },
  )}`;
  return finish(s, { art, logo, focus: [236, 262, 170], bloom: 0.16, tone: false });
}

/* ───────────── Word Garden ───────────── */

function tile(s: Scene, x: number, y: number, k: number, ch: string, rot: number, hue: "wood" | "cream" = "wood") {
  const [a, b] = hue === "wood" ? ["#ffd9a0", "#d99a4e"] : ["#fffaf0", "#f1dcb4"];
  const grain = Array.from({ length: 5 }, (_, i) => `<path d="M-22 ${-14 + i * 7}q11 ${f(-3 + s.r() * 6)} 22 0t22 0" stroke="#9a5a1a" stroke-opacity=".18" stroke-width="1" fill="none"/>`).join("");
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><rect x="-26" y="-22" width="52" height="54" rx="9" fill="#000" opacity=".45" filter="${s.blur(4)}" transform="translate(3 6)"/><rect x="-26" y="-22" width="52" height="54" rx="9" fill="${s.lin(["#b0682a", "#6e3a12"], 90)}"/><rect x="-26" y="-28" width="52" height="52" rx="9" fill="${s.lin([[0, "#fff4dc"], [0.15, a], [1, b]], 90)}"/>${grain}<rect x="-24" y="-26" width="48" height="12" rx="6" fill="#fff" opacity=".35"/><text y="11" text-anchor="middle" font-family="Grandstander" font-weight="900" font-size="34" fill="#5a2a0a" opacity=".35" transform="translate(0 1.5)">${ch}</text><text y="10" text-anchor="middle" font-family="Grandstander" font-weight="900" font-size="34" fill="${s.lin(["#7a3a10", "#3a1404"], 90)}">${ch}</text><text x="18" y="18" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="9" fill="#5a2a0a">${"14213123"[ch.charCodeAt(0) % 8]}</text></g>`;
}

function butterfly(s: Scene, x: number, y: number, k: number, c: string) {
  const wing = s.rad([shade(c, 0.5), c, shade(c, -0.4)], 0.3, 0.4, 0.8);
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0C-10 -22 -30 -20 -26 -6C-24 2 -10 4 0 2Z" fill="${wing}" stroke="#2a1404" stroke-width="1"/><path d="M0 2C-12 6 -20 18 -10 20C-4 20 0 10 0 2Z" fill="${wing}" stroke="#2a1404" stroke-width="1"/><path d="M0 0C8 -18 22 -18 20 -6C18 0 8 2 0 2Z" fill="${wing}" stroke="#2a1404" stroke-width="1" opacity=".85"/><rect x="-1.5" y="-8" width="3" height="20" rx="1.5" fill="#2a1404"/></g>`;
}

function wordGarden(): Art {
  const s = new Scene("word-garden");
  const top = "WORD".split("");
  const bottom = "GARDEN".split("");
  const tiles =
    top.map((c, i) => tile(s, 230 + i * 60, 108 + Math.abs(i - 1.5) * 6, 1.02, c, (i - 1.5) * 4)).join("") +
    bottom.map((c, i) => tile(s, 170 + i * 60, 196 - Math.abs(i - 2.5) * 6, 1.02, c, (i - 2.5) * -3, "cream")).join("");
  const art = `
${photo(s, "meadow", { box: [-20, -20, 680, 425], filter: grade(s, { blur: 2.2, sat: 1.35, contrast: 1.05, bright: 0.04, rgb: [1.04, 1.02, 0.92] }) })}
${wash(s, [[0, "#fff6d0", 0.5], [0.5, "#fff6d0", 0], [1, "#2a5a10", 0.25]], "soft-light", 90)}
${glowAt(s, 320, 160, 260, "#fff6c8", 0.4)}
${bokeh(s, 30, ["#fff7c0", "#ffe070", "#ffffff"], [0, 0, W, H], 18)}
${butterfly(s, 560, 80, 1.3, "#ff7a2a")}${butterfly(s, 92, 250, 1, "#5aa8ff")}
${foliage(s, 690, 380, 1.2, true, "#5fbf3a", "#1d5e1a")}`;
  return finish(s, { art, logo: tiles, focus: [320, 150, 220], bloom: 0.12 });
}

/* ───────────── Manor Makeover: Merge ───────────── */

function manorMakeover(): Art {
  const s = new Scene("manor-makeover");
  const split = s.clip(`<path d="M0 0H300L250 360H0Z"/>`);
  const pic = (filter: string) => photo(s, "parlor", { box: [-20, -40, 680, 466], align: "xMidYMid", filter });
  let dust = "";
  for (let i = 0; i < 40; i++) dust += `<circle cx="${f(s.r() * 290)}" cy="${f(s.r() * H)}" r="${f(0.6 + s.r() * 1.6)}" fill="#fff" opacity="${f(0.2 + s.r() * 0.4)}"/>`;
  const web = `<g stroke="#fff" stroke-opacity=".5" stroke-width=".8" fill="none"><path d="M0 0L80 60M0 0L40 90M0 0L90 20M0 0L10 100"/>${[20, 40, 60, 80].map((r) => `<path d="M${r} ${r * 0.22}Q${r * 0.7} ${r * 0.5} ${r * 0.55} ${r * 0.9}Q${r * 0.35} ${r} ${r * 0.1} ${r}"/>`).join("")}</g>`;
  const bubble = (x: number, y: number, r: number, inner: string) =>
    `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${s.rad([[0, "#ffffff", 0.15], [0.8, "#bfe6ff", 0.35], [1, "#ffffff", 0.85]], 0.4, 0.35, 0.6)}" stroke="#fff" stroke-opacity=".9" stroke-width="2" filter="${s.shadow(4, 5, "#2a1030", 0.35)}"/>${inner}<ellipse cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.45)}" rx="${f(r * 0.3)}" ry="${f(r * 0.15)}" fill="#fff" opacity=".9" transform="rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.45)})"/></g>`;
  const key = (x: number, y: number) =>
    `<g transform="translate(${x} ${y}) rotate(-35)"><circle r="9" fill="none" stroke="${s.lin(["#fff3a8", "#d18a10"], 90)}" stroke-width="5"/><rect x="7" y="-2.5" width="24" height="5" rx="2" fill="${s.lin(["#fff3a8", "#d18a10"], 90)}"/><rect x="24" y="0" width="4" height="8" fill="#d18a10"/><rect x="18" y="0" width="4" height="6" fill="#d18a10"/></g>`;
  const rose = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})">${leaf(s, -2, 8, 16, 150)}${leaf(s, 2, 8, 16, 30)}${orb(s, 0, -2, 11, { base: "#e0244a", shadow: 0 })}<path d="M-6 -4q6 -8 12 0q-6 5 -12 0Z" fill="#9a0a24" opacity=".6"/></g>`;
  const art = `
${pic(grade(s, { sat: 1.35, contrast: 1.1, bright: 0.03, rgb: [1.06, 1.0, 0.9] }))}
${wash(s, [[0, "#ffd9a0", 0.5], [1, "#ffd9a0", 0]], "soft-light", 20)}
<g clip-path="${split}">${pic(grade(s, { sat: 0.15, contrast: 0.85, bright: -0.02, rgb: [1.02, 0.96, 0.86] }))}<rect width="${W}" height="${H}" fill="#3a2a1a" opacity=".25"/><g filter="${s.blur(0.6)}">${dust}</g><g transform="translate(0 0)">${web}</g></g>
<path d="M300 0L250 360" stroke="#fff6c8" stroke-width="5" filter="${s.glow(6, "#ffd36b", 1)}"/>
${sparkles(s, 16, [300, 0, 340, 360], "#fff6d0", 8)}
${bubble(560, 230, 34, rose(560, 232))}${bubble(470, 290, 28, key(462, 290))}`;
  const logo = `${wordmark(
    s,
    [
      { t: "Manor", size: 58 },
      { t: "Makeover", size: 50, dy: 48, dx: 22 },
    ],
    300,
    80,
    { font: "Playfair Display", italic: true, weight: 900, size: 58, face: [[0, "#ffffff"], [0.6, "#ffeedd"], [1, "#f4c6a8"]], outline: "#5a0f2e", outlineW: 0.16, depth: 4, extrude: "#2e0516", rim: "#ffd36b", rimW: 0.06, bevel: 0.6, rot: -4 },
  )}<g transform="rotate(-4 330 160)"><path d="M262 146H398L388 160L398 174H262L272 160Z" fill="${s.lin(["#ffd65c", "#d18a10"], 90)}" stroke="#5a0f2e" stroke-width="3" stroke-linejoin="round"/><text x="330" y="167" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="17" letter-spacing="4" fill="#5a0f2e">MERGE</text></g>`;
  return finish(s, { art, logo, focus: [520, 250, 170], bloom: 0.1 });
}

/* ───────────── Solitaire Home Story ───────────── */

function homeStory(): Art {
  const s = new Scene("home-story");
  const art = `
${photo(s, "lounge", { box: [-20, -40, 680, 454], align: "xMidYMid", filter: grade(s, { sat: 1.2, contrast: 1.06, bright: 0.02, rgb: [1.05, 1.0, 0.94] }) })}
${wash(s, [[0, "#fff1d6", 0.55], [0.5, "#ffe2b0", 0.1], [1, "#5a3010", 0.2]], "soft-light", 30)}
${glowAt(s, 600, 40, 240, "#fff3d0", 0.55)}
<g transform="translate(470 250)">${cardFan(s, 0, 0, 0.95, [["J", "spade"], ["Q", "diamond"], ["K", "club"], ["A", "heart"]], 14, 8)}</g>
${sparkles(s, 12, [380, 160, 250, 160], "#fff6d0", 8)}
${bokeh(s, 14, ["#fff6d0", "#ffe7a8"], [380, 0, 260, 160], 10)}`;
  const logo = wordmark(
    s,
    [
      { t: "Solitaire", size: 32, face: [[0, "#ffffff"], [1, "#fff1d0"]], outline: "#a33a12", depth: 3, dx: -36 },
      { t: "Home Story", size: 56, dy: 52 },
    ],
    190,
    66,
    { font: "Baloo 2", weight: 800, size: 56, face: [[0, "#e8fff0"], [0.5, "#7fe0a8"], [1, "#22a35a"]], outline: "#0c3d22", outlineW: 0.18, depth: 6, extrude: "#062312", rim: "#ffffff", rimW: 0.06, bevel: 0.8, rot: -3 },
  );
  return finish(s, { art, logo, focus: [470, 246, 170], bloom: 0.1 });
}

/* ───────────── Tower Legends ───────────── */

/** Hero silhouette, feet at the origin, ~170 tall; sword hand at (32, -172). */
const KNIGHT = [
  "M-2 -156C4 -172 20 -170 26 -160C16 -162 9 -158 5 -152Z",
  "M0 -156a10 11 0 1 1 -.1 0Z",
  "M-23 -128a9 7 0 1 1 .1 0ZM5 -128a9 7 0 1 1 .1 0Z",
  "M-13 -134H13L11 -96 14 -82H-14L-11 -96Z",
  "M-15 -84H15L19 -62H-19Z",
  "M-14 -64H-5L-14 -30 -18 0H-30L-23 -32ZM5 -64H14L18 -32 24 0H12L8 -30Z",
  "M-12 -130C-28 -110 -40 -70 -60 -8C-48 -14 -38 -6 -26 -12C-30 -40 -22 -80 -10 -110Z",
  "M-32 -122H-12V-96C-12 -84 -22 -76 -22 -76S-32 -84 -32 -96Z",
];
const ARM = "M14 -128L28 -150L32 -172";
const DRAGON = [
  "M0 0C20 -6 40 -4 54 -14C62 -22 70 -30 80 -30L96 -26 84 -22 92 -18 78 -18C70 -16 64 -8 58 0C48 12 26 18 4 16C-20 22 -50 30 -80 28C-96 28 -110 22 -122 32C-110 14 -92 18 -76 15C-50 12 -24 8 0 0Z",
  "M8 -2L-12 -72 -28 -42 -46 -78 -58 -36 -82 -62 -84 -22C-60 -14 -30 -6 8 -2Z",
  "M22 -4L48 -96 60 -52 86 -102 88 -50 120 -88 106 -30C82 -18 52 -6 22 -4Z",
];
/** Each part as its own path so overlapping parts never cancel out. */
const paths = (parts: string[], attrs: string) => parts.map((d) => `<path d="${d}" ${attrs}/>`).join("");

function darkTower(s: Scene, x: number, y: number, k: number) {
  const body =
    "M-34 0L-26 -150H-36V-170H-26V-162H-16V-170H-6V-162H6V-170H16V-162H26V-170H36V-150H26L34 0ZM-30 -170L0 -250 30 -170Z";
  const windows = [
    [-6, -130, 10, 16],
    [-14, -90, 8, 12],
    [8, -70, 8, 12],
    [-4, -40, 9, 14],
  ]
    .map(([wx, wy, ww, wh]) => `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${ww / 2}" fill="#ffcf5a"/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="${body}" fill="#ff8a3a" transform="translate(-2.5 0)" opacity=".85"/><path d="${body}" fill="#0b0612"/><g filter="${s.glow(4, "#ffb347", 1)}">${windows}</g><circle cy="-250" r="5" fill="#ffd27a" filter="${s.glow(6, "#ff8a3a", 1)}"/></g>`;
}

function towerLegends(): Art {
  const s = new Scene("tower-legends");
  const sil = (fill: string, extra = "") =>
    `<g ${extra}>${paths(KNIGHT, `fill="${fill}"`)}<path d="${ARM}" stroke="${fill}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
  const art = `
${photo(s, "castle", { box: [-80, -70, 800, 520], align: "xMidYMax", filter: grade(s, { sat: 1.6, contrast: 1.25, rgb: [1.08, 0.95, 1.05] }) })}
${wash(s, [[0, "#1a1050", 0.85], [0.45, "#7a2a6a", 0.35], [0.62, "#ff7a3a", 0.25], [1, "#000", 0]], "soft-light", 90)}
${glowAt(s, 330, 190, 260, "#ff8a3a", 0.55)}
${glowAt(s, 330, 200, 90, "#ffd27a", 0.5)}
<g transform="translate(450 150) scale(.62) rotate(-8)"><g transform="translate(-2 2)" opacity=".8">${paths(DRAGON, `fill="#ff8a3a"`)}</g>${paths(DRAGON, `fill="#120716"`)}</g>
${darkTower(s, 560, 372, 1.15)}
<path d="M0 360V292C40 282 96 276 150 290S236 330 270 360Z" fill="#07040c"/>
<g transform="translate(118 300) scale(1.3)">${sil("#ffa04a", `transform="translate(2 -1)" opacity=".9"`)}${sil("#07040c")}<path d="M24 -170H42" stroke="#07040c" stroke-width="5" stroke-linecap="round"/><g filter="${s.glow(7, "#59c3ff", 1)}"><path d="M30 -176L58 -262 64 -260 36 -174Z" fill="#effbff"/></g><circle cx="33" cy="-172" r="3.5" fill="#ffd27a"/></g>
${glowAt(s, 186, 30, 90, "#59c3ff", 0.55)}
${embers(s, 40, [0, 140, W, 220], "#ff9a3a")}`;
  const logo = wordmark(
    s,
    [
      { t: "TOWER", size: 32, tracking: 8 },
      { t: "LEGENDS", size: 52, dy: 50 },
    ],
    356,
    58,
    { font: "Cinzel Decorative", weight: 900, size: 52, face: [[0, "#ffffff"], [0.3, "#e6edf5"], [0.55, "#8a98ad"], [0.7, "#ffe4a0"], [1, "#c8861a"]], outline: "#120a02", outlineW: 0.13, depth: 5, extrude: "#050200", rim: "#ffd27a", rimW: 0.04, bevel: 1, tracking: 1, glow: "#ff7a2a" },
  );
  return finish(s, { art, logo, focus: [150, 220, 200], bloom: 0.16, tone: false });
}

export const PHOTO_SCENES: Record<string, () => Art> = {
  "solitaire-grove": solitaireGrove,
  "harbor-tycoon": harborTycoon,
  "night-solitaire": nightSolitaire,
  "jigsaw-calm": calmJigsaw,
  "jungle-trek": jungleTrek,
  "rail-city": railCity,
  "puck-rush": puckRush,
  "royal-21": royal21,
  "word-garden": wordGarden,
  "manor-makeover": manorMakeover,
  "home-story": homeStory,
  "tower-legends": towerLegends,
};
