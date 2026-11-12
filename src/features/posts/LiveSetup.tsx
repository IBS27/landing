import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Camera, CameraOff, ChevronDown, Mic, MicOff, MonitorUp } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { FacebookLogo } from "@/icons";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, IconButton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type Audience, AudienceChip } from "./Audience";
import { CommentComposer, CommentList } from "./CommentsSection";
import { OnAirDashboard } from "./LiveDashboard";
import { FloatingReactions, formatElapsed, LiveBadge, useElapsed, ViewerCount } from "./LivePost";
import { useLiveRecording } from "./useLiveRecording";
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

type SoftwareStatus = "starting" | "ready" | "ended" | "blocked" | "unsupported";

/** Device labels that are virtual cameras from streaming software. */
const VIRTUAL_CAMERA = /virtual|obs|streamlabs|xsplit|ndi|vmix|manycam|camtwist|ecamm|mmhmm/i;

/** Encoder output must not be mirrored; only a real selfie-style webcam is. */
function isVirtualCamera(stream: MediaStream | null) {
  const label = stream?.getVideoTracks()[0]?.label ?? "";
  return VIRTUAL_CAMERA.test(label);
}

const isNotFound = (e: unknown) =>
  e instanceof DOMException && (e.name === "NotFoundError" || e.name === "OverconstrainedError");

/**
 * "Streaming software": the encoder's output reaches the browser as a virtual
 * camera (OBS Virtual Camera and the like) or a shared screen or window. Lists
 * the video and audio inputs (refreshed when devices change, so a virtual
 * camera started later appears), prefers a virtual camera on first use, and
 * opens the picked input. `video` is a device id, "" for the default, or
 * "screen" for screen sharing.
 */
function useSoftwareSource(enabled: boolean) {
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [pick, setPick] = useState({ video: "", audio: "" });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<SoftwareStatus>("starting");
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const autoPicked = useRef(false);
  const lastDevice = useRef("");

  const refresh = useCallback(async () => {
    const all = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
    const video = all.filter((d) => d.kind === "videoinput" && d.deviceId);
    setVideoInputs(video);
    setAudioInputs(all.filter((d) => d.kind === "audioinput" && d.deviceId));
    return video;
  }, []);

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!enabled || !md?.addEventListener) return;
    const onChange = () => void refresh();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [enabled, refresh]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-opens the input.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!enabled) return;
    if (!md?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let live = true;
    const opened: MediaStream[] = [];
    setStatus("starting");
    setStream(null);
    const audio: MediaTrackConstraints | boolean =
      pick.audio === "none" ? false : pick.audio ? { deviceId: { exact: pick.audio } } : true;
    const open = async () => {
      if (pick.video === "screen") {
        if (!md.getDisplayMedia) throw new DOMException("", "NotSupportedError");
        // Shared tab/window sound is only used with the default input; "No audio"
        // and an explicitly chosen microphone are honoured exactly.
        const wantShared = audio === true;
        const screen = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: wantShared });
        opened.push(screen);
        if (!audio) {
          for (const t of screen.getAudioTracks()) t.stop();
          return new MediaStream(screen.getVideoTracks());
        }
        if (wantShared && screen.getAudioTracks().length > 0) return screen;
        // No shared sound (or a specific microphone was picked): the mic joins the picture.
        const mic = await md.getUserMedia({ audio }).catch(() => null);
        if (!mic) return screen;
        opened.push(mic);
        return new MediaStream([...screen.getVideoTracks(), ...mic.getAudioTracks()]);
      }
      const video: MediaTrackConstraints = {
        ...(pick.video ? { deviceId: { exact: pick.video } } : {}),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
      const s = await md
        .getUserMedia({ video, audio })
        .catch((e: unknown) =>
          isNotFound(e) && audio ? md.getUserMedia({ video }) : Promise.reject(e),
        );
      opened.push(s);
      return s;
    };
    open()
      .then(async (s) => {
        if (!live) return;
        const devices = await refresh();
        const track = s.getVideoTracks()[0];
        if (pick.video !== "screen") lastDevice.current = track?.getSettings().deviceId ?? "";
        // First time here: switch to a virtual camera when there is one.
        if (!autoPicked.current && pick.video === "") {
          autoPicked.current = true;
          const virtual = devices.find((d) => VIRTUAL_CAMERA.test(d.label));
          if (virtual && virtual.deviceId !== lastDevice.current) {
            setPick((p) => ({ ...p, video: virtual.deviceId }));
            return;
          }
        }
        track?.addEventListener("ended", () => live && setStatus("ended"));
        setStream(s);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (pick.video === "screen") {
          // Sharing was cancelled: back to the camera that was on.
          setNotice("Screen sharing didn't start. Choose a source to continue.");
          setPick((p) => ({ ...p, video: lastDevice.current }));
          return;
        }
        if (isNotFound(e)) {
          void refresh();
          setStatus("ended");
        } else setStatus("blocked");
      });
    return () => {
      live = false;
      for (const s of opened) for (const t of s.getTracks()) t.stop();
      setStream(null);
    };
  }, [enabled, pick.video, pick.audio, attempt, refresh]);

  return {
    status,
    stream,
    videoInputs,
    audioInputs,
    pick,
    notice,
    choose: (next: Partial<typeof pick>) => {
      setNotice(null);
      setPick((p) => ({ ...p, ...next }));
      if (next.video === pick.video) setAttempt((n) => n + 1);
    },
    retry: () => setAttempt((n) => n + 1),
  };
}

/** What the connected video source sends: "Connected · 1280×720 · 30 fps". */
function connectionLabel(stream: MediaStream | null) {
  const s = stream?.getVideoTracks()[0]?.getSettings();
  if (!s?.width || !s.height) return "Connected";
  return `Connected · ${s.width}×${s.height}${s.frameRate ? ` · ${Math.round(s.frameRate)} fps` : ""}`;
}

/**
 * Facebook's Live Producer (/live/producer), reached from the composer's
 * "Live video" button. Left: post details, audience and "Go live" (enabled
 * once the preview is showing frames). Centre: the preview, sized to the space
 * available. The source is the webcam (with a microphone level meter) or
 * streaming software, reaching the browser as a virtual camera or a shared
 * screen or window. Going live publishes an "is live now" post that friends
 * see in their feeds; this page streams the source to everyone who opens it
 * (WebRTC, see `useLiveBroadcast`) and records it for the replay. While live,
 * the centre shows the stream with the viewer count and floating reactions
 * above stream health, viewers and duration cards, the right panel shows the
 * post's comments in real time, and "End live video" ends the broadcast,
 * saves the replay to the post and returns to the feed. The page runs full
 * screen under its own slim header (no TopNav).
 */
export function LiveProducer() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const current = useQ(api.live.mine, {});
  const start = useM(api.live.start);
  const end = useM(api.live.end);
  const heartbeat = useM(api.live.heartbeat);
  const [source, setSource] = useState<"webcam" | "software">("webcam");
  const cam = useCameraPreview(source === "webcam");
  const software = useSoftwareSource(source === "software");
  const status: MediaStatus =
    source === "webcam"
      ? cam.status
      : software.status === "ready"
        ? "ready"
        : software.status === "unsupported"
          ? "unsupported"
          : software.status === "blocked"
            ? "blocked"
            : "requesting";
  const stream = source === "webcam" ? cam.stream : software.stream;
  const [previewing, setPreviewing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<Audience>("public");
  const [busy, setBusy] = useState<false | "start" | "end">(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const belowRef = useRef<HTMLDivElement>(null);
  const below = useHeight(belowRef);

  const liveId = current?._id ?? null;
  const ready = status === "ready" && !!stream && previewing;
  const { stats } = useLiveBroadcast(liveId, stream);
  const recording = useLiveRecording(liveId, stream);

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
    setBusy("start");
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
    setBusy("end");
    const rec = recording();
    try {
      // The last frames are kept, viewers see the end at once, then the replay is saved.
      await rec?.stop();
      await end({ postId: liveId });
      liveRef.current = null;
    } catch {
      setBusy(false);
      setError("Couldn't end your live video. Try again.");
      return;
    }
    await rec?.finish();
    void navigate({ to: "/" });
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
                        source !== "software"
                          ? "Use OBS or another encoder"
                          : ready
                            ? "Connected"
                            : "Waiting for video…"
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
            {current || busy === "end" ? (
              <Button
                block
                size="lg"
                disabled={!!busy}
                onClick={() => setConfirmEnd(true)}
                className="bg-negative text-white hover:brightness-95"
              >
                {busy === "end" ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={18} className="text-white" />
                    Saving your live video…
                  </span>
                ) : (
                  "End live video"
                )}
              </Button>
            ) : (
              <>
                <Button
                  block
                  size="lg"
                  variant="primary"
                  disabled={!ready || !!busy || current === undefined}
                  onClick={() => void goLive()}
                >
                  {busy ? <Spinner size={20} className="text-white" /> : "Go live"}
                </Button>
                {!ready && (
                  <p className="mt-2 text-center text-[13px] text-secondary leading-4">
                    {source === "software"
                      ? "Go live becomes available once video arrives from your software."
                      : "Connect a video source to go live."}
                  </p>
                )}
              </>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-6">
          {/* The stage takes the largest 16:9 that leaves room for the panel under it. */}
          <div className="flex h-full flex-col items-center justify-center [container-type:size]">
            <div
              className="flex flex-col gap-3"
              style={{ width: `min(100cqw, (100cqh - ${below + 12}px) * 16 / 9)` }}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-base">
                {status === "ready" && stream ? (
                  <Preview
                    stream={stream}
                    mirror={source === "webcam" && !isVirtualCamera(stream)}
                    onPlaying={setPreviewing}
                  />
                ) : source === "software" && status !== "blocked" && status !== "unsupported" ? (
                  <SoftwareWaiting />
                ) : (
                  <PreviewMessage
                    status={status}
                    onRetry={source === "webcam" ? cam.retry : software.retry}
                  />
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
              <div ref={belowRef}>
                {current ? (
                  <OnAirDashboard
                    postId={current._id}
                    startedAt={current.live?.startedAt ?? current.createdAt}
                    stream={stream}
                    stats={stats}
                    recording={recording}
                  />
                ) : source === "software" ? (
                  <SoftwareSetup source={software} connected={ready} stream={stream} />
                ) : (
                  <div className="flex shrink-0 items-center gap-4 rounded-lg bg-card px-4 py-3 shadow-base">
                    <DeviceState
                      on={status === "ready"}
                      label={stream?.getVideoTracks()[0]?.label}
                    />
                    <MicMeter stream={stream} />
                  </div>
                )}
              </div>
            </div>
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
            watch it live. Your video (up to the first 15 minutes) will be saved to your profile.
          </p>
          <div className="flex justify-end gap-2 p-4">
            <Button variant="ghost" className="text-link" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!!busy}
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

/** `ref`'s current height, kept in sync as it resizes. */
function useHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return height;
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
      <p className="mt-4 font-bold text-[20px] leading-6">Waiting for video…</p>
      <p className="mt-2 max-w-[440px] text-[15px] text-white/70 leading-5">
        Start your streaming software's virtual camera, or share a screen or window. Your preview
        appears here once video arrives.
      </p>
    </div>
  );
}

/**
 * "Streaming software" setup under the preview: the video input (a virtual
 * camera from OBS and the like), the audio input, "Share screen or window",
 * and the connection status.
 */
function SoftwareSetup({
  source,
  connected,
  stream,
}: {
  source: ReturnType<typeof useSoftwareSource>;
  connected: boolean;
  stream: MediaStream | null;
}) {
  const { videoInputs, audioInputs, pick, choose, notice } = source;
  const sharing = pick.video === "screen";
  const currentVideo = sharing
    ? "screen"
    : pick.video || stream?.getVideoTracks()[0]?.getSettings().deviceId || "";
  const currentAudio = pick.audio || stream?.getAudioTracks()[0]?.getSettings().deviceId || "";
  return (
    <section className="shrink-0 rounded-lg bg-card px-4 py-3 shadow-base">
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 font-semibold text-[17px] text-primary leading-5">
          Streaming software
        </h2>
        <span
          role="status"
          className={cn(
            "flex shrink-0 items-center gap-1.5 text-[13px] leading-4",
            connected ? "font-semibold text-positive" : "text-secondary",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              connected ? "bg-positive" : "animate-pulse bg-secondary",
            )}
          />
          {connected ? connectionLabel(stream) : "Waiting for video…"}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-secondary leading-4">
        Use streaming software like OBS: start its virtual camera, then choose it here.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <DeviceSelect
          label="Video source"
          value={currentVideo}
          onChange={(video) => choose({ video })}
          options={[
            ...videoInputs.map((d, i) => ({
              value: d.deviceId,
              label: d.label || `Camera ${i + 1}`,
            })),
            ...(sharing ? [{ value: "screen", label: "Screen or window" }] : []),
          ]}
          empty="No cameras found"
        />
        <DeviceSelect
          label="Audio source"
          value={currentAudio}
          onChange={(audio) => choose({ audio })}
          options={[
            ...audioInputs.map((d, i) => ({
              value: d.deviceId,
              label: d.label || `Microphone ${i + 1}`,
            })),
            { value: "none", label: "No audio" },
          ]}
        />
        <Button
          variant={sharing ? "soft" : "secondary"}
          icon={<MonitorUp size={16} />}
          onClick={() => choose({ video: "screen" })}
          className="h-9"
        >
          {sharing ? "Share a different screen" : "Share screen or window"}
        </Button>
      </div>
      {notice && <p className="mt-2 text-[13px] text-negative leading-4">{notice}</p>}
    </section>
  );
}

function DeviceSelect({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  empty?: string;
}) {
  return (
    <label className="min-w-[200px] flex-1">
      <span className="mb-1 block font-semibold text-[13px] text-secondary leading-4">{label}</span>
      <span className="relative block">
        <select
          value={options.some((o) => o.value === value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none truncate rounded-md border border-divider bg-card pr-8 pl-3 text-[15px] text-primary outline-none focus:border-fb"
        >
          {!options.some((o) => o.value === value) && (
            <option value="" disabled>
              {options.length === 0 ? (empty ?? "None found") : "Choose…"}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-secondary"
        />
      </span>
    </label>
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

/** The source's live preview. */
function Preview({
  stream,
  mirror,
  onPlaying,
}: {
  stream: MediaStream;
  /** The webcam is mirrored, like a mirror; other sources aren't. */
  mirror: boolean;
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
      aria-label="Video preview"
      onPlaying={() => onPlaying(true)}
      className={cn("h-full w-full", mirror ? "-scale-x-100 object-cover" : "object-contain")}
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
