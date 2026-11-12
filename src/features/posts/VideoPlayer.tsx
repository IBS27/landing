import { Maximize, Minimize } from "lucide-react";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/format";
import { Spinner } from "@/ui/primitives";

/* ------------------------------------------------------------------ */
/* Shared state                                                        */
/* ------------------------------------------------------------------ */

/**
 * Facebook keeps one sound preference per session: unmute one video and the
 * next ones autoplay with sound too. Muted until the viewer opts in.
 */
let soundOn = false;
const soundListeners = new Set<() => void>();
export function setSoundOn(on: boolean) {
  soundOn = on;
  for (const l of soundListeners) l();
}
export function useSoundOn() {
  return useSyncExternalStore(
    (l) => {
      soundListeners.add(l);
      return () => soundListeners.delete(l);
    },
    () => soundOn,
  );
}

/** Live playback state of a <video> element. */
export function useVideoState(ref: RefObject<HTMLVideoElement | null>) {
  const [s, setS] = useState({ playing: false, time: 0, duration: 0, waiting: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = (waiting?: boolean) =>
      setS((p) => ({
        playing: !el.paused,
        time: el.currentTime,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        waiting: waiting ?? p.waiting,
      }));
    const on = () => sync();
    const wait = () => sync(true);
    const ready = () => sync(false);
    const events = ["play", "pause", "timeupdate", "durationchange", "loadedmetadata", "seeked"];
    for (const e of events) el.addEventListener(e, on);
    el.addEventListener("waiting", wait);
    el.addEventListener("playing", ready);
    el.addEventListener("canplay", ready);
    sync();
    return () => {
      for (const e of events) el.removeEventListener(e, on);
      el.removeEventListener("waiting", wait);
      el.removeEventListener("playing", ready);
      el.removeEventListener("canplay", ready);
    };
  }, [ref]);
  return s;
}

/** Smooth progress (0–1) for thin progress bars, driven by animation frames while playing. */
export function useVideoProgress(ref: RefObject<HTMLVideoElement | null>, playing: boolean) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      setP(el.duration > 0 ? el.currentTime / el.duration : 0);
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [ref, playing]);
  return p;
}

export function formatVideoTime(s: number) {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Plays `el`, falling back to muted playback when the browser blocks sound. */
export function safePlay(el: HTMLVideoElement) {
  el.play().catch(() => {
    if (el.muted) return;
    el.muted = true;
    setSoundOn(false);
    void el.play().catch(() => {});
  });
}

/* ------------------------------------------------------------------ */
/* Icons (Facebook's player uses solid white glyphs)                   */
/* ------------------------------------------------------------------ */

type IconProps = { size?: number; className?: string };
export function PlayGlyph({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      <path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.3 0-1.7L8.6 3.9C7.9 3.5 7 4 7 4.8Z" />
    </svg>
  );
}
export function PauseGlyph({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
    </svg>
  );
}
function GearGlyph({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z" />
    </svg>
  );
}
export function VolumeGlyph({ muted, size = 20 }: IconProps & { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      {muted ? (
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63Zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z" />
      ) : (
        <path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Inline player                                                       */
/* ------------------------------------------------------------------ */

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Facebook's inline video player (feed, Watch, Marketplace). Autoplays muted
 * once at least half of it is on screen and pauses when it scrolls away; a
 * click toggles playback. Hovering reveals the control bar: play/pause, time,
 * scrubber, settings, fullscreen and volume. The video is letterboxed on black
 * inside whatever box the caller sizes.
 */
export function VideoPlayer({
  src,
  poster,
  label,
  className,
  style,
  autoPlay = true,
  loop = false,
  fit = "contain",
}: {
  src: string;
  poster?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** Muted autoplay when ≥50% in view (Facebook's feed behavior). */
  autoPlay?: boolean;
  loop?: boolean;
  fit?: "contain" | "cover";
}) {
  const root = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const state = useVideoState(ref);
  const sound = useSoundOn();
  const [volume, setVolume] = useState(1);
  /** The viewer paused it: don't resume on scroll. */
  const userPaused = useRef(false);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(false);
  const [menu, setMenu] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const idle = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = !sound;
  }, [sound]);

  // Autoplay while ≥50% visible.
  useEffect(() => {
    const el = ref.current;
    const box = root.current;
    if (!el || !box || !autoPlay) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.5) {
          if (!userPaused.current && el.paused) safePlay(el);
        } else if (!el.paused) el.pause();
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [autoPlay]);

  useEffect(() => {
    if (state.playing) setStarted(true);
  }, [state.playing]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => () => window.clearTimeout(idle.current), []);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      userPaused.current = false;
      safePlay(el);
    } else {
      userPaused.current = true;
      el.pause();
    }
  }, []);

  const wake = () => {
    setActive(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setActive(false), 2500);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  };

  const showControls = active || menu || (started && !state.playing) || !started;

  return (
    <div
      ref={root}
      className={cn("group/video relative overflow-hidden bg-black select-none", className)}
      style={style}
      onMouseMove={wake}
      onMouseEnter={wake}
      onMouseLeave={() => {
        window.clearTimeout(idle.current);
        setActive(false);
      }}
      data-video-player
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted={!sound}
        loop={loop}
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onEnded={() => {
          userPaused.current = true;
        }}
        className={cn(
          "block h-full w-full cursor-pointer",
          fit === "cover" && !fullscreen ? "object-cover" : "object-contain",
        )}
      />

      {state.waiting && state.playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner size={40} className="text-white/80" />
        </span>
      )}

      {/* Big centre play button while paused. */}
      {!state.playing && (
        <button
          type="button"
          aria-label="Play video"
          onClick={toggle}
          className="absolute top-1/2 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.9)_inset] transition-transform hover:scale-105"
        >
          <PlayGlyph size={34} className="ml-1" />
        </button>
      )}

      {/* Control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 transition-opacity duration-200",
          showControls && (started || active) ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative flex h-11 items-center gap-1 px-2 text-white">
          <BarButton label={state.playing ? "Pause" : "Play"} onClick={toggle}>
            {state.playing ? <PauseGlyph /> : <PlayGlyph />}
          </BarButton>
          <span className="shrink-0 px-1 font-medium text-[13px] tabular-nums leading-4 [text-shadow:0_0_2px_rgba(0,0,0,0.5)]">
            {formatVideoTime(state.time)} / {formatVideoTime(state.duration)}
          </span>
          <Scrubber
            time={state.time}
            duration={state.duration}
            onSeek={(t) => {
              if (ref.current) ref.current.currentTime = t;
            }}
          />
          <div className="relative">
            <BarButton label="Settings" onClick={() => setMenu((m) => !m)} pressed={menu}>
              <GearGlyph />
            </BarButton>
            {menu && (
              <SettingsMenu
                speed={speed}
                onSpeed={(s) => {
                  setSpeed(s);
                  if (ref.current) ref.current.playbackRate = s;
                  setMenu(false);
                }}
                onClose={() => setMenu(false)}
              />
            )}
          </div>
          <BarButton
            label={fullscreen ? "Exit full screen" : "Enter full screen"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <Minimize size={20} strokeWidth={2.5} />
            ) : (
              <Maximize size={20} strokeWidth={2.5} />
            )}
          </BarButton>
          <VolumeControl
            muted={!sound || volume === 0}
            volume={volume}
            onToggle={() => {
              const next = !sound;
              setSoundOn(next);
              if (next && volume === 0 && ref.current) {
                ref.current.volume = 1;
                setVolume(1);
              }
            }}
            onVolume={(v) => {
              setVolume(v);
              if (ref.current) ref.current.volume = v;
              setSoundOn(v > 0);
            }}
          />
        </div>
      </div>

      {/* Muted autoplay hint: Facebook keeps the speaker visible while muted. */}
      {!sound && state.playing && !showControls && (
        <button
          type="button"
          aria-label="Unmute"
          onClick={() => setSoundOn(true)}
          className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
        >
          <VolumeGlyph muted size={18} />
        </button>
      )}
    </div>
  );
}

function BarButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.4)] hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function Scrubber({
  time,
  duration,
  onSeek,
}: {
  time: number;
  duration: number;
  onSeek: (t: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const frac = drag ?? (duration > 0 ? time / duration : 0);
  const at = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  return (
    <div
      ref={bar}
      role="slider"
      tabIndex={0}
      aria-label="Change Position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={formatVideoTime(time)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(at(e.clientX));
      }}
      onPointerMove={(e) => drag !== null && setDrag(at(e.clientX))}
      onPointerUp={(e) => {
        if (drag === null) return;
        onSeek(at(e.clientX) * duration);
        setDrag(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(duration, time + 5));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, time - 5));
      }}
      className="group/scrub relative mx-1 flex h-6 min-w-0 flex-1 cursor-pointer items-center"
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/35">
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${frac * 100}%` }} />
      </div>
      <span
        className={cn(
          "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform",
          drag !== null ? "scale-100" : "scale-0 group-hover/scrub:scale-100",
        )}
        style={{ left: `${frac * 100}%` }}
      />
    </div>
  );
}

function SettingsMenu({
  speed,
  onSpeed,
  onClose,
}: {
  speed: number;
  onSpeed: (s: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.parentElement?.contains(t)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 bottom-full mb-2 w-[220px] rounded-lg bg-[#242526] p-2 text-[#e4e6eb] shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between rounded-md px-2 py-2 text-[15px]">
        <span className="font-semibold">Quality</span>
        <span className="text-[13px] text-[#b0b3b8]">Auto (720p)</span>
      </div>
      <div className="my-1 h-px bg-white/10" />
      <p className="px-2 pt-1 pb-1 font-semibold text-[15px]">Playback speed</p>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          role="menuitemradio"
          aria-checked={s === speed}
          onClick={() => onSpeed(s)}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[15px] hover:bg-white/10"
        >
          {s === 1 ? "Normal" : `${s}x`}
          {s === speed && <span className="h-2 w-2 rounded-full bg-[#2d88ff]" />}
        </button>
      ))}
    </div>
  );
}

function VolumeControl({
  muted,
  volume,
  onToggle,
  onVolume,
}: {
  muted: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="group/vol relative">
      <div className="pointer-events-none absolute bottom-full left-1/2 flex h-[104px] w-9 -translate-x-1/2 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover/vol:pointer-events-auto group-hover/vol:opacity-100">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label="Change volume"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="h-20 w-1 cursor-pointer accent-white [direction:rtl] [writing-mode:vertical-lr]"
        />
      </div>
      <BarButton label={muted ? "Unmute" : "Mute"} onClick={onToggle}>
        <VolumeGlyph muted={muted} />
      </BarButton>
    </div>
  );
}
