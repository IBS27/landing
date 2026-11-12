import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pause, Play, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useViewer } from "@/app/viewer";
import { FacebookLogo } from "@/icons";
import { cn, shortAge } from "@/lib/format";
import { type StoryBuckets, storyBackground, storyTextColor } from "./storyUtils";

const DURATION = 5000;

/** Full-screen story viewer: bucket list on the left, 9:16 card with progress bars. */
export function StoryViewer({
  buckets,
  start,
  onClose,
}: {
  buckets: StoryBuckets;
  start: number;
  onClose: () => void;
}) {
  const viewer = useViewer();
  const [pos, setPos] = useState({ b: start, s: 0 });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const elapsed = useRef(0);

  const bucket = buckets[Math.min(pos.b, buckets.length - 1)];
  const storyIdx = Math.min(pos.s, (bucket?.stories.length ?? 1) - 1);
  const story = bucket?.stories[storyIdx];

  const go = useCallback((b: number, s: number) => {
    elapsed.current = 0;
    setProgress(0);
    setPos({ b, s });
  }, []);

  const next = useCallback(() => {
    if (!bucket) return onClose();
    if (storyIdx < bucket.stories.length - 1) go(pos.b, storyIdx + 1);
    else if (pos.b < buckets.length - 1) go(pos.b + 1, 0);
    else onClose();
  }, [bucket, storyIdx, pos.b, buckets.length, go, onClose]);

  const prev = useCallback(() => {
    if (storyIdx > 0) go(pos.b, storyIdx - 1);
    else if (pos.b > 0) go(pos.b - 1, buckets[pos.b - 1].stories.length - 1);
    else go(pos.b, 0);
  }, [storyIdx, pos.b, buckets, go]);

  // Auto-advance every 5s while not paused.
  useEffect(() => {
    if (paused || !story) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= DURATION) {
        next();
        return;
      }
      setProgress(elapsed.current / DURATION);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, story, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, next, prev]);

  if (!bucket || !story) return null;
  const isFirst = pos.b === 0 && storyIdx === 0;
  const own = buckets.find((b) => b.author._id === viewer._id);
  const others = buckets.filter((b) => b.author._id !== viewer._id);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stories"
      className="fixed inset-0 z-[70] flex bg-[#0b0b0c]"
    >
      <aside className="hidden w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_0_var(--divider)] min-[900px]:flex">
        <div className="flex h-14 items-center gap-2 px-4">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95"
          >
            <X size={22} strokeWidth={2.4} />
          </button>
          <FacebookLogo size={40} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <h2 className="px-2 pt-2 font-bold text-[24px] text-primary leading-7">Stories</h2>
          <p className="px-2 pt-1 text-[15px] text-link">
            <span className="hover:underline">Archive</span> ·{" "}
            <span className="hover:underline">Settings</span>
          </p>
          <h3 className="px-2 pt-4 pb-2 font-semibold text-[17px] text-primary">Your story</h3>
          {own ? (
            <BucketRow
              bucket={own}
              active={bucket.author._id === own.author._id}
              onClick={() => go(buckets.indexOf(own), 0)}
            />
          ) : (
            <Link
              to="/stories/create"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover"
            >
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-btn text-fb">
                <Plus size={26} strokeWidth={2.5} />
              </span>
              <span>
                <span className="block font-semibold text-[15px] text-primary">Create a story</span>
                <span className="block text-[13px] text-secondary">
                  Share a photo or write something.
                </span>
              </span>
            </Link>
          )}
          {others.length > 0 && (
            <h3 className="px-2 pt-4 pb-2 font-semibold text-[17px] text-primary">All stories</h3>
          )}
          {others.map((b) => (
            <BucketRow
              key={b.author._id}
              bucket={b}
              active={bucket.author._id === b.author._id}
              onClick={() => go(buckets.indexOf(b), 0)}
            />
          ))}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 min-[900px]:hidden"
        >
          <X size={22} />
        </button>

        <div className="relative flex items-center gap-6">
          <NavButton label="Previous card" disabled={isFirst} onClick={prev} side="left" />
          <div
            className="relative aspect-[9/16] h-[calc(100vh-32px)] max-h-[860px] overflow-hidden rounded-xl bg-black"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
          >
            {story.background || !story.media.url ? (
              <div
                className="flex h-full w-full items-center justify-center p-8 text-center font-bold text-[26px] text-white leading-8"
                style={{
                  background: storyBackground(story.background),
                  color: storyTextColor(story.background),
                }}
              >
                <span className="whitespace-pre-wrap break-words">{story.text}</span>
              </div>
            ) : (
              <>
                <img src={story.media.url} alt="" className="h-full w-full object-contain" />
                {story.text && (
                  <p className="absolute inset-x-6 bottom-16 rounded-lg bg-black/50 p-3 text-center font-semibold text-[17px] text-white">
                    {story.text}
                  </p>
                )}
              </>
            )}

            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="absolute inset-x-3 top-3 flex gap-1">
              {bucket.stories.map((s, i) => (
                <span
                  key={s._id}
                  className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
                >
                  <span
                    className="block h-full bg-white"
                    style={{
                      width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%",
                    }}
                  />
                </span>
              ))}
            </div>
            <div className="absolute inset-x-3 top-6 flex items-center gap-2">
              <img
                src={bucket.author.avatar}
                alt=""
                className="h-10 w-10 rounded-full border-2 border-fb object-cover"
              />
              <span className="min-w-0 flex-1 text-white">
                <span className="font-semibold text-[15px]">{bucket.author.name}</span>
                <span className="ml-2 text-[13px] text-white/80">{shortAge(story.createdAt)}</span>
              </span>
              <button
                type="button"
                aria-label={paused ? "Play" : "Pause"}
                onClick={() => setPaused((p) => !p)}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/15"
              >
                {paused ? (
                  <Play size={18} fill="currentColor" />
                ) : (
                  <Pause size={18} fill="currentColor" />
                )}
              </button>
            </div>
          </div>
          <NavButton label="Next card" onClick={next} side="right" />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BucketRow({
  bucket,
  active,
  onClick,
}: {
  bucket: StoryBuckets[number];
  active: boolean;
  onClick: () => void;
}) {
  const latest = bucket.stories[bucket.stories.length - 1];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
        active ? "bg-wash" : "hover:bg-hover",
      )}
    >
      <span className="rounded-full p-[3px] ring-[3px] ring-fb ring-inset">
        <img
          src={bucket.author.avatar}
          alt=""
          className="h-[54px] w-[54px] rounded-full object-cover"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[15px] text-primary">
          {bucket.author.name}
        </span>
        <span className="block text-[13px] text-link">
          {bucket.stories.length} new{" "}
          <span className="text-secondary">· {shortAge(latest.createdAt)}</span>
        </span>
      </span>
    </button>
  );
}

function NavButton({
  label,
  onClick,
  side,
  disabled,
}: {
  label: string;
  onClick: () => void;
  side: "left" | "right";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#050505] shadow-base transition hover:bg-white",
        disabled && "invisible",
      )}
    >
      {side === "left" ? <ChevronLeft size={28} /> : <ChevronRight size={28} />}
    </button>
  );
}
