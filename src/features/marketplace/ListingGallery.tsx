import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlayGlyph, VideoPlayer } from "@/features/posts/VideoPlayer";
import { cn } from "@/lib/format";
import type { RentalMedia } from "../../../convex/lib/rentalMedia";
import type { Media } from "../../../convex/validators";

/* ───────────── Gallery ───────────── */

export function ListingGallery({
  photos,
  video,
  title,
  rentalMedia,
}: {
  photos: string[];
  video: Media | null;
  title: string;
  rentalMedia?: RentalMedia | null;
}) {
  const [i, setI] = useState(0);
  // The listing video (if any) leads the gallery, then the photos.
  const slides = [
    ...(video ? [{ video, thumb: video.poster ?? "", label: "Listing video", plan: false }] : []),
    ...photos.map((p, k) => ({
      video: null,
      thumb: p,
      label: rentalMedia?.photos.find((photo) => photo.url === p)?.label ?? `Photo ${k + 1}`,
      plan: false,
    })),
    ...(rentalMedia
      ? [
          {
            video: null,
            thumb: rentalMedia.floorPlan.url,
            label: rentalMedia.floorPlan.label,
            plan: true,
          },
        ]
      : []),
  ];
  const n = slides.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
      if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(`[data-slide="${i}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [i]);
  const slide = slides[i];
  const src = slide && !slide.video ? slide.thumb : undefined;
  return (
    <div ref={ref} className="relative min-w-0 flex-1 overflow-hidden bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 pb-10 text-white">
        <div>
          <p className="font-semibold">
            {slide?.label}{" "}
            <span className="font-normal text-sm">
              · {i + 1} of {n}
            </span>
          </p>
          {rentalMedia && (
            <a
              className="text-sm underline"
              href={rentalMedia.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Demo listing · Photos and plan from {rentalMedia.sourceName}
            </a>
          )}
        </div>
        {slide?.plan && (
          <a
            href={slide.thumb}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-lg bg-white px-3 py-2 font-semibold text-black text-sm"
          >
            Open full-size plan
          </a>
        )}
        {rentalMedia && (
          <button
            type="button"
            className="shrink-0 rounded-lg bg-white px-3 py-2 font-semibold text-black text-sm"
            onClick={() => setI(n - 1)}
          >
            Floor plan
          </button>
        )}
      </div>
      {slide?.video && (
        <VideoPlayer
          key={slide.video.url}
          src={slide.video.url}
          poster={slide.video.poster}
          label={`${title} video`}
          className={n > 1 ? "h-[calc(100%-52px)] w-full" : "h-full w-full"}
        />
      )}
      {src && (
        <>
          {!slide.plan && (
            <img
              src={src}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
            />
          )}
          <img
            src={src}
            alt={`${title} · ${slide.label}`}
            className={cn(
              "relative h-full w-full object-contain pt-24 pb-24",
              slide.plan && "bg-white",
            )}
          />
        </>
      )}
      {n > 1 && (
        <>
          <GalleryArrow side="left" onClick={() => go(-1)} />
          <GalleryArrow side="right" onClick={() => go(1)} />
          <div className="absolute inset-x-0 bottom-0 flex h-20 items-center gap-2 overflow-x-auto bg-black/70 px-4">
            {slides.map((p, k) => (
              <button
                key={p.thumb + String(k)}
                type="button"
                aria-label={p.video ? "View video" : `View ${p.label}`}
                title={p.label}
                aria-current={k === i}
                data-slide={k}
                onClick={() => setI(k)}
                className="relative h-12 w-16 shrink-0 overflow-hidden rounded-[6px] bg-[#3a3b3c]"
              >
                {p.thumb && (
                  <img
                    src={p.thumb}
                    alt=""
                    className={cn(
                      "h-full w-full",
                      p.plan ? "bg-white object-contain" : "object-cover",
                    )}
                  />
                )}
                {p.video && (
                  <span className="absolute inset-0 flex items-center justify-center text-white">
                    <PlayGlyph size={14} />
                  </span>
                )}
                <span
                  className={cn(
                    "absolute inset-0 rounded-[6px]",
                    k === i ? "ring-2 ring-white ring-inset" : "bg-black/40 hover:bg-black/20",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "View previous image" : "View next image"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#E2E5E9] text-[#080809] hover:bg-[#d8dadf]",
        side === "left" ? "left-2.5" : "right-2.5",
      )}
    >
      {side === "left" ? (
        <ChevronLeft size={26} strokeWidth={2.25} />
      ) : (
        <ChevronRight size={26} strokeWidth={2.25} />
      )}
    </button>
  );
}
