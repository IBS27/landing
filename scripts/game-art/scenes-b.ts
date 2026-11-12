import {
  type Art,
  ball,
  bokeh,
  card,
  chibi,
  cloud,
  embers,
  finish,
  gem,
  grassTufts,
  H,
  hill,
  lightWash,
  logo,
  palm,
  rays,
  Scene,
  shade,
  sky,
  sparkle,
  sparkles,
  sun,
  tree,
  vignette,
  W,
} from "./kit";
import { cottage } from "./props";

function harborTycoon() {
  const s = new Scene("harbor-tycoon");
  const containers = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      const c = ["#e8483b", "#2f80ed", "#f2a61f", "#27ae60", "#9b51e0", "#eb5757", "#2d9cdb"][(row * 3 + col) % 7];
      return `<rect x="${250 + col * 34}" y="${178 - row * 18}" width="32" height="16" fill="${s.lin([shade(c, 0.2), c, shade(c, -0.3)], 90)}"/><path d="M${254 + col * 34} ${180 - row * 18}v12M${260 + col * 34} ${180 - row * 18}v12M${266 + col * 34} ${180 - row * 18}v12M${272 + col * 34} ${180 - row * 18}v12" stroke="#000" stroke-opacity=".18"/>`;
    }).join(""),
  ).join("");
  const crane = (x: number, k: number) =>
    `<g transform="translate(${x} 214) scale(${k})" fill="none" stroke="${s.lin(["#ffb02e", "#c96a00"], 0)}" stroke-width="6"><path d="M0 0V-150M40 0V-150M0 -150H40M0 -30L40 -60M0 -60L40 -90M0 -90L40 -120M-80 -150H120M-80 -150L20 -190L120 -150M20 -190V-150"/><path d="M-60 -150V-90" stroke="#333" stroke-width="2"/><rect x="-70" y="-92" width="20" height="10" fill="#333" stroke="none"/></g>`;
  const water = s.lin(["#ff9a6b", "#c9577a", "#5a3b8f", "#23305e"], 90);
  const art = `
${sky(s, ["#3b2f7a", "#9b4f9a", "#ff8a5c", "#ffc76b"])}
${sun(s, 170, 205, 34, "#fff6d8", "#ffb05c")}
${cloud(s, 420, 70, 0.9, "#f0a0a8", 0.8)}${cloud(s, 90, 90, 0.7, "#f0a0a8", 0.7)}
<path d="M0 200L50 186L90 194L140 176L180 190L230 182L270 196L320 184L360 196V214H0Z" fill="#6a3b74" opacity=".8"/>
${Array.from({ length: 14 }, (_, i) => `<rect x="${20 + i * 22}" y="${180 - ((i * 37) % 40)}" width="16" height="${34 + ((i * 37) % 40)}" fill="#55306a"/>`).join("")}
<rect y="210" width="${W}" height="150" fill="${water}"/>
<path d="M150 214h40l30 150h-100Z" fill="#ffd28a" opacity=".35" filter="${s.blur(6)}"/>
${Array.from({ length: 26 }, () => {
  const x = s.r() * W;
  const y = 220 + s.r() * 130;
  return `<path d="M${x.toFixed(0)} ${y.toFixed(0)}h${(12 + s.r() * 30).toFixed(0)}" stroke="#ffe0b0" stroke-width="2" stroke-linecap="round" opacity="${(0.25 + s.r() * 0.4).toFixed(2)}"/>`;
}).join("")}
${crane(560, 1)}${crane(620, 0.8)}
<g>
<path d="M220 196H500L478 250H246Z" fill="${s.lin(["#d8423a", "#8f1f1a"], 90)}"/>
<path d="M232 236H490" stroke="#1e1e2a" stroke-width="14"/>
<path d="M440 196V140h46v56Z" fill="${s.lin(["#ffffff", "#d0d6e0"], 0)}"/>
<path d="M444 150h38M444 162h38M444 174h38" stroke="#2b3a55" stroke-width="5"/>
<rect x="458" y="120" width="14" height="20" fill="#2b3a55"/><rect x="456" y="116" width="18" height="6" fill="#e8483b"/>
${containers}
<path d="M246 250C300 262 420 262 478 250" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>
</g>
<path d="M0 300H640V360H0Z" fill="${s.lin(["#7a5236", "#4a2f1c"], 90)}"/>
${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 40} 300v60" stroke="#3a2414" stroke-width="2"/>`).join("")}
<path d="M0 300H640" stroke="#a87a52" stroke-width="5"/>
${[60, 600].map((x) => `<g transform="translate(${x} 318)"><rect x="-12" y="-16" width="24" height="26" rx="5" fill="#2a2a33"/><rect x="-16" y="-20" width="32" height="8" rx="4" fill="#3d3d4a"/></g>`).join("")}
${chibi(s, 120, 350, 0.62, { hat: "cap", hatColor: "#2f6fd6", style: "short", hair: "#3b2416", shirt: "#ff8c1a", mouth: "grin", wave: true })}
${[
  [330, 80],
  [360, 96],
  [520, 110],
]
  .map(([x, y]) => `<path d="M${x - 10} ${y}q5 -6 10 0q5 -6 10 0" stroke="#3a2340" stroke-width="2.5" fill="none" stroke-linecap="round"/>`)
  .join("")}
${lightWash(s, 170, 205, 300, "#ffd28a", 0.45)}`;
  const mark = logo(s, ["Harbor", "Tycoon"], 470, 300, { size: 40, fill: ["#ffffff", "#7fd3ff"], stroke: "#0d2a52", rim: "#ffd36b", rot: -4 });
  return finish(s, { art, logo: mark, focus: [360, 200, 200] });
}

function brickBurst() {
  const s = new Scene("brick-burst");
  const cols = ["#ff4d6d", "#ffb020", "#3ddc97", "#4dabff", "#b26bff"];
  const bricks = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => {
      if ((row === 4 && col % 3 === 1) || (row === 3 && col === 6)) return "";
      const c = cols[(row + col * 2) % cols.length];
      const x = 26 + col * 66;
      const y = 20 + row * 34;
      const n = [5, 12, 40, 8, 20, 3, 15][(row * 9 + col) % 7];
      return `<g><rect x="${x}" y="${y + 3}" width="60" height="28" rx="6" fill="${shade(c, -0.45)}"/><rect x="${x}" y="${y}" width="60" height="28" rx="6" fill="${s.lin([shade(c, 0.35), c, shade(c, -0.2)], 90)}"/><rect x="${x + 4}" y="${y + 3}" width="52" height="8" rx="4" fill="#fff" opacity=".35"/><text x="${x + 30}" y="${y + 21}" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="15" fill="#fff" stroke="${shade(c, -0.5)}" stroke-width="3" paint-order="stroke">${n}</text></g>`;
    }).join(""),
  ).join("");
  const trail = Array.from({ length: 18 }, (_, i) => {
    const t = i / 17;
    const x = 320 + t * 150;
    const y = 340 - t * 160;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + t * 3).toFixed(1)}" fill="#fff" opacity="${(0.3 + t * 0.7).toFixed(2)}"/>`;
  }).join("");
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#2b2f8f", "#151845", "#080a20"], 0.5, 0.45, 0.8)}"/>
${Array.from({ length: 17 }, (_, i) => `<path d="M${i * 40} 0V${H}" stroke="#4d5bd6" stroke-opacity=".12"/>`).join("")}
${Array.from({ length: 10 }, (_, i) => `<path d="M0 ${i * 40}H${W}" stroke="#4d5bd6" stroke-opacity=".12"/>`).join("")}
${bricks}
<g filter="${s.glow(5, "#9fe8ff", 1)}">${trail}</g>
<circle cx="478" cy="172" r="40" fill="${s.radU([[0, "#ffffff", 1], [0.3, "#ffe680", 0.9], [1, "#ff6b3d", 0]], 478, 172, 40)}"/>
${Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = 30 + s.r() * 30;
  return `<rect x="${(478 + Math.cos(a) * r).toFixed(1)}" y="${(172 + Math.sin(a) * r).toFixed(1)}" width="8" height="5" rx="1.5" fill="${cols[i % 5]}" transform="rotate(${(a * 57).toFixed(0)} ${(478 + Math.cos(a) * r).toFixed(1)} ${(172 + Math.sin(a) * r).toFixed(1)})"/>`;
}).join("")}
<g transform="translate(320 340)"><ellipse rx="44" ry="10" fill="#000" opacity=".4"/><path d="M-36 0a36 30 0 0 1 72 0Z" fill="${s.lin(["#7f8cff", "#3a3fb0"], 90)}"/><circle cy="-10" r="11" fill="${s.rad(["#ffffff", "#bfe9ff", "#59b8ff"], 0.35, 0.3, 0.7)}"/></g>
${sparkles(s, 14, [0, 0, W, H], "#cfe6ff", 6)}`;
  const mark = logo(s, ["BRICK", "BURST"], 150, 286, { size: 44, fill: ["#ffffff", "#ff5fa2"], stroke: "#1a0b3d", rim: "#59d8ff", rot: -6, tracking: 1 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.5)}${s.grain(0.06)}`, bloom: 0.3, focus: [380, 120, 220] });
}

function gemCascade() {
  const s = new Scene("gem-cascade");
  const gems: [string, string, Parameters<typeof gem>[6]][] = [
    ["#ff4d6d", "#8f0f2e", "round"],
    ["#38d9a9", "#0b6b4f", "hex"],
    ["#ffd43b", "#a86b00", "diamond"],
    ["#4dabf7", "#0b4a8f", "square"],
    ["#b26bff", "#4b158f", "tri"],
  ];
  const grid = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => {
      const [c, d, sh] = gems[(row * 2 + col * 3) % 5];
      return gem(s, 186 + col * 58, 168 + row * 56, 22, c, d, sh);
    }).join(""),
  ).join("");
  const vines = Array.from({ length: 8 }, (_, i) => {
    const x = i * 90 + s.r() * 40;
    return `<path d="M${x.toFixed(0)} 0C${(x + 20).toFixed(0)} 40 ${(x - 20).toFixed(0)} 80 ${(x + 6).toFixed(0)} ${(100 + s.r() * 40).toFixed(0)}" stroke="#2f7d32" stroke-width="5" fill="none"/>${Array.from({ length: 5 }, (_, j) => `<ellipse cx="${(x + (j % 2 ? 8 : -8)).toFixed(0)}" cy="${20 + j * 22}" rx="10" ry="5" fill="${s.r() > 0.5 ? "#4caf50" : "#7ed957"}" transform="rotate(${j % 2 ? 30 : -30} ${(x + (j % 2 ? 8 : -8)).toFixed(0)} ${20 + j * 22})"/>`).join("")}`;
  }).join("");
  const stones = Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 10 }, (_, col) => `<rect x="${col * 70 - (row % 2) * 35}" y="${row * 40}" width="66" height="36" rx="5" fill="#000" opacity="${(0.06 + ((row + col) % 3) * 0.04).toFixed(2)}"/>`).join(""),
  ).join("");
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#5f8f6a", "#2f5a48", "#13261f"], 0.45, 0.35, 0.8)}"/>
${stones}
${rays(s, 330, -30, "#fff2b0", 6, 0.25)}
${vines}
<path d="M140 120h330l20 200H120Z" fill="${s.lin(["#a58b62", "#6d5634", "#3d2e19"], 90)}"/>
<path d="M140 120h330l-6 12H146Z" fill="#c9b07e"/>
<rect x="150" y="134" width="310" height="176" rx="10" fill="#1d2a2a" opacity=".55"/>
${grid}
${chibi(s, 545, 352, 0.92, { hat: "safari", hatColor: "#d9b77a", style: "pony", hair: "#a0481c", shirt: "#3aa66b", mouth: "open", skin: "#e8b48a", wave: true })}
${[70, 600].map((x) => `<g><circle cx="${x}" cy="150" r="60" fill="${s.radU([[0, "#ffb347", 0.5], [1, "#ffb347", 0]], x, 150, 60)}"/><path d="M${x - 6} 150c-4 -12 4 -18 6 -30c8 10 12 16 6 30Z" fill="#ffd36b"/><rect x="${x - 6}" y="150" width="12" height="40" fill="#5a3a20"/></g>`).join("")}
${sparkles(s, 16, [150, 130, 310, 180], "#fffbe0", 8)}
${embers(s, 20, [0, 60, W, 200], "#ffe7a0")}`;
  const mark = logo(s, ["Gem", "Cascade"], 130, 62, { size: 40, fill: ["#e9fff8", "#2ed3a6"], stroke: "#06302a", rim: "#ffd36b", rot: -6 });
  return finish(s, { art, logo: mark, focus: [300, 220, 190] });
}

function manorMakeover() {
  const s = new Scene("manor-makeover");
  const wallpaper = Array.from({ length: 12 }, (_, i) => `<rect x="${i * 56}" y="0" width="28" height="250" fill="#fff" opacity=".08"/>`).join("") +
    Array.from({ length: 30 }, (_, i) => `<path d="${`M${(i % 10) * 64 + 14} ${Math.floor(i / 10) * 70 + 30}l6 -10 6 10 -6 10Z`}" fill="#fff" opacity=".18"/>`).join("");
  const art = `
<rect width="${W}" height="${H}" fill="${s.lin(["#7fc8c2", "#4f9e9a"], 90)}"/>
${wallpaper}
<rect y="236" width="${W}" height="16" fill="#f4ead8"/>
<rect y="250" width="${W}" height="110" fill="${s.lin(["#b07a4a", "#7a4f2a"], 90)}"/>
${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 60 - 40} 360L${i * 60 + 10} 250" stroke="#5a3a20" stroke-opacity=".35" stroke-width="2"/>`).join("")}
<g transform="translate(250 40)">
<rect x="-8" y="-8" width="156" height="166" rx="6" fill="#f8f1e4"/>
<rect width="140" height="150" fill="${s.lin(["#a8e2ff", "#e9f8ff"], 90)}"/>
<path d="M0 110C30 90 60 100 80 92C100 86 120 94 140 88V150H0Z" fill="#7ccf5a"/>
<circle cx="40" cy="104" r="16" fill="#4a9f3a"/><circle cx="110" cy="96" r="20" fill="#3d8f30"/>
<path d="M70 0V150M0 75H140" stroke="#f8f1e4" stroke-width="7"/>
<path d="M-24 -14C10 30 0 120 -18 166H-30V-14Z" fill="${s.lin(["#e86a8a", "#a8324f"], 0)}"/>
<path d="M164 -14C130 30 140 120 158 166H170V-14Z" fill="${s.lin(["#a8324f", "#e86a8a"], 0)}"/>
<rect x="-34" y="-20" width="208" height="8" rx="4" fill="#c9a24a"/>
</g>
${rays(s, 320, 60, "#fff8d6", 5, 0.2, 500)}
<g transform="translate(70 300)">
<ellipse cx="80" cy="14" rx="110" ry="12" fill="#000" opacity=".25"/>
<path d="M0 0V-60C0 -80 20 -86 40 -80H130C150 -86 170 -80 170 -60V0Z" fill="${s.lin(["#c0567a", "#7e2346"], 90)}"/>
<rect x="-10" y="-40" width="190" height="40" rx="12" fill="${s.lin(["#d86a8e", "#93305a"], 90)}"/>
<path d="M30 -38v30M80 -38v30M130 -38v30" stroke="#6b1a3a" stroke-width="3" opacity=".5"/>
<rect x="6" y="0" width="10" height="14" fill="#5a3a20"/><rect x="154" y="0" width="10" height="14" fill="#5a3a20"/>
<rect x="30" y="-74" width="34" height="26" rx="8" fill="#ffd36b"/><rect x="104" y="-74" width="34" height="26" rx="8" fill="#9fe0d6"/>
</g>
<ellipse cx="320" cy="336" rx="150" ry="22" fill="${s.lin(["#e9c46a", "#d08c3a"], 0)}" opacity=".85"/>
<g transform="translate(110 70)"><rect x="-26" y="-30" width="52" height="60" rx="3" fill="#c9a24a"/><rect x="-20" y="-24" width="40" height="48" fill="${s.lin(["#ffd9a0", "#ff9a6b"], 90)}"/><circle cy="-2" r="10" fill="#fff3c4"/></g>
<g transform="translate(560 160)"><path d="M0 -60l24 0 14 40H-14Z" fill="${s.lin(["#fff3c4", "#ffd36b"], 90)}"/><rect x="8" y="-20" width="6" height="90" fill="#7a5a32"/><circle cx="12" cy="-34" r="50" fill="${s.radU([[0, "#fff1a8", 0.5], [1, "#fff1a8", 0]], 572, 126, 50)}"/></g>
<g transform="translate(400 330)"><path d="M0 0l10 -26h28l10 26Z" fill="${s.lin(["#5fa8d8", "#2f6f9f"], 0)}"/><ellipse cx="24" cy="-26" rx="14" ry="4" fill="#ffd1e0"/></g>
${chibi(s, 470, 352, 0.95, { style: "bun", hair: "#5a2a14", shirt: "#ffb23e", mouth: "open", skin: "#f3c7a2", wave: true, item: `<g transform="translate(44 -126) rotate(-20)"><rect x="-4" y="0" width="8" height="40" rx="3" fill="#7a5a32"/><rect x="-22" y="-16" width="44" height="18" rx="8" fill="#ff7aa8" stroke="#3a2416" stroke-width="2.4"/></g>` })}
${sparkles(s, 8, [240, 40, 160, 160], "#fff", 6)}
${lightWash(s, 320, 100, 300, "#fff6d6", 0.3)}`;
  const mark = logo(s, ["Manor", "Makeover"], 150, 196, { size: 38, fill: ["#fff0f5", "#ff6fa3"], stroke: "#4a0f2a", rim: "#ffd36b", rot: -6 });
  return finish(s, { art, logo: mark, focus: [440, 230, 190] });
}

function midnightSolitaire() {
  const s = new Scene("night-solitaire");
  const stars = Array.from({ length: 70 }, () => `<circle cx="${(s.r() * W).toFixed(0)}" cy="${(s.r() * 220).toFixed(0)}" r="${(0.5 + s.r() * 1.4).toFixed(1)}" fill="#fff" opacity="${(0.3 + s.r() * 0.7).toFixed(2)}"/>`).join("");
  const town = Array.from({ length: 18 }, (_, i) => {
    const x = i * 36;
    const h = 30 + ((i * 53) % 50);
    return `<rect x="${x}" y="${250 - h}" width="34" height="${h + 20}" fill="#0f1433"/>${h > 50 ? `<path d="M${x} ${250 - h}l17 -18 17 18Z" fill="#0f1433"/>` : ""}<rect x="${x + 8}" y="${262 - h}" width="5" height="7" fill="#ffd36b" opacity=".85"/><rect x="${x + 20}" y="${276 - h}" width="5" height="7" fill="#ffd36b" opacity=".6"/>`;
  }).join("");
  const art = `
${sky(s, ["#070b24", "#1a2463", "#3b4aa8", "#6b6fc9"])}
${stars}
<circle cx="470" cy="100" r="140" fill="${s.radU([[0, "#cfe0ff", 0.5], [1, "#cfe0ff", 0]], 470, 100, 140)}"/>
<circle cx="470" cy="100" r="46" fill="${s.rad(["#ffffff", "#f1f4ff", "#c8d2f0"], 0.4, 0.4, 0.6)}"/>
<circle cx="452" cy="88" r="8" fill="#c8d2f0" opacity=".6"/><circle cx="484" cy="114" r="6" fill="#c8d2f0" opacity=".6"/>
${cloud(s, 600, 180, 0.7, "#4a5596", 0.4)}
<path d="M0 240L90 220L180 236L280 212L380 232L470 214L560 230L640 220V360H0Z" fill="#1a1f4d"/>
${town}
<path d="M0 270H640V360H0Z" fill="${s.lin(["#141a40", "#060818"], 90)}"/>
<g filter="${s.glow(10, "#ffd36b", 0.55)}">
${card(s, 240, 262, 1.6, -26, "A", "spade")}
${card(s, 290, 248, 1.6, -9, "K", "heart")}
${card(s, 340, 248, 1.6, 9, "Q", "club")}
${card(s, 390, 262, 1.6, 26, "J", "diamond")}
</g>
${sparkles(s, 20, [150, 160, 340, 160], "#fff3c4", 9)}
${bokeh(s, 16, ["#7aa2ff", "#ffd36b", "#c59bff"], [0, 120, W, 240], 10)}`;
  const mark = logo(s, ["Midnight", "Solitaire"], 140, 60, { size: 34, fill: ["#ffffff", "#c9d6ff"], stroke: "#0a0f2e", rim: "#e6c25a", rot: -3 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.5)}${s.grain(0.06)}`, bloom: 0.3, focus: [315, 240, 190] });
}

function sugarValley() {
  const s = new Scene("candy-valley");
  const lolly = (x: number, y: number, k: number, a: string, b: string) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-3" y="0" width="6" height="80" rx="3" fill="#f5f0ff"/><circle r="30" fill="${a}"/>${Array.from({ length: 4 }, (_, i) => `<path d="M0 0C${10 + i * 5} ${-6 - i * 4} ${16 + i * 4} ${6 + i * 4} 0 ${12 + i * 5}" fill="none" stroke="${b}" stroke-width="6" transform="rotate(${i * 90})"/>`).join("")}<circle cx="-10" cy="-12" r="8" fill="#fff" opacity=".5"/></g>`;
  const wrapped = (x: number, y: number, k: number, c: string, rot: number) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><path d="M-30 0l-18 -16v32Z M30 0l18 -16v32Z" fill="${shade(c, -0.15)}"/>${ball(s, 0, 0, 26, shade(c, 0.2), shade(c, -0.35), 0.8)}<path d="M-18 -18l36 36M-4 -26l30 30M-26 -4l30 30" stroke="#fff" stroke-opacity=".5" stroke-width="5"/></g>`;
  const art = `
${sky(s, ["#ff9ad5", "#ffc4e6", "#ffe6f4"])}
${sun(s, 520, 60, 24, "#fffbe8", "#ffd9f0")}
${cloud(s, 150, 70, 0.9, "#ffd0ec")}${cloud(s, 380, 50, 0.7, "#ffd0ec")}
${hill(s, [200, 160, 190, 150, 186, 170, 196], "#b9f5d8", "#62d1a4")}
${Array.from({ length: 9 }, (_, i) => `<ellipse cx="${30 + i * 75}" cy="${190 + (i % 3) * 6}" rx="22" ry="18" fill="${["#ff6fa3", "#ffd23f", "#7ad8ff"][i % 3]}" opacity=".9"/>`).join("")}
${lolly(110, 170, 1.0, "#ff6fa3", "#fff")}${lolly(560, 160, 1.1, "#7ad8ff", "#fff")}${lolly(470, 200, 0.7, "#ffd23f", "#ff6fa3")}
<path d="M0 240C120 230 200 260 320 250C440 240 520 260 640 250V360H0Z" fill="${s.lin(["#a36a3c", "#6b3d1d"], 90)}"/>
<path d="M0 250C120 240 200 270 320 260C440 250 520 270 640 260" stroke="#c48a58" stroke-width="5" fill="none" opacity=".7"/>
${hill(s, [300, 286, 296, 284, 298, 288, 300], "#ffb3d9", "#ff6fa3")}
${Array.from({ length: 10 }, (_, i) => `<g transform="translate(${i * 70 + 20} 300)"><path d="M0 0v-36a12 12 0 0 1 24 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M0 0v-36a12 12 0 0 1 24 0" stroke="#e8203c" stroke-width="7" fill="none" stroke-dasharray="6 6" stroke-linecap="round"/></g>`).join("")}
${wrapped(170, 320, 1.1, "#ff4d8d", -20)}
${wrapped(470, 316, 1.25, "#5fc8ff", 15)}
${ball(s, 320, 326, 30, "#ffd23f", "#e08a00", 0.8)}
${gem(s, 380, 330, 18, "#b26bff", "#4b158f", "round")}
${gem(s, 260, 338, 16, "#3ddc97", "#0b6b4f", "hex")}
${sparkles(s, 18, [40, 100, 560, 240], "#fff", 8)}`;
  const mark = logo(s, ["Sugar", "Valley"], 320, 120, { size: 52, fill: ["#ffffff", "#ff5fa2"], stroke: "#7a0f45", rim: "#ffe36b", rot: -4 });
  return finish(s, { art, logo: mark, focus: [320, 300, 150] });
}

function mazeSlide() {
  const s = new Scene("maze-slide");
  const cols = ["#3df5ff", "#ff4df0", "#ffe24d", "#7bff6b"];
  const arrow = (x: number, y: number, dir: number, c: string, len: number) =>
    `<g transform="translate(${x} ${y}) rotate(${dir})"><path d="M0 0H${len}" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M${len + 10} 0l-14 -10v20Z" fill="${c}"/></g>`;
  let arrows = "";
  for (let i = 0; i < 46; i++) {
    const gx = Math.floor(s.r() * 13);
    const gy = Math.floor(s.r() * 7);
    arrows += arrow(30 + gx * 46, 40 + gy * 46, [0, 90, 180, 270][Math.floor(s.r() * 4)], cols[i % 4], 16 + Math.floor(s.r() * 3) * 46);
  }
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#3a1a7a", "#1b0d3f", "#09051a"], 0.5, 0.5, 0.8)}"/>
${Array.from({ length: 14 }, (_, i) => `<path d="M${16 + i * 46} 0V${H}" stroke="#7a5cff" stroke-opacity=".15"/>`).join("")}
${Array.from({ length: 8 }, (_, i) => `<path d="M0 ${16 + i * 46}H${W}" stroke="#7a5cff" stroke-opacity=".15"/>`).join("")}
<g filter="${s.glow(4, "#ffffff", 0.35)}">${arrows}</g>
<g transform="translate(470 120)" filter="${s.glow(10, "#3df5ff", 0.9)}"><path d="M-120 0H40" stroke="#3df5ff" stroke-width="12" stroke-linecap="round"/><path d="M64 0l-28 -22v44Z" fill="#3df5ff"/></g>
${Array.from({ length: 6 }, (_, i) => `<path d="M${330 - i * 26} ${120}h-18" stroke="#3df5ff" stroke-width="${6 - i}" stroke-linecap="round" opacity="${(0.6 - i * 0.1).toFixed(2)}"/>`).join("")}
${sparkles(s, 12, [0, 0, W, H], "#e0f7ff", 6)}`;
  return finish(s, { art, post: `${vignette(s, 0.55)}${s.grain(0.05)}`, bloom: 0.3, focus: [420, 140, 200] });
}

function islandVillage() {
  const s = new Scene("island-village");
  const hut = (x: number, y: number, k: number) =>
    `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="34" ry="7" fill="#000" opacity=".2"/><rect x="-22" y="-30" width="44" height="32" fill="${s.lin(["#e8c48a", "#b98a4e"], 0)}"/><rect x="-6" y="-18" width="12" height="20" fill="#5a3a20"/><path d="M-34 -26L0 -60L34 -26Z" fill="${s.lin(["#f0c860", "#b8862a"], 90)}"/><path d="M-30 -30l8 -6M-18 -42l8 -6M8 -48l8 6M20 -36l8 6" stroke="#8a5a1a" stroke-width="2"/></g>`;
  const art = `
<rect width="${W}" height="${H}" fill="${s.rad(["#5fe3e0", "#1fb3d1", "#0a6fa8"], 0.5, 0.55, 0.75)}"/>
${Array.from({ length: 30 }, () => {
  const x = s.r() * W;
  const y = s.r() * H;
  return `<path d="M${x.toFixed(0)} ${y.toFixed(0)}q8 -4 16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".4"/>`;
}).join("")}
<ellipse cx="320" cy="210" rx="250" ry="120" fill="#7ff0e6" opacity=".55" filter="${s.blur(10)}"/>
<ellipse cx="320" cy="214" rx="220" ry="104" fill="${s.rad(["#fff3c4", "#f2d58a"], 0.5, 0.4, 0.6)}"/>
<ellipse cx="320" cy="204" rx="186" ry="84" fill="${s.rad(["#9be15a", "#4caf50", "#2e7d32"], 0.45, 0.35, 0.7)}"/>
<path d="M260 150c20 -30 60 -40 90 -30c20 6 30 20 20 34c-30 10 -70 10 -110 -4Z" fill="#6b8f4a"/>
<path d="M290 140c10 -16 34 -22 50 -16" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none"/>
${hut(240, 224, 0.95)}${hut(320, 250, 1.1)}${hut(400, 220, 0.9)}${hut(470, 196, 0.75)}
${palm(s, 180, 200, 0.5)}${palm(s, 470, 250, 0.55, true)}${palm(s, 380, 160, 0.45)}${palm(s, 200, 280, 0.45, true)}
<path d="M470 270l90 50" stroke="#8a5a32" stroke-width="12"/><path d="M470 270l90 50" stroke="#c49a6a" stroke-width="8" stroke-dasharray="4 4"/>
<g transform="translate(580 316)"><path d="M-26 0h52l-8 12h-36Z" fill="#e8483b"/><path d="M0 -2V-48L26 -8Z" fill="#fff"/><path d="M0 -40L-18 -8H0Z" fill="#ffd36b"/></g>
${tree(s, 290, 190, 0.45, "#2f7d32", "#9be15a")}
${sparkles(s, 12, [0, 0, W, H], "#ffffff", 6)}
${lightWash(s, 100, 40, 300, "#fff6d0", 0.4)}`;
  const mark = logo(s, ["Island", "Village"], 120, 290, { size: 38, fill: ["#ffffff", "#3fd0ff"], stroke: "#073b5a", rim: "#ffd36b", rot: -6 });
  return finish(s, { art, logo: mark, focus: [330, 210, 200] });
}

function homeStory() {
  const s = new Scene("home-story");
  const art = `
${sky(s, ["#ff9f6b", "#ffc98a", "#ffe7c2"])}
${sun(s, 120, 120, 26, "#fffbe8", "#ffb06b")}
${cloud(s, 280, 60, 0.8, "#ffd0b0")}${cloud(s, 560, 80, 0.7, "#ffd0b0")}
${hill(s, [220, 200, 214, 196, 210, 200, 220], "#a8d86a", "#5a9f3a")}
${tree(s, 520, 250, 0.9, "#3b7d2a", "#b5e26a")}${tree(s, 600, 260, 1.1, "#2f6e22", "#9ed458")}
${cottage(s, 300, 270, 1.0, { wall: "#f3e2c4", roof: "#5a6fb8", trim: "#ffffff", glow: true })}
${hill(s, [290, 280, 290, 276, 288, 280, 290], "#7cc44d", "#3d8a2c")}
${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 42} 330v-36l8 -8 8 8v36Z" fill="#fff" stroke="#d8cbb0" stroke-width="2"/>`).join("")}
<path d="M0 312h640" stroke="#fff" stroke-width="5"/>
${grassTufts(s, 50, 330, 360)}
${Array.from({ length: 22 }, () => `<circle cx="${(s.r() * W).toFixed(0)}" cy="${(290 + s.r() * 20).toFixed(0)}" r="4" fill="${["#ff6b8a", "#ffd84d", "#ffffff", "#c38bff"][Math.floor(s.r() * 4)]}"/>`).join("")}
${chibi(s, 470, 350, 0.78, { style: "bob", hair: "#3b1f10", shirt: "#e8483b", mouth: "open", wave: true })}
${card(s, 80, 300, 1.25, -18, "A", "heart")}
${card(s, 118, 296, 1.25, -4, "7", "spade")}
${card(s, 156, 300, 1.25, 12, "K", "diamond")}
${sparkles(s, 10, [40, 200, 220, 100], "#fff6c8", 7)}
${lightWash(s, 120, 120, 340, "#ffe0a0", 0.4)}`;
  const mark = logo(s, ["Solitaire", "Home Story"], 470, 70, { size: 32, fill: ["#ffffff", "#ffd36b"], stroke: "#5a2a00", rim: "#ff7a3d", rot: -3 });
  return finish(s, { art, logo: mark, focus: [400, 200, 220] });
}

function solitaireSocial() {
  const s = new Scene("solitaire-social");
  const felt = s.rad(["#3fa86a", "#1d6b3f", "#0b3a22"], 0.5, 0.42, 0.75);
  const columns = Array.from({ length: 6 }, (_, c) =>
    Array.from({ length: c % 3 + 1 }, (_, r) =>
      card(s, 120 + c * 80, 150 + r * 26, 0.95, 0, ["K", "Q", "9", "5", "J", "3"][(c + r) % 6], (["spade", "heart", "club", "diamond"] as const)[(c + r) % 4], r < (c % 3) ? "#2457c5" : undefined),
    ).join(""),
  ).join("");
  const chips = (x: number, y: number, c: string, n: number) =>
    Array.from({ length: n }, (_, i) => `<g transform="translate(${x} ${y - i * 6})"><ellipse rx="22" ry="9" fill="${shade(c, -0.35)}" cy="3"/><ellipse rx="22" ry="9" fill="${c}"/><ellipse rx="14" ry="5.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 4"/></g>`).join("");
  const art = `
<rect width="${W}" height="${H}" fill="${felt}"/>
${Array.from({ length: 200 }, () => `<circle cx="${(s.r() * W).toFixed(0)}" cy="${(s.r() * H).toFixed(0)}" r=".8" fill="#000" opacity=".15"/>`).join("")}
<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="40" fill="none" stroke="#e6c25a" stroke-width="3" opacity=".5"/>
<g>${[0, 1, 2, 3].map((i) => `<rect x="${210 + i * 60}" y="40" width="48" height="66" rx="6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 4"/>`).join("")}</g>
${card(s, 234, 73, 0.95, 0, "A", "spade")}${card(s, 294, 73, 0.95, 0, "A", "heart")}
${columns}
${chips(560, 300, "#e8483b", 5)}${chips(600, 320, "#2f80ed", 3)}${chips(70, 310, "#ffb020", 4)}
${card(s, 470, 300, 1.5, -18, "A", "club")}${card(s, 510, 290, 1.5, 4, "K", "heart")}
${lightWash(s, 320, 120, 340, "#fff2c0", 0.35)}`;
  const mark = logo(s, ["Solitaire", "Social"], 120, 64, { size: 30, fill: ["#ffffff", "#ffd36b"], stroke: "#0b3a22", rim: "#e8483b", rot: -4 });
  return finish(s, { art, logo: mark, post: `${vignette(s, 0.55)}${s.grain(0.07)}`, bloom: 0.3, focus: [470, 280, 160] });
}

export const SCENES_B: Record<string, () => Art> = {
  "harbor-tycoon": harborTycoon,
  "brick-burst": brickBurst,
  "gem-cascade": gemCascade,
  "manor-makeover": manorMakeover,
  "night-solitaire": midnightSolitaire,
  "candy-valley": sugarValley,
  "maze-slide": mazeSlide,
  "island-village": islandVillage,
  "home-story": homeStory,
  "solitaire-social": solitaireSocial,
};

void H;
void sparkle;
void rays;
