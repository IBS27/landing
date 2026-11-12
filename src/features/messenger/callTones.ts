import { useEffect } from "react";

/**
 * Call sounds synthesized with Web Audio. They only start in a document the
 * person has interacted with, since browsers block audio before a gesture
 * (and log a warning when a page tries).
 */

type Tone = {
  /** One cycle: [frequencies, start offset s, length s] notes. */
  notes: [number[], number, number][];
  period: number;
  gain: number;
};

/** US ringback while your call rings: 440 + 480 Hz, 2s on, 4s off. */
export const RINGBACK: Tone = { notes: [[[440, 480], 0, 2]], period: 6, gain: 0.035 };

/** Incoming ring: a rising two-note chime, twice, every 3 seconds. */
export const RINGTONE: Tone = {
  notes: [
    [[659.25], 0, 0.18],
    [[987.77], 0.2, 0.3],
    [[659.25], 0.7, 0.18],
    [[987.77], 0.9, 0.3],
  ],
  period: 3,
  gain: 0.05,
};

function canPlay() {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return ua ? ua.hasBeenActive : false;
}

export function useTone(tone: Tone, active: boolean) {
  useEffect(() => {
    if (!active || !canPlay() || !window.AudioContext) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = tone.gain;
    master.connect(ctx.destination);
    const cycle = (t0: number) => {
      for (const [freqs, at, len] of tone.notes) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(1, t0 + at + 0.02);
        g.gain.setValueAtTime(1, t0 + at + len - 0.03);
        g.gain.linearRampToValueAtTime(0, t0 + at + len);
        g.connect(master);
        for (const f of freqs) {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          o.connect(g);
          o.start(t0 + at);
          o.stop(t0 + at + len);
        }
      }
    };
    let next = ctx.currentTime + 0.2;
    const schedule = () => {
      // Keep about one cycle queued ahead.
      while (next < ctx.currentTime + tone.period) {
        cycle(next);
        next += tone.period;
      }
    };
    schedule();
    const t = setInterval(schedule, 1000);
    return () => {
      clearInterval(t);
      void ctx.close().catch(() => {});
    };
  }, [tone, active]);
}
