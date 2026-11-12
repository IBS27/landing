import type { PostView } from "@/features/posts";
import type { GroupView } from "./context";

/**
 * Inside a group, Facebook shows posts with the author header only (no group
 * chip). The audience glyph is the group's: a globe for public groups and the
 * members glyph for private ones.
 */
export function inGroup(post: PostView, group: Pick<GroupView, "privacy">): PostView {
  return { ...post, group: null, privacy: group.privacy === "public" ? "public" : "friends" };
}
