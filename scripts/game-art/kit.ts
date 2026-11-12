/**
 * Tiny SVG painting kit for the Gaming key art (see ./build.ts). Every helper
 * returns markup; a Scene collects the gradients and filters it needs.
 * Light comes from the top left, as in most casual-game key art.
 */

export const W = 640;
export const H = 360;

export function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type Stop = string | [number, string] | [number, string, number];

const f = (n: number) => Math.round(n * 100) / 100;

export class Scene {
  private n = 0;
  private defs: string[] = [];
  readonly r: () => number;
  constructor(readonly name: string) {
    this.r = rng(name);
  }
  id(p = "d") {
    return `${p}${this.n++}`;
  }
  def(markup: string) {
    this.defs.push(markup);
  }
  private stops(stops: Stop[]) {
    return stops
      .map((s, i) => {
        const [o, c, a] =
          typeof s === "string" ? [i / Math.max(1, stops.length - 1), s, 1] : [s[0], s[1], s[2] ?? 1];
        return `<stop offset="${f(o)}" stop-color="${c}" stop-opacity="${a}"/>`;
      })
      .join("");
  }
  /** Linear gradient; `deg` 90 = top to bottom, 0 = left to right. */
  lin(stops: Stop[], deg = 90) {
    const id = this.id("l");
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) / 2;
    const y = Math.sin(a) / 2;
    this.def(
      `<linearGradient id="${id}" x1="${f(0.5 - x)}" y1="${f(0.5 - y)}" x2="${f(0.5 + x)}" y2="${f(0.5 + y)}">${this.stops(stops)}</linearGradient>`,
    );
    return `url(#${id})`;
  }
  /** Linear gradient in user space (for long shapes that share one ramp). */
  linU(stops: Stop[], x1: number, y1: number, x2: number, y2: number) {
    const id = this.id("u");
    this.def(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}">${this.stops(stops)}</linearGradient>`,
    );
    return `url(#${id})`;
  }
  rad(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
    const id = this.id("r");
    this.def(
      `<radialGradient id="${id}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fx="${f(fx)}" fy="${f(fy)}">${this.stops(stops)}</radialGradient>`,
    );
    return `url(#${id})`;
  }
  radU(stops: Stop[], cx: number, cy: number, r: number) {
    const id = this.id("q");
    this.def(
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}">${this.stops(stops)}</radialGradient>`,
    );
    return `url(#${id})`;
  }
  blur(sd: number) {
    const id = this.id("b");
    this.def(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`,
    );
    return `url(#${id})`;
  }
  shadow(dy = 4, sd = 4, color = "#000", op = 0.35, dx = 0) {
    const id = this.id("s");
    this.def(
      `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${sd}" flood-color="${color}" flood-opacity="${op}"/></filter>`,
    );
    return `url(#${id})`;
  }
  glow(sd: number, color: string, op = 1) {
    const id = this.id("g");
    this.def(
      `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceAlpha" stdDeviation="${sd}" result="b"/><feFlood flood-color="${color}" flood-opacity="${op}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    );
    return `url(#${id})`;
  }
  clip(markup: string) {
    const id = this.id("c");
    this.def(`<clipPath id="${id}">${markup}</clipPath>`);
    return `url(#${id})`;
  }
  /** Fine painterly grain over the whole frame. */
  grain(op = 0.08) {
    const id = this.id("n");
    this.def(
      `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${Math.floor(this.r() * 99)}"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 1.6 -.55"/></filter>`,
    );
    return `<rect width="${W}" height="${H}" filter="url(#${id})" opacity="${op}" style="mix-blend-mode:overlay"/>`;
  }
  render(body: string, viewBox = `0 0 ${W} ${H}`) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice"><defs>${this.defs.join("")}</defs>${body}</svg>`;
  }
}

/* ───────────── Atmosphere ───────────── */

export function sky(s: Scene, stops: Stop[]) {
  return `<rect width="${W}" height="${H}" fill="${s.lin(stops, 90)}"/>`;
}

export function vignette(s: Scene, op = 0.45, color = "#000") {
  return `<rect width="${W}" height="${H}" fill="${s.rad(
    [
      [0, color, 0],
      [0.62, color, 0],
      [1, color, op],
    ],
    0.5,
    0.48,
    0.75,
  )}"/>`;
}

/** Warm key light washing in from a corner. */
export function lightWash(s: Scene, x: number, y: number, r: number, color = "#fff6d0", op = 0.55) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${s.radU(
    [
      [0, color, op],
      [1, color, 0],
    ],
    x,
    y,
    r,
  )}" style="mix-blend-mode:screen"/>`;
}

export function rays(s: Scene, x: number, y: number, color = "#fff8d6", n = 7, op = 0.22, len = 700) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 0.9 + 0.15 + s.r() * 0.05) * Math.PI;
    const w = 0.03 + s.r() * 0.05;
    const p1 = [x + Math.cos(a - w) * len, y + Math.sin(a - w) * len];
    const p2 = [x + Math.cos(a + w) * len, y + Math.sin(a + w) * len];
    out += `<path d="M${x} ${y}L${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}Z" fill="${s.radU(
      [
        [0, color, op],
        [1, color, 0],
      ],
      x,
      y,
      len,
    )}"/>`;
  }
  return `<g style="mix-blend-mode:screen">${out}</g>`;
}

export function sun(s: Scene, x: number, y: number, r: number, core = "#fffbe8", halo = "#ffe08a") {
  return `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="${s.radU(
    [
      [0, halo, 0.7],
      [0.35, halo, 0.25],
      [1, halo, 0],
    ],
    x,
    y,
    r * 4,
  )}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${core}"/>`;
}

export function cloud(s: Scene, x: number, y: number, k = 1, tint = "#d7e6f5", op = 1) {
  const fill = s.rad(["#ffffff", "#ffffff", tint], 0.4, 0.25, 0.75);
  const puffs: [number, number, number][] = [
    [-46, 6, 22],
    [-20, -10, 30],
    [14, -18, 34],
    [46, -2, 26],
    [66, 10, 18],
    [-2, 10, 26],
    [30, 12, 22],
  ];
  const shape = puffs.map(([px, py, pr]) => `<circle cx="${px}" cy="${py}" r="${pr}"/>`).join("");
  return `<g transform="translate(${x} ${y}) scale(${k})" opacity="${op}"><g fill="${tint}" opacity=".6" transform="translate(4 8)" filter="${s.blur(4)}">${shape}</g><g fill="${fill}">${shape}</g><ellipse cx="6" cy="22" rx="70" ry="8" fill="#fff"/></g>`;
}

export function sparkle(x: number, y: number, r: number, color = "#fff", op = 1) {
  const q = r * 0.18;
  return `<path d="M${x} ${y - r}Q${x + q} ${y - q} ${x + r} ${y}Q${x + q} ${y + q} ${x} ${y + r}Q${x - q} ${y + q} ${x - r} ${y}Q${x - q} ${y - q} ${x} ${y - r}Z" fill="${color}" opacity="${op}"/>`;
}

export function sparkles(s: Scene, n: number, box: [number, number, number, number], color = "#fff", max = 9) {
  const g = s.glow(3, color, 0.9);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = box[0] + s.r() * box[2];
    const y = box[1] + s.r() * box[3];
    out += sparkle(x, y, 2.5 + s.r() * max, color, 0.6 + s.r() * 0.4);
  }
  return `<g filter="${g}">${out}</g>`;
}

export function bokeh(s: Scene, n: number, colors: string[], box: [number, number, number, number] = [0, 0, W, H], rmax = 14) {
  const b = s.blur(2);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${f(box[0] + s.r() * box[2])}" cy="${f(box[1] + s.r() * box[3])}" r="${f(2 + s.r() * rmax)}" fill="${colors[i % colors.length]}" opacity="${f(0.15 + s.r() * 0.45)}"/>`;
  }
  return `<g filter="${b}" style="mix-blend-mode:screen">${out}</g>`;
}

/** Floating embers / dust motes. */
export function embers(s: Scene, n: number, box: [number, number, number, number], color = "#ffb347") {
  const g = s.glow(2.5, color, 1);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${f(box[0] + s.r() * box[2])}" cy="${f(box[1] + s.r() * box[3])}" r="${f(0.8 + s.r() * 2.2)}" fill="#fff3c4" opacity="${f(0.5 + s.r() * 0.5)}"/>`;
  }
  return `<g filter="${g}">${out}</g>`;
}

/* ───────────── Landscape ───────────── */

/** Rolling ridge from a list of heights across the width. */
export function ridge(ys: number[], bottom = H) {
  const step = W / (ys.length - 1);
  let d = `M0 ${ys[0]}`;
  for (let i = 1; i < ys.length; i++) {
    const x0 = (i - 1) * step;
    const x1 = i * step;
    d += ` C${f(x0 + step / 2)} ${ys[i - 1]} ${f(x1 - step / 2)} ${ys[i]} ${f(x1)} ${ys[i]}`;
  }
  return `${d} L${W} ${bottom} L0 ${bottom}Z`;
}

export function hill(s: Scene, ys: number[], top: string, bottom: string, extra = "") {
  const minY = Math.min(...ys);
  return `<path d="${ridge(ys)}" fill="${s.linU([top, bottom], 0, minY, 0, H)}" ${extra}/>`;
}

export function grassTufts(s: Scene, n: number, y0: number, y1: number, color = "#3f8f2a", hi = "#8fd14f") {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = s.r() * W;
    const y = y0 + s.r() * (y1 - y0);
    const h = 6 + s.r() * 10;
    out += `<path d="M${f(x - 4)} ${f(y)}q2 ${f(-h)} 3 ${f(-h * 1.2)}q0 ${f(h * 0.6)} 1 ${f(h * 1.2)}q2 ${f(-h)} 5 ${f(-h * 1.1)}q-1 ${f(h * 0.7)} -1 ${f(h * 1.1)}Z" fill="${s.r() > 0.5 ? color : hi}" opacity=".9"/>`;
  }
  return out;
}

/** Round, layered deciduous tree. */
export function tree(s: Scene, x: number, y: number, k = 1, dark = "#2f7d32", light = "#8fd14f") {
  const leaf = s.rad([light, dark], 0.35, 0.3, 0.8);
  const blobs: [number, number, number][] = [
    [-26, -70, 28],
    [22, -74, 30],
    [0, -100, 32],
    [-14, -50, 22],
    [18, -48, 24],
  ];
  return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="4" cy="2" rx="44" ry="9" fill="#000" opacity=".22"/><path d="M-7 0c3-20 2-40 -2-56h16c-4 16-5 36-2 56Z" fill="${s.lin(["#8a5a32", "#4f2f17"], 0)}"/>${blobs
    .map(([bx, by, br]) => `<circle cx="${bx}" cy="${by}" r="${br}" fill="${leaf}"/>`)
    .join("")}<circle cx="-12" cy="-108" r="10" fill="#fff" opacity=".18"/></g>`;
}

export function pine(s: Scene, x: number, y: number, k = 1, dark = "#1d5b3a", light = "#4fa36a") {
  const g = s.lin([light, dark], 0);
  return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="1" rx="26" ry="6" fill="#000" opacity=".2"/><rect x="-4" y="-16" width="8" height="18" fill="#5a3a20"/><path d="M0 -112L-22 -70h10L-30 -40h12L-38 -12h76L18 -40h12L12 -70h10Z" fill="${g}"/><path d="M0 -112L-22 -70h10L-30 -40h12L-38 -12h38Z" fill="#fff" opacity=".08"/></g>`;
}

export function palm(s: Scene, x: number, y: number, k = 1, flip = false) {
  const leaf = s.lin(["#7ed957", "#2a8f3a"], 90);
  const trunk = s.lin(["#c08a4d", "#7a4f26"], 0);
  const fronds = [-150, -115, -80, -45, -10, 20]
    .map(
      (a) =>
        `<path d="M0 0C30 -14 62 -8 86 14C60 4 32 4 0 6Z" fill="${leaf}" transform="rotate(${a})"/>`,
    )
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${flip ? -k : k} ${k})"><path d="M-6 0C-2 -50 8 -100 26 -140l9 3C20 -96 10 -50 8 0Z" fill="${trunk}"/><g transform="translate(30 -140)">${fronds}<circle r="7" fill="#6b4423"/></g></g>`;
}

/* ───────────── Objects ───────────── */

/** Glossy sphere (fruit, bubbles, balls). */
export function ball(s: Scene, x: number, y: number, r: number, color: string, dark: string, gloss = 0.8) {
  return `<g><ellipse cx="${x + r * 0.15}" cy="${y + r * 0.95}" rx="${r * 0.85}" ry="${r * 0.22}" fill="#000" opacity=".22"/><circle cx="${x}" cy="${y}" r="${r}" fill="${s.rad([color, color, dark], 0.38, 0.32, 0.72)}"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.42}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity="${gloss}" transform="rotate(-30 ${x - r * 0.35} ${y - r * 0.42})"/><circle cx="${x + r * 0.42}" cy="${y + r * 0.38}" r="${r * 0.5}" fill="#fff" opacity=".08"/></g>`;
}

export function bubble(s: Scene, x: number, y: number, r: number, color: string) {
  return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${s.rad(
    [
      [0, "#ffffff", 0.9],
      [0.25, color, 0.75],
      [0.85, color, 0.95],
      [1, "#ffffff", 0.9],
    ],
    0.35,
    0.3,
    0.7,
  )}"/><ellipse cx="${x - r * 0.38}" cy="${y - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.16}" fill="#fff" transform="rotate(-35 ${x - r * 0.38} ${y - r * 0.4})"/></g>`;
}

const GEM_SHAPES = {
  round: "M0 -1L.71 -.71L1 0L.71 .71L0 1L-.71 .71L-1 0L-.71 -.71Z",
  diamond: "M-.55 -.7H.55L1 -.15L0 1L-1 -.15Z",
  square: "M-.8 -.8H.8V.8H-.8Z",
  tri: "M0 -1L1 .8H-1Z",
  hex: "M-.5 -.87H.5L1 0L.5 .87H-.5L-1 0Z",
} as const;
export type GemShape = keyof typeof GEM_SHAPES;

/** Faceted, glowing gem. */
export function gem(s: Scene, x: number, y: number, size: number, color: string, dark: string, shape: GemShape = "diamond") {
  const d = GEM_SHAPES[shape];
  const body = s.lin([[0, "#ffffff", 1], [0.25, color], [1, dark]], 70);
  return `<g transform="translate(${x} ${y}) scale(${size})"><path d="${d}" fill="${body}" stroke="${dark}" stroke-width=".06" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".03" transform="scale(.62)"/><path d="${d}" fill="${color}" opacity=".55" transform="scale(.55)"/><path d="M-.35 -.45L-.05 -.45L-.3 .05Z" fill="#fff" opacity=".85"/><circle cx=".35" cy=".3" r=".08" fill="#fff" opacity=".7"/></g>`;
}

const SUITS = {
  spade: "M0 -10C6 -4 12 0 12 5c0 4-3 6-6 6-2 0-4-1-5-3l2 7H-3l2-7c-1 2-3 3-5 3-3 0-6-2-6-6 0-5 6-9 12-15Z",
  heart: "M0 11C-6 5 -12 1 -12 -4c0-4 3-7 6-7 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 3 6 7 0 5-6 9-12 15Z",
  diamond: "M0 -12L9 0L0 12L-9 0Z",
  club: "M0 -11a5 5 0 0 1 5 7 5 5 0 1 1 -2 8l2 7H-5l2-7a5 5 0 1 1 -2 -8 5 5 0 0 1 5 -7Z",
} as const;
export type Suit = keyof typeof SUITS;

/** Playing card, 50 x 70 at k = 1, centred on (x, y). */
export function card(s: Scene, x: number, y: number, k: number, rot: number, rank: string, suit: Suit, back?: string) {
  const red = suit === "heart" || suit === "diamond";
  const ink = red ? "#d61f2c" : "#1b1b24";
  const shadow = s.shadow(3, 3, "#000", 0.35);
  if (back)
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})" filter="${shadow}"><rect x="-25" y="-35" width="50" height="70" rx="5" fill="#fff"/><rect x="-21" y="-31" width="42" height="62" rx="3" fill="${back}"/><path d="M-21 -31l42 62M21 -31l-42 62" stroke="#fff" stroke-opacity=".25" stroke-width="6"/><rect x="-21" y="-31" width="42" height="62" rx="3" fill="none" stroke="#fff" stroke-opacity=".5"/></g>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})" filter="${shadow}"><rect x="-25" y="-35" width="50" height="70" rx="5" fill="${s.lin(["#ffffff", "#eef0f4"], 90)}" stroke="#c9ccd3" stroke-width=".8"/><text x="-19" y="-18" font-family="Montserrat" font-weight="800" font-size="14" fill="${ink}">${rank}</text><path d="${SUITS[suit]}" fill="${ink}" transform="translate(-14 -6) scale(.42)"/><path d="${SUITS[suit]}" fill="${ink}" transform="translate(2 12) scale(1.15)"/></g>`;
}

export function suitPath(suit: Suit) {
  return SUITS[suit];
}

/** Gold coin seen at an angle. */
export function coin(s: Scene, x: number, y: number, r: number, tilt = 0.45, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse cy="${r * tilt * 0.35}" rx="${r}" ry="${r * tilt}" fill="#a86a0c"/><ellipse rx="${r}" ry="${r * tilt}" fill="${s.lin(["#fff3a8", "#ffcc33", "#d18a10"], 60)}"/><ellipse rx="${r * 0.7}" ry="${r * tilt * 0.7}" fill="none" stroke="#b87a12" stroke-width="${r * 0.08}"/><ellipse cx="${-r * 0.35}" cy="${-r * tilt * 0.3}" rx="${r * 0.25}" ry="${r * tilt * 0.18}" fill="#fff" opacity=".7"/></g>`;
}

/* ───────────── Characters ───────────── */

export type Chibi = {
  skin?: string;
  hair?: string;
  style?: "bob" | "pony" | "short" | "curly" | "bun" | "none";
  shirt?: string;
  shirt2?: string;
  hat?: "safari" | "helmet" | "crown" | "cap" | "none";
  hatColor?: string;
  mouth?: "smile" | "open" | "grin";
  eye?: string;
  /** Show only the bust (head + shoulders). */
  bust?: boolean;
  wave?: boolean;
  item?: string;
};

const OUT = "#3a2416";

/**
 * A cute, big-headed game mascot. Local origin is between the feet; the head
 * centre sits at (0, -118) and the figure is ~160 tall at k = 1.
 */
export function chibi(s: Scene, x: number, y: number, k: number, o: Chibi = {}) {
  const skin = o.skin ?? "#f6c9a4";
  const skinDark = shade(skin, -0.18);
  const hair = o.hair ?? "#5b3416";
  const shirt = o.shirt ?? "#e8483b";
  const shirt2 = o.shirt2 ?? shade(shirt, -0.3);
  const eye = o.eye ?? "#3b2a1c";
  const skinG = s.rad([shade(skin, 0.08), skin, skinDark], 0.38, 0.32, 0.75);
  const hairG = s.lin([shade(hair, 0.25), hair, shade(hair, -0.25)], 70);
  const shirtG = s.lin([shade(shirt, 0.15), shirt, shirt2], 60);
  const sw = 2.4;
  const body = o.bust
    ? ""
    : `<ellipse cx="0" cy="2" rx="40" ry="8" fill="#000" opacity=".25"/><path d="M-20 -4l2 -34h14l-1 34Z M6 -4l-2 -34h14l2 34Z" fill="${shade(shirt2, -0.2)}" stroke="${OUT}" stroke-width="${sw}"/><path d="M-24 0h20v-6h-20Z M4 0h22v-6h-22Z" fill="#3d2a20" stroke="${OUT}" stroke-width="${sw}"/>`;
  const torso = `<path d="M-30 ${o.bust ? 10 : -34}C-32 -60 -24 -78 0 -80C24 -78 32 -60 30 ${o.bust ? 10 : -34}Z" fill="${shirtG}" stroke="${OUT}" stroke-width="${sw}"/><path d="M-12 -79l12 14 12 -14" fill="none" stroke="${shade(shirt, -0.35)}" stroke-width="2.5"/>`;
  const armL = `<path d="M-26 -72C-40 -60 -44 -44 -40 -34" fill="none" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/><path d="M-26 -72C-40 -60 -44 -44 -40 -34" fill="none" stroke="${shirt}" stroke-width="10" stroke-linecap="round"/><circle cx="-40" cy="-32" r="7" fill="${skin}" stroke="${OUT}" stroke-width="${sw}"/>`;
  const armR = o.wave
    ? `<path d="M26 -72C40 -84 46 -100 44 -114" fill="none" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/><path d="M26 -72C40 -84 46 -100 44 -114" fill="none" stroke="${shirt}" stroke-width="10" stroke-linecap="round"/><circle cx="44" cy="-118" r="8" fill="${skin}" stroke="${OUT}" stroke-width="${sw}"/>`
    : `<path d="M26 -72C40 -60 44 -44 40 -34" fill="none" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/><path d="M26 -72C40 -60 44 -44 40 -34" fill="none" stroke="${shirt}" stroke-width="10" stroke-linecap="round"/><circle cx="40" cy="-32" r="7" fill="${skin}" stroke="${OUT}" stroke-width="${sw}"/>`;
  const hy = -118;
  const hairBack =
    o.style === "pony"
      ? `<path d="M26 -132c22 4 30 30 18 52c-4 -18 -14 -26 -24 -30Z" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/>`
      : o.style === "bob"
        ? `<path d="M-40 ${hy}c-4 30 2 44 12 50h56c10 -6 16 -20 12 -50Z" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/>`
        : o.style === "bun"
          ? `<circle cx="0" cy="${hy - 44}" r="14" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/>`
          : "";
  const head = `<ellipse cx="0" cy="${hy}" rx="38" ry="36" fill="${skinG}" stroke="${OUT}" stroke-width="${sw}"/><ellipse cx="-38" cy="${hy + 4}" rx="6" ry="8" fill="${skin}" stroke="${OUT}" stroke-width="${sw}"/><ellipse cx="38" cy="${hy + 4}" rx="6" ry="8" fill="${skin}" stroke="${OUT}" stroke-width="${sw}"/>`;
  const eyes = [-14, 14]
    .map(
      (ex) =>
        `<ellipse cx="${ex}" cy="${hy + 4}" rx="7" ry="9" fill="#fff" stroke="${OUT}" stroke-width="1.6"/><ellipse cx="${ex + 1}" cy="${hy + 6}" rx="5" ry="6.5" fill="${eye}"/><circle cx="${ex + 1}" cy="${hy + 7}" r="2.6" fill="#120a05"/><circle cx="${ex - 1}" cy="${hy + 3}" r="2.2" fill="#fff"/><circle cx="${ex + 3}" cy="${hy + 9}" r="1" fill="#fff"/>`,
    )
    .join("");
  const mouth =
    o.mouth === "open"
      ? `<path d="M-8 ${hy + 20}q8 12 16 0Z" fill="#8b2a2a" stroke="${OUT}" stroke-width="1.6"/><path d="M-4 ${hy + 25}q4 3 8 0" fill="#f28c8c"/>`
      : o.mouth === "grin"
        ? `<path d="M-10 ${hy + 18}q10 10 20 0Z" fill="#fff" stroke="${OUT}" stroke-width="1.6"/>`
        : `<path d="M-7 ${hy + 19}q7 7 14 0" fill="none" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="-22" cy="${hy + 14}" rx="6" ry="3.5" fill="#ff7a7a" opacity=".45"/><ellipse cx="22" cy="${hy + 14}" rx="6" ry="3.5" fill="#ff7a7a" opacity=".45"/>`;
  const brows = `<path d="M-20 ${hy - 10}q6 -4 12 0M8 ${hy - 10}q6 -4 12 0" fill="none" stroke="${shade(hair, -0.2)}" stroke-width="2.6" stroke-linecap="round"/>`;
  const fringe =
    o.style === "none"
      ? ""
      : o.style === "curly"
        ? `<path d="M-40 ${hy - 2}c-6 -30 14 -48 40 -46c26 -2 46 16 40 46c-6 -8 -10 -12 -16 -12c-2 6 -8 8 -12 4c-4 6 -12 6 -16 0c-4 4 -10 2 -12 -4c-6 0 -12 4 -16 12Z" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/>`
        : o.style === "short"
          ? `<path d="M-39 ${hy - 4}c-2 -28 16 -42 39 -42c24 0 42 14 39 42c-10 -14 -24 -20 -40 -18c-8 -2 -20 4 -38 18Z" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/>`
          : `<path d="M-40 ${hy + 2}c-6 -34 14 -50 40 -50c28 0 46 18 40 50c-6 -14 -12 -22 -20 -24c-10 10 -30 14 -44 12c-8 2 -14 6 -16 12Z" fill="${hairG}" stroke="${OUT}" stroke-width="${sw}"/><path d="M-22 ${hy - 36}q14 -8 30 -4" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>`;
  const hatC = o.hatColor ?? "#c8a26a";
  const hat =
    o.hat === "safari"
      ? `<path d="M-58 ${hy - 26}q58 -16 116 0q-10 10 -24 8l-4 -26q-30 -16 -60 0l-4 26q-14 2 -24 -8Z" fill="${s.lin([shade(hatC, 0.2), hatC, shade(hatC, -0.25)], 90)}" stroke="${OUT}" stroke-width="${sw}"/><path d="M-30 ${hy - 26}h60" stroke="#7a4f26" stroke-width="5"/>`
      : o.hat === "crown"
        ? `<path d="M-26 ${hy - 30}l-6 -30 16 14 16 -24 16 24 16 -14 -6 30Z" fill="${s.lin(["#fff3a8", "#ffc933", "#c98a10"], 90)}" stroke="#7a4a00" stroke-width="${sw}"/><circle cx="0" cy="${hy - 46}" r="4" fill="#e0245e"/>`
        : o.hat === "helmet"
          ? `<path d="M-42 ${hy - 2}c-4 -40 20 -58 42 -58s46 18 42 58h-12c0 -10 -2 -16 -6 -18h-48c-4 2 -6 8 -6 18Z" fill="${s.lin(["#e9eef5", "#9aa7b8", "#5c6878"], 60)}" stroke="#1f2630" stroke-width="${sw}"/><path d="M0 ${hy - 60}v-14" stroke="#c0392b" stroke-width="8" stroke-linecap="round"/>`
          : o.hat === "cap"
            ? `<path d="M-38 ${hy - 14}c0 -30 18 -40 38 -40s38 10 38 40Z" fill="${s.lin([shade(hatC, 0.2), hatC], 90)}" stroke="${OUT}" stroke-width="${sw}"/><path d="M14 ${hy - 16}q30 -2 40 8q-22 4 -40 2Z" fill="${shade(hatC, -0.2)}" stroke="${OUT}" stroke-width="${sw}"/>`
            : "";
  return `<g transform="translate(${x} ${y}) scale(${k})">${body}${o.bust ? "" : armL}${torso}${o.bust ? "" : armR}${hairBack}${head}${fringe}${brows}${eyes}${blush}${mouth}${hat}${o.item ?? ""}</g>`;
}

/* ───────────── Logos ───────────── */

export type LogoOpts = {
  size?: number;
  fill?: [string, string];
  stroke?: string;
  rim?: string;
  font?: string;
  rot?: number;
  anchor?: "start" | "middle" | "end";
  lh?: number;
  tracking?: number;
};

/** Chunky casual-game wordmark: dark outline, coloured rim, gradient face, gloss. */
export function logo(s: Scene, lines: string[], x: number, y: number, o: LogoOpts = {}) {
  const size = o.size ?? 40;
  const lh = o.lh ?? size * 0.92;
  const [top, bottom] = o.fill ?? ["#fff6b0", "#ffb000"];
  const font = o.font ?? "Montserrat";
  const anchor = o.anchor ?? "middle";
  const face = s.linU([[0, top], [0.55, top], [0.56, bottom], [1, shade(bottom, -0.1)]], 0, y - size, 0, y + (lines.length - 1) * lh + size * 0.1);
  const shadow = s.shadow(3, 2, "#000", 0.45);
  const text = (l: string, i: number, attrs: string) =>
    `<text x="${x}" y="${f(y + i * lh)}" text-anchor="${anchor}" font-family="${font}" font-weight="900" font-size="${size}" letter-spacing="${o.tracking ?? -0.5}" ${attrs}>${esc(l)}</text>`;
  const outer = lines.map((l, i) => text(l, i, `fill="${o.stroke ?? "#3a1c00"}" stroke="${o.stroke ?? "#3a1c00"}" stroke-width="${size * 0.32}" stroke-linejoin="round"`)).join("");
  const rim = lines.map((l, i) => text(l, i, `fill="${o.rim ?? "#ffffff"}" stroke="${o.rim ?? "#ffffff"}" stroke-width="${size * 0.14}" stroke-linejoin="round"`)).join("");
  const faceT = lines.map((l, i) => text(l, i, `fill="${face}"`)).join("");
  return `<g transform="rotate(${o.rot ?? -4} ${x} ${y})"><g filter="${shadow}">${outer}</g>${rim}${faceT}</g>`;
}

function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/* ───────────── Colour ───────────── */

export function shade(hex: string, amt: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)))),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/* ───────────── Output ───────────── */

export type Art = {
  cover: string;
  icon: (viewBox: string) => string;
  focus: [number, number, number];
};

export type Paint = {
  art: string;
  logo?: string;
  /** Overlays applied to both cover and icon (vignette, grain). */
  post?: string;
  focus: [number, number, number];
  /** Strength of the bloom pass (0 to disable). */
  bloom?: number;
};

export function finish(s: Scene, p: Paint): Art {
  const post = p.post ?? `${vignette(s, 0.35)}${s.grain(0.07)}`;
  // Bloom: a blurred copy screened over the art makes highlights glow like a
  // painted, lit render; the grade warms the top left and cools the bottom right.
  const bloom = `<g filter="${s.blur(7)}" opacity="${p.bloom ?? 0.14}" style="mix-blend-mode:screen">${p.art}</g>`;
  const grade = `<rect width="${W}" height="${H}" fill="${s.lin(
    [
      [0, "#ffd9a0", 0.5],
      [0.5, "#808080", 0],
      [1, "#3a4a8a", 0.5],
    ],
    35,
  )}" style="mix-blend-mode:soft-light"/>`;
  const vivid = s.id("v");
  s.def(`<filter id="${vivid}"><feColorMatrix type="saturate" values="1.18"/><feComponentTransfer><feFuncR type="linear" slope="1.06" intercept="-.02"/><feFuncG type="linear" slope="1.06" intercept="-.02"/><feFuncB type="linear" slope="1.06" intercept="-.02"/></feComponentTransfer></filter>`);
  const body = `<g filter="url(#${vivid})">${p.art}${bloom}</g>${grade}${post}`;
  return {
    cover: s.render(`${body}${p.logo ?? ""}`),
    icon: (vb) => s.render(body, vb),
    focus: p.focus,
  };
}

