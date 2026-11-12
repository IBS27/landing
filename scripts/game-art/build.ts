/**
 * Renders the Gaming key art to public/seed/games/: `<id>.jpg` (16:9 cover)
 * and `<id>-icon.jpg` (square app icon cropped around the hero).
 *
 *   bun scripts/game-art/build.ts [id ...]
 *
 * Needs headless Chrome (google-chrome) for SVG filters and baked-in fonts,
 * and ImageMagick (`magick`) for JPEG encoding.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { H, W } from "./kit";
import { SCENES } from "./scenes";

const OUT = join(import.meta.dir, "../../public/seed/games");
const CHROME = process.env.CHROME ?? "google-chrome";

function shoot(svg: string, w: number, h: number, scale: number, out: string, tmp: string) {
  const src = join(tmp, "frame.svg");
  const png = join(tmp, "frame.png");
  writeFileSync(src, svg.replace("<svg ", `<svg width="${w}" height="${h}" `));
  const r = spawnSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${w},${h}`,
      `--screenshot=${png}`,
      `file://${src}`,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`chrome failed: ${r.stderr}`);
  const m = spawnSync("magick", [png, "-strip", "-quality", "86", "-sampling-factor", "4:2:0", out]);
  if (m.status !== 0) throw new Error(`magick failed: ${m.stderr}`);
}

const only = new Set(process.argv.slice(2));
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "game-art-"));
try {
  for (const [id, paint] of Object.entries(SCENES)) {
    if (only.size && !only.has(id)) continue;
    const art = paint();
    shoot(art.cover, W, H, 1.25, join(OUT, `${id}.jpg`), tmp);
    const [cx, cy, size] = art.focus;
    shoot(art.icon(`${cx - size / 2} ${cy - size / 2} ${size} ${size}`), 80, 80, 2, join(OUT, `${id}-icon.jpg`), tmp);
    console.log(`✓ ${id}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
