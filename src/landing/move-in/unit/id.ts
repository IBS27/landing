/** Works on private HTTP preview origins too; IDs are labels, never authorization tokens. */
export function sceneId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
