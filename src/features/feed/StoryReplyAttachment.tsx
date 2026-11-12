import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/format";
import type { Id } from "../../../convex/_generated/dataModel";
import { storyBackground, storyTextColor } from "./storyUtils";

/**
 * The story a Messenger message replied to ("You replied to their story"),
 * shown above the reply bubble. Uses the snapshot saved with the message.
 */
export function StoryReplyAttachment({
  story,
  mine,
  senderFirstName,
}: {
  story: { storyId: Id<"stories">; url?: string; background?: string; text?: string };
  mine: boolean;
  senderFirstName: string;
}) {
  // The snapshot has no media kind: a video story without a poster saved its
  // video URL, which fails as an image, so show its first frame instead.
  const [asVideo, setAsVideo] = useState(false);
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="px-1 text-[12px] text-secondary">
        {mine ? "You replied to their story" : `${senderFirstName} replied to your story`}
      </span>
      <Link
        to="/stories/$storyId"
        params={{ storyId: story.storyId }}
        aria-label="View story"
        className="block h-[178px] w-[100px] overflow-hidden rounded-[18px] border border-[var(--media-inner-border)] bg-black"
      >
        {story.url && asVideo ? (
          <video
            src={story.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden
            className="h-full w-full object-cover"
          />
        ) : story.url ? (
          <img
            src={story.url}
            alt=""
            onError={() => setAsVideo(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center p-2 text-center font-semibold text-[11px] leading-[14px]"
            style={{
              background: storyBackground(story.background ?? null),
              color: storyTextColor(story.background ?? null),
            }}
          >
            <span className="line-clamp-6">{story.text}</span>
          </span>
        )}
      </Link>
    </div>
  );
}
