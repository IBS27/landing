import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  Copy,
  Info,
  Mic,
  MicOff,
  MonitorUp,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { FacebookLogo } from "@/icons";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, IconButton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type Audience, AudienceChip } from "./Audience";
import { CommentComposer, CommentList } from "./CommentsSection";
import { FloatingReactions, formatElapsed, LiveBadge, useElapsed, ViewerCount } from "./LivePost";
import { useLiveBroadcast } from "./useLiveStream";

/** How often the host's page tells Convex it's still broadcasting. */
const HEARTBEAT_MS = 15_000;

type MediaStatus = "requesting" | "ready" | "blocked" | "no-device" | "unsupported";

/**
 * The camera and microphone for the preview. Asks once on mount (and again on
 * "Try again"); falls back to camera-only when there's no microphone.
 */
function useCameraPreview(enabled: boolean) {
  const [status, setStatus] = useState<MediaStatus>("requesting");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-requests access.
  useEffect(() => {
    if (!enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let live = true;
    let got: MediaStream | null = null;
    setStatus("requesting");
    const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
    navigator.mediaDevices
      .getUserMedia({ video, audio: true })
      .catch((e: unknown) =>
        e instanceof DOMException && e.name === "NotFoundError"
          ? navigator.mediaDevices.getUserMedia({ video })
          : Promise.reject(e),
      )
      .then((s) => {
        got = s;
        if (!live) {
          for (const t of s.getTracks()) t.stop();
          return;
        }
        setStream(s);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!live) return;
        const name = e instanceof DOMException ? e.name : "";
        setStatus(
          name === "NotFoundError" || name === "OverconstrainedError" ? "no-device" : "blocked",
        );
      });
    return () => {
      live = false;
      for (const t of got?.getTracks() ?? []) t.stop();
      setStream(null);
    };
  }, [attempt, enabled]);

  return { status, stream, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Facebook's Live Producer (/live/producer), reached from the composer's
 * "Live video" button. Left: post details, audience and "Go live" (enabled
 * once the camera preview is running). Centre: the camera preview with a
 * microphone level meter. Going live publishes an "is live now" post that
 * friends see in their feeds, and this page streams the camera and microphone
 * to everyone who opens it (WebRTC, see `useLiveBroadcast`). While live, the
 * preview shows the viewer count and reactions floating up, the right panel
 * shows the post's comments in real time, and "End live video" ends the
 * broadcast and returns to the feed. The page
 * runs full screen under its own slim header (no TopNav). "Streaming software"
 * shows a per-session server URL and stream key, but no encoder can actually
 * connect to the clone, so only the webcam can go live.
 */
export function LiveProducer() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const current = useQ(api.live.mine, {});
  const start = useM(api.live.start);
  const end = useM(api.live.end);
  const heartbeat = useM(api.live.heartbeat);
  const [source, setSource] = useState<"webcam" | "software">("webcam");
  const { status, stream, retry } = useCameraPreview(source === "webcam");
  const [previewing, setPreviewing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<Audience>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const liveId = current?._id ?? null;
  const ready = source === "webcam" && status === "ready" && previewing;
  useLiveBroadcast(liveId, source === "webcam" ? stream : null);

  // Keep the broadcast alive while this page is open.
  useEffect(() => {
    if (!liveId) return;
    const beat = () => void heartbeat({ postId: liveId }).catch(() => {});
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [liveId, heartbeat]);

  // Leaving the producer ends the broadcast, like closing Facebook's.
  const liveRef = useRef<Id<"posts"> | null>(null);
  liveRef.current = liveId;
  useEffect(
    () => () => {
      if (liveRef.current) void end({ postId: liveRef.current }).catch(() => {});
    },
    [end],
  );

  const goLive = async () => {
    setBusy(true);
    setError(null);
    try {
      await start({ title, description, privacy: audience });
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const endLive = async () => {
    if (!liveId) return;
    setBusy(true);
    try {
      await end({ postId: liveId });
      liveRef.current = null;
      void navigate({ to: "/" });
    } catch {
      setBusy(false);
      setError("Couldn't end your live video. Try again.");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-wash">
      <ProducerHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[360px] shrink-0 flex-col bg-card shadow-base">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h1 className="font-bold text-[24px] text-primary leading-7">
              {current ? "Live now" : "Create live video"}
            </h1>

            {current === undefined ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : current ? (
              <LiveDetails post={current} />
            ) : (
              <>
                <Section title="Choose where to post">
                  <div className="flex items-center gap-3 rounded-lg bg-wash px-3 py-2.5">
                    <Avatar src={viewer.avatar} size={36} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] text-primary leading-5">
                        Share to your profile
                      </p>
                      <p className="truncate text-[13px] text-secondary leading-4">{viewer.name}</p>
                    </div>
                  </div>
                </Section>

                <Section title="Select video source">
                  <div role="radiogroup" aria-label="Video source" className="flex flex-col gap-2">
                    <SourceOption
                      selected={source === "webcam"}
                      onSelect={() => setSource("webcam")}
                      icon={<Camera size={18} />}
                      title="Webcam"
                      detail={
                        source !== "webcam"
                          ? "Use your computer's camera"
                          : ready
                            ? "Connected"
                            : status === "requesting"
                              ? "Connecting…"
                              : "Not connected"
                      }
                    />
                    <SourceOption
                      selected={source === "software"}
                      onSelect={() => setSource("software")}
                      icon={<MonitorUp size={18} />}
                      title="Streaming software"
                      detail={
                        source === "software"
                          ? "Waiting for connection…"
                          : "Use OBS or another encoder"
                      }
                    />
                  </div>
                </Section>

                <Section title="Add post details">
                  <label className="block">
                    <span className="sr-only">Title</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={255}
                      placeholder="Title (optional)"
                      className="h-12 w-full rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none placeholder:text-secondary focus:border-fb"
                    />
                  </label>
                  <label className="mt-2 block">
                    <span className="sr-only">Description</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Say something about this live video..."
                      className="w-full resize-none rounded-md border border-divider bg-card px-3 py-2.5 text-[15px] text-primary leading-5 outline-none placeholder:text-secondary focus:border-fb"
                    />
                  </label>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[15px] text-primary">Audience</span>
                    <AudienceChip value={audience} onChange={setAudience} />
                  </div>
                </Section>
              </>
            )}
          </div>

          <div className="border-divider border-t p-4">
            {error && (
              <p role="alert" className="mb-2 text-[13px] text-negative leading-4">
                {error}
              </p>
            )}
            {current ? (
              <Button
                block
                size="lg"
                disabled={busy}
                onClick={() => setConfirmEnd(true)}
                className="bg-negative text-white hover:brightness-95"
              >
                End live video
              </Button>
            ) : (
              <>
                <Button
                  block
                  size="lg"
                  variant="primary"
                  disabled={!ready || busy || current === undefined}
                  onClick={() => void goLive()}
                >
                  {busy ? <Spinner size={20} className="text-white" /> : "Go live"}
                </Button>
                {!ready && (
                  <p className="mt-2 text-center text-[13px] text-secondary leading-4">
                    {source === "software"
                      ? "Start streaming from your software to go live."
                      : "Connect a video source to go live."}
                  </p>
                )}
              </>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col items-center justify-center p-6">
          <div className="w-full max-w-[960px]">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-base">
              {source === "software" && !current ? (
                <SoftwareWaiting />
              ) : status === "ready" && stream ? (
                <Preview stream={stream} onPlaying={setPreviewing} />
              ) : (
                <PreviewMessage status={status} onRetry={retry} />
              )}
              {current && (
                <>
                  <LiveOverlay
                    postId={current._id}
                    startedAt={current.live?.startedAt ?? current.createdAt}
                  />
                  <FloatingReactions postId={current._id} className="right-3 bottom-3" />
                </>
              )}
            </div>
            {source === "software" && !current ? (
              <StreamSetup />
            ) : (
              <div className="mt-3 flex items-center gap-4 rounded-lg bg-card px-4 py-3 shadow-base">
                <DeviceState on={status === "ready"} label={stream?.getVideoTracks()[0]?.label} />
                <MicMeter stream={stream} />
              </div>
            )}
          </div>
        </main>

        {current && (
          <aside className="flex w-[360px] shrink-0 flex-col bg-card shadow-base">
            <h2 className="px-4 pt-4 pb-2 font-bold text-[17px] text-primary leading-5">
              Comments
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {current.commentCount === 0 && (
                <p className="px-4 py-6 text-center text-[15px] text-secondary">
                  Comments from viewers will appear here.
                </p>
              )}
              <CommentList postId={current._id} />
            </div>
            <div className="border-divider border-t px-3 pt-2 pb-3">
              <CommentComposer postId={current._id} />
            </div>
          </aside>
        )}

        <Modal open={confirmEnd} onOpenChange={setConfirmEnd} title="End live video?" width={548}>
          <p className="px-4 pt-4 text-[15px] text-primary leading-5">
            Are you sure you want to end your live video? Your followers will no longer be able to
            watch it live.
          </p>
          <div className="flex justify-end gap-2 p-4">
            <Button variant="ghost" className="text-link" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setConfirmEnd(false);
                void endLive();
              }}
            >
              End live video
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

/** The producer's own slim header (Facebook hides the TopNav here): back, logo, title. */
function ProducerHeader() {
  const router = useRouter();
  const navigate = useNavigate();
  const viewer = useViewer();
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-2 bg-card px-4 shadow-base">
      <IconButton
        label="Back"
        variant="ghost"
        onClick={() => {
          if (router.history.canGoBack()) router.history.back();
          else void navigate({ to: "/" });
        }}
      >
        <ArrowLeft size={22} className="text-secondary" />
      </IconButton>
      <Link to="/" aria-label="Facebook" className="shrink-0">
        <FacebookLogo size={40} />
      </Link>
      <span className="ml-1 font-bold text-[17px] text-primary leading-5">Live Producer</span>
      <Avatar src={viewer.avatar} size={40} className="ml-auto" />
    </header>
  );
}

function SourceOption({
  selected,
  onSelect,
  icon,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left",
        selected ? "border-fb bg-highlight" : "border-divider hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-fb text-white" : "bg-btn text-primary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[15px] text-primary leading-5">{title}</span>
        <span className="block text-[13px] text-secondary leading-4">{detail}</span>
      </span>
    </button>
  );
}

function SoftwareWaiting() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <MonitorUp size={30} />
      </span>
      <p className="mt-4 font-bold text-[20px] leading-6">Connect your streaming software</p>
      <p className="mt-2 max-w-[440px] text-[15px] text-white/70 leading-5">
        Copy the server URL and stream key below into your streaming software, then start streaming.
        A preview appears here once it connects.
      </p>
    </div>
  );
}

/** A random stream key in Facebook's shape, new for each producer session. */
function newStreamKey() {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b % 10).join("");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const token = Array.from(
    crypto.getRandomValues(new Uint8Array(28)),
    (b) => alphabet[b % alphabet.length],
  ).join("");
  return `FB-${digits}-0-${token}`;
}

const SERVER_URL = "rtmps://live.clone.local:443/rtmp/";

/** "Stream setup": server URL and a per-session stream key, each with Copy. */
function StreamSetup() {
  const [key] = useState(newStreamKey);
  const [shown, setShown] = useState(false);
  return (
    <div className="mt-3 rounded-lg bg-card px-4 py-4 shadow-base">
      <h2 className="font-semibold text-[17px] text-primary leading-5">Stream setup</h2>
      <div className="mt-3 grid gap-3 min-[1100px]:grid-cols-2">
        <CopyField label="Server URL" value={SERVER_URL} />
        <CopyField
          label="Stream key"
          value={key}
          masked={!shown}
          extra={
            <Button variant="secondary" onClick={() => setShown((v) => !v)}>
              {shown ? "Hide" : "Show"}
            </Button>
          }
        />
      </div>
      <p className="mt-3 flex items-start gap-2 text-[13px] text-secondary leading-4">
        <Info size={16} className="mt-px shrink-0" />A new stream key is generated each time you
        open Live Producer. External encoders can't connect to this Facebook clone, so no preview
        will appear here; switch to Webcam to go live.
      </p>
    </div>
  );
}

function CopyField({
  label,
  value,
  masked,
  extra,
}: {
  label: string;
  value: string;
  masked?: boolean;
  extra?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <div className="min-w-0">
      <p className="mb-1 font-semibold text-[13px] text-secondary leading-4">{label}</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label={label}
          value={masked ? "•".repeat(24) : value}
          onFocus={(e) => !masked && e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-divider bg-input px-3 font-mono text-[13px] text-primary outline-none"
        />
        {extra}
        <Button
          variant="secondary"
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(value)
              .then(() => setCopied(true))
              .catch(() => {});
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 font-semibold text-[17px] text-primary leading-5">{title}</h2>
      {children}
    </section>
  );
}

function LiveDetails({
  post,
}: {
  post: { text: string | null; live: { title: string | null } | null; privacy: Audience };
}) {
  return (
    <div className="mt-4 rounded-lg bg-wash px-3 py-3">
      <div className="flex items-center gap-2">
        <LiveBadge />
        <span className="text-[13px] text-secondary">
          Shared with{" "}
          {post.privacy === "public"
            ? "Public"
            : post.privacy === "friends"
              ? "Friends"
              : "Only me"}
        </span>
      </div>
      {post.live?.title && (
        <p className="mt-2 font-semibold text-[15px] text-primary leading-5">{post.live.title}</p>
      )}
      {post.text && post.text !== post.live?.title && (
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-primary leading-5">{post.text}</p>
      )}
      <p className="mt-2 text-[13px] text-secondary leading-4">
        Your friends can see that you're live in their feeds and watch your video there.
      </p>
    </div>
  );
}

/** The mirrored camera preview. */
function Preview({
  stream,
  onPlaying,
}: {
  stream: MediaStream;
  onPlaying: (playing: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      onPlaying(false);
      el.srcObject = null;
    };
  }, [stream, onPlaying]);
  return (
    <video
      ref={ref}
      muted
      playsInline
      autoPlay
      aria-label="Camera preview"
      onPlaying={() => onPlaying(true)}
      className="h-full w-full -scale-x-100 object-cover"
    />
  );
}

function PreviewMessage({ status, onRetry }: { status: MediaStatus; onRetry: () => void }) {
  if (status === "requesting")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
        <Spinner size={32} className="text-white/80" />
        <p className="text-[15px]">Waiting for your camera and microphone…</p>
      </div>
    );
  const copy =
    status === "no-device"
      ? {
          title: "Connect a camera",
          body: "We couldn't find a camera. Connect one to your computer, then try again.",
        }
      : status === "unsupported"
        ? {
            title: "Your browser can't go live",
            body: "This browser doesn't allow camera access. Try a recent version of Chrome, Edge, Firefox or Safari.",
          }
        : {
            title: "Allow camera and microphone",
            body: "To go live, allow Facebook to use your camera and microphone. You can change this in your browser's site settings, then try again.",
          };
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <CameraOff size={30} />
      </span>
      <p className="mt-4 font-bold text-[20px] leading-6">{copy.title}</p>
      <p className="mt-2 max-w-[440px] text-[15px] text-white/70 leading-5">{copy.body}</p>
      {status !== "unsupported" && (
        <Button variant="primary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function LiveOverlay({ postId, startedAt }: { postId: Id<"posts">; startedAt: number }) {
  const elapsed = useElapsed(startedAt);
  return (
    <div className="absolute top-3 left-3 flex items-center gap-1.5">
      <LiveBadge />
      <ViewerCount postId={postId} />
      <span className="inline-flex h-6 items-center rounded bg-black/55 px-1.5 font-semibold text-[13px] text-white tabular-nums">
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
}

function DeviceState({ on, label }: { on: boolean; label?: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <DeviceIcon>
        {on ? <Camera size={18} /> : <CameraOff size={18} className="text-secondary" />}
      </DeviceIcon>
      <div className="min-w-0">
        <p className="font-semibold text-[15px] text-primary leading-5">Camera</p>
        <p className="truncate text-[13px] text-secondary leading-4">
          {on ? label || "Connected" : "Not connected"}
        </p>
      </div>
    </div>
  );
}

function DeviceIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
      {children}
    </span>
  );
}

/** A live microphone level meter (Web Audio analyser, drawn without React re-renders). */
function MicMeter({ stream }: { stream: MediaStream | null }) {
  const bar = useRef<HTMLSpanElement>(null);
  const track = stream?.getAudioTracks()[0] ?? null;

  const measure = useCallback(() => {
    if (!stream || !track) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    void ctx.resume().catch(() => {});
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let level = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const d of data) sum += ((d - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / data.length);
      // Fast attack, slow release, like a VU meter.
      level = Math.max(Math.min(1, rms * 4), level * 0.9);
      if (bar.current) bar.current.style.width = `${Math.round(level * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close().catch(() => {});
    };
  }, [stream, track]);

  useEffect(() => measure(), [measure]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <DeviceIcon>
        {track ? <Mic size={18} /> : <MicOff size={18} className="text-secondary" />}
      </DeviceIcon>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[15px] text-primary leading-5">Microphone</p>
        <p className="sr-only">{track ? track.label || "Connected" : "No microphone"}</p>
        <div aria-hidden className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-btn">
          <span
            ref={bar}
            className="block h-full w-0 rounded-full bg-[#45BD62] transition-[width] duration-75"
          />
        </div>
      </div>
    </div>
  );
}
