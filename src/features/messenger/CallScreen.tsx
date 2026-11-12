import { useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  Flag,
  Lock,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  ScreenShareOff,
  Settings,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import {
  type ComponentPropsWithRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatCallClock, formatCallDuration } from "../../../convex/lib/callFormat";
import { CallSettingsDialog, ReportCallDialog } from "./CallDialogs";
import { ConversationAvatar } from "./ConversationAvatar";
import { RINGBACK, useTone } from "./callTones";
import { PhoneIcon, VideoCallIcon } from "./icons";
import { useCallMedia } from "./useCallMedia";
import { type RemotePeer, useCallPeers } from "./useCallPeers";

type CallView = NonNullable<FunctionReturnType<typeof api.calls.get>>;
type Person = CallView["others"][number];
type Net = "connecting" | "connected" | "reconnecting" | "failed";

/**
 * The Messenger call screen. Rendered full-window in the /call/<id> pop-up,
 * or inside an in-page dialog when the browser blocks the pop-up.
 */
export function CallScreen({
  callId,
  variant,
  onClose,
  onCallAgain,
}: {
  callId: string;
  variant: "window" | "modal";
  onClose: () => void;
  onCallAgain: (conversationId: Id<"conversations">, kind: "audio" | "video") => void;
}) {
  const call = useQ(api.calls.get, { callId });

  useEffect(() => {
    if (variant !== "window") return;
    document.title = call ? `${call.thread.name} | Messenger call` : "Messenger call";
  }, [variant, call]);

  if (call === undefined)
    return (
      <Shell variant={variant}>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size={32} />
        </div>
      </Shell>
    );
  if (call === null)
    return (
      <Shell variant={variant}>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <h1 className="font-bold text-[20px] leading-6">This call isn't available</h1>
          <p className="mt-2 text-[15px] text-white/70 leading-5">
            It may have ended, or the link may be broken.
          </p>
        </div>
        <Controls>
          <Control label="Close" caption onClick={onClose}>
            <X size={24} strokeWidth={2.4} />
          </Control>
        </Controls>
      </Shell>
    );
  return (
    <ActiveCall
      key={call._id}
      call={call}
      variant={variant}
      onClose={onClose}
      onCallAgain={onCallAgain}
    />
  );
}

/** One state for the whole call from every peer connection's state. */
function overallNet(states: RTCPeerConnectionState[]): Net {
  if (states.includes("connected")) return "connected";
  if (states.includes("disconnected")) return "reconnecting";
  if (states.length > 0 && states.every((s) => s === "failed" || s === "closed")) return "failed";
  return "connecting";
}

function ActiveCall({
  call,
  variant,
  onClose,
  onCallAgain,
}: {
  call: CallView;
  variant: "window" | "modal";
  onClose: () => void;
  onCallAgain: (conversationId: Id<"conversations">, kind: "audio" | "video") => void;
}) {
  const viewer = useViewer();
  const me = viewer._id;
  const accept = useM(api.calls.accept);
  const decline = useM(api.calls.decline);
  const leave = useM(api.calls.leave);

  // The connection gave up: this side has left and shows "Call failed".
  const [failed, setFailed] = useState(false);
  const live = !failed && (call.status === "ringing" || call.status === "active");
  const joined = live && call.joinedIds.includes(me);
  const inCall = joined && call.status === "active";
  const ringingOut = joined && call.status === "ringing";
  const isVideo = call.kind === "video";

  const [mic, setMic] = useState(true);
  const local = useCallMedia(call.kind, joined);
  const media = useMemo(
    () => ({
      mic: mic && !!local.audio,
      cam: local.source === "camera" && !!local.video,
      screen: local.source === "screen" && !!local.video,
    }),
    [mic, local.audio, local.video, local.source],
  );
  const localStream = useMemo(
    () => (local.video ? new MediaStream([local.video]) : null),
    [local.video],
  );

  const peerIds = useMemo(
    () => (inCall ? call.joinedIds.filter((id) => id !== me) : []),
    [inCall, call.joinedIds, me],
  );
  const remote = useCallPeers({
    callId: call._id,
    me,
    callerId: call.callerId,
    kind: call.kind,
    peers: peerIds,
    active: inCall,
    audio: local.audio,
    video: local.video,
    localSettled: local.settled,
    media,
  });

  useTone(RINGBACK, ringingOut);

  // Honest connection state: the timer starts when media actually connects.
  const remotePeople = call.others.filter((o) => peerIds.includes(o._id));
  const peerStates = remotePeople.map((p) => remote[p._id]?.state ?? "new");
  const net: Net | null = inCall ? overallNet(peerStates) : null;
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  useEffect(() => {
    if (net === "connected") setConnectedAt((t) => t ?? Date.now());
  }, [net]);
  useEffect(() => {
    if (net !== "failed") return;
    setFailed(true);
    void leave({ callId: call._id }).catch(() => {});
  }, [net, leave, call._id]);

  // Best effort: closing or reloading the pop-up hangs up (the opener also notices).
  const joinedRef = useRef(joined);
  joinedRef.current = joined;
  useEffect(() => {
    if (variant !== "window") return;
    const onHide = () => {
      if (joinedRef.current) void leave({ callId: call._id }).catch(() => {});
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [variant, leave, call._id]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"settings" | "report" | null>(null);
  const overlayOpen = useRef(false);
  overlayOpen.current = menuOpen || dialog !== null;

  const hangUp = () => {
    void leave({ callId: call._id }).catch(() => {});
    onClose();
  };
  const hangUpRef = useRef(hangUp);
  hangUpRef.current = hangUp;
  useEffect(() => {
    if (variant !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      // Escape closes an open menu or dialog first.
      if (e.key === "Escape" && !overlayOpen.current && !e.defaultPrevented) hangUpRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const firstOther = call.others[0];
  const isGroup = call.thread.kind === "group";
  const now = useNow(net === "connected" || call.status === "ringing");
  const endedAt = call.endedAt ?? now;
  const durationMs = connectedAt
    ? endedAt - connectedAt
    : call.answeredAt
      ? endedAt - call.answeredAt
      : 0;

  let status: ReactNode;
  if (failed) status = "Call failed — check your connection";
  else if (!live) {
    if (call.status === "ended") status = `Call ended · ${formatCallDuration(durationMs)}`;
    else if (call.status === "declined")
      status = isGroup ? "No one answered" : `${firstOther?.firstName ?? "They"} declined`;
    else if (call.role === "callee") status = "Missed call";
    else status = "No answer";
  } else if (!joined)
    status =
      call.status === "ringing"
        ? `${call.caller?.firstName ?? "Someone"} is calling you…`
        : "Call in progress";
  else if (ringingOut) status = <Dots label="Calling" />;
  else if (net === "connected" && connectedAt)
    status = <span className="tabular-nums">{formatCallClock(now - connectedAt)}</span>;
  else if (net === "reconnecting") status = <Dots label="Reconnecting" />;
  else status = <Dots label="Connecting" />;

  // 1:1 shows the other person full-bleed; group calls tile everyone in.
  const solo = remotePeople.length <= 1;
  const soloPeer = solo ? remotePeople[0] : undefined;
  const soloRemote = soloPeer ? remote[soloPeer._id] : undefined;
  const soloVideo = !!soloRemote && showsVideo(soloRemote);
  const localVideoFull = ringingOut && !!localStream;
  const selfView = joined && !ringingOut && !!localStream;
  const backdrop = call.thread.photo ?? firstOther?.avatar ?? null;

  return (
    <Shell
      label={`${isVideo ? "Video" : "Audio"} call with ${call.thread.name}`}
      variant={variant}
      rtc={inCall ? peerStates.join(" ") : undefined}
    >
      {/* Blurred, darkened avatar fills the window behind everything else. */}
      {backdrop && !soloVideo && !localVideoFull && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-[48px]"
        />
      )}
      {localVideoFull && (
        <StreamVideo
          stream={localStream}
          mirrored={media.cam}
          fit={media.screen ? "contain" : "cover"}
          className="absolute inset-0"
        />
      )}
      {inCall && solo && soloVideo && soloRemote && (
        <StreamVideo
          stream={soloRemote.stream}
          version={soloRemote.version}
          fit={soloRemote.media?.screen ? "contain" : "cover"}
          className="absolute inset-0"
        />
      )}
      {/* Remote audio plays even while their camera is off. */}
      {inCall &&
        remotePeople.map((p) => {
          const r = remote[p._id];
          return r ? <RemoteAudio key={p._id} peer={r} sinkId={local.prefs.audiooutput} /> : null;
        })}
      <div
        className={cn(
          "absolute inset-0",
          soloVideo || localVideoFull
            ? "bg-gradient-to-b from-black/45 via-transparent to-black/55"
            : "bg-black/35",
        )}
        aria-hidden
      />

      <div className="relative flex h-12 shrink-0 items-center justify-center gap-1.5 text-[13px] text-white/80">
        <Lock size={12} strokeWidth={2.6} />
        End-to-end encrypted
      </div>

      {inCall && !solo ? (
        <div className="relative flex min-h-0 flex-1 flex-col px-3">
          <p className="pb-2 text-center text-[13px] text-white/80" aria-live="polite">
            {status}
          </p>
          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 pb-2">
            {remotePeople.map((p) => (
              <PeerTile key={p._id} person={p} peer={remote[p._id]} />
            ))}
          </div>
        </div>
      ) : soloVideo ? (
        <div className="relative flex flex-1 flex-col px-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
              {call.thread.name}
            </span>
            {soloRemote?.media && !soloRemote.media.mic && <MicOff size={14} aria-label="Muted" />}
          </div>
          <span
            className="text-[13px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.5)]"
            aria-live="polite"
          >
            {soloRemote?.media?.screen
              ? `${soloPeer?.firstName ?? "They"} is sharing their screen`
              : status}
          </span>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="relative inline-flex">
            {(ringingOut || (live && !joined)) && <RingPulse />}
            {soloPeer && !isGroup ? (
              <Avatar src={soloPeer.avatar} size={96} />
            ) : (
              <ConversationAvatar
                kind={call.thread.kind}
                photo={call.thread.photo}
                others={call.others}
                size={96}
              />
            )}
            {inCall && soloRemote?.media && !soloRemote.media.mic && (
              <span
                className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3b3c] ring-2 ring-[#1c1c1d]"
                role="img"
                aria-label={`${soloPeer?.firstName ?? "They"} muted their mic`}
              >
                <MicOff size={14} />
              </span>
            )}
          </span>
          <h1 className="mt-4 font-bold text-[20px] leading-6">{call.thread.name}</h1>
          <p className="mt-1 text-[15px] text-white/75 leading-5" aria-live="polite">
            {status}
          </p>
          {joined && local.settled && local.micBlocked && (
            <Pill>
              {local.camBlocked && !media.cam
                ? "Facebook can't access your camera or microphone"
                : "Facebook can't access your microphone"}
            </Pill>
          )}
          {joined && local.settled && !local.micBlocked && local.camBlocked && !media.cam && (
            <Pill>Facebook can't access your camera</Pill>
          )}
        </div>
      )}

      {/* Your own camera (or shared screen) as a corner preview you can drag. */}
      {selfView && localStream && (
        <SelfView stream={localStream} mirrored={media.cam} screen={media.screen} />
      )}

      <Controls>
        {joined ? (
          <>
            <Control
              label={media.cam ? "Turn off camera" : "Turn on camera"}
              active={!media.cam}
              disabled={local.busy}
              onClick={() => void local.setCamera(!media.cam)}
            >
              {media.cam ? <Video size={22} /> : <VideoOff size={22} />}
            </Control>
            {local.canShare && (
              <Control
                label={media.screen ? "Stop sharing" : "Share screen"}
                active={media.screen}
                pressed={media.screen}
                disabled={local.busy}
                onClick={() => (media.screen ? local.stopScreen() : void local.shareScreen())}
              >
                {media.screen ? <ScreenShareOff size={22} /> : <MonitorUp size={22} />}
              </Control>
            )}
            <Control
              label={media.mic ? "Mute" : "Unmute"}
              active={!media.mic}
              disabled={!local.audio}
              onClick={() => setMic((v) => !v)}
            >
              {media.mic ? <Mic size={22} /> : <MicOff size={22} />}
            </Control>
            <Menu open={menuOpen} onOpenChange={setMenuOpen}>
              <Tooltip content="More options" side="top">
                <MenuTrigger asChild>
                  <CallButton aria-label="More options">
                    <MoreHorizontal size={24} />
                  </CallButton>
                </MenuTrigger>
              </Tooltip>
              <MenuContent align="center" width={248} className="dark z-[90]! text-primary">
                <MenuItem
                  icon={<Settings size={20} />}
                  label="Settings"
                  onSelect={() => setDialog("settings")}
                />
                <MenuItem
                  icon={<Flag size={20} />}
                  label="Report a problem"
                  onSelect={() => setDialog("report")}
                />
              </MenuContent>
            </Menu>
            <Control label="End call" tone="danger" onClick={hangUp}>
              <PhoneIcon size={24} className="rotate-[135deg]" />
            </Control>
          </>
        ) : live ? (
          <>
            <Control
              label="Decline"
              caption
              tone="danger"
              onClick={() => {
                if (call.status === "ringing") void decline({ callId: call._id }).catch(() => {});
                onClose();
              }}
            >
              <PhoneIcon size={24} className="rotate-[135deg]" />
            </Control>
            <Control
              label={call.status === "ringing" ? "Accept" : "Join"}
              caption
              tone="positive"
              onClick={() => void accept({ callId: call._id }).catch(() => {})}
            >
              {isVideo ? <VideoCallIcon size={24} /> : <PhoneIcon size={22} />}
            </Control>
          </>
        ) : (
          <>
            <Control label="Close" caption onClick={onClose}>
              <X size={24} strokeWidth={2.4} />
            </Control>
            <Control
              label={call.role === "caller" && !failed ? "Call again" : "Call back"}
              caption
              tone="positive"
              onClick={() => onCallAgain(call.conversationId, call.kind)}
            >
              {isVideo ? <VideoCallIcon size={24} /> : <PhoneIcon size={22} />}
            </Control>
          </>
        )}
      </Controls>

      <CallSettingsDialog
        open={dialog === "settings"}
        onOpenChange={(o) => setDialog(o ? "settings" : null)}
        media={local}
      />
      <ReportCallDialog
        open={dialog === "report"}
        onOpenChange={(o) => setDialog(o ? "report" : null)}
        callId={call._id}
      />
    </Shell>
  );
}

const showsVideo = (p: RemotePeer) =>
  !!(p.media?.cam || p.media?.screen) &&
  !!p.stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);

function Pill({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/85">{children}</p>
  );
}

function PeerTile({ person, peer }: { person: Person; peer: RemotePeer | undefined }) {
  const video = !!peer && showsVideo(peer);
  const state = peer?.state;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#3a3b3c]">
      {video && peer ? (
        <StreamVideo
          stream={peer.stream}
          version={peer.version}
          fit={peer.media?.screen ? "contain" : "cover"}
          className="absolute inset-0"
        />
      ) : (
        <Avatar src={person.avatar} size={64} />
      )}
      <span className="absolute bottom-1.5 left-2 flex items-center gap-1 font-semibold text-[13px] [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        {person.name}
        {peer?.media && !peer.media.mic && <MicOff size={12} aria-label="Muted" />}
      </span>
      {state && state !== "connected" && (
        <span className="absolute top-1.5 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[12px] text-white/85">
          {state === "disconnected" ? "Reconnecting…" : state === "failed" ? "Lost" : "Connecting…"}
        </span>
      )}
    </div>
  );
}

type Corner = "tl" | "tr" | "bl" | "br";
const CORNER_CLASS: Record<Corner, string> = {
  tl: "top-24 left-3",
  tr: "top-24 right-3",
  bl: "bottom-[104px] left-3",
  br: "bottom-[104px] right-3",
};

/** Self-view preview: drag it anywhere and it snaps to the nearest corner. */
function SelfView({
  stream,
  mirrored,
  screen,
}: {
  stream: MediaStream;
  mirrored: boolean;
  screen: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [corner, setCorner] = useState<Corner>("br");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!d || !el || !parent) return;
    const maxLeft = parent.clientWidth - el.offsetWidth - 8;
    const maxTop = parent.clientHeight - el.offsetHeight - 8;
    setPos({
      left: Math.min(Math.max(8, d.left + e.clientX - d.x), maxLeft),
      top: Math.min(Math.max(8, d.top + e.clientY - d.y), maxTop),
    });
  };
  const onUp = () => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    drag.current = null;
    if (!el || !parent || !pos) return;
    const right = pos.left + el.offsetWidth / 2 > parent.clientWidth / 2;
    const bottom = pos.top + el.offsetHeight / 2 > parent.clientHeight / 2;
    setCorner(`${bottom ? "b" : "t"}${right ? "r" : "l"}` as Corner);
    setPos(null);
  };

  return (
    <div
      ref={ref}
      role="img"
      aria-label={screen ? "Your shared screen" : "Your camera"}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={pos ?? undefined}
      className={cn(
        "absolute z-10 cursor-grab touch-none select-none overflow-hidden rounded-lg bg-black shadow-[0_2px_8px_rgba(0,0,0,.5)] ring-1 ring-white/10 active:cursor-grabbing",
        screen ? "h-[100px] w-[160px]" : "h-[132px] w-[96px]",
        !pos && CORNER_CLASS[corner],
      )}
    >
      <StreamVideo
        stream={stream}
        mirrored={mirrored}
        fit={screen ? "contain" : "cover"}
        className="pointer-events-none h-full w-full"
      />
    </div>
  );
}

function StreamVideo({
  stream,
  version,
  mirrored,
  fit = "cover",
  className,
}: {
  stream: MediaStream | null;
  version?: number;
  mirrored?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-attaches after new tracks
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream, version]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn(
        "h-full w-full",
        fit === "cover" ? "object-cover" : "object-contain",
        mirrored && "-scale-x-100",
        className,
      )}
    />
  );
}

function RemoteAudio({ peer, sinkId }: { peer: RemotePeer; sinkId?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { stream, version } = peer;
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-attaches after new tracks
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream, version]);
  // The speaker picked in Settings, where the browser supports choosing one.
  useEffect(() => {
    const el = ref.current;
    if (el && sinkId && "setSinkId" in el) void el.setSinkId(sinkId).catch(() => {});
  }, [sinkId]);
  // biome-ignore lint/a11y/useMediaCaption: live call audio has no captions
  return <audio ref={ref} autoPlay className="hidden" />;
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [ticking]);
  return now;
}

function Shell({
  children,
  label,
  variant = "window",
  rtc,
}: {
  children: ReactNode;
  label?: string;
  variant?: "window" | "modal";
  /** Peer connection states, exposed for debugging ("connected", "failed"…). */
  rtc?: string;
}) {
  // The call window always uses Facebook's dark theme.
  const className = cn(
    "dark relative flex flex-col overflow-hidden bg-[#1c1c1d] text-white",
    variant === "window"
      ? "h-dvh w-full"
      : "h-[min(640px,calc(100vh-48px))] w-[min(420px,calc(100vw-32px))] rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.5),0_2px_4px_rgba(0,0,0,.3)]",
  );
  const name = label ?? "Messenger call";
  if (variant === "window")
    return (
      <main aria-label={name} data-rtc={rtc} className={className}>
        {children}
      </main>
    );
  return (
    <div role="dialog" aria-modal="true" aria-label={name} data-rtc={rtc} className={className}>
      {children}
    </div>
  );
}

function Controls({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex shrink-0 items-start justify-center gap-4 pt-4 pb-8">
      {children}
    </div>
  );
}

/** Two soft rings pulse out of the avatar while a call rings. */
function RingPulse() {
  return (
    <>
      <span className="absolute inset-0 animate-ping rounded-full bg-white/25 [animation-duration:1.6s]" />
      <span className="absolute -inset-3 animate-ping rounded-full bg-white/10 [animation-delay:.4s] [animation-duration:1.6s]" />
    </>
  );
}

/** "Calling…" / "Connecting…" with the trailing dots cycling. */
function Dots({ label }: { label: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {label}
      <span className="inline-block w-3 text-left" aria-hidden>
        {".".repeat(n)}
      </span>
    </>
  );
}

const TONE_CLASS = {
  danger: "bg-[#e41e3f] text-white",
  positive: "bg-[#31a24c] text-white",
  active: "bg-white text-[#1c1c1d]",
  idle: "bg-white/20 text-white backdrop-blur-sm",
};

/** Round call-control button; forwards props so Radix triggers can wrap it. */
function CallButton({
  tone = "idle",
  className,
  ...props
}: ComponentPropsWithRef<"button"> & { tone?: keyof typeof TONE_CLASS }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 aria-expanded:bg-white aria-expanded:text-[#1c1c1d]",
        TONE_CLASS[tone],
        className,
      )}
    />
  );
}

export function Control({
  label,
  onClick,
  tone,
  active,
  pressed,
  caption,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger" | "positive";
  /** Highlighted: a camera or mic that's off, or a screen being shared. */
  active?: boolean;
  pressed?: boolean;
  caption?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const button = (
    <CallButton
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      tone={tone ?? (active ? "active" : "idle")}
    >
      {children}
    </CallButton>
  );
  if (caption)
    return (
      <div className="flex w-16 flex-col items-center gap-2">
        {button}
        <span className="text-[13px] text-white/85">{label}</span>
      </div>
    );
  return (
    <Tooltip content={label} side="top">
      {button}
    </Tooltip>
  );
}

/** The /call/<id> pop-up window. */
export function CallWindowPage({ callId }: { callId: string }) {
  const navigate = useNavigate();
  const start = useM(api.calls.start);
  const close = () => {
    // Pop-ups opened by Facebook close themselves; a pasted link goes back to Messenger.
    if (window.opener) window.close();
    else void navigate({ to: "/messages" });
  };
  return (
    <CallScreen
      callId={callId}
      variant="window"
      onClose={close}
      onCallAgain={(conversationId, kind) =>
        void start({ conversationId, kind })
          .then((id) => navigate({ to: "/call/$callId", params: { callId: id }, replace: true }))
          .catch(() => {})
      }
    />
  );
}
