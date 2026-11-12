import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ChevronDown, MessageSquareLock, X } from "lucide-react";
import { DropdownMenu as DM } from "radix-ui";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn, compactCount, fullTimestamp, shortAge } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, PopoverPanel, Tooltip } from "@/ui/overlays";
import { Avatar, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOptimisticReaction } from "./ActionBar";
import {
  AvatarStickerOutline,
  CameraOutline,
  DislikeOutline,
  DotsIcon,
  GifOutline,
  LikeFilled,
  LikeOutline,
  SendIcon,
  SmileOutline,
  StickerOutline,
} from "./icons";
import { ReactionIcons, ReactionPicker, reactionMeta, useReactionHover } from "./reactions";
import type { CommentReply, CommentThread, CommentView } from "./types";
import { mediaSize, uploadFile } from "./util";

type Sort = "relevant" | "newest" | "all";
const SORT_LABEL: Record<Sort, string> = {
  relevant: "Most relevant",
  newest: "Newest",
  all: "All comments",
};
const SORT_SUB: Record<Sort, string> = {
  relevant: "Show friends' comments and the most engaging comments first.",
  newest: "Show all comments with the newest comments first.",
  all: "Show all comments, including potential spam.",
};

/** Comments list plus the "Write a comment…" composer (permalink layout). */
export function CommentsSection({ postId, focusKey }: { postId: Id<"posts">; focusKey?: number }) {
  return (
    <div className="pb-2">
      <CommentList postId={postId} />
      <div className="px-4 pt-1">
        <CommentComposer postId={postId} focusKey={focusKey} />
      </div>
    </div>
  );
}

/* ---------- List ---------- */

/** "Most relevant": most reactions and replies first, then oldest first. */
function byRelevance(a: CommentThread, b: CommentThread) {
  return (
    b.reactions.count + b.replies.length * 2 - (a.reactions.count + a.replies.length * 2) ||
    a.createdAt - b.createdAt
  );
}

/**
 * Under a post in Groups: the most relevant comment (plus any the viewer adds
 * here), "View more comments" when there are others, and an inline
 * "Write an answer…" composer.
 */
export function GroupCommentPreview({
  postId,
  commentCount,
  onViewMore,
}: {
  postId: Id<"posts">;
  commentCount: number;
  onViewMore: () => void;
}) {
  const viewer = useViewer();
  const [mountedAt] = useState(() => Date.now());
  const threads = useQ(api.comments.list, commentCount > 0 ? { postId } : "skip");
  const shown = useMemo(() => {
    if (!threads?.length) return [];
    const top = [...threads].sort(byRelevance)[0];
    const mine = threads.filter(
      (t) => t._id !== top._id && t.author._id === viewer._id && t.createdAt >= mountedAt,
    );
    return [top, ...mine];
  }, [threads, viewer._id, mountedAt]);
  const hidden = (threads?.length ?? commentCount) - shown.length;

  return (
    <div className="pb-2">
      {hidden > 0 && (
        <button
          type="button"
          onClick={onViewMore}
          className="mx-4 mb-1 font-semibold text-[15px] text-secondary leading-5 hover:underline"
        >
          View more comments
        </button>
      )}
      {shown.map((t) => (
        <Thread key={t._id} thread={t} postId={postId} />
      ))}
      <div className="px-3 pt-1">
        <CommentComposer postId={postId} placeholder="Write an answer…" inline />
      </div>
    </div>
  );
}

export function CommentList({ postId }: { postId: Id<"posts"> }) {
  const threads = useQ(api.comments.list, { postId });
  const [sort, setSort] = useState<Sort>("relevant");

  const sorted = useMemo(() => {
    if (!threads) return undefined;
    const t = [...threads];
    if (sort === "newest") t.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "relevant") t.sort(byRelevance);
    return t;
  }, [threads, sort]);

  if (sorted === undefined)
    return (
      <div className="space-y-3 px-4 py-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      {sorted.length > 0 && (
        <Menu modal={false}>
          <MenuTrigger asChild>
            <button
              type="button"
              className="mx-2 mt-1 flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[15px] text-secondary hover:bg-hover"
            >
              {SORT_LABEL[sort]}
              <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden>
                <path d="M2.2 4h7.6a.5.5 0 0 1 .38.82l-3.8 4.3a.5.5 0 0 1-.76 0l-3.8-4.3A.5.5 0 0 1 2.2 4Z" />
              </svg>
            </button>
          </MenuTrigger>
          <MenuContent align="start" width={320}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <MenuItem
                key={s}
                label={<span className={cn(s === sort && "text-fb")}>{SORT_LABEL[s]}</span>}
                sub={SORT_SUB[s]}
                onSelect={() => setSort(s)}
              />
            ))}
          </MenuContent>
        </Menu>
      )}
      <div className="pt-1">
        {sorted.map((t) => (
          <Thread key={t._id} thread={t} postId={postId} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Threads ----------
 * Facebook nests three levels. Measured offsets from the list's left edge:
 * comment avatar 40px at 12, reply avatar 24px at 65, reply-to-reply avatar
 * 24px at 103; text starts 14px after the avatar. "View N replies" sits at 66.
 * Only a reply with replies of its own draws a threading line: down from its
 * avatar, curving into each nested reply.
 */

type Depth = 1 | 2 | 3;
type Tag = CommentView["author"];
type ReplyTarget = { comment: CommentView; key: number };

const AVATAR_X: Record<Depth, number> = { 1: 12, 2: 65, 3: 103 };
const AVATAR_SIZE: Record<Depth, number> = { 1: 40, 2: 24, 3: 24 };
const VIEW_X = 66;
/** Line under a depth-2 avatar: 10px in, from 11px below the avatar. */
const LINE_X = AVATAR_X[2] + 10;
const LINE_TOP = 6 + AVATAR_SIZE[2] + 11;
const REPLY_PAGE = 10;

/**
 * Reveal state for one level of replies: "View N replies" shows the first
 * page, "View N more replies" the rest. Replies the viewer just added show
 * right away (with "View all N replies" for the others).
 */
function useReplyReveal<T extends { _id: Id<"comments">; author: { _id: string } }>(items: T[]) {
  const viewer = useViewer();
  const [shown, setShown] = useState(0);
  const [initial] = useState(() => new Set(items.map((i) => i._id)));
  const visible = items.filter(
    (item, i) => i < shown || (!initial.has(item._id) && item.author._id === viewer._id),
  );
  const hidden = items.length - visible.length;
  const label =
    hidden <= 0
      ? null
      : shown > 0
        ? `View ${hidden} more ${hidden === 1 ? "reply" : "replies"}`
        : visible.length > 0
          ? `View all ${items.length} replies`
          : items.length === 1
            ? "View 1 reply"
            : `View ${items.length} replies`;
  return {
    visible,
    label,
    /** Some replies already show, so the button sits in their column. */
    partial: visible.length > 0,
    open: () => setShown((n) => Math.min(items.length, n + REPLY_PAGE)),
    openAll: () => setShown(items.length),
  };
}

function ViewReplies({ label, x, onClick }: { label: string; x: number; onClick: () => void }) {
  return (
    <div style={{ paddingLeft: x }}>
      <button
        type="button"
        onClick={onClick}
        className="flex h-8 items-center gap-2 rounded-md pr-2 font-semibold text-[15px] text-secondary leading-5 hover:underline"
      >
        <ChevronDown size={16} strokeWidth={2.75} className="-ml-px" />
        {label}
      </button>
    </div>
  );
}

/** Tag a reply with the answered person, unless that's the viewer. */
function tagFor(c: CommentView, viewerId: string): Tag | null {
  return c.author._id === viewerId ? null : c.author;
}

function Thread({ thread, postId }: { thread: CommentThread; postId: Id<"posts"> }) {
  const viewer = useViewer();
  const canReply = useCanComment(postId);
  const reveal = useReplyReveal(thread.replies);
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const answer = (c: CommentView) => {
    reveal.openAll();
    setTarget((t) => ({ comment: c, key: (t?.key ?? 0) + 1 }));
  };

  return (
    <div>
      <CommentRow
        comment={thread}
        depth={1}
        onReply={canReply ? () => answer(thread) : undefined}
      />
      {reveal.visible.map((r) => (
        <ReplyBranch key={r._id} reply={r} postId={postId} />
      ))}
      {reveal.label && (
        <ViewReplies
          label={reveal.label}
          x={reveal.partial ? AVATAR_X[2] : VIEW_X}
          onClick={reveal.open}
        />
      )}
      {target && (
        <div className="pt-1 pr-4 pb-1" style={{ paddingLeft: AVATAR_X[2] }}>
          <CommentComposer
            key={target.key}
            postId={postId}
            parentId={target.comment._id}
            tag={tagFor(target.comment, viewer._id)}
            size={AVATAR_SIZE[2]}
            focusKey={target.key}
            placeholder={`Reply to ${target.comment.author.name}…`}
            onDone={() => setTarget(null)}
            onCancel={() => setTarget(null)}
          />
        </div>
      )}
    </div>
  );
}

/** A reply plus its own replies (third level), joined by the threading line. */
function ReplyBranch({ reply, postId }: { reply: CommentReply; postId: Id<"posts"> }) {
  const viewer = useViewer();
  const canReply = useCanComment(postId);
  const reveal = useReplyReveal(reply.replies);
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const answer = (c: CommentView) => {
    reveal.openAll();
    setTarget((t) => ({ comment: c, key: (t?.key ?? 0) + 1 }));
  };

  const nested: { key: string; node: ReactNode }[] = reveal.visible.map((r) => ({
    key: r._id,
    node: <CommentRow comment={r} depth={3} onReply={canReply ? () => answer(r) : undefined} />,
  }));
  if (target)
    nested.push({
      key: "composer",
      node: (
        <div className="pt-1 pr-4 pb-1" style={{ paddingLeft: AVATAR_X[3] }}>
          <CommentComposer
            key={target.key}
            postId={postId}
            parentId={target.comment._id}
            tag={tagFor(target.comment, viewer._id)}
            size={AVATAR_SIZE[3]}
            focusKey={target.key}
            placeholder={`Reply to ${target.comment.author.name}…`}
            onDone={() => setTarget(null)}
            onCancel={() => setTarget(null)}
          />
        </div>
      ),
    });
  const hasLine = nested.length > 0 || reveal.label !== null;

  return (
    <div>
      <div className="relative">
        {hasLine && (
          <span
            aria-hidden
            className="absolute bottom-0 w-0.5 bg-thread"
            style={{ left: LINE_X, top: LINE_TOP }}
          />
        )}
        <CommentRow
          comment={reply}
          depth={2}
          onReply={canReply ? () => answer(reply) : undefined}
        />
      </div>
      {nested.map((n, i) => (
        <div key={n.key} className="relative">
          {i < nested.length - 1 && (
            <span
              aria-hidden
              className="absolute top-0 bottom-0 w-0.5 bg-thread"
              style={{ left: LINE_X }}
            />
          )}
          <span
            aria-hidden
            className="absolute top-0 h-[18px] rounded-bl-[10px] border-thread border-b-2 border-l-2"
            style={{ left: LINE_X, width: AVATAR_X[3] - LINE_X }}
          />
          {n.node}
        </div>
      ))}
      {reveal.label && (
        <ViewReplies
          label={reveal.label}
          x={reveal.partial ? AVATAR_X[3] : VIEW_X}
          onClick={reveal.open}
        />
      )}
    </div>
  );
}

function CommentRow({
  comment,
  depth,
  onReply,
}: {
  comment: CommentView;
  depth: Depth;
  /** Omitted when the viewer can't comment on the post (no Reply button). */
  onReply?: () => void;
}) {
  const rx = useOptimisticReaction("comment", comment._id, comment.reactions);
  const hover = useReactionHover();
  const [downvoted, setDownvoted] = useState(false);
  const [editing, setEditing] = useState(false);
  const remove = useM(api.comments.remove);
  const meta = rx.current ? reactionMeta(rx.current) : null;
  const size = AVATAR_SIZE[depth];

  return (
    <div
      className="group/comment flex gap-[14px] pt-1 pr-4"
      style={{ paddingLeft: AVATAR_X[depth] }}
    >
      <Link
        to="/$username"
        params={{ username: comment.author.username }}
        className="relative z-[1] shrink-0 pt-0.5"
      >
        <Avatar src={comment.author.avatar} size={size} />
      </Link>
      <div className="min-w-0 flex-1">
        {editing ? (
          <EditComment comment={comment} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex items-start gap-1">
              <div className="min-w-0">
                <p className="text-[13px] leading-4">
                  <Link
                    to="/$username"
                    params={{ username: comment.author.username }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {comment.author.name}
                  </Link>
                  <span className="text-secondary"> · </span>
                  <Tooltip content={fullTimestamp(comment.createdAt)}>
                    <span className="text-[12px] text-secondary">
                      {shortAge(comment.createdAt)}
                    </span>
                  </Tooltip>
                </p>
                {(comment.text || comment.replyTo) && (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-5">
                    {comment.replyTo && (
                      <Link
                        to="/$username"
                        params={{ username: comment.replyTo.username }}
                        className="mr-1 font-semibold text-link hover:underline"
                      >
                        {comment.replyTo.name}
                      </Link>
                    )}
                    {comment.text}
                  </p>
                )}
              </div>
              {(comment.canEdit || comment.canDelete) && (
                <Menu modal={false}>
                  <MenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Edit or delete this"
                      className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-secondary opacity-0 hover:bg-hover focus:opacity-100 group-hover/comment:opacity-100 data-[state=open]:opacity-100"
                    >
                      <DotsIcon size={16} />
                    </button>
                  </MenuTrigger>
                  <MenuContent width={240} align="start">
                    {comment.canEdit && <MenuItem label="Edit" onSelect={() => setEditing(true)} />}
                    {comment.canDelete && (
                      <MenuItem
                        label="Delete"
                        onSelect={() => void remove({ commentId: comment._id })}
                      />
                    )}
                  </MenuContent>
                </Menu>
              )}
            </div>
            {comment.media && (
              <img
                src={comment.media.url}
                alt=""
                className="mt-1.5 max-h-[200px] max-w-[260px] rounded-2xl border border-divider object-cover"
              />
            )}
          </>
        )}
        <div className="mt-0.5 flex h-8 items-center gap-1">
          <div className="relative" {...hover.bind}>
            {hover.open && (
              <div className="absolute bottom-full left-0 z-20 pb-1.5">
                <ReactionPicker
                  size={32}
                  onPick={(t) => {
                    rx.pick(t);
                    hover.close();
                  }}
                />
              </div>
            )}
            <button
              type="button"
              aria-label={rx.current ? `Remove ${meta?.label}` : "Like"}
              onClick={() => {
                rx.toggle();
                hover.close();
              }}
              className="flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-icon-secondary hover:bg-hover"
              style={meta ? { color: meta.color } : undefined}
            >
              {rx.current ? (
                rx.current === "like" ? (
                  <LikeFilled size={16} />
                ) : (
                  <span className="font-semibold text-[12px]">{meta?.label}</span>
                )
              ) : (
                <LikeOutline size={16} />
              )}
            </button>
          </div>
          <button
            type="button"
            aria-label="Downvote comment"
            onClick={() => setDownvoted((d) => !d)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md hover:bg-hover",
              downvoted ? "text-fb" : "text-icon-secondary",
            )}
          >
            <DislikeOutline size={16} />
          </button>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="rounded-md px-2 py-1 font-semibold text-[12px] text-secondary hover:bg-hover"
            >
              Reply
            </button>
          )}
          {rx.count > 0 && (
            <span className="ml-1 flex items-center gap-1 text-[13px] text-secondary">
              <ReactionIcons types={rx.top.slice(0, 2)} size={16} ring={false} />
              {compactCount(rx.count)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EditComment({ comment, onDone }: { comment: CommentView; onDone: () => void }) {
  const edit = useM(api.comments.edit);
  const [text, setText] = useState(comment.text);
  return (
    <div>
      <div className="rounded-2xl bg-comment px-3 py-2">
        <AutoTextarea
          value={text}
          onChange={setText}
          autoFocus
          onSubmit={() => {
            if (!text.trim()) return;
            void edit({ commentId: comment._id, text }).then(onDone);
          }}
          onEscape={onDone}
        />
      </div>
      <p className="mt-1 px-3 text-[12px] text-secondary">
        Press Esc to{" "}
        <button type="button" onClick={onDone} className="font-semibold text-link hover:underline">
          cancel
        </button>
        .
      </p>
    </div>
  );
}

/* ---------- Composer ---------- */

const QUICK_EMOJI = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😮",
  "😢",
  "😡",
  "👍",
  "❤️",
  "🙏",
  "🎉",
  "🔥",
  "👏",
  "😅",
  "🤔",
  "😎",
];

type ComposerProps = Parameters<typeof CommentForm>[0];

/** False once we know the author limited who can comment and the viewer isn't included. */
function useCanComment(postId: Id<"posts">) {
  return !useQ(api.settings.commentRestriction, { postId });
}

/**
 * "Write a comment…", or Facebook's note in its place when the author limited
 * who can comment on their public post ("Who can comment on your public posts?").
 */
export function CommentComposer(props: ComposerProps) {
  const limitedBy = useQ(api.settings.commentRestriction, { postId: props.postId });
  if (!limitedBy) return <CommentForm {...props} />;
  return (
    <div role="note" className="flex items-center gap-2 py-2 text-[13px] text-secondary leading-4">
      <MessageSquareLock size={16} className="shrink-0 text-icon-secondary" aria-hidden />
      <span>{limitedBy} limited who can comment on this post.</span>
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  tag: initialTag = null,
  placeholder = "Write a comment…",
  size = 32,
  focusKey,
  autoFocus,
  onDone,
  onCancel,
  inline,
}: {
  postId: Id<"posts">;
  parentId?: Id<"comments">;
  /** Name the reply starts with, as a blue tag (Backspace removes it). */
  tag?: Tag | null;
  placeholder?: string;
  size?: number;
  /** One-row pill with the icons on the right until the viewer starts typing. */
  inline?: boolean;
  /** Bump to move focus into the composer (Comment button). */
  focusKey?: number;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const viewer = useViewer();
  const add = useM(api.comments.add);
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState(initialTag);
  const [tagWidth, setTagWidth] = useState(0);
  const tagRef = useRef<HTMLSpanElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the tag changes
  useLayoutEffect(() => setTagWidth(tagRef.current?.offsetWidth ?? 0), [tag]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Top-level composers can comment as a Page the viewer manages (avatar chevron).
  const [asId, setAsId] = useState<Id<"users"> | null>(null);
  const identities = useQ(api.comments.commentAs, parentId ? "skip" : {});
  const as = identities?.find((u) => u._id === asId);

  useEffect(() => {
    if (focusKey) ref.current?.focus();
  }, [focusKey]);

  const canSend = (text.trim().length > 0 || photo !== null) && !busy;
  const compact = inline && !text && !photo && !tag;
  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      let upload: { storageId: Id<"_storage">; width?: number; height?: number } | undefined;
      if (photo) {
        const storageId = (await uploadFile(await getUploadUrl({}), photo.file)) as Id<"_storage">;
        upload = { storageId, ...(await mediaSize(photo.file)) };
      }
      await add({
        postId,
        parentId,
        replyToId: parentId ? (tag?._id ?? null) : undefined,
        text,
        asPageId: as && as._id !== viewer._id ? as._id : undefined,
        photo: upload,
      });
      setText("");
      setPhoto(null);
      onDone?.();
    } catch (e) {
      setError(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : "Your comment couldn't be posted. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 py-1">
      <span className="relative shrink-0 pt-0.5">
        {identities ? (
          <CommentAsMenu
            identities={identities}
            selected={as?._id ?? viewer._id}
            onSelect={(id) => {
              setAsId(id);
              ref.current?.focus();
            }}
            size={size}
          />
        ) : (
          <Avatar src={viewer.avatar} size={size} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn("bg-comment", compact ? "flex items-center rounded-[18px]" : "rounded-2xl")}
        >
          <div className={cn("relative px-3", compact ? "min-w-0 flex-1 py-2" : "pt-2")}>
            {tag && (
              <span
                ref={tagRef}
                className="pointer-events-none absolute top-2 left-3 whitespace-nowrap rounded-[3px] bg-[#dde6fd] font-semibold text-[15px] text-link leading-5 dark:bg-[#1d3a63]"
              >
                {tag.name}
              </span>
            )}
            <AutoTextarea
              ref={ref}
              value={text}
              onChange={setText}
              indent={tag ? tagWidth + 4 : 0}
              onBackspaceAtStart={tag ? () => setTag(null) : undefined}
              placeholder={tag ? undefined : placeholder}
              autoFocus={autoFocus || !!parentId}
              onSubmit={() => void submit()}
              onEscape={onCancel}
            />
          </div>
          {photo && (
            <div className="relative mx-3 mt-2 inline-block">
              <img src={photo.preview} alt="" className="h-20 rounded-lg object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhoto(null)}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-base"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className={cn("flex items-center", compact ? "pr-2" : "px-2 pt-2.5 pb-2")}>
            <div className="flex items-center text-icon-secondary">
              <ComposerIcon label="Comment with an avatar sticker">
                <AvatarStickerOutline />
              </ComposerIcon>
              <PopoverPanel
                width={272}
                align="start"
                trigger={
                  <button
                    type="button"
                    aria-label="Insert an emoji"
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-hover"
                  >
                    <SmileOutline />
                  </button>
                }
              >
                <div className="grid grid-cols-8 gap-0.5 p-2">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setText((t) => t + e);
                        ref.current?.focus();
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-xl hover:bg-hover"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverPanel>
              <ComposerIcon
                label="Attach a photo or video"
                onClick={() => fileRef.current?.click()}
              >
                <CameraOutline />
              </ComposerIcon>
              <ComposerIcon label="Comment with a GIF">
                <GifOutline />
              </ComposerIcon>
              <ComposerIcon label="Comment with a sticker">
                <StickerOutline />
              </ComposerIcon>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto({ file: f, preview: URL.createObjectURL(f) });
                  e.target.value = "";
                }}
              />
            </div>
            {!compact && <div className="flex-1" />}
            <button
              type="button"
              hidden={compact}
              aria-label={parentId ? "Post reply" : "Post comment"}
              disabled={!canSend}
              onClick={() => void submit()}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                canSend ? "text-fb hover:bg-hover" : "cursor-not-allowed text-disabled",
              )}
            >
              {busy ? <Spinner size={16} /> : <SendIcon />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="px-3 pt-1 text-[13px] text-negative">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

type Identity = FunctionReturnType<typeof api.comments.commentAs>[number];

/**
 * The composer avatar with Facebook's small chevron badge: opens "Comment as",
 * listing the viewer's profile and the Pages they manage.
 */
function CommentAsMenu({
  identities,
  selected,
  onSelect,
  size,
}: {
  identities: Identity[];
  selected: Id<"users">;
  onSelect: (id: Id<"users">) => void;
  size: number;
}) {
  const current = identities.find((u) => u._id === selected) ?? identities[0];
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button
          type="button"
          aria-label={`Comment as ${current.name}`}
          className="relative flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-fb"
        >
          <Avatar src={current.avatar} size={size} />
          <span className="absolute right-0 bottom-0 flex h-3 w-3 items-center justify-center rounded-full bg-btn text-primary ring-[1.5px] ring-card">
            <svg viewBox="0 0 8 5" width="7" height="5" fill="none" aria-hidden>
              <path
                d="M1 1l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align="start"
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className="z-[70] w-[320px] rounded-xl bg-popover p-2 shadow-elevated outline-none"
        >
          <DM.Label className="px-2 pt-1 pb-2 font-bold text-[17px] text-primary leading-5">
            Comment as
          </DM.Label>
          <DM.RadioGroup
            value={current._id}
            onValueChange={(v) => {
              const pick = identities.find((u) => u._id === v);
              if (pick) onSelect(pick._id);
            }}
          >
            {identities.map((u) => (
              <DM.RadioItem
                key={u._id}
                value={u._id}
                className="flex h-[52px] cursor-pointer select-none items-center gap-3 rounded-lg px-2 outline-none data-[highlighted]:bg-hover"
              >
                <Avatar src={u.avatar} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[15px] text-primary leading-5">
                    {u.name}
                  </span>
                  <span className="block text-[13px] text-secondary leading-4">
                    {u.kind === "page" ? "Page" : "Your profile"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full",
                    u._id === current._id
                      ? "border-[6px] border-fb"
                      : "border-2 border-icon-secondary",
                  )}
                />
              </DM.RadioItem>
            ))}
          </DM.RadioGroup>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function ComposerIcon({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-hover"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Auto-growing textarea: Enter submits, Shift+Enter adds a line, Esc cancels. */
function AutoTextarea({
  value,
  onChange,
  onSubmit,
  onEscape,
  onBackspaceAtStart,
  indent = 0,
  placeholder,
  autoFocus,
  ref,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onEscape?: () => void;
  /** Backspace with the caret at the very start (removes a reply tag). */
  onBackspaceAtStart?: () => void;
  /** First-line indent in px, leaving room for a tag drawn before the text. */
  indent?: number;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize whenever the text changes
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={1}
      value={value}
      // biome-ignore lint/a11y/noAutofocus: Facebook focuses the comment box when it opens
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSubmit();
        } else if (
          e.key === "Backspace" &&
          onBackspaceAtStart &&
          e.currentTarget.selectionStart === 0 &&
          e.currentTarget.selectionEnd === 0
        ) {
          e.preventDefault();
          onBackspaceAtStart();
        } else if (e.key === "Escape" && onEscape) {
          e.stopPropagation();
          onEscape();
        }
      }}
      style={indent ? { textIndent: indent } : undefined}
      className="block w-full resize-none bg-transparent text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder"
    />
  );
}
