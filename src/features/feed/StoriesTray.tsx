import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { entryStory, type StoryBucket, storyBackground, storyTextColor } from "./storyUtils";

const TILE = 140;
const GAP = 8;

/** Home stories: "Create story" tile then friends' story tiles, with scroll arrows. */
export function StoriesTray() {
  const viewer = useViewer();
  const buckets = useQ(api.stories.tray, {});
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the tray content changes.
  useEffect(update, [buckets]);

  if (buckets === undefined)
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[250px] w-[140px] shrink-0 animate-pulse rounded-lg bg-btn" />
        ))}
      </div>
    );

  if (buckets.length === 0) return <CreateStoryCard />;

  const scrollBy = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: dir * (TILE + GAP) * 3, behavior: "smooth" });

  // Your story first, then people with unseen stories, then the ones you've watched.
  const ordered = [
    ...buckets.filter((b) => b.author._id === viewer._id),
    ...buckets.filter((b) => b.author._id !== viewer._id && !b.seen),
    ...buckets.filter((b) => b.author._id !== viewer._id && b.seen),
  ];

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={update}
        className="scrollbar-none flex gap-2 overflow-x-auto scroll-smooth"
      >
        <Link
          to="/stories/create"
          className="group relative flex h-[250px] w-[140px] shrink-0 flex-col overflow-hidden rounded-lg bg-card shadow-base"
        >
          <span className="h-[190px] overflow-hidden">
            <img
              src={viewer.avatar}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </span>
          <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
          <span className="relative flex flex-1 items-end justify-center pb-3">
            <span className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-fb text-white">
              <Plus size={20} strokeWidth={3} />
            </span>
            <span className="font-semibold text-[13px] text-primary leading-4">Create story</span>
          </span>
        </Link>
        {ordered.map((b) => (
          <StoryTile
            key={b.author._id}
            bucket={b}
            own={b.author._id === viewer._id}
            label={b.author._id === viewer._id ? "Your story" : b.author.name}
          />
        ))}
      </div>
      {!edges.start && (
        <TrayArrow side="left" onClick={() => scrollBy(-1)} label="Previous stories" />
      )}
      {!edges.end && <TrayArrow side="right" onClick={() => scrollBy(1)} label="Next stories" />}
    </div>
  );
}

function StoryTile({ bucket, label, own }: { bucket: StoryBucket; label: string; own: boolean }) {
  // The tile previews the story it opens: the first unseen one (else the first).
  const entry = entryStory(bucket);
  // Your own story and people you've caught up on get a grey ring.
  const seen = own || bucket.seen;
  return (
    <Link
      to="/stories/$storyId"
      params={{ storyId: entry._id }}
      aria-label={own ? "Your story" : `${label}'s story`}
      className="group relative h-[250px] w-[140px] shrink-0 overflow-hidden rounded-lg bg-black text-left shadow-base"
    >
      {entry.background || !entry.media.url ? (
        <span
          className="flex h-full w-full items-center justify-center p-3 text-center font-semibold text-[13px] text-white transition-transform duration-300 group-hover:scale-[1.02]"
          style={{
            background: storyBackground(entry.background),
            color: storyTextColor(entry.background),
          }}
        >
          <span className="line-clamp-5">{entry.text}</span>
        </span>
      ) : entry.media.kind === "video" && !entry.media.poster ? (
        <video
          src={entry.media.url}
          muted
          preload="metadata"
          aria-hidden
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <img
          src={entry.media.kind === "video" ? entry.media.poster : entry.media.url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      )}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,transparent_30%,transparent_65%,rgba(0,0,0,0.6)_100%)] transition-colors group-hover:bg-black/10" />
      <span
        className={cn(
          "absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full",
          seen ? "bg-[#ced0d4]" : "bg-fb",
        )}
      >
        <img
          src={bucket.author.avatar}
          alt=""
          className={cn(
            "h-9 w-9 rounded-full border-[3px] object-cover",
            seen ? "border-[#ced0d4]" : "border-fb",
          )}
        />
      </span>
      <span className="absolute inset-x-3 bottom-3 line-clamp-2 font-semibold text-[13px] text-white leading-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
        {label}
      </span>
    </Link>
  );
}

function TrayArrow({
  side,
  onClick,
  label,
}: {
  side: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-btn-floating text-icon-secondary shadow-[0_2px_8px_var(--shadow-1),0_0_0_1px_var(--shadow-1)] hover:brightness-95",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  );
}

/** Shown when nobody has an active story (01-home.png). */
function CreateStoryCard() {
  return (
    <Card className="p-2">
      <Link
        to="/stories/create"
        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn-soft text-fb">
          <Plus size={22} strokeWidth={2.5} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[17px] text-primary leading-[22px]">
            Create story
          </span>
          <span className="block text-[15px] text-secondary leading-5">
            Share a photo, video or write something
          </span>
        </span>
      </Link>
    </Card>
  );
}
