import { cn } from "@/lib/format";
import { type ThumbMedia, thumbSource } from "./thumb";

/**
 * A cover-fit media thumbnail that fills its box: the image, a video's poster,
 * or else the video's first frame. Size the box, not the thumbnail.
 */
export function MediaThumb({
  media,
  alt = "",
  className,
}: {
  media: ThumbMedia;
  alt?: string;
  className?: string;
}) {
  const t = thumbSource(media);
  const cls = cn("h-full w-full object-cover", className);
  return t.kind === "video" ? (
    <video src={t.src} muted playsInline preload="metadata" aria-hidden className={cls} />
  ) : (
    <img src={t.src} alt={alt} loading="lazy" className={cls} />
  );
}
