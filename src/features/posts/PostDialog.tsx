import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { FacebookLogo } from "@/icons";
import { ModalScrim } from "@/ui/overlays";
import { IconButton } from "@/ui/primitives";
import { ActionBar } from "./ActionBar";
import { CommentComposer, CommentList } from "./CommentsSection";
import { PostContent, PostHeader } from "./PostCard";
import { ScrollArea } from "./ScrollArea";
import type { PostView } from "./types";

const VEIL = "bg-[rgba(244,244,244,0.8)] dark:bg-[rgba(11,11,11,0.8)]";

/**
 * Facebook's post dialog: "<First>'s Post", the full post, every comment with
 * threaded replies, and a sticky "Write a comment…" composer. Updates live.
 *
 * While it is open the page sits under a light veil, the header's left side
 * becomes a close X plus the logo, and the header's right icons stay bright.
 */
export function PostDialog({ post, onClose }: { post: PostView; onClose: () => void }) {
  const [focusKey, setFocusKey] = useState(1);
  const title = `${post.author.kind === "page" ? post.author.name : post.author.firstName}'s Post`;
  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <ModalScrim />
        {/* Covers the whole search pill too: the wide (280px) pill runs past the
            320px cluster to x=344, so a 320px cover left its tail peeking out. */}
        <div className="pointer-events-auto fixed top-0 left-0 z-[61] flex h-14 w-[344px] items-center gap-2 bg-nav pl-4">
          <span aria-hidden className={`absolute inset-0 ${VEIL}`} />
          <D.Close asChild>
            <IconButton label="Close" size={40}>
              <X size={24} strokeWidth={2} className="text-primary" />
            </IconButton>
          </D.Close>
          <Link to="/" aria-label="Facebook" className="relative shrink-0" onClick={onClose}>
            <FacebookLogo size={40} />
          </Link>
        </div>
        <D.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[61] flex h-[calc(100vh-64px)] max-h-[836px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-card shadow-elevated outline-none"
          style={{ width: "min(700px, calc(100vw - 32px))" }}
        >
          <div className="relative flex h-[60px] shrink-0 items-center justify-center border-divider border-b px-16">
            <D.Title className="truncate font-bold text-[20px] text-primary leading-6">
              {title}
            </D.Title>
            <D.Close asChild>
              <IconButton label="Close" className="absolute! right-4">
                <X size={20} strokeWidth={2.4} className="text-secondary" />
              </IconButton>
            </D.Close>
          </div>
          <ScrollArea>
            <PostHeader post={post} />
            <PostContent post={post} expanded />
            <ActionBar post={post} onComment={() => setFocusKey((k) => k + 1)} />
            <CommentList postId={post._id} />
            <div className="h-2" />
          </ScrollArea>
          <div className="border-divider border-t px-4 pt-2 pb-[13px]">
            <CommentComposer postId={post._id} focusKey={focusKey} autoFocus />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
