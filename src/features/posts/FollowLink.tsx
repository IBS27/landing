import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { PostView } from "./types";

/**
 * "· Follow" after the author's name on a public post (not a group's) from a Page
 * or person the viewer neither follows nor is friends with, like Facebook search.
 */
export function FollowLink({ post }: { post: PostView }) {
  const followingIds = useQ(api.pages.followingIds, {});
  const follow = useM(api.media.follow);
  const [done, setDone] = useState(false);
  if (
    post.viewerFollowsAuthor ||
    post.sponsored ||
    post.group ||
    followingIds === undefined ||
    followingIds.includes(post.author._id) ||
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
          follow({ targetId: post.author._id, follow: true }).catch(() => setDone(false));
        }}
        className="font-semibold text-link hover:underline"
      >
        Follow
      </button>
    </>
  );
}
