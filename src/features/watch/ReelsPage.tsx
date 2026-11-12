import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  CircleUser,
  Clapperboard,
  Link2,
  MoreHorizontal,
  Music2,
  Play,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import {
  PostDialog,
  type PostView,
  ReactionIcon,
  ReactionPicker,
  ShareDialog,
} from "@/features/posts";
import { useOptimisticReaction } from "@/features/posts/ActionBar";
import {
  CommentOutline,
  GlobeIcon,
  LikeFilled,
  LikeOutline,
  ShareOutline,
} from "@/features/posts/icons";
import { reactionMeta, useReactionHover } from "@/features/posts/reactions";
import { cn, compactCount } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

type Feed = "foryou" | "following" | "profile";
const REEL_SECONDS = 15;

/**
 * Facebook Reels viewer. Always dark (even in light mode). `/reel` shows the
 * For you / Following / Profile rail; `/reel/<id>` is the direct-link viewer
 * with a close button.
 */
export function ReelsPage({ startId }: { startId?: string }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const direct = startId !== undefined;
  const [feed, setFeed] = useState<Feed>("foryou");
  // The list is fixed to the reel the viewer arrived on; the URL then follows scrolling.
  const [initialId] = useState(startId);
  const all = useQ(api.media.reels, { startId: initialId });
  const reels = useMemo(() => {
    if (!all) return undefined;
    if (feed === "following")
      return all.filter((p) => p.viewerFollowsAuthor && p.author._id !== viewer._id);
    if (feed === "profile") return all.filter((p) => p.author._id === viewer._id);
    return all;
  }, [all, feed, viewer._id]);

  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = reels?.length ?? 0;

  const go = useCallback(
    (i: number) => {
      const el = scroller.current;
      if (!el || i < 0 || i >= count) return;
      el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
    },
    [count],
  );

  // Track the snapped reel.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Reset to the top when switching feeds.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on feed change only
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setIndex(0);
  }, [feed]);

  // Keep the direct-link URL on the current reel.
  const currentId = reels?.[index]?._id;
  useEffect(() => {
    if (direct && currentId && currentId !== startId)
      void navigate({ to: "/reel/$reelId", params: { reelId: currentId }, replace: true });
  }, [direct, currentId, startId, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest("input,textarea,[contenteditable=true],[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(index + 1);
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <div className="dark fixed inset-x-0 top-14 bottom-0 bg-black text-[#e2e5e9]">
      {direct ? (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            type="button"
            aria-label="Close viewer and return to feed"
            onClick={() =>
              window.history.length > 1 ? window.history.back() : void navigate({ to: "/" })
            }
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e2e5e9] text-[#080809] hover:brightness-95"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          <Link to="/reel" className="font-bold text-[24px] text-white leading-7">
            Reels
          </Link>
        </div>
      ) : (
        <nav
          aria-label="Reels"
          className="absolute top-0 bottom-0 left-0 z-20 hidden w-[220px] px-2 pt-3 min-[1000px]:block"
        >
          <h1 className="px-2 pb-2 font-bold text-[24px] text-[#e2e5e9] leading-7">Reels</h1>
          {(
            [
              ["foryou", "For you", Star],
              ["following", "Following", Clapperboard],
              ["profile", "Profile", CircleUser],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFeed(key)}
              aria-current={feed === key ? "page" : undefined}
              className={cn(
                "mb-1 flex h-11 w-[204px] items-center gap-3 rounded-lg px-3 font-medium text-[17px]",
                feed === key ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
              )}
            >
              <Icon size={20} fill={feed === key && key === "foryou" ? "currentColor" : "none"} />
              {label}
            </button>
          ))}
        </nav>
      )}

      <div
        ref={scroller}
        className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none]"
      >
        {reels === undefined ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={40} className="text-white/60" />
          </div>
        ) : reels.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Clapperboard size={56} strokeWidth={1.4} className="text-white/60" />
            <p className="font-bold text-[20px] text-white">
              {feed === "profile" ? "You haven't shared any reels yet" : "No reels to show"}
            </p>
            <p className="max-w-sm text-[15px] text-white/70">
              {feed === "profile"
                ? "Reels you create will appear here."
                : "Follow people and Pages to see their reels here."}
            </p>
          </div>
        ) : (
          reels.map((p, i) => (
            <ReelSlide key={p._id} post={p} active={i === index} offset={!direct} />
          ))
        )}
      </div>

      {count > 0 && (
        <div className="absolute top-1/2 right-3 z-20 flex -translate-y-1/2 flex-col gap-4">
          <NavArrow label="Previous Card" disabled={index === 0} onClick={() => go(index - 1)}>
            <ChevronUp size={28} />
          </NavArrow>
          <NavArrow label="Next Card" disabled={index >= count - 1} onClick={() => go(index + 1)}>
            <ChevronDown size={28} />
          </NavArrow>
        </div>
      )}
    </div>
  );
}

function NavArrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function ReelSlide({ post, active, offset }: { post: PostView; active: boolean; offset: boolean }) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const following = useQ(api.pages.followingIds, {});
  const toggleFollow = useM(api.pages.toggleFollow);
  const viewer = useViewer();
  const media = post.media[0];
  const followsAuthor =
    post.author._id === viewer._id ||
    post.viewerFollowsAuthor ||
    (following?.includes(post.author._id) ?? false);

  // Restart playback whenever the slide comes back into view.
  useEffect(() => {
    if (active) setPaused(false);
  }, [active]);

  const playing = active && !paused;
  const caption = post.text ?? "";
  const longCaption = caption.length > 80 || caption.includes("\n");

  return (
    <section
      className={cn(
        "flex h-full snap-start snap-always items-start justify-center pt-4",
        offset && "min-[1000px]:pl-[136px]",
      )}
      aria-label={`Reel by ${post.author.name}`}
      data-reel-id={post._id}
    >
      <div className="flex items-end gap-[11px]">
        <div className="relative aspect-[9/16] h-[calc(100vh-88px)] overflow-hidden rounded-lg bg-[#18191a]">
          {media?.kind === "video" ? (
            <video
              src={media.url}
              muted={muted}
              loop
              autoPlay={active}
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={media?.url}
              alt={media?.alt ?? ""}
              className={cn(
                "h-full w-full object-cover transition-transform ease-linear",
                playing ? "scale-110 duration-[15000ms]" : "scale-100 duration-500",
              )}
            />
          )}
          <button
            type="button"
            aria-label={paused ? "Play" : "Pause"}
            onClick={() => setPaused((p) => !p)}
            className="absolute inset-0"
          >
            {paused && (
              <span className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white">
                <Play size={32} fill="currentColor" strokeWidth={0} className="ml-1" />
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((m) => !m)}
            className="absolute top-2 left-2 flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(51,51,52,0.67)] text-white hover:bg-[rgba(70,70,72,0.8)]"
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[244px] bg-[linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0.1)_12.5%,rgba(0,0,0,0.4))]" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-6 text-white">
            <div className="flex items-center gap-2">
              <Link
                to="/$username"
                params={{ username: post.author.username }}
                className="shrink-0"
              >
                <Avatar src={post.author.avatar} size={40} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[15px] leading-5">
                  <Link
                    to="/$username"
                    params={{ username: post.author.username }}
                    className="truncate font-semibold hover:underline"
                  >
                    {post.author.name}
                  </Link>
                  <GlobeIcon size={12} aria-label="Shared with Public" />
                  {!followsAuthor && (
                    <>
                      <span className="text-[#e2e5e9]">·</span>
                      <button
                        type="button"
                        onClick={() => void toggleFollow({ pageId: post.author._id })}
                        className="font-semibold hover:underline"
                      >
                        Follow
                      </button>
                    </>
                  )}
                </div>
                <p className="flex items-center gap-1 truncate font-semibold text-[13px] text-white/80 leading-4">
                  <Music2 size={12} /> {post.author.name} · Original audio
                </p>
              </div>
            </div>
            {caption && (
              <p
                className={cn(
                  "mt-3 whitespace-pre-wrap break-words text-[15px] leading-5",
                  !expanded && "line-clamp-2",
                )}
              >
                {caption}
              </p>
            )}
            {caption && longCaption && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="font-semibold text-[15px] hover:underline"
              >
                {expanded ? "See less" : "… See more"}
              </button>
            )}
          </div>
          <div className="absolute inset-x-2 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/30">
            {active && (
              <div
                key={post._id}
                className="h-full origin-left rounded-full bg-white"
                style={{
                  animation: `reel-progress ${REEL_SECONDS}s linear infinite`,
                  animationPlayState: playing ? "running" : "paused",
                }}
              />
            )}
          </div>
        </div>

        <ReelActions post={post} onComment={() => setCommentsOpen(true)} />
      </div>
      {commentsOpen && <PostDialog post={post} onClose={() => setCommentsOpen(false)} />}
      <style>{"@keyframes reel-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>
    </section>
  );
}

function ReelActions({ post, onComment }: { post: PostView; onComment: () => void }) {
  const rx = useOptimisticReaction("post", post._id, post.reactions);
  const hover = useReactionHover();
  const [shareOpen, setShareOpen] = useState(false);
  const toggleSave = useM(api.saved.toggle);
  const [copied, setCopied] = useState(false);
  const meta = rx.current ? reactionMeta(rx.current) : null;

  return (
    <div className="flex w-12 flex-col items-center gap-3 pb-1">
      <div className="relative" {...hover.bind}>
        {hover.open && (
          <div className="absolute right-full bottom-0 z-30 pr-2">
            <ReactionPicker
              onPick={(t) => {
                rx.pick(t);
                hover.close();
              }}
            />
          </div>
        )}
        <ActionButton
          label={rx.current ? `Remove ${meta?.label}` : "Like"}
          count={rx.count}
          onClick={() => {
            rx.toggle();
            hover.close();
          }}
          style={meta ? { color: meta.color } : undefined}
        >
          {rx.current && rx.current !== "like" ? (
            <ReactionIcon type={rx.current} size={24} />
          ) : rx.current === "like" ? (
            <LikeFilled size={24} />
          ) : (
            <LikeOutline size={24} />
          )}
        </ActionButton>
      </div>
      <ActionButton label="Comment" count={post.commentCount} onClick={onComment}>
        <CommentOutline size={24} />
      </ActionButton>
      <ActionButton label="Share" count={post.shareCount} onClick={() => setShareOpen(true)}>
        <ShareOutline size={24} />
      </ActionButton>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            className="flex h-12 w-12 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <MoreHorizontal size={24} />
          </button>
        </MenuTrigger>
        <MenuContent width={260} align="end">
          <MenuItem
            label={post.viewerSaved ? "Unsave reel" : "Save reel"}
            sub={post.viewerSaved ? undefined : "Add this to your saved items."}
            onSelect={() => void toggleSave({ kind: "post", refId: post._id })}
          />
          <MenuItem
            icon={<Link2 size={20} />}
            label={copied ? "Link copied" : "Copy link"}
            onSelect={() => {
              void navigator.clipboard
                ?.writeText(`${window.location.origin}/reel/${post._id}`)
                .then(() => setCopied(true));
            }}
          />
        </MenuContent>
      </Menu>
      {shareOpen && <ShareDialog post={post} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function ActionButton({
  label,
  count,
  onClick,
  children,
  style,
}: {
  label: string;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex w-12 flex-col items-center gap-1 text-white"
      style={style}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full group-hover:bg-white/10">
        {children}
      </span>
      <span className="font-semibold text-[13px] text-white leading-4">
        {count > 0 ? compactCount(count) : " "}
      </span>
    </button>
  );
}
