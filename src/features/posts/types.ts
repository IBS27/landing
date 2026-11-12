import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type { PostView, ResolvedAttachment } from "../../../convex/lib/posts";
export type { UserSummary } from "../../../convex/lib/users";

export type CommentThread = FunctionReturnType<typeof api.comments.list>[number];
export type CommentView = Omit<CommentThread, "replies">;
export type PostMedia = {
  url: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  alt?: string;
};
