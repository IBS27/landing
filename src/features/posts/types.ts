import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type { PostView, ResolvedAttachment } from "../../../convex/lib/posts";
export type { UserSummary } from "../../../convex/lib/users";

export type CommentThread = FunctionReturnType<typeof api.comments.list>[number];
export type CommentReply = CommentThread["replies"][number];
/** One comment row at any depth (top-level comment, reply, or reply to a reply). */
export type CommentView = Omit<CommentThread, "replies">;
export type PostMedia = {
  url: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  alt?: string;
  /** Videos: poster frame URL and length in seconds. */
  poster?: string;
  duration?: number;
};
