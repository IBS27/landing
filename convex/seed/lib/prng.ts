/** Deterministic randomness for the seed world. Never use Math.random in seed code. */

/** 32-bit FNV-1a hash of a string, used to derive stable seeds and picks. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof rng>;

/** A seeded PRNG; the same `seed` string always yields the same sequence. */
export function rng(seed: string) {
  const next = mulberry32(hash(seed));
  const r = {
    next,
    /** Integer in [lo, hi] inclusive. */
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: <T>(arr: readonly T[], n: number): T[] => r.shuffle(arr).slice(0, n),
    /** Pick a key of `weights` proportionally to its weight. */
    weighted: <K extends string>(weights: Readonly<Partial<Record<K, number>>>): K => {
      const entries = Object.entries(weights) as [K, number][];
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [k, w] of entries) {
        x -= w;
        if (x < 0) return k;
      }
      return entries[entries.length - 1][0];
    },
  };
  return r;
}
