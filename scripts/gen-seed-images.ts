/**
 * Scans public/seed/<folder>/ (+ public/seed/manifest.json for tags) and writes
 * convex/seed/images.ts, the typed image catalog the seeder picks from.
 *
 *   bun scripts/gen-seed-images.ts
 *
 * Rerun whenever images under public/seed change, then `bun run seed`.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SEED_DIR = join(ROOT, "public/seed");
const OUT = join(ROOT, "convex/seed/images.ts");
const FOLDERS = ["avatars", "posts", "listings", "rooms", "covers", "events", "pages"] as const;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

type Entry = { path: string; topic: string; tags: string[]; w?: number; h?: number };

/** Normalizes manifest keys like "/seed/posts/a.jpg", "posts/a.jpg" or "public/seed/posts/a.jpg". */
function normKey(p: string): string {
  return p.replace(/^\/+/, "").replace(/^public\//, "").replace(/^seed\//, "");
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((t): t is string => typeof t === "string");
  if (typeof v === "string") return v.split(/[,;]/).map((t) => t.trim());
  return [];
}

/** Accepts the common manifest shapes: an array of entries, a path→tags map, or {images|files: [...]}. */
function readManifest(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const file = join(SEED_DIR, "manifest.json");
  if (!existsSync(file)) return out;
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  const add = (path: unknown, rec: unknown) => {
    if (typeof path !== "string") return;
    const tags: string[] = [];
    if (rec && typeof rec === "object" && !Array.isArray(rec)) {
      const r = rec as Record<string, unknown>;
      tags.push(...asTags(r.tags), ...asTags(r.keywords));
      for (const k of ["topic", "query", "subject", "alt", "title", "description", "category"]) {
        if (typeof r[k] === "string") tags.push(r[k] as string);
      }
    } else {
      tags.push(...asTags(rec));
    }
    const key = normKey(path);
    out.set(key, [...(out.get(key) ?? []), ...tags]);
  };
  const walk = (node: unknown, folderHint?: string) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === "object") {
          const r = item as Record<string, unknown>;
          const p = r.path ?? r.file ?? r.src ?? r.filename ?? r.name;
          if (typeof p === "string") {
            add(folderHint && !p.includes("/") ? `${folderHint}/${p}` : p, r);
          }
        }
      }
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (IMAGE_EXT.test(k)) add(folderHint && !k.includes("/") ? `${folderHint}/${k}` : k, v);
        else walk(v, (FOLDERS as readonly string[]).includes(k) ? k : folderHint);
      }
    }
  };
  walk(data);
  return out;
}

/** Reads pixel dimensions from JPEG / PNG / WebP / GIF headers. */
function dims(file: string): { w: number; h: number } | undefined {
  const b = readFileSync(file);
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 3) === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const n = b.readUInt32LE(21);
      return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return undefined;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return undefined;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? listFiles(join(dir, d.name)) : IMAGE_EXT.test(d.name) ? [join(dir, d.name)] : [],
  );
}

const manifest = readManifest();
const catalog: Record<string, Entry[]> = {};
for (const folder of FOLDERS) {
  catalog[folder] = listFiles(join(SEED_DIR, folder))
    .sort()
    .map((file) => {
      const rel = relative(SEED_DIR, file).split("\\").join("/");
      // "bed-frame-02.jpg" → topic "bed frame"; the file name is the most reliable label.
      const topic = basename(file)
        .replace(IMAGE_EXT, "")
        .split(/[-_\s.]+/)
        .filter((t) => t && !/^\d+$/.test(t))
        .join(" ")
        .toLowerCase();
      const tags = [
        ...new Set((manifest.get(rel) ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean)),
      ];
      return { path: `/seed/${rel}`, topic, tags, ...dims(file) };
    });
}

const lines = [
  "// GENERATED by scripts/gen-seed-images.ts from public/seed. Do not edit by hand.",
  "// Rerun `bun scripts/gen-seed-images.ts` whenever the images change.",
  "",
  "export type SeedImage = {",
  "  readonly path: string;",
  "  /** From the file name, e.g. \"bed frame\"; the strongest match signal. */",
  "  readonly topic: string;",
  "  /** Manifest tags (noisier). */",
  "  readonly tags: readonly string[];",
  "  readonly w?: number;",
  "  readonly h?: number;",
  "};",
  "",
  `export type ImageFolder = ${FOLDERS.map((f) => JSON.stringify(f)).join(" | ")};`,
  "",
  "export const seedImages: Record<ImageFolder, readonly SeedImage[]> = {",
  ...FOLDERS.flatMap((f) => [
    `  ${f}: [`,
    ...catalog[f].map((e) => `    ${JSON.stringify(e).replace(/"(path|topic|tags|w|h)":/g, "$1: ")},`),
    "  ],",
  ]),
  "};",
  "",
];
writeFileSync(OUT, lines.join("\n"));
Bun.spawnSync([join(ROOT, "node_modules/.bin/biome"), "format", "--write", OUT], { stdout: "ignore", stderr: "ignore" });
console.log(
  `wrote ${relative(ROOT, OUT)}: ${FOLDERS.map((f) => `${f}=${catalog[f].length}`).join(" ")} (manifest entries: ${manifest.size})`,
);
