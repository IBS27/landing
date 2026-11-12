import { Eye } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
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
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden bg-black">
      {ended ? (
        <BroadcasterCard post={post} />
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
  return (
    <TheaterShell label={`${post.author.name}'s live video`} onClose={onClose}>
      <Stage onClose={onClose} tools={false}>
        <div className="relative h-full w-full">
          {ended ? (
            <BroadcasterCard post={post} />
          ) : (
            <LiveVideo post={post} stream={stream} state={state} muted={muted} fit="contain" />
          )}
        </div>
      </Stage>
      {!ended && (
        <>
          <div className="pointer-events-none absolute top-[68px] left-4 z-10 flex items-center gap-1.5">
            <LiveBadge />
            <ViewerCount postId={post._id} />
            <span className="inline-flex h-6 items-center rounded bg-black/55 px-1.5 font-semibold text-[13px] text-white tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>
          <FloatingReactions postId={post._id} className="right-[384px] bottom-16" />
          <div className="absolute bottom-4 left-4 z-10">
            <Tooltip content={muted ? "Unmute" : "Mute"} side="top">
              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => setMuted((m) => !m)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3a3b3c]/80 text-white hover:bg-[#4e4f50]"
              >
                <VolumeGlyph muted={muted} />
              </button>
            </Tooltip>
          </div>
        </>
      )}
      <LivePanel post={post} ended={ended} />
    </TheaterShell>
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
        />
        <CommentList postId={post._id} />
      </div>
      <div className="border-divider border-t px-3 pt-2 pb-3">
        {!ended && <ReactionTray postId={post._id} />}
        <CommentComposer postId={post._id} focusKey={focusKey} />
      </div>
    </aside>
  );
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
