import { RotateCcw } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import { GameCover } from "../GameCover";
import type { Game } from "../games";

/** Shared plumbing for the instant-game engines. */

export type EngineProps = { game: Game; onScore: (score: number) => void };
export type Phase = "ready" | "playing" | "over";

/**
 * Width of the play area. Engines lay out at this natural size; the game
 * player scales the whole frame to fit its stage (see `GameStage`).
 */
export const BOARD = 388;

/**
 * The scale the game player draws the board at (1 outside it). Pointer math
 * in board pixels divides screen distances by it.
 */
export function gameScale(el: Element) {
  const v = Number(el.closest<HTMLElement>("[data-game-scale]")?.dataset.gameScale);
  return v > 0 ? v : 1;
}

export function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const randInt = (n: number) => Math.floor(Math.random() * n);
export const pick = <T,>(xs: readonly T[]) => xs[randInt(xs.length)];
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Reports the running score to the dialog (which keeps the best score). */
export function useReport(score: number, onScore: (s: number) => void) {
  useEffect(() => onScore(score), [score, onScore]);
}

/**
 * Window keydown handler while `enabled`. Return true to consume the key.
 * Typing in fields is ignored, and Enter/Space on a focused button keep their
 * native meaning (pressing it).
 */
export function useKeys(handler: (e: KeyboardEvent) => boolean | undefined, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      if ((e.key === "Enter" || e.key === " ") && t?.closest("button, a")) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [enabled]);
}

/** Keys currently held (for real-time games). */
export function useHeldKeys(enabled: boolean) {
  const held = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    const set = held.current;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (/^(Arrow|w$|a$|s$|d$| $)/.test(k)) e.preventDefault();
      set.add(k);
    };
    const up = (e: KeyboardEvent) => set.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const blur = () => set.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      set.clear();
    };
  }, [enabled]);
  return held;
}

/** requestAnimationFrame loop while `running`; `step` gets seconds since last frame. */
export function useFrame(step: (dt: number) => void, running: boolean) {
  const ref = useRef(step);
  ref.current = step;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** A crisp (device-pixel-ratio aware) 2D canvas of a fixed CSS size. */
export function useCanvas(width: number, height: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // The player scales boards up (often ~2x), so keep extra backing pixels to stay crisp.
    const dpr = Math.min(4, (window.devicePixelRatio || 1) * 2);
    c.width = width * dpr;
    c.height = height * dpr;
    const x = c.getContext("2d");
    x?.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.current = x;
  }, [width, height]);
  return { ref, ctx };
}

/** Pointer position relative to an element, in the board's (unscaled) CSS pixels. */
export function localPoint(e: { clientX: number; clientY: number }, el: Element) {
  const r = el.getBoundingClientRect();
  const k = gameScale(el);
  return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
}

/**
 * The frame every engine renders in: an optional HUD row, the board with the
 * start and game-over screens laid over it, and a footer with the controls
 * hint and Restart.
 */
export function GameFrame({
  game,
  phase,
  howTo,
  overTitle = "Game over",
  overDetail,
  onStart,
  hud,
  hint,
  extra,
  children,
  className,
  style,
}: {
  game: Game;
  phase: Phase;
  /** One line on the start screen explaining the goal. */
  howTo: string;
  overTitle?: string;
  overDetail?: ReactNode;
  onStart: () => void;
  hud?: ReactNode;
  hint: string;
  /** Extra footer buttons (Undo, Hint…), shown while playing. */
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  useKeys((e) => {
    if (e.key !== "Enter" && e.key !== " ") return false;
    onStart();
    return true;
  }, phase !== "playing");

  return (
    <div className="flex flex-col gap-2">
      {hud && (
        // `w-0 min-w-full`: the HUD and footer span the board without widening the frame.
        <div className="flex h-6 w-0 min-w-full items-center justify-between gap-2 text-[13px] text-secondary [&_b]:font-semibold [&_b]:text-primary">
          {hud}
        </div>
      )}
      <div
        className={cn("relative mx-auto select-none overflow-hidden rounded-lg", className)}
        style={style}
      >
        {children}
        {phase !== "playing" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center text-white backdrop-blur-[2px]">
            {phase === "ready" ? (
              <>
                <span className="h-[72px] w-[72px] overflow-hidden rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                  <GameCover game={game} variant="icon" className="block h-full w-full" />
                </span>
                <p className="font-bold text-[20px] leading-6">{game.name}</p>
                <p className="max-w-[300px] text-[15px] text-white/85 leading-5">{howTo}</p>
              </>
            ) : (
              <>
                <p className="font-bold text-[24px] leading-7">{overTitle}</p>
                {overDetail && <p className="text-[15px] text-white/85 leading-5">{overDetail}</p>}
              </>
            )}
            <Button variant="primary" size="lg" className="mt-1 min-w-[120px]" onClick={onStart}>
              {phase === "ready" ? "Play" : "Play again"}
            </Button>
          </div>
        )}
      </div>
      <div className="flex min-h-8 w-0 min-w-full items-center justify-between gap-2">
        <p className="min-w-0 text-[13px] text-secondary leading-4">{hint}</p>
        {phase === "playing" && (
          <div className="flex shrink-0 gap-1">
            {extra}
            <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={onStart}>
              Restart
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
