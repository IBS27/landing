import { compactCount } from "@/lib/format";
import type { PostView } from "./types";

/** FNV-1a: a stable 32-bit hash of the post id. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Video view count. The clone doesn't log plays, so views are derived from
 * engagement (roughly 40-120 views per interaction, stable per post) so the
 * number grows with reactions, comments and shares like Facebook's.
 */
export function videoViews(
  post: Pick<PostView, "_id" | "media" | "reactions" | "commentCount" | "shareCount">,
) {
  if (!post.media.some((m) => m.kind === "video")) return null;
  const h = hash(post._id);
  const engagement = post.reactions.count + 4 * post.commentCount + 8 * post.shareCount;
  return (engagement + 1) * (40 + (h % 81)) + (h % 97);
}

/** "1.2K views", or null for posts without a video. */
export function viewsLabel(post: Parameters<typeof videoViews>[0]) {
  const n = videoViews(post);
  return n === null ? null : `${compactCount(n)} ${n === 1 ? "view" : "views"}`;
}
