import { useState } from "react";
import { Modal } from "@/ui/overlays";
import { ActionBar } from "./ActionBar";
import { CommentComposer, CommentList } from "./CommentsSection";
import { PostContent, PostHeader } from "./PostCard";
import type { PostView } from "./types";

/**
 * Facebook's post dialog: "<First>'s Post", the full post, every comment with
 * threaded replies, and a sticky "Write a comment…" composer. Updates live.
 */
export function PostDialog({ post, onClose }: { post: PostView; onClose: () => void }) {
  const [focusKey, setFocusKey] = useState(1);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${post.author.kind === "page" ? post.author.name : post.author.firstName}'s Post`}
      width={700}
      className="h-[calc(100vh-64px)] max-h-[836px] rounded-xl"
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PostHeader post={post} />
        <PostContent post={post} expanded />
        <ActionBar post={post} onComment={() => setFocusKey((k) => k + 1)} />
        <CommentList postId={post._id} />
        <div className="h-2" />
      </div>
      <div className="border-divider border-t px-4 pt-2 pb-3">
        <CommentComposer postId={post._id} focusKey={focusKey} autoFocus />
      </div>
    </Modal>
  );
}
