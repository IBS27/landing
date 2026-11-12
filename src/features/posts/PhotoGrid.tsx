import { cn } from "@/lib/format";
import type { PostMedia } from "./types";

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
  // Tall photos are letterboxed (Facebook caps the height and fills the sides).
  const shown = Math.max(ratio, 0.8);
  if (item.kind === "video")
    return (
      <div className={cn("bg-black", className)}>
        {/* biome-ignore lint/a11y/useMediaCaption: user videos have no caption track */}
        <video
          src={item.url}
          controls
          playsInline
          preload="metadata"
          className="mx-auto max-h-[700px] w-full"
          style={{ aspectRatio: Math.max(ratio, 0.5) }}
        />
      </div>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("relative block w-full overflow-hidden bg-black/90", className)}
      style={{ aspectRatio: shown }}
    >
      {shown !== ratio && (
        <img
          src={item.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
        />
      )}
      <img
        src={item.url}
        alt={item.alt ?? ""}
        loading="lazy"
        className={cn(
          "relative mx-auto h-full",
          shown !== ratio ? "w-auto object-contain" : "w-full object-cover",
        )}
      />
    </button>
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
        <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
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
