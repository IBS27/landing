import { useState } from "react";
import { ActionBar, PostContent, PostDialog, PostHeader, type PostView } from "@/features/posts";
import { VideoPlayer } from "@/features/posts/VideoPlayer";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";

/** A Video-feed post: header, caption, an inline 16:9 player and the action bar. */
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
      <PostVideo post={post} />
      <ActionBar post={post} onComment={() => setDialogOpen(true)} />
      {dialogOpen && <PostDialog post={post} onClose={() => setDialogOpen(false)} />}
    </Card>
  );
}

/** The post's video in a 16:9 box (taller videos are letterboxed on black). */
export function PostVideo({
  post,
  className,
  autoPlay = true,
}: {
  post: PostView;
  className?: string;
  autoPlay?: boolean;
}) {
  const item = post.media.find((m) => m.kind === "video");
  if (!item) return null;
  return (
    <VideoPlayer
      src={item.url}
      poster={item.poster}
      label={post.text ?? `Video from ${post.author.name}`}
      autoPlay={autoPlay}
      className={cn("aspect-video w-full", className)}
    />
  );
}
