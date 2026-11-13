import { describe, expect, test } from "bun:test";
import { checkValue } from "../convex/ai/outputSchema";
import {
  FURNISH_LIMITS,
  furnishText,
  itemsText,
  kindOf,
  kindsNamed,
  saysLook,
  sizeOf,
  sizeProblem,
  textProblems,
  vibeFromText,
} from "../convex/lib/furnish";
import {
  type FurnishInput,
  type FurnishOutput,
  furnishOutput,
  furnishProblems,
  furnishTask,
  rulesFurnish,
} from "../convex/lib/furnishTask";
import { ALL_ITEM_KINDS, itemSize } from "../convex/lib/unitScene";
import { rankVibeMatches } from "../convex/lib/vibeMatch";
import { listings as seedListings } from "../convex/seed/world/listings";

// Furnishing the apartment from Landing Home's chat (#150): pure rules and the task's checks.
const furniture = (title: string) => ({ title, category: "furniture" });

describe("a vibe from what the person typed", () => {
  test("names styles and colours, and keeps the other words as keywords", () => {
    expect(vibeFromText("cozy mid-century, walnut and sage, lots of linen")).toEqual({
      styles: ["mid_century", "cozy"],
      palette: ["walnut", "sage"],
      keywords: ["linen"],
    });
    expect(vibeFromText("Scandi with forest green and rattan")).toEqual({
      styles: ["scandinavian", "boho"],
      palette: ["forest"],
      keywords: [],
    });
    expect(vibeFromText("warm white and wood, brass accents")).toEqual({
      styles: [],
      palette: ["warm_white", "natural_wood"],
      keywords: ["brass", "accents"],
    });
  });
  test("drops filler, numbers and removed words; stays within the vibe's limits", () => {
    expect(vibeFromText("I want my apartment to feel like a [removed] place for $800")).toEqual({
      styles: [],
      palette: [],
      keywords: [],
    });
    const many = vibeFromText(
      "minimal scandi japandi boho industrial velvet marble brass oak-ish chrome glass tile stone plaster concrete",
    );
    expect(many.styles.length).toBe(3);
    expect(many.keywords.length).toBeLessThanOrEqual(8);
    expect(vibeFromText("")).toEqual({ styles: [], palette: [], keywords: [] });
  });
  test("ranks Marketplace listings the way a room's vibe does", () => {
    const ranked = rankVibeMatches(vibeFromText("mid-century teak and walnut"), [
      { id: "a", title: "Teak credenza, Danish style", description: "", createdAt: 1 },
      { id: "b", title: "Plastic storage bins", description: "", createdAt: 2 },
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["a"]);
  });
});

describe("what a listing is", () => {
  test("classifies furniture by its title, most specific words first", () => {
    const kinds: [string, ReturnType<typeof kindOf>][] = [
      ["IKEA Micke desk, white", "desk"],
      ["IKEA Billy bookcase (white, tall)", "storage"],
      ["IKEA Hektar floor lamp", "lamp"],
      ["Vintage velvet loveseat, carved wood frame", "sofa"],
      ["Queen wood bed frame with slats", "bed"],
      ["Antique bow-front dresser, 4 drawers", "storage"],
      ["Steelcase Series 1 office chair", "chair"],
      ["Two vintage wool rugs, 3x5", "rug"],
      ["Houseplant bundle: monstera, pothos, snake plant + more", "plant"],
      ["Antique oak dining table + 4 chairs", "table"],
      ["Mid century coffee table", "table"],
      ["West Elm mid-century nightstands (pair)", "table"],
      ["Counter height bar stools, set of 2", "chair"],
      ["Tan leather Chesterfield sofa", "sofa"],
      ["Free antique dressing mirror", "art"],
      ["Framed concert poster", "art"],
      ["Brass desk lamp", "lamp"],
      ["Ceramic vase", "decor"],
      ["Galanz mini fridge w/ freezer, 3.1 cu ft", null],
      ["Brother HL-L2350DW laser printer", null],
      ["Dyson V8 cordless vacuum", null],
    ];
    for (const [title, kind] of kinds)
      expect([title, kindOf(furniture(title))]).toEqual([title, kind]);
  });
  test("never classifies listings that can't furnish a home", () => {
    expect(kindOf({ title: "Canvas tote bag", category: "apparel" })).toBeNull();
    expect(kindOf({ title: "Weight bench", category: "sporting" })).toBeNull();
    expect(kindOf({ title: "Bed for a truck", category: "vehicles" })).toBeNull();
    expect(kindOf({ title: "Wooden high chair", category: "family" })).toBeNull();
  });
  test("classifies enough of the seed Marketplace to furnish an apartment", () => {
    const found = new Set(
      seedListings
        .filter((l) => (l.status ?? "active") === "active")
        .flatMap((l) => kindOf(l) ?? []),
    );
    for (const kind of [
      "bed",
      "sofa",
      "table",
      "rug",
      "lamp",
      "storage",
      "chair",
      "plant",
    ] as const)
      expect([kind, found.has(kind)]).toEqual([kind, true]);
  });
  test("estimates a typical size, plausible for the kind", () => {
    expect(sizeOf("table", furniture("Mid century coffee table"))).toEqual({
      width: 1.1,
      depth: 0.6,
      height: 0.45,
    });
    expect(sizeOf("bed", furniture("Queen wood bed frame")).width).toBe(1.55);
    expect(sizeOf("bed", furniture("Twin bed")).width).toBe(1);
    expect(sizeOf("lamp", furniture("IKEA Hektar floor lamp")).height).toBe(1.6);
    // A kind the title doesn't name gets that kind's default.
    expect(sizeOf("rug", furniture("Mid century coffee table"))).toEqual(itemSize("rug"));
    for (const kind of ALL_ITEM_KINDS) expect(sizeProblem(kind, itemSize(kind))).toBeNull();
    expect(sizeProblem("sofa", { width: 0.3, depth: 0.8, height: 0.9 })).toContain("sofa");
    expect(sizeProblem("art", { width: 0.6, depth: 0.5, height: 0.8 })).toContain("art");
    expect(sizeProblem("lamp", { width: 0.4, depth: 0.4, height: Number.NaN })).toContain("lamp");
  });
  test("finds the kinds a message names, in the order it names them (#153)", () => {
    const named = (text: string) => kindsNamed(text);
    expect(named("add a lamp")).toEqual({ kinds: ["lamp"], want: "" });
    expect(named("add a reading lamp")).toEqual({ kinds: ["lamp"], want: "reading" });
    expect(named("a rug and a coffee table please")).toEqual({ kinds: ["rug", "table"], want: "" });
    expect(named("I need a desk and a chair")).toEqual({ kinds: ["desk", "chair"], want: "" });
    expect(named("another two plants")).toEqual({ kinds: ["plant"], want: "" });
    expect(named("a rug under $200")).toEqual({ kinds: ["rug"], want: "" });
    expect(named("a mid-century walnut desk for $1.5k")).toEqual({
      kinds: ["desk"],
      want: "mid century walnut",
    });
    // A desk lamp is a lamp and an office chair a chair, not a desk and an office.
    expect(named("a brass desk lamp").kinds).toEqual(["lamp"]);
    expect(named("a desk chair").kinds).toEqual(["chair"]);
    expect(named("two couches for the living room")).toEqual({ kinds: ["sofa"], want: "" });
    expect(named("a cozy [removed] armchair")).toEqual({ kinds: ["chair"], want: "cozy" });
    // Words that name nothing: a look, a room, nothing at all.
    expect(named("cozy mid-century, under $800").kinds).toEqual([]);
    expect(named("something for the bedroom").kinds).toEqual([]);
    expect(named("").kinds).toEqual([]);
    expect(saysLook("furnish my apartment please")).toBe(false);
    expect(saysLook("something cozy")).toBe(true);
  });
});

describe("words", () => {
  test("flags links, contact details, protected traits, and empty or long text", () => {
    expect(textProblems("text", "A calm, warm living room.", 400)).toEqual([]);
    expect(textProblems("text", "See www.example.com", 400).join()).toContain("no links");
    expect(textProblems("text", "Call 415-555-0199", 400).join()).toContain("phone");
    expect(textProblems("text", "mail a@b.co", 400).join()).toContain("email");
    expect(textProblems("text", "Perfect for a Christian family", 400).join()).toContain(
      "protected",
    );
    expect(textProblems("text", " ", 400).join()).toContain("write");
    expect(textProblems("reason", "x".repeat(161), 160).join()).toContain("under 160");
  });
  test("the rules' reply says what was placed, never that anything was bought", () => {
    expect(
      furnishText({
        count: 5,
        vibe: "cozy mid-century",
        total: 1240,
        budget: { total: 1500, spent: 0 },
      }),
    ).toBe(
      "Picked 5 items for a cozy mid-century feel: $1,240 of your $1,500. They're in your apartment to review; nothing is bought yet.",
    );
    expect(furnishText({ count: 1, vibe: "", total: 40, budget: null })).toBe(
      "Picked 1 item: $40 in all. They're in your apartment to review; nothing is bought yet.",
    );
    expect(
      furnishText({ count: 2, vibe: "boho.", total: 100, budget: { total: 1000, spent: 600 } }),
    ).toContain("$100 more, $700 of your $1,000");
    expect(furnishText({ count: 0, vibe: "boho", total: 0, budget: null })).toContain(
      "Nothing on Marketplace fits",
    );
    expect(
      furnishText({ count: 0, vibe: "boho", total: 0, budget: { total: 500, spent: 500 } }),
    ).toContain("used up");
    const longest = furnishText({
      count: 8,
      vibe: "v".repeat(FURNISH_LIMITS.vibeMax),
      total: 999_999,
      budget: { total: 1_000_000, spent: 1 },
    });
    expect(longest.length).toBeLessThanOrEqual(FURNISH_LIMITS.textMax);
  });
  test("an items request's reply names what was asked for and the limit (#153)", () => {
    const lamp = { kind: "lamp" as const, title: "IKEA Hektar floor lamp", price: 15 };
    const budget = { total: 1500, spent: 875 };
    expect(itemsText({ asked: ["lamp"], added: [lamp], have: [], budget, limit: 625 })).toBe(
      "Added a lamp: IKEA Hektar floor lamp, $15. $890 of your $1,500.",
    );
    expect(
      itemsText({
        asked: ["desk", "chair", "art"],
        added: [
          { kind: "desk", title: "Micke desk", price: 70 },
          { kind: "chair", title: "Cane armchair", price: 90 },
        ],
        have: [],
        budget: null,
        limit: 200,
      }),
    ).toBe(
      "Added a desk and a chair: Micke desk, $70; Cane armchair, $90. No art on Marketplace fits within $40 right now.",
    );
    // Nothing found: the thing and the limit, and "other" when the apartment has one already.
    const none = (a: Partial<Parameters<typeof itemsText>[0]>) =>
      itemsText({ asked: ["lamp"], added: [], have: [], budget: null, limit: null, ...a });
    expect(none({})).toBe("No lamp on Marketplace fits right now.");
    expect(none({ limit: 120 })).toBe("No lamp on Marketplace fits within $120 right now.");
    expect(none({ have: ["lamp"], asked: ["lamp", "rug"] })).toBe(
      "No other lamp or rug on Marketplace fits right now.",
    );
    expect(none({ budget: { total: 1500, spent: 1500 }, limit: 0 })).toBe(
      "Your $1,500 furniture budget is used up. Remove something or raise it to add more.",
    );
    // Never that anything was bought, and never too long.
    const most = itemsText({
      asked: ["sofa", "bed", "table", "storage"],
      added: (["sofa", "bed", "table"] as const).map((kind) => ({
        kind,
        title: "t".repeat(120),
        price: 99_999,
      })),
      have: ["storage"],
      budget: { total: 1_000_000, spent: 1 },
      limit: 99_999,
    });
    expect(most.length).toBeLessThanOrEqual(FURNISH_LIMITS.textMax);
    expect(most).not.toMatch(/bought|ordered/i);
  });
});

const candidate = (id: string, title: string, price: number, description = "") => ({
  key: `listing:${id}`,
  id,
  title,
  price,
  category: "furniture",
  condition: "used_good",
  description,
});
const input = (extra: Partial<FurnishInput> = {}): FurnishInput => ({
  vibe: "cozy mid-century",
  asked: [],
  want: "",
  budget: { total: 1000, spent: 0, remaining: 1000 },
  cap: null,
  rooms: [
    { id: "living", name: "Living room", area: 20 },
    { id: "bed", name: "Bedroom", area: 12 },
  ],
  placed: [],
  candidates: [
    candidate("sofa", "Teak frame sofa", 400, "Mid-century, walnut legs"),
    candidate("sofa2", "Gray sofa", 150),
    candidate("bed", "Queen bed frame", 250),
    candidate("table", "Mid century coffee table", 120),
    candidate("rug", "Wool rug", 80),
    candidate("lamp", "Floor lamp", 60),
    candidate("art", "Framed poster", 30),
    candidate("plant", "Monstera plant", 25),
    candidate("shelf", "Billy bookcase", 50),
    candidate("chair", "Cane armchair", 90),
    candidate("desk", "Micke desk", 70),
    candidate("fridge", "Mini fridge", 60),
  ],
  ...extra,
});
const pick = (
  listingId: string,
  kind: FurnishOutput["picks"][number]["kind"],
  extra: Partial<FurnishOutput["picks"][number]> = {},
): FurnishOutput["picks"][number] => ({
  listingId: listingId as never,
  kind,
  ...itemSize(kind),
  reason: "Fits the look",
  ...extra,
});
const problems = (picks: FurnishOutput["picks"], text = "A warm start.", i = input()) =>
  furnishProblems({ text, picks }, i).join("; ");

describe("muse.furnish checks", () => {
  test("accepts a sound answer", () => {
    expect(problems([pick("sofa", "sofa", { room: "living" }), pick("bed", "bed")])).toBe("");
    expect(problems([])).toBe("");
    expect(furnishTask.name).toBe("muse.furnish");
    expect(furnishTask.model).toBeUndefined();
    expect(furnishTask.cacheTtlMs).toBe(0);
    expect(furnishTask.maxAttempts).toBe(2);
    expect(furnishTask.cites({ text: "", picks: [pick("sofa", "sofa")] })).toEqual([]);
  });
  test("rejects listings it wasn't given, duplicates and unknown rooms", () => {
    expect(problems([pick("made-up", "sofa")])).toContain("not a listing in input.candidates");
    expect(problems([pick("rug", "rug"), pick("rug", "rug")])).toContain("picked twice");
    expect(problems([pick("rug", "rug", { room: "garage" })])).toContain("room id");
  });
  test("rejects going over what is left of the budget", () => {
    const tight = input({ budget: { total: 1000, spent: 600, remaining: 400 } });
    expect(problems([pick("sofa", "sofa"), pick("rug", "rug")], "ok", tight)).toContain(
      "more than the $400 left",
    );
    expect(problems([pick("sofa", "sofa")], "ok", tight)).toBe("");
    expect(
      problems([pick("sofa", "sofa"), pick("bed", "bed")], "ok", input({ budget: null })),
    ).toBe("");
  });
  test("rejects implausible sizes, too many picks, and a second sofa or bed", () => {
    expect(problems([pick("rug", "rug", { height: 0.5 })])).toContain("a rug is");
    expect(problems([pick("sofa", "sofa", { width: 30 })])).toContain("a sofa is");
    expect(problems(Array.from({ length: 9 }, () => pick("rug", "rug")))).toContain("at most 8");
    expect(problems([pick("sofa", "sofa"), pick("sofa2", "sofa")])).toContain("one sofa");
    const hasSofa = input({ placed: [{ kind: "sofa", label: "Sofa", price: 300 }] });
    expect(problems([pick("sofa", "sofa")], "ok", hasSofa)).toContain("one sofa");
    const hasBed = input({ placed: [{ kind: "bed", label: "Bed", price: 300 }] });
    expect(problems([pick("bed", "bed")], "ok", hasBed)).toContain("one bed per bedroom");
    // Two bedrooms take two beds.
    hasBed.rooms.push({ id: "bed2", name: "Bedroom 2", area: 10 });
    expect(problems([pick("bed", "bed")], "ok", hasBed)).toBe("");
  });
  test("when the person asked for things by name, only those kinds, a second sofa included", () => {
    const asked = input({
      asked: ["sofa"],
      placed: [{ kind: "sofa", label: "Sofa", price: 300 }],
    });
    expect(problems([pick("sofa2", "sofa")], "ok", asked)).toBe("");
    expect(problems([pick("rug", "rug")], "ok", asked)).toContain("asked only for sofa");
  });
  test("an items request takes at most one of each kind asked for, each the kind it is (#153)", () => {
    const asked = input({ asked: ["sofa", "lamp"] });
    expect(problems([pick("sofa", "sofa"), pick("lamp", "lamp")], "ok", asked)).toBe("");
    expect(problems([pick("sofa", "sofa"), pick("sofa2", "sofa")], "ok", asked)).toContain(
      "at most one sofa",
    );
    // A bookcase called a lamp is still a bookcase.
    expect(problems([pick("shelf", "lamp")], "ok", asked)).toContain("picks[0].kind");
    expect(problems([], "ok", asked)).toBe("");
  });
  test("a request's own amount caps its picks, inside what is left of the budget (#153)", () => {
    const capped = input({ asked: ["sofa", "lamp"], cap: 200 });
    expect(problems([pick("sofa", "sofa")], "ok", capped)).toContain(
      "more than the $200 this request may spend",
    );
    expect(problems([pick("sofa2", "sofa")], "ok", capped)).toBe("");
    // What is left of the overall budget still binds when it is less.
    const tight = input({
      asked: ["sofa"],
      cap: 200,
      budget: { total: 1000, spent: 900, remaining: 100 },
    });
    expect(problems([pick("sofa2", "sofa")], "ok", tight)).toContain("more than the $100 left");
    // A cap with no overall budget.
    const only = input({ asked: ["sofa"], cap: 200, budget: null });
    expect(problems([pick("sofa", "sofa")], "ok", only)).toContain("$200 this request may spend");
    expect(problems([pick("sofa2", "sofa")], "ok", only)).toBe("");
  });
  test("rejects links, contact details and protected traits in text and reasons", () => {
    expect(problems([], "Order at www.shop.com")).toContain("no links");
    expect(problems([pick("rug", "rug", { reason: "text me 415-555-0199" })])).toContain(
      "picks[0].reason",
    );
    expect(problems([], "Great for Muslim families")).toContain("protected");
    expect(problems([], "x".repeat(401))).toContain("under 400");
  });
});

describe("Landing's rules furnish", () => {
  test("walks the basics in order, best-ranked candidate first, citing why", () => {
    const out = rulesFurnish(input());
    expect(checkValue(furnishOutput, out).errors).toEqual([]);
    expect(furnishProblems(out, input())).toEqual([]);
    expect(out.picks.map((p) => [p.listingId as string, p.kind])).toEqual([
      ["bed", "bed"],
      ["sofa", "sofa"],
      ["table", "table"],
      ["rug", "rug"],
      ["lamp", "lamp"],
      ["art", "art"],
      ["plant", "plant"],
    ]);
    // Reasons come from the vibe match, else the budget.
    expect(out.picks[1].reason).toContain("Mid-century");
    expect(out.picks[3].reason).toBe("Fits your budget");
    expect(out.picks[2]).toMatchObject({ width: 1.1, depth: 0.6, height: 0.45 });
    expect(out.picks.every((p) => p.room === undefined)).toBe(true);
    // The $50 bookcase no longer fits: $965 of $1,000 is spent.
    expect(out.text).toContain("Picked 7 items for a cozy mid-century feel: $965 of your $1,000.");
  });
  test("stays inside the budget, skipping what it can't afford", () => {
    const i = input({ budget: { total: 500, spent: 150, remaining: 350 } });
    const out = rulesFurnish(i);
    // The $400 sofa is out of reach: the $150 one goes in instead.
    expect(out.picks.map((p) => p.listingId as string)).toEqual(["bed", "rug"]);
    expect(furnishProblems(out, i)).toEqual([]);
    expect(out.text).toContain("$330 more, $480 of your $500");
    const none = rulesFurnish(input({ budget: { total: 100, spent: 100, remaining: 0 } }));
    expect(none.picks).toEqual([]);
    expect(none.text).toContain("used up");
  });
  test("skips kinds already placed, and a bed where nobody sleeps", () => {
    const out = rulesFurnish(
      input({
        placed: [
          { kind: "sofa", label: "Sofa", price: 1 },
          { kind: "rug", label: "Rug", price: 1 },
        ],
        rooms: [
          { id: "a", name: "Room 1", area: 20 },
          { id: "b", name: "Kitchen", area: 9 },
        ],
      }),
    );
    expect(out.picks.map((p) => p.kind)).toEqual([
      "table",
      "lamp",
      "art",
      "plant",
      "storage",
      "chair",
      "desk",
    ]);
    // A studio (one room) does get a bed.
    const studio = rulesFurnish(input({ rooms: [{ id: "room", name: "Your unit", area: 20 }] }));
    expect(studio.picks[0].kind).toBe("bed");
  });
  test("adds only what was asked for by name", () => {
    const i = input({
      asked: ["lamp", "sofa"],
      placed: [{ kind: "sofa", label: "Sofa", price: 300 }],
    });
    const out = rulesFurnish(i);
    expect(out.picks.map((p) => p.listingId as string)).toEqual(["lamp", "sofa"]);
    expect(furnishProblems(out, i)).toEqual([]);
    expect(out.text).toBe(
      "Added a lamp and a sofa: Floor lamp, $60; Teak frame sofa, $400. $460 of your $1,000.",
    );
  });
  test("an items request stays inside its own amount and says what it couldn't find (#153)", () => {
    const i = input({ asked: ["sofa", "lamp", "decor"], want: "gray", cap: 220 });
    const out = rulesFurnish(i);
    // The $400 sofa is over the $220 this request may spend: the $150 one, then the $60 lamp.
    expect(out.picks.map((p) => p.listingId as string)).toEqual(["sofa2", "lamp"]);
    expect(furnishProblems(out, i)).toEqual([]);
    expect(out.text).toBe(
      "Added a sofa and a lamp: Gray sofa, $150; Floor lamp, $60. No decor on Marketplace fits within $10 right now. $210 of your $1,000.",
    );
    const none = rulesFurnish(input({ asked: ["lamp"], cap: 20, budget: null }));
    expect(none.picks).toEqual([]);
    expect(none.text).toBe("No lamp on Marketplace fits within $20 right now.");
    const have = rulesFurnish(
      input({
        asked: ["lamp"],
        candidates: [candidate("sofa", "Teak frame sofa", 400)],
        placed: [{ kind: "lamp", label: "Floor lamp", price: 60 }],
      }),
    );
    expect(have.picks).toEqual([]);
    expect(have.text).toBe("No other lamp on Marketplace fits within $1,000 right now.");
  });
  test("without candidates it says so", () => {
    const out = rulesFurnish(input({ candidates: [] }));
    expect(out.picks).toEqual([]);
    expect(out.text).toContain("Nothing on Marketplace fits");
    expect(furnishTask.fallback(input({ candidates: [] }), [])).toEqual(out);
  });
});
