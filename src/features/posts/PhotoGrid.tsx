import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import type { PostMedia } from "./types";
import { PlayGlyph, VideoPlayer } from "./VideoPlayer";

/**
 * Facebook's feed photo layouts: 1 (natural aspect, letterboxed when tall),
 * 2 (side by side), 3 and 4 (one large on top, the rest below) and 5+
 * (two on top, three below with a "+N" overlay on the last tile).
 */
export function PhotoGrid({
  media,
  onOpen,
  className,
}: {
  media: PostMedia[];
  onOpen?: (index: number) => void;
  className?: string;
}) {
  if (media.length === 0) return null;
  if (media.length === 1)
    return <Single item={media[0]} onOpen={() => onOpen?.(0)} className={className} />;

  const tile = (i: number, cls: string, overlay?: number) => (
    <Tile key={i} item={media[i]} onOpen={() => onOpen?.(i)} className={cls} overlay={overlay} />
  );
  const n = media.length;
  let content: React.ReactNode;
  if (n === 2) {
    content = (
      <div className="grid aspect-[2/1] grid-cols-2 gap-0.5">{[tile(0, ""), tile(1, "")]}</div>
    );
  } else if (n === 3) {
    content = (
      <div className="grid aspect-square grid-cols-2 grid-rows-[3fr_2fr] gap-0.5">
        {tile(0, "col-span-2")}
        {tile(1, "")}
        {tile(2, "")}
      </div>
    );
  } else if (n === 4) {
    content = (
      <div className="grid aspect-square grid-cols-3 grid-rows-[2fr_1fr] gap-0.5">
        {tile(0, "col-span-3")}
        {tile(1, "")}
        {tile(2, "")}
        {tile(3, "")}
      </div>
    );
  } else {
    content = (
      <div className="grid aspect-square grid-cols-6 grid-rows-2 gap-0.5">
        {tile(0, "col-span-3")}
        {tile(1, "col-span-3")}
        {tile(2, "col-span-2")}
        {tile(3, "col-span-2")}
        {tile(4, "col-span-2", n > 5 ? n - 5 : undefined)}
      </div>
    );
  }
  return <div className={cn("overflow-hidden", className)}>{content}</div>;
}

/** Facebook caps a single photo's height and letterboxes narrower photos. */
const MAX_MEDIA_HEIGHT = 575;

function Single({
  item,
  onOpen,
  className,
}: {
  item: PostMedia;
  onOpen: () => void;
  className?: string;
}) {
  const ratio = item.width && item.height ? item.width / item.height : 4 / 3;
  // Videos play inline, letterboxed on black when taller than the capped box.
  if (item.kind === "video")
    return (
      <VideoPlayer
        src={item.url}
        poster={item.poster}
        label={item.alt}
        className={cn("w-full", className)}
        style={{ aspectRatio: ratio, maxHeight: MAX_MEDIA_HEIGHT }}
      />
    );
  // Wider than the capped box (680×575) fills edge to edge; narrower photos sit
  // centred on a flat fill of the photo's dominant colour, like Facebook.
  const letterboxed = ratio < 1.2;
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

function LetterboxFill({ url }: { url: string }) {
  const [color, setColor] = useState(() => fillCache.get(url));
  useEffect(() => {
    if (fillCache.has(url)) {
      setColor(fillCache.get(url));
      return;
    }
    let live = true;
    dominantFill(url).then((c) => {
      fillCache.set(url, c);
      if (live) setColor(c);
    });
    return () => {
      live = false;
    };
  }, [url]);
  if (!color) return null;
  return <span aria-hidden className="absolute inset-0" style={{ backgroundColor: color }} />;
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
