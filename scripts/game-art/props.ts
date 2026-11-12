/** Larger set pieces shared by several scenes. */
import { type Scene, shade } from "./kit";

/** A cozy two-storey cottage in three-quarter view; origin at the front-left ground corner. */
export function cottage(
  s: Scene,
  x: number,
  y: number,
  k: number,
  o: { wall?: string; roof?: string; trim?: string; logs?: boolean; glow?: boolean } = {},
) {
  const wall = o.wall ?? "#d9a46a";
  const roof = o.roof ?? "#c4462f";
  const trim = o.trim ?? "#fff4e0";
  const front = s.lin([shade(wall, 0.12), wall], 90);
  const side = s.lin([shade(wall, -0.18), shade(wall, -0.32)], 90);
  const roofF = s.lin([shade(roof, 0.2), roof, shade(roof, -0.2)], 90);
  const roofS = s.lin([shade(roof, -0.2), shade(roof, -0.4)], 90);
  const win = o.glow
    ? s.rad(["#fff7c2", "#ffd65c", "#e89a1c"], 0.5, 0.5, 0.7)
    : s.lin(["#bfe6ff", "#5fa8d8"], 60);
  const logs = o.logs
    ? Array.from({ length: 7 }, (_, i) => `<path d="M0 ${-12 - i * 14}h120" stroke="${shade(wall, -0.25)}" stroke-width="2" opacity=".6"/>`).join("") +
      Array.from({ length: 7 }, (_, i) => `<path d="M120 ${-12 - i * 14}l60 -22" stroke="${shade(wall, -0.45)}" stroke-width="2" opacity=".5"/>`).join("")
    : "";
  const window = (wx: number, wy: number, w = 26, h = 30) =>
    `<rect x="${wx - 3}" y="${wy - 3}" width="${w + 6}" height="${h + 6}" rx="3" fill="${trim}"/><rect x="${wx}" y="${wy}" width="${w}" height="${h}" fill="${win}"/><path d="M${wx + w / 2} ${wy}v${h}M${wx} ${wy + h / 2}h${w}" stroke="${trim}" stroke-width="3"/><path d="M${wx + 3} ${wy + 3}l8 0l-8 10Z" fill="#fff" opacity=".5"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})">
<ellipse cx="96" cy="2" rx="130" ry="16" fill="#000" opacity=".22"/>
<path d="M120 0V-110L180 -132V-22Z" fill="${side}"/>
<path d="M0 0V-110H120V0Z" fill="${front}"/>
${logs}
<path d="M-14 -104L60 -176L134 -104Z" fill="${front}"/>
<path d="M-18 -100L60 -182L196 -130L184 -118L60 -168L-6 -96Z" fill="${roofS}"/>
<path d="M-22 -98L60 -184L74 -170L-6 -90Z" fill="${roofF}"/>
<path d="M60 -184L200 -134L192 -120L74 -170Z" fill="${roofF}"/>
<path d="M60 -184L200 -134" stroke="${shade(roof, 0.35)}" stroke-width="4" stroke-linecap="round"/>
<path d="M150 -150V-196h22v44Z" fill="${s.lin(["#a7a39c", "#6f6a62"], 0)}"/>
<path d="M146 -200h30v8h-30Z" fill="#5a554e"/>
${window(44, -158, 32, 30)}
${window(14, -86)}
${window(80, -86)}
<path d="M138 -100l28 -10v40l-28 10Z" fill="${win}" stroke="${trim}" stroke-width="3"/>
<rect x="46" y="-62" width="30" height="62" rx="14" fill="${s.lin(["#8b5a2b", "#5c3716"], 0)}" stroke="${trim}" stroke-width="3"/>
<circle cx="70" cy="-30" r="2.5" fill="#ffd56b"/>
<path d="M-8 0h196l-8 6H-14Z" fill="${shade(wall, -0.5)}" opacity=".45"/>
</g>`;
}

/** Steam locomotive facing right; origin at front-bottom. */
export function locomotive(s: Scene, x: number, y: number, k: number, body = "#d63a2f") {
  const b = s.lin([shade(body, 0.3), body, shade(body, -0.35)], 90);
  const iron = s.lin(["#5d6470", "#2a2e36", "#14161b"], 90);
  const wheel = (cx: number, r: number) =>
    `<circle cx="${cx}" cy="${-r}" r="${r}" fill="#1b1d22"/><circle cx="${cx}" cy="${-r}" r="${r * 0.72}" fill="${s.rad(["#e6b04a", "#a5701a"], 0.4, 0.4, 0.7)}"/><circle cx="${cx}" cy="${-r}" r="${r * 0.2}" fill="#3a2a10"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})">
<rect x="-190" y="-58" width="160" height="40" rx="6" fill="${iron}"/>
<rect x="-176" y="-112" width="70" height="60" rx="4" fill="${b}"/>
<rect x="-168" y="-104" width="24" height="22" rx="3" fill="#ffe49a"/>
<path d="M-184 -114h86v-10h-86Z" fill="${shade(body, -0.4)}"/>
<rect x="-106" y="-92" width="96" height="40" rx="20" fill="${iron}"/>
<rect x="-100" y="-88" width="84" height="8" rx="4" fill="#fff" opacity=".18"/>
<path d="M-60 -92v-34h18v34Z" fill="${iron}"/><path d="M-66 -134h30l-4 10h-22Z" fill="#1b1d22"/>
<circle cx="-12" cy="-72" r="14" fill="#1b1d22"/><circle cx="-12" cy="-72" r="7" fill="#ffe680"/>
<path d="M-4 -40l26 0l-20 22h-14Z" fill="#c9cdd4"/>
${wheel(-160, 16)}${wheel(-120, 16)}${wheel(-76, 22)}${wheel(-30, 22)}
<path d="M-160 -16H-30" stroke="#c8ccd2" stroke-width="5" stroke-linecap="round"/>
</g>`;
}

/** Tall stone tower with a lit window and battlements; origin at base centre. */
export function tower(s: Scene, x: number, y: number, k: number, stone = "#7d8798") {
  const g = s.lin([shade(stone, 0.25), stone, shade(stone, -0.5)], 0);
  const bricks = Array.from({ length: 14 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => `<rect x="${-34 + j * 18 + (i % 2) * 9}" y="${-20 - i * 18}" width="16" height="15" rx="2" fill="#000" opacity=".12"/>`).join(""),
  ).join("");
  return `<g transform="translate(${x} ${y}) scale(${k})">
<path d="M-40 0V-250H40V0Z" fill="${g}"/>
${bricks}
<path d="M-50 -250h100v-22h-100Z" fill="${shade(stone, -0.1)}"/>
${[-50, -26, -2, 22].map((bx) => `<rect x="${bx}" y="-292" width="16" height="22" fill="${shade(stone, 0.1)}"/>`).join("")}
<path d="M-12 -200a12 12 0 0 1 24 0v34h-24Z" fill="${s.rad(["#fff2b0", "#ffb02e", "#c45a10"], 0.5, 0.6, 0.6)}"/>
<path d="M-14 -40a14 14 0 0 1 28 0v40h-28Z" fill="#1a1410"/>
</g>`;
}
