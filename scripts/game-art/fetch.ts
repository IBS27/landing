/**
 * Downloads the photos and fonts listed in ./sources.ts into ./.cache
 * (skipping anything already there) and records each photo's Commons metadata.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CREATORS, FONTS, PHOTOS, type PhotoKey } from "./sources";

export const CACHE = join(import.meta.dir, ".cache");
const UA = { "User-Agent": "seed-fetch/1.0" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PhotoMeta = {
  title: string;
  source_url: string;
  creator: string;
  creator_url?: string;
  license: string;
  license_url: string;
  width: number;
  height: number;
};

async function get(url: string, tries = 8): Promise<Response> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r;
    if (i >= tries) throw new Error(`${r.status} ${url}`);
    await sleep(Number(r.headers.get("retry-after") ?? 0) * 1000 || 4000 * (i + 1));
  }
}

const strip = (html = "") =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function photo(key: PhotoKey) {
  const file = join(CACHE, "photos", `${key}.jpg`);
  const metaFile = join(CACHE, "photos", `${key}.json`);
  if (existsSync(file) && existsSync(metaFile)) return;
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({
    action: "query",
    format: "json",
    titles: PHOTOS[key],
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1920",
  }))
    u.searchParams.set(k, v);
  const data = (await (await get(u.toString())).json()) as {
    query: { pages: Record<string, { imageinfo: { thumburl: string; descriptionurl: string; width: number; height: number; extmetadata: Record<string, { value: string }> }[] }> };
  };
  let ii = Object.values(data.query.pages)[0].imageinfo[0];
  if (ii.width <= 1920) {
    // Commons only serves standard thumbnail steps; 1280 is the next one down.
    u.searchParams.set("iiurlwidth", "1280");
    await sleep(1000);
    ii = ((await (await get(u.toString())).json()) as typeof data).query.pages[Object.keys(data.query.pages)[0]].imageinfo[0];
  }
  const m = ii.extmetadata;
  const artist = m.Artist?.value ?? "";
  const meta: PhotoMeta = {
    title: PHOTOS[key].replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
    source_url: ii.descriptionurl,
    creator: CREATORS[key] ?? (strip(artist) || "Unknown"),
    creator_url: artist.match(/href="([^"]+)"/)?.[1]?.replace(/^\/\//, "https://"),
    license: m.LicenseShortName?.value ?? "",
    license_url: m.LicenseUrl?.value ?? "https://creativecommons.org/publicdomain/mark/1.0/",
    width: ii.width,
    height: ii.height,
  };
  await sleep(2500);
  const buf = Buffer.from(await (await get(ii.thumburl)).arrayBuffer());
  writeFileSync(file, buf);
  writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  console.log(`photo ${key}: ${meta.license} by ${meta.creator}`);
  await sleep(2500);
}

async function font(family: string, axes: string) {
  const file = join(CACHE, "fonts", `${family.replace(/ /g, "")}.ttf`);
  if (existsSync(file)) return;
  // Without a browser user agent Google Fonts serves plain TrueType.
  const css = await (await get(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${axes}`)).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`no font url for ${family}`);
  writeFileSync(file, Buffer.from(await (await get(src)).arrayBuffer()));
  console.log(`font ${family}`);
}

export async function fetchSources() {
  mkdirSync(join(CACHE, "photos"), { recursive: true });
  mkdirSync(join(CACHE, "fonts"), { recursive: true });
  for (const [family, axes] of Object.entries(FONTS)) await font(family, axes);
  for (const key of Object.keys(PHOTOS) as PhotoKey[]) await photo(key);
}

export function photoMeta(key: PhotoKey): PhotoMeta {
  return JSON.parse(readFileSync(join(CACHE, "photos", `${key}.json`), "utf8"));
}

if (import.meta.main) await fetchSources();
