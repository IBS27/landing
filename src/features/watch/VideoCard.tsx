import { Play } from "lucide-react";
import { useState } from "react";
import {
  ActionBar,
  PhotoViewer,
  PostContent,
  PostDialog,
  PostHeader,
  type PostView,
} from "@/features/posts";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";

/**
 * A Video-feed post: header, caption, a 16:9 player and the action bar.
 * Real video files play inline; photo posts show as a poster with a play
 * button that opens the media theater.
 */
export function VideoCard({ post }: { post: PostView }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <Card className="overflow-hidden rounded-xl">
      <PostHeader post={post} />
      <PostContent
        post={{ ...post, media: [], attachments: [], shared: null }}
        onSeeMore={() => setDialogOpen(true)}
        smallText
      />
      <VideoPlayer post={post} />
      <ActionBar post={post} onComment={() => setDialogOpen(true)} />
      {dialogOpen && <PostDialog post={post} onClose={() => setDialogOpen(false)} />}
    </Card>
  );
}

export function VideoPlayer({ post, className }: { post: PostView; className?: string }) {
  const [open, setOpen] = useState(false);
  const item = post.media.find((m) => m.kind === "video") ?? post.media[0];
  if (!item) return null;
  if (item.kind === "video")
    return (
      <div className={cn("aspect-video w-full bg-black", className)}>
        {/* biome-ignore lint/a11y/useMediaCaption: user videos have no caption track */}
        <video src={item.url} controls preload="metadata" className="h-full w-full" />
      </div>
    );
  return (
    <>
      <button
        type="button"
        aria-label={`Play video from ${post.author.name}`}
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block aspect-video w-full overflow-hidden bg-black",
          className,
        )}
      >
        {/* Letterboxed poster over a blurred fill, like Facebook's player. */}
        <img
          src={item.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
        />
        <img
          src={item.url}
          alt={item.alt ?? ""}
          className="relative h-full w-full object-contain"
          loading="lazy"
        />
        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        <span className="absolute top-1/2 left-1/2 flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-black/40 text-white transition-transform group-hover:scale-105">
          <Play size={28} fill="currentColor" strokeWidth={0} className="ml-1" />
        </span>
      </button>
      {open && (
        <PhotoViewer
          post={post}
          index={Math.max(0, post.media.indexOf(item))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
