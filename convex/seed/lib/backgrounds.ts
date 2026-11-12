/** Text-on-color post backgrounds (CSS gradients), referenced by name from seed posts. */
export const backgrounds = {
  purple: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
  sunset: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
  ocean: "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
  peach: "linear-gradient(135deg, #ffb88c 0%, #de6262 100%)",
  mint: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)",
  pink: "linear-gradient(135deg, #ff0080 0%, #ff8c00 100%)",
  night: "linear-gradient(135deg, #232526 0%, #414345 100%)",
  sky: "linear-gradient(180deg, #56ccf2 0%, #2f80ed 100%)",
  berry: "linear-gradient(135deg, #c33764 0%, #1d2671 100%)",
  lemon: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
} as const;

export type BackgroundName = keyof typeof backgrounds;
