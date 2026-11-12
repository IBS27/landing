// Screenshots each map job (from build.py) with MapLibre + OpenFreeMap vector tiles in
// headless Chrome. Usage (normally run by build.py):
//   bun add --no-save playwright-core@1.48.2 && bun scripts/maps/render.mjs <jobs.json>
// CHROME overrides the browser path (default /usr/bin/google-chrome).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ deviceScaleFactor: 2, userAgent: "seed-fetch/1.0" });
const page = await context.newPage();
await page.goto(pathToFileURL(join(here, "render.html")).href);
await page.waitForFunction(() => "maplibregl" in window);
for (const j of jobs) {
  await page.setViewportSize({ width: j.w, height: j.h });
  // MapLibre zooms are one lower than 256px raster zooms at the same scale.
  await page.evaluate(([s, lng, lat, z]) => window.show(s, lng, lat, z), [j.style, j.lng, j.lat, j.z - 1]);
  await page.screenshot({ path: j.out });
  process.stdout.write(".");
}
process.stdout.write("\n");
await browser.close();
