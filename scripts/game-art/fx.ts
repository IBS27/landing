/**
 * Rendering effects on top of ./kit: photo compositing and grading, bevelled
 * wordmarks, glossy 3D objects with rim light, character faces,
 * realistic playing cards, isometric and pixel-art helpers.
 */
import { join } from "node:path";
import { H, Scene, SUITS, type Suit, shade, W } from "./kit";
import type { PhotoKey } from "./sources";

const CACHE = join(import.meta.dir, ".cache");
const f = (n: number) => Math.round(n * 100) / 100;
type Stop = string | [number, string] | [number, string, number];

/* ───────────── Photos ───────────── */

export type PhotoOpts = {
  /** Box the photo covers (cropped to fill); defaults to the frame. */
  box?: [number, number, number, number];
  align?: string;
  filter?: string;
  opacity?: number;
};

export function photo(s: Scene, key: PhotoKey, o: PhotoOpts = {}) {
  s.photos.add(key);
  const [x, y, w, h] = o.box ?? [0, 0, W, H];
  return `<image href="file://${join(CACHE, "photos", `${key}.jpg`)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${o.align ?? "xMidYMid"} slice"${o.filter ? ` filter="${o.filter}"` : ""}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

/** Colour grade: saturation, contrast, brightness and per-channel gain. */
export function grade(
  s: Scene,
  o: { sat?: number; contrast?: number; bright?: number; rgb?: [number, number, number]; blur?: number } = {},
) {
  const id = s.id("gr");
  const c = o.contrast ?? 1;
  const b = o.bright ?? 0;
  const [r, g, bl] = o.rgb ?? [1, 1, 1];
  const fn = (gain: number, ch: string) =>
    `<feFunc${ch} type="linear" slope="${f(c * gain)}" intercept="${f((1 - c) / 2 + b)}"/>`;
  s.def(
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${o.blur ? `<feGaussianBlur stdDeviation="${o.blur}"/>` : ""}<feColorMatrix type="saturate" values="${o.sat ?? 1}"/><feComponentTransfer>${fn(r, "R")}${fn(g, "G")}${fn(bl, "B")}</feComponentTransfer></filter>`,
  );
  return `url(#${id})`;
}

/** Full-frame gradient laid over the art with a blend mode. */
export function wash(s: Scene, stops: Stop[], mode: string, deg = 90, op = 1) {
  return `<rect width="${W}" height="${H}" fill="${s.lin(stops, deg)}" style="mix-blend-mode:${mode}" opacity="${op}"/>`;
}

/** Soft radial light (screen) or shade (multiply). */
export function glowAt(s: Scene, x: number, y: number, r: number, color: string, op = 0.8, mode = "screen") {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${s.radU(
    [
      [0, color, op],
      [0.4, color, op * 0.45],
      [1, color, 0],
    ],
    x,
    y,
    r,
  )}" style="mix-blend-mode:${mode}"/>`;
}

/** Lens flare streak + rings, for sunlit photos. */
export function flare(s: Scene, x: number, y: number, k = 1, color = "#ffe2a8") {
  const ring = (d: number, r: number, op: number) =>
    `<circle cx="${f(x - (x - W / 2) * d)}" cy="${f(y - (y - H / 2) * d)}" r="${r * k}" fill="${color}" opacity="${op}"/>`;
  return `<g style="mix-blend-mode:screen">${glowAt(s, x, y, 160 * k, color, 0.9)}${glowAt(s, x, y, 40 * k, "#ffffff", 1)}<ellipse cx="${x}" cy="${y}" rx="${260 * k}" ry="${2.2 * k}" fill="${s.rad(
    [
      [0, "#ffffff", 0.9],
      [1, color, 0],
    ],
  )}"/><g filter="${s.blur(2)}">${ring(1.4, 18, 0.12)}${ring(1.8, 8, 0.18)}${ring(2.3, 30, 0.08)}</g></g>`;
}

/* ───────────── Wordmarks ───────────── */

export type Mark = {
  font: string;
  size: number;
  weight?: number;
  italic?: boolean;
  /** Face gradient, top to bottom across the glyphs. */
  face: Stop[];
  /** Thin inner outline (rim) and the thick outer outline. */
  rim?: string;
  rimW?: number;
  outline?: string;
  outlineW?: number;
  /** Solid 3D extrusion below the letters. */
  depth?: number;
  extrude?: string;
  /** Specular bevel strength (0 = flat). */
  bevel?: number;
  shadow?: number;
  tracking?: number;
  /** Arc curvature in px (positive bows the baseline up). */
  arc?: number;
  skew?: number;
  /** Extra filter (e.g. a texture) on the face. */
  faceFilter?: string;
  /** Outer glow colour. */
  glow?: string;
  /** Square stroke joins (pixel fonts). */
  square?: boolean;
};

export type Line = { t: string; dy?: number; dx?: number } & Partial<Mark>;

function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function bevelFilter(s: Scene, strength = 0.8, blur = 1.6, exp = 14, scale = 5) {
  const id = s.id("bv");
  s.def(
    `<filter id="${id}" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/><feSpecularLighting in="b" surfaceScale="${scale}" specularConstant="${strength}" specularExponent="${exp}" lighting-color="#ffffff" result="sp"><feDistantLight azimuth="235" elevation="42"/></feSpecularLighting><feComposite in="sp" in2="SourceAlpha" operator="in" result="sp2"/><feComposite in="SourceGraphic" in2="sp2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter>`,
  );
  return `url(#${id})`;
}

/**
 * Game-logo wordmark: drop shadow, extrusion, outer outline, rim, gradient
 * face with a specular bevel. Lines stack downward from (x, y).
 */
export function wordmark(s: Scene, lines: Line[], x: number, y: number, base: Mark & { rot?: number; anchor?: string }) {
  let cy = y;
  let out = "";
  for (const raw of lines) {
    const m = { ...base, ...raw } as Mark & Line;
    cy += raw.dy ?? 0;
    const lx = x + (raw.dx ?? 0);
    const size = m.size;
    const anchor = base.anchor ?? "middle";
    let pathId = "";
    if (m.arc) {
      pathId = s.id("ap");
      const half = size * m.t.length * 0.62;
      s.def(`<path id="${pathId}" d="M${f(lx - half)} ${f(cy)}Q${lx} ${f(cy - m.arc * 2)} ${f(lx + half)} ${f(cy)}"/>`);
    }
    const txt = (attrs: string, dx = 0, dy = 0) => {
      const common = `font-family="'${m.font}'" font-size="${size}" font-weight="${m.weight ?? 400}"${m.italic ? ` font-style="italic"` : ""} letter-spacing="${m.tracking ?? 0}" ${attrs}`;
      if (pathId)
        return `<text ${common} transform="translate(${f(dx)} ${f(dy)})"><textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${esc(m.t)}</textPath></text>`;
      return `<text x="${f(lx + dx)}" y="${f(cy + dy)}" text-anchor="${anchor}" ${common}>${esc(m.t)}</text>`;
    };
    const top = cy - size * 0.8 - (m.arc ?? 0);
    const faceFill = s.linU(m.face, 0, top, 0, cy + size * 0.08);
    const ow = (m.outlineW ?? 0.16) * size;
    const rw = (m.rimW ?? 0.07) * size;
    const join = m.square ? `stroke-linejoin="miter" stroke-miterlimit="2"` : `stroke-linejoin="round" stroke-linecap="round"`;
    const depth = m.depth ?? 0;
    let line = "";
    if ((m.shadow ?? 0.5) > 0)
      line += `<g filter="${s.blur(size * 0.07)}" opacity="${m.shadow ?? 0.5}">${txt(`fill="#000" stroke="#000" stroke-width="${f(ow + 2)}" ${join}`, size * 0.02, depth + size * 0.08)}</g>`;
    if (m.glow) line += `<g filter="${s.blur(size * 0.18)}" opacity=".9">${txt(`fill="${m.glow}" stroke="${m.glow}" stroke-width="${f(ow * 1.6)}" ${join}`)}</g>`;
    if (m.outline) {
      for (let d = depth; d > 0; d -= m.square ? size / 8 : Math.max(0.8, size * 0.025))
        line += txt(`fill="${m.extrude ?? shade(m.outline, -0.2)}" stroke="${m.extrude ?? shade(m.outline, -0.2)}" stroke-width="${f(ow)}" ${join}`, 0, d);
      line += txt(`fill="${m.outline}" stroke="${m.outline}" stroke-width="${f(ow)}" ${join}`);
    }
    if (m.rim) line += txt(`fill="${m.rim}" stroke="${m.rim}" stroke-width="${f(rw)}" ${join}`);
    const bv = (m.bevel ?? 0.8) > 0 ? bevelFilter(s, m.bevel ?? 0.8, size * 0.035, 14, size * 0.09) : "";
    const face = txt(`fill="${faceFill}"`);
    line += bv ? `<g filter="${bv}">${m.faceFilter ? `<g filter="${m.faceFilter}">${face}</g>` : face}</g>` : face;
    out += m.skew ? `<g transform="translate(${lx} ${cy}) skewX(${m.skew}) translate(${-lx} ${-cy})">${line}</g>` : line;
  }
  return `<g transform="rotate(${base.rot ?? 0} ${x} ${y})">${out}</g>`;
}

/* ───────────── Glossy 3D objects ───────────── */

export type Orb = { base: string; dark?: string; light?: string; rim?: string; bounce?: string; gloss?: number; shadow?: number };

/** Glossy sphere with key light, specular, rim light and bounce light. */
export function orb(s: Scene, x: number, y: number, r: number, o: Orb) {
  const dark = o.dark ?? shade(o.base, -0.55);
  const light = o.light ?? shade(o.base, 0.45);
  const body = s.radU(
    [
      [0, light],
      [0.42, o.base],
      [0.85, dark],
      [1, shade(dark, -0.3)],
    ],
    x - r * 0.35,
    y - r * 0.4,
    r * 1.55,
  );
  const rim = s.radU(
    [
      [0.78, o.rim ?? "#ffffff", 0],
      [0.95, o.rim ?? "#ffffff", 0.55],
      [1, o.rim ?? "#ffffff", 0],
    ],
    x - r * 0.12,
    y - r * 0.14,
    r * 1.12,
  );
  const shadow =
    (o.shadow ?? 0.35) > 0
      ? `<ellipse cx="${f(x + r * 0.1)}" cy="${f(y + r * 0.96)}" rx="${f(r * 0.9)}" ry="${f(r * 0.2)}" fill="#000" opacity="${o.shadow ?? 0.35}" filter="${s.blur(r * 0.08)}"/>`
      : "";
  const clip = s.clip(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
  return `${shadow}<g clip-path="${clip}"><circle cx="${x}" cy="${y}" r="${r}" fill="${body}"/><ellipse cx="${f(x + r * 0.15)}" cy="${f(y + r * 0.85)}" rx="${f(r * 0.7)}" ry="${f(r * 0.35)}" fill="${o.bounce ?? light}" opacity=".4" filter="${s.blur(r * 0.18)}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${rim}"/></g>${spec(s, x, y, r, o.gloss ?? 0.9)}`;
}

/** Specular highlight pair for a round glossy surface of radius r. */
export function spec(s: Scene, x: number, y: number, r: number, op = 0.9) {
  return `<ellipse cx="${f(x - r * 0.36)}" cy="${f(y - r * 0.44)}" rx="${f(r * 0.34)}" ry="${f(r * 0.2)}" transform="rotate(-32 ${f(x - r * 0.36)} ${f(y - r * 0.44)})" fill="#fff" opacity="${op * 0.75}" filter="${s.blur(r * 0.05)}"/><circle cx="${f(x - r * 0.44)}" cy="${f(y - r * 0.5)}" r="${f(r * 0.08)}" fill="#fff" opacity="${op}"/>`;
}

/** Shaded path: gradient body, rim light and gloss, for organic glossy shapes. */
export function glossy(s: Scene, d: string, o: Orb & { box: [number, number, number, number] }) {
  const [bx, by, bw, bh] = o.box;
  const dark = o.dark ?? shade(o.base, -0.55);
  const light = o.light ?? shade(o.base, 0.45);
  const body = s.radU(
    [
      [0, light],
      [0.45, o.base],
      [1, dark],
    ],
    bx + bw * 0.32,
    by + bh * 0.28,
    Math.max(bw, bh) * 0.85,
  );
  const clip = s.clip(`<path d="${d}"/>`);
  return `<g><path d="${d}" fill="${body}"/><g clip-path="${clip}"><path d="${d}" fill="none" stroke="${o.rim ?? "#ffffff"}" stroke-width="${f(bw * 0.06)}" opacity=".45" transform="translate(${f(bw * 0.03)} ${f(bh * 0.03)})" filter="${s.blur(bw * 0.02)}"/><ellipse cx="${f(bx + bw * 0.34)}" cy="${f(by + bh * 0.24)}" rx="${f(bw * 0.2)}" ry="${f(bh * 0.1)}" fill="#fff" opacity="${(o.gloss ?? 0.8) * 0.8}" filter="${s.blur(bw * 0.03)}" transform="rotate(-25 ${f(bx + bw * 0.34)} ${f(by + bh * 0.24)})"/></g></g>`;
}

/** Cartoon face for glossy characters, centred at (x, y), ~k*40 wide. */
export function face(s: Scene, x: number, y: number, k: number, o: { mood?: "smile" | "open" | "grin"; look?: [number, number]; iris?: string; blush?: boolean; brows?: boolean } = {}) {
  const [lx, ly] = o.look ?? [1, 0];
  const eye = (ex: number) => {
    const cx = x + ex * k;
    const cy = y - 4 * k;
    return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(7.5 * k)}" ry="${f(9.5 * k)}" fill="${s.lin(["#ffffff", "#dfe6ee"], 90)}" stroke="#2b1a10" stroke-width="${f(1.1 * k)}"/><circle cx="${f(cx + lx * 2 * k)}" cy="${f(cy + ly * 2 * k + 1 * k)}" r="${f(5 * k)}" fill="${s.rad([shade(o.iris ?? "#5a3a1a", 0.5), o.iris ?? "#5a3a1a"], 0.5, 0.7, 0.6)}"/><circle cx="${f(cx + lx * 2 * k)}" cy="${f(cy + ly * 2 * k + 1 * k)}" r="${f(2.6 * k)}" fill="#120a05"/><circle cx="${f(cx + lx * 2 * k - 1.8 * k)}" cy="${f(cy + ly * 2 * k - 1.6 * k)}" r="${f(1.7 * k)}" fill="#fff"/><circle cx="${f(cx + lx * 2 * k + 1.6 * k)}" cy="${f(cy + ly * 2 * k + 2.4 * k)}" r="${f(0.8 * k)}" fill="#fff"/>`;
  };
  const brows = o.brows
    ? `<path d="M${f(x - 15 * k)} ${f(y - 17 * k)}q6 ${f(-4 * k)} ${f(11 * k)} ${f(-1 * k)}M${f(x + 4 * k)} ${f(y - 18 * k)}q6 ${f(-3 * k)} ${f(11 * k)} ${f(1 * k)}" stroke="#2b1a10" stroke-width="${f(1.8 * k)}" fill="none" stroke-linecap="round"/>`
    : "";
  const mood = o.mood ?? "smile";
  const mouth =
    mood === "smile"
      ? `<path d="M${f(x - 6 * k)} ${f(y + 9 * k)}q${f(6 * k)} ${f(6 * k)} ${f(12 * k)} 0" stroke="#3a1608" stroke-width="${f(1.8 * k)}" fill="none" stroke-linecap="round"/>`
      : `<path d="M${f(x - 8 * k)} ${f(y + 8 * k)}q${f(8 * k)} ${f(mood === "grin" ? 3 * k : -2 * k)} ${f(16 * k)} 0q${f(-2 * k)} ${f(11 * k)} ${f(-8 * k)} ${f(11 * k)}q${f(-6 * k)} 0 ${f(-8 * k)} ${f(-11 * k)}Z" fill="#5a0f12" stroke="#3a1608" stroke-width="${f(1.2 * k)}" stroke-linejoin="round"/><ellipse cx="${f(x)}" cy="${f(y + 16 * k)}" rx="${f(4 * k)}" ry="${f(2.4 * k)}" fill="#ff6f7d"/>${mood === "grin" ? `<path d="M${f(x - 6.5 * k)} ${f(y + 9 * k)}h${f(13 * k)}v${f(2.5 * k)}h${f(-13 * k)}Z" fill="#fff"/>` : ""}`;
  const blush =
    o.blush === false
      ? ""
      : `<g filter="${s.blur(2 * k)}" opacity=".55"><ellipse cx="${f(x - 15 * k)}" cy="${f(y + 6 * k)}" rx="${f(5 * k)}" ry="${f(3 * k)}" fill="#ff5a6e"/><ellipse cx="${f(x + 15 * k)}" cy="${f(y + 6 * k)}" rx="${f(5 * k)}" ry="${f(3 * k)}" fill="#ff5a6e"/></g>`;
  return `<g>${blush}${eye(-8.5)}${eye(8.5)}${brows}${mouth}</g>`;
}

/** Leaf with a vein, gradient and soft shading. */
export function leaf(s: Scene, x: number, y: number, len: number, rot: number, c = "#5fbf3a", dark = "#24751f") {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0C${f(len * 0.3)} ${f(-len * 0.32)} ${f(len * 0.75)} ${f(-len * 0.3)} ${len} 0C${f(len * 0.7)} ${f(len * 0.28)} ${f(len * 0.3)} ${f(len * 0.3)} 0 0Z" fill="${s.lin([shade(c, 0.3), c, dark], 90)}"/><path d="M${f(len * 0.05)} 0Q${f(len * 0.5)} ${f(-len * 0.04)} ${f(len * 0.92)} 0" stroke="${shade(c, 0.5)}" stroke-width="${f(len * 0.03)}" fill="none" opacity=".8"/></g>`;
}

/* ───────────── Cards and chips ───────────── */

const RED = "#d0142a";
const INK = "#15151c";

function pip(suit: Suit, x: number, y: number, k: number, fill: string) {
  return `<path d="${SUITS[suit]}" fill="${fill}" transform="translate(${f(x)} ${f(y)}) scale(${f(k)})"/>`;
}

/**
 * Realistic playing card (60 x 84 at k = 1), centred on (x, y): corner
 * indices, a large centre pip or a court-card panel, soft contact shadow.
 */
export function playingCard(s: Scene, x: number, y: number, k: number, rot: number, rank: string, suit: Suit, o: { back?: string; shadow?: number } = {}) {
  const ink = suit === "heart" || suit === "diamond" ? RED : INK;
  const sh = `<rect x="-30" y="-42" width="60" height="84" rx="5" fill="#000" opacity="${o.shadow ?? 0.45}" filter="${s.blur(4)}" transform="translate(3 6)"/>`;
  const paper = `<rect x="-30" y="-42" width="60" height="84" rx="5" fill="${s.lin(["#ffffff", "#f4f1ea"], 70)}" stroke="#bdb6a8" stroke-width=".6"/>`;
  if (o.back) {
    const pat = s.id("cb");
    s.def(
      `<pattern id="${pat}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${o.back}"/><rect width="3" height="6" fill="${shade(o.back, 0.18)}"/></pattern>`,
    );
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">${sh}${paper}<rect x="-26" y="-38" width="52" height="76" rx="3" fill="url(#${pat})"/><rect x="-26" y="-38" width="52" height="76" rx="3" fill="none" stroke="#fff" stroke-opacity=".7"/><circle r="12" fill="${shade(o.back, -0.25)}" stroke="#f5d77a" stroke-width="1.4"/></g>`;
  }
  const idx = (flip: boolean) =>
    `<g ${flip ? `transform="rotate(180)"` : ""}><text x="-24.5" y="-27" font-family="Abril Fatface" font-size="13" fill="${ink}" text-anchor="middle" transform="translate(4 0)">${rank}</text>${pip(suit, -20.5, -17, 0.33, ink)}</g>`;
  const court = "JQK".includes(rank);
  const center = court
    ? `<rect x="-17" y="-27" width="34" height="54" rx="2" fill="${s.lin(["#fbe7a6", "#e9b949"], 90)}" stroke="${ink}" stroke-width=".8"/><path d="M-10 -6l4 -10 6 7 6 -7 4 10Z" fill="${s.lin(["#fff3b0", "#d79a12"], 90)}" stroke="#7a4a00" stroke-width=".7"/><text y="16" font-family="Abril Fatface" font-size="24" text-anchor="middle" fill="${ink}">${rank}</text>`
    : pip(suit, 0, 2, rank === "A" ? 1.55 : 1.1, ink);
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">${sh}${paper}${idx(false)}${idx(true)}${center}<rect x="-30" y="-42" width="60" height="42" rx="5" fill="#fff" opacity=".18"/></g>`;
}

/** A fan of cards around a pivot below (x, y). */
export function cardFan(s: Scene, x: number, y: number, k: number, cards: [string, Suit][], spread = 12, rot = 0) {
  const n = cards.length;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${cards
    .map(([rank, suit], i) => {
      const a = (i - (n - 1) / 2) * spread;
      const rad = (a * Math.PI) / 180;
      return playingCard(s, f(Math.sin(rad) * 70 * k), f(70 * k - Math.cos(rad) * 70 * k), k, a, rank, suit);
    })
    .join("")}</g>`;
}

/* ───────────── Isometric ───────────── */

export type Iso = { ox: number; oy: number; u: number };
export function isoP(iso: Iso, x: number, y: number, z = 0): [number, number] {
  return [iso.ox + (x - y) * 0.866 * iso.u, iso.oy + (x + y) * 0.5 * iso.u - z * iso.u];
}
const pts = (p: [number, number][]) => p.map(([a, b]) => `${f(a)},${f(b)}`).join(" ");

/** Isometric box at grid (x, y) of size (w, d) and height h with top/left/right colours. */
export function isoBox(iso: Iso, x: number, y: number, w: number, d: number, h: number, c: [string, string, string], z = 0) {
  const P = (a: number, b: number, c2: number) => isoP(iso, a, b, c2);
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const left = [P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)];
  const right = [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)];
  return `<polygon points="${pts(left)}" fill="${c[1]}"/><polygon points="${pts(right)}" fill="${c[2]}"/><polygon points="${pts(top)}" fill="${c[0]}"/>`;
}

/** Isometric hip roof over a w x d footprint at height z. */
export function isoRoof(iso: Iso, x: number, y: number, w: number, d: number, z: number, h: number, c: [string, string], over = 0.2) {
  const P = (a: number, b: number, c2: number) => isoP(iso, a, b, c2);
  const x0 = x - over;
  const y0 = y - over;
  const x1 = x + w + over;
  const y1 = y + d + over;
  const ridgeA = P(x + w / 2, y + d * 0.25, z + h);
  const ridgeB = P(x + w / 2, y + d * 0.75, z + h);
  return `<polygon points="${pts([P(x0, y1, z), P(x1, y1, z), ridgeB, ridgeA])}" fill="${c[1]}"/><polygon points="${pts([P(x1, y0, z), P(x1, y1, z), ridgeB, ridgeA])}" fill="${c[0]}"/><polygon points="${pts([P(x0, y0, z), P(x1, y0, z), ridgeA])}" fill="${shade(c[0], 0.15)}"/><polygon points="${pts([P(x0, y0, z), P(x0, y1, z), ridgeB, ridgeA])}" fill="${shade(c[1], 0.1)}"/>`;
}

/* ───────────── Pixel art ───────────── */

/** Draws a character map (one char per pixel, "." transparent) at pixel size px. */
export function pixels(rows: string[], pal: Record<string, string>, x: number, y: number, px: number) {
  let out = "";
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]];
      if (c) out += `<rect x="${f(x + i * px)}" y="${f(y + j * px)}" width="${f(px + 0.05)}" height="${f(px + 0.05)}" fill="${c}"/>`;
    }
  });
  return out;
}
