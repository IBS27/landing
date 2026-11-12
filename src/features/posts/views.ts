import { compactCount } from "@/lib/format";
import type { PostView } from "./types";

/** "1.2K views", or null for posts without a video (or one nobody has watched yet). */
export function viewsLabel(post: Pick<PostView, "viewCount">) {
  const n = post.viewCount;
  return !n ? null : `${compactCount(n)} ${n === 1 ? "view" : "views"}`;
}
