/**
 * Stylised key art, one distinct look each: synthwave neon (Brick Burst),
 * 8-bit pixel art (Snake Trail), low-poly (Arena Blitz), painterly matte
 * painting (Castle Siege), isometric builder (Island Village), tabletop 3D
 * (Checkers Club) and green-felt card table (Solitaire Social).
 */
import { face, glowAt, isoBox, isoP, isoRoof, orb, pixels, playingCard, wordmark } from "./fx";
import { type Art, bokeh, embers, finish, H, palm, Scene, shade, sparkles, vignette, W } from "./kit";

const f = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(a: string, b: string, t: number) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, Math.max(0, Math.min(1, t)))));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
function ramp(stops: [number, string][], t: number) {
  for (let i = 1; i < stops.length; i++)
    if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops[stops.length - 1][1];
}

/* ───────────── Brick Burst (synthwave neon) ───────────── */

function brickBurst(): Art {
  const s = new Scene("brick-burst");
  const hz = 236;
  let grid = "";
  for (let i = 1; i < 12; i++) {
    const y = hz + (i * i * (H - hz)) / 121;
    grid += `<path d="M0 ${f(y)}H${W}"/>`;
  }
  for (let i = -14; i <= 14; i++) grid += `<path d="M${f(W / 2 + i * 12)} ${hz}L${f(W / 2 + i * 70)} ${H}"/>`;
  const sunClip = s.clip(
    `<rect x="0" y="0" width="${W}" height="${hz - 50}"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="0" y="${hz - 46 + i * 9}" width="${W}" height="${f(6 - i)}"/>`).join("")}`,
  );
  const neonC = ["#ff3df2", "#3df6ff", "#ffe14d", "#7a5cff", "#3dff8a", "#ff8a3d"];
  let bricks = "";
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 9; i++) {
      if (j === 2 && (i === 5 || i === 6)) continue;
      const c = neonC[(i + j * 2) % neonC.length];
      const x = 22 + i * 67;
      const y = 16 + j * 28;
      bricks += `<g><rect x="${x}" y="${y}" width="60" height="22" rx="5" fill="${s.lin([shade(c, -0.25), shade(c, -0.7)], 90)}" stroke="${c}" stroke-width="2.2"/><rect x="${x + 4}" y="${y + 3}" width="52" height="5" rx="2.5" fill="#fff" opacity=".45"/><text x="${x + 30}" y="${y + 17}" text-anchor="middle" font-family="Bungee" font-size="11" fill="#fff" opacity=".9">${[5, 10, 20, 40][(i * 3 + j) % 4]}</text></g>`;
    }
  let shards = "";
  for (let i = 0; i < 12; i++) {
    const x = 400 + s.r() * 90;
    const y = 84 + s.r() * 40;
    shards += `<rect x="${f(x)}" y="${f(y)}" width="${f(4 + s.r() * 8)}" height="${f(3 + s.r() * 5)}" fill="#3dff8a" transform="rotate(${f(s.r() * 90)} ${f(x)} ${f(y)})"/>`;
  }
  const art = `
<rect width="${W}" height="${hz}" fill="${s.lin(["#07021a", "#22095a", "#6a1a8a", "#ff4fa0"], 90)}"/>
${Array.from({ length: 40 }, () => `<circle cx="${f(s.r() * W)}" cy="${f(s.r() * 150)}" r="${f(0.5 + s.r())}" fill="#fff" opacity="${f(0.3 + s.r() * 0.6)}"/>`).join("")}
${glowAt(s, 320, hz - 20, 220, "#ff4fa0", 0.7)}
<g clip-path="${sunClip}"><circle cx="320" cy="${hz - 10}" r="104" fill="${s.lin(["#fff36b", "#ff9a3d", "#ff3d9a"], 90)}"/></g>
<path d="M0 ${hz}L70 ${hz - 40}L130 ${hz - 18}L190 ${hz - 56}L250 ${hz}ZM390 ${hz}L450 ${hz - 50}L500 ${hz - 22}L560 ${hz - 62}L640 ${hz - 10}V${hz}Z" fill="#12042e" stroke="#3df6ff" stroke-width="1.5" filter="${s.glow(3, "#3df6ff", 0.9)}"/>
<rect y="${hz}" width="${W}" height="${H - hz}" fill="${s.lin(["#2a0640", "#0a0118"], 90)}"/>
<g stroke="#ff3df2" stroke-width="1.4" fill="none" filter="${s.glow(2.5, "#ff3df2", 1)}" opacity=".9">${grid}</g>
<g filter="${s.glow(4, "#ffffff", 0.5)}">${bricks}</g>
<g filter="${s.glow(3, "#3dff8a", 1)}">${shards}</g>
<path d="M330 300L440 116" stroke="${s.lin([[0, "#3df6ff", 0], [1, "#ffffff", 1]], 300)}" stroke-width="10" stroke-linecap="round" filter="${s.blur(3)}"/>
<circle cx="442" cy="114" r="9" fill="#ffffff" filter="${s.glow(8, "#3df6ff", 1)}"/>
<rect x="270" y="300" width="120" height="13" rx="6.5" fill="${s.lin(["#ffffff", "#3df6ff"], 90)}" filter="${s.glow(6, "#3df6ff", 1)}"/>`;
  const logo = wordmark(
    s,
    [
      { t: "BRICK", size: 54 },
      { t: "BURST", size: 54, dy: 50 },
    ],
    160,
    196,
    { font: "Bungee", size: 54, face: [[0, "#ffffff"], [0.4, "#bff9ff"], [0.5, "#3df6ff"], [0.75, "#b04dff"], [1, "#ff3df2"]], outline: "#14002e", outlineW: 0.14, depth: 6, extrude: "#3a0a6a", rim: "#ffffff", rimW: 0.04, bevel: 0.6, glow: "#ff3df2", rot: -6 },
  );
  return finish(s, { art, logo, focus: [380, 180, 210], bloom: 0.22, tone: false });
}

/* ───────────── Snake Trail (8-bit pixel art) ───────────── */

function snakeTrail(): Art {
  const s = new Scene("snake-trail");
  const px = 6;
  const cols = Math.ceil(W / px);
  const GY = 192;
  const tile = 24;
  let out = "";
  const bands = ["#1a1040", "#24165a", "#2f2074", "#3d2c8c", "#5a3c9e", "#8a4ea8", "#c0609e", "#f08a8a", "#ffb07a", "#ffd08a"];
  bands.forEach((c, i) => {
    out += `<rect x="0" y="${i * 20}" width="${W}" height="20" fill="${c}"/>`;
    if (i < bands.length - 1)
      for (let x = 0; x < W / 4; x += 2) out += `<rect x="${x * 4 + ((x / 2) % 2) * 4}" y="${i * 20 + 16}" width="4" height="4" fill="${bands[i + 1]}"/>`;
  });
  for (let i = 0; i < 30; i++) out += `<rect x="${Math.round((s.r() * W) / 4) * 4}" y="${Math.round((s.r() * 90) / 4) * 4}" width="4" height="4" fill="#fff" opacity="${f(0.4 + s.r() * 0.6)}"/>`;
  const sun = ["...yyyy...", ".yyyyyyyy.", ".yyyyyyyy.", "yyyyyyyyyy", "oooooooooo", "yyyyyyyyyy", "oooooooooo", ".oooooooo.", "..oooooo.."];
  out += pixels(sun, { y: "#ffe76a", o: "#ffb04a" }, 500, 104, px);
  const cloudMap = ["....wwww......", "..wwwwwwww....", "wwwwwwwwwwwwww", ".pppppppppppp."];
  out += pixels(cloudMap, { w: "#ffe6f2", p: "#d8a0d0" }, 40, 132, px - 1) + pixels(cloudMap, { w: "#ffe6f2", p: "#d8a0d0" }, 420, 60, px - 2);
  for (let x = 0; x < cols; x++) {
    const h1 = Math.round(9 + 5 * Math.sin(x * 0.09) + 3 * Math.sin(x * 0.23));
    out += `<rect x="${x * px}" y="${GY - h1 * px}" width="${px}" height="${h1 * px}" fill="#4a3478"/><rect x="${x * px}" y="${GY - h1 * px}" width="${px}" height="${px}" fill="#6a4a9a"/>`;
    const h2 = Math.round(4 + 3 * Math.sin(x * 0.14 + 2) + 1.5 * Math.sin(x * 0.37));
    out += `<rect x="${x * px}" y="${GY - h2 * px}" width="${px}" height="${h2 * px}" fill="#2a7a4a"/><rect x="${x * px}" y="${GY - h2 * px}" width="${px}" height="${px}" fill="#3a9a5a"/>`;
  }
  for (let ty = GY; ty < H; ty += tile)
    for (let tx = 0; tx < W; tx += tile)
      out += `<rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" fill="${((tx + ty - GY) / tile) % 2 ? "#4cb84c" : "#62d262"}"/>`;
  out += `<rect y="${GY}" width="${W}" height="6" fill="#2a8a3a"/>`;
  const turns: [number, number][] = [
    [0, 4], [6, 4], [6, 2], [12, 2], [12, 5], [18, 5], [18, 3], [22, 3],
  ];
  const path: [number, number][] = [];
  for (let k = 1; k < turns.length; k++) {
    const [ax, ay] = turns[k - 1];
    const [bx, by] = turns[k];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i < n; i++) path.push([ax + Math.sign(bx - ax) * i, ay + Math.sign(by - ay) * i]);
  }
  path.push(turns[turns.length - 1]);
  const cell = (cx: number, cy: number): [number, number] => [cx * tile + 16, GY + cy * tile + 6];
  path.forEach(([cx, cy], i) => {
    const [x, y] = cell(cx, cy);
    const head = i === path.length - 1;
    const c = head ? "#ffd23a" : i % 2 ? "#ff9a1a" : "#ffbe2a";
    out += `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="#3a1004"/><rect x="${x + 2}" y="${y + 2}" width="${tile - 4}" height="${tile - 4}" fill="${c}"/><rect x="${x + 2}" y="${y + tile - 7}" width="${tile - 4}" height="5" fill="${head ? "#e09a10" : "#d0600a"}"/><rect x="${x + 4}" y="${y + 4}" width="6" height="4" fill="#fff6c0"/>`;
    if (head)
      out += `<rect x="${x + 13}" y="${y + 4}" width="5" height="5" fill="#1a0a04"/><rect x="${x + 13}" y="${y + 14}" width="5" height="5" fill="#1a0a04"/><rect x="${x + 14}" y="${y + 5}" width="2" height="2" fill="#fff"/><rect x="${x + 14}" y="${y + 15}" width="2" height="2" fill="#fff"/><rect x="${x + tile}" y="${y + 10}" width="8" height="4" fill="#ff2a3a"/><rect x="${x + tile + 8}" y="${y + 7}" width="4" height="4" fill="#ff2a3a"/><rect x="${x + tile + 8}" y="${y + 13}" width="4" height="4" fill="#ff2a3a"/>`;
  });
  const appleMap = ["....bb..", "...b....", ".rrgrrr.", "rrwrrrrr", "rwrrrrrr", "rrrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rr.rr."];
  const apples = ([[24, 3], [3, 1], [15, 6], [9, 5]] as [number, number][])
    .map(([ax, ay]) => {
      const [x, y] = cell(ax, ay);
      return pixels(appleMap, { r: "#ff2a3a", w: "#ffd0d0", g: "#3aff6a", b: "#7a3a10" }, x, y, 3);
    })
    .join("");
  const [hx, hy] = cell(22, 3);
  const bonus = `<text x="${hx + 4}" y="${hy - 12}" font-family="'Press Start 2P'" font-size="12" fill="#fff" stroke="#3a1004" stroke-width="3" paint-order="stroke">+10</text>`;
  const scan = s.id("sl");
  s.def(`<pattern id="${scan}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.6" fill="#000" opacity=".2"/></pattern>`);
  const hud = `<g font-family="'Press Start 2P'" font-size="11" fill="#fff" stroke="#120830" stroke-width="3" paint-order="stroke"><text x="16" y="26">SCORE <tspan fill="#ffe76a">004200</tspan></text><text x="${W - 16}" y="26" text-anchor="end">HI <tspan fill="#3aff6a">099990</tspan></text></g>`;
  const art = `${out}${apples}${bonus}`;
  const logo = `${wordmark(
    s,
    [
      { t: "SNAKE", size: 46 },
      { t: "TRAIL", size: 46, dy: 56, dx: 34 },
    ],
    290,
    96,
    { font: "Press Start 2P", size: 46, face: [[0, "#fff7a0"], [0.33, "#fff7a0"], [0.34, "#ffc23a"], [0.66, "#ffc23a"], [0.67, "#ff6a1a"], [1, "#ff6a1a"]], outline: "#1a0630", outlineW: 0.16, depth: 12, extrude: "#7a0a4a", bevel: 0, shadow: 0, square: true },
  )}${hud}<rect width="${W}" height="${H}" fill="url(#${scan})"/>`;
  return finish(s, { art, logo, focus: [hx - 40, hy + 10, 150], bloom: 0.1, tone: false, sat: 1.05, post: vignette(s, 0.45) });
}

/* ───────────── Arena Blitz (low-poly) ───────────── */

function arenaBlitz(): Art {
  const s = new Scene("arena-blitz");
  const far = (x: number) => 196 - 46 * Math.abs(Math.sin(x * 0.011 + 0.6)) - 18 * Math.sin(x * 0.033);
  const near = (x: number) => 262 - 24 * Math.sin(x * 0.018 + 2) - 12 * Math.sin(x * 0.051);
  const color = (x: number, y: number) => {
    if (y > near(x)) return ramp([[0, "#3a7a3a"], [1, "#16301a"]], (y - near(x)) / 100);
    if (y > far(x)) return ramp([[0, "#6a4a9a"], [1, "#2a2050"]], (y - far(x)) / 90);
    return ramp([[0, "#1a1250"], [0.35, "#5a2a8a"], [0.6, "#ff6a5a"], [0.75, "#ffb36a"]], y / 220);
  };
  const cols = 24;
  const rows = 14;
  const pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const jx = i === 0 || i === cols ? 0 : (s.r() - 0.5) * 18;
      const jy = j === 0 || j === rows ? 0 : (s.r() - 0.5) * 16;
      pts[j].push([(i * W) / cols + jx, (j * H) / rows + jy]);
    }
  }
  let tris = "";
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = pts[j][i];
      const b = pts[j][i + 1];
      const c = pts[j + 1][i];
      const d = pts[j + 1][i + 1];
      for (const t of (i + j) % 2 ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]]) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        const col = shade(color(cx, cy), (s.r() - 0.5) * 0.16);
        tris += `<polygon points="${t.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${col}" stroke="${col}" stroke-width=".6"/>`;
      }
    }
  const facet = (pts2: [number, number][], c: string) => `<polygon points="${pts2.map(([x, y]) => `${x},${y}`).join(" ")}" fill="${c}"/>`;
  const cx = 432;
  const crown = `<g transform="translate(${cx} 150)">${facet([[-46, 10], [-56, -34], [-28, -8]], "#ffd24a")}${facet([[-28, -8], [0, -46], [0, 0]], "#ffe98a")}${facet([[0, -46], [28, -8], [0, 0]], "#e8a81a")}${facet([[28, -8], [56, -34], [46, 10]], "#c8860a")}${facet([[-46, 10], [-28, -8], [0, 0], [0, 12]], "#f2b82a")}${facet([[0, 0], [28, -8], [46, 10], [0, 12]], "#b8760a")}${facet([[-48, 10], [48, 10], [44, 24], [-44, 24]], "#d8961a")}${facet([[-48, 10], [0, 12], [-44, 24]], "#ffe07a")}<polygon points="-6,6 0,-4 6,6 0,14" fill="#ff2a5a"/><polygon points="-6,6 0,-4 0,14" fill="#ff7a9a"/></g>`;
  const pedestal = `<g transform="translate(${cx} 236)">${facet([[-50, 0], [0, -16], [0, 40]], "#5a5a7a")}${facet([[0, -16], [50, 0], [0, 40]], "#3a3a5a")}${facet([[-50, 0], [0, 40], [-40, 50]], "#4a4a6a")}${facet([[50, 0], [40, 50], [0, 40]], "#2a2a44")}${facet([[-50, 0], [0, -16], [50, 0], [0, 14]], "#8a8ab0")}</g>`;
  const chute = (x: number, y: number, k: number, c: string) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-22 0Q0 -22 22 0Q11 -5 0 -4Q-11 -5 -22 0Z" fill="${c}"/><path d="M-22 0L0 26M22 0L0 26M0 -4L0 26" stroke="#1a1030" stroke-width="1"/><rect x="-3" y="24" width="6" height="10" rx="2" fill="#1a1030"/></g>`;
  const art = `
${tris}
${glowAt(s, cx, 120, 160, "#ffd27a", 0.55)}
<rect x="${cx - 26}" y="0" width="52" height="236" fill="${s.lin([[0, "#fff6c8", 0], [1, "#fff6c8", 0.45]], 90)}" filter="${s.blur(8)}"/>
<ellipse cx="${cx}" cy="262" rx="230" ry="34" fill="none" stroke="#3df6ff" stroke-width="3" filter="${s.glow(5, "#3df6ff", 1)}" opacity=".9"/>
<path d="M${cx - 230} 262V170A230 34 0 0 1 ${cx + 230} 170V262A230 34 0 0 0 ${cx - 230} 262Z" fill="${s.lin([[0, "#3df6ff", 0], [1, "#3df6ff", 0.22]], 90)}"/>
${pedestal}${crown}
${chute(120, 70, 1, "#ff5a3a")}${chute(560, 56, 0.8, "#3ab0ff")}${chute(250, 30, 0.6, "#ffd23a")}
${embers(s, 24, [cx - 120, 60, 240, 200], "#ffe08a")}
${sparkles(s, 10, [cx - 80, 100, 160, 100], "#fff6c8", 8)}`;
  const bolt = `<path d="M282 54L246 104H270L250 150L300 90H274L296 54Z" fill="${s.lin(["#fff6a0", "#ffb21a"], 90)}" stroke="#140600" stroke-width="3" stroke-linejoin="round" filter="${s.glow(5, "#ffd23a", 0.9)}"/>`;
  const logo = `${bolt}${wordmark(
    s,
    [
      { t: "ARENA", size: 56 },
      { t: "BLITZ", size: 56, dy: 54 },
    ],
    150,
    104,
    { font: "Black Ops One", size: 56, face: [[0, "#fff6c8"], [0.45, "#ffb02e"], [1, "#ff3a1a"]], outline: "#140600", outlineW: 0.14, depth: 6, extrude: "#3a0a00", rim: "#fff2c0", rimW: 0.04, bevel: 0.9, rot: -5, tracking: 1 },
  )}`;
  return finish(s, { art, logo, focus: [cx, 180, 170], bloom: 0.12, tone: false });
}

/* ───────────── Castle Siege (painterly) ───────────── */

function castleSiege(): Art {
  const s = new Scene("castle-clash");
  const paint = s.id("pt");
  s.def(
    `<filter id="${paint}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035 .06" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`,
  );
  let clouds = "";
  for (let i = 0; i < 26; i++) {
    const y = 20 + s.r() * 150;
    const warm = y > 90;
    clouds += `<ellipse cx="${f(s.r() * W)}" cy="${f(y)}" rx="${f(50 + s.r() * 90)}" ry="${f(6 + s.r() * 14)}" fill="${warm ? (s.r() > 0.5 ? "#ffb070" : "#ff7a5a") : s.r() > 0.5 ? "#6a4a8a" : "#9a5a8a"}" opacity="${f(0.35 + s.r() * 0.4)}"/>`;
  }
  const castle =
    "M300 214V150H292V138H300V132H308V138H316V132H324V150H336V120H330V108H338V102H346V108H354V102H362V120H356V150H372V138H380V132H388V138H396V132H404V138H412V214ZM338 102L346 72 354 102Z";
  const boulder = (x: number, y: number, r: number, tx: number, ty: number) =>
    `<path d="M${x} ${y}Q${f((x + tx) / 2)} ${f(Math.min(y, ty) - 40)} ${tx} ${ty}" stroke="${s.lin([[0, "#ffb347", 0], [1, "#ffe08a", 0.9]], 0)}" stroke-width="${r * 1.2}" fill="none" stroke-linecap="round" filter="${s.blur(2.5)}"/>${orb(s, tx, ty, r, { base: "#ff7a1a", light: "#fff3a0", dark: "#a02a00", shadow: 0 })}`;
  const flag = (x: number, y: number, c: string, k = 1) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-1.5" y="-60" width="3" height="62" fill="#1a0a10"/><path d="M1.5 -58Q16 -62 30 -54Q16 -48 1.5 -44Z" fill="${c}"/></g>`;
  const catapult = `<g transform="translate(110 320)" fill="#12060c"><path d="M-40 0H40L34 -10H-34Z"/><path d="M-26 -10L-6 -44 0 -40 -18 -10Z"/><path d="M26 -10L6 -44 0 -40 18 -10Z"/><path d="M-4 -42L-56 -86 -52 -90 2 -46Z"/><circle cx="-56" cy="-90" r="8"/><circle cx="-28" cy="0" r="9"/><circle cx="28" cy="0" r="9"/></g>`;
  const art = `
<g filter="url(#${paint})">
<rect width="${W}" height="${H}" fill="${s.lin(["#2a1a4a", "#6a2a5a", "#d8564a", "#ffb06a", "#ffd89a"], 90)}"/>
${glowAt(s, 470, 190, 240, "#ffd08a", 0.8)}
<g filter="${s.blur(4)}">${clouds}</g>
<path d="M0 230L60 200 130 214 200 186 270 206 340 190 420 214 500 196 580 210 640 196V360H0Z" fill="#8a5a8a" opacity=".85"/>
<path d="M0 252L80 232 160 246 250 226 330 244 420 230 520 248 640 232V360H0Z" fill="#5a3a6a"/>
<path d="M230 360L262 252 290 214H424L446 240 470 300 520 360Z" fill="#2a1a2e"/>
<g transform="translate(356 214) scale(1.35) translate(-356 -214)"><path d="${castle}" fill="#ff9a5a" transform="translate(-2 -1)" opacity=".8"/><path d="${castle}" fill="#1e1022"/>
${[[318, 160], [344, 130], [392, 170], [360, 190], [304, 190]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="9" rx="2.5" fill="#ffd27a" filter="${s.glow(2, "#ff9a3a", 1)}"/>`).join("")}</g>
${glowAt(s, 410, 120, 80, "#ff6a1a", 0.9)}
<path d="M398 128q4 -24 12 -32q2 14 10 17q2 -12 8 -17q6 20 -4 36Z" fill="#ffb347" filter="${s.glow(3, "#ff5a1a", 1)}"/>
<g filter="${s.blur(6)}" opacity=".7">${[0, 1, 2, 3].map((i) => `<circle cx="${416 + i * 14}" cy="${88 - i * 22}" r="${12 + i * 8}" fill="#3a2a3a"/>`).join("")}</g>
${boulder(120, 250, 9, 278, 104)}${boulder(70, 280, 7, 226, 150)}
<path d="M0 360V300C80 284 170 290 240 306S320 340 340 360Z" fill="#12060c"/>
<path d="M470 360C500 320 560 300 640 296V360Z" fill="#12060c"/>
${flag(200, 318, "#c8102e")}${flag(236, 326, "#1a4ac8", 0.8)}${flag(560, 304, "#c8102e", 0.9)}${flag(600, 300, "#e8b21a", 0.8)}
${catapult}
</g>
${embers(s, 34, [200, 80, 300, 220], "#ff8a3a")}`;
  const logo = wordmark(
    s,
    [
      { t: "Castle", size: 60 },
      { t: "Siege", size: 70, dy: 56, dx: 18 },
    ],
    150,
    78,
    { font: "Pirata One", size: 60, face: [[0, "#ffffff"], [0.4, "#dfe5ee"], [0.6, "#8a94a6"], [1, "#4a5266"]], outline: "#1a0505", outlineW: 0.14, depth: 5, extrude: "#0a0202", rim: "#ff9a3a", rimW: 0.05, bevel: 1, glow: "#ff4a1a", rot: -4 },
  );
  return finish(s, { art, logo, focus: [356, 170, 190], bloom: 0.14 });
}

/* ───────────── Island Village (isometric) ───────────── */

function islandVillage(): Art {
  const s = new Scene("island-village");
  const iso = { ox: 360, oy: 92, u: 25 };
  const N = 10;
  const land: boolean[][] = [];
  for (let y = 0; y < N; y++) {
    land.push([]);
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - 4.5, y - 4.5) + Math.sin(x * 1.7 + y) * 0.6;
      land[y].push(d < 4.6);
    }
  }
  const isEdge = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !land[y + dy]?.[x + dx]);
  const hut = (x: number, y: number, wall: string, roof: [string, string]) =>
    `${isoBox(iso, x + 0.2, y + 0.2, 0.6, 0.6, 0.7, [wall, shade(wall, -0.15), shade(wall, -0.3)], 0.5)}${isoRoof(iso, x + 0.2, y + 0.2, 0.6, 0.6, 1.2, 0.6, roof, 0.12)}`;
  const items: Record<string, string> = {};
  const put = (x: number, y: number, svg: string) => {
    items[`${x},${y}`] = (items[`${x},${y}`] ?? "") + svg;
  };
  put(3, 3, hut(3, 3, "#f2d2a0", ["#e0a040", "#b07020"]));
  put(5, 2, hut(5, 2, "#ffe0b8", ["#d8603a", "#a83a1a"]));
  put(6, 5, hut(6, 5, "#f6e2c0", ["#3ab0a0", "#1a7a70"]));
  put(2, 6, hut(2, 6, "#f2d2a0", ["#e0a040", "#b07020"]));
  put(4, 5, isoBox(iso, 4.1, 5.1, 0.8, 0.8, 0.1, ["#c89a5a", "#9a6a3a", "#7a4a2a"], 0.5) + Array.from({ length: 4 }, (_, i) => isoBox(iso, 4.15 + i * 0.2, 5.15, 0.1, 0.7, 0.15, ["#7ad04a", "#4a9a2a", "#3a7a1a"], 0.6)).join(""));
  put(7, 3, isoBox(iso, 7.3, 3.3, 0.4, 0.4, 2.2, ["#ffffff", "#e0e6ee", "#c0c8d4"], 0.5) + isoBox(iso, 7.3, 3.3, 0.4, 0.4, 0.4, ["#ff4a3a", "#d0302a", "#a0201a"], 1.3) + isoRoof(iso, 7.3, 3.3, 0.4, 0.4, 2.7, 0.5, ["#ff4a3a", "#c0201a"], 0.08));
  const bushes: [number, number, string][] = [[4, 2, "#3fae3a"], [2, 4, "#5ac83a"], [6, 7, "#3fae3a"], [5, 4, "#ff7ab0"], [3, 7, "#ffd23a"], [8, 5, "#5ac83a"], [4, 8, "#3fae3a"]];
  for (const [x, y, c] of bushes) {
    const [bx, by] = isoP(iso, x + 0.5, y + 0.5, 0.5);
    put(x, y, orb(s, bx, by - 6, c === "#3fae3a" || c === "#5ac83a" ? 9 : 5, { base: c, shadow: 0.25 }));
  }
  const palms: [number, number][] = [[2, 3], [5, 7], [7, 6], [3, 1], [1, 5], [6, 1]];
  for (const [x, y] of palms) {
    const [sx, sy] = isoP(iso, x + 0.5, y + 0.5, 0.5);
    put(x, y, palm(s, sx, sy, 0.32, x % 2 === 0));
  }
  let tiles = "";
  for (let sum = 0; sum < 2 * N; sum++)
    for (let x = 0; x < N; x++) {
      const y = sum - x;
      if (y < 0 || y >= N || !land[y][x]) continue;
      const edge = isEdge(x, y);
      tiles += edge
        ? isoBox(iso, x, y, 1, 1, 0.4, ["#ffe6a8", "#e0b870", "#c09a58"])
        : isoBox(iso, x, y, 1, 1, 0.5, [(x + y) % 2 ? "#7ad04a" : "#86da52", "#c09a58", "#a07a40"]);
      tiles += items[`${x},${y}`] ?? "";
    }
  const [dx0, dy0] = isoP(iso, 8.6, 6.5, 0.3);
  const dock = isoBox(iso, 8.8, 6.2, 1.8, 0.6, 0.1, ["#c08a4a", "#8a5a2a", "#6a4a2a"], 0.25);
  const boat = `<g transform="translate(${f(dx0 + 70)} ${f(dy0 + 40)})"><path d="M-22 0H22L14 10H-14Z" fill="#ffffff" stroke="#1a4a6a" stroke-width="1.2"/><path d="M0 0V-30L16 -4Z" fill="#ff6a4a"/></g>`;
  let waves = "";
  for (let i = 0; i < 40; i++) {
    const x = s.r() * W;
    const y = s.r() * H;
    waves += `<path d="M${f(x)} ${f(y)}q6 -4 12 0t12 0" stroke="#fff" stroke-opacity="${f(0.25 + s.r() * 0.35)}" stroke-width="1.6" fill="none"/>`;
  }
  const [cx, cy] = isoP(iso, 5, 5, 0);
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#3ad6f0", "#0aa0d0", "#0870b0"], 90)}"/>
${waves}
<ellipse cx="${cx}" cy="${f(cy + 8)}" rx="220" ry="120" fill="#8ff6ff" opacity=".55" filter="${s.blur(18)}"/>
<ellipse cx="${cx}" cy="${f(cy + 14)}" rx="190" ry="100" fill="#000" opacity=".12" filter="${s.blur(10)}"/>
<ellipse cx="${cx}" cy="${f(cy + 12)}" rx="226" ry="124" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="3" stroke-dasharray="14 10" filter="${s.blur(1.5)}"/>
${[[110, 300, 0], [560, 300, 1], [600, 150, 0]].map(([x, y, flip]) => `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)" opacity=".55"><path d="M0 0q10 -7 20 0q-10 7 -20 0Zm20 0l7 -5v10Z" fill="#0a5a8a"/></g>`).join("")}
${dock}${tiles}${boat}
${sparkles(s, 10, [0, 0, W, H], "#ffffff", 6)}`;
  const logo = wordmark(
    s,
    [
      { t: "Island", size: 52 },
      { t: "Village", size: 52, dy: 50, dx: 18 },
    ],
    120,
    74,
    { font: "Fredoka", weight: 700, size: 52, face: [[0, "#ffffff"], [0.45, "#fff3a0"], [1, "#ffb21a"]], outline: "#04506a", outlineW: 0.18, depth: 6, extrude: "#023040", rim: "#ffffff", rimW: 0.07, bevel: 0.8, rot: -5 },
  );
  return finish(s, { art, logo, focus: [cx, cy - 20, 200], bloom: 0.1 });
}

/* ───────────── Checkers Club (tabletop 3D) ───────────── */

function checkersClub(): Art {
  const s = new Scene("checkers-club");
  const back = { y: 168, l: 190, r: 450 };
  const front = { y: 360, l: 30, r: 610 };
  const P = (u: number, v: number): [number, number] => {
    const t = v ** 1.18;
    return [lerp(lerp(back.l, back.r, u), lerp(front.l, front.r, u), t), lerp(back.y, front.y, t)];
  };
  const quad = (u0: number, v0: number, u1: number, v1: number) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  let squares = "";
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) squares += `<polygon points="${quad(i / 8, j / 8, (i + 1) / 8, (j + 1) / 8)}" fill="${(i + j) % 2 ? "#3a1f12" : "#f0d6a8"}"/>`;
  const piece = (i: number, j: number, red: boolean, king = false, lift = 0) => {
    const [x, y] = P((i + 0.5) / 8, (j + 0.5) / 8);
    const scale = lerp(0.55, 1.25, j / 7);
    const r = 15 * scale;
    const h = 7 * scale;
    const top = y - h - lift;
    const base = red ? "#d6202a" : "#2a2a30";
    const side = s.lin([shade(base, -0.4), shade(base, 0.1), shade(base, -0.5)], 0);
    let out = lift ? `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.45)}" fill="#000" opacity=".35" filter="${s.blur(4)}"/>` : `<ellipse cx="${f(x + 2)}" cy="${f(y + 2)}" rx="${f(r * 1.05)}" ry="${f(r * 0.5)}" fill="#000" opacity=".45" filter="${s.blur(2)}"/>`;
    out += `<path d="M${f(x - r)} ${f(top)}V${f(top + h)}A${r} ${f(r * 0.45)} 0 0 0 ${f(x + r)} ${f(top + h)}V${f(top)}Z" fill="${side}"/><ellipse cx="${x}" cy="${f(top)}" rx="${r}" ry="${f(r * 0.45)}" fill="${s.lin([shade(base, 0.35), base], 90)}"/><ellipse cx="${x}" cy="${f(top)}" rx="${f(r * 0.68)}" ry="${f(r * 0.3)}" fill="none" stroke="${shade(base, -0.35)}" stroke-width="${f(1.4 * scale)}"/><ellipse cx="${f(x - r * 0.35)}" cy="${f(top - r * 0.12)}" rx="${f(r * 0.32)}" ry="${f(r * 0.1)}" fill="#fff" opacity=".55" filter="${s.blur(0.8)}"/>`;
    if (king) out += `<path d="M${f(x - 7 * scale)} ${f(top + 2 * scale)}l-1 ${f(-7 * scale)} 4 ${f(3 * scale)} 4 ${f(-5 * scale)} 4 ${f(5 * scale)} 4 ${f(-3 * scale)} -1 ${f(7 * scale)}Z" fill="${s.lin(["#fff3a0", "#e0a010"], 90)}" stroke="#7a4a00" stroke-width=".8"/>`;
    return out;
  };
  let pieces = "";
  const layout: [number, number, boolean, boolean?][] = [
    [1, 0, false], [3, 0, false], [5, 0, false], [7, 0, false], [0, 1, false], [4, 1, false], [6, 1, false], [3, 2, false], [5, 2, false],
    [2, 5, true], [4, 5, true], [0, 5, true], [1, 6, true], [5, 6, true], [7, 6, true], [0, 7, true], [6, 7, true], [2, 3, true, true],
  ];
  for (const [i, j, red, king] of layout.sort((a, b) => a[1] - b[1])) pieces += piece(i, j, red, king);
  const [jx, jy] = P(4.5 / 8, 3.5 / 8);
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#2a1408", "#5a2a10", "#8a4a1a"], 90)}"/>
${bokeh(s, 30, ["#ffcf7a", "#ff9a4a", "#fff0c0"], [0, 0, W, 170], 20)}
${glowAt(s, 320, 60, 300, "#ffcf7a", 0.45)}
<path d="M0 190H640V360H0Z" fill="${s.lin(["#7a3a14", "#4a200a"], 90)}"/>
<polygon points="${[P(-0.06, -0.06), P(1.06, -0.06), P(1.06, 1.1), P(-0.06, 1.1)].map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${s.lin(["#c07a3a", "#7a3a14"], 90)}" stroke="#3a1a08" stroke-width="2" filter="${s.shadow(8, 8, "#000", 0.5)}"/>
${squares}
<polygon points="${quad(0, 0, 1, 1)}" fill="none" stroke="#2a1006" stroke-width="2"/>
<polygon points="${quad(0, 0, 1, 1)}" fill="${s.lin([[0, "#fff", 0.18], [0.5, "#fff", 0], [1, "#000", 0.15]], 90)}"/>
${pieces}
<path d="M${f(jx - 60)} ${f(jy + 30)}Q${f(jx - 30)} ${f(jy - 60)} ${f(jx)} ${f(jy - 40)}" stroke="#fff" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" fill="none" opacity=".85"/>
${piece(4, 3, true, false, 40)}
${sparkles(s, 8, [jx - 40, jy - 90, 80, 60], "#fff6d0", 7)}`;
  const logo = wordmark(
    s,
    [{ t: "Checkers Club", size: 50 }],
    320,
    96,
    { font: "Paytone One", size: 50, face: [[0, "#ffffff"], [0.5, "#ffe0d8"], [1, "#ff4a3a"]], outline: "#2a0404", outlineW: 0.16, depth: 6, extrude: "#140202", rim: "#ffffff", rimW: 0.05, bevel: 0.8, arc: 7 },
  );
  return finish(s, { art, logo, focus: [320, 270, 180], bloom: 0.1 });
}

/* ───────────── Solitaire Social (green felt) ───────────── */

function avatar(s: Scene, x: number, y: number, r: number, skin: string, hair: string, ring: string, badge: string) {
  const clip = s.clip(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
  return `<g filter="${s.shadow(3, 4, "#000", 0.4)}"><circle cx="${x}" cy="${y}" r="${r + 3}" fill="${ring}"/><g clip-path="${clip}"><rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="${s.lin(["#bfe6ff", "#7ab8ff"], 90)}"/><ellipse cx="${x}" cy="${f(y + r * 0.95)}" rx="${f(r * 0.75)}" ry="${f(r * 0.5)}" fill="${ring}"/>${orb(s, x, y - r * 0.05, r * 0.5, { base: skin, shadow: 0, gloss: 0.3 })}<path d="M${f(x - r * 0.55)} ${f(y - r * 0.05)}Q${f(x - r * 0.5)} ${f(y - r * 0.75)} ${x} ${f(y - r * 0.68)}Q${f(x + r * 0.55)} ${f(y - r * 0.7)} ${f(x + r * 0.55)} ${f(y - r * 0.05)}Q${f(x + r * 0.3)} ${f(y - r * 0.45)} ${x} ${f(y - r * 0.4)}Q${f(x - r * 0.35)} ${f(y - r * 0.4)} ${f(x - r * 0.55)} ${f(y - r * 0.05)}Z" fill="${hair}"/>${face(s, x, y + r * 0.02, r / 70, { blush: false })}</g></g><circle cx="${f(x + r * 0.72)}" cy="${f(y + r * 0.72)}" r="${f(r * 0.32)}" fill="${badge === "heart" ? "#f02849" : "#0866ff"}" stroke="#fff" stroke-width="2"/>${badge === "heart" ? `<path d="M${f(x + r * 0.72)} ${f(y + r * 0.86)}l-5 -5a3 3 0 0 1 5 -4a3 3 0 0 1 5 4Z" fill="#fff"/>` : `<path d="M${f(x + r * 0.62)} ${f(y + r * 0.82)}v-6h2l3 -5q2 0 1 4h3q1 1 0 2l-1 5h-8Z" fill="#fff"/>`}`;
}

function solitaireSocial(): Art {
  const s = new Scene("solitaire-social");
  const felt = s.id("fe");
  s.def(
    `<filter id="${felt}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 .1  0 0 0 0 0  0 0 0 .55 0"/></filter>`,
  );
  let tableau = "";
  const suits = ["spade", "heart", "club", "diamond"] as const;
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  for (let c = 0; c < 7; c++) {
    const x = 92 + c * 62;
    for (let k = 0; k < c; k++) tableau += playingCard(s, x, 170 + k * 9, 0.82, 0, "", "spade", { back: "#1a5ad8", shadow: 0.3 });
    for (let k = 0; k < 2; k++)
      tableau += playingCard(s, x, 170 + c * 9 + k * 22, 0.82, 0, ranks[(c * 3 + k * 5 + 4) % 13], suits[(c + k) % 4], { shadow: 0.3 });
  }
  let hearts = "";
  for (let i = 0; i < 9; i++) {
    const x = 470 + s.r() * 150;
    const y = 120 + s.r() * 200;
    const k = 0.5 + s.r() * 0.7;
    hearts += `<path d="M0 6C-6 0 -12 -4 -12 -9c0-4 3-7 6-7 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 3 6 7 0 5-6 9-12 15Z" fill="${["#f02849", "#ff6a8a", "#ffd23a"][i % 3]}" transform="translate(${f(x)} ${f(y)}) scale(${f(k)}) rotate(${f((s.r() - 0.5) * 40)})" opacity=".95"/>`;
  }
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#22a862", "#0d6a38", "#063a1e"], 0.4, 0.45, 0.85)}"/>
<rect width="${W}" height="${H}" filter="url(#${felt})" style="mix-blend-mode:multiply"/>
${glowAt(s, 260, 120, 280, "#c8ffd8", 0.25)}
${tableau}
${playingCard(s, 520, 120, 1, 14, "K", "heart")}
${hearts}
${avatar(s, 566, 196, 30, "#f2c29a", "#3a2416", "#ffd23a", "heart")}
${avatar(s, 508, 270, 26, "#c88a5a", "#1a1010", "#3ad08a", "like")}
${avatar(s, 590, 300, 24, "#ffd8b8", "#e0a040", "#ff7a9a", "heart")}
<g filter="${s.shadow(3, 4, "#000", 0.35)}"><rect x="436" y="190" width="98" height="30" rx="15" fill="#fff"/><path d="M520 216l12 10-2-12Z" fill="#fff"/><text x="485" y="210" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="12" fill="#1c1e21">Nice move!</text></g>`;
  const logo = wordmark(
    s,
    [
      { t: "Solitaire", size: 48 },
      { t: "Social", size: 48, dy: 46, dx: 26, face: [[0, "#ffffff"], [0.5, "#d8ecff"], [1, "#4a9aff"]] },
    ],
    170,
    66,
    { font: "Poppins", weight: 800, size: 48, face: [[0, "#ffffff"], [0.5, "#fff3c0"], [1, "#ffc21a"]], outline: "#06204a", outlineW: 0.16, depth: 5, extrude: "#02102a", rim: "#ffffff", rimW: 0.05, bevel: 0.6, rot: -4, tracking: -1 },
  );
  return finish(s, { art, logo, focus: [556, 240, 170], bloom: 0.1 });
}

export const STYLED_SCENES: Record<string, () => Art> = {
  "brick-burst": brickBurst,
  "snake-trail": snakeTrail,
  "arena-blitz": arenaBlitz,
  "castle-clash": castleSiege,
  "island-village": islandVillage,
  "checkers-club": checkersClub,
  "solitaire-social": solitaireSocial,
};
