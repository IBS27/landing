import { useEffect, useState } from "react";
import { useM } from "@/app/viewer";
import { cn, compactCount, plural } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import { CommentOutline, LikeFilled, LikeOutline, ShareOutline } from "./icons";
import { ReactionsDialog } from "./ReactionsDialog";
import {
  ReactionIcon,
  ReactionIcons,
  ReactionPicker,
  type ReactionType,
  reactionMeta,
  useReactionHover,
} from "./reactions";
import { ShareDialog } from "./ShareDialog";
import type { PostView } from "./types";

/**
 * Optimistic reaction state: shows the viewer's pick immediately and falls
 * back to the server value once it changes.
 */
export function useOptimisticReaction(
  targetType: "post" | "comment",
  targetId: string,
  server: { count: number; viewerReaction: ReactionType | null; top: ReactionType[] },
) {
  const react = useM(api.reactions.react);
  const [pending, setPending] = useState<{ value: ReactionType | null } | null>(null);
  // Drop the optimistic value as soon as the server catches up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the server snapshot changes
  useEffect(() => setPending(null), [server.viewerReaction, server.count]);

  const current = pending ? pending.value : server.viewerReaction;
  let count = server.count;
  if (pending) {
    if (server.viewerReaction && !pending.value) count -= 1;
    if (!server.viewerReaction && pending.value) count += 1;
  }
  let top = server.top;
  if (current && !top.includes(current)) top = [current, ...top].slice(0, 3);
  if (!current && server.viewerReaction && server.count === 1) top = [];

  const set = (type: ReactionType | null) => {
    setPending({ value: type });
    react({ targetType, targetId, type }).catch(() => setPending(null));
  };
  return {
    current,
    count,
    top,
    /** Like button click: toggles Like, or clears any other reaction. */
    toggle: () => set(current ? null : "like"),
    pick: (t: ReactionType) => set(current === t ? null : t),
  };
}

/** "You and 23 others" / "Maya Chen and 4 others" / "Maya Chen". */
export function reactionSummaryText(
  count: number,
  viewerReacted: boolean,
  sampleName: string | null,
) {
  if (count === 0) return "";
  if (viewerReacted)
    return count === 1
      ? "You"
      : `You and ${compactCount(count - 1)} ${count - 1 === 1 ? "other" : "others"}`;
  if (sampleName)
    return count === 1
      ? sampleName
      : `${sampleName} and ${compactCount(count - 1)} ${count - 1 === 1 ? "other" : "others"}`;
  return compactCount(count);
}

/**
 * Facebook's post action bar. `compact` (the 2026 feed style): Like / Comment
 * / Share with inline counts on the left, the stacked reaction icons on the
 * right. `labelled` (photo theater): a stats row (reactions + "You and 6
 * others" left, "2 comments · 1 share" right) above three equal labelled
 * Like / Comment / Share buttons between divider lines.
 */
export function ActionBar({
  post,
  onComment,
  className,
  trailing,
  variant = "compact",
}: {
  post: PostView;
  onComment: () => void;
  className?: string;
  /** Extra stats on the right, before the reaction icons (video view count). */
  trailing?: React.ReactNode;
  variant?: "compact" | "labelled";
}) {
  const rx = useOptimisticReaction("post", post._id, post.reactions);
  const hover = useReactionHover();
  const [whoOpen, setWhoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const meta = rx.current ? reactionMeta(rx.current) : null;
  const name = post.author.name;
  // Settings → Reaction preferences can hide the numbers (the reactions still show).
  const hideCount = post.reactions.countHidden;
  const summary = hideCount
    ? "See who reacted to this"
    : reactionSummaryText(rx.count, !!rx.current, post.reactions.sampleName);
  const labelled = variant === "labelled";

  const likeIcon =
    rx.current && rx.current !== "like" ? (
      <ReactionIcon type={rx.current} size={labelled ? 18 : 20} />
    ) : rx.current === "like" ? (
      <LikeFilled />
    ) : (
      <LikeOutline />
    );
  const like = (
    <div className={cn("relative flex items-center", labelled && "flex-1")} {...hover.bind}>
      {hover.open && (
        <div className="absolute bottom-full left-0 z-20 pb-2">
          <ReactionPicker
            onPick={(t) => {
              rx.pick(t);
              hover.close();
            }}
          />
        </div>
      )}
      <BarButton
        labelled={labelled}
        label={
          rx.current
            ? `Remove ${meta?.label}`
            : `React with Like to ${name}'s post${rx.count && !hideCount ? `, ${plural(rx.count, "reaction")}` : ""}`
        }
        onClick={() => {
          rx.toggle();
          hover.close();
        }}
        style={meta ? { color: meta.color } : undefined}
      >
        {likeIcon}
        {labelled ? (
          <Label>{meta?.label ?? "Like"}</Label>
        ) : (
          rx.count > 0 && !hideCount && <Count>{compactCount(rx.count)}</Count>
        )}
      </BarButton>
    </div>
  );
  const commentLabel = `Comment on ${name}'s post${post.commentCount ? `, ${plural(post.commentCount, "comment")}` : ""}`;
  const shareLabel = `Share ${name}'s post${post.shareCount ? `, ${plural(post.shareCount, "share")}` : ""}`;
  const dialogs = (
    <>
      {whoOpen && (
        <ReactionsDialog targetType="post" targetId={post._id} onClose={() => setWhoOpen(false)} />
      )}
      {shareOpen && <ShareDialog post={post} onClose={() => setShareOpen(false)} />}
    </>
  );

  if (labelled) {
    const hasStats = rx.count > 0 || post.commentCount > 0 || post.shareCount > 0 || !!trailing;
    return (
      <div className={className}>
        {hasStats && (
          <div className="flex items-center gap-2 py-2.5 text-[15px] text-secondary leading-5">
            {rx.count > 0 && (
              <button
                type="button"
                aria-label="See who reacted to this"
                onClick={() => setWhoOpen(true)}
                className="flex min-w-0 items-center gap-1.5 hover:underline"
              >
                <ReactionIcons types={rx.top} />
                {!hideCount && <span className="truncate">{summary}</span>}
              </button>
            )}
            <div className="flex-1" />
            {post.commentCount > 0 && (
              <button type="button" onClick={onComment} className="shrink-0 hover:underline">
                {plural(post.commentCount, "comment")}
              </button>
            )}
            {post.shareCount > 0 && (
              <span className="shrink-0">{plural(post.shareCount, "share")}</span>
            )}
            {trailing}
          </div>
        )}
        <div className="flex gap-1 border-divider border-y py-1">
          {like}
          <BarButton labelled label={commentLabel} onClick={onComment}>
            <CommentOutline />
            <Label>Comment</Label>
          </BarButton>
          <BarButton labelled label={shareLabel} onClick={() => setShareOpen(true)}>
            <ShareOutline />
            <Label>Share</Label>
          </BarButton>
        </div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className={cn("flex h-11 items-center px-1", className)}>
      {like}
      <BarButton label={commentLabel} onClick={onComment}>
        <CommentOutline />
        {post.commentCount > 0 && <Count>{compactCount(post.commentCount)}</Count>}
      </BarButton>
      <BarButton label={shareLabel} onClick={() => setShareOpen(true)}>
        <ShareOutline />
        {post.shareCount > 0 && <Count>{compactCount(post.shareCount)}</Count>}
      </BarButton>

      <div className="flex-1" />
      {trailing}
      {rx.count > 0 && (
        <Tooltip content={summary} side="top">
          <button
            type="button"
            aria-label="See who reacted to this"
            onClick={() => setWhoOpen(true)}
            className="mr-1.5 flex h-8 items-center rounded-md px-1"
          >
            <ReactionIcons types={rx.top} />
          </button>
        </Tooltip>
      )}
      {dialogs}
    </div>
  );
}

function BarButton({
  label,
  onClick,
  children,
  style,
  labelled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Full-width labelled button (theater): equal thirds, icon + label. */
  labelled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md text-icon-secondary transition-colors hover:bg-hover active:bg-pressed",
        labelled ? "h-9 flex-1 justify-center px-2" : "h-8 px-3",
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[13px] leading-4">{children}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[15px] leading-5">{children}</span>;
}
