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
  /** Commons photos composited into this scene (for attribution). */
  readonly photos = new Set<string>();
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

/* ───────────── Cards ───────────── */

export const SUITS = {
  spade: "M0 -10C6 -4 12 0 12 5c0 4-3 6-6 6-2 0-4-1-5-3l2 7H-3l2-7c-1 2-3 3-5 3-3 0-6-2-6-6 0-5 6-9 12-15Z",
  heart: "M0 11C-6 5 -12 1 -12 -4c0-4 3-7 6-7 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 3 6 7 0 5-6 9-12 15Z",
  diamond: "M0 -12L9 0L0 12L-9 0Z",
  club: "M0 -11a5 5 0 0 1 5 7 5 5 0 1 1 -2 8l2 7H-5l2-7a5 5 0 1 1 -2 -8 5 5 0 0 1 5 -7Z",
} as const;
export type Suit = keyof typeof SUITS;

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
  photos: string[];
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
  /** Warm/cool split-tone grade (default on). */
  tone?: boolean;
  /** Saturation boost (default 1.18). */
  sat?: number;
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
  s.def(`<filter id="${vivid}"><feColorMatrix type="saturate" values="${p.sat ?? 1.18}"/><feComponentTransfer><feFuncR type="linear" slope="1.06" intercept="-.02"/><feFuncG type="linear" slope="1.06" intercept="-.02"/><feFuncB type="linear" slope="1.06" intercept="-.02"/></feComponentTransfer></filter>`);
  const body = `<g filter="url(#${vivid})">${p.art}${bloom}</g>${p.tone === false ? "" : grade}${post}`;
  return {
    photos: [...s.photos],
    cover: s.render(`${body}${p.logo ?? ""}`),
    icon: (vb) => s.render(body, vb),
    focus: p.focus,
  };
}

