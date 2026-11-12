import type { GroupSeed } from "../../types";

/**
 * Public neighborhood Groups (#15), one per neighborhood, where locals trade
 * recommendations. Public so shared outputs (#17 scores, #18 Weekend Routes)
 * can cite their threads. Covers are picked after the rest of the world so
 * adding Groups here never changes anyone else's photos.
 */
export const neighborhoodGroups = [] as const satisfies readonly GroupSeed[];
