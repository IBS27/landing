import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  CircleUser,
  Clapperboard,
  Link2,
  MoreHorizontal,
  Music2,
  Star,
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
import {
  PlayGlyph,
  safePlay,
  setSoundOn,
  useSoundOn,
  VolumeGlyph,
} from "@/features/posts/VideoPlayer";
import { cn, compactCount } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CreateReelDialog } from "./CreateReel";

type Feed = "foryou" | "following" | "profile";

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
  const [creating, setCreating] = useState(false);
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
        <div className="absolute top-0 left-3 z-20 flex items-center gap-2">
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
            {feed === "profile" && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-3 h-9 rounded-md bg-[#0866ff] px-4 font-semibold text-[15px] text-white hover:brightness-110"
              >
                Create reel
              </button>
            )}
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
            <ChevronUp size={24} strokeWidth={2.75} />
          </NavArrow>
          <NavArrow label="Next Card" disabled={index >= count - 1} onClick={() => go(index + 1)}>
            <ChevronDown size={24} strokeWidth={2.75} />
          </NavArrow>
        </div>
      )}
      <CreateReelDialog open={creating} onClose={() => setCreating(false)} />
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
      className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#a8abaf] bg-[#1c1c1d] text-[#e2e5e9] transition-colors hover:bg-[#2a2a2b] disabled:cursor-not-allowed disabled:border-[#4b4c4f] disabled:text-[#65686c] disabled:hover:bg-[#1c1c1d]"
    >
      {children}
    </button>
  );
}

type Reel = PostView & { viewerFollowsAuthor: boolean };

function ReelSlide({ post, active, offset }: { post: Reel; active: boolean; offset: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const sound = useSoundOn();
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const media = post.media[0];
  /** Bumped on each tap that resumes playback: a play glyph flashes and fades. */
  const [resumed, setResumed] = useState(0);
  const togglePause = () => {
    if (paused) setResumed((n) => n + 1);
    setPaused(!paused);
  };

  // Restart from the top whenever the slide comes back into view.
  useEffect(() => {
    if (active) {
      setPaused(false);
      if (ref.current) ref.current.currentTime = 0;
    }
  }, [active]);

  // The element follows the slide: plays while active and not paused by the viewer.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && !paused) safePlay(el);
    else el.pause();
  }, [active, paused]);

  useEffect(() => {
    if (ref.current) ref.current.muted = !sound;
  }, [sound]);

  const caption = post.text ?? "";
  const longCaption = caption.length > 80 || caption.includes("\n");

  return (
    <section
      className={cn(
        "flex h-full snap-start snap-always items-start justify-center pt-4",
        offset ? "min-[1000px]:pl-[136px]" : "pr-3",
      )}
      aria-label={`Reel by ${post.author.name}`}
      data-reel-id={post._id}
    >
      <div className="flex items-end gap-[11px]">
        <div className="relative aspect-[9/16] h-[calc(100vh-88px)] overflow-hidden rounded-lg bg-[#18191a]">
          <video
            ref={ref}
            src={media?.url}
            poster={media?.poster}
            muted={!sound}
            loop
            playsInline
            preload={active ? "auto" : "metadata"}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            aria-label={paused ? "Play" : "Pause"}
            onClick={togglePause}
            className="absolute inset-0 cursor-pointer"
          >
            {paused ? (
              <CenterGlyph>
                <PlayGlyph size={36} className="ml-1" />
              </CenterGlyph>
            ) : (
              resumed > 0 && (
                <CenterGlyph key={resumed} fade>
                  <PlayGlyph size={36} className="ml-1" />
                </CenterGlyph>
              )
            )}
          </button>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <button
              type="button"
              aria-label={sound ? "Mute" : "Unmute"}
              onClick={() => setSoundOn(!sound)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <VolumeGlyph muted={!sound} size={22} />
            </button>
          </div>

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
                  <ReelFollow author={post.author} following={post.viewerFollowsAuthor} />
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
        </div>

        <ReelActions post={post} onComment={() => setCommentsOpen(true)} />
      </div>
      {commentsOpen && <PostDialog post={post} onClose={() => setCommentsOpen(false)} />}
    </section>
  );
}

/** The round glyph centred on a reel; `fade` plays once and disappears (tap feedback). */
function CenterGlyph({ fade, children }: { fade?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!fade) return;
    const a = ref.current?.animate(
      [
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.25)" },
      ],
      { duration: 600, easing: "ease-out", fill: "forwards" },
    );
    return () => a?.cancel();
  }, [fade]);
  return (
    <span
      ref={ref}
      className="pointer-events-none absolute top-1/2 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
    >
      {children}
    </span>
  );
}

/**
 * "· Follow" after the author's name for people and Pages the viewer doesn't
 * follow yet. Follows are separate from friend requests; the link disappears
 * once followed, like Facebook's.
 */
function ReelFollow({ author, following }: { author: PostView["author"]; following: boolean }) {
  const viewer = useViewer();
  const follow = useM(api.media.follow);
  const [done, setDone] = useState(false);
  if (following || done || author._id === viewer._id) return null;
  return (
    <>
      <span className="text-[#e2e5e9]">·</span>
      <button
        type="button"
        onClick={() => {
          setDone(true);
          follow({ targetId: author._id, follow: true }).catch(() => setDone(false));
        }}
        className="font-semibold hover:underline"
      >
        Follow
      </button>
    </>
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
    <div className="flex w-12 flex-col items-center gap-[5px] pb-1">
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
