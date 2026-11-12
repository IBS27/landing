import { Lock, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useM } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConversationAvatar } from "./ConversationAvatar";
import { PhoneIcon, VideoCallIcon } from "./icons";
import type { ConversationDetail } from "./util";

/** Facebook gives up on an unanswered call after about 20 seconds. */
const RING_MS = 20_000;

type CallTarget = Pick<ConversationDetail, "_id" | "kind" | "name" | "photo" | "others">;
type Call = { target: CallTarget; media: "audio" | "video"; id: number };

/* ---------- Store: one outgoing call at a time, started from any chat surface ---------- */

let current: Call | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function startCall(target: CallTarget, media: "audio" | "video") {
  if (current) return;
  current = { target, media, id: ++seq };
  emit();
}

function endCall() {
  current = null;
  emit();
}

function useCall() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Voice / video call buttons hide for chats that can't be called. */
export function canCall(c: Pick<ConversationDetail, "others">) {
  return c.others.length > 0;
}

/* ---------- Ringback: the US "ring-ring" (440 + 480 Hz, 2s on / 4s off) ---------- */

function useRingback(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const AC = window.AudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    for (const f of [440, 480]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
    }
    const t0 = ctx.currentTime + 0.4;
    for (let i = 0; i < 6; i++) {
      const at = t0 + i * 6;
      gain.gain.setValueAtTime(0.035, at);
      gain.gain.setValueAtTime(0, at + 2);
    }
    return () => {
      void ctx.close().catch(() => {});
    };
  }, [active]);
}

/* ---------- Camera preview ---------- */

function useCamera(on: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!on || !navigator.mediaDevices?.getUserMedia) return;
    let live = true;
    let got: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((s) => {
        got = s;
        if (live) setStream(s);
        else for (const t of s.getTracks()) t.stop();
      })
      .catch(() => {
        if (live) setDenied(true);
      });
    return () => {
      live = false;
      if (got) for (const t of got.getTracks()) t.stop();
      setStream(null);
    };
  }, [on]);
  return { stream, denied };
}

/** Mounted once (by the chat dock); renders the call window while a call is active. */
export function CallLayer() {
  const call = useCall();
  if (!call) return null;
  return <CallWindow key={call.id} call={call} />;
}

function CallWindow({ call }: { call: Call }) {
  const { target, media } = call;
  const logCall = useM(api.messenger.logCall);
  const [phase, setPhase] = useState<"calling" | "no_answer">("calling");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(media === "video");
  const startedAt = useRef(Date.now());
  const logged = useRef(false);
  const camera = useCamera(cameraOn);
  const videoRef = useRef<HTMLVideoElement>(null);
  useRingback(phase === "calling");

  const log = (outcome: "no_answer" | "cancelled") => {
    if (logged.current) return;
    logged.current = true;
    void logCall({
      conversationId: target._id as Id<"conversations">,
      media,
      outcome,
      durationMs: Date.now() - startedAt.current,
    }).catch(() => {});
  };
  const logRef = useRef(log);
  logRef.current = log;

  useEffect(() => {
    if (phase !== "calling") return;
    const t = setTimeout(() => {
      logRef.current("no_answer");
      setPhase("no_answer");
      setCameraOn(false);
    }, RING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.srcObject = camera.stream;
  }, [camera.stream]);

  const hangUp = () => {
    if (phase === "calling") log("cancelled");
    endCall();
  };
  const hangUpRef = useRef(hangUp);
  hangUpRef.current = hangUp;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hangUpRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showVideo = cameraOn && !!camera.stream && phase === "calling";
  const backdrop = target.photo ?? target.others[0]?.avatar ?? null;
  const title = phase === "calling" ? target.name : "No answer";
  const firstName = target.kind === "dm" ? (target.others[0]?.firstName ?? target.name) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${media === "video" ? "Video" : "Audio"} call with ${target.name}`}
        className="relative flex h-[min(640px,calc(100vh-48px))] w-[min(880px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl bg-[#1c1c1d] text-white shadow-[0_12px_28px_rgba(0,0,0,.5),0_2px_4px_rgba(0,0,0,.3)]"
      >
        {/* Blurred, darkened avatar fills the window like Messenger's call screen. */}
        {backdrop && !showVideo && (
          <img
            src={backdrop}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-[48px]"
          />
        )}
        {showVideo && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/35" aria-hidden />

        <div className="relative flex h-14 shrink-0 items-center justify-center gap-1.5 text-[13px] text-white/80">
          <Lock size={12} strokeWidth={2.6} />
          End-to-end encrypted
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
          <ConversationAvatar
            kind={target.kind}
            photo={target.photo}
            others={target.others}
            size={showVideo ? 72 : 120}
          />
          <h2 className="mt-5 font-bold text-[24px] leading-7">{title}</h2>
          <p className="mt-1.5 text-[15px] text-white/75 leading-5" aria-live="polite">
            {phase === "calling" ? (
              <CallingLabel />
            ) : firstName ? (
              `${firstName} isn't available right now.`
            ) : (
              "No one answered."
            )}
          </p>
          {cameraOn && camera.denied && phase === "calling" && (
            <p className="mt-3 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/85">
              Facebook can't access your camera
            </p>
          )}
        </div>

        <div className="relative flex shrink-0 items-start justify-center gap-6 pb-8">
          {phase === "calling" ? (
            <>
              <Control
                label={cameraOn ? "Turn off camera" : "Turn on camera"}
                active={!cameraOn}
                onClick={() => setCameraOn((v) => !v)}
              >
                {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
              </Control>
              <Control
                label={muted ? "Unmute" : "Mute"}
                active={muted}
                onClick={() => setMuted((v) => !v)}
              >
                {muted ? <MicOff size={22} /> : <Mic size={22} />}
              </Control>
              <Control label="End call" tone="danger" onClick={hangUp}>
                <PhoneIcon size={24} className="rotate-[135deg]" />
              </Control>
            </>
          ) : (
            <>
              <Control label="Close" caption onClick={endCall}>
                <X size={24} strokeWidth={2.4} />
              </Control>
              <Control
                label="Call again"
                caption
                tone="positive"
                onClick={() => {
                  endCall();
                  startCall(target, media);
                }}
              >
                {media === "video" ? <VideoCallIcon size={24} /> : <PhoneIcon size={22} />}
              </Control>
            </>
          )}
        </div>
      </div>
    </div>
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

function Control({
  label,
  onClick,
  tone,
  active,
  caption,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger" | "positive";
  active?: boolean;
  caption?: boolean;
  children: ReactNode;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={tone ? undefined : active}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2",
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
