import { Eye, Maximize, Minimize, Settings } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { HeaderActions } from "@/layout/HeaderActions";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ActionBar } from "./ActionBar";
import { CommentComposer, CommentList } from "./CommentsSection";
import { FollowLink } from "./FollowLink";
import { Stage, TheaterShell } from "./PhotoViewer";
import { PostContent, PostHeader } from "./PostCard";
import { REACTIONS, ReactionIcon, type ReactionType } from "./reactions";
import type { PostView } from "./types";
import { type LiveConnection, useLiveViewer } from "./useLiveStream";
import { setSoundOn, useSoundOn, VolumeGlyph } from "./VideoPlayer";

/** Facebook's red "LIVE" pill. */
export function LiveBadge({ className, small }: { className?: string; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-[#F02849] font-bold text-white uppercase leading-none tracking-wide",
        small ? "h-4 rounded-[3px] px-1 text-[11px]" : "h-6 rounded px-1.5 text-[13px]",
        className,
      )}
    >
      Live
    </span>
  );
}

/** The dark "👁 12" pill beside the LIVE badge: people the stream is reaching right now. */
export function ViewerCount({ postId }: { postId: Id<"posts"> }) {
  const stats = useQ(api.live.stats, { postId });
  const n = stats?.viewers ?? 0;
  return (
    <span
      role="status"
      aria-label={`${n} ${n === 1 ? "viewer" : "viewers"}`}
      className="inline-flex h-6 items-center gap-1 rounded bg-black/55 px-1.5 font-semibold text-[13px] text-white tabular-nums"
    >
      <Eye size={14} strokeWidth={2.5} aria-hidden />
      {n.toLocaleString()}
    </span>
  );
}

/** Seconds since `since`, ticking once a second. */
export function useElapsed(since: number, running = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return Math.max(0, Math.floor((now - since) / 1000));
}

export function formatElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

type LivePost = PostView & { live: NonNullable<PostView["live"]> };

/**
 * Whether at least half of `ref` is on screen. Turning false waits `linger`
 * ms, so a quick scroll past doesn't drop and rebuild the stream.
 */
function useInView(ref: RefObject<HTMLElement | null>, linger = 5000) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearTimeout(timer);
        if (e.isIntersecting) setInView(true);
        else timer = window.setTimeout(() => setInView(false), linger);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [ref, linger]);
  return inView;
}

/**
 * A live broadcast in the feed. Once it's on screen the player joins the
 * broadcast and plays the host's camera inline, muted (the speaker button
 * unmutes, sharing the feed's sound preference), with the LIVE badge, the
 * viewer count and reactions floating up. A click opens the live viewer.
 * Until frames arrive it shows the broadcaster's card; once the host ends it,
 * "Live video ended".
 */
export function LivePostMedia({ post }: { post: LivePost }) {
  const ended = post.live.endedAt !== null;
  // Once the replay is saved the post is a normal video post (its PhotoGrid plays it).
  const replay = ended && post.media.length > 0;
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const [open, setOpen] = useState(false);
  const { stream, state } = useLiveViewer(post._id, !ended && (inView || open));
  const sound = useSoundOn();

  const viewer = open && (
    <LiveViewer
      post={post}
      stream={stream}
      state={state}
      ended={ended}
      onClose={() => setOpen(false)}
    />
  );
  if (replay) return viewer || null;
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden bg-black">
      {ended ? (
        <button
          type="button"
          aria-label={`Open ${post.author.name}'s live video`}
          onClick={() => setOpen(true)}
          className="absolute inset-0 cursor-pointer"
        >
          <BroadcasterCard post={post} />
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Watch ${post.author.name}'s live video`}
            onClick={() => setOpen(true)}
            className="absolute inset-0 cursor-pointer"
          >
            <LiveVideo post={post} stream={stream} state={state} muted={!sound || open} />
          </button>
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5">
            <LiveBadge />
            <ViewerCount postId={post._id} />
          </div>
          <FloatingReactions postId={post._id} className="right-3 bottom-12" />
          <LiveCommentsOverlay postId={post._id} since={post.live.startedAt} />
          {stream && state === "connected" && (
            <button
              type="button"
              aria-label={sound ? "Mute" : "Unmute"}
              onClick={() => setSoundOn(!sound)}
              className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/65"
            >
              <VolumeGlyph muted={!sound} size={18} />
            </button>
          )}
        </>
      )}
      {/* An open live viewer stays open when the host ends, showing "Live video ended". */}
      {viewer}
    </div>
  );
}

/** The stream once frames arrive; the broadcaster's card (with a spinner) before that. */
function LiveVideo({
  post,
  stream,
  state,
  muted,
  fit = "cover",
}: {
  post: LivePost;
  stream: MediaStream | null;
  state: LiveConnection;
  muted: boolean;
  fit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPlaying(false);
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  // Unmuting needs the user's gesture (the click that set it), then playback resumes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    if (el.srcObject && el.paused) void el.play().catch(() => {});
  }, [muted]);

  const showVideo = stream !== null && playing;
  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-label={`${post.author.name}'s live video`}
        onPlaying={() => setPlaying(true)}
        className={cn(
          "absolute inset-0 h-full w-full",
          fit === "cover" ? "object-cover" : "object-contain",
          !showVideo && "invisible",
        )}
      />
      {!showVideo && <BroadcasterCard post={post} connecting />}
      {showVideo && state === "reconnecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-white">
          <Spinner size={32} className="text-white" />
          <p className="font-semibold text-[15px]">Reconnecting…</p>
        </div>
      )}
    </>
  );
}

/** The blurred cover of the broadcaster's photo with their ringed avatar. */
function BroadcasterCard({ post, connecting }: { post: LivePost; connecting?: boolean }) {
  const ended = post.live.endedAt !== null;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
      <img
        src={post.author.avatar}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
      />
      <div className="relative flex flex-col items-center px-6 text-center text-white">
        <span className={cn("rounded-full p-1", !ended && "ring-[3px] ring-[#F02849]")}>
          <Avatar src={post.author.avatar} size={96} />
        </span>
        <p className="mt-4 font-bold text-[20px] leading-6">
          {ended ? "Live video ended" : `${post.author.name} is live now`}
        </p>
        {connecting && !ended && (
          <p className="mt-2 flex items-center gap-2 text-[15px] text-white/80">
            <Spinner size={16} className="text-white/80" />
            Connecting…
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Facebook's live viewer: the stream on the black stage (sound on, since the
 * viewer clicked in) with the LIVE badge, viewer count and floating reactions,
 * and a 360px panel with the post, live comments, and a reaction tray that
 * sends reactions floating up for everyone watching.
 */
function LiveViewer({
  post,
  stream,
  state,
  ended,
  onClose,
}: {
  post: LivePost;
  stream: MediaStream | null;
  state: LiveConnection;
  ended: boolean;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const elapsed = useElapsed(post.live.startedAt, !ended);
  const screen = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(screen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <TheaterShell label={`${post.author.name}'s live video`} onClose={onClose}>
      <Stage onClose={onClose} tools={false}>
        <div ref={screen} className="group/live relative h-full w-full bg-black">
          {ended ? (
            <BroadcasterCard post={post} />
          ) : (
            <LiveVideo post={post} stream={stream} state={state} muted={muted} fit="contain" />
          )}
          {!ended && (
            <>
              <div
                className={cn(
                  "pointer-events-none absolute left-4 z-10 flex items-center gap-1.5",
                  fullscreen.on ? "top-4" : "top-[68px]",
                )}
              >
                <LiveBadge />
                <ViewerCount postId={post._id} />
                <span className="inline-flex h-6 items-center rounded bg-black/55 px-1.5 font-semibold text-[13px] text-white tabular-nums">
                  {formatElapsed(elapsed)}
                </span>
              </div>
              <FloatingReactions postId={post._id} className="right-6 bottom-16" />
              {fullscreen.on && (
                <LiveCommentsOverlay postId={post._id} since={post.live.startedAt} large />
              )}
              <div className="absolute inset-x-4 bottom-4 z-10 flex items-center gap-1">
                <PlayerButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
                  <VolumeGlyph muted={muted} />
                </PlayerButton>
                <div className="flex-1" />
                <div className="relative">
                  <PlayerButton
                    label="Settings"
                    expanded={settingsOpen}
                    onClick={() => setSettingsOpen((o) => !o)}
                  >
                    <Settings size={20} />
                  </PlayerButton>
                  {settingsOpen && (
                    <LiveSettingsMenu stream={stream} onClose={() => setSettingsOpen(false)} />
                  )}
                </div>
                <PlayerButton
                  label={fullscreen.on ? "Exit full screen" : "Enter full screen"}
                  onClick={fullscreen.toggle}
                >
                  {fullscreen.on ? <Minimize size={20} /> : <Maximize size={20} />}
                </PlayerButton>
              </div>
            </>
          )}
        </div>
      </Stage>
      <LivePanel post={post} ended={ended} />
    </TheaterShell>
  );
}

/** Full screen for `ref`'s element, and whether it's on. */
function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (ref.current && document.fullscreenElement === ref.current)
        void document.exitFullscreen().catch(() => {});
    };
  }, [ref]);
  return {
    on,
    toggle: () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      else void ref.current?.requestFullscreen().catch(() => {});
    },
  };
}

function PlayerButton({
  label,
  onClick,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        aria-expanded={expanded}
        onClick={onClick}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3a3b3c]/80 text-white hover:bg-[#4e4f50]"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** The live player's settings: the quality arriving now (live video adapts on its own). */
function LiveSettingsMenu({
  stream,
  onClose,
}: {
  stream: MediaStream | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setHeight(stream?.getVideoTracks()[0]?.getSettings().height ?? null);
    read();
    const id = window.setInterval(read, 2000);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [stream, onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Settings"
      className="absolute right-0 bottom-full mb-2 w-[240px] rounded-lg bg-[#242526] p-2 text-[#e4e6eb] shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between rounded-md px-2 py-2 text-[15px]">
        <span className="font-semibold">Quality</span>
        <span className="text-[13px] text-[#b0b3b8]">{height ? `Auto (${height}p)` : "Auto"}</span>
      </div>
      <p className="px-2 pb-1 text-[13px] text-[#b0b3b8] leading-4">
        Live video quality adjusts automatically to your connection.
      </p>
    </div>
  );
}

/**
 * The latest live comments over the bottom of the stream (newest last), like
 * Facebook's feed player: only comments written since the broadcast began.
 */
function LiveCommentsOverlay({
  postId,
  since,
  large,
}: {
  postId: Id<"posts">;
  since: number;
  large?: boolean;
}) {
  const threads = useQ(api.comments.list, { postId });
  const latest = useMemo(
    () =>
      (threads ?? [])
        .filter((t) => t.createdAt >= since && t.text)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-3),
    [threads, since],
  );
  if (latest.length === 0) return null;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex flex-col gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 pt-10",
        large ? "right-auto w-[420px] pb-20 pl-4" : "pr-14 pb-3",
      )}
    >
      {latest.map((c) => (
        <div key={c._id} className="flex min-w-0 items-start gap-2 text-white">
          <Avatar src={c.author.avatar} size={large ? 32 : 24} className="shrink-0" />
          <p
            className={cn(
              "line-clamp-2 min-w-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]",
              large ? "text-[15px] leading-5" : "text-[13px] leading-4",
            )}
          >
            <span className="font-semibold">{c.author.name}</span> {c.text}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The live viewer's right panel: post, reactions, live comments, reaction tray and composer. */
function LivePanel({ post, ended }: { post: LivePost; ended: boolean }) {
  const [focusKey, setFocusKey] = useState(0);
  return (
    <aside className="flex w-[360px] shrink-0 flex-col bg-card text-primary">
      <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-4">
        <HeaderActions />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-divider border-t">
        <div className="pt-1">
          <PostHeader post={post} nameSuffix={<FollowLink post={post} />} />
        </div>
        <PostContent
          post={{
            ...post,
            live: null,
            background: null,
            media: [],
            attachments: [],
            shared: null,
          }}
          expanded
          smallText
        />
        <ActionBar
          variant="labelled"
          post={post}
          onComment={() => setFocusKey((k) => k + 1)}
          className="mx-3"
          trailing={ended ? undefined : <WatchingCount postId={post._id} />}
        />
        {post.commentCount === 0 ? (
          <p className="px-4 py-8 text-center text-[15px] text-secondary leading-5">
            {ended ? "No comments yet" : "Comments will appear here"}
          </p>
        ) : (
          <CommentList postId={post._id} />
        )}
      </div>
      <div className="border-divider border-t px-3 pt-2 pb-3">
        {!ended && <ReactionTray postId={post._id} />}
        <CommentComposer postId={post._id} focusKey={focusKey} />
      </div>
    </aside>
  );
}

/** "12 watching" in the live viewer's summary row. */
function WatchingCount({ postId }: { postId: Id<"posts"> }) {
  const stats = useQ(api.live.stats, { postId });
  const n = stats?.viewers ?? 0;
  return <span className="shrink-0">{n.toLocaleString()} watching</span>;
}

/** Tap-to-send reactions under the live chat (each tap floats one up). */
function ReactionTray({ postId }: { postId: Id<"posts"> }) {
  const react = useM(api.live.react);
  return (
    <div role="toolbar" aria-label="Send a reaction" className="mb-2 flex items-center gap-1">
      {REACTIONS.map((r) => (
        <Tooltip key={r.type} content={r.label} side="top">
          <button
            type="button"
            aria-label={r.label}
            onClick={() => void react({ postId, type: r.type }).catch(() => {})}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-125 hover:bg-hover active:scale-95"
          >
            <ReactionIcon type={r.type} size={28} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

type Floater = { id: string; type: ReactionType; drift: number };

/**
 * Reactions floating up the right edge of the stream: every reaction sent
 * while this player is open rises and fades once (older ones don't replay).
 */
export function FloatingReactions({
  postId,
  className,
}: {
  postId: Id<"posts">;
  className?: string;
}) {
  const rows = useQ(api.live.reactions, { postId });
  const seen = useRef<Set<string> | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    if (!rows) return;
    if (!seen.current) {
      seen.current = new Set(rows.map((r) => r._id));
      return;
    }
    const fresh = rows.filter((r) => !seen.current?.has(r._id)).reverse();
    if (fresh.length === 0) return;
    for (const r of fresh) seen.current.add(r._id);
    setFloaters((f) => [
      ...f.slice(-24),
      ...fresh.map((r) => ({ id: r._id, type: r.type, drift: Math.random() * 40 - 20 })),
    ]);
  }, [rows]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute z-10 h-[260px] w-16", className)}>
      {floaters.map((f) => (
        <FloatingEmoji
          key={f.id}
          f={f}
          onDone={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
        />
      ))}
    </div>
  );
}

function FloatingEmoji({ f, onDone }: { f: Floater; onDone: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const el = ref.current;
    if (!el?.animate) {
      done.current();
      return;
    }
    const a = el.animate(
      [
        { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
        { transform: `translate(${f.drift / 2}px, -40px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${f.drift}px, -220px) scale(1)`, opacity: 0 },
      ],
      { duration: 2800, easing: "ease-out" },
    );
    a.onfinish = () => done.current();
    return () => a.cancel();
  }, [f.drift]);
  return (
    <span ref={ref} className="absolute bottom-0 left-3 opacity-0">
      <ReactionIcon type={f.type} size={36} className="drop-shadow" />
    </span>
  );
}
