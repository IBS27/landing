/**
 * One painted key-art scene per game in src/features/gaming/games.ts.
 * Each scene returns its art, an optional wordmark (covers only, never icons)
 * and the square the app icon is cropped from.
 */
import { SCENES_B } from "./scenes-b";
import { SCENES_C } from "./scenes-c";
import {
  ball,
  bokeh,
  card,
  chibi,
  cloud,
  embers,
  grassTufts,
  H,
  hill,
  lightWash,
  logo,
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
  finish,
  type Art,
} from "./kit";
import { cottage, tower } from "./props";

/* ───────────── Featured ───────────── */

function solitaireGrove() {
  const s = new Scene("solitaire-grove");
  const far = Array.from({ length: 16 }, (_, i) => pine(s, i * 44 - 10 + s.r() * 20, 196 + s.r() * 10, 0.55 + s.r() * 0.2, "#4b7f86", "#86b5b5")).join("");
  const mid = Array.from({ length: 9 }, (_, i) => pine(s, i * 80 + s.r() * 30, 222 + s.r() * 8, 0.8 + s.r() * 0.25, "#205c3a", "#4f9a5c")).join("");
  const art = `
${sky(s, ["#4fb3f0", "#9fdcff", "#e8f8ff"])}
${sun(s, 120, 52, 22)}
${rays(s, 120, 52, "#fff6c8", 8, 0.18)}
${cloud(s, 300, 60, 0.9)}${cloud(s, 520, 40, 0.7)}${cloud(s, 40, 110, 0.55)}
${far}
<rect y="190" width="${W}" height="40" fill="#cfe9f0" opacity=".25"/>
${mid}
${hill(s, [250, 236, 244, 232, 246, 238, 250], "#7cc44d", "#3d8a2c")}
${hill(s, [300, 286, 296, 300, 290, 300, 294], "#5fae3c", "#2c6e22")}
<path d="M300 360C310 320 330 300 344 286C352 280 362 278 372 280" stroke="#e6cf9c" stroke-width="26" fill="none" stroke-linecap="round" opacity=".9"/>
${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${318 + i * 10}" cy="${336 - i * 12}" rx="9" ry="5" fill="#cbb07a"/>`).join("")}
${cottage(s, 248, 268, 0.95, { wall: "#c98a4f", roof: "#3f8f4a", logs: true, glow: true })}
${tree(s, 40, 330, 1.35, "#1f6b2c", "#7fd14a")}
${tree(s, 150, 300, 0.85, "#2a7a34", "#9ade5a")}
${tree(s, 600, 330, 1.25, "#1f6b2c", "#7fd14a")}
${grassTufts(s, 70, 290, 360)}
${[
  [180, 320, "#ff6b8a"],
  [214, 334, "#ffd84d"],
  [430, 330, "#ffffff"],
  [460, 346, "#ff6b8a"],
  [120, 348, "#ffd84d"],
]
  .map(([x, y, c]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-4" rx="2.6" ry="4.2" fill="${c}" transform="rotate(${a})"/>`).join("")}<circle r="2" fill="#f5a623"/></g>`)
  .join("")}
${chibi(s, 214, 318, 0.42, { hair: "#7a3b12", style: "pony", shirt: "#3b82f6", wave: true, mouth: "open" })}
${card(s, 470, 300, 1.35, -24, "A", "spade")}
${card(s, 505, 292, 1.35, -8, "K", "heart")}
${card(s, 540, 294, 1.35, 8, "Q", "diamond")}
${card(s, 574, 306, 1.35, 22, "J", "club")}
${sparkles(s, 10, [420, 230, 200, 60], "#fffbe0", 7)}
${lightWash(s, 110, 40, 320, "#fff3c0", 0.35)}`;
  return finish(s, { art, focus: [320, 210, 210] });
}

function orchardFriends() {
  const s = new Scene("orchard-friends");
  const face = (x: number, y: number, r: number) =>
    `<g><ellipse cx="${x - r * 0.3}" cy="${y}" rx="${r * 0.14}" ry="${r * 0.18}" fill="#2b1608"/><ellipse cx="${x + r * 0.3}" cy="${y}" rx="${r * 0.14}" ry="${r * 0.18}" fill="#2b1608"/><circle cx="${x - r * 0.34}" cy="${y - r * 0.06}" r="${r * 0.05}" fill="#fff"/><circle cx="${x + r * 0.26}" cy="${y - r * 0.06}" r="${r * 0.05}" fill="#fff"/><path d="M${x - r * 0.2} ${y + r * 0.25}q${r * 0.2} ${r * 0.22} ${r * 0.4} 0" fill="#7a1d12" stroke="#2b1608" stroke-width="${r * 0.05}"/><ellipse cx="${x - r * 0.5}" cy="${y + r * 0.2}" rx="${r * 0.12}" ry="${r * 0.07}" fill="#ff8a8a" opacity=".7"/><ellipse cx="${x + r * 0.5}" cy="${y + r * 0.2}" rx="${r * 0.12}" ry="${r * 0.07}" fill="#ff8a8a" opacity=".7"/></g>`;
  const strawberry = (x: number, y: number, k: number) => {
    const body = s.rad(["#ff6b6b", "#e01e3c", "#9b0f24"], 0.38, 0.3, 0.75);
    const seeds = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return `<ellipse cx="${(Math.cos(a) * 18 * (0.5 + (i % 3) * 0.2)).toFixed(1)}" cy="${(Math.sin(a) * 16 * (0.5 + (i % 3) * 0.2) + 8).toFixed(1)}" rx="1.4" ry="2.2" fill="#ffe27a"/>`;
    }).join("");
    return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="44" rx="30" ry="6" fill="#000" opacity=".2"/><path d="M0 44C-30 30 -38 0 -32 -16C-26 -32 26 -32 32 -16C38 0 30 30 0 44Z" fill="${body}" stroke="#6b0a18" stroke-width="2.5"/>${seeds}<path d="M-22 -24l-8 -10 14 2 4 -12 10 10 10 -10 4 12 14 -2 -8 10Z" fill="#3fa34d" stroke="#1d5e27" stroke-width="2"/><ellipse cx="-14" cy="-12" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-30 -14 -12)"/>${face(0, 4, 26)}</g>`;
  };
  const apple = (x: number, y: number, k: number, c: string, d: string) =>
    `<g transform="translate(${x} ${y}) scale(${k})">${ball(s, 0, 0, 34, c, d, 0.7)}<path d="M0 -32q2 -14 8 -18" stroke="#5a3a1a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M6 -42q16 -10 24 2q-14 6 -24 -2Z" fill="#4caf50"/>${face(0, 4, 30)}</g>`;
  const fence = Array.from({ length: 15 }, (_, i) => `<path d="M${i * 46 - 6} 300v-74l12 -12 12 12v74Z" fill="${s.lin(["#fffaf0", "#e6d3b3"], 0)}" stroke="#b89b6c" stroke-width="2"/>`).join("");
  const art = `
${sky(s, ["#3aa8f5", "#8fd6ff", "#d9f4ff"])}
${sun(s, 560, 50, 20)}
${cloud(s, 120, 60, 0.85)}${cloud(s, 380, 34, 0.6)}
${hill(s, [210, 180, 196, 170, 190, 176, 200], "#9fe06a", "#55a83a")}
${tree(s, 90, 236, 0.9, "#2f8a3a", "#a5e36a")}
${tree(s, 520, 230, 1.0, "#2f8a3a", "#a5e36a")}
${[
  [70, 150],
  [104, 140],
  [500, 140],
  [540, 150],
  [520, 120],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#e8262f"/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="#fff" opacity=".6"/>`)
  .join("")}
<path d="M0 262h${W}v8H0Z" fill="#c9ab7c"/><path d="M0 236h${W}v8H0Z" fill="#c9ab7c"/>
${fence}
${hill(s, [300, 290, 300, 292, 300, 294, 300], "#6cc04a", "#2f7d2a")}
${grassTufts(s, 60, 300, 360, "#3a8f2a", "#9be15a")}
${apple(140, 300, 1.2, "#7ed957", "#2e8b2e")}
${strawberry(330, 290, 1.7)}
${apple(500, 304, 1.25, "#ff4d4d", "#a3141e")}
${ball(s, 236, 330, 18, "#ffb02e", "#d0680c")}
${ball(s, 420, 336, 16, "#a974ff", "#5b2bb5")}
${sparkles(s, 12, [60, 220, 520, 120], "#fff", 8)}
${lightWash(s, 560, 40, 300, "#fff8d0", 0.3)}`;
  const mark = logo(s, ["Orchard", "Friends"], 440, 128, { size: 46, fill: ["#fff36b", "#ff9a1f"], stroke: "#7a2e00", rim: "#ffffff", rot: -5 });
  return finish(s, { art, logo: mark, focus: [330, 270, 150] });
}

function towerLegends() {
  const s = new Scene("tower-legends");
  const sword = `<g transform="translate(372 186) rotate(30) scale(1.15)"><path d="M-6 -150L0 -168L6 -150V10H-6Z" fill="${s.lin(["#ffffff", "#bfe7ff", "#5aa9e6"], 0)}" filter="${s.glow(6, "#7fd0ff", 1)}"/><rect x="-26" y="8" width="52" height="10" rx="4" fill="${s.lin(["#ffe27a", "#c98a10"], 90)}"/><rect x="-5" y="18" width="10" height="34" rx="3" fill="#5a2d0c"/><circle cy="58" r="8" fill="#e0245e"/><rect x="-11" y="20" width="22" height="26" rx="8" fill="${s.lin(["#d9e2ee", "#55627a"], 0)}" stroke="#1d2433" stroke-width="2.5"/></g>`;
  const steel = s.lin(["#f2f6fb", "#a9b6c8", "#55627a", "#2a3242"], 20);
  const rim = "#9fdcff";
  const knight = `<g transform="translate(300 360)">
<ellipse cx="10" cy="-4" rx="130" ry="16" fill="#000" opacity=".5"/>
<path d="M-40 -170C-110 -120 -130 -40 -150 0H150C120 -60 90 -120 50 -170Z" fill="${s.lin(["#b3202a", "#6d0f16", "#3a070c"], 90)}"/>
<path d="M-90 -90C-80 -60 -96 -30 -110 0M-40 -120C-40 -80 -50 -40 -56 0M60 -110C70 -70 80 -40 96 0" stroke="#2a0509" stroke-width="5" opacity=".5" fill="none"/>
<path d="M-56 0C-60 -60 -58 -120 -44 -160H44C60 -120 62 -60 58 0Z" fill="${steel}"/>
<path d="M-30 -150C-30 -110 -20 -70 0 -40C20 -70 30 -110 30 -150Z" fill="#fff" opacity=".18"/>
<path d="M-50 -100h100M-54 -60h108" stroke="#2a3242" stroke-width="3" opacity=".6"/>
<path d="M-96 -150C-96 -186 -60 -196 -40 -180L-36 -132C-60 -124 -86 -128 -96 -150Z" fill="${steel}" stroke="#1d2433" stroke-width="3"/>
<path d="M96 -150C96 -186 60 -196 40 -180L36 -132C60 -124 86 -128 96 -150Z" fill="${steel}" stroke="#1d2433" stroke-width="3"/>
<path d="M-92 -154C-88 -176 -66 -186 -48 -178" stroke="${rim}" stroke-width="3" fill="none" opacity=".9"/>
<path d="M-38 -186C-40 -236 -20 -262 0 -262S40 -236 38 -186C24 -176 -24 -176 -38 -186Z" fill="${steel}" stroke="#1d2433" stroke-width="3"/>
<path d="M-26 -214h52v10h-52Z" fill="#0b0f1a"/>
<path d="M-20 -210h14M6 -210h14" stroke="#7fd0ff" stroke-width="3" filter="${s.glow(3, "#7fd0ff", 1)}"/>
<path d="M0 -262V-186" stroke="#1d2433" stroke-width="3" opacity=".6"/>
<path d="M-4 -262C0 -300 30 -312 52 -300C30 -296 16 -284 6 -262Z" fill="#e0245e"/>
<path d="M-30 -230C-28 -248 -16 -258 -4 -258" stroke="${rim}" stroke-width="3" fill="none"/>
<path d="M-150 -20C-150 -80 -130 -110 -96 -116L-70 -100C-66 -60 -80 -20 -110 4Z" fill="${s.lin(["#2f5fb3", "#183670", "#0c1a3a"], 20)}" stroke="#d9b24a" stroke-width="5"/>
<path d="M-118 -80l14 -10 10 16 -12 16Z" fill="#ffd36b"/>
</g>`;
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#4d6aa8", "#1f2a52", "#0a0d1f"], 0.6, 0.35, 0.8)}"/>
${sun(s, 470, 70, 30, "#f4f8ff", "#9fc4ff")}
${cloud(s, 120, 90, 0.9, "#4a5a86", 0.35)}${cloud(s, 560, 150, 0.8, "#4a5a86", 0.3)}
<path d="${"M0 250L60 200L110 230L170 170L240 220L300 180L380 230L440 190L520 230L590 200L640 220V360H0Z"}" fill="#1a2346"/>
${tower(s, 120, 300, 0.95, "#6f7c94")}
${tower(s, 540, 290, 0.8, "#5c6880")}
<path d="M0 290L80 270L200 286L320 268L460 282L640 270V360H0Z" fill="${s.lin(["#2b2a3a", "#121019"], 90)}"/>
${[
  [100, 220],
  [560, 220],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="60" fill="${s.radU([[0, "#ffb347", 0.55], [1, "#ffb347", 0]], x, y, 60)}"/><path d="M${x - 5} ${y}c-4 -10 4 -16 5 -26c6 8 10 14 4 26Z" fill="#ffd36b"/>`)
  .join("")}
${knight}
${sword}
${embers(s, 50, [0, 120, W, 240])}
${lightWash(s, 412, 120, 200, "#9fdcff", 0.35)}`;
  const mark = logo(s, ["TOWER", "LEGENDS"], 120, 70, { size: 34, fill: ["#ffffff", "#ffcf4d"], stroke: "#1a0f2e", rim: "#b8842a", rot: 0, tracking: 1 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.55)}${s.grain(0.08)}`, bloom: 0.3, focus: [340, 200, 220] });
}

export const SCENES: Record<string, () => Art> = {
  "solitaire-grove": solitaireGrove,
  "orchard-friends": orchardFriends,
  "tower-legends": towerLegends,
  ...SCENES_B,
  ...SCENES_C,
};

// Keep helpers referenced for scenes that may not use them directly.
void bokeh;
void shade;
void H;
