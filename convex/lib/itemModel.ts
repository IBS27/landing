import { type Infer, v } from "convex/values";
import { type Finish, finish, type Part, part, partExtents, xyz } from "./unitAppearance";
import { ITEM_LIMITS, type PlacementKind, placementKind } from "./unitScene";
import { COLORS } from "./vibe";

/**
 * A Marketplace item's 3D model for Landing Home's Apartment tab (#150): a
 * bounded list of the same primitives unit fixtures use, never code, assets
 * or URLs. Muse builds one per placed listing (`muse.itemModel`); until it is
 * ready, and whenever AI is off, the tab shows `proxyModel`.
 *
 * Axes: the origin is the centre of the item's footprint on its base. x is
 * width, y is up, z is depth. The back of the item is at −z and its front
 * faces +z, the same as the editor's furniture (`Furniture` in UnitCanvas).
 */
export const itemModel = v.object({
  /** Metres: the bounding box's width (x), height (y) and depth (z). */
  size: xyz,
  materials: v.array(finish),
  /** Positions are part centres, relative to the origin; sizes are full extents. */
  parts: v.array(part),
  /**
   * Flat things (rugs, posters, prints): the renderer draws the listing's
   * first photo on this face of `parts[0]`: "front" is +z, "top" is +y. The
   * model never supplies a URL.
   */
  photo: v.optional(v.union(v.literal("front"), v.literal("top"))),
  notes: v.array(v.string()),
});
export type ItemModel = Infer<typeof itemModel>;
export const itemModelStatus = v.union(
  v.literal("building"),
  v.literal("ready"),
  v.literal("failed"),
);
/**
 * The `itemModels` table: one row per owner and listing, private to the owner
 * (Muse may read the listing's photos to build it, which needs a private audience).
 */
export const itemModelFields = {
  ownerId: v.id("users"),
  listingId: v.id("listings"),
  kind: placementKind,
  status: itemModelStatus,
  model: v.optional(itemModel),
  error: v.optional(v.string()),
  runId: v.optional(v.id("aiRuns")),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export type ItemSize = { width: number; depth: number; height: number };

export const ITEM_MODEL_LIMITS = {
  materials: 12,
  parts: 48,
  notes: 4,
  noteMax: 200,
  bytes: 24_000,
} as const;

const finite = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
const HEX = /^#[0-9a-f]{6}$/i;

/** Everything wrong with a model beyond its shape: IDs, colours, ranges, bounds and size. */
export function itemModelProblems(model: ItemModel): string[] {
  const L = ITEM_MODEL_LIMITS;
  const { size, materials, parts, notes } = model;
  if (materials.length > L.materials || parts.length > L.parts)
    return [`Use at most ${L.materials} materials and ${L.parts} parts`];
  if (new TextEncoder().encode(JSON.stringify(model)).byteLength > L.bytes)
    return ["Model exceeds storage limits"];
  const errors: string[] = [];
  const vector = (p: { x: number; y: number; z: number }, min: number, max: number) =>
    [p.x, p.y, p.z].every((n) => finite(n, min, max));
  if (!vector(size, ITEM_LIMITS.min, ITEM_LIMITS.max))
    errors.push(`size: each side is ${ITEM_LIMITS.min}–${ITEM_LIMITS.max} m`);
  if (!parts.length) errors.push("parts: at least one part");
  const ids = new Set<string>();
  for (const m of materials) {
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(m.id) || ids.has(m.id))
      errors.push(`Invalid or duplicate material id ${m.id.slice(0, 60)}`);
    ids.add(m.id);
    if (!HEX.test(m.color) || !finite(m.roughness, 0, 1) || !finite(m.repeat, 0.02, 5))
      errors.push(`${m.id.slice(0, 60)}: invalid material`);
  }
  if (errors.length) return [...new Set(errors)].slice(0, 20);
  // Relative rounding allowance, as fixtures have.
  const tolerance = 0.01 * Math.max(size.x, size.y, size.z);
  for (const [i, p] of parts.entries()) {
    if (
      !ids.has(p.materialId) ||
      !vector(p.size, 0.001, 15) ||
      !vector(p.position, -15, 15) ||
      !vector(p.rotation, -Math.PI * 2, Math.PI * 2)
    ) {
      errors.push(`parts[${i}]: invalid part or unknown material`);
      continue;
    }
    const [hx, hy, hz] = partExtents(p);
    if (
      Math.abs(p.position.x) + hx > size.x / 2 + tolerance ||
      p.position.y - hy < -tolerance ||
      p.position.y + hy > size.y + tolerance ||
      Math.abs(p.position.z) + hz > size.z / 2 + tolerance
    )
      errors.push(`parts[${i}]: outside the bounding box`);
  }
  const first = parts[0];
  if (
    model.photo &&
    first &&
    (first.shape !== "box" || first.rotation.x || first.rotation.y || first.rotation.z)
  )
    errors.push("photo: parts[0] must be an unrotated box (the face the photo is drawn on)");
  if (notes.length > L.notes || notes.some((n) => n.length > L.noteMax))
    errors.push(`notes: at most ${L.notes}, each up to ${L.noteMax} characters`);
  return [...new Set(errors)].slice(0, 20);
}

/* ---------------- Colours ---------------- */

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) =>
  `#${rgb
    .map((n) =>
      Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
/** A darker (`f` < 1) or lighter (`f` > 1) shade of a hex colour. */
export function shade(hex: string, f: number) {
  const rgb = channels(HEX.test(hex) ? hex : NEUTRAL);
  return toHex(rgb.map((n) => (f <= 1 ? n * f : n + (255 - n) * (f - 1))));
}

/** The colour of an item nothing is known about. */
export const NEUTRAL = "#b9ab98";

const COLOR_WORDS: readonly (readonly [RegExp, string])[] = [
  ...COLORS.map(
    (c) => [new RegExp(`\\b${c.label.toLowerCase()}\\b`), c.hex.toLowerCase()] as const,
  ),
  [/\b(white|ivory)\b/, "#f1eee8"],
  [/\b(cream|beige|linen|oatmeal|natural)\b/, "#dccfb8"],
  [/\b(black|ebony)\b/, "#1c1c1e"],
  [/\b(charcoal|graphite|slate)\b/, "#45464a"],
  [/\b(gr[ae]y|silver|chrome|steel|concrete)\b/, "#9a9da1"],
  [/\b(walnut|espresso|mahogany|dark wood)\b/, "#6b4a32"],
  [/\b(teak|oak|pine|birch|maple|bamboo|rattan|wicker|cane|jute|wood|wooden)\b/, "#b98a5a"],
  [/\b(brown|leather|tan|cognac)\b/, "#8a5a3c"],
  [/\b(terracotta|rust|clay)\b/, "#c2643f"],
  [/\b(mustard|yellow|gold|brass)\b/, "#d4a137"],
  [/\b(orange)\b/, "#d9813a"],
  [/\b(red|burgundy|maroon)\b/, "#a33a35"],
  [/\b(pink|blush|rose)\b/, "#e3b5a4"],
  [/\b(purple|plum|lavender)\b/, "#7d6a9c"],
  [/\b(navy|indigo)\b/, "#22324f"],
  [/\b(blue|teal|denim)\b/, "#4f7fa3"],
  [/\b(sage|olive)\b/, "#a3b18a"],
  [/\b(green|emerald|forest)\b/, "#3f6b4c"],
];
/** A hex colour from the colour and material words in a listing's title; neutral when it names none. */
export function colorFromText(text: string): string {
  const t = text.toLowerCase();
  let best: { at: number; hex: string } | null = null;
  for (const [re, hex] of COLOR_WORDS) {
    const at = t.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { at, hex };
  }
  return best?.hex ?? NEUTRAL;
}

/* ---------------- Stand-in models ---------------- */

type Pattern = Finish["pattern"];
type Shape = Part["shape"];
/** [shape, material, centre x, centre y, centre z, size x, size y, size z] in metres. */
type Spec = readonly [Shape, string, number, number, number, number, number, number];

const material = (
  id: string,
  color: string,
  pattern: Pattern,
  roughness: number,
  repeat: number,
): Finish => ({ id, color, pattern, roughness, repeat });
const round = (n: number) => Math.round(n * 1e5) / 1e5;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Clamps every part inside the bounding box, so any valid placement size gives a valid model. */
function assemble(
  { width: w, depth: d, height: h }: ItemSize,
  materials: Finish[],
  specs: readonly Spec[],
  photo?: "front" | "top",
): ItemModel {
  const parts = specs.map(([shape, materialId, x, y, z, sx, sy, sz]): Part => {
    const size = { x: clamp(sx, 0.001, w), y: clamp(sy, 0.001, h), z: clamp(sz, 0.001, d) };
    return {
      shape,
      materialId,
      size: { x: round(size.x), y: round(size.y), z: round(size.z) },
      position: {
        x: round(clamp(x, -(w - size.x) / 2, (w - size.x) / 2)),
        y: round(clamp(y, size.y / 2, h - size.y / 2)),
        z: round(clamp(z, -(d - size.z) / 2, (d - size.z) / 2)),
      },
      rotation: { x: 0, y: 0, z: 0 },
    };
  });
  return {
    size: { x: w, y: h, z: d },
    materials,
    parts,
    ...(photo ? { photo } : {}),
    notes: ["A stand-in shape for this kind of item, not a model of the listing."],
  };
}

/** Four legs inset from the corners, from the floor to `top`. */
function legs(shape: Shape, m: string, w: number, d: number, top: number, t: number): Spec[] {
  const x = w / 2 - t * 0.9,
    z = d / 2 - t * 0.9;
  return [
    [-x, -z],
    [x, -z],
    [-x, z],
    [x, z],
  ].map(([lx, lz]) => [shape, m, lx, top / 2, lz, t, top, t] as const);
}

const WOOD_DARK = "#4a3626";
const METAL_DARK = "#2e2f33";

/**
 * A deterministic, recognisable stand-in for one kind of item at a placement's
 * size, tinted with `color`: shown before Muse's model is ready and whenever
 * AI is off. Valid (`itemModelProblems`) for every size a placement can have.
 */
export function proxyModel(kind: PlacementKind, size: ItemSize, color: string): ItemModel {
  const { width: w, depth: d, height: h } = size;
  const c = HEX.test(color) ? color.toLowerCase() : NEUTRAL;
  const s = Math.min(w, d);
  switch (kind) {
    case "sofa": {
      const leg = Math.min(0.12, h * 0.14),
        seat = h * 0.46,
        arm = Math.min(0.22, w * 0.12),
        back = Math.min(0.24, d * 0.26),
        inner = w - 2 * arm,
        n = inner > 2.1 ? 3 : inner > 1.1 ? 2 : 1,
        gap = Math.min(0.02, inner * 0.02),
        cushion = (inner - gap * (n + 1)) / n,
        pad = h * 0.14;
      const cushions = Array.from({ length: n }, (_, i) => {
        const x = -inner / 2 + gap + cushion / 2 + i * (cushion + gap);
        return [
          ["box", "cushion", x, seat + pad / 2, back / 2, cushion, pad, d - back - gap],
          [
            "box",
            "cushion",
            x,
            seat + pad + (h * 0.96 - seat - pad) / 2,
            -d / 2 + back + Math.min(0.07, d * 0.08),
            cushion,
            h * 0.96 - seat - pad,
            Math.min(0.14, d * 0.16),
          ],
        ] as Spec[];
      }).flat();
      return assemble(
        size,
        [
          material("fabric", c, "fabric", 0.92, 0.3),
          material("cushion", shade(c, 1.12), "fabric", 0.95, 0.25),
          material("leg", WOOD_DARK, "wood", 0.55, 0.8),
        ],
        [
          ["box", "fabric", 0, leg + (seat - leg) / 2, 0, w, seat - leg, d],
          ["box", "fabric", 0, seat + (h - seat) / 2, -d / 2 + back / 2, inner, h - seat, back],
          ["box", "fabric", -w / 2 + arm / 2, leg + (h * 0.7 - leg) / 2, 0, arm, h * 0.7 - leg, d],
          ["box", "fabric", w / 2 - arm / 2, leg + (h * 0.7 - leg) / 2, 0, arm, h * 0.7 - leg, d],
          ...cushions,
          ...legs("cylinder", "leg", w, d, leg, Math.min(0.06, s * 0.08)),
        ],
      );
    }
    case "bed": {
      const leg = Math.min(0.1, h * 0.1),
        frame = h * 0.32,
        top = h * 0.56,
        board = Math.min(0.08, d * 0.05),
        length = d - board,
        mid = board / 2,
        pillows = w > 1.1 ? 2 : 1,
        pillow = (w * 0.86) / pillows;
      return assemble(
        size,
        [
          material("frame", shade(c, 0.62), "wood", 0.6, 1),
          material("mattress", "#f2efe8", "fabric", 0.95, 0.3),
          material("pillow", "#ffffff", "fabric", 0.9, 0.2),
          material("duvet", c, "fabric", 0.95, 0.35),
        ],
        [
          ["box", "frame", 0, leg + (frame - leg) / 2, 0, w, frame - leg, d],
          ["box", "frame", 0, h / 2, -d / 2 + board / 2, w, h, board],
          [
            "box",
            "mattress",
            0,
            frame + (top - frame) / 2,
            mid,
            w * 0.96,
            top - frame,
            length * 0.97,
          ],
          [
            "box",
            "duvet",
            0,
            top + h * 0.025,
            mid + length * 0.16,
            w * 0.98,
            h * 0.05,
            length * 0.64,
          ],
          ...Array.from(
            { length: pillows },
            (_, i): Spec => [
              "box",
              "pillow",
              pillows === 1 ? 0 : (i === 0 ? -1 : 1) * w * 0.23,
              top + h * 0.06,
              -d / 2 + board + length * 0.12,
              pillow * 0.9,
              h * 0.11,
              length * 0.18,
            ],
          ),
          ...legs("box", "frame", w, d, leg, Math.min(0.08, s * 0.08)),
        ],
      );
    }
    case "table": {
      const top = Math.min(0.05, h * 0.08),
        leg = Math.min(0.07, s * 0.09),
        apron = Math.min(0.08, h * 0.12),
        rail = Math.min(0.022, s * 0.04);
      const under = h - top;
      return assemble(
        size,
        [material("top", c, "wood", 0.55, 1), material("leg", shade(c, 0.78), "wood", 0.6, 0.8)],
        [
          ["box", "top", 0, h - top / 2, 0, w, top, d],
          ["box", "leg", 0, under - apron / 2, -d / 2 + leg, w - leg * 2.4, apron, rail],
          ["box", "leg", 0, under - apron / 2, d / 2 - leg, w - leg * 2.4, apron, rail],
          ["box", "leg", -w / 2 + leg, under - apron / 2, 0, rail, apron, d - leg * 2.4],
          ["box", "leg", w / 2 - leg, under - apron / 2, 0, rail, apron, d - leg * 2.4],
          ...legs("box", "leg", w, d, under, leg),
        ],
      );
    }
    case "desk": {
      const top = Math.min(0.04, h * 0.06),
        leg = Math.min(0.045, s * 0.08),
        under = h - top,
        block = Math.min(0.42, w * 0.34),
        front = Math.min(0.018, d * 0.04),
        x = w / 2 - block / 2 - leg * 0.4,
        drawer = (under * 0.92) / 3;
      return assemble(
        size,
        [
          material("top", c, "wood", 0.5, 1),
          material("drawer", shade(c, 0.86), "wood", 0.55, 0.8),
          material("metal", METAL_DARK, "metal", 0.35, 0.5),
        ],
        [
          ["box", "top", 0, h - top / 2, 0, w, top, d],
          ["box", "drawer", x, under / 2 + under * 0.04, -front / 2, block, under * 0.92, d * 0.9],
          ...Array.from(
            { length: 3 },
            (_, i): Spec => [
              "box",
              "top",
              x,
              under * 0.08 + drawer * (i + 0.5),
              d * 0.45 - front / 2,
              block * 0.94,
              drawer * 0.9,
              front,
            ],
          ),
          ...Array.from(
            { length: 3 },
            (_, i): Spec => [
              "box",
              "metal",
              x,
              under * 0.08 + drawer * (i + 0.5),
              d * 0.45 + front / 2,
              block * 0.3,
              Math.min(0.012, drawer * 0.1),
              front,
            ],
          ),
          ["box", "metal", -w / 2 + leg, under / 2, -d / 2 + leg, leg, under, leg],
          ["box", "metal", -w / 2 + leg, under / 2, d / 2 - leg, leg, under, leg],
          ["box", "metal", -w / 2 + leg, leg / 2, 0, leg, leg, d - leg * 2],
        ],
      );
    }
    case "chair": {
      const seat = h * 0.5,
        pad = Math.min(0.06, h * 0.07),
        back = Math.min(0.05, d * 0.1),
        leg = Math.min(0.045, s * 0.09);
      return assemble(
        size,
        [
          material("seat", c, "fabric", 0.9, 0.25),
          material("frame", shade(c, 0.6), "wood", 0.6, 0.8),
        ],
        [
          ["box", "seat", 0, seat - pad / 2, 0, w, pad, d],
          [
            "box",
            "seat",
            0,
            seat + (h - seat) * 0.6,
            -d / 2 + back / 2,
            w * 0.92,
            (h - seat) * 0.8,
            back,
          ],
          [
            "box",
            "frame",
            -w / 2 + leg,
            seat + (h - seat) / 2,
            -d / 2 + back / 2,
            leg,
            h - seat,
            back,
          ],
          [
            "box",
            "frame",
            w / 2 - leg,
            seat + (h - seat) / 2,
            -d / 2 + back / 2,
            leg,
            h - seat,
            back,
          ],
          ...legs("box", "frame", w, d, seat - pad, leg),
        ],
      );
    }
    case "storage": {
      const panel = Math.min(0.03, w * 0.05, h * 0.05);
      const materials = [
        material("body", c, "wood", 0.6, 1),
        material("front", shade(c, 0.88), "wood", 0.55, 0.8),
        material("metal", METAL_DARK, "metal", 0.35, 0.5),
      ];
      if (h >= 1.2) {
        // A tall open bookcase: back, sides, top, bottom and shelves.
        const shelves = clamp(Math.round(h / 0.38) - 1, 1, 6);
        return assemble(size, materials, [
          ["box", "front", 0, h / 2, -d / 2 + panel / 2, w, h, panel],
          ["box", "body", -w / 2 + panel / 2, h / 2, 0, panel, h, d],
          ["box", "body", w / 2 - panel / 2, h / 2, 0, panel, h, d],
          ["box", "body", 0, h - panel / 2, 0, w, panel, d],
          ["box", "body", 0, panel * 1.5, 0, w, panel * 3, d],
          ...Array.from(
            { length: shelves },
            (_, i): Spec => [
              "box",
              "body",
              0,
              panel * 3 + ((h - panel * 4) * (i + 1)) / (shelves + 1),
              panel / 2,
              w - panel * 2,
              panel,
              d - panel,
            ],
          ),
        ]);
      }
      // A low cabinet: a carcass on feet with doors and handles.
      const foot = Math.min(0.08, h * 0.1),
        front = Math.min(0.018, d * 0.05),
        doors = w > 1.2 ? 3 : 2,
        door = (w - panel) / doors,
        body = h - foot;
      return assemble(size, materials, [
        ["box", "body", 0, foot + body / 2, -front / 2, w, body, d - front],
        ...Array.from(
          { length: doors },
          (_, i): Spec => [
            "box",
            "front",
            -w / 2 + panel / 2 + door * (i + 0.5),
            foot + body / 2,
            d / 2 - front / 2,
            door * 0.96,
            body * 0.94,
            front,
          ],
        ),
        ...Array.from(
          { length: doors },
          (_, i): Spec => [
            "box",
            "metal",
            -w / 2 + panel / 2 + door * (i + 0.5) + (i % 2 ? -1 : 1) * door * 0.36,
            foot + body * 0.6,
            d / 2,
            Math.min(0.012, door * 0.05),
            Math.min(0.12, body * 0.2),
            front,
          ],
        ),
        ...legs("box", "metal", w, d, foot, Math.min(0.04, s * 0.08)),
      ]);
    }
    case "lamp": {
      const floor = h > 0.8,
        base = Math.min(0.03, h * 0.04),
        lampshade = h * (floor ? 0.2 : 0.42),
        pole = Math.min(0.03, s * 0.1);
      return assemble(
        size,
        [
          material("metal", METAL_DARK, "metal", 0.35, 0.5),
          material("shade", shade(c, 1.35), "fabric", 0.85, 0.2),
        ],
        [
          ["cylinder", "metal", 0, base / 2, 0, w * 0.6, base, d * 0.6],
          [
            "cylinder",
            "metal",
            0,
            base + (h - lampshade - base) / 2,
            0,
            pole,
            h - lampshade - base,
            pole,
          ],
          ["cylinder", "shade", 0, h - lampshade / 2, 0, w, lampshade, d],
        ],
      );
    }
    case "rug": {
      const border = Math.min(0.08, s * 0.06);
      return assemble(
        size,
        [
          material("field", c, "carpet", 1, 0.3),
          material("border", shade(c, 0.72), "carpet", 1, 0.3),
        ],
        [
          ["box", "field", 0, h / 2, 0, w - border * 2, h, d - border * 2],
          ["box", "border", 0, h * 0.4, 0, w, h * 0.8, d],
        ],
        "top",
      );
    }
    case "art": {
      // `d` is the thickness off the wall: the picture sits just behind the frame's face.
      const frame = Math.min(0.035, w * 0.07, h * 0.07);
      return assemble(
        size,
        [
          material("picture", shade(c, 1.2), "plain", 0.7, 1),
          material("frame", "#2b2622", "wood", 0.5, 0.6),
        ],
        [
          ["box", "picture", 0, h / 2, -d * 0.15, w - frame * 2, h - frame * 2, d * 0.7],
          ["box", "frame", 0, h - frame / 2, 0, w, frame, d],
          ["box", "frame", 0, frame / 2, 0, w, frame, d],
          ["box", "frame", -w / 2 + frame / 2, h / 2, 0, frame, h - frame * 2, d],
          ["box", "frame", w / 2 - frame / 2, h / 2, 0, frame, h - frame * 2, d],
        ],
        "front",
      );
    }
    case "plant": {
      const pot = h * 0.28;
      return assemble(
        size,
        [
          material("pot", c, "stone", 0.8, 0.5),
          material("soil", "#3b2d22", "plain", 1, 0.3),
          material("stem", "#5b4630", "wood", 0.8, 0.4),
          material("leaf", "#3f6b4c", "plain", 0.75, 0.3),
          material("leaf-light", "#5d8a5a", "plain", 0.75, 0.3),
        ],
        [
          ["cylinder", "pot", 0, pot / 2, 0, w * 0.58, pot, d * 0.58],
          ["cylinder", "soil", 0, pot * 0.97, 0, w * 0.5, pot * 0.06, d * 0.5],
          ["cylinder", "stem", 0, pot + h * 0.12, 0, s * 0.06, h * 0.24, s * 0.06],
          ["sphere", "leaf", 0, h * 0.56, 0, w, h * 0.4, d],
          ["sphere", "leaf-light", w * 0.08, h * 0.73, -d * 0.06, w * 0.78, h * 0.32, d * 0.78],
          ["sphere", "leaf", -w * 0.06, h * 0.87, d * 0.05, w * 0.56, h * 0.26, d * 0.56],
        ],
      );
    }
    case "decor":
      return assemble(
        size,
        [
          material("body", c, "stone", 0.45, 0.5),
          material("accent", shade(c, 0.7), "stone", 0.5, 0.5),
        ],
        [
          ["cylinder", "accent", 0, h * 0.05, 0, w * 0.55, h * 0.1, d * 0.55],
          ["sphere", "body", 0, h * 0.42, 0, w, h * 0.68, d],
          ["cylinder", "body", 0, h * 0.84, 0, w * 0.34, h * 0.24, d * 0.34],
          ["cylinder", "accent", 0, h * 0.98, 0, w * 0.42, h * 0.04, d * 0.42],
        ],
      );
  }
}

/**
 * A model stretched to a placement's width, height and depth, which are the
 * source of truth. Positions scale per axis. Unrotated parts scale per axis
 * too; a rotated part keeps its proportions (scaled by the smallest factor),
 * so it stays inside the new bounding box.
 */
export function fitModel(model: ItemModel, size: ItemSize): ItemModel {
  const fx = size.width / model.size.x,
    fy = size.height / model.size.y,
    fz = size.depth / model.size.z;
  if (![fx, fy, fz].every((f) => Number.isFinite(f) && f > 0)) return model;
  const least = Math.min(fx, fy, fz);
  const part = (n: number) => Math.max(0.001, n);
  return {
    ...model,
    size: { x: size.width, y: size.height, z: size.depth },
    parts: model.parts.map((p) => {
      const turned = p.rotation.x !== 0 || p.rotation.y !== 0 || p.rotation.z !== 0;
      return {
        ...p,
        position: { x: p.position.x * fx, y: p.position.y * fy, z: p.position.z * fz },
        size: turned
          ? { x: part(p.size.x * least), y: part(p.size.y * least), z: part(p.size.z * least) }
          : { x: part(p.size.x * fx), y: part(p.size.y * fy), z: part(p.size.z * fz) },
      };
    }),
  };
}
