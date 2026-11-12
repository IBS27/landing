import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import type { PostMedia } from "./types";
import { PlayGlyph, VideoPlayer } from "./VideoPlayer";

/**
 * Facebook's feed photo layouts: 1 (natural aspect, letterboxed when tall);
 * 2+ are a collage shaped by the first item's orientation (see `Collage`).
 */
export function PhotoGrid({
  media,
  onOpen,
  className,
  sponsored,
}: {
  media: PostMedia[];
  onOpen?: (index: number) => void;
  className?: string;
  /** Ads letterbox their video on pure black instead of the dominant colour. */
  sponsored?: boolean;
}) {
  if (media.length === 0) return null;
  if (media.length === 1)
    return (
      <Single
        item={media[0]}
        onOpen={() => onOpen?.(0)}
        className={className}
        sponsored={sponsored}
      />
    );
  return <Collage media={media} onOpen={onOpen} className={className} />;
}

type Orientation = "portrait" | "square" | "landscape";

const ratioCache = new Map<string, number>();

/** The item's width/height ratio: from its stored size, else measured once the image loads. */
function useMediaRatio(item: PostMedia): number | undefined {
  const known = item.width && item.height ? item.width / item.height : undefined;
  const src = item.kind === "video" ? item.poster : item.url;
  const [measured, setMeasured] = useState(() => (src ? ratioCache.get(src) : undefined));
  useEffect(() => {
    if (known || !src) return;
    const cached = ratioCache.get(src);
    if (cached) return setMeasured(cached);
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const r = img.naturalWidth / img.naturalHeight;
      ratioCache.set(src, r);
      if (live) setMeasured(r);
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [known, src]);
  return known ?? measured;
}

/**
 * Multi-photo collages, laid out from the first item's orientation like Facebook:
 * - 2: side by side (portrait: square box; square: 2:1), stacked when landscape.
 * - 3/4: portrait → one large on the left (2/3 width) with the rest stacked on
 *   the right; otherwise one large on top (2/3 height) with the rest in a row.
 * - 5+: portrait → two stacked on the left, three on the right; otherwise two
 *   squares on top, three below. The fifth tile carries a "+N" overlay.
 */
function Collage({
  media,
  onOpen,
  className,
}: {
  media: PostMedia[];
  onOpen?: (index: number) => void;
  className?: string;
}) {
  const ratio = useMediaRatio(media[0]);
  const orientation: Orientation =
    ratio === undefined || ratio > 1.1 ? "landscape" : ratio < 0.9 ? "portrait" : "square";
  const portrait = orientation === "portrait";
  const tile = (i: number, cls = "", overlay?: number) => (
    <Tile key={i} item={media[i]} onOpen={() => onOpen?.(i)} className={cls} overlay={overlay} />
  );
  const n = media.length;
  let grid: string;
  let tiles: React.ReactNode[];
  if (n === 2) {
    grid =
      orientation === "landscape"
        ? "aspect-square grid-rows-2"
        : portrait
          ? "aspect-square grid-cols-2"
          : "aspect-[2/1] grid-cols-2";
    tiles = [tile(0), tile(1)];
  } else if (n <= 4) {
    // One large tile, the rest stacked beside (portrait) or in a row below it.
    const [box, lead] = portrait
      ? n === 3
        ? ["grid-cols-[2fr_1fr] grid-rows-2", "row-span-2"]
        : ["grid-cols-[2fr_1fr] grid-rows-3", "row-span-3"]
      : n === 3
        ? ["grid-rows-[2fr_1fr] grid-cols-2", "col-span-2"]
        : ["grid-rows-[2fr_1fr] grid-cols-3", "col-span-3"];
    grid = `aspect-square ${box}`;
    tiles = media.map((_, i) => tile(i, i === 0 ? lead : ""));
  } else {
    const more = n > 5 ? n - 5 : undefined;
    grid = portrait
      ? "aspect-square grid-flow-col grid-cols-[3fr_2fr] grid-rows-6"
      : "aspect-[6/5] grid-cols-6 grid-rows-[3fr_2fr]";
    const big = portrait ? "row-span-3" : "col-span-3";
    const small = portrait ? "row-span-2" : "col-span-2";
    tiles = [tile(0, big), tile(1, big), tile(2, small), tile(3, small), tile(4, small, more)];
  }
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className={cn("grid gap-0.5", grid)}>{tiles}</div>
    </div>
  );
}

/** Facebook caps a single photo's height and letterboxes narrower photos. */
const MAX_MEDIA_HEIGHT = 575;

function Single({
  item,
  onOpen,
  className,
  sponsored,
}: {
  item: PostMedia;
  onOpen: () => void;
  className?: string;
  sponsored?: boolean;
}) {
  const ratio = item.width && item.height ? item.width / item.height : 4 / 3;
  // Wider than the capped box (680×575) fills edge to edge; narrower media sit
  // centred on a flat fill of the photo's (or video poster's) dominant colour.
  const letterboxed = ratio < 1.2;
  if (item.kind === "video")
    return <SingleVideo item={item} ratio={ratio} className={className} blackFill={sponsored} />;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("relative block w-full overflow-hidden bg-[#1c1e21]", className)}
      style={{ aspectRatio: ratio, maxHeight: MAX_MEDIA_HEIGHT }}
    >
      {letterboxed && <LetterboxFill url={item.url} />}
      <img
        src={item.url}
        alt={item.alt ?? ""}
        loading="lazy"
        className="relative h-full w-full object-contain"
      />
    </button>
  );
}

/**
 * Facebook's letterbox colour is the photo's dominant colour: the mean of the
 * most populated 3-bit-per-channel colour bucket over a 64×64 sample.
 */
const SAMPLE = 64;
const fillCache = new Map<string, string | null>();

function dominantFill(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
        // Per bucket: summed r, g, b and pixel count.
        const buckets = new Map<number, [number, number, number, number]>();
        let best: [number, number, number, number] = [0, 0, 0, 0];
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
          const e = buckets.get(key) ?? [0, 0, 0, 0];
          e[0] += r;
          e[1] += g;
          e[2] += b;
          e[3] += 1;
          buckets.set(key, e);
          if (e[3] > best[3]) best = e;
        }
        const [r, g, b] = best.slice(0, 3).map((v) => Math.round(v / best[3]));
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(null); // cross-origin image without CORS: keep the neutral dark fill
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * The letterbox colour for `url` (cached per URL): undefined while sampling,
 * null when it can't be read (keep the caller's neutral fill).
 */
export function useDominantColor(url: string | undefined) {
  const [color, setColor] = useState(() => (url ? fillCache.get(url) : null));
  useEffect(() => {
    if (!url) return setColor(null);
    if (fillCache.has(url)) return setColor(fillCache.get(url));
    let live = true;
    setColor(undefined);
    dominantFill(url).then((c) => {
      fillCache.set(url, c);
      if (live) setColor(c);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return color;
}

function LetterboxFill({ url }: { url: string }) {
  const color = useDominantColor(url);
  if (!color) return null;
  return <span aria-hidden className="absolute inset-0" style={{ backgroundColor: color }} />;
}

/**
 * A single inline video; tall ones sit on their poster's dominant colour
 * (black in full screen, and always black for ads, like Facebook).
 */
function SingleVideo({
  item,
  ratio,
  className,
  blackFill,
}: {
  item: PostMedia;
  ratio: number;
  className?: string;
  blackFill?: boolean;
}) {
  const fill = useDominantColor(ratio < 1.2 && !blackFill ? item.poster : undefined);
  return (
    <VideoPlayer
      src={item.url}
      poster={item.poster}
      label={item.alt}
      className={cn("w-full [&:fullscreen]:bg-black!", className)}
      style={{
        aspectRatio: ratio,
        maxHeight: MAX_MEDIA_HEIGHT,
        backgroundColor: fill ?? undefined,
      }}
    />
  );
}

function Tile({
  item,
  onOpen,
  className,
  overlay,
}: {
  item: PostMedia;
  onOpen: () => void;
  className?: string;
  overlay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("group relative min-h-0 overflow-hidden bg-btn", className)}
    >
      {item.kind === "video" ? (
        <>
          {item.poster ? (
            <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
          )}
          <span className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.9)_inset]">
            <PlayGlyph size={24} className="ml-0.5" />
          </span>
        </>
      ) : (
        <img
          src={item.url}
          alt={item.alt ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      {overlay !== undefined && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 font-normal text-[32px] text-white">
          +{overlay}
        </span>
      )}
    </button>
  );
}
