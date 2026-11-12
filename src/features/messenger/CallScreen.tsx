import { useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Lock, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatCallClock, formatCallDuration } from "../../../convex/lib/callFormat";
import { ConversationAvatar } from "./ConversationAvatar";
import { RINGBACK, useTone } from "./callTones";
import { PhoneIcon, VideoCallIcon } from "./icons";
import { type RemotePeer, useCallPeers, useLocalMedia } from "./useCallPeers";

type CallView = NonNullable<FunctionReturnType<typeof api.calls.get>>;
type Person = CallView["others"][number];

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

  const live = call.status === "ringing" || call.status === "active";
  const joined = live && call.joinedIds.includes(me);
  const connected = joined && call.status === "active";
  const ringingOut = joined && call.status === "ringing";
  const isVideo = call.kind === "video";

  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(isVideo);
  const local = useLocalMedia(call.kind, joined);
  const hasCam = !!local.stream?.getVideoTracks().length;
  const hasMic = !!local.stream?.getAudioTracks().length;
  const media = useMemo(
    () => ({ mic: mic && hasMic, cam: cam && hasCam }),
    [mic, cam, hasMic, hasCam],
  );

  const peerIds = useMemo(
    () => (connected ? call.joinedIds.filter((id) => id !== me) : []),
    [connected, call.joinedIds, me],
  );
  const remote = useCallPeers({
    callId: call._id,
    me,
    callerId: call.callerId,
    kind: call.kind,
    peers: peerIds,
    active: connected,
    local: local.stream,
    localSettled: local.settled,
    media,
  });

  useTone(RINGBACK, ringingOut);

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

  const hangUp = () => {
    void leave({ callId: call._id }).catch(() => {});
    onClose();
  };
  const hangUpRef = useRef(hangUp);
  hangUpRef.current = hangUp;
  useEffect(() => {
    if (variant !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hangUpRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const firstOther = call.others[0];
  const isGroup = call.thread.kind === "group";
  const now = useNow(connected || call.status === "ringing");
  const durationMs = call.answeredAt ? (call.endedAt ?? now) - call.answeredAt : 0;

  let status: ReactNode;
  if (!live) {
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
  else if (ringingOut) status = <CallingLabel />;
  else status = <span className="tabular-nums">{formatCallClock(Math.max(0, durationMs))}</span>;

  // 1:1 shows the other person full-bleed; group calls tile everyone in.
  const remotePeople = call.others.filter((o) => peerIds.includes(o._id));
  const solo = remotePeople.length <= 1;
  const soloPeer = solo ? remotePeople[0] : undefined;
  const soloRemote = soloPeer ? remote[soloPeer._id] : undefined;
  const soloVideo = !!soloRemote && showsVideo(soloRemote);
  const localVideoFull = ringingOut && media.cam;
  const backdrop = call.thread.photo ?? firstOther?.avatar ?? null;

  return (
    <Shell
      label={`${isVideo ? "Video" : "Audio"} call with ${call.thread.name}`}
      variant={variant}
      rtc={connected ? remotePeople.map((p) => remote[p._id]?.state ?? "new").join(" ") : undefined}
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
        <StreamVideo stream={local.stream} mirrored className="absolute inset-0" />
      )}
      {connected && solo && soloVideo && soloRemote && (
        <StreamVideo
          stream={soloRemote.stream}
          version={soloRemote.version}
          className="absolute inset-0"
        />
      )}
      {/* Remote audio plays even while their camera is off. */}
      {connected &&
        remotePeople.map((p) => {
          const r = remote[p._id];
          return r ? <RemoteAudio key={p._id} peer={r} /> : null;
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

      {connected && !solo ? (
        <div className="relative grid flex-1 auto-rows-fr grid-cols-2 gap-2 p-3">
          {remotePeople.map((p) => (
            <PeerTile key={p._id} person={p} peer={remote[p._id]} />
          ))}
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
            {status}
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
            {connected && soloRemote?.media && !soloRemote.media.mic && (
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
          {joined && local.settled && !hasMic && (
            <p className="mt-3 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/85">
              {isVideo && !hasCam
                ? "Facebook can't access your camera or microphone"
                : "Facebook can't access your microphone"}
            </p>
          )}
          {joined && local.settled && hasMic && isVideo && !hasCam && (
            <p className="mt-3 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/85">
              Facebook can't access your camera
            </p>
          )}
        </div>
      )}

      {/* Your own camera as a picture-in-picture once connected. */}
      {connected && media.cam && (
        <div className="absolute right-3 bottom-[96px] h-[132px] w-[96px] overflow-hidden rounded-lg bg-black shadow-[0_2px_8px_rgba(0,0,0,.5)]">
          <StreamVideo stream={local.stream} mirrored className="h-full w-full" />
        </div>
      )}

      <Controls>
        {joined ? (
          <>
            {isVideo && (
              <Control
                label={media.cam ? "Turn off camera" : "Turn on camera"}
                active={!media.cam}
                disabled={!hasCam}
                onClick={() => setCam((v) => !v)}
              >
                {media.cam ? <Video size={22} /> : <VideoOff size={22} />}
              </Control>
            )}
            <Control
              label={media.mic ? "Mute" : "Unmute"}
              active={!media.mic}
              disabled={!hasMic}
              onClick={() => setMic((v) => !v)}
            >
              {media.mic ? <Mic size={22} /> : <MicOff size={22} />}
            </Control>
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
              label={call.role === "caller" ? "Call again" : "Call back"}
              caption
              tone="positive"
              onClick={() => onCallAgain(call.conversationId, call.kind)}
            >
              {isVideo ? <VideoCallIcon size={24} /> : <PhoneIcon size={22} />}
            </Control>
          </>
        )}
      </Controls>
    </Shell>
  );
}

const showsVideo = (p: RemotePeer) =>
  !!p.media?.cam && !!p.stream?.getVideoTracks().some((t) => t.readyState === "live");

function PeerTile({ person, peer }: { person: Person; peer: RemotePeer | undefined }) {
  const video = !!peer && showsVideo(peer);
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#3a3b3c]">
      {video && peer ? (
        <StreamVideo stream={peer.stream} version={peer.version} className="absolute inset-0" />
      ) : (
        <Avatar src={person.avatar} size={64} />
      )}
      <span className="absolute bottom-1.5 left-2 flex items-center gap-1 font-semibold text-[13px] [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        {person.firstName}
        {peer?.media && !peer.media.mic && <MicOff size={12} aria-label="Muted" />}
      </span>
    </div>
  );
}

function StreamVideo({
  stream,
  version,
  mirrored,
  className,
}: {
  stream: MediaStream | null;
  version?: number;
  mirrored?: boolean;
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
      className={cn("h-full w-full object-cover", mirrored && "-scale-x-100", className)}
    />
  );
}

function RemoteAudio({ peer }: { peer: RemotePeer }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { stream, version } = peer;
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-attaches after new tracks
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream, version]);
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
  const className = cn(
    "relative flex flex-col overflow-hidden bg-[#1c1c1d] text-white",
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
    <div className="relative flex shrink-0 items-start justify-center gap-6 pt-4 pb-8">
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

/** "Calling" with the trailing dots cycling. */
function CallingLabel() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      Calling
      <span className="inline-block w-3 text-left">{".".repeat(n)}</span>
    </>
  );
}

export function Control({
  label,
  onClick,
  tone,
  active,
  caption,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger" | "positive";
  active?: boolean;
  caption?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={tone || caption ? undefined : active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100",
        tone === "danger"
          ? "bg-[#e41e3f] text-white"
          : tone === "positive"
            ? "bg-[#31a24c] text-white"
            : active
              ? "bg-white text-[#1c1c1d]"
              : "bg-white/20 text-white backdrop-blur-sm",
      )}
    >
      {children}
    </button>
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
