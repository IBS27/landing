/**
 * External inputs of the Gaming key art: freely licensed Wikimedia Commons
 * photos (composited under the photographic covers) and Google Fonts (SIL OFL)
 * used for each game's wordmark. `fetch.ts` downloads both into `.cache/`.
 */

/** Photo key → Commons file title. */
export const PHOTOS = {
  cabin: "File:Valley Forge cabin.jpg",
  port: "File:Cranes at Oakland's container terminal.jpg",
  milkyway: "File:Kaçkar Mountains Night Sky View.jpg",
  lake: "File:Tenaya Lake reflection.jpg",
  temple: "File:Angkor Wat Ta Prohm Temple doorway overgrown with tree roots.jpg",
  steam: "File:Steam locomotive C 62 2.jpg",
  rink: "File:Ice hockey puck on ice 20180112.jpg",
  chips: "File:Poker Chips (21822739836).jpg",
  meadow: "File:Asteraceae meadow (202558757).jpg",
  parlor: "File:Living Room at Val-Kill Cottage (945fe09f-db21-439d-b8cc-fab62236e518).tif",
  lounge: "File:Cozy living room setting with a yellow sofa and a coffee table adorned with cups and a flower pot.jpg",
  castle: "File:Corfe Castle sunset - geograph.org.uk - 4735444.jpg",
} as const;
export type PhotoKey = keyof typeof PHOTOS;

/** Authors missing from a file's structured metadata (taken from its upload log). */
export const CREATORS: Partial<Record<PhotoKey, string>> = {
  steam: "Pantoine",
};

/** Google Fonts families (name → css2 axis spec). */
export const FONTS = {
  "Lilita One": "",
  "Luckiest Guy": "",
  "Cinzel Decorative": ":wght@900",
  "Alfa Slab One": "",
  Bungee: "",
  "Berkshire Swash": "",
  "Playfair Display": ":ital,wght@1,900",
  "Yeseva One": "",
  Chewy: "",
  Righteous: "",
  Fredoka: ":wght@700",
  "Baloo 2": ":wght@800",
  Poppins: ":wght@800",
  "Bowlby One": "",
  Rye: "",
  Quicksand: ":wght@700",
  Grandstander: ":wght@900",
  "Russo One": "",
  "Pirata One": "",
  "Paytone One": "",
  "Black Ops One": "",
  "Titan One": "",
  "Abril Fatface": "",
  "Press Start 2P": "",
} as const;
