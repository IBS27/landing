import type { RoomKind, VibeValue } from "../../lib/vibe";

/**
 * Landing rooms for the seeded personas (#25), keyed by username. Marcus just
 * moved into an empty one-bedroom in the Mission and is furnishing it off
 * Marketplace, so his living room has a scan and a vibe he typed. Maya's new
 * bedroom has a typed vibe too, so her Marketplace matches and owned items can
 * be placed in 3D (#131). Everyone else starts without a room, so the scan and
 * Muse's suggestion can be demoed.
 *
 * Photos are seed images not used by any listing (credits in
 * public/seed/ATTRIBUTION.md).
 */
export type RoomSeed = {
  username: string;
  name: string;
  kind: RoomKind;
  photos: string[];
  size?: { widthFt: number; lengthFt: number };
  /** A vibe the person typed. */
  vibe?: VibeValue;
  /** Days before seed time the room was added. */
  daysAgo: number;
};

export const roomSeeds: RoomSeed[] = [
  {
    username: "marcus.bell",
    name: "Living room",
    kind: "living_room",
    photos: [
      "/seed/rooms/living-room-17.jpg",
      "/seed/rooms/studio-05.jpg",
      "/seed/rooms/studio-06.jpg",
    ],
    size: { widthFt: 12, lengthFt: 15 },
    vibe: {
      summary:
        "Warm mid-century with a record shelf and a reading chair by the window: walnut, mustard and warm white.",
      styles: ["mid_century", "vintage"],
      palette: ["walnut", "mustard", "warm_white", "forest"],
      keywords: ["walnut", "record shelf", "reading chair", "floor lamp", "wool rug"],
    },
    daysAgo: 4,
  },
  {
    username: "maya.chen",
    name: "Bedroom",
    kind: "bedroom",
    photos: ["/seed/rooms/bedroom-24.jpg"],
    size: { widthFt: 11, lengthFt: 12 },
    vibe: {
      summary:
        "A calm mid-century bedroom with plants: walnut nightstands, a wool rug and a reading chair in the corner.",
      styles: ["mid_century", "botanical"],
      palette: ["walnut", "sage", "warm_white"],
      keywords: ["nightstand", "wool rug", "reading chair", "plants"],
    },
    daysAgo: 2,
  },
];
