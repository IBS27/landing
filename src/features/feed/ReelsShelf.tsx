import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { DotsIcon } from "@/features/posts/icons";
import { Card, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

const TILE = 192;
const GAP = 8;

/** Facebook's clapperboard Reels glyph. */
function ReelsGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M5 2h14a3 3 0 0 1 3 3v2H2V5a3 3 0 0 1 3-3Zm2.2 1.6L8.9 6h2.4L9.6 3.6H7.2Zm5 0L13.9 6h2.4l-1.7-2.4h-2.4Zm5 0L18.9 6h1.5V5c0-.7-.5-1.3-1.1-1.4h-2.1ZM2 8.5h20V19a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8.5Zm8 3.3v6.4c0 .5.5.8 1 .6l5-3.2a.7.7 0 0 0 0-1.2l-5-3.2c-.5-.2-1 .1-1 .6Z" />
    </svg>
  );
}

/**
 * The "Reels" card Home slots into the feed: a horizontally scrolling row of
 * 9:16 tiles with previous/next arrows. Each tile opens that reel.
 */
export function ReelsShelf() {
  const reels = useQ(api.feed.reelsShelf, {});
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = row.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure once tiles arrive
  useEffect(update, [reels?.length]);

  if (reels !== undefined && reels.length === 0) return null;
  const page = (dir: 1 | -1) =>
    row.current?.scrollBy({ left: dir * (TILE + GAP) * 3, behavior: "smooth" });

  return (
    <Card className="relative rounded-xl">
      <div className="flex h-[47px] items-center gap-2 pr-2 pl-3">
        <Link to="/reel" className="flex items-center gap-2 text-primary hover:underline">
          <ReelsGlyph />
          <span className="font-semibold text-[15px] leading-5">Reels</span>
        </Link>
        <span className="flex-1" />
        <IconButton label="More options for Reels" variant="ghost">
          <DotsIcon className="text-icon-secondary" />
        </IconButton>
      </div>
      <div
        ref={row}
        onScroll={update}
        className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-4"
      >
        {reels === undefined
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[343px] w-[192px] shrink-0 rounded-[10px] bg-btn" />
            ))
          : reels.map((r) => (
              <Link
                key={r._id}
                to="/reel/$reelId"
                params={{ reelId: r._id }}
                aria-label={r.caption ? `Reel: ${r.caption}` : "Reel"}
                className="group relative h-[343px] w-[192px] shrink-0 overflow-hidden rounded-[10px] bg-black shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
              >
                <img
                  src={r.image}
                  alt={r.alt ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition-[filter] group-hover:brightness-90"
                />
                {r.caption && (
                  <>
                    <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute inset-x-3 bottom-3 line-clamp-2 break-words font-semibold text-[15px] text-white leading-5 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                      {r.caption}
                    </span>
                  </>
                )}
                <span className="absolute top-[10px] right-[10px] flex h-6 w-8 items-center justify-center text-white drop-shadow">
                  <DotsIcon size={16} className="rotate-90" />
                </span>
              </Link>
            ))}
      </div>
      {!edge.start && <ShelfArrow side="left" onClick={() => page(-1)} />}
      {!edge.end && reels !== undefined && <ShelfArrow side="right" onClick={() => page(1)} />}
    </Card>
  );
}

function ShelfArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "See more"}
      onClick={onClick}
      className={`absolute top-[194px] flex h-12 w-12 items-center justify-center rounded-full bg-card text-icon-secondary shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.1)] hover:bg-comment ${side === "left" ? "left-4" : "right-4"}`}
    >
      <Icon size={24} strokeWidth={2} />
    </button>
  );
}
