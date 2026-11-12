/**
 * One key-art scene per game in src/features/gaming/games.ts, each in its own
 * art direction (photographic composite, glossy 3D, neon, pixel, low-poly,
 * painterly, isometric, tabletop).
 */
import type { Art } from "./kit";
import { GLOSSY_SCENES } from "./scenes-3d";
import { PHOTO_SCENES } from "./scenes-photo";
import { STYLED_SCENES } from "./scenes-styled";

export const SCENES: Record<string, () => Art> = { ...PHOTO_SCENES, ...GLOSSY_SCENES, ...STYLED_SCENES };
