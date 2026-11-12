/**
 * Glossy "3D render" key art: characters and props built from shaded,
 * rim-lit, specular SVG forms (casual match-3 / bubble / candy / jewel looks),
 * plus the soft clay-style puzzle cover.
 */
import { face, glossy, glowAt, leaf, orb, spec, wordmark } from "./fx";
import {
  type Art,
  bokeh,
  cloud,
  finish,
  grassTufts,
  H,
  hill,
  rays,
  ridge,
  Scene,
  shade,
  sky,
  sparkles,
  tree,
  W,
} from "./kit";

const f = (n: number) => Math.round(n * 100) / 100;

/* ───────────── Orchard Friends ───────────── */

function fence(s: Scene, y: number) {
  const wood = s.lin([[0, "#f2c58a"], [0.5, "#d2924e"], [1, "#9a5a26"]], 0);
  const rail = (ry: number) =>
    `<rect x="-10" y="${ry}" width="${W + 20}" height="13" rx="3" fill="${s.lin(["#e8b878", "#b06e34", "#7a4418"], 90)}"/><rect x="-10" y="${ry}" width="${W + 20}" height="3" fill="#fff" opacity=".25"/>`;
  let pickets = "";
  for (let x = -12; x < W + 20; x += 44) {
    const h = 74 + ((x * 7) % 9);
    pickets += `<g transform="translate(${x} ${y})"><path d="M0 0V${-h + 12}L15 ${-h}L30 ${-h + 12}V0Z" fill="#000" opacity=".25" transform="translate(4 4)" filter="${s.blur(2)}"/><path d="M0 0V${-h + 12}L15 ${-h}L30 ${-h + 12}V0Z" fill="${wood}" stroke="#7a4418" stroke-width="1.2"/><path d="M3 -4V${-h + 13}L15 ${-h + 3}" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/><circle cx="15" cy="${-h + 24}" r="1.6" fill="#6a3a14"/><circle cx="15" cy="-24" r="1.6" fill="#6a3a14"/></g>`;
  }
  return `${rail(y - 62)}${pickets}${rail(y - 30)}`;
}

function strawberry(s: Scene, x: number, y: number, k: number) {
  const d = "M0 -40C30 -42 48 -20 44 6C40 34 16 54 0 60C-16 54 -40 34 -44 6C-48 -20 -30 -42 0 -40Z";
  let seeds = "";
  for (let r = 0; r < 5; r++)
    for (let c = -3; c <= 3; c++) {
      const sx = c * 11 + (r % 2) * 5.5;
      const sy = -22 + r * 15;
      const inside = Math.abs(sx) < 40 - r * 5;
      if (!inside || (Math.abs(sx) < 20 && sy > -14 && sy < 26)) continue;
      seeds += `<ellipse cx="${sx}" cy="${sy}" rx="2" ry="3.2" fill="#ffe27a" stroke="#a8601a" stroke-width=".6"/><ellipse cx="${sx + 0.6}" cy="${sy + 2.2}" rx="2.2" ry="1" fill="#7a0010" opacity=".35"/>`;
    }
  const crown = [-70, -35, 0, 35, 70].map((a) => leaf(s, 0, -40, 26, -90 + a, "#6fd13f", "#1d6a1a")).join("");
  return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="4" cy="62" rx="40" ry="8" fill="#000" opacity=".3" filter="${s.blur(4)}"/>${glossy(s, d, { base: "#ff2338", dark: "#9a0018", light: "#ff9a9a", rim: "#ffd0b0", box: [-46, -42, 92, 102] })}${seeds}${crown}<path d="M0 -44q-2 -10 4 -16" stroke="#3f7a1f" stroke-width="3" fill="none" stroke-linecap="round"/>${face(s, 0, 8, 1.3, { mood: "open", look: [0.6, 0.4], brows: true })}</g>`;
}

function apple(s: Scene, x: number, y: number, r: number, base: string, dark: string, light: string, mood: "smile" | "open" | "grin") {
  return `${orb(s, x, y, r, { base, dark, light, rim: "#fff6c0" })}<path d="M${x} ${f(y - r * 0.9)}q2 ${f(-r * 0.35)} ${f(r * 0.12)} ${f(-r * 0.5)}" stroke="#5a3010" stroke-width="${f(r * 0.09)}" fill="none" stroke-linecap="round"/>${leaf(s, x + r * 0.08, y - r * 1.1, r * 0.55, -25)}${face(s, x + r * 0.05, y + r * 0.12, r / 34, { mood, look: [-0.8, 0.2] })}`;
}

function orchardFriends(): Art {
  const s = new Scene("orchard-friends");
  const art = `
${sky(s, ["#1e94f5", "#62c3ff", "#c9efff"])}
${glowAt(s, 80, 30, 200, "#fff8d0", 0.9)}
${rays(s, 80, 30, "#ffffff", 8, 0.18, 700)}
${cloud(s, 230, 52, 0.85)}${cloud(s, 470, 34, 0.6)}${cloud(s, 610, 90, 0.5)}
${hill(s, [190, 168, 182, 160, 176, 166, 186], "#a6e67a", "#5fae3c")}
${[60, 150, 480, 560].map((x, i) => tree(s, x, 186 - (i % 2) * 6, 0.45 + (i % 2) * 0.1, "#2f8a2c", "#9be060")).join("")}
${hill(s, [228, 220, 226, 214, 224, 218, 232], "#86d64e", "#3d8a2c")}
${fence(s, 268)}
${hill(s, [282, 276, 284, 278, 286, 280, 290], "#7fdc45", "#2f8a22")}
${grassTufts(s, 60, 280, 360, "#3f9a2a", "#a6ee5a")}
${apple(s, 410, 268, 44, "#9be22e", "#2f7a0a", "#efffb8", "open")}
${apple(s, 530, 296, 34, "#ff9a1a", "#b04a00", "#ffe2a0", "grin")}
${strawberry(s, 246, 236, 1.55)}
${orb(s, 120, 306, 24, { base: "#5a6cff", dark: "#1a1a8a", light: "#b8c4ff" })}${face(s, 120, 310, 0.62, { mood: "smile" })}
${[[320, 120, 20, 30], [600, 200, 16, -60], [150, 170, 14, 100]].map(([x, y, l, r]) => `<g filter="${s.blur(0.8)}">${leaf(s, x, y, l, r)}</g>`).join("")}
${sparkles(s, 8, [180, 140, 400, 120], "#fffbe0", 7)}`;
  const logo = wordmark(
    s,
    [
      { t: "Orchard", size: 54 },
      { t: "Friends", size: 54, dy: 50, dx: 18, face: [[0, "#ffffff"], [0.45, "#fff3a0"], [1, "#ff9a1a"]], outline: "#5a1e00", extrude: "#3a1200" },
    ],
    428,
    86,
    { font: "Luckiest Guy", size: 54, face: [[0, "#ffffff"], [0.45, "#e6ff9a"], [1, "#4cc22a"]], outline: "#174a0a", outlineW: 0.2, depth: 7, extrude: "#0c2e04", rim: "#ffffff", rimW: 0.07, bevel: 0.9, arc: 6, rot: -4, tracking: 1 },
  );
  return finish(s, { art, logo, focus: [256, 240, 170], bloom: 0.14 });
}

/* ───────────── Sugar Valley ───────────── */

function frosting(s: Scene, ys: number[], color = "#ffffff") {
  const step = W / (ys.length - 1);
  const top = ridge(ys).split(" L")[0];
  let drips = "";
  for (let x = 10; x < W; x += 22 + s.r() * 22) {
    const i = Math.min(ys.length - 2, Math.floor(x / step));
    const t = (x - i * step) / step;
    const yy = ys[i] + (ys[i + 1] - ys[i]) * (3 * t * t - 2 * t * t * t);
    const len = 8 + s.r() * 16;
    drips += `<rect x="${f(x - 4)}" y="${f(yy - 2)}" width="8" height="${f(len)}" rx="4" fill="${color}"/>`;
  }
  return `<g filter="${s.shadow(2, 1.5, "#a0306a", 0.35)}"><path d="${top}" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>${drips}</g>`;
}

function lollipop(s: Scene, x: number, y: number, r: number, c: string, stick = 70) {
  const clip = s.clip(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
  let spiral = "";
  for (let a = 0; a < Math.PI * 7; a += 0.25) {
    const rr = (a / (Math.PI * 7)) * r;
    spiral += `${a === 0 ? "M" : "L"}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
  }
  return `<rect x="${f(x - 3)}" y="${y}" width="6" height="${stick}" rx="3" fill="${s.lin(["#ffffff", "#d9d2e0"], 0)}"/>${orb(s, x, y, r, { base: c, shadow: 0, gloss: 0 })}<path d="${spiral}" stroke="#fff" stroke-width="${f(r * 0.18)}" fill="none" opacity=".9" clip-path="${clip}"/>${spec(s, x, y, r, 0.95)}`;
}

function wrapped(s: Scene, x: number, y: number, r: number, c: string, rot: number) {
  const wrap = s.lin([shade(c, 0.5), c, shade(c, -0.35)], 90);
  return `<g transform="rotate(${rot} ${x} ${y})"><path d="M${f(x - r * 0.9)} ${y}L${f(x - r * 2)} ${f(y - r * 0.8)}Q${f(x - r * 1.7)} ${y} ${f(x - r * 2)} ${f(y + r * 0.8)}Z" fill="${wrap}"/><path d="M${f(x + r * 0.9)} ${y}L${f(x + r * 2)} ${f(y - r * 0.8)}Q${f(x + r * 1.7)} ${y} ${f(x + r * 2)} ${f(y + r * 0.8)}Z" fill="${wrap}"/>${orb(s, x, y, r, { base: c, shadow: 0 })}<path d="M${f(x - r * 0.4)} ${f(y - r * 0.9)}L${f(x + r * 0.1)} ${f(y + r * 0.95)}M${f(x + r * 0.25)} ${f(y - r * 0.95)}L${f(x + r * 0.7)} ${f(y + r * 0.7)}" stroke="#fff" stroke-width="${f(r * 0.18)}" opacity=".75"/></g>`;
}

function gumdrop(s: Scene, x: number, y: number, r: number, c: string) {
  const d = `M${x - r} ${y}C${x - r} ${y - r * 1.5} ${x + r} ${y - r * 1.5} ${x + r} ${y}Q${x} ${y + r * 0.25} ${x - r} ${y}Z`;
  let sugar = "";
  for (let i = 0; i < 10; i++) sugar += `<circle cx="${f(x - r * 0.7 + s.r() * r * 1.4)}" cy="${f(y - r * 0.9 + s.r() * r * 0.8)}" r="1.1" fill="#fff" opacity=".85"/>`;
  return `<ellipse cx="${x}" cy="${y + 3}" rx="${r}" ry="${f(r * 0.22)}" fill="#a0306a" opacity=".35" filter="${s.blur(2)}"/>${glossy(s, d, { base: c, box: [x - r, y - r * 1.15, r * 2, r * 1.2] })}${sugar}`;
}

function sugarValley(): Art {
  const s = new Scene("candy-valley");
  let sprinkles = "";
  const sc = ["#ff4f9a", "#4fc3ff", "#ffd23a", "#7ae05a", "#b07aff", "#ffffff"];
  for (let i = 0; i < 70; i++)
    sprinkles += `<rect x="${f(s.r() * W)}" y="${f(300 + s.r() * 60)}" width="7" height="2.4" rx="1.2" fill="${sc[i % sc.length]}" transform="rotate(${f(s.r() * 180)} ${f(s.r() * W)} 330)"/>`;
  const hillA = [196, 176, 188, 168, 186, 172, 192];
  const hillB = [252, 238, 248, 232, 246, 236, 254];
  const hillC = [306, 296, 304, 292, 302, 296, 308];
  const art = `
${sky(s, ["#ff86cc", "#ffb8e2", "#ffe8f6"])}
${glowAt(s, 320, 120, 260, "#fff4fb", 0.9)}
${cloud(s, 110, 70, 0.8, "#ffc2e6")}${cloud(s, 540, 52, 0.7, "#ffc2e6")}${cloud(s, 330, 30, 0.45, "#ffc2e6")}
${hill(s, hillA, "#d6a8ff", "#a77cf0")}${glowAt(s, 200, 190, 140, "#ffffff", 0.35)}${frosting(s, hillA, "#fff2fb")}
${lollipop(s, 70, 170, 26, "#ff4f9a", 60)}${lollipop(s, 590, 176, 22, "#4fc3ff", 50)}
${hill(s, hillB, "#9ff0d8", "#40c79c")}${glowAt(s, 420, 250, 150, "#ffffff", 0.3)}${frosting(s, hillB, "#ffffff")}
${lollipop(s, 520, 214, 34, "#ffb21a", 60)}${lollipop(s, 134, 226, 30, "#7ae05a", 50)}
${hill(s, hillC, "#ffc2e0", "#ff7ab8")}${frosting(s, hillC, "#ffffff")}
${sprinkles}
${gumdrop(s, 236, 320, 26, "#ff3d6e")}${gumdrop(s, 400, 326, 22, "#ffd23a")}${gumdrop(s, 600, 330, 24, "#7a5cff")}
${wrapped(s, 320, 300, 26, "#22b8ff", -12)}${wrapped(s, 70, 318, 20, "#ff7a1a", 15)}
${orb(s, 470, 300, 18, { base: "#ff4f9a" })}${orb(s, 164, 300, 14, { base: "#ffffff", dark: "#d0b0e0" })}
${lollipop(s, 44, 236, 58, "#ff3d8a", 140)}${wrapped(s, 590, 250, 34, "#9a5cff", 20)}
${bokeh(s, 24, ["#ffffff", "#ffe0f2"], [0, 0, W, 200], 10)}
${sparkles(s, 14, [40, 40, 560, 260], "#ffffff", 7)}`;
  const logo = wordmark(
    s,
    [
      { t: "Sugar", size: 62 },
      { t: "Valley", size: 62, dy: 56, dx: 26, face: [[0, "#ffffff"], [0.45, "#bff6ff"], [1, "#22a8ff"]], outline: "#0a2a7a", extrude: "#06184a" },
    ],
    312,
    80,
    { font: "Chewy", size: 62, face: [[0, "#ffffff"], [0.45, "#ffd0ea"], [1, "#ff3d96"]], outline: "#7a0f4a", outlineW: 0.18, depth: 7, extrude: "#4a0628", rim: "#ffffff", rimW: 0.08, bevel: 0.9, rot: -5 },
  );
  return finish(s, { art, logo, focus: [72, 236, 140], bloom: 0.14 });
}

/* ───────────── Gem Cascade Classic ───────────── */

type Cut = { n: number; rot: number; sx?: number; sy?: number; radii?: number[] };
const CUTS: Record<string, Cut> = {
  round: { n: 8, rot: 22.5 },
  emerald: { n: 8, rot: 0, radii: [1, 0.86, 1, 0.86, 1, 0.86, 1, 0.86] },
  hex: { n: 6, rot: 0 },
  tri: { n: 3, rot: -90, sy: 1.05 },
  oval: { n: 10, rot: 0, sx: 0.8 },
  square: { n: 4, rot: 45 },
};

/** Faceted gemstone: crown facets shaded by their angle to the key light. */
function gemstone(s: Scene, x: number, y: number, r: number, color: string, cut: Cut) {
  const outer: [number, number][] = [];
  for (let i = 0; i < cut.n; i++) {
    const a = ((cut.rot + (360 / cut.n) * i) * Math.PI) / 180;
    const rr = r * (cut.radii?.[i] ?? 1);
    outer.push([x + Math.cos(a) * rr * (cut.sx ?? 1), y + Math.sin(a) * rr * (cut.sy ?? 1)]);
  }
  const table = outer.map(([px, py]) => [x - r * 0.06 + (px - x) * 0.5, y - r * 0.08 + (py - y) * 0.5] as [number, number]);
  const P = (p: [number, number][]) => p.map(([a, b]) => `${f(a)},${f(b)}`).join(" ");
  let facets = "";
  for (let i = 0; i < cut.n; i++) {
    const j = (i + 1) % cut.n;
    const mx = (outer[i][0] + outer[j][0]) / 2 - x;
    const my = (outer[i][1] + outer[j][1]) / 2 - y;
    const ang = Math.atan2(my, mx);
    const lit = Math.cos(ang - (-135 * Math.PI) / 180);
    facets += `<polygon points="${P([outer[i], outer[j], table[j], table[i]])}" fill="${shade(color, lit > 0 ? lit * 0.55 : lit * 0.55)}" stroke="${shade(color, 0.6)}" stroke-opacity=".35" stroke-width=".6"/>`;
  }
  return `<g><polygon points="${P(outer)}" fill="#000" opacity=".45" transform="translate(2 4)" filter="${s.blur(2.5)}"/>${facets}<polygon points="${P(table)}" fill="${s.lin([[0, shade(color, 0.7)], [0.5, shade(color, 0.15)], [1, shade(color, -0.2)]], 60)}"/><polygon points="${P(outer)}" fill="none" stroke="${shade(color, -0.5)}" stroke-width="1"/><path d="M${f(table[0][0])} ${f(table[0][1])}" /><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.32)}" r="${f(r * 0.12)}" fill="#fff" opacity=".9" filter="${s.blur(0.6)}"/></g>`;
}

function gemCascade(): Art {
  const s = new Scene("gem-cascade");
  const kinds: [string, Cut][] = [
    ["#ff1f4a", CUTS.round],
    ["#1f7bff", CUTS.emerald],
    ["#14c46a", CUTS.hex],
    ["#ffc21a", CUTS.tri],
    ["#b04dff", CUTS.oval],
    ["#ff7a1a", CUTS.square],
  ];
  const cols = 8;
  const rows = 4;
  const cell = 46;
  const bx = W / 2 - (cols * cell) / 2;
  const by = 160;
  let cells = "";
  let gems = "";
  const matchRow = 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      cells += `<rect x="${bx + i * cell + 2}" y="${by + j * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="6" fill="${(i + j) % 2 ? "#0b2f3a" : "#0f3b48"}" opacity=".85"/>`;
      const match = j === matchRow && i >= 2 && i <= 4;
      const [c, cut] = match ? kinds[0] : kinds[Math.floor(s.r() * kinds.length)];
      const cx = bx + i * cell + cell / 2;
      const cy = by + j * cell + cell / 2;
      if (match) gems += glowAt(s, cx, cy, 34, "#ff6a8a", 0.8);
      gems += gemstone(s, cx, cy, 18, c, cut);
    }
  const frame = s.lin([[0, "#fff1b0"], [0.4, "#e8b23a"], [0.7, "#a8650a"], [1, "#ffe08a"]], 90);
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#1f8a8a", "#0b3b4a", "#04141c"], 0.5, 0.35, 0.85)}"/>
${rays(s, 320, -40, "#9ffff0", 9, 0.16, 560)}
${bokeh(s, 30, ["#5ff0e0", "#ffe08a", "#ff8ac0"], [0, 0, W, H], 14)}
${[[40, 120, "#14c46a", CUTS.hex, 26], [600, 110, "#1f7bff", CUTS.emerald, 30], [70, 300, "#ffc21a", CUTS.tri, 28], [590, 300, "#b04dff", CUTS.oval, 28]].map(([x, y, c, cut, r]) => `<g filter="${s.blur(1.6)}" opacity=".9">${gemstone(s, x as number, y as number, r as number, c as string, cut as Cut)}</g>`).join("")}
<rect x="${bx - 10}" y="${by - 10}" width="${cols * cell + 20}" height="${rows * cell + 20}" rx="14" fill="#04161c" opacity=".7" stroke="${frame}" stroke-width="6" filter="${s.shadow(6, 8, "#000", 0.6)}"/>
${cells}${gems}
${sparkles(s, 18, [bx, by - 20, cols * cell, rows * cell + 20], "#ffffff", 8)}`;
  const logo = `${wordmark(
    s,
    [{ t: "Gem Cascade", size: 58 }],
    320,
    92,
    { font: "Berkshire Swash", size: 58, face: [[0, "#fffbe0"], [0.4, "#ffd65c"], [0.6, "#d18a0c"], [1, "#ffe9a0"]], outline: "#2a0a3a", outlineW: 0.15, depth: 5, extrude: "#14041e", rim: "#fff0b8", rimW: 0.04, bevel: 1, glow: "#30e0d0" },
  )}<g><path d="M262 104H378L368 118L378 132H262L272 118Z" fill="${s.lin(["#5ff0e0", "#0d8a8a"], 90)}" stroke="#04242a" stroke-width="3" stroke-linejoin="round"/><text x="320" y="125" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="15" letter-spacing="5" fill="#ffffff">CLASSIC</text></g>`;
  return finish(s, { art, logo, focus: [320, 250, 150], bloom: 0.2, tone: false });
}

/* ───────────── Bubble Pop Party ───────────── */

function glassBubble(s: Scene, x: number, y: number, r: number, c: string) {
  return `${orb(s, x, y, r, { base: c, light: shade(c, 0.6), dark: shade(c, -0.45), rim: "#ffffff", shadow: 0 })}<circle cx="${x}" cy="${y}" r="${f(r * 0.62)}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="${f(r * 0.1)}"/>`;
}

function bubblePop(): Art {
  const s = new Scene("bubble-pop");
  const colors = ["#ff3d7a", "#ffd21a", "#1fb8ff", "#5ae03a", "#b04dff", "#ff8a1a"];
  const r = 20;
  let grid = "";
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 17; i++) {
      if (j === 3 && (i < 3 || i > 13 || s.r() < 0.35)) continue;
      if (j === 2 && (i === 9 || i === 10)) continue;
      const x = 10 + i * r * 2 + (j % 2) * r;
      const y = 22 + j * r * 1.74;
      grid += glassBubble(s, x, y, r, colors[Math.floor(s.r() * colors.length)]);
    }
  let burst = "";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = 26 + s.r() * 26;
    burst += `<circle cx="${f(400 + Math.cos(a) * d)}" cy="${f(102 + Math.sin(a) * d)}" r="${f(2 + s.r() * 4)}" fill="#ffe14d"/>`;
  }
  let aim = "";
  for (let i = 0; i < 9; i++) aim += `<circle cx="${f(322 + i * 8.6)}" cy="${f(226 - i * 13)}" r="${f(3.4 - i * 0.2)}" fill="#fff" opacity="${f(0.95 - i * 0.07)}"/>`;
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#28d0ff", "#6a5cff", "#c04dff"], 120)}"/>
${glowAt(s, 320, 300, 300, "#ff9ae0", 0.55)}
${rays(s, 320, 330, "#ffffff", 12, 0.12, 520)}
${bokeh(s, 26, ["#ffffff", "#ffe6ff", "#c0f4ff"], [0, 120, W, 240], 16)}
${grid}
<g filter="${s.glow(4, "#ffe14d", 1)}">${burst}</g>
<path d="M400 76l6 16 17 2-13 10 4 17-14-9-14 9 4-17-13-10 17-2Z" fill="#fff6b0" filter="${s.glow(5, "#ffd21a", 1)}"/>
${aim}
<path d="M250 360C250 300 390 300 390 360Z" fill="${s.lin(["#ffd21a", "#ff8a1a"], 90)}" stroke="#7a2a00" stroke-width="3"/>
${orb(s, 320, 286, 46, { base: "#ff5fae", dark: "#a01860", light: "#ffc0e2", rim: "#ffe0f0" })}
<path d="M296 248q-12 -20 -2 -30q4 14 14 20Z" fill="#ff5fae"/><path d="M344 248q12 -20 2 -30q-4 14 -14 20Z" fill="#ff5fae"/>
${face(s, 320, 292, 1.25, { mood: "grin", look: [0.4, -0.8], iris: "#3a2a8a" })}
${glassBubble(s, 322, 224, 18, "#1fb8ff")}
${sparkles(s, 14, [0, 140, W, 200], "#ffffff", 8)}`;
  const logo = wordmark(
    s,
    [
      { t: "Bubble Pop", size: 46 },
      { t: "PARTY!", size: 36, dy: 42, face: [[0, "#ffffff"], [0.5, "#ffb8ea"], [1, "#ff3da8"]], outline: "#4a0a4a", extrude: "#2a0430" },
    ],
    142,
    226,
    { font: "Titan One", size: 46, face: [[0, "#fffbe0"], [0.45, "#ffe14d"], [1, "#ff9a1a"]], outline: "#2a0a7a", outlineW: 0.2, depth: 6, extrude: "#14044a", rim: "#ffffff", rimW: 0.07, bevel: 0.9, rot: -6 },
  );
  return finish(s, { art, logo, focus: [320, 270, 150], bloom: 0.14 });
}

/* ───────────── Arrow Slide Puzzle (soft clay) ───────────── */

const ARROW = "M-16 -7H4V-16L20 0L4 16V7H-16Z";

function clayArrow(s: Scene, x: number, y: number, dir: number, c: string, k = 1, op = 1) {
  return `<g transform="translate(${x} ${y}) scale(${k})" opacity="${op}"><g transform="rotate(${dir})"><path d="${ARROW}" fill="#3a2a7a" opacity=".28" transform="translate(4 9)" filter="${s.blur(3)}"/></g><g transform="translate(0 5) rotate(${dir})"><path d="${ARROW}" fill="${shade(c, -0.3)}" stroke="${shade(c, -0.3)}" stroke-width="5" stroke-linejoin="round"/></g><g transform="rotate(${dir})"><path d="${ARROW}" fill="${s.lin([shade(c, 0.35), c], 90)}" stroke="${s.lin([shade(c, 0.35), c], 90)}" stroke-width="5" stroke-linejoin="round"/><path d="M-15 -6H4" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/></g></g>`;
}

function arrowSlide(): Art {
  const s = new Scene("maze-slide");
  const colors = ["#ff7a7a", "#3fd1c0", "#ffc94a", "#6c8cff", "#ff8ad0", "#8adf5a"];
  const cols = 7;
  const rows = 4;
  const cell = 48;
  const bx = W / 2 - (cols * cell) / 2;
  const by = 146;
  let arrows = "";
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if ((i === 5 && j === 1) || (i === 2 && j === 3)) continue;
      const dir = [0, 90, 180, 270][Math.floor(s.r() * 4)];
      arrows += clayArrow(s, bx + i * cell + cell / 2, by + j * cell + cell / 2 - 4, dir, colors[Math.floor(s.r() * colors.length)]);
    }
  const sy = by + cell * 1.5 - 4;
  const slide =
    [0.18, 0.32, 0.5].map((op, i) => clayArrow(s, bx + 5.5 * cell + 30 + i * 22, sy, 0, "#ff7a7a", 1, op)).join("") +
    `<g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M${bx + 5.5 * cell + 16} ${sy - 14}h20M${bx + 5.5 * cell + 8} ${sy}h26M${bx + 5.5 * cell + 16} ${sy + 14}h20"/></g>` +
    clayArrow(s, bx + 5.5 * cell + 96, sy, 0, "#ff7a7a", 1.05);
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#d8c8ff", "#b6d8ff", "#c8f2ec"], 30)}"/>
${glowAt(s, 140, 60, 260, "#ffffff", 0.7)}
${[[60, 300, 70, "#ffd0e8"], [590, 60, 60, "#d0f4ff"], [590, 320, 50, "#fff0c0"]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".7" filter="${s.blur(14)}"/>`).join("")}
<rect x="${bx - 16}" y="${by - 12}" width="${cols * cell + 32}" height="${rows * cell + 34}" rx="22" fill="#5a46c8" opacity=".3" transform="translate(6 16)" filter="${s.blur(12)}"/>
<rect x="${bx - 16}" y="${by - 4}" width="${cols * cell + 32}" height="${rows * cell + 26}" rx="22" fill="#a796f0"/>
<rect x="${bx - 16}" y="${by - 16}" width="${cols * cell + 32}" height="${rows * cell + 26}" rx="22" fill="${s.lin(["#ffffff", "#efeaff"], 90)}"/>
${Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => `<rect x="${bx + i * cell + 4}" y="${by + j * cell - 2}" width="${cell - 8}" height="${cell - 8}" rx="10" fill="#e4dcff"/>`).join("")).join("")}
${arrows}${slide}
${sparkles(s, 8, [bx + 5 * cell, by, 200, 100], "#ffffff", 7)}`;
  const logo = `${wordmark(
    s,
    [{ t: "Arrow Slide", size: 50 }],
    320,
    82,
    { font: "Righteous", size: 50, face: [[0, "#ffffff"], [1, "#f1ecff"]], outline: "#5a3fd1", outlineW: 0.16, depth: 6, extrude: "#3a22a8", bevel: 0.4, rot: -2, tracking: 1 },
  )}<g transform="rotate(-2 320 110)"><rect x="268" y="96" width="104" height="26" rx="13" fill="#ff7a7a" stroke="#fff" stroke-width="2.5"/><text x="320" y="115" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="14" letter-spacing="3" fill="#fff">PUZZLE</text></g>`;
  return finish(s, { art, logo, focus: [bx + 5.5 * cell + 40, sy, 140], bloom: 0.06, tone: false, sat: 1.05 });
}

export const GLOSSY_SCENES: Record<string, () => Art> = {
  "orchard-friends": orchardFriends,
  "candy-valley": sugarValley,
  "gem-cascade": gemCascade,
  "bubble-pop": bubblePop,
  "maze-slide": arrowSlide,
};
