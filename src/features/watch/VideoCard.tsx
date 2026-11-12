import { useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { ActionBar, PostContent, PostDialog, PostHeader, type PostView } from "@/features/posts";
import { VideoPlayer } from "@/features/posts/VideoPlayer";
import { viewsLabel } from "@/features/posts/views";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/**
 * A Video-feed post: header (with "· Follow" for unfollowed Pages), caption, an
 * inline 16:9 player and the action bar with the view count in its stats row.
 */
export function VideoCard({ post }: { post: PostView }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const views = viewsLabel(post);
  return (
    <Card className="overflow-hidden rounded-xl">
      <PostHeader post={post} nameSuffix={<FollowPage author={post.author} />} />
      <PostContent
        post={{ ...post, media: [], attachments: [], shared: null }}
        onSeeMore={() => setDialogOpen(true)}
        smallText
      />
      <PostVideo post={post} />
      <ActionBar
        post={post}
        onComment={() => setDialogOpen(true)}
        trailing={
          views && <span className="mr-1 px-1 text-[15px] text-secondary leading-5">{views}</span>
        }
      />
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
      postId={post._id}
      className={cn("aspect-video w-full", className)}
    />
  );
}

/** "· Follow" after a Page's name until the viewer follows it, like Facebook's Video feed. */
function FollowPage({ author }: { author: PostView["author"] }) {
  const viewer = useViewer();
  const followingIds = useQ(api.pages.followingIds, {});
  const follow = useM(api.media.follow);
  const [done, setDone] = useState(false);
  if (
    author.kind !== "page" ||
    author._id === viewer._id ||
    followingIds === undefined ||
    followingIds.includes(author._id) ||
    done
  )
    return null;
  return (
    <>
      <span className="mx-1 text-secondary" aria-hidden>
        ·
      </span>
      <button
        type="button"
        onClick={() => {
          setDone(true);
          follow({ targetId: author._id, follow: true }).catch(() => setDone(false));
        }}
        className="font-semibold text-link hover:underline"
      >
        Follow
      </button>
    </>
  );
}
