import { type ImageFolder, type SeedImage, seedImages } from "../images";
import type { PhotoSlot } from "../types";
import { hash } from "./prng";

const FOLDERS = new Set<string>(Object.keys(seedImages));
/** A slot topic that names one file ("ballard-01.jpg") rather than topic words. */
const FILE_NAME = /\.(jpe?g|png|webp|gif|avif)$/i;
const STOP = new Set(
  "a an the of and with in on for to at my is it this that i you we so just free photo image".split(
    " ",
  ),
);

/** Query words → words the image library actually uses. */
const SYNONYMS: Record<string, string> = {
  sofa: "couch",
  sectional: "couch",
  loveseat: "couch",
  futon: "couch",
  bike: "bicycle",
  cycling: "bicycle",
  phone: "iphone",
  macbook: "laptop",
  ps5: "game console",
  xbox: "game console",
  nintendo: "game console",
  switch: "game console",
  fridge: "mini fridge",
  shoe: "sneaker",
  boot: "sneaker",
  coat: "jacket",
  parka: "jacket",
  shell: "jacket",
  fleece: "jacket",
  monstera: "plant",
  pothos: "plant",
  houseplant: "plant",
  succulent: "plant",
  desk: "office chair monitor",
  chair: "office chair",
  bed: "bed frame bedroom",
  nightstand: "dresser",
  drawer: "dresser",
  shelf: "bookshelf",
  bookcase: "bookshelf",
  tv: "monitor",
  display: "monitor",
  amp: "guitar",
  bass: "guitar",
  ukulele: "guitar",
  sedan: "car",
  civic: "car",
  prius: "car",
  truck: "car",
  suv: "car",
  motorcycle: "scooter",
  moped: "scooter",
  studio: "living room bedroom",
  apartment: "living room apartment",
  exterior: "house building",
  townhouse: "house",
  mountain: "mt rainier mountains hiking",
  rainier: "mt rainier",
  hike: "hiking trail",
  trail: "hiking trail",
  summit: "hiking mountains",
  latte: "coffee",
  espresso: "coffee",
  cafe: "coffee",
  ramen: "food",
  pho: "food",
  dumpling: "food",
  taco: "food",
  pizza: "food",
  brunch: "food",
  dinner: "food",
  thanksgiving: "food",
  friendsgiving: "food friends",
  cake: "food",
  skyline: "seattle skyline city",
  downtown: "seattle skyline city",
  waterfront: "seattle waterfront",
  puppy: "dog",
  kitten: "cat",
  show: "concert",
  gig: "concert",
  band: "concert",
  music: "concert",
  bouldering: "climbing",
  boulder: "climbing",
  crag: "climbing",
  boardgame: "board games",
  uw: "campus",
  university: "campus",
  quad: "campus",
  library: "campus",
  market: "pike place farmers market",
  running: "run club",
  marathon: "run club",
  laptops: "hackathon laptop",
  vinyl: "record store vinyl",
  books: "bookstore books",
  night: "city night",
  armchair: "couch",
  bench: "couch",
  credenza: "dresser",
  table: "living room kitchen",
  stool: "kitchen",
  mirror: "bedroom",
  rug: "living room",
  floor: "living room",
  utensil: "kitchen",
  mixer: "kitchen",
  cooker: "kitchen food",
  oven: "kitchen",
  vacuum: "living room",
  ipad: "iphone laptop",
  tablet: "iphone laptop",
  reader: "iphone",
  watch: "iphone",
  headphone: "laptop",
  earbud: "iphone",
  speaker: "laptop",
  keyboard: "laptop",
  printer: "laptop",
  piano: "guitar",
  microphone: "guitar concert",
  camera: "travel",
  hatchback: "car",
  crosstrek: "car",
  subaru: "car",
  toyota: "car",
  rope: "climbing",
  quickdraw: "climbing",
  harness: "climbing",
  crash: "climbing",
  hangboard: "climbing",
  chalk: "climbing",
  cliff: "climbing",
  granite: "climbing",
  ski: "mountains mt rainier",
  snowboard: "mountains mt rainier",
  retriever: "dog",
  corgi: "dog",
  heron: "seattle waterfront ferry",
  lighthouse: "seattle waterfront ferry",
  beach: "seattle waterfront sunset",
  ocean: "seattle waterfront ferry",
  wave: "seattle waterfront",
  ship: "ferry",
  forest: "trail hiking",
  mossy: "trail hiking",
  larche: "hiking trail",
  rainy: "seattle city",
  rain: "seattle city",
  umbrella: "seattle city",
  boba: "food coffee",
  tea: "coffee",
  potatoe: "food",
  pie: "food",
  bread: "food",
  sourdough: "food",
  turkey: "food",
  bratwurst: "food",
  rice: "food",
  dish: "food",
  snack: "food",
  halloween: "friends",
  wedding: "friends",
  couple: "friends",
  string: "city night",
  catan: "board games",
  wingspan: "board games",
  lab: "campus",
  pipette: "campus",
  science: "campus",
  classroom: "campus",
  hiker: "hiking",
  runner: "run club",
  van: "travel",
  suitcase: "travel",
  book: "bookstore books bookshelf",
  painting: "art show",
  canvas: "art show",
  art: "art show",
  dumbbell: "gym",
};

function stem(t: string): string {
  return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}

/** "Teal velvet sofa" → "teal velvet sofa": the form file-name topics use. */
function phrase(s: string): string {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !/^\d+$/.test(t))
    .join(" ");
}

function expand(words: string[]): string[] {
  return [...new Set(words.flatMap((w) => [w, ...tokens(SYNONYMS[w] ?? "")]))];
}

/** Where to look when a slot's own folder has nothing on topic (explicit "folder/…" slots never borrow). */
const BORROW: Partial<Record<ImageFolder, ImageFolder[]>> = {
  posts: ["events", "covers", "rooms", "listings", "pages"],
  events: ["posts", "covers"],
  covers: ["posts", "events"],
  pages: ["posts", "events", "covers"],
  listings: ["rooms", "posts"],
};

export type Picked = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  /** True when the image's file-name topic matched the slot. */
  strong: boolean;
};

type Indexed = { img: SeedImage; topic: Set<string>; tags: Set<string> };
type Ranked = { img: SeedImage; score: number; tie: number; exact: boolean };

/**
 * Deterministic photo picker. A slot's topic words (plus synonyms) are scored
 * against each image's file-name topic (strong) and manifest tags (weak);
 * optional `context` words (a listing title, post text) break ties. Remaining
 * ties are broken by a stable hash of the caller's key. Images whose file-name
 * topic equals the slot topic exactly ("velvet sofa" → `velvet-sofa-02.jpg`)
 * always come first. Images already handed out are avoided while unused matches
 * remain, so listings and posts rarely share photos.
 */
export class ImagePicker {
  private readonly used = new Map<ImageFolder, Set<string>>();
  private readonly index = new Map<ImageFolder, Indexed[]>();

  constructor() {
    for (const [folder, imgs] of Object.entries(seedImages) as [
      ImageFolder,
      readonly SeedImage[],
    ][]) {
      this.index.set(
        folder,
        imgs.map((img) => ({
          img,
          topic: new Set(tokens(img.topic)),
          tags: new Set(img.tags.flatMap(tokens)),
        })),
      );
    }
  }

  /** Split "rooms/bedroom" into folder + topic; plain topics use `fallback`. */
  private static split(slot: PhotoSlot): { folder?: ImageFolder; topic: string } {
    const i = slot.indexOf("/");
    if (i > 0 && FOLDERS.has(slot.slice(0, i))) {
      return { folder: slot.slice(0, i) as ImageFolder, topic: slot.slice(i + 1) };
    }
    return { topic: slot };
  }

  private strongIn(folder: ImageFolder, topic: string): number {
    const want = expand(tokens(topic));
    return (this.index.get(folder) ?? []).filter(({ topic: tt }) => want.some((t) => tt.has(t)))
      .length;
  }

  /**
   * Resolve a slot to a folder + topic: an explicit "folder/topic" wins; otherwise the default
   * folder, or a related folder when the default has nothing on topic.
   */
  parse(slot: PhotoSlot, fallback: ImageFolder): { folder: ImageFolder; topic: string } {
    const { folder, topic } = ImagePicker.split(slot);
    if (folder) return { folder, topic };
    if (this.strongIn(fallback, topic) > 0) return { folder: fallback, topic };
    const borrowed = (BORROW[fallback] ?? []).find((f) => this.strongIn(f, topic) > 0);
    return { folder: borrowed ?? fallback, topic };
  }

  /**
   * Marks exact-file slots ("covers/ballard-01.jpg") as taken up front, so picks made earlier
   * in the plan (profile covers, say) never land on a file another row names.
   */
  reserve(slots: readonly PhotoSlot[]): void {
    for (const slot of slots) {
      const { folder, topic } = ImagePicker.split(slot);
      if (!folder || !FILE_NAME.test(topic)) continue;
      const used = this.used.get(folder) ?? new Set<string>();
      this.used.set(folder, used);
      used.add(`/seed/${folder}/${topic}`);
    }
  }

  /** How many images in the slot's folder have exactly the slot's topic as their file-name topic. */
  exactCount(slot: PhotoSlot, fallback: ImageFolder): number {
    const { folder, topic } = this.parse(slot, fallback);
    const want = phrase(topic);
    return (this.index.get(folder) ?? []).filter(({ img }) => img.topic === want).length;
  }

  /** How many images in the slot's folder match its topic strongly. */
  matchCount(slot: PhotoSlot, fallback: ImageFolder): number {
    const { folder, topic } = this.parse(slot, fallback);
    return this.strongIn(folder, topic);
  }

  /**
   * `n` distinct images for a slot (repeats only if the folder is too small).
   * `exclude` holds paths the caller already used nearby (e.g. earlier photos of the same post).
   */
  pickMany(
    slot: PhotoSlot,
    fallback: ImageFolder,
    key: string,
    n: number,
    context = "",
    exclude: ReadonlySet<string> = new Set(),
  ): Picked[] {
    const { folder, topic } = this.parse(slot, fallback);
    const pool = this.index.get(folder) ?? [];
    if (pool.length === 0) {
      return Array.from({ length: n }, (_, i) => ({
        url: `/seed/${folder}/missing-${(hash(`${key}:${i}`) % 997).toString()}.jpg`,
        alt: topic,
        strong: false,
      }));
    }
    const used = this.used.get(folder) ?? new Set<string>();
    this.used.set(folder, used);
    // "covers/ballard-01.jpg" names one exact file: hand it out as-is.
    if (FILE_NAME.test(topic)) {
      const file = pool.find(({ img }) => img.path === `/seed/${folder}/${topic}`)?.img;
      if (file) {
        used.add(file.path);
        const one = {
          url: file.path,
          width: file.w,
          height: file.h,
          alt: file.topic,
          strong: true,
        };
        return Array.from({ length: n }, () => one);
      }
    }
    const want = expand(tokens(topic));
    const wantPhrase = phrase(topic);
    const ctx = expand(tokens(context));
    const ranked: Ranked[] = pool
      .map(({ img, topic: tt, tags }) => {
        let score = 0;
        for (const t of want) score += tt.has(t) ? 10 : tags.has(t) ? 2 : 0;
        for (const t of ctx) score += tt.has(t) ? 3 : tags.has(t) ? 0.5 : 0;
        const exact = img.topic === wantPhrase;
        if (exact) score += 100;
        return { img, score, tie: hash(`${key}|${img.path}`), exact };
      })
      .sort((a, b) => b.score - a.score || a.tie - b.tie);
    const best = ranked[0].score;
    const strong = (r: Ranked) => r.score >= 10 || (best < 10 && r.score > 0);
    const out: Picked[] = [];
    const taken = new Set<string>(exclude);
    // Unused exact matches, then unused strong matches, then reused strong matches, then weaker ones.
    // A slot that names another folder's item ("listings/velvet loveseat" in a post) wants that very
    // item, so it takes the exact file even when a listing already shows it.
    const crossFolder = folder !== fallback && ImagePicker.split(slot).folder !== undefined;
    const passes: ((r: Ranked) => boolean)[] = [
      (r) => r.exact && !used.has(r.img.path),
      (r) => r.exact && crossFolder,
      (r) => strong(r) && !used.has(r.img.path),
      (r) => strong(r),
      (r) => r.score > 0 && !used.has(r.img.path),
      (r) => r.score > 0,
      (r) => !used.has(r.img.path),
      () => true,
    ];
    for (const ok of passes) {
      for (const r of ranked) {
        if (out.length >= n) break;
        if (taken.has(r.img.path) || !ok(r)) continue;
        taken.add(r.img.path);
        used.add(r.img.path);
        out.push({
          url: r.img.path,
          width: r.img.w,
          height: r.img.h,
          alt: topic,
          strong: r.score >= 10,
        });
      }
    }
    const distinct = out.length;
    while (out.length < n) out.push(out[out.length % distinct]);
    return out;
  }

  pick(
    slot: PhotoSlot,
    fallback: ImageFolder,
    key: string,
    context = "",
    exclude?: ReadonlySet<string>,
  ): Picked {
    return this.pickMany(slot, fallback, key, 1, context, exclude)[0];
  }

  /** Avatars are `avatars/m-NN.*` / `avatars/w-NN.*`; the i-th person of a gender gets the i-th file. */
  avatar(gender: "m" | "w", i: number): string {
    const re = new RegExp(`/${gender}-\\d+\\.[a-z]+$`, "i");
    const files = (this.index.get("avatars") ?? [])
      .map(({ img }) => img.path)
      .filter((p) => re.test(p));
    if (files.length === 0) return `/seed/avatars/${gender}-${String(i + 1).padStart(2, "0")}.jpg`;
    return files[i % files.length];
  }
}
