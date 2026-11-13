/** Vouch note rules, shared by the server and the vouch dialog. Pure, so the client can import it. */

export const VOUCH_NOTE_MAX = 280;

/** A note as stored: whitespace collapsed and trimmed. Length limits apply to this. */
export function normalizeNote(note: string) {
  return note.replace(/\s+/g, " ").trim();
}
