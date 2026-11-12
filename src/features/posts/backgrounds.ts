/**
 * Colored backgrounds for short text posts and text stories. The key is what
 * Convex stores (`posts.background`, `stories.background`); the first ten
 * match the seed's palette (convex/seed/lib/backgrounds.ts).
 */
export type Background = { key: string; css: string; text: string; label: string };

export const BACKGROUNDS: Background[] = [
  {
    key: "purple",
    css: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
    text: "#fff",
    label: "Purple gradient",
  },
  {
    key: "sunset",
    css: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
    text: "#fff",
    label: "Sunset gradient",
  },
  {
    key: "ocean",
    css: "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
    text: "#fff",
    label: "Ocean gradient",
  },
  {
    key: "peach",
    css: "linear-gradient(135deg, #ffb88c 0%, #de6262 100%)",
    text: "#fff",
    label: "Peach gradient",
  },
  {
    key: "mint",
    css: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)",
    text: "#fff",
    label: "Mint gradient",
  },
  {
    key: "pink",
    css: "linear-gradient(135deg, #ff0080 0%, #ff8c00 100%)",
    text: "#fff",
    label: "Pink gradient",
  },
  {
    key: "night",
    css: "linear-gradient(135deg, #232526 0%, #414345 100%)",
    text: "#fff",
    label: "Night gradient",
  },
  {
    key: "sky",
    css: "linear-gradient(180deg, #56ccf2 0%, #2f80ed 100%)",
    text: "#fff",
    label: "Sky gradient",
  },
  {
    key: "berry",
    css: "linear-gradient(135deg, #c33764 0%, #1d2671 100%)",
    text: "#fff",
    label: "Berry gradient",
  },
  {
    key: "lemon",
    css: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    text: "#fff",
    label: "Lemon gradient",
  },
  { key: "red", css: "#e2013b", text: "#fff", label: "Solid red" },
  {
    key: "blue",
    css: "linear-gradient(180deg, #1877f2 0%, #0a4cbf 100%)",
    text: "#fff",
    label: "Story blue",
  },
];

const byKey = new Map(BACKGROUNDS.map((b) => [b.key, b]));

/** Resolve a stored background: a known key, or raw CSS (seed data stores gradients directly). */
export function backgroundFor(value: string | null | undefined): Background | null {
  if (!value) return null;
  const known = byKey.get(value);
  if (known) return known;
  if (/^(#|linear-gradient|radial-gradient|rgb|hsl)/.test(value))
    return { key: value, css: value, text: "#fff", label: "Custom" };
  return null;
}
