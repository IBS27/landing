/**
 * Renders the Gaming key art to public/seed/games/ as WebP:
 *   <id>.webp        1280 x 720 cover (featured cards, game dialog)
 *   <id>-thumb.webp   480 x 270 cover (Top picks tiles)
 *   <id>-icon.webp    160 x 160 app icon cropped around the hero (no wordmark)
 * and records the Commons photos each cover composites in
 * public/seed/manifest.json and public/seed/ATTRIBUTION.md.
 *
 *   bun scripts/game-art/build.ts [id ...]
 *
 * Needs network on first run (photos and fonts are cached in .cache/),
 * headless Chrome (google-chrome) and ImageMagick (`magick`).
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE, fetchSources, photoMeta } from "./fetch";
import { H, W } from "./kit";
import { SCENES } from "./scenes";
import { FONTS, type PhotoKey } from "./sources";

const ROOT = join(import.meta.dir, "../..");
const SEED = join(ROOT, "public/seed");
const OUT = join(SEED, "games");
const CHROME = process.env.CHROME ?? "google-chrome";

const fontCss = Object.entries(FONTS)
  .map(
    ([family, axes]) =>
      `@font-face{font-family:"${family}";src:url("file://${join(CACHE, "fonts", `${family.replace(/ /g, "")}.ttf`)}");font-weight:1 1000;font-style:${axes.includes("ital") ? "italic" : "normal"}}`,
  )
  .join("");

async function run(cmd: string[]) {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  if ((await p.exited) !== 0) throw new Error(`${cmd[0]} failed: ${await new Response(p.stderr).text()}`);
}

async function shoot(svg: string, w: number, h: number, scale: number, png: string, tmp: string) {
  const html = join(tmp, `${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><style>${fontCss}html,body{margin:0;background:#000;overflow:hidden}svg{display:block}</style>${svg.replace("<svg ", `<svg width="${w}" height="${h}" `)}`,
  );
  await run([
    CHROME,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--user-data-dir=${html}.profile`,
    "--virtual-time-budget=4000",
    `--force-device-scale-factor=${scale}`,
    `--window-size=${w},${h}`,
    `--screenshot=${png}`,
    `file://${html}`,
  ]);
}

const webp = (src: string, out: string, q: number, resize?: string) =>
  run(["magick", src, ...(resize ? ["-resize", resize] : []), "-strip", "-quality", String(q), "-define", "webp:method=6", out]);

/* ───────────── Attribution ───────────── */

function writeAttribution(used: Map<string, PhotoKey[]>) {
  const rows = [...used].sort(([a], [b]) => a.localeCompare(b));
  // manifest.json: replace the games/ entries, leaving every other line untouched.
  const file = join(SEED, "manifest.json");
  let text = readFileSync(file, "utf8").replace(/,\n {2}"games\/[^"]+": \{\n[\s\S]*?\n {2}\}(?=,\n|\n\})/g, "");
  const entries = rows.map(([id, keys]) => {
    const metas = keys.map(photoMeta);
    const m = metas[0];
    const value = {
      source_url: m.source_url,
      creator: m.creator,
      ...(m.creator_url ? { creator_url: m.creator_url } : {}),
      license: m.license,
      license_url: m.license_url,
      title: m.title,
      tags: ["game", "key art"],
      provider: "wikimedia",
      derivative: `Original key art composited over the photo (cropped, colour-graded, painted over); -thumb and -icon variants derive from it.${metas.length > 1 ? ` Also uses: ${metas.slice(1).map((x) => `${x.title} (${x.source_url}) by ${x.creator}, ${x.license}`).join("; ")}.` : ""}`,
      width: 1280,
      height: 720,
    };
    return `  ${JSON.stringify(`games/${id}.webp`)}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")}`;
  });
  text = text.replace(/\n\}\s*$/, `,\n${entries.join(",\n")}\n}\n`);
  JSON.parse(text);
  writeFileSync(file, text);

  // ATTRIBUTION.md: (re)write the "## games" section.
  const md = join(SEED, "ATTRIBUTION.md");
  const lines = rows.flatMap(([id, keys]) =>
    keys.map((k) => {
      const m = photoMeta(k);
      return `- \`games/${id}.webp\` (+ \`-thumb\`, \`-icon\`): ["${m.title}"](${m.source_url}) by ${m.creator}, [${m.license}](${m.license_url})`;
    }),
  );
  const section = `## games (${rows.length})\n\nGame key art is original artwork rendered by \`scripts/game-art\`. These covers composite a photo underneath (cropped, colour-graded and painted over); the remaining covers use no third-party images. Wordmarks use Google Fonts under the SIL Open Font License.\n\n${lines.join("\n")}\n`;
  let doc = readFileSync(md, "utf8");
  const start = doc.indexOf("\n## games (");
  if (start >= 0) {
    const next = doc.indexOf("\n## ", start + 1);
    doc = doc.slice(0, start + 1) + section + (next >= 0 ? doc.slice(next) : "");
  } else doc = `${doc.trimEnd()}\n\n${section}`;
  writeFileSync(md, doc);
}

/* ───────────── Main ───────────── */

await fetchSources();
const only = new Set(process.argv.slice(2));
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "game-art-"));
const used = new Map<string, PhotoKey[]>();
const jobs: (() => Promise<void>)[] = [];
for (const [id, paint] of Object.entries(SCENES)) {
  const art = paint();
  if (art.photos.length) used.set(id, art.photos as PhotoKey[]);
  if (only.size && !only.has(id)) continue;
  jobs.push(async () => {
    const cover = join(tmp, `${id}.png`);
    const icon = join(tmp, `${id}-icon.png`);
    const [cx, cy, size] = art.focus;
    await Promise.all([
      shoot(art.cover, W, H, 2, cover, tmp),
      shoot(art.icon(`${cx - size / 2} ${cy - size / 2} ${size} ${size}`), 80, 80, 2, icon, tmp),
    ]);
    await Promise.all([
      webp(cover, join(OUT, `${id}.webp`), 80),
      webp(cover, join(OUT, `${id}-thumb.webp`), 82, "480x270"),
      webp(icon, join(OUT, `${id}-icon.webp`), 85),
    ]);
    console.log(`✓ ${id}`);
  });
}
try {
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await job();
    }),
  );
  if (!only.size)
    for (const f of readdirSync(OUT)) if (!f.endsWith(".webp")) unlinkSync(join(OUT, f));
  writeAttribution(used);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
