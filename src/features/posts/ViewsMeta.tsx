import type { PostView } from "./types";
import { viewsLabel } from "./views";

/** "· 1.2K views" after a video post's time and audience, like Facebook's Video surfaces. */
export function ViewsMeta({ post }: { post: PostView }) {
  const views = viewsLabel(post);
  if (!views) return null;
  return (
    // One unit, so a narrow header (the theater panel) wraps "· 1.2K views" whole.
    <span className="inline-flex gap-1">
      <span aria-hidden>·</span>
      <span>{views}</span>
    </span>
  );
}
