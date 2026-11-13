import { describe, expect, test } from "bun:test";
import { checkValue } from "../convex/ai/outputSchema";
import {
  colorFromText,
  fitModel,
  ITEM_MODEL_LIMITS,
  type ItemModel,
  itemModel,
  itemModelProblems,
  NEUTRAL,
  proxyModel,
  shade,
} from "../convex/lib/itemModel";
import { type ItemModelInput, itemModelTask } from "../convex/lib/itemModelTask";
import {
  ALL_ITEM_KINDS,
  ITEM_KINDS,
  ITEM_LIMITS,
  itemSize,
  manualScene,
  type Placement,
  placementProblems,
} from "../convex/lib/unitScene";

// Item models for Landing Home's Apartment tab (#150).
const sofa = () => proxyModel("sofa", itemSize("sofa"), "#7a8f6b");
const shapes = (m: ItemModel) => new Set(m.parts.map((p) => p.shape));

describe("placement kinds", () => {
  test("the editor keeps its four shapes; every kind has a default size a placement accepts", () => {
    expect(ITEM_KINDS).toEqual(["sofa", "bed", "table", "storage"]);
    expect(ALL_ITEM_KINDS.length).toBe(11);
    expect(itemSize("rug")).toEqual({ width: 1.6, depth: 2.3, height: 0.02 });
    expect(itemSize("art")).toEqual({ width: 0.6, depth: 0.03, height: 0.8 });
    const scene = manualScene(6, 6);
    for (const kind of ALL_ITEM_KINDS) {
      const p: Placement = {
        id: kind,
        label: kind,
        kind,
        x: 3,
        z: 3,
        rotation: 0,
        ...itemSize(kind),
        color: "#888888",
        measured: false,
      };
      expect(placementProblems(scene, p)).toEqual([]);
    }
  });
});

describe("stand-in models", () => {
  test("every kind is valid at every size a placement can have", () => {
    const sides = [ITEM_LIMITS.min, 0.05, 0.3, 1, 2.5, ITEM_LIMITS.max];
    let checked = 0;
    for (const kind of ALL_ITEM_KINDS)
      for (const width of sides)
        for (const depth of sides)
          for (const height of sides) {
            const model = proxyModel(kind, { width, depth, height }, "#a0522d");
            expect([kind, width, depth, height, itemModelProblems(model)]).toEqual([
              kind,
              width,
              depth,
              height,
              [],
            ]);
            expect(model.size).toEqual({ x: width, y: height, z: depth });
            checked++;
          }
    expect(checked).toBe(11 * 216);
  });
  test("each kind matches the stored shape and looks like the thing", () => {
    for (const kind of ALL_ITEM_KINDS) {
      const model = proxyModel(kind, itemSize(kind), "#a0522d");
      expect(checkValue(itemModel, model).errors).toEqual([]);
      expect(itemModelProblems(model)).toEqual([]);
      expect(model.notes.length).toBe(1);
    }
    // A sofa has a base, a back, two arms, cushions and four legs.
    expect(sofa().parts.length).toBeGreaterThanOrEqual(10);
    expect(sofa().materials.map((m) => m.pattern)).toContain("fabric");
    expect(sofa().materials[0].color).toBe("#7a8f6b");
    expect(shapes(proxyModel("table", itemSize("table"), NEUTRAL))).toEqual(new Set(["box"]));
    expect(proxyModel("table", itemSize("table"), NEUTRAL).parts.length).toBe(9);
    expect(shapes(proxyModel("lamp", itemSize("lamp"), NEUTRAL))).toEqual(new Set(["cylinder"]));
    expect(shapes(proxyModel("plant", itemSize("plant"), NEUTRAL))).toContain("sphere");
    // A tall bookcase has shelves; a low cabinet has doors and feet.
    const tall = proxyModel("storage", { width: 0.8, depth: 0.32, height: 1.8 }, NEUTRAL);
    const low = proxyModel("storage", itemSize("storage"), NEUTRAL);
    expect(tall.parts.length).not.toBe(low.parts.length);
    // The back of a sofa is at −z, the same as the editor's furniture.
    const back = sofa().parts[1];
    expect(back.position.z).toBeLessThan(0);
    expect(back.position.y + back.size.y / 2).toBeCloseTo(itemSize("sofa").height);
  });
  test("flat things show the listing's photo on the first part; nothing else does", () => {
    const rug = proxyModel("rug", itemSize("rug"), NEUTRAL);
    const art = proxyModel("art", itemSize("art"), NEUTRAL);
    expect(rug.photo).toBe("top");
    expect(art.photo).toBe("front");
    expect(rug.parts[0].shape).toBe("box");
    expect(art.parts.length).toBe(5);
    for (const kind of ALL_ITEM_KINDS.filter((k) => k !== "rug" && k !== "art"))
      expect(proxyModel(kind, itemSize(kind), NEUTRAL).photo).toBeUndefined();
  });
  test("is deterministic and falls back to a neutral colour", () => {
    expect(sofa()).toEqual(sofa());
    expect(proxyModel("chair", itemSize("chair"), "not a colour").materials[0].color).toBe(NEUTRAL);
  });
});

describe("model validation", () => {
  const change = (edit: (m: ItemModel) => void) => {
    const m = structuredClone(sofa());
    edit(m);
    return itemModelProblems(m).join("; ");
  };
  test("rejects bad ids, colours, ranges and unknown materials", () => {
    expect(change((m) => (m.materials[1].id = m.materials[0].id))).toContain("duplicate");
    expect(change((m) => (m.materials[0].id = "has space"))).toContain("Invalid");
    expect(change((m) => (m.materials[0].color = "red"))).toContain("invalid material");
    expect(change((m) => (m.materials[0].roughness = 2))).toContain("invalid material");
    expect(change((m) => (m.materials[0].repeat = 0))).toContain("invalid material");
    expect(change((m) => (m.parts[0].materialId = "missing"))).toContain("unknown material");
    expect(change((m) => (m.parts[0].size.x = 0))).toContain("invalid part");
    expect(change((m) => (m.parts[0].rotation.y = 9))).toContain("invalid part");
    expect(change((m) => (m.size.x = 20))).toContain("size");
    expect(change((m) => (m.parts = []))).toContain("at least one part");
  });
  test("rejects parts outside the bounding box, rotation included", () => {
    expect(change((m) => (m.parts[0].position.x = 5))).toContain("outside the bounding box");
    expect(change((m) => (m.parts[0].position.y = -1))).toContain("outside the bounding box");
    // A full-width box turned 45° pokes out of the box.
    expect(change((m) => (m.parts[0].rotation.y = Math.PI / 4))).toContain("outside");
  });
  test("rejects too many parts, materials and notes, and an oversized model", () => {
    expect(change((m) => (m.parts = Array(49).fill(m.parts[0])))).toContain("at most");
    expect(change((m) => (m.materials = Array(13).fill(m.materials[0])))).toContain("at most");
    expect(change((m) => (m.notes = Array(5).fill("note")))).toContain("notes");
    expect(change((m) => (m.notes = ["x".repeat(201)]))).toContain("notes");
    // The byte budget is a backstop behind the other limits.
    const heavy = change((m) => (m.materials[0].id = "m".repeat(30_000)));
    expect(heavy).toContain("storage limits");
    expect(ITEM_MODEL_LIMITS.bytes).toBe(24_000);
  });
  test("a photo needs an unrotated box as the first part", () => {
    expect(
      change((m) => {
        m.photo = "top";
        m.parts[0] = { ...m.parts[0], shape: "sphere" };
      }),
    ).toContain("photo");
    expect(change((m) => (m.photo = "top"))).toBe("");
  });
});

describe("fitting a model to a placement", () => {
  test("scales every kind to the placement's size and stays valid", () => {
    for (const kind of ALL_ITEM_KINDS) {
      const model = proxyModel(kind, itemSize(kind), NEUTRAL);
      for (const size of [
        { width: 0.4, depth: 0.2, height: 2 },
        { width: 3, depth: 1.5, height: 0.3 },
        { width: 0.05, depth: 0.05, height: 0.05 },
      ]) {
        const fit = fitModel(model, size);
        expect(fit.size).toEqual({ x: size.width, y: size.height, z: size.depth });
        expect([kind, size, itemModelProblems(fit)]).toEqual([kind, size, []]);
      }
    }
  });
  test("moves and stretches parts per axis; a rotated part keeps its proportions", () => {
    const model: ItemModel = {
      size: { x: 1, y: 1, z: 1 },
      materials: sofa().materials,
      parts: [
        {
          shape: "box",
          materialId: "fabric",
          position: { x: 0.25, y: 0.5, z: -0.25 },
          size: { x: 0.5, y: 1, z: 0.5 },
          rotation: { x: 0, y: 0, z: 0 },
        },
        {
          shape: "box",
          materialId: "fabric",
          position: { x: -0.2, y: 0.5, z: 0.2 },
          size: { x: 0.3, y: 0.3, z: 0.3 },
          rotation: { x: 0, y: Math.PI / 4, z: 0 },
        },
      ],
      notes: [],
    };
    expect(itemModelProblems(model)).toEqual([]);
    const fit = fitModel(model, { width: 2, depth: 4, height: 0.5 });
    expect(fit.parts[0].position).toEqual({ x: 0.5, y: 0.25, z: -1 });
    expect(fit.parts[0].size).toEqual({ x: 1, y: 0.5, z: 2 });
    expect(fit.parts[1].position).toEqual({ x: -0.4, y: 0.25, z: 0.8 });
    expect(fit.parts[1].size).toEqual({ x: 0.15, y: 0.15, z: 0.15 });
    expect(itemModelProblems(fit)).toEqual([]);
    // The same size gives the same model.
    expect(fitModel(model, { width: 1, depth: 1, height: 1 })).toEqual(model);
  });
});

describe("colours", () => {
  test("guesses a colour from the title's colour and material words", () => {
    expect(colorFromText("IKEA Micke desk, white")).toBe("#f1eee8");
    expect(colorFromText("Tan leather Chesterfield sofa")).toBe("#8a5a3c");
    expect(colorFromText("Mid-century cane armchair, solid teak")).toBe("#b98a5a");
    expect(colorFromText("Forest green velvet sofa")).toBe("#2f4f3a");
    expect(colorFromText("Dyson V8 cordless vacuum")).toBe(NEUTRAL);
    // The first colour named wins.
    expect(colorFromText("Black frame, white shade")).toBe("#121212");
  });
  test("shades stay valid hex colours", () => {
    expect(shade("#808080", 0.5)).toBe("#404040");
    expect(shade("#808080", 2)).toBe("#ffffff");
    expect(shade("#000000", 1.5)).toBe("#808080");
    expect(shade("nope", 1)).toBe(NEUTRAL);
  });
});

describe("muse.itemModel", () => {
  const input: ItemModelInput = {
    title: "Tan leather Chesterfield sofa",
    category: "furniture",
    condition: "used_good",
    description: "Three seats, rolled arms.",
    kind: "sofa",
    size: itemSize("sofa"),
  };
  test("without AI, the stand-in shape in the title's colour", () => {
    const out = itemModelTask.fallback(input, []);
    expect(out).toEqual(proxyModel("sofa", input.size, "#8a5a3c"));
    expect(itemModelTask.check?.(out, input)).toEqual([]);
    expect(itemModelTask.cites(out)).toEqual([]);
    expect(itemModelTask.model).toBeUndefined();
  });
  test("rejects an invalid model and one unlike the placed size", () => {
    const wrong = proxyModel("sofa", { width: 3, depth: 0.8, height: 0.9 }, NEUTRAL);
    expect(itemModelTask.check?.(wrong, input).join()).toContain("size.x (width)");
    const near = proxyModel("sofa", { width: 2.3, depth: 0.9, height: 0.8 }, NEUTRAL);
    expect(itemModelTask.check?.(near, input)).toEqual([]);
    const broken = structuredClone(near);
    broken.parts[0].position.x = 9;
    expect(itemModelTask.check?.(broken, input).join()).toContain("outside the bounding box");
  });
});
