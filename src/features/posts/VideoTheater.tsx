import { useRouterState } from "@tanstack/react-router";
import { useQ } from "@/app/viewer";
import { PageUnavailable } from "@/layout/PageUnavailable";
import { api } from "../../../convex/_generated/api";
import { PhotoViewerPlaceholder, Stage, TheaterPostPanel, TheaterShell } from "./PhotoViewer";
import { useCloseTheater, useLockBodyScroll } from "./photoTheater";
import { VideoPlayer } from "./VideoPlayer";

/** Mounted once in the root layout: renders the theater opened by `useVideoTheater`. */
export function VideoTheaterHost() {
  const video = useRouterState({ select: (s) => s.location.state.video });
  const close = useCloseTheater();
  if (!video) return null;
  return (
    <VideoTheater key={video.postId} postId={video.postId} startTime={video.time} onClose={close} />
  );
}

/** `/watch?v=<postId>` opened directly (a shared link or a reload). */
export function VideoTheaterPage({ postId }: { postId: string }) {
  const close = useCloseTheater("/watch");
  return <VideoTheater key={postId} postId={postId} startTime={0} direct onClose={close} />;
}

/**
 * Facebook's video theater: the video on a black stage (close + logo
 * top-left, the player's own controls) and the photo theater's 360px post
 * panel with its comments.
 */
function VideoTheater({
  postId,
  startTime,
  direct,
  onClose,
}: {
  postId: string;
  startTime: number;
  /** Opened from its URL: a missing video is Facebook's "This Page Isn't Available". */
  direct?: boolean;
  onClose: () => void;
}) {
  // The id comes from the URL, so it may be malformed or from another table.
  const post = useQ(api.posts.getFromUrl, { postId });
  useLockBodyScroll();

  const item = post?.media.find((m) => m.kind === "video");
  if (post === undefined) return <PhotoViewerPlaceholder label="Video" onClose={onClose} />;
  if (post === null || !item)
    return direct ? (
      <PageUnavailable />
    ) : (
      <PhotoViewerPlaceholder label="Video" unavailable onClose={onClose} />
    );
  return (
    <TheaterShell label={`Video from ${post.author.name}'s post`} onClose={onClose}>
      <Stage onClose={onClose} tools={false}>
        <VideoPlayer
          theater
          src={item.url}
          poster={item.poster}
          label={item.alt ?? post.text ?? `Video from ${post.author.name}`}
          postId={post._id}
          startTime={startTime}
          className="h-full w-full"
        />
      </Stage>
      <TheaterPostPanel post={post} />
    </TheaterShell>
  );
}
