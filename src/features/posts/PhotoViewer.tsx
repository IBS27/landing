import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useEffect, useState } from "react";
import { FacebookLogo } from "@/icons";
import { ActionBar } from "./ActionBar";
import { CommentComposer, CommentList } from "./CommentsSection";
import { PostContent, PostHeader } from "./PostCard";
import type { PostView } from "./types";

/**
 * Facebook's photo "theater": black stage with arrows on the left, the post
 * and its comments in a 360px side panel on the right.
 */
export function PhotoViewer({
  post,
  index: initial,
  onClose,
}: {
  post: PostView;
  index: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initial);
  const [focusKey, setFocusKey] = useState(0);
  const n = post.media.length;
  const item = post.media[index];
  const go = (d: number) => setIndex((i) => (i + d + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "TEXTAREA" || t?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + n) % n);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[70] flex bg-black outline-none"
        >
          <D.Title className="sr-only">{`Photo from ${post.author.name}'s post`}</D.Title>
          <div className="group relative flex min-w-0 flex-1 items-center justify-center">
            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
              <D.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-white/20"
                >
                  <X size={24} />
                </button>
              </D.Close>
              <FacebookLogo size={40} />
            </div>
            {item?.kind === "video" ? (
              // biome-ignore lint/a11y/useMediaCaption: user videos have no caption track
              <video src={item.url} controls autoPlay className="max-h-full max-w-full" />
            ) : (
              <img
                src={item?.url}
                alt={item?.alt ?? ""}
                className="max-h-full max-w-full select-none object-contain"
              />
            )}
            {n > 1 && (
              <>
                <StageArrow side="left" onClick={() => go(-1)} />
                <StageArrow side="right" onClick={() => go(1)} />
              </>
            )}
          </div>
          <aside className="flex w-[360px] shrink-0 flex-col bg-card text-primary">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PostHeader post={post} />
              <PostContent
                post={{ ...post, background: null, media: [], attachments: [], shared: null }}
                expanded
                smallText
              />
              <div className="border-divider border-y">
                <ActionBar post={post} onComment={() => setFocusKey((k) => k + 1)} />
              </div>
              <CommentList postId={post._id} />
            </div>
            <div className="border-divider border-t px-3 pt-2 pb-3">
              <CommentComposer postId={post._id} focusKey={focusKey} />
            </div>
          </aside>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function StageArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      onClick={onClick}
      className={`absolute top-1/2 ${side === "left" ? "left-4" : "right-4"} flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25`}
    >
      <Icon size={32} />
    </button>
  );
}
