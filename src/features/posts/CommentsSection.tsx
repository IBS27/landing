import { Link } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import type { CommentThread, CommentView } from "./types";
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

export function CommentList({ postId }: { postId: Id<"posts"> }) {
  const threads = useQ(api.comments.list, { postId });
  const [sort, setSort] = useState<Sort>("relevant");

  const sorted = useMemo(() => {
    if (!threads) return undefined;
    const t = [...threads];
    if (sort === "newest") t.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "relevant")
      t.sort(
        (a, b) =>
          b.reactions.count + b.replies.length * 2 - (a.reactions.count + a.replies.length * 2) ||
          a.createdAt - b.createdAt,
      );
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

const SPINE = "absolute left-[31px] w-0.5 bg-thread";
const ELBOW =
  "absolute left-[31px] top-0 h-[14px] w-[33px] rounded-bl-[10px] border-thread border-b-2 border-l-2";

function Thread({ thread, postId }: { thread: CommentThread; postId: Id<"posts"> }) {
  const [expanded, setExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentView | null>(null);
  const [replyKey, setReplyKey] = useState(0);
  const replies = thread.replies;
  const viewer = useViewer();
  // Reveal the thread when the viewer adds a reply.
  const lastReplyAuthor = replies[replies.length - 1]?.author._id;
  const prevCount = useRef(replies.length);
  useEffect(() => {
    if (replies.length > prevCount.current && lastReplyAuthor === viewer._id) setExpanded(true);
    prevCount.current = replies.length;
  }, [replies.length, lastReplyAuthor, viewer._id]);

  const startReply = (c: CommentView) => {
    setExpanded(true);
    setReplyingTo(c);
    setReplyKey((k) => k + 1);
  };

  const children: ReactNode[] = [];
  if (replies.length > 0 && !expanded)
    children.push(
      <button
        key="view"
        type="button"
        onClick={() => setExpanded(true)}
        className="flex h-8 items-center gap-2 rounded-md pr-2 font-semibold text-[13px] text-secondary hover:underline"
      >
        <ChevronDown size={16} strokeWidth={2.5} />
        View {replies.length === 1 ? "1 reply" : `all ${replies.length} replies`}
      </button>,
    );
  if (expanded)
    for (const r of replies)
      children.push(<CommentRow key={r._id} comment={r} small onReply={() => startReply(r)} />);
  if (replyingTo)
    children.push(
      <div key="composer" className="pt-1 pb-1">
        <CommentComposer
          postId={postId}
          parentId={replyingTo._id}
          size={24}
          focusKey={replyKey}
          placeholder={`Reply to ${replyingTo.author.name}…`}
          onDone={() => setReplyingTo(null)}
          onCancel={() => setReplyingTo(null)}
        />
      </div>,
    );

  const threaded = expanded && children.length > 0;
  return (
    <div className="relative">
      {threaded && <span className={cn(SPINE, "top-[48px] bottom-0")} />}
      <CommentRow comment={thread} onReply={() => startReply(thread)} />
      {children.map((child, i) => (
        <div key={i} className={cn("relative pl-[65px]", !threaded && "pl-[52px]")}>
          {threaded && (
            <>
              {i < children.length - 1 && <span className={cn(SPINE, "top-0 bottom-0")} />}
              <span className={ELBOW} />
            </>
          )}
          {child}
        </div>
      ))}
    </div>
  );
}

function CommentRow({
  comment,
  small,
  onReply,
}: {
  comment: CommentView;
  small?: boolean;
  onReply: () => void;
}) {
  const rx = useOptimisticReaction("comment", comment._id, comment.reactions);
  const hover = useReactionHover();
  const [downvoted, setDownvoted] = useState(false);
  const [editing, setEditing] = useState(false);
  const remove = useM(api.comments.remove);
  const meta = rx.current ? reactionMeta(rx.current) : null;
  const size = small ? 24 : 40;

  return (
    <div className={cn("group/comment flex gap-2 pt-1", small ? "pr-4" : "pr-4 pl-3")}>
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
          <button
            type="button"
            onClick={onReply}
            className="rounded-md px-2 py-1 font-semibold text-[12px] text-secondary hover:bg-hover"
          >
            Reply
          </button>
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

export function CommentComposer({
  postId,
  parentId,
  placeholder = "Write a comment…",
  size = 32,
  focusKey,
  autoFocus,
  onDone,
  onCancel,
}: {
  postId: Id<"posts">;
  parentId?: Id<"comments">;
  placeholder?: string;
  size?: number;
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
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusKey) ref.current?.focus();
  }, [focusKey]);

  const canSend = (text.trim().length > 0 || photo !== null) && !busy;
  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      let upload: { storageId: Id<"_storage">; width?: number; height?: number } | undefined;
      if (photo) {
        const storageId = (await uploadFile(await getUploadUrl({}), photo.file)) as Id<"_storage">;
        upload = { storageId, ...(await mediaSize(photo.file)) };
      }
      await add({ postId, parentId, text, photo: upload });
      setText("");
      setPhoto(null);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 py-1">
      <span className="relative shrink-0 pt-0.5">
        <Avatar src={viewer.avatar} size={size} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-comment">
          <div className="px-3 pt-2">
            <AutoTextarea
              ref={ref}
              value={text}
              onChange={setText}
              placeholder={placeholder}
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
          <div className="flex items-center px-2 pt-1 pb-1.5">
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
            <div className="flex-1" />
            <button
              type="button"
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
      </div>
    </div>
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
  placeholder,
  autoFocus,
  ref,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onEscape?: () => void;
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
        } else if (e.key === "Escape" && onEscape) {
          e.stopPropagation();
          onEscape();
        }
      }}
      className="block w-full resize-none bg-transparent text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder"
    />
  );
}
