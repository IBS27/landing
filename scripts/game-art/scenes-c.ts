import {
  type Art,
  ball,
  bokeh,
  bubble,
  card,
  chibi,
  cloud,
  coin,
  embers,
  finish,
  gem,
  grassTufts,
  H,
  hill,
  lightWash,
  logo,
  palm,
  pine,
  rays,
  Scene,
  shade,
  sky,
  sparkles,
  sun,
  tree,
  vignette,
  W,
} from "./kit";
import { locomotive, tower } from "./props";

function jungleTrek() {
  const s = new Scene("jungle-trek");
  const leaf = (x: number, y: number, k: number, rot: number, c: string) =>
    `<path d="M0 0C20 -30 60 -36 90 -20C60 -10 30 0 0 0Z" fill="${c}" transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"/>`;
  const temple = `<g transform="translate(330 250)">
${[0, 1, 2, 3].map((i) => `<rect x="${-130 + i * 26}" y="${-i * 40}" width="${260 - i * 52}" height="40" fill="${s.lin(["#b9a37a", "#7d6a48"], 90)}"/><path d="M${-130 + i * 26} ${-i * 40}h${260 - i * 52}" stroke="#d8c8a0" stroke-width="3"/>`).join("")}
<rect x="-20" y="-150" width="40" height="34" fill="#2a2116"/>
<rect x="-24" y="-40" width="48" height="40" fill="#1e170e"/>
${[-90, 90].map((x) => `<path d="M${x} 0v-30" stroke="#5a4a30" stroke-width="10"/>`).join("")}
</g>`;
  const art = `
${sky(s, ["#bfe9c9", "#e9f7d6", "#fff3c4"])}
${rays(s, 330, 0, "#fff6c8", 7, 0.35)}
<path d="M520 60C540 120 530 200 560 300" stroke="#cfefff" stroke-width="26" fill="none" opacity=".75"/>
<path d="M520 60C540 120 530 200 560 300" stroke="#fff" stroke-width="8" fill="none" opacity=".7" stroke-dasharray="20 12"/>
${hill(s, [180, 150, 170, 140, 160, 150, 170], "#5fae6a", "#2d6b3c")}
${temple}
${tree(s, 150, 260, 1.1, "#1f5a2c", "#5fb04a")}${tree(s, 520, 270, 1.2, "#1f5a2c", "#5fb04a")}
${hill(s, [300, 290, 296, 286, 298, 290, 300], "#4f9a3a", "#1f5a24")}
${chibi(s, 420, 352, 1.0, { hat: "safari", hatColor: "#c9a26a", style: "short", hair: "#5a3416", shirt: "#d9a441", shirt2: "#7a5a2a", mouth: "grin", skin: "#e8b48a" })}
${[
  [0, 40, 1.6, 30, "#2f8a3a"],
  [0, 120, 1.4, 10, "#3fa34d"],
  [0, 300, 1.8, -20, "#1f6b2c"],
  [640, 60, 1.6, 150, "#2f8a3a"],
  [640, 200, 1.5, 175, "#3fa34d"],
  [640, 330, 1.8, 200, "#1f6b2c"],
  [120, 360, 1.4, -60, "#3fa34d"],
]
  .map(([x, y, k, r, c]) => leaf(x as number, y as number, k as number, r as number, c as string))
  .join("")}
${palm(s, 60, 360, 0.9)}
${embers(s, 24, [0, 0, W, H], "#fff6c8")}`;
  const mark = logo(s, ["Jungle", "Trek 2"], 170, 70, { size: 40, fill: ["#fff6c8", "#7ed957"], stroke: "#173b12", rim: "#ffb020", rot: -5 });
  return finish(s, { art, logo: mark, focus: [410, 250, 200] });
}

function railCity() {
  const s = new Scene("rail-city");
  const skyline = Array.from({ length: 16 }, (_, i) => {
    const x = 300 + i * 22;
    const h = 40 + ((i * 41) % 90);
    return `<rect x="${x}" y="${200 - h}" width="20" height="${h}" fill="${s.lin(["#7aa7d9", "#4a76b0"], 0)}"/>${Array.from({ length: Math.floor(h / 14) }, (_, j) => `<rect x="${x + 4}" y="${206 - h + j * 14}" width="4" height="6" fill="#ffe9a0" opacity=".8"/><rect x="${x + 12}" y="${206 - h + j * 14}" width="4" height="6" fill="#ffe9a0" opacity=".5"/>`).join("")}`;
  }).join("");
  const art = `
${sky(s, ["#3f8fe0", "#8fcaf5", "#ffe7b8"])}
${sun(s, 520, 70, 22)}
${cloud(s, 140, 60, 0.85)}${cloud(s, 400, 44, 0.6)}
<path d="M0 190L60 120L110 160L170 90L240 150L300 120V360H0Z" fill="${s.lin(["#e09a5a", "#a8582a"], 90)}"/>
<path d="M60 120L80 140L100 132L110 160M170 90L190 120L210 110" stroke="#ffd3a0" stroke-width="3" fill="none" opacity=".6"/>
${skyline}
<path d="M0 220H640V360H0Z" fill="${s.lin(["#c46a32", "#7a3a18"], 90)}"/>
<path d="M0 230H640" stroke="#e09a5a" stroke-width="4" opacity=".6"/>
<path d="M60 246H600V256H60Z" fill="#5a2e14"/>
${Array.from({ length: 9 }, (_, i) => `<path d="M${80 + i * 62} 256V360" stroke="${s.lin(["#8a4a22", "#4a240e"], 0)}" stroke-width="14"/><path d="M${80 + i * 62} 256l31 40l31 -40" stroke="#5a2e14" stroke-width="5" fill="none"/>`).join("")}
<path d="M40 238H620" stroke="#3a3a44" stroke-width="5"/><path d="M40 246H620" stroke="#5a5a66" stroke-width="3"/>
${locomotive(s, 520, 238, 0.95, "#d63a2f")}
<g transform="translate(118 238) scale(.95)"><rect x="-120" y="-70" width="110" height="52" rx="6" fill="${s.lin(["#2fa8e0", "#1b6fa8"], 90)}"/>${[0, 1, 2, 3].map((i) => `<rect x="${-110 + i * 26}" y="-60" width="18" height="18" rx="3" fill="#ffe9a0"/>`).join("")}<circle cx="-96" cy="-14" r="12" fill="#1b1d22"/><circle cx="-34" cy="-14" r="12" fill="#1b1d22"/></g>
${Array.from({ length: 7 }, (_, i) => `<circle cx="${380 - i * 30 + s.r() * 10}" cy="${80 - i * 8 + s.r() * 10}" r="${18 + i * 6}" fill="#fff" opacity="${(0.85 - i * 0.1).toFixed(2)}"/>`).join("")}
${lightWash(s, 520, 70, 300, "#fff3c0", 0.35)}`;
  const mark = logo(s, ["Rail City"], 150, 320, { size: 44, fill: ["#ffffff", "#ffcf3d"], stroke: "#5a1a0a", rim: "#e8483b", rot: -4 });
  return finish(s, { art, logo: mark, focus: [420, 170, 200] });
}

function jigsawCalm() {
  const s = new Scene("jigsaw-calm");
  const piece = "M-28 -28h16a8 8 0 1 1 16 0h24v20a8 8 0 1 1 0 16v20H4a8 8 0 1 0 -16 0h-16v-20a8 8 0 1 0 0 -16Z";
  const scene = `
${sky(s, ["#ff9ec7", "#ffc6a8", "#ffe9c4"])}
${sun(s, 420, 120, 30, "#fff8e6", "#ffcf9e")}
<path d="M0 220L80 120L130 170L210 70L290 160L350 110L430 180L520 90L600 150L640 130V360H0Z" fill="${s.lin(["#a99be0", "#6f63b8"], 90)}"/>
<path d="M210 70L230 100L250 92L265 120M520 90L540 120L560 110" stroke="#fff" stroke-width="5" fill="none" opacity=".9"/>
${Array.from({ length: 12 }, (_, i) => pine(s, i * 58, 250 + (i % 3) * 6, 0.6, "#2e5a5a", "#5f9a8a")).join("")}
<rect y="250" width="${W}" height="110" fill="${s.lin(["#ffb3c7", "#9a7fd6", "#5a4aa8"], 90)}"/>
<path d="M380 250h80l40 110H340Z" fill="#fff3d0" opacity=".35" filter="${s.blur(5)}"/>
${Array.from({ length: 12 }, () => `<path d="M${(s.r() * W).toFixed(0)} ${(260 + s.r() * 90).toFixed(0)}h${(10 + s.r() * 30).toFixed(0)}" stroke="#fff" stroke-width="2" opacity=".4"/>`).join("")}`;
  const cut = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => `<path d="${piece}" transform="translate(${36 + c * 64} ${32 + r * 64})" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1.5"/>`).join(""),
  ).join("");
  const art = `
${scene}
${cut}
<path d="${piece}" transform="translate(484 288) scale(1.0)" fill="#3a2a5a" opacity=".5"/>
<g transform="translate(560 240) rotate(18) scale(1.25)" filter="${s.shadow(10, 8, "#000", 0.4)}"><path d="${piece}" fill="${s.lin(["#d8a8ff", "#7a63c8"], 90)}" stroke="#fff" stroke-width="1.5"/></g>
<g transform="translate(100 300) rotate(-14) scale(1.1)" filter="${s.shadow(8, 6, "#000", 0.35)}"><path d="${piece}" fill="${s.lin(["#ffd3a8", "#ff9ec7"], 90)}" stroke="#fff" stroke-width="1.5"/></g>
${sparkles(s, 10, [0, 0, W, H], "#fff", 6)}`;
  const mark = logo(s, ["Calm Jigsaw"], 160, 64, { size: 32, fill: ["#ffffff", "#ffe0f0"], stroke: "#5a2a6b", rim: "#ff9ec7", rot: -3 });
  return finish(s, { art, logo: mark, focus: [420, 200, 220] });
}

function wordGarden() {
  const s = new Scene("word-garden");
  const tile = (x: number, y: number, ch: string, rot: number, k = 1) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})" filter="${s.shadow(4, 3, "#3a2a10", 0.4)}"><rect x="-24" y="-24" width="48" height="48" rx="8" fill="${s.lin(["#fff6dc", "#f0d79c", "#d8b26a"], 90)}"/><rect x="-24" y="-24" width="48" height="48" rx="8" fill="none" stroke="#b8904a" stroke-width="2"/><text y="12" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="32" fill="#5a3a12">${ch}</text></g>`;
  const flower = (x: number, y: number, k: number, c: string) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0v40" stroke="#3a8f2a" stroke-width="4"/><ellipse cx="10" cy="24" rx="10" ry="4" fill="#5fbf3a" transform="rotate(-30 10 24)"/>${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="0" cy="-12" rx="7" ry="12" fill="${c}" transform="rotate(${a})"/>`).join("")}<circle r="7" fill="#ffcf3d"/></g>`;
  const art = `
${sky(s, ["#7fd0ff", "#c4ecff", "#f0fbff"])}
${cloud(s, 120, 50, 0.8)}${cloud(s, 520, 70, 0.7)}
${hill(s, [190, 170, 186, 166, 180, 172, 188], "#a5e36a", "#5aa83a")}
${tree(s, 70, 230, 1.0, "#2f7d32", "#9be15a")}${tree(s, 590, 226, 0.95, "#2f7d32", "#9be15a")}
${hill(s, [270, 260, 270, 258, 268, 262, 272], "#7cc44d", "#3d8a2c")}
${Array.from({ length: 14 }, (_, i) => flower(30 + i * 46 + s.r() * 10, 270 + s.r() * 30, 0.8 + s.r() * 0.4, ["#ff6b8a", "#c38bff", "#ffffff", "#ff9a3d"][i % 4])).join("")}
${grassTufts(s, 60, 300, 360)}
${tile(200, 200, "W", -8)}${tile(258, 190, "O", 4)}${tile(316, 196, "R", -3)}${tile(374, 188, "D", 7)}
${tile(230, 268, "G", 6, 0.9)}${tile(284, 274, "R", -5, 0.9)}${tile(338, 268, "O", 3, 0.9)}${tile(392, 276, "W", -6, 0.9)}
<g transform="translate(480 300)">${chibi(s, 0, 50, 0.7, { style: "pony", hair: "#c45a1a", shirt: "#4caf50", mouth: "open", wave: true })}</g>
${[
  [470, 120],
  [140, 140],
]
  .map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 0c-10 -10 -20 -4 -16 4c-8 2 -6 14 4 10c4 8 14 4 12 -4c8 -2 6 -14 0 -10Z" fill="#ffcf3d"/><path d="M0 0l3 10" stroke="#3a2416" stroke-width="2"/></g>`)
  .join("")}
${sparkles(s, 12, [160, 150, 280, 160], "#fffbe0", 8)}
${lightWash(s, 120, 40, 300, "#fff6d0", 0.35)}`;
  return finish(s, { art, focus: [300, 230, 200] });
}

function puckRush() {
  const s = new Scene("puck-rush");
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#0d1b3a", "#1f3a6e", "#3a5a96"], 90)}"/>
${Array.from({ length: 5 }, (_, i) => `<path d="M${80 + i * 120} 0L${40 + i * 120} 160L${140 + i * 120} 160Z" fill="#cfe6ff" opacity=".12" filter="${s.blur(6)}"/>`).join("")}
${bokeh(s, 40, ["#ffffff", "#9fd0ff", "#ffd36b"], [0, 20, W, 110], 6)}
<path d="M0 140H640V170H0Z" fill="${s.lin(["#ffffff", "#c9d6e6"], 90)}"/>
<path d="M0 150H640" stroke="#e8483b" stroke-width="4"/>
<path d="M0 170H640V360H0Z" fill="${s.lin(["#f4fbff", "#cfe6f5", "#a9cde6"], 90)}"/>
<path d="M0 260H640" stroke="#e8483b" stroke-width="6" opacity=".7"/>
<ellipse cx="320" cy="260" rx="90" ry="24" fill="none" stroke="#2f80ed" stroke-width="4" opacity=".7"/>
${Array.from({ length: 10 }, (_, i) => `<path d="M${120 + i * 26} ${300 - i * 4}l60 0" stroke="#fff" stroke-width="${8 - i * 0.6}" stroke-linecap="round" opacity="${(0.8 - i * 0.07).toFixed(2)}"/>`).join("")}
<g transform="translate(410 280)" filter="${s.shadow(8, 6, "#0d1b3a", 0.45)}"><ellipse cy="10" rx="44" ry="16" fill="#0b0b0f"/><rect x="-44" y="-6" width="88" height="16" fill="#16161c"/><ellipse cy="-6" rx="44" ry="16" fill="${s.lin(["#3a3a44", "#121218"], 90)}"/><ellipse cx="-14" cy="-10" rx="16" ry="4" fill="#fff" opacity=".2"/></g>
${chibi(s, 530, 344, 0.95, { hat: "helmet", style: "short", hair: "#3b2416", shirt: "#e8263a", mouth: "grin", item: `<g transform="translate(-40 -32) rotate(28)"><rect x="-5" y="-30" width="10" height="150" rx="4" fill="#d9a65a"/><path d="M-5 116h10l-46 22c-6 2 -10 -6 -4 -10Z" fill="#1b1d22"/></g>` })}
${Array.from({ length: 16 }, () => {
  const x = 380 + s.r() * 90;
  const y = 270 + s.r() * 40;
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + s.r() * 3).toFixed(1)}" fill="#fff"/>`;
}).join("")}
${lightWash(s, 320, 0, 400, "#dff0ff", 0.4)}`;
  const mark = logo(s, ["PUCK", "RUSH"], 150, 250, { size: 50, fill: ["#ffffff", "#7fd3ff"], stroke: "#0a1a3a", rim: "#e8483b", rot: -8, tracking: 2 });
  return finish(s, { art, logo: mark, focus: [420, 240, 180] });
}

function castleClash() {
  const s = new Scene("castle-clash");
  const castle = `<g transform="translate(400 250)">
<path d="M-120 0V-90H120V0Z" fill="${s.lin(["#8a93a8", "#4a5266"], 90)}"/>
${[-120, -80, -40, 0, 40, 80].map((x) => `<rect x="${x}" y="-104" width="24" height="16" fill="#8a93a8"/>`).join("")}
${tower(s, -130, 20, 0.6, "#7d8798")}${tower(s, 130, 20, 0.6, "#7d8798")}${tower(s, 0, -40, 0.5, "#8a93a8")}
<path d="M-24 0v-40a24 24 0 0 1 48 0v40Z" fill="#1a1410"/>
<path d="M-150 -168l20 -40 20 40Z M110 -168l20 -40 20 40Z" fill="#b3202a"/>
</g>`;
  const fireball = (x: number, y: number, k: number) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0C-40 -10 -90 6 -130 30C-90 20 -50 18 -10 18Z" fill="${s.lin([[0, "#ff6b1a", 0], [1, "#ffb347", 0.9]], 0)}"/><circle r="16" fill="${s.rad(["#fff8d0", "#ffcf3d", "#ff6b1a"], 0.4, 0.4, 0.6)}" filter="${s.glow(8, "#ff7a1a", 1)}"/></g>`;
  const art = `
${sky(s, ["#1a0f3a", "#5a2a6b", "#c4466a", "#ff9a5a"])}
<circle cx="140" cy="90" r="34" fill="#ffe7c4"/>
${cloud(s, 300, 60, 0.9, "#7a3a6a", 0.6)}
<path d="M0 260C100 200 220 210 320 230C420 200 540 190 640 220V360H0Z" fill="${s.lin(["#3a2a4a", "#1a1226"], 90)}"/>
${castle}
<path d="M0 300C140 280 300 300 640 290V360H0Z" fill="${s.lin(["#2a3a2a", "#0f1a12"], 90)}"/>
${fireball(330, 150, 1.0)}${fireball(520, 90, 0.7)}
<g transform="translate(110 300)"><path d="M-50 0h100l-10 -20h-80Z" fill="#6b3a1a"/><path d="M-30 -20L40 -110" stroke="#8a5a2a" stroke-width="10" stroke-linecap="round"/><circle cx="40" cy="-114" r="14" fill="#5a3a20"/><circle cx="-30" cy="0" r="14" fill="#3a2414"/><circle cx="30" cy="0" r="14" fill="#3a2414"/></g>
${embers(s, 50, [0, 80, W, 240], "#ff9a3d")}
${lightWash(s, 330, 150, 200, "#ffb347", 0.4)}`;
  const mark = logo(s, ["CASTLE", "CLASH"], 470, 300, { size: 40, fill: ["#fff3c4", "#ffb020"], stroke: "#2a0a0a", rim: "#c43a3a", rot: -3, tracking: 1 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.5)}${s.grain(0.08)}`, bloom: 0.3, focus: [400, 190, 220] });
}

function checkersClub() {
  const s = new Scene("checkers-club");
  // Board corners: far edge narrow, near edge wide (simple perspective).
  const at = (u: number, v: number): [number, number] => {
    const y = 104 + v * 250;
    const half = 150 + v * 175;
    return [320 + (u - 0.5) * 2 * half, y];
  };
  let board = "";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const v0 = (r / 8) ** 1.15;
      const v1 = ((r + 1) / 8) ** 1.15;
      const pts = [at(c / 8, v0), at((c + 1) / 8, v0), at((c + 1) / 8, v1), at(c / 8, v1)];
      board += `<path d="M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z" fill="${(r + c) % 2 ? s.lin(["#4a2614", "#2a1208"], 90) : s.lin(["#f4dcb4", "#d9b47e"], 90)}"/>`;
    }
  const piece = (r: number, c: number, red: boolean, king = false) => {
    const v = ((r + 0.5) / 8) ** 1.15;
    const [x, y] = at((c + 0.5) / 8, v);
    const k = 0.62 + v * 0.75;
    const col = red ? "#e8263a" : "#1e1e26";
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(2)})"><ellipse cy="10" rx="24" ry="9" fill="#000" opacity=".35"/><rect x="-22" y="-6" width="44" height="12" fill="${shade(col, -0.4)}"/><ellipse cy="6" rx="22" ry="9" fill="${shade(col, -0.4)}"/><ellipse cy="-6" rx="22" ry="9" fill="${s.lin([shade(col, 0.35), col], 90)}"/><ellipse cy="-6" rx="14" ry="5" fill="none" stroke="${shade(col, 0.5)}" stroke-width="2"/>${king ? `<path d="M-8 -10l-3 -10 6 4 5 -8 5 8 6 -4 -3 10Z" fill="#ffd36b"/>` : ""}</g>`;
  };
  const pieces = [
    [0, 1, false],
    [0, 3, false],
    [1, 2, false],
    [1, 6, false],
    [2, 5, false],
    [3, 4, true, true],
    [5, 2, true],
    [6, 1, true],
    [6, 5, true],
    [7, 4, true],
    [4, 3, false, true],
  ]
    .sort((a, b) => (a[0] as number) - (b[0] as number))
    .map(([r, c, red, k]) => piece(r as number, c as number, red as boolean, k as boolean))
    .join("");
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#7a3a1a", "#3a1a0c", "#140804"], 0.5, 0.3, 0.8)}"/>
${bokeh(s, 20, ["#ffcf7a", "#ff9a5a"], [0, 0, W, 120], 14)}
<path d="M${at(-0.04, -0.04).join(" ")}L${at(1.04, -0.04).join(" ")}L${at(1.04, 1.06).join(" ")}L${at(-0.04, 1.06).join(" ")}Z" fill="${s.lin(["#8a4a22", "#4a240e"], 90)}"/>
${board}
${pieces}
${lightWash(s, 320, 60, 360, "#ffd9a0", 0.4)}`;
  const mark = logo(s, ["Checkers", "Club"], 120, 70, { size: 34, fill: ["#ffffff", "#ffcf7a"], stroke: "#2a0f05", rim: "#e8263a", rot: -4 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.55)}${s.grain(0.08)}`, bloom: 0.3, focus: [320, 240, 220] });
}

function arenaBlitz() {
  const s = new Scene("arena-blitz");
  const blade = (glow: string) =>
    `<g transform="translate(40 -40) rotate(40)"><path d="M-5 0V-120L0 -134L5 -120V0Z" fill="#ffffff" filter="${s.glow(7, glow, 1)}"/><rect x="-16" y="-2" width="32" height="7" rx="3" fill="#ffd36b"/><rect x="-4" y="4" width="8" height="18" rx="3" fill="#3a2414"/></g>`;
  const fighter = (x: number, flip: boolean, shirt: string, glow: string, hat: "helmet" | "crown") =>
    `<g transform="translate(${x} 344) scale(${flip ? -1 : 1} 1)">${chibi(s, 0, 0, 1.15, { hat, style: "short", hair: "#2a1a10", shirt, mouth: "grin", eye: "#1a2a4a", item: blade(glow) })}</g>`;
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#3a1a5a", "#140a2a", "#05030d"], 0.5, 0.5, 0.8)}"/>
${rays(s, 320, 170, "#ff7ae0", 12, 0.25, 500)}
<path d="M0 280C120 260 520 260 640 280V360H0Z" fill="${s.lin(["#2a1a3a", "#0a0510"], 90)}"/>
<ellipse cx="320" cy="300" rx="260" ry="30" fill="none" stroke="#7a5cff" stroke-width="3" opacity=".5"/>
${fighter(170, false, "#3a6ad9", "#5ff2ff", "helmet")}
${fighter(470, true, "#d93a5a", "#ffb347", "crown")}
<circle cx="320" cy="168" r="80" fill="${s.radU([[0, "#ffffff", 1], [0.2, "#ffe0ff", 0.9], [0.5, "#ff5fd2", 0.5], [1, "#7a3aff", 0]], 320, 168, 80)}"/>
${Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return `<path d="M${(320 + Math.cos(a) * 30).toFixed(0)} ${(168 + Math.sin(a) * 30).toFixed(0)}L${(320 + Math.cos(a) * (70 + s.r() * 40)).toFixed(0)} ${(168 + Math.sin(a) * (70 + s.r() * 40)).toFixed(0)}" stroke="#fff" stroke-width="2" opacity=".7"/>`;
}).join("")}
${embers(s, 50, [100, 60, 440, 220], "#ff9ae8")}`;
  const mark = logo(s, ["ARENA", "BLITZ"], 320, 62, { size: 46, fill: ["#ffffff", "#ff5fd2"], stroke: "#1a0530", rim: "#5ff2ff", rot: -3, tracking: 2 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.5)}${s.grain(0.08)}`, bloom: 0.3, focus: [320, 190, 220] });
}

function bubblePop() {
  const s = new Scene("bubble-pop");
  const cols = ["#ff4d8d", "#ffd23f", "#3ddc97", "#4dabff", "#b26bff"];
  let grid = "";
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 13; c++) {
      if (r === 3 && c % 4 === 2) continue;
      grid += bubble(s, 26 + c * 48 + (r % 2) * 24, 26 + r * 42, 22, cols[(r * 3 + c * 2) % 5]);
    }
  const critter = `<g transform="translate(320 320)">
<ellipse cy="30" rx="70" ry="10" fill="#000" opacity=".25"/>
<path d="M-56 30C-60 -20 -40 -50 0 -52C40 -50 60 -20 56 30Z" fill="${s.rad(["#ffb3d9", "#ff6fae", "#c43a7a"], 0.4, 0.3, 0.75)}" stroke="#5a0f35" stroke-width="3"/>
<ellipse cx="-20" cy="-14" rx="12" ry="15" fill="#fff" stroke="#5a0f35" stroke-width="2"/><ellipse cx="20" cy="-14" rx="12" ry="15" fill="#fff" stroke="#5a0f35" stroke-width="2"/>
<circle cx="-18" cy="-10" r="7" fill="#2a1020"/><circle cx="22" cy="-10" r="7" fill="#2a1020"/><circle cx="-20" cy="-13" r="2.5" fill="#fff"/><circle cx="20" cy="-13" r="2.5" fill="#fff"/>
<path d="M-12 10q12 12 24 0Z" fill="#8b1a3a"/>
<path d="M-40 -44l-10 -24 22 14Z M40 -44l10 -24 -22 14Z" fill="#ff6fae" stroke="#5a0f35" stroke-width="3"/>
</g>`;
  const art = `
${sky(s, ["#4a2fa8", "#8a4fd6", "#ff8ad0"])}
${bokeh(s, 30, ["#ffffff", "#ffd23f", "#7ad8ff"], [0, 0, W, H], 12)}
${grid}
<path d="M320 280L420 160" stroke="#fff" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity=".9"/>
${bubble(s, 320, 250, 22, "#3ddc97")}
${critter}
${Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return `<circle cx="${(430 + Math.cos(a) * 34).toFixed(0)}" cy="${(150 + Math.sin(a) * 34).toFixed(0)}" r="${(3 + s.r() * 4).toFixed(1)}" fill="#ffd23f"/>`;
}).join("")}
${sparkles(s, 16, [0, 0, W, 200], "#fff", 8)}`;
  const mark = logo(s, ["Bubble Pop", "Party"], 140, 270, { size: 34, fill: ["#ffffff", "#ffd23f"], stroke: "#3a0f5a", rim: "#ff4d8d", rot: -6 });
  return finish(s, { art, logo: mark, focus: [320, 280, 150] });
}

function royal21() {
  const s = new Scene("royal-21");
  const crown = `<g transform="translate(320 140) scale(1.4)" filter="${s.glow(10, "#ffd36b", 0.6)}"><path d="M-60 20L-70 -40L-30 -10L0 -60L30 -10L70 -40L60 20Z" fill="${s.lin(["#fff3a8", "#ffcc33", "#c98a10"], 90)}" stroke="#7a4a00" stroke-width="3"/><rect x="-62" y="18" width="124" height="18" rx="4" fill="${s.lin(["#ffcc33", "#a86a0c"], 90)}" stroke="#7a4a00" stroke-width="3"/>${[-40, 0, 40].map((x) => `<circle cx="${x}" cy="27" r="5" fill="#e0245e"/>`).join("")}<circle cy="-60" r="6" fill="#3ddcff"/><circle cx="-70" cy="-40" r="5" fill="#3ddc97"/><circle cx="70" cy="-40" r="5" fill="#3ddc97"/></g>`;
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#a0142a", "#5a0814", "#1a0206"], 0.5, 0.4, 0.8)}"/>
${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 34} 0V${H}" stroke="#000" stroke-opacity=".12" stroke-width="10"/>`).join("")}
${rays(s, 320, 120, "#ffd36b", 12, 0.18, 500)}
${crown}
${card(s, 270, 270, 2.0, -12, "A", "spade")}
${card(s, 370, 266, 2.0, 10, "K", "heart")}
${coin(s, 140, 300, 30, 0.45, -10)}${coin(s, 120, 270, 26, 0.45, 8)}${coin(s, 500, 310, 32, 0.45, 6)}${coin(s, 540, 280, 24, 0.45, -12)}${coin(s, 470, 250, 20, 0.45, 20)}
${sparkles(s, 20, [80, 60, 480, 260], "#fff3c4", 9)}
${bokeh(s, 16, ["#ffd36b", "#ff9a5a"], [0, 0, W, H], 10)}`;
  const mark = logo(s, ["ROYAL 21"], 320, 62, { size: 42, fill: ["#fff8d0", "#ffc933"], stroke: "#3a0008", rim: "#ffffff", rot: 0, tracking: 3 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.55)}${s.grain(0.07)}`, bloom: 0.3, focus: [320, 210, 230] });
}

function snakeTrail() {
  const s = new Scene("snake-trail");
  const body = "M60 300C120 260 160 320 230 290C300 260 280 200 350 190C420 180 430 250 490 240";
  const art = `
${sky(s, ["#7ad3ff", "#c4f0ff", "#f0fff0"])}
${cloud(s, 140, 60, 0.8)}${cloud(s, 480, 50, 0.7)}
${hill(s, [190, 160, 180, 150, 176, 160, 186], "#a5e36a", "#5aa83a")}
${tree(s, 80, 220, 0.9, "#2f7d32", "#9be15a")}${palm(s, 600, 230, 0.6, true)}
${hill(s, [240, 230, 236, 226, 238, 232, 240], "#7cc44d", "#3d8a2c")}
${Array.from({ length: 8 }, (_, r) => Array.from({ length: 16 }, (_, c) => `<rect x="${c * 40}" y="${240 + r * 16}" width="40" height="16" fill="#000" opacity="${(r + c) % 2 ? 0.05 : 0}"/>`).join("")).join("")}
<path d="${body}" stroke="#1f6b2c" stroke-width="40" fill="none" stroke-linecap="round"/>
<path d="${body}" stroke="${s.linU(["#9be15a", "#3fa34d"], 0, 180, 0, 320)}" stroke-width="34" fill="none" stroke-linecap="round"/>
<path d="${body}" stroke="#ffe066" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="2 22" opacity=".9"/>
<path d="${body}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".25" transform="translate(-4 -8)"/>
<g transform="translate(500 236)"><ellipse rx="40" ry="32" fill="${s.rad(["#b5f06a", "#4caf50", "#1f6b2c"], 0.4, 0.3, 0.75)}" stroke="#14501f" stroke-width="3"/><ellipse cx="-12" cy="-14" rx="11" ry="13" fill="#fff" stroke="#14501f" stroke-width="2"/><ellipse cx="14" cy="-14" rx="11" ry="13" fill="#fff" stroke="#14501f" stroke-width="2"/><circle cx="-10" cy="-11" r="6" fill="#1a1a1a"/><circle cx="16" cy="-11" r="6" fill="#1a1a1a"/><circle cx="-12" cy="-14" r="2" fill="#fff"/><circle cx="14" cy="-14" r="2" fill="#fff"/><path d="M-10 10q12 10 24 0" stroke="#14501f" stroke-width="3" fill="none"/><path d="M36 6l20 4l-8 4l8 4l-20 -2Z" fill="#e8263a"/></g>
${[
  [580, 300],
  [150, 200],
  [380, 300],
]
  .map(([x, y]) => `<g transform="translate(${x} ${y})">${ball(s, 0, 0, 16, "#ff4d4d", "#a3141e", 0.7)}<path d="M0 -15q2 -8 6 -10" stroke="#5a3a1a" stroke-width="3" fill="none"/><path d="M4 -22q10 -6 14 2q-8 4 -14 -2Z" fill="#4caf50"/></g>`)
  .join("")}
${grassTufts(s, 40, 320, 360)}
${sparkles(s, 10, [0, 0, W, H], "#fff", 6)}`;
  const mark = logo(s, ["Snake", "Trail"], 150, 70, { size: 42, fill: ["#ffffff", "#7ed957"], stroke: "#0f3a12", rim: "#ffd23f", rot: -6 });
  return finish(s, { art, logo: mark, focus: [470, 240, 170] });
}

export const SCENES_C: Record<string, () => Art> = {
  "jungle-trek": jungleTrek,
  "rail-city": railCity,
  "jigsaw-calm": jigsawCalm,
  "word-garden": wordGarden,
  "puck-rush": puckRush,
  "castle-clash": castleClash,
  "checkers-club": checkersClub,
  "arena-blitz": arenaBlitz,
  "bubble-pop": bubblePop,
  "royal-21": royal21,
  "snake-trail": snakeTrail,
};

void H;
void gem;
void sun;
void chibi;
