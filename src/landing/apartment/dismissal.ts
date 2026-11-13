/**
 * Remembers that the person closed the Apartment tab's build line (#153), in
 * this browser: one key per unit, holding the build it was closed for, so the
 * next build's result shows again. Everything works without storage; the line
 * then comes back after a reload.
 */
export const dismissalKey = (unitId: string) => `landing:apartment:dismissed:${unitId}`;

/** Names one build result: its state and the revision that build published. */
export const dismissalToken = (build: { state: string; buildRevision: number | null }) =>
  `${build.state}:${build.buildRevision ?? "none"}`;

/** The token of the build whose line was closed for this unit, if any. */
export function dismissedBuild(unitId: string) {
  try {
    return localStorage.getItem(dismissalKey(unitId));
  } catch {
    return null;
  }
}
export function dismissBuild(unitId: string, token: string) {
  try {
    localStorage.setItem(dismissalKey(unitId), token);
  } catch {
    // Private mode or a full store: the line stays closed until the page reloads.
  }
}
